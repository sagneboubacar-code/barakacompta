-- =========================================================================
-- Module "Paiements" : modes de paiement locaux (Wave, Orange Money...) et
-- allocation automatique d'un paiement sur plusieurs échéances, en cascade
-- chronologique à partir du "mois concerné".
-- =========================================================================

alter table public.payments drop constraint if exists payments_payment_method_check;
alter table public.payments
  add constraint payments_payment_method_check
  check (payment_method in ('cash', 'wave', 'orange_money', 'bank_transfer'));
alter table public.payments alter column payment_method set default 'cash';

-- -------------------------------------------------------------------------
-- Répartition d'un paiement sur une ou plusieurs échéances. Table gérée
-- exclusivement par les fonctions SECURITY DEFINER ci-dessous : aucune
-- policy insert/update/delete pour authenticated/anon, seule la lecture
-- (scoping école) est ouverte, pour afficher le détail sur le reçu.
-- -------------------------------------------------------------------------
create table public.payment_allocations (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null references public.schools (id) on delete cascade,
  payment_id           uuid not null references public.payments (id) on delete cascade,
  payment_schedule_id  uuid not null references public.payment_schedules (id) on delete cascade,
  amount               numeric(12, 2) not null check (amount > 0),
  created_at           timestamptz not null default now()
);

create index idx_payment_allocations_payment_id on public.payment_allocations (payment_id);
create index idx_payment_allocations_schedule_id on public.payment_allocations (payment_schedule_id);

alter table public.payment_allocations enable row level security;

create policy "payment_allocations_select" on public.payment_allocations
  for select
  using (school_id = public.current_school_id());

-- -------------------------------------------------------------------------
-- recalc_payment_schedule() : désormais basée sur payment_allocations (la
-- source de vérité de ce qui a été effectivement affecté à cette échéance),
-- et non plus sur payments.payment_schedule_id qui ne représente que le
-- "mois concerné" saisi au départ, pas la répartition réelle après cascade.
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
  from public.payment_allocations
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

-- L'ancien trigger réagissait directement aux paiements ; il est remplacé
-- par un trigger sur payment_allocations (voir plus bas).
drop trigger if exists trg_payments_recalc_schedule on public.payments;
drop function if exists public.trg_payments_recalc_schedule();

create or replace function public.trg_payment_allocations_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalc_payment_schedule(old.payment_schedule_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.payment_schedule_id is distinct from new.payment_schedule_id then
    perform public.recalc_payment_schedule(old.payment_schedule_id);
  end if;

  perform public.recalc_payment_schedule(new.payment_schedule_id);
  return new;
end;
$$;

drop trigger if exists trg_payment_allocations_recalc on public.payment_allocations;
create trigger trg_payment_allocations_recalc
  after insert or update of amount, payment_schedule_id or delete on public.payment_allocations
  for each row execute function public.trg_payment_allocations_recalc();

-- -------------------------------------------------------------------------
-- allocate_payment() : répartit payments.amount sur les échéances de
-- l'élève non soldées (pending/partial/overdue), en commençant par le
-- "mois concerné" (payments.payment_schedule_id) puis en cascade sur les
-- échéances suivantes par ordre chronologique, jusqu'à épuisement du
-- montant. Un solde non affecté (avance au-delà des échéances existantes)
-- reste simplement non alloué : il ne casse rien, mais n'est pas non plus
-- suivi comme "crédit" — ce module ne tient pas de solde créditeur.
-- -------------------------------------------------------------------------
create or replace function public.allocate_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_start_due_date date;
  v_remaining numeric(12, 2);
  v_schedule record;
  v_alloc numeric(12, 2);
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment.id is null then
    return;
  end if;

  v_remaining := v_payment.amount;

  if v_payment.payment_schedule_id is not null then
    select due_date into v_start_due_date
    from public.payment_schedules
    where id = v_payment.payment_schedule_id;
  end if;

  for v_schedule in
    select id, amount_remaining
    from public.payment_schedules
    where student_id = v_payment.student_id
      and status in ('pending', 'partial', 'overdue')
      and amount_remaining > 0
      and (v_start_due_date is null or due_date >= v_start_due_date)
    order by due_date asc
  loop
    exit when v_remaining <= 0;
    v_alloc := least(v_remaining, v_schedule.amount_remaining);

    insert into public.payment_allocations (school_id, payment_id, payment_schedule_id, amount)
    values (v_payment.school_id, p_payment_id, v_schedule.id, v_alloc);

    v_remaining := v_remaining - v_alloc;
  end loop;
end;
$$;

create or replace function public.trg_payments_allocate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.allocate_payment(new.id);
  return new;
end;
$$;

drop trigger if exists trg_after_payment_insert_allocate on public.payments;
create trigger trg_after_payment_insert_allocate
  after insert on public.payments
  for each row execute function public.trg_payments_allocate();

-- Si le montant, le mois concerné ou l'élève d'un paiement est corrigé après
-- coup, on efface ses répartitions existantes et on réalloue proprement
-- (le DELETE déclenche déjà trg_payment_allocations_recalc pour désaffecter
-- les anciennes échéances).
create or replace function public.trg_payments_reallocate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.payment_allocations where payment_id = new.id;
  perform public.allocate_payment(new.id);
  return new;
end;
$$;

drop trigger if exists trg_after_payment_update_reallocate on public.payments;
create trigger trg_after_payment_update_reallocate
  after update of amount, payment_schedule_id, student_id on public.payments
  for each row execute function public.trg_payments_reallocate();
