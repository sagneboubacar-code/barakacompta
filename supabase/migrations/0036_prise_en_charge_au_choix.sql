-- =========================================================================
-- La prise en charge d'un enfant devient un CHOIX DE L'ECOLE.
--
-- 0035 designait automatiquement l'enfant "du milieu" des qu'une famille
-- comptait 4 eleves. Retour du terrain : certaines familles ont les moyens
-- et ne doivent rien recevoir ; pour les autres, c'est l'ecole qui choisit
-- QUEL enfant elle prend en charge. Plus rien n'est automatique :
--   * pas de prise en charge tant que l'ecole n'en a pas choisi une ;
--   * l'ecole choisit l'enfant (un seul par famille) depuis la fiche famille,
--     et si la prise en charge couvre toute l'annee scolaire ou seulement
--     les echeances a partir d'aujourd'hui.
--
-- Inchange depuis 0035 : seuls l'inscription et les mensualites sont
-- offertes, l'argent deja encaisse n'est jamais rendu, et quand l'ecole
-- change d'avis les echeances deja echues restent comme elles etaient (sauf
-- correction le jour meme).
-- =========================================================================

-- ---- Fin de la designation automatique --------------------------------------
drop trigger if exists trg_after_student_family_recalc on public.students;
drop trigger if exists trg_after_fee_structure_family_recalc on public.fee_structures;
drop trigger if exists trg_after_school_year_family_recalc on public.schools;

drop function if exists public.trg_students_family_recalc();
drop function if exists public.trg_fee_structures_family_recalc();
drop function if exists public.trg_schools_family_recalc();
drop function if exists public.reset_family_free(uuid);
drop function if exists public.apply_family_free(uuid, boolean);
drop function if exists public.family_middle_student(uuid);
drop function if exists public.student_annual_tuition(uuid);

-- Les designations faites automatiquement par 0035 n'ont pas ete choisies
-- par l'ecole : on les annule entierement.
do $$
declare
  v_family record;
begin
  for v_family in
    select id, free_student_id, free_year from public.families where free_student_id is not null
  loop
    update public.families
    set free_student_id = null, free_year = null, free_since = null, free_from_start = false
    where id = v_family.id;

    perform public.release_family_free(v_family.free_student_id, v_family.free_year, true);
  end loop;
end $$;

-- -------------------------------------------------------------------------
-- set_family_free() : l'ecole choisit l'enfant pris en charge (ou aucun).
--   p_student_id  : un enfant de la famille, ou null pour "aucun"
--   p_from_start  : true = toute l'annee scolaire en cours (sauf ce qui est
--                   deja paye) ; false = les echeances a partir d'aujourd'hui
-- -------------------------------------------------------------------------
create or replace function public.set_family_free(p_family_id uuid, p_student_id uuid, p_from_start boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family public.families%rowtype;
  v_year text;
  v_same_day boolean;
  v_schedule record;
begin
  select * into v_family from public.families where id = p_family_id for update;

  if not found or not (
    public.is_super_admin()
    or (v_family.school_id = public.current_school_id() and public.has_role(array['owner', 'admin']))
  ) then
    raise exception 'not authorized';
  end if;

  if p_student_id is not null
     and not exists (select 1 from public.students where id = p_student_id and family_id = p_family_id) then
    raise exception 'cet élève ne fait pas partie de la famille';
  end if;

  select school_year_label into v_year from public.schools where id = v_family.school_id;
  if v_year is null then
    raise exception 'année scolaire non configurée';
  end if;

  -- Rien ne change.
  if p_student_id is not distinct from v_family.free_student_id
     and (p_student_id is null
          or (v_family.free_year = v_year and v_family.free_from_start = coalesce(p_from_start, true))) then
    return;
  end if;

  -- Choix fait aujourd'hui meme : c'est une correction, l'ancien choix est
  -- annule entierement plutot qu'interrompu.
  v_same_day := coalesce(v_family.free_year = v_year and v_family.free_since = current_date, false);

  -- La famille d'abord : recalc_schedule_discount() lit la designation.
  update public.families
  set free_student_id = p_student_id,
      free_year = case when p_student_id is null then free_year else v_year end,
      free_since = case when p_student_id is null then free_since else current_date end,
      free_from_start = case when p_student_id is null then false else coalesce(p_from_start, true) end
  where id = p_family_id;

  if v_family.free_student_id is not null then
    perform public.release_family_free(v_family.free_student_id, v_year, v_same_day);
  end if;

  if p_student_id is not null then
    for v_schedule in
      select ps.id
      from public.payment_schedules ps
      join public.fee_structures f on f.id = ps.fee_structure_id
      where ps.student_id = p_student_id and f.academic_year = v_year and ps.status <> 'cancelled'
    loop
      perform public.recalc_schedule_discount(v_schedule.id);
    end loop;
  end if;
end;
$$;

revoke all on function public.set_family_free(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_family_free(uuid, uuid, boolean) to authenticated;

-- -------------------------------------------------------------------------
-- L'enfant pris en charge quitte la famille (rattache ailleurs ou a aucune) :
-- la prise en charge s'arrete pour ses echeances a venir.
-- -------------------------------------------------------------------------
create or replace function public.trg_students_family_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family public.families%rowtype;
begin
  if old.family_id is null or old.family_id is not distinct from new.family_id then
    return null;
  end if;

  select * into v_family from public.families
  where id = old.family_id and free_student_id = old.id
  for update;

  if found then
    update public.families set free_student_id = null, free_from_start = false where id = old.family_id;
    perform public.release_family_free(
      old.id,
      v_family.free_year,
      coalesce(v_family.free_since = current_date, false)
    );
  end if;

  return null;
end;
$$;

drop trigger if exists trg_after_student_family_leave on public.students;
create trigger trg_after_student_family_leave
  after update of family_id on public.students
  for each row execute function public.trg_students_family_leave();

revoke all on function public.trg_students_family_leave() from public, anon, authenticated;
