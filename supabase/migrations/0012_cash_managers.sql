-- =========================================================================
-- Certaines écoles ont un seul comptable qui saisit tout, mais l'argent est
-- réparti entre plusieurs responsables (ex. Directeur, Adjoint). Ce module
-- ajoute une liste de "responsables" configurable par école, rattachable à
-- chaque paiement/dépense (facultatif) pour suivre qui a quoi en main.
-- =========================================================================

create table public.cash_managers (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools (id) on delete cascade,
  name        text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (school_id, name)
);

create index idx_cash_managers_school_id on public.cash_managers (school_id);

create trigger set_updated_at before update on public.cash_managers
  for each row execute function public.set_updated_at();

alter table public.cash_managers enable row level security;

create policy "cash_managers_select" on public.cash_managers
  for select using (school_id = public.current_school_id());
create policy "cash_managers_insert" on public.cash_managers
  for insert with check (school_id = public.current_school_id() and public.has_role(array['owner']));
create policy "cash_managers_update" on public.cash_managers
  for update
  using (school_id = public.current_school_id() and public.has_role(array['owner']))
  with check (school_id = public.current_school_id() and public.has_role(array['owner']));
create policy "cash_managers_delete" on public.cash_managers
  for delete using (school_id = public.current_school_id() and public.has_role(array['owner']));

alter table public.payments
  add column if not exists cash_manager_id uuid references public.cash_managers (id) on delete set null;
alter table public.expenses
  add column if not exists cash_manager_id uuid references public.cash_managers (id) on delete set null;

create index idx_payments_cash_manager_id on public.payments (cash_manager_id);
create index idx_expenses_cash_manager_id on public.expenses (cash_manager_id);
