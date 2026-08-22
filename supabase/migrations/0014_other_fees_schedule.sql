-- =========================================================================
-- generate_student_schedule() ne générait des échéances (payment_schedules)
-- que pour les fee_type 'inscription' et 'mensualite'. Les tarifs 'uniforme',
-- 'cantine', 'internat', 'transport' et 'autre' — bien que configurables
-- dans fee_structures via la page "Gestion des tarifs" — n'apparaissaient
-- donc jamais côté Paiements, faute d'échéance générée.
--
-- Cette migration généralise la boucle "frais à échéance unique" (déjà
-- utilisée pour l'inscription) à tous les fee_type != 'mensualite' : chacun
-- produit une échéance unique due à la date d'inscription de l'élève.
-- =========================================================================

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
  select school_id, class_id, regime, enrolled_at
    into v_school_id, v_class_id, v_regime, v_enrolled_at
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

  -- Frais à échéance unique (inscription, uniforme, cantine, internat,
  -- transport, autre) : une échéance par tarif, due à la date d'inscription.
  for v_fee in
    select * from public.fee_structures
    where school_id = v_school_id and class_id = v_class_id and regime = v_regime
      and academic_year = v_year and fee_type <> 'mensualite' and month = 0
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

  -- Mensualités = du mois suivant le début d'année scolaire au mois suivant
  -- sa fin (inchangé depuis 0013_dynamic_mensualite_months.sql).
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
-- Backfill : régénère l'échéancier de tous les élèves existants pour que les
-- tarifs uniforme/cantine/internat/transport/autre déjà configurés (mais
-- jusqu'ici ignorés) produisent leurs échéances manquantes. Idempotent
-- (ON CONFLICT DO NOTHING) : ne touche pas aux échéances déjà présentes.
-- -------------------------------------------------------------------------
do $$
declare
  v_student_id uuid;
begin
  for v_student_id in select id from public.students loop
    perform public.generate_student_schedule(v_student_id, null);
  end loop;
end;
$$;
