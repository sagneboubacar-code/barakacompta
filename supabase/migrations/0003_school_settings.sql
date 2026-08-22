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
