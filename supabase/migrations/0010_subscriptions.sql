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
