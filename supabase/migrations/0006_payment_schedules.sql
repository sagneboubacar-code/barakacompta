-- =========================================================================
-- Échéancier automatique : génération à l'inscription (ou au démarrage
-- d'une nouvelle année scolaire) + recalcul du payé/reste/statut à chaque
-- paiement enregistré.
-- =========================================================================

alter table public.payment_schedules
  add column if not exists amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0);

alter table public.payment_schedules
  add column if not exists amount_remaining numeric(12, 2)
    generated always as (amount_due - amount_paid) stored;

-- Une échéance générée automatiquement est identifiée par (élève, tarif,
-- date d'échéance) : rejouer la génération pour la même année ne duplique
-- rien (ON CONFLICT DO NOTHING dans generate_student_schedule).
alter table public.payment_schedules drop constraint if exists payment_schedules_unique_line;
alter table public.payment_schedules
  add constraint payment_schedules_unique_line unique (student_id, fee_structure_id, due_date);

-- -------------------------------------------------------------------------
-- Recalcul du payé/statut d'une échéance à partir de la somme des paiements
-- qui lui sont liés.
-- -------------------------------------------------------------------------
create or replace function public.recalc_payment_schedule(p_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due numeric(12, 2);
  v_due_date date;
  v_paid numeric(12, 2);
  v_status text;
begin
  select amount_due, due_date into v_due, v_due_date
  from public.payment_schedules
  where id = p_schedule_id;

  if v_due is null then
    return; -- échéance supprimée entre-temps
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments
  where payment_schedule_id = p_schedule_id;

  if v_due > 0 and v_paid >= v_due then
    v_status := 'paid';
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

create or replace function public.trg_payments_recalc_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.payment_schedule_id is not null then
      perform public.recalc_payment_schedule(old.payment_schedule_id);
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.payment_schedule_id is not null
     and old.payment_schedule_id is distinct from new.payment_schedule_id then
    perform public.recalc_payment_schedule(old.payment_schedule_id);
  end if;

  if new.payment_schedule_id is not null then
    perform public.recalc_payment_schedule(new.payment_schedule_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payments_recalc_schedule on public.payments;
create trigger trg_payments_recalc_schedule
  after insert or update of amount, payment_schedule_id or delete on public.payments
  for each row execute function public.trg_payments_recalc_schedule();

-- -------------------------------------------------------------------------
-- Génération de l'échéancier d'un élève : frais d'inscription (échéance
-- unique, due à l'inscription) + une mensualité par mois d'octobre à
-- juillet (10 échéances), montants tirés des fee_structures de la classe
-- et du régime de l'élève pour l'année scolaire donnée (par défaut :
-- l'année active de l'école). Idempotent : rejouable sans créer de doublons.
--
-- SECURITY DEFINER + vérification interne du school_id : la fonction est
-- accessible en RPC par un utilisateur authenticated (pour le déclenchement
-- manuel "nouvelle année scolaire"), donc elle doit elle-même s'assurer que
-- l'appelant appartient bien à l'école de l'élève ciblé.
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
    end loop;
  end if;
end;
$$;

revoke all on function public.generate_student_schedule(uuid, text) from public;
grant execute on function public.generate_student_schedule(uuid, text) to authenticated;
grant execute on function public.generate_student_schedule(uuid, text) to service_role;

create or replace function public.trg_students_generate_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.generate_student_schedule(new.id, null);
  return new;
end;
$$;

drop trigger if exists trg_after_student_insert_schedule on public.students;
create trigger trg_after_student_insert_schedule
  after insert on public.students
  for each row execute function public.trg_students_generate_schedule();
