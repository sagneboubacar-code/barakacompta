-- =========================================================================
-- Paiement par famille, avec un seul recu.
--
-- A la fin du mois (ou a la rentree), une famille vient regler pour tous ses
-- enfants a la fois. L'ecole choisit la famille et le mois, coche les lignes
-- a regler, et encaisse en une fois :
--   * chaque ligne reste un paiement normal de l'eleve concerne (historique,
--     soldes, recouvrement et rapports continuent de fonctionner tels quels) ;
--   * ces paiements sont regroupes dans un "paiement famille", qui porte le
--     recu unique remis au parent.
-- Tout se fait dans une seule transaction (record_family_payment) : soit
-- toute la famille est encaissee, soit rien ne l'est.
-- =========================================================================

create table public.family_payments (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools (id) on delete cascade,
  -- La famille peut etre supprimee plus tard : le recu garde son nom.
  family_id        uuid references public.families (id) on delete set null,
  family_name      text not null,
  total            numeric(12, 2) not null default 0,
  payment_method   text not null check (payment_method in ('cash', 'wave', 'orange_money', 'bank_transfer')),
  paid_at          timestamptz not null default now(),
  reference        text,
  notes            text,
  received_by      uuid references public.users (id) on delete set null,
  cash_manager_id  uuid references public.cash_managers (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index idx_family_payments_school_id on public.family_payments (school_id);
create index idx_family_payments_family_id on public.family_payments (family_id);

alter table public.family_payments enable row level security;

-- Lecture seule pour l'app : la creation passe par record_family_payment().
create policy "family_payments_select" on public.family_payments
  for select using (school_id = public.current_school_id());

alter table public.payments
  add column if not exists family_payment_id uuid references public.family_payments (id) on delete set null;

create index if not exists idx_payments_family_payment_id on public.payments (family_payment_id);

-- -------------------------------------------------------------------------
-- allocate_payment() : reprise de 0007, avec une seule difference -- le
-- "mois concerne" choisi passe EN PREMIER. Avant, quand plusieurs echeances
-- tombaient le meme jour (inscription et transport, tous deux dus a la date
-- d'inscription), l'argent pouvait partir sur l'autre. Un recu famille doit
-- dire exactement ce qui a ete regle.
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
    order by (id = v_payment.payment_schedule_id) desc, due_date asc
  loop
    exit when v_remaining <= 0;
    v_alloc := least(v_remaining, v_schedule.amount_remaining);

    insert into public.payment_allocations (school_id, payment_id, payment_schedule_id, amount)
    values (v_payment.school_id, p_payment_id, v_schedule.id, v_alloc);

    v_remaining := v_remaining - v_alloc;
  end loop;
end;
$$;

revoke all on function public.allocate_payment(uuid) from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- record_family_payment() : encaisse les echeances cochees pour la famille.
-- Les montants sont relus en base (jamais pris du navigateur) : chaque
-- echeance est soldee de son reste a payer actuel.
-- -------------------------------------------------------------------------
create or replace function public.record_family_payment(
  p_family_id uuid,
  p_schedule_ids uuid[],
  p_paid_at timestamptz,
  p_payment_method text,
  p_reference text default null,
  p_notes text default null,
  p_cash_manager_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family public.families%rowtype;
  v_family_payment_id uuid;
  v_total numeric(12, 2) := 0;
  v_schedule record;
begin
  select * into v_family from public.families where id = p_family_id;

  if not found or not (
    public.is_super_admin()
    or (v_family.school_id = public.current_school_id()
        and public.has_role(array['owner', 'admin', 'accountant']))
  ) then
    raise exception 'not authorized';
  end if;

  if p_payment_method is null or p_payment_method not in ('cash', 'wave', 'orange_money', 'bank_transfer') then
    raise exception 'mode de paiement invalide';
  end if;

  if p_cash_manager_id is not null and not exists (
    select 1 from public.cash_managers where id = p_cash_manager_id and school_id = v_family.school_id
  ) then
    raise exception 'responsable introuvable';
  end if;

  insert into public.family_payments (
    school_id, family_id, family_name, payment_method, paid_at, reference, notes, received_by, cash_manager_id
  )
  values (
    v_family.school_id, v_family.id, v_family.name, p_payment_method, coalesce(p_paid_at, now()),
    nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), auth.uid(), p_cash_manager_id
  )
  returning id into v_family_payment_id;

  -- Seules les echeances encore dues des enfants de CETTE famille comptent :
  -- un identifiant etranger ou deja solde est simplement ignore.
  for v_schedule in
    select ps.id, ps.student_id, ps.amount_remaining
    from public.payment_schedules ps
    join public.students s on s.id = ps.student_id
    where ps.id = any(p_schedule_ids)
      and s.family_id = v_family.id
      and ps.status in ('pending', 'partial', 'overdue')
      and ps.amount_remaining > 0
    order by s.last_name, s.first_name, ps.due_date
  loop
    insert into public.payments (
      school_id, student_id, payment_schedule_id, amount, payment_method, reference, paid_at,
      received_by, cash_manager_id, notes, family_payment_id
    )
    values (
      v_family.school_id, v_schedule.student_id, v_schedule.id, v_schedule.amount_remaining, p_payment_method,
      nullif(trim(p_reference), ''), coalesce(p_paid_at, now()), auth.uid(), p_cash_manager_id,
      nullif(trim(p_notes), ''), v_family_payment_id
    );
    v_total := v_total + v_schedule.amount_remaining;
  end loop;

  if v_total <= 0 then
    raise exception 'rien à encaisser : ces échéances sont déjà réglées';
  end if;

  update public.family_payments set total = v_total where id = v_family_payment_id;

  return v_family_payment_id;
end;
$$;

revoke all on function public.record_family_payment(uuid, uuid[], timestamptz, text, text, text, uuid) from public, anon;
grant execute on function public.record_family_payment(uuid, uuid[], timestamptz, text, text, text, uuid) to authenticated;
