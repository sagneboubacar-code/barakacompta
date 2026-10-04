-- =========================================================================
-- A EXECUTER UNE FOIS dans l'editeur SQL de Supabase (production).
--
-- Rattrapage de deux migrations jamais appliquees en production (constate le
-- 4 octobre 2026 : les tables n'existent pas) :
--   * 0016 -- transferts entre responsables (la page Transferts ne pouvait
--             pas fonctionner, et le rapport ignorait les transferts) ;
--   * 0029 -- prospects de la page admin (agent de prospection).
-- Ecrit pour pouvoir etre relance sans risque.
--
-- La derniere requete CONTROLE que les autres migrations sont bien en place :
-- chaque ligne doit afficher « true ».
-- =========================================================================

-- ---- 0016 : transferts entre responsables -----------------------------------
create table if not exists public.cash_manager_transfers (
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

create index if not exists idx_cash_manager_transfers_school_id on public.cash_manager_transfers (school_id);

drop trigger if exists set_updated_at on public.cash_manager_transfers;
create trigger set_updated_at before update on public.cash_manager_transfers
  for each row execute function public.set_updated_at();

alter table public.cash_manager_transfers enable row level security;

drop policy if exists "cash_manager_transfers_select" on public.cash_manager_transfers;
create policy "cash_manager_transfers_select" on public.cash_manager_transfers
  for select using (school_id = public.current_school_id());
drop policy if exists "cash_manager_transfers_insert" on public.cash_manager_transfers;
create policy "cash_manager_transfers_insert" on public.cash_manager_transfers
  for insert with check (school_id = public.current_school_id());
drop policy if exists "cash_manager_transfers_update" on public.cash_manager_transfers;
create policy "cash_manager_transfers_update" on public.cash_manager_transfers
  for update
  using (school_id = public.current_school_id())
  with check (school_id = public.current_school_id());
drop policy if exists "cash_manager_transfers_delete" on public.cash_manager_transfers;
create policy "cash_manager_transfers_delete" on public.cash_manager_transfers
  for delete using (school_id = public.current_school_id() and public.has_role(array['owner', 'admin']));

-- ---- 0029 : prospects (page admin) ------------------------------------------
create table if not exists public.prospects (
  id               uuid primary key default gen_random_uuid(),
  nom              text not null,
  ville            text,
  quartier         text,
  telephone        text,
  email            text,
  email_fiable     boolean not null default false,
  type_etablissement text,
  source_url       text not null,
  score            smallint not null check (score between 1 and 5),
  pourquoi         text,
  accroche         text,
  statut           text not null default 'nouveau'
                     check (statut in ('nouveau', 'contacte', 'interesse', 'refuse', 'client')),
  notes            text,
  recherche        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists prospects_nom_ville_unique
  on public.prospects (lower(nom), lower(coalesce(ville, '')));
create index if not exists prospects_statut_idx on public.prospects (statut);

drop trigger if exists set_updated_at on public.prospects;
create trigger set_updated_at before update on public.prospects
  for each row execute function public.set_updated_at();

alter table public.prospects enable row level security;

drop policy if exists "prospects_staff_only" on public.prospects;
create policy "prospects_staff_only" on public.prospects
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- Rafraichit la liste des tables de Supabase.
notify pgrst, 'reload schema';

-- ---- Controle : chaque ligne doit afficher true -----------------------------
select element, present from (values
  ('0016 transferts entre responsables', to_regclass('public.cash_manager_transfers') is not null),
  ('0017 paiement Chariow', exists (select 1 from pg_constraint where conname = 'subscription_payments_payment_method_check' and pg_get_constraintdef(oid) like '%chariow%')),
  ('0021 fonctions internes verrouillees', not has_function_privilege('authenticated', 'public.allocate_payment(uuid)', 'execute')),
  ('0022 frais tenue de sport', exists (select 1 from pg_constraint where conname = 'fee_structures_fee_type_check' and pg_get_constraintdef(oid) like '%tenue_sport%')),
  ('0023 zones de transport', exists (select 1 from pg_constraint where conname = 'fee_structures_fee_type_check' and pg_get_constraintdef(oid) like '%transport_zone_1%')),
  ('0024 frais fournitures', exists (select 1 from pg_constraint where conname = 'fee_structures_fee_type_check' and pg_get_constraintdef(oid) like '%fournitures%')),
  ('0025 cours de renforcement', exists (select 1 from pg_constraint where conname = 'fee_structures_fee_type_check' and pg_get_constraintdef(oid) like '%renforcement%')),
  ('0028 echeancier resynchronise', exists (select 1 from pg_trigger where tgname = 'trg_after_student_update_schedule')),
  ('0029 prospects', to_regclass('public.prospects') is not null),
  ('0032 mensualites a terme echu', exists (select 1 from pg_proc where proname = 'generate_student_schedule' and prosrc like '%TERME ECHU%')),
  ('0033 depense location', exists (select 1 from pg_constraint where conname = 'expenses_category_check' and pg_get_constraintdef(oid) like '%location%')),
  ('0034 gratuite jusqu''au 10 decembre', exists (select 1 from information_schema.columns where table_name = 'schools' and column_name = 'subscription_expires_at' and column_default like '%2026-12-10%')),
  ('0035-0038 familles et paiement famille', to_regclass('public.family_payments') is not null)
) as t (element, present);
