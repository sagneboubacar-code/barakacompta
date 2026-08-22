-- =========================================================================
-- Transferts entre responsables (caisse) : un responsable peut remettre du
-- cash à un autre (ex. Responsable 1 → Responsable 2). Ce n'est ni une
-- recette (pas d'élève) ni une dépense (l'argent reste dans l'école) : un
-- transfert diminue le solde de l'émetteur et augmente celui du
-- destinataire, sans toucher aux totaux Recettes/Dépenses/Solde de l'école.
-- =========================================================================

create table public.cash_manager_transfers (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools (id) on delete cascade,
  from_manager_id  uuid not null references public.cash_managers (id) on delete restrict,
  to_manager_id    uuid not null references public.cash_managers (id) on delete restrict,
  amount           numeric(12, 2) not null check (amount > 0),
  transferred_at   date not null default current_date,
  notes            text,
  created_by       uuid references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (from_manager_id <> to_manager_id)
);

create index idx_cash_manager_transfers_school_id on public.cash_manager_transfers (school_id);

create trigger set_updated_at before update on public.cash_manager_transfers
  for each row execute function public.set_updated_at();

alter table public.cash_manager_transfers enable row level security;

create policy "cash_manager_transfers_select" on public.cash_manager_transfers
  for select using (school_id = public.current_school_id());
create policy "cash_manager_transfers_insert" on public.cash_manager_transfers
  for insert with check (school_id = public.current_school_id());
create policy "cash_manager_transfers_update" on public.cash_manager_transfers
  for update
  using (school_id = public.current_school_id())
  with check (school_id = public.current_school_id());
create policy "cash_manager_transfers_delete" on public.cash_manager_transfers
  for delete using (school_id = public.current_school_id() and public.has_role(array['owner', 'admin']));
