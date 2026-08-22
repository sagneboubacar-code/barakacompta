-- =========================================================================
-- BARAKA GESTION — schéma initial multi-tenant (isolation stricte par école)
-- =========================================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------------
-- Fonction utilitaire : updated_at automatique
-- -------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- TABLES
-- =========================================================================

-- Une ligne = une école cliente = un tenant.
create table public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  country     text,
  currency    text not null default 'XOF',
  phone       text,
  address     text,
  logo_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Profil applicatif lié à auth.users. school_id = null uniquement pour super_admin (staff Baraka).
-- Rôles métier : owner (accès complet à son école), admin (gestion quotidienne),
-- accountant (paiements, dépenses, reçus uniquement). super_admin = staff plateforme, hors périmètre école.
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  school_id   uuid references public.schools (id) on delete cascade,
  full_name   text,
  email       text,
  role        text not null default 'accountant'
              check (role in ('super_admin', 'owner', 'admin', 'accountant')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint users_school_required_unless_super_admin
    check (role = 'super_admin' or school_id is not null)
);

create table public.classes (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools (id) on delete cascade,
  name           text not null,
  level          text,
  academic_year  text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (school_id, name, academic_year)
);

create table public.fee_structures (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools (id) on delete cascade,
  class_id              uuid references public.classes (id) on delete set null,
  academic_year         text not null,
  label                 text not null,
  amount                numeric(12, 2) not null check (amount >= 0),
  installments_allowed  boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.students (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools (id) on delete cascade,
  class_id        uuid references public.classes (id) on delete set null,
  matricule       text,
  first_name      text not null,
  last_name       text not null,
  date_of_birth   date,
  gender          text check (gender in ('M', 'F')),
  guardian_name   text,
  guardian_phone  text,
  guardian_email  text,
  status          text not null default 'active'
                  check (status in ('active', 'inactive', 'graduated', 'transferred')),
  enrolled_at     date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (school_id, matricule)
);

create table public.payment_schedules (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools (id) on delete cascade,
  student_id         uuid not null references public.students (id) on delete cascade,
  fee_structure_id   uuid references public.fee_structures (id) on delete set null,
  due_date           date not null,
  amount_due         numeric(12, 2) not null check (amount_due >= 0),
  status             text not null default 'pending'
                     check (status in ('pending', 'partial', 'paid', 'overdue', 'cancelled')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools (id) on delete cascade,
  student_id            uuid not null references public.students (id) on delete cascade,
  payment_schedule_id   uuid references public.payment_schedules (id) on delete set null,
  amount                numeric(12, 2) not null check (amount > 0),
  payment_method        text not null default 'cash'
                        check (payment_method in ('cash', 'mobile_money', 'bank_transfer', 'check', 'card')),
  reference             text,
  paid_at               timestamptz not null default now(),
  received_by           uuid references public.users (id) on delete set null,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.discounts (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools (id) on delete cascade,
  student_id         uuid references public.students (id) on delete cascade,
  fee_structure_id   uuid references public.fee_structures (id) on delete set null,
  label              text not null,
  discount_type      text not null check (discount_type in ('percentage', 'fixed_amount')),
  value              numeric(12, 2) not null check (value >= 0),
  academic_year      text,
  approved_by        uuid references public.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.expenses (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools (id) on delete cascade,
  category       text,
  label          text not null,
  amount         numeric(12, 2) not null check (amount > 0),
  expense_date   date not null default current_date,
  paid_by        uuid references public.users (id) on delete set null,
  receipt_url    text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- =========================================================================
-- INDEX
-- =========================================================================

create index idx_users_school_id on public.users (school_id);
create index idx_classes_school_id on public.classes (school_id);
create index idx_fee_structures_school_id on public.fee_structures (school_id);
create index idx_fee_structures_class_id on public.fee_structures (class_id);
create index idx_students_school_id on public.students (school_id);
create index idx_students_class_id on public.students (class_id);
create index idx_payment_schedules_school_id on public.payment_schedules (school_id);
create index idx_payment_schedules_student_id on public.payment_schedules (student_id);
create index idx_payments_school_id on public.payments (school_id);
create index idx_payments_student_id on public.payments (student_id);
create index idx_payments_schedule_id on public.payments (payment_schedule_id);
create index idx_discounts_school_id on public.discounts (school_id);
create index idx_discounts_student_id on public.discounts (student_id);
create index idx_expenses_school_id on public.expenses (school_id);

-- =========================================================================
-- TRIGGERS updated_at
-- =========================================================================

create trigger set_updated_at before update on public.schools
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.classes
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.fee_structures
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.students
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.payment_schedules
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.discounts
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

-- =========================================================================
-- FONCTIONS D'AUTORISATION (SECURITY DEFINER)
--
-- SECURITY DEFINER : ces fonctions s'exécutent avec les privilèges du
-- propriétaire (postgres), donc elles CONTOURNENT la RLS de `users` lors
-- de leur propre lecture interne. Sans ça, une policy sur `users` qui
-- interroge `users` provoquerait une récursion infinie. Le résultat retourné
-- (school_id / role) est ensuite comparé normalement dans les policies
-- appelantes, où la RLS s'applique comme d'habitude.
-- =========================================================================

create or replace function public.current_school_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select school_id from public.users where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'super_admin', false);
$$;

-- Vrai si le rôle courant fait partie de la liste fournie. Simplifie les policies.
create or replace function public.has_role(roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = any(roles), false);
$$;

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================

alter table public.schools           enable row level security;
alter table public.users             enable row level security;
alter table public.classes           enable row level security;
alter table public.fee_structures    enable row level security;
alter table public.students          enable row level security;
alter table public.payment_schedules enable row level security;
alter table public.payments          enable row level security;
alter table public.discounts         enable row level security;
alter table public.expenses          enable row level security;

-- ---- schools -------------------------------------------------------------
-- Un utilisateur ne voit que sa propre école. Le super_admin voit tout.
create policy "schools_select" on public.schools
  for select
  using (id = public.current_school_id() or public.is_super_admin());

-- Seul le owner peut modifier les paramètres de son école.
create policy "schools_update_own" on public.schools
  for update
  using (id = public.current_school_id() and public.current_user_role() = 'owner')
  with check (id = public.current_school_id() and public.current_user_role() = 'owner');

-- La création d'école (signup) passe par la fonction create_school_with_owner()
-- exécutée via la service_role côté serveur : aucun insert direct par
-- authenticated/anon n'est autorisé sur schools.

-- ---- users -----------------------------------------------------------------
-- Un utilisateur voit les comptes de sa propre école (ou lui-même).
create policy "users_select_same_school" on public.users
  for select
  using (
    id = auth.uid()
    or school_id = public.current_school_id()
    or public.is_super_admin()
  );

create policy "users_update_own_profile" on public.users
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Le owner gère les comptes (admin/accountant) de sa propre école : création,
-- changement de rôle, suppression. Un owner ne peut pas se retirer ce rôle
-- via cette policy puisque users_update_own_profile la précède déjà pour lui-même,
-- mais les deux policies permissives se combinent en OR : on l'accepte ici
-- puisque le formulaire applicatif n'expose jamais "owner" comme rôle assignable.
create policy "users_owner_manage_school_users" on public.users
  for all
  using (school_id = public.current_school_id() and public.current_user_role() = 'owner')
  with check (school_id = public.current_school_id() and public.current_user_role() = 'owner');

-- ---- classes / fee_structures / students / discounts ----------------------
-- Lecture ouverte aux 3 rôles de l'école (un accountant doit pouvoir choisir
-- un élève pour enregistrer un paiement). Écriture réservée à owner + admin :
-- un accountant ne gère ni les classes, ni les élèves, ni la grille tarifaire,
-- ni les remises — conformément à son périmètre "paiements, dépenses, reçus".

create policy "classes_select" on public.classes
  for select using (school_id = public.current_school_id());
create policy "classes_insert" on public.classes
  for insert with check (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
create policy "classes_update" on public.classes
  for update
  using (school_id = public.current_school_id() and public.has_role(array['owner','admin']))
  with check (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
create policy "classes_delete" on public.classes
  for delete using (school_id = public.current_school_id() and public.has_role(array['owner','admin']));

create policy "fee_structures_select" on public.fee_structures
  for select using (school_id = public.current_school_id());
create policy "fee_structures_insert" on public.fee_structures
  for insert with check (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
create policy "fee_structures_update" on public.fee_structures
  for update
  using (school_id = public.current_school_id() and public.has_role(array['owner','admin']))
  with check (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
create policy "fee_structures_delete" on public.fee_structures
  for delete using (school_id = public.current_school_id() and public.has_role(array['owner','admin']));

create policy "students_select" on public.students
  for select using (school_id = public.current_school_id());
create policy "students_insert" on public.students
  for insert with check (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
create policy "students_update" on public.students
  for update
  using (school_id = public.current_school_id() and public.has_role(array['owner','admin']))
  with check (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
create policy "students_delete" on public.students
  for delete using (school_id = public.current_school_id() and public.has_role(array['owner','admin']));

create policy "discounts_select" on public.discounts
  for select using (school_id = public.current_school_id());
create policy "discounts_insert" on public.discounts
  for insert with check (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
create policy "discounts_update" on public.discounts
  for update
  using (school_id = public.current_school_id() and public.has_role(array['owner','admin']))
  with check (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
create policy "discounts_delete" on public.discounts
  for delete using (school_id = public.current_school_id() and public.has_role(array['owner','admin']));

-- ---- payment_schedules ------------------------------------------------------
-- Échéancier : lecture pour les 3 rôles, gestion réservée à owner + admin.

create policy "payment_schedules_select" on public.payment_schedules
  for select using (school_id = public.current_school_id());
create policy "payment_schedules_insert" on public.payment_schedules
  for insert with check (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
create policy "payment_schedules_update" on public.payment_schedules
  for update
  using (school_id = public.current_school_id() and public.has_role(array['owner','admin']))
  with check (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
create policy "payment_schedules_delete" on public.payment_schedules
  for delete using (school_id = public.current_school_id() and public.has_role(array['owner','admin']));

-- ---- payments / expenses ----------------------------------------------------
-- Cœur du périmètre accountant : select/insert/update ouverts aux 3 rôles,
-- suppression réservée à owner + admin (traçabilité comptable).

create policy "payments_select" on public.payments
  for select using (school_id = public.current_school_id());
create policy "payments_insert" on public.payments
  for insert with check (school_id = public.current_school_id());
create policy "payments_update" on public.payments
  for update
  using (school_id = public.current_school_id())
  with check (school_id = public.current_school_id());
create policy "payments_delete" on public.payments
  for delete using (school_id = public.current_school_id() and public.has_role(array['owner','admin']));

create policy "expenses_select" on public.expenses
  for select using (school_id = public.current_school_id());
create policy "expenses_insert" on public.expenses
  for insert with check (school_id = public.current_school_id());
create policy "expenses_update" on public.expenses
  for update
  using (school_id = public.current_school_id())
  with check (school_id = public.current_school_id());
create policy "expenses_delete" on public.expenses
  for delete using (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
