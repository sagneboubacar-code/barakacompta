-- =========================================================================
-- Module "Réductions" : réduction individuelle par élève (montant fixe ou
-- pourcentage), bornée par une période de validité, appliquée automatiquement
-- au calcul des échéances concernées.
-- =========================================================================

-- ---- discounts -----------------------------------------------------------
-- Remplace le couple (fee_structure_id, academic_year) — trop imprécis pour
-- ce module — par une période explicite (starts_on/ends_on) : la réduction
-- s'applique à toute échéance dont la date d'échéance tombe dans cette
-- période, quel que soit le type de frais.
alter table public.discounts
  add column if not exists starts_on date,
  add column if not exists ends_on date;

update public.discounts
set starts_on = coalesce(starts_on, current_date),
    ends_on = coalesce(ends_on, current_date)
where starts_on is null or ends_on is null;

alter table public.discounts alter column starts_on set not null;
alter table public.discounts alter column ends_on set not null;

alter table public.discounts drop constraint if exists discounts_period_check;
alter table public.discounts add constraint discounts_period_check check (ends_on >= starts_on);

-- Le FK student_id (déjà ON DELETE CASCADE depuis 0001_init.sql) n'a pas
-- besoin d'être touché : on resserre juste la nullabilité.
alter table public.discounts alter column student_id set not null;

alter table public.discounts drop column if exists fee_structure_id;
alter table public.discounts drop column if exists academic_year;

-- ---- payment_schedules -----------------------------------------------------
-- La colonne generated amount_remaining doit être recréée pour intégrer la
-- réduction (Postgres n'autorise pas de modifier l'expression en place).
alter table public.payment_schedules
  add column if not exists discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0);

alter table public.payment_schedules drop column if exists amount_remaining;
alter table public.payment_schedules
  add column amount_remaining numeric(12, 2)
    generated always as (amount_due - discount_amount - amount_paid) stored;

-- -------------------------------------------------------------------------
-- recalc_schedule_discount() : somme les réductions actives de l'élève dont
-- la période couvre la date d'échéance. Les montants fixes s'additionnent ;
-- les pourcentages s'additionnent puis s'appliquent au montant dû. Le total
-- est plafonné au montant dû (une échéance ne peut pas devenir négative).
-- -------------------------------------------------------------------------
create or replace function public.recalc_schedule_discount(p_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_due_date date;
  v_amount_due numeric(12, 2);
  v_fixed_total numeric(12, 2);
  v_percent_total numeric(12, 2);
  v_discount numeric(12, 2);
begin
  select student_id, due_date, amount_due into v_student_id, v_due_date, v_amount_due
  from public.payment_schedules
  where id = p_schedule_id;

  if v_student_id is null then
    return; -- échéance supprimée entre-temps
  end if;

  select coalesce(sum(value), 0) into v_fixed_total
  from public.discounts
  where student_id = v_student_id
    and discount_type = 'fixed_amount'
    and starts_on <= v_due_date and ends_on >= v_due_date;

  select coalesce(sum(value), 0) into v_percent_total
  from public.discounts
  where student_id = v_student_id
    and discount_type = 'percentage'
    and starts_on <= v_due_date and ends_on >= v_due_date;

  v_discount := least(v_amount_due, v_fixed_total + (v_amount_due * v_percent_total / 100));

  update public.payment_schedules
  set discount_amount = v_discount
  where id = p_schedule_id;

  -- Le statut (payé/partiel/en attente) dépend du montant net après réduction.
  perform public.recalc_payment_schedule(p_schedule_id);
end;
$$;

-- recalc_payment_schedule() : compare désormais le payé au montant NET
-- (montant dû − réduction), pas au montant brut.
create or replace function public.recalc_payment_schedule(p_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due numeric(12, 2);
  v_discount numeric(12, 2);
  v_due_date date;
  v_paid numeric(12, 2);
  v_effective_due numeric(12, 2);
  v_status text;
begin
  select amount_due, discount_amount, due_date into v_due, v_discount, v_due_date
  from public.payment_schedules
  where id = p_schedule_id;

  if v_due is null then
    return; -- échéance supprimée entre-temps
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.payment_allocations
  where payment_schedule_id = p_schedule_id;

  v_effective_due := greatest(v_due - coalesce(v_discount, 0), 0);

  if v_paid >= v_effective_due then
    v_status := 'paid'; -- couvre aussi le cas d'une réduction à 100 %
  elsif v_paid > 0 then
    v_status := 'partial';
  elsif v_due_date < current_date then
    v_status := 'overdue';
  else
    v_status := 'pending';
  end if;

  update public.payment_schedules
  set amount_paid = v_paid, status = v_status
  where id = p_schedule_id;
end;
$$;

-- -------------------------------------------------------------------------
-- Recalcule les échéances concernées quand une réduction est créée, changée
-- ou supprimée (sur l'union des périodes avant/après pour bien "désappliquer"
-- une réduction raccourcie ou effacée).
-- -------------------------------------------------------------------------
create or replace function public.trg_discounts_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_from date;
  v_to date;
  v_schedule record;
begin
  if tg_op = 'DELETE' then
    v_student_id := old.student_id;
    v_from := old.starts_on;
    v_to := old.ends_on;
  else
    v_student_id := new.student_id;
    v_from := new.starts_on;
    v_to := new.ends_on;
    if tg_op = 'UPDATE' then
      v_from := least(v_from, old.starts_on);
      v_to := greatest(v_to, old.ends_on);
    end if;
  end if;

  for v_schedule in
    select id from public.payment_schedules
    where student_id = v_student_id and due_date >= v_from and due_date <= v_to
  loop
    perform public.recalc_schedule_discount(v_schedule.id);
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_after_discount_change on public.discounts;
create trigger trg_after_discount_change
  after insert or update of student_id, discount_type, value, starts_on, ends_on or delete on public.discounts
  for each row execute function public.trg_discounts_recalc();

-- -------------------------------------------------------------------------
-- generate_student_schedule() : applique désormais la réduction active sur
-- chaque échéance nouvellement générée (ou déjà existante, par idempotence).
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
    and academic_year = v_year and fee_type = 'inscription'
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

  select * into v_mensualite
  from public.fee_structures
  where school_id = v_school_id and class_id = v_class_id and regime = v_regime
    and academic_year = v_year and fee_type = 'mensualite'
  limit 1;

  if found then
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

      insert into public.payment_schedules (school_id, student_id, fee_structure_id, due_date, amount_due)
      values (v_school_id, p_student_id, v_mensualite.id, v_due_date, v_mensualite.amount)
      on conflict (student_id, fee_structure_id, due_date) do nothing;

      select id into v_schedule_id
      from public.payment_schedules
      where student_id = p_student_id and fee_structure_id = v_mensualite.id and due_date = v_due_date;

      if v_schedule_id is not null then
        perform public.recalc_schedule_discount(v_schedule_id);
      end if;
    end loop;
  end if;
end;
$$;
