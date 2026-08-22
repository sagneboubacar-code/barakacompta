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
