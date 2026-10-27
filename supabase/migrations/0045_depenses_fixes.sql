-- =========================================================================
-- Depenses fixes : salaires et loyers qui reviennent chaque mois.
--
-- (Brouillon ecrit le 5 octobre 2026 sous le numero 0039, jamais execute ;
-- repris ici apres 0044, avec la case internat de 0043.)
--
-- L'ecole tient une liste (« CISSE COLLEGE », « LOCATION INTERNAT »...).
-- Chaque ligne est soit a MONTANT FIXE (le montant habituel, corrigeable le
-- mois ou il change), soit A L'HEURE (un taux horaire : chaque mois on saisit
-- les heures effectuees, montant = heures x taux).
--
-- Chaque mois, l'ecole affiche la liste, ajuste, decoche ce qui n'est pas
-- paye, et valide : une depense normale est creee par ligne (rapports,
-- solde, caisse et bilan de l'internat continuent de fonctionner tels
-- quels). Une meme ligne ne peut etre enregistree qu'une fois par mois.
-- =========================================================================

create table if not exists public.recurring_expenses (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools (id) on delete cascade,
  label        text not null,
  category     text not null default 'salaires' check (category in (
                 'salaires', 'location', 'fournitures', 'eau', 'electricite', 'internet',
                 'cantine', 'transport', 'entretien', 'autres'
               )),
  pay_mode     text not null default 'fixed' check (pay_mode in ('fixed', 'hourly')),
  -- Montant mensuel habituel (pay_mode = 'fixed').
  amount       numeric(12, 2) not null default 0 check (amount >= 0),
  -- Taux horaire (pay_mode = 'hourly').
  hourly_rate  numeric(12, 2) check (hourly_rate >= 0),
  -- La depense creee chaque mois est une depense de l'internat (0043).
  internat     boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint recurring_expenses_hourly_rate check (pay_mode <> 'hourly' or hourly_rate is not null)
);

create index if not exists idx_recurring_expenses_school_id on public.recurring_expenses (school_id);

drop trigger if exists set_updated_at on public.recurring_expenses;
create trigger set_updated_at before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

alter table public.recurring_expenses enable row level security;

-- Tout le monde voit la liste (le comptable enregistre les depenses du mois) ;
-- seuls proprietaire et administrateur la modifient.
drop policy if exists "recurring_expenses_select" on public.recurring_expenses;
drop policy if exists "recurring_expenses_insert" on public.recurring_expenses;
drop policy if exists "recurring_expenses_update" on public.recurring_expenses;
drop policy if exists "recurring_expenses_delete" on public.recurring_expenses;
create policy "recurring_expenses_select" on public.recurring_expenses
  for select using (school_id = public.current_school_id());
create policy "recurring_expenses_insert" on public.recurring_expenses
  for insert with check (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
create policy "recurring_expenses_update" on public.recurring_expenses
  for update
  using (school_id = public.current_school_id() and public.has_role(array['owner','admin']))
  with check (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
create policy "recurring_expenses_delete" on public.recurring_expenses
  for delete using (school_id = public.current_school_id() and public.has_role(array['owner','admin']));

-- ---- Lien depense <-> ligne fixe et mois ---------------------------------------
alter table public.expenses
  add column if not exists recurring_expense_id uuid references public.recurring_expenses (id) on delete set null,
  add column if not exists period text check (period ~ '^\d{4}-\d{2}$'),
  add column if not exists hours numeric(8, 2) check (hours >= 0);

-- Un salaire ne s'enregistre qu'une fois par mois : la base le refuse, meme
-- en cas de double clic ou de deux personnes sur le meme ecran.
create unique index if not exists uq_expenses_recurring_period
  on public.expenses (recurring_expense_id, period)
  where recurring_expense_id is not null;

-- Une ligne fixe d'une autre ecole ne peut pas etre rattachee (la cle
-- etrangere ignore la RLS).
create or replace function public.trg_expenses_check_recurring()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.recurring_expense_id is not null
     and not exists (
       select 1 from public.recurring_expenses
       where id = new.recurring_expense_id and school_id = new.school_id
     ) then
    raise exception 'dépense fixe introuvable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_before_expense_recurring_check on public.expenses;
create trigger trg_before_expense_recurring_check
  before insert or update of recurring_expense_id on public.expenses
  for each row execute function public.trg_expenses_check_recurring();

revoke all on function public.trg_expenses_check_recurring() from public, anon, authenticated;
