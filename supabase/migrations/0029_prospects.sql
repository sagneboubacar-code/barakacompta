-- =========================================================================
-- Prospects commerciaux de Baraka Compta (ecoles a demarcher).
--
-- Table transverse, sans school_id : elle appartient a Baraka, pas a une
-- ecole cliente. Seul le staff (super_admin) y accede.
--
-- `source_url` est NOT NULL a dessein : c'est la garantie anti-invention.
-- Une fiche sans page verifiable n'a aucune valeur commerciale — pire, elle
-- fait perdre du temps en appels vers des numeros qui n'existent pas.
-- =========================================================================

create table if not exists public.prospects (
  id               uuid primary key default gen_random_uuid(),
  nom              text not null,
  ville            text,
  quartier         text,
  telephone        text,
  email            text,
  -- L'annuaire source expose parfois une adresse relais (xxx@academie-plus.com)
  -- au lieu de celle de l'ecole : on garde l'info pour ne pas ecrire dans le vide.
  email_fiable     boolean not null default false,
  type_etablissement text,
  source_url       text not null,
  score            smallint not null check (score between 1 and 5),
  pourquoi         text,
  accroche         text,
  statut           text not null default 'nouveau'
                     check (statut in ('nouveau', 'contacte', 'interesse', 'refuse', 'client')),
  notes            text,
  recherche        text,           -- la zone/requete qui a produit cette fiche
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Un meme etablissement ne doit pas revenir a chaque recherche.
create unique index if not exists prospects_nom_ville_unique
  on public.prospects (lower(nom), lower(coalesce(ville, '')));

create index if not exists prospects_statut_idx on public.prospects (statut);

drop trigger if exists set_updated_at on public.prospects;
create trigger set_updated_at before update on public.prospects
  for each row execute function public.set_updated_at();

alter table public.prospects enable row level security;

-- Aucune ecole cliente n'a affaire a cette table : seul le staff Baraka.
drop policy if exists "prospects_staff_only" on public.prospects;
create policy "prospects_staff_only" on public.prospects
  for all using (public.is_super_admin()) with check (public.is_super_admin());
