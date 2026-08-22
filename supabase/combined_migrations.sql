-- Migration combinée BARAKA GESTION (0001 à 0010)
-- Génère tout le schéma en une seule exécution.
begin;

-- =============================================================
-- 0001_init.sql
-- =============================================================
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

-- =============================================================
-- 0002_school_signup.sql
-- =============================================================
-- =========================================================================
-- Inscription d'une nouvelle école (signup)
--
-- L'auth.users est créé côté serveur via l'API Admin (service_role), puis
-- cette fonction crée schools + users(role='owner') en une seule transaction
-- atomique : soit les deux lignes existent, soit aucune (évite un utilisateur
-- Auth orphelin sans école, ou une école sans owner).
-- =========================================================================

create or replace function public.create_school_with_owner(
  p_school_name text,
  p_school_slug text,
  p_owner_id uuid,
  p_owner_email text,
  p_owner_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  insert into public.schools (name, slug)
  values (p_school_name, p_school_slug)
  returning id into v_school_id;

  insert into public.users (id, school_id, full_name, email, role)
  values (p_owner_id, v_school_id, p_owner_full_name, p_owner_email, 'owner');

  return v_school_id;
end;
$$;

-- Fonction sensible : contourne RLS et crée un tenant. Réservée à service_role,
-- jamais exposée aux clients authenticated/anon (qui ne pourraient sinon créer
-- une école arbitraire ou s'auto-attribuer le rôle owner).
revoke execute on function public.create_school_with_owner(text, text, uuid, text, text) from public;
revoke execute on function public.create_school_with_owner(text, text, uuid, text, text) from anon;
revoke execute on function public.create_school_with_owner(text, text, uuid, text, text) from authenticated;
grant execute on function public.create_school_with_owner(text, text, uuid, text, text) to service_role;

-- =============================================================
-- 0003_school_settings.sql
-- =============================================================
-- =========================================================================
-- Module "Paramètres école" : informations générales, année scolaire active,
-- classes par défaut regroupées par cycle.
-- =========================================================================

alter table public.schools
  add column if not exists email text,
  add column if not exists school_year_label text,
  add column if not exists school_year_start_month smallint not null default 9
    check (school_year_start_month between 1 and 12),
  add column if not exists school_year_end_month smallint not null default 6
    check (school_year_end_month between 1 and 12);

-- `level` porte désormais le cycle (utilisé pour regrouper l'affichage des
-- classes) ; `sort_order` fixe l'ordre d'affichage à l'intérieur d'un cycle.
alter table public.classes
  add column if not exists sort_order smallint not null default 0;

alter table public.classes drop constraint if exists classes_level_check;
alter table public.classes
  add constraint classes_level_check
  check (level is null or level in ('prescolaire', 'elementaire', 'college', 'lycee'));

-- -------------------------------------------------------------------------
-- Remplace create_school_with_owner() : calcule l'année scolaire courante
-- (bascule en septembre, convention francophone) et pré-remplit les classes
-- standard par cycle. Même signature que 0002 => les GRANT/REVOKE existants
-- restent valides.
-- -------------------------------------------------------------------------
create or replace function public.create_school_with_owner(
  p_school_name text,
  p_school_slug text,
  p_owner_id uuid,
  p_owner_email text,
  p_owner_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_current_year int := extract(year from now())::int;
  v_year_label text;
begin
  if extract(month from now())::int >= 9 then
    v_year_label := v_current_year::text || '-' || (v_current_year + 1)::text;
  else
    v_year_label := (v_current_year - 1)::text || '-' || v_current_year::text;
  end if;

  insert into public.schools (name, slug, school_year_label, school_year_start_month, school_year_end_month)
  values (p_school_name, p_school_slug, v_year_label, 9, 6)
  returning id into v_school_id;

  insert into public.users (id, school_id, full_name, email, role)
  values (p_owner_id, v_school_id, p_owner_full_name, p_owner_email, 'owner');

  insert into public.classes (school_id, name, level, academic_year, sort_order)
  select v_school_id, name, cycle, v_year_label, sort_order
  from (
    values
      ('PS', 'prescolaire', 1),
      ('MS', 'prescolaire', 2),
      ('GS', 'prescolaire', 3),
      ('CI', 'elementaire', 1),
      ('CP', 'elementaire', 2),
      ('CE1', 'elementaire', 3),
      ('CE2', 'elementaire', 4),
      ('CM1', 'elementaire', 5),
      ('CM2', 'elementaire', 6),
      ('6e', 'college', 1),
      ('5e', 'college', 2),
      ('4e', 'college', 3),
      ('3e', 'college', 4),
      ('Seconde', 'lycee', 1),
      ('Première', 'lycee', 2),
      ('Terminale', 'lycee', 3)
  ) as default_classes(name, cycle, sort_order);

  return v_school_id;
end;
$$;

-- -------------------------------------------------------------------------
-- Supabase Storage : bucket public pour les logos d'école.
-- Convention de chemin : <school_id>/<fichier> — la RLS Storage vérifie que
-- le premier segment du chemin correspond à l'école de l'utilisateur.
-- -------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('school-logos', 'school-logos', true)
on conflict (id) do nothing;

drop policy if exists "school_logos_read_public" on storage.objects;
create policy "school_logos_read_public" on storage.objects
  for select
  using (bucket_id = 'school-logos');

drop policy if exists "school_logos_owner_write" on storage.objects;
create policy "school_logos_owner_write" on storage.objects
  for insert
  with check (
    bucket_id = 'school-logos'
    and public.current_user_role() = 'owner'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists "school_logos_owner_update" on storage.objects;
create policy "school_logos_owner_update" on storage.objects
  for update
  using (
    bucket_id = 'school-logos'
    and public.current_user_role() = 'owner'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  )
  with check (
    bucket_id = 'school-logos'
    and public.current_user_role() = 'owner'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists "school_logos_owner_delete" on storage.objects;
create policy "school_logos_owner_delete" on storage.objects
  for delete
  using (
    bucket_id = 'school-logos'
    and public.current_user_role() = 'owner'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

-- =============================================================
-- 0004_fee_structures.sql
-- =============================================================
-- =========================================================================
-- Module "Gestion des tarifs" : tarifs par classe + régime + type de frais,
-- versionnés par année scolaire (une ligne = un tarif figé pour une année
-- donnée ; les années passées ne sont jamais écrasées).
-- =========================================================================

alter table public.fee_structures
  add column if not exists regime text not null default 'externat'
    check (regime in ('externat', 'internat')),
  add column if not exists fee_type text not null default 'inscription'
    check (fee_type in ('inscription', 'mensualite', 'cantine', 'internat', 'transport', 'autre'));

alter table public.fee_structures alter column regime drop default;
alter table public.fee_structures alter column fee_type drop default;

-- Un tarif est toujours rattaché à une classe précise. On resserre la
-- contrainte (auparavant nullable) et on passe le ON DELETE à CASCADE :
-- supprimer une classe n'a plus de sens à conserver ses tarifs orphelins.
alter table public.fee_structures drop constraint if exists fee_structures_class_id_fkey;
alter table public.fee_structures alter column class_id set not null;
alter table public.fee_structures
  add constraint fee_structures_class_id_fkey
  foreign key (class_id) references public.classes (id) on delete cascade;

-- Clé naturelle d'un tarif : une seule ligne par (classe, régime, type de
-- frais, année scolaire). Permet un upsert propre depuis le tableau éditable
-- et empêche les doublons silencieux.
alter table public.fee_structures drop constraint if exists fee_structures_unique_tariff;
alter table public.fee_structures
  add constraint fee_structures_unique_tariff
  unique (school_id, class_id, regime, fee_type, academic_year);

-- =============================================================
-- 0005_students_module.sql
-- =============================================================
-- =========================================================================
-- Module "Gestion des élèves" : régime, adresse, statut resserré, matricule
-- auto-généré (préfixe configurable) au format <PREFIX>-<ANNEE>-<SEQ4>.
-- =========================================================================

alter table public.schools
  add column if not exists matricule_prefix text not null default 'BG';

alter table public.students
  add column if not exists regime text not null default 'externat'
    check (regime in ('externat', 'internat')),
  add column if not exists address text;

-- Le module ne distingue plus que actif/inactif (diplômé/transféré sortaient
-- du périmètre demandé) ; aucune donnée existante à migrer, la base n'est
-- pas encore déployée.
alter table public.students drop constraint if exists students_status_check;
alter table public.students
  add constraint students_status_check check (status in ('active', 'inactive'));

-- -------------------------------------------------------------------------
-- Compteur de matricules par école et par année. Table interne : RLS
-- activée sans policy, donc inaccessible en direct via l'API — seules les
-- fonctions SECURITY DEFINER ci-dessous peuvent la lire/écrire.
-- -------------------------------------------------------------------------
create table public.matricule_counters (
  school_id  uuid not null references public.schools (id) on delete cascade,
  year       int not null,
  last_seq   int not null default 0,
  primary key (school_id, year)
);

alter table public.matricule_counters enable row level security;

create or replace function public.next_matricule(p_school_id uuid, p_year int, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
begin
  insert into public.matricule_counters (school_id, year, last_seq)
  values (p_school_id, p_year, 1)
  on conflict (school_id, year)
    do update set last_seq = public.matricule_counters.last_seq + 1
  returning last_seq into v_seq;

  return p_prefix || '-' || p_year::text || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

create or replace function public.set_student_matricule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_year int;
begin
  if new.matricule is null or new.matricule = '' then
    select matricule_prefix into v_prefix from public.schools where id = new.school_id;
    v_year := extract(year from coalesce(new.enrolled_at, current_date))::int;
    new.matricule := public.next_matricule(new.school_id, v_year, coalesce(v_prefix, 'BG'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_student_matricule on public.students;
create trigger trg_set_student_matricule
  before insert on public.students
  for each row execute function public.set_student_matricule();

-- =============================================================
-- 0006_payment_schedules.sql
-- =============================================================
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

-- =============================================================
-- 0007_payments_module.sql
-- =============================================================
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

-- =============================================================
-- 0008_discounts_module.sql
-- =============================================================
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

-- =============================================================
-- 0009_expenses_module.sql
-- =============================================================
-- =========================================================================
-- Module "Dépenses" : catégories fixes, justificatif (image/PDF) sur bucket
-- Storage privé.
-- =========================================================================

update public.expenses set category = 'autres' where category is null;

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses alter column category set default 'autres';
alter table public.expenses alter column category set not null;
alter table public.expenses
  add constraint expenses_category_check
  check (category in (
    'salaires', 'fournitures', 'eau', 'electricite', 'internet',
    'cantine', 'transport', 'entretien', 'autres'
  ));

-- Redondant avec `label` (utilisé comme description) pour ce module.
alter table public.expenses drop column if exists notes;

-- Un justificatif financier n'a pas vocation à être public comme un logo :
-- on stocke désormais un CHEMIN de fichier (pas une URL publique), résolu en
-- URL signée à la demande côté serveur.
alter table public.expenses rename column receipt_url to receipt_path;

-- -------------------------------------------------------------------------
-- Supabase Storage : bucket privé pour les justificatifs de dépenses.
-- Convention de chemin : <school_id>/<fichier> — la RLS Storage vérifie que
-- le premier segment du chemin correspond à l'école de l'utilisateur.
-- Écriture ouverte aux 3 rôles (comme expenses_insert/update) ; suppression
-- réservée à owner/admin (comme expenses_delete).
-- -------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

drop policy if exists "expense_receipts_select" on storage.objects;
create policy "expense_receipts_select" on storage.objects
  for select
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists "expense_receipts_insert" on storage.objects;
create policy "expense_receipts_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists "expense_receipts_update" on storage.objects;
create policy "expense_receipts_update" on storage.objects
  for update
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  )
  with check (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists "expense_receipts_delete" on storage.objects;
create policy "expense_receipts_delete" on storage.objects
  for delete
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
    and public.has_role(array['owner', 'admin'])
  );

-- =============================================================
-- 0010_subscriptions.sql
-- =============================================================
-- =========================================================================
-- Système d'abonnement multi-tenant : plan, statut, période en cours, et
-- structure d'historique de paiement (Wave / Orange Money / carte) —
-- intégration réelle non branchée, seules la structure de données et l'UI
-- de renouvellement sont posées ici.
-- =========================================================================

alter table public.schools
  add column if not exists plan text not null default 'trial'
    check (plan in ('trial', 'basic', 'pro', 'premium')),
  add column if not exists subscription_status text not null default 'active'
    check (subscription_status in ('active', 'cancelled')),
  add column if not exists subscription_started_at date not null default current_date,
  add column if not exists subscription_expires_at date not null default (current_date + 14);

-- Ces défauts s'appliquent automatiquement à toute nouvelle école créée via
-- create_school_with_owner() (colonnes non listées dans son INSERT) : chaque
-- nouvelle école démarre donc sur un essai gratuit de 14 jours, sans avoir à
-- modifier cette fonction.

-- -------------------------------------------------------------------------
-- Historique des paiements d'abonnement (facturation SaaS de l'école, à ne
-- pas confondre avec `payments` qui suit les frais de scolarité des élèves).
-- Aucune intégration de paiement réelle pour l'instant : une demande créée
-- depuis l'app reste `pending` tant qu'aucun service de confiance (futur
-- webhook Wave/Orange Money/carte, via service_role) ne la fait passer à
-- `completed`/`failed`.
-- -------------------------------------------------------------------------
create table public.subscription_payments (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools (id) on delete cascade,
  plan                text not null check (plan in ('trial', 'basic', 'pro', 'premium')),
  amount              numeric(12, 2) not null check (amount >= 0),
  currency            text not null default 'XOF',
  payment_method      text not null check (payment_method in ('wave', 'orange_money', 'card', 'manual')),
  status              text not null default 'pending'
                      check (status in ('pending', 'completed', 'failed', 'cancelled')),
  external_reference  text,
  period_start        date not null,
  period_end          date not null,
  requested_by        uuid references public.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_subscription_payments_school_id on public.subscription_payments (school_id);

create trigger set_updated_at before update on public.subscription_payments
  for each row execute function public.set_updated_at();

alter table public.subscription_payments enable row level security;

-- Sujet sensible (facturation) : réservé au owner, contrairement aux tables
-- métier ouvertes en lecture aux 3 rôles.
create policy "subscription_payments_select" on public.subscription_payments
  for select
  using (school_id = public.current_school_id() and public.current_user_role() = 'owner');

-- Un owner peut *demander* un renouvellement (ligne pending) ; il ne peut ni
-- la faire passer lui-même à completed, ni écrire pour une autre école — la
-- confirmation réelle restera réservée à un futur traitement service_role.
create policy "subscription_payments_insert_pending" on public.subscription_payments
  for insert
  with check (
    school_id = public.current_school_id()
    and public.current_user_role() = 'owner'
    and status = 'pending'
  );

commit;
