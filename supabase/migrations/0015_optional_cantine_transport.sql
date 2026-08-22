-- =========================================================================
-- Cantine et transport ne sont pas obligatoires : contrairement à
-- l'inscription/l'uniforme (dus par tous les élèves de la classe), ces deux
-- frais ne doivent s'appliquer qu'aux élèves effectivement inscrits à ce
-- service. La migration 0014 les traitait par erreur comme automatiques dès
-- qu'un tarif existait pour la classe.
-- =========================================================================

alter table public.students
  add column if not exists subscribes_cantine boolean not null default false;
alter table public.students
  add column if not exists subscribes_transport boolean not null default false;

-- -------------------------------------------------------------------------
-- generate_student_schedule() : les frais à échéance unique ne couvrent plus
-- systématiquement cantine/transport — seulement pour les élèves ayant
-- l'abonnement correspondant.
-- -------------------------------------------------------------------------
create or replace function public.generate_student_schedule(p_student_id uuid, p_academic_year text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_class_id uuid;
  v_regime text;
  v_enrolled_at date;
  v_subscribes_cantine boolean;
  v_subscribes_transport boolean;
  v_year text;
  v_calendar_year int;
  v_school_start_month int;
  v_school_end_month int;
  v_mensualite_start int;
  v_mensualite_end int;
  v_month_count int;
  v_fee public.fee_structures%rowtype;
  v_mensualite public.fee_structures%rowtype;
  i int;
  v_month int;
  v_due_date date;
  v_schedule_id uuid;
begin
  select school_id, class_id, regime, enrolled_at, subscribes_cantine, subscribes_transport
    into v_school_id, v_class_id, v_regime, v_enrolled_at, v_subscribes_cantine, v_subscribes_transport
  from public.students
  where id = p_student_id;

  if v_school_id is null or v_class_id is null then
    return; -- élève introuvable ou sans classe assignée
  end if;

  if not (public.is_super_admin() or public.current_school_id() = v_school_id) then
    raise exception 'not authorized';
  end if;

  select school_year_label, coalesce(school_year_start_month, 9), coalesce(school_year_end_month, 6)
    into v_year, v_school_start_month, v_school_end_month
  from public.schools
  where id = v_school_id;

  v_year := coalesce(p_academic_year, v_year);
  if v_year is null then
    return;
  end if;

  -- Frais à échéance unique : inscription/uniforme/autre sont dus par tous
  -- les élèves de la classe dès qu'un tarif existe ; cantine/transport ne le
  -- sont que pour les élèves abonnés à ce service.
  for v_fee in
    select * from public.fee_structures
    where school_id = v_school_id and class_id = v_class_id and regime = v_regime
      and academic_year = v_year and fee_type <> 'mensualite' and month = 0
      and (fee_type <> 'cantine' or v_subscribes_cantine)
      and (fee_type <> 'transport' or v_subscribes_transport)
  loop
    insert into public.payment_schedules (school_id, student_id, fee_structure_id, due_date, amount_due)
    values (v_school_id, p_student_id, v_fee.id, coalesce(v_enrolled_at, current_date), v_fee.amount)
    on conflict (student_id, fee_structure_id, due_date) do nothing;

    select id into v_schedule_id
    from public.payment_schedules
    where student_id = p_student_id and fee_structure_id = v_fee.id
      and due_date = coalesce(v_enrolled_at, current_date);

    if v_schedule_id is not null then
      perform public.recalc_schedule_discount(v_schedule_id);
    end if;
  end loop;

  begin
    v_calendar_year := split_part(v_year, '-', 1)::int;
  exception when others then
    v_calendar_year := extract(year from current_date)::int;
  end;

  v_mensualite_start := (v_school_start_month % 12) + 1;
  v_mensualite_end := (v_school_end_month % 12) + 1;
  v_month_count := ((v_mensualite_end - v_mensualite_start + 12) % 12) + 1;

  for i in 0..(v_month_count - 1) loop
    v_month := ((v_mensualite_start - 1 + i) % 12) + 1;
    if v_month >= v_school_start_month then
      v_due_date := make_date(v_calendar_year, v_month, 5);
    else
      v_due_date := make_date(v_calendar_year + 1, v_month, 5);
    end if;

    select * into v_mensualite
    from public.fee_structures
    where school_id = v_school_id and class_id = v_class_id and regime = v_regime
      and academic_year = v_year and fee_type = 'mensualite' and month = v_month
    limit 1;

    if found then
      insert into public.payment_schedules (school_id, student_id, fee_structure_id, due_date, amount_due)
      values (v_school_id, p_student_id, v_mensualite.id, v_due_date, v_mensualite.amount)
      on conflict (student_id, fee_structure_id, due_date) do nothing;

      select id into v_schedule_id
      from public.payment_schedules
      where student_id = p_student_id and fee_structure_id = v_mensualite.id and due_date = v_due_date;

      if v_schedule_id is not null then
        perform public.recalc_schedule_discount(v_schedule_id);
      end if;
    end if;
  end loop;
end;
$$;

-- -------------------------------------------------------------------------
-- Nettoyage : supprime les échéances cantine/transport générées à tort par
-- la migration 0014 (avant l'introduction de l'abonnement optionnel), pour
-- les élèves qui n'ont encore rien payé dessus. Celles avec un paiement déjà
-- imputé sont laissées intactes pour ne pas casser d'historique — vérifiez-
-- les manuellement si besoin (requête ci-dessous en commentaire).
-- -------------------------------------------------------------------------
delete from public.payment_schedules ps
using public.fee_structures fs
where ps.fee_structure_id = fs.id
  and fs.fee_type in ('cantine', 'transport')
  and ps.amount_paid = 0;

-- Pour repérer les échéances cantine/transport qui ont déjà un paiement
-- (non supprimées ci-dessus, à traiter au cas par cas) :
-- select ps.* from public.payment_schedules ps
-- join public.fee_structures fs on fs.id = ps.fee_structure_id
-- where fs.fee_type in ('cantine', 'transport') and ps.amount_paid > 0;
