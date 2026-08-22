-- =========================================================================
-- Tarifs sous forme de tableau par classe : Inscription, Uniforme, et une
-- mensualité DISTINCTE par mois (octobre à juillet) — les mensualités ne
-- sont plus un montant unique reconduit sur 10 mois.
-- =========================================================================

alter table public.fee_structures drop constraint if exists fee_structures_fee_type_check;
alter table public.fee_structures
  add constraint fee_structures_fee_type_check
  check (fee_type in (
    'inscription', 'uniforme', 'mensualite', 'cantine', 'internat', 'transport', 'autre'
  ));

-- month = 0 pour les frais non mensuels (inscription/uniforme/...), sinon le
-- mois calendaire (10,11,12,1..7) pour une ligne "mensualite". NOT NULL avec
-- une vraie valeur par défaut (plutôt que NULL) pour que la contrainte
-- unique ci-dessous fonctionne correctement : deux NULL ne sont jamais égaux
-- en SQL, ce qui aurait permis des doublons d'inscription/uniforme.
alter table public.fee_structures
  add column if not exists month smallint not null default 0 check (month between 0 and 12);

alter table public.fee_structures drop constraint if exists fee_structures_unique_tariff;
alter table public.fee_structures
  add constraint fee_structures_unique_tariff
  unique (school_id, class_id, regime, fee_type, academic_year, month);

-- -------------------------------------------------------------------------
-- generate_student_schedule() : va chercher le tarif "mensualite" propre à
-- CHAQUE mois (month = mois calendaire de l'échéance) au lieu de réutiliser
-- un montant unique sur les 10 échéances. Un mois sans tarif configuré est
-- simplement ignoré (pas d'échéance générée pour ce mois-là).
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
  v_year text;
  v_calendar_year int;
  v_inscription public.fee_structures%rowtype;
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

  v_year := coalesce(p_academic_year, (select school_year_label from public.schools where id = v_school_id));
  if v_year is null then
    return;
  end if;

  select * into v_inscription
  from public.fee_structures
  where school_id = v_school_id and class_id = v_class_id and regime = v_regime
    and academic_year = v_year and fee_type = 'inscription' and month = 0
  limit 1;

  if found then
    insert into public.payment_schedules (school_id, student_id, fee_structure_id, due_date, amount_due)
    values (v_school_id, p_student_id, v_inscription.id, coalesce(v_enrolled_at, current_date), v_inscription.amount)
    on conflict (student_id, fee_structure_id, due_date) do nothing;

    select id into v_schedule_id
    from public.payment_schedules
    where student_id = p_student_id and fee_structure_id = v_inscription.id
      and due_date = coalesce(v_enrolled_at, current_date);

    if v_schedule_id is not null then
      perform public.recalc_schedule_discount(v_schedule_id);
    end if;
  end if;

  begin
    v_calendar_year := split_part(v_year, '-', 1)::int;
  exception when others then
    v_calendar_year := extract(year from current_date)::int;
  end;

  for i in 0..9 loop
    v_month := ((9 + i) % 12) + 1; -- 10,11,12,1,2,3,4,5,6,7
    if v_month >= 10 then
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
