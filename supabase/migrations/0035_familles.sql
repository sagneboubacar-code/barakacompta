-- =========================================================================
-- Familles et prise en charge d'un enfant.
--
-- Les freres et soeurs sont regroupes dans une famille. Regle de l'ecole :
--   A PARTIR DE 4 ELEVES ACTIFS dans une famille, UN SEUL enfant ne paie
--   ni l'inscription ni les mensualites (cantine, transport, tenue... restent
--   dus). C'est l'enfant "du milieu" selon les frais : on range les enfants
--   du plus cher au moins cher (inscription + mensualites de l'annee, d'apres
--   la grille de sa classe) et on prend le rang ceil(n / 2) -- le 2e sur 4,
--   le 3e sur 5 ou 6. A frais egaux, le plus age passe devant.
--
-- Trois garde-fous sur l'argent :
--   * l'argent deja encaisse n'est jamais rendu : la gratuite couvre le
--     RESTE a payer d'une echeance, pas ce qui a ete verse ;
--   * la premiere designation de l'annee couvre toute l'annee scolaire
--     (cas de la rentree, et des ecoles qui saisissent leurs eleves apres
--     coup) ;
--   * si l'enfant designe change en cours d'annee (un frere part, une
--     classe change), le changement ne vaut que pour les echeances A VENIR :
--     les mois deja echus restent comme ils etaient. Exception : un
--     changement le jour meme de la designation (saisie des freres un par
--     un) remplace purement et simplement la designation precedente.
--
-- Le drapeau payment_schedules.family_free memorise, echeance par echeance,
-- ce qui est couvert : c'est lui qui "fige" le passe quand la designation
-- change.
-- =========================================================================

-- ---- families --------------------------------------------------------------
create table public.families (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools (id) on delete cascade,
  name              text not null,
  guardian_name     text,
  guardian_phone    text,
  -- Colonnes calculees par apply_family_free() : jamais ecrites par l'app.
  free_student_id   uuid references public.students (id) on delete set null,
  free_since        date,
  free_year         text,
  free_from_start   boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_families_school_id on public.families (school_id);

create trigger set_updated_at before update on public.families
  for each row execute function public.set_updated_at();

alter table public.families enable row level security;

create policy "families_select" on public.families
  for select using (school_id = public.current_school_id());
create policy "families_insert" on public.families
  for insert with check (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
create policy "families_update" on public.families
  for update
  using (school_id = public.current_school_id() and public.has_role(array['owner','admin']))
  with check (school_id = public.current_school_id() and public.has_role(array['owner','admin']));
create policy "families_delete" on public.families
  for delete using (school_id = public.current_school_id() and public.has_role(array['owner','admin']));

-- Les colonnes de la prise en charge sont calculees : l'app ne peut ecrire
-- que l'identite de la famille.
revoke insert, update on public.families from anon, authenticated;
grant insert (school_id, name, guardian_name, guardian_phone) on public.families to authenticated;
grant update (name, guardian_name, guardian_phone) on public.families to authenticated;

-- ---- students.family_id -----------------------------------------------------
alter table public.students
  add column if not exists family_id uuid references public.families (id) on delete set null;

create index if not exists idx_students_family_id on public.students (family_id);

-- ---- payment_schedules.family_free -------------------------------------------
alter table public.payment_schedules
  add column if not exists family_free boolean not null default false;

-- -------------------------------------------------------------------------
-- Une famille d'une autre ecole ne peut pas etre rattachee (la cle etrangere
-- seule ne le garantit pas : elle ignore la RLS).
-- -------------------------------------------------------------------------
create or replace function public.trg_students_check_family()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.family_id is not null
     and not exists (select 1 from public.families where id = new.family_id and school_id = new.school_id) then
    raise exception 'famille introuvable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_before_student_family_check on public.students;
create trigger trg_before_student_family_check
  before insert or update of family_id on public.students
  for each row execute function public.trg_students_check_family();

-- -------------------------------------------------------------------------
-- Cout annuel d'un eleve selon la grille de sa classe : inscription +
-- toutes les mensualites de l'annee scolaire en cours. Sert uniquement a
-- ranger les freres et soeurs.
-- -------------------------------------------------------------------------
create or replace function public.student_annual_tuition(p_student_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(f.amount), 0)
  from public.students s
  join public.schools sc on sc.id = s.school_id
  join public.fee_structures f
    on f.school_id = s.school_id and f.class_id = s.class_id and f.regime = s.regime
   and f.academic_year = sc.school_year_label and f.fee_type in ('inscription', 'mensualite')
  where s.id = p_student_id;
$$;

-- L'enfant pris en charge aujourd'hui, ou null si la famille a moins de 4
-- eleves actifs.
create or replace function public.family_middle_student(p_family_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with enfants as (
    select s.id,
           row_number() over (
             order by public.student_annual_tuition(s.id) desc,
                      s.date_of_birth asc nulls last, s.created_at, s.id
           ) as rang,
           count(*) over () as total
    from public.students s
    where s.family_id = p_family_id and s.status = 'active'
  )
  select id from enfants where total >= 4 and rang = ceil(total / 2.0)::int;
$$;

-- -------------------------------------------------------------------------
-- recalc_schedule_discount() : reprise de 0008, plus la prise en charge
-- famille. Une echeance couverte voit sa reduction portee au reste a payer
-- (jamais au-dela de ce qui n'a pas ete verse).
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
  v_family_free boolean;
  v_fee_type text;
  v_academic_year text;
  v_fixed_total numeric(12, 2);
  v_percent_total numeric(12, 2);
  v_discount numeric(12, 2);
  v_paid numeric(12, 2);
begin
  select ps.student_id, ps.due_date, ps.amount_due, ps.family_free, f.fee_type, f.academic_year
    into v_student_id, v_due_date, v_amount_due, v_family_free, v_fee_type, v_academic_year
  from public.payment_schedules ps
  left join public.fee_structures f on f.id = ps.fee_structure_id
  where ps.id = p_schedule_id;

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

  -- Prise en charge famille. Une echeance deja couverte le reste (le passe
  -- est fige) ; sinon elle le devient si l'eleve est l'enfant designe de sa
  -- famille pour cette annee et que l'echeance tombe dans la periode couverte.
  if not v_family_free and v_fee_type in ('inscription', 'mensualite') then
    v_family_free := exists (
      select 1
      from public.students s
      join public.families fa on fa.id = s.family_id
      where s.id = v_student_id
        and fa.free_student_id = s.id
        and fa.free_year = v_academic_year
        and (fa.free_from_start or v_due_date >= fa.free_since)
    );
  end if;

  if v_family_free then
    select coalesce(sum(amount), 0) into v_paid
    from public.payment_allocations
    where payment_schedule_id = p_schedule_id;

    v_discount := greatest(v_discount, v_amount_due - v_paid);
  end if;

  update public.payment_schedules
  set discount_amount = v_discount, family_free = v_family_free
  where id = p_schedule_id;

  -- Le statut (payé/partiel/en attente) dépend du montant net après réduction.
  perform public.recalc_payment_schedule(p_schedule_id);
end;
$$;

revoke all on function public.recalc_schedule_discount(uuid) from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- Retire la prise en charge d'un enfant qui n'est plus designe : sur les
-- echeances a venir seulement, ou sur toute l'annee si la designation date
-- d'aujourd'hui (elle est alors remplacee, pas interrompue).
-- -------------------------------------------------------------------------
create or replace function public.release_family_free(p_student_id uuid, p_year text, p_whole_year boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule record;
begin
  for v_schedule in
    update public.payment_schedules ps
    set family_free = false
    from public.fee_structures f
    where f.id = ps.fee_structure_id
      and ps.student_id = p_student_id
      and ps.family_free
      and f.academic_year = p_year
      and (p_whole_year or ps.due_date >= current_date)
    returning ps.id
  loop
    perform public.recalc_schedule_discount(v_schedule.id);
  end loop;
end;
$$;

-- -------------------------------------------------------------------------
-- apply_family_free() : designe l'enfant pris en charge et met a jour les
-- echeances concernees. Appelee par les triggers ; p_reset (bouton
-- "Recalculer" de la fiche famille) efface la prise en charge de l'annee
-- et repart de zero, comme une premiere designation.
-- -------------------------------------------------------------------------
create or replace function public.apply_family_free(p_family_id uuid, p_reset boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family public.families%rowtype;
  v_year text;
  v_old uuid;
  v_new uuid;
  v_same_day boolean;
  v_from_start boolean;
  v_member record;
  v_schedule record;
begin
  select * into v_family from public.families where id = p_family_id for update;
  if not found then
    return;
  end if;

  select school_year_label into v_year from public.schools where id = v_family.school_id;
  if v_year is null then
    return; -- année scolaire non configurée : aucune grille à appliquer
  end if;

  v_old := v_family.free_student_id;
  v_new := public.family_middle_student(p_family_id);

  -- Rien n'a changé.
  if not p_reset and v_new is not distinct from v_old and (v_new is null or v_family.free_year = v_year) then
    return;
  end if;

  -- Designation faite aujourd'hui meme (saisie des freres un par un) : elle
  -- est remplacee entierement, et la suivante herite de sa portee.
  v_same_day := coalesce(v_family.free_year = v_year and v_family.free_since = current_date, false);

  v_from_start := case
    when p_reset then true
    -- Premiere designation de l'annee : elle couvre toute l'annee.
    when v_family.free_year is distinct from v_year then true
    when v_same_day then v_family.free_from_start
    else false
  end;

  -- La famille d'abord : recalc_schedule_discount() lit la designation, elle
  -- doit deja etre la nouvelle quand on libere l'ancien enfant.
  if v_new is null then
    update public.families
    set free_student_id = null,
        -- Une premiere designation annulee le jour meme n'a jamais existe :
        -- la prochaine sera de nouveau la premiere de l'annee.
        free_year = case when v_from_start then null else free_year end,
        free_since = case when v_from_start then null else free_since end,
        free_from_start = false
    where id = p_family_id;
  else
    update public.families
    set free_student_id = v_new,
        free_year = v_year,
        free_since = current_date,
        free_from_start = v_from_start
    where id = p_family_id;
  end if;

  if p_reset then
    for v_member in
      select id from public.students where family_id = p_family_id
      union
      select v_old where v_old is not null
    loop
      perform public.release_family_free(v_member.id, v_year, true);
    end loop;
  elsif v_old is not null and v_old is distinct from v_new then
    -- Le passe reste fige, sauf si la designation datait d'aujourd'hui.
    perform public.release_family_free(v_old, v_year, v_same_day);
  end if;

  if v_new is null then
    return;
  end if;

  for v_schedule in
    select ps.id
    from public.payment_schedules ps
    join public.fee_structures f on f.id = ps.fee_structure_id
    where ps.student_id = v_new and f.academic_year = v_year and ps.status <> 'cancelled'
  loop
    perform public.recalc_schedule_discount(v_schedule.id);
  end loop;
end;
$$;

-- Bouton "Recalculer la prise en charge" : seul point d'entree appelable
-- par l'app, avec controle de l'ecole et du role.
create or replace function public.reset_family_free(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.families
    where id = p_family_id
      and (public.is_super_admin()
           or (school_id = public.current_school_id() and public.has_role(array['owner', 'admin'])))
  ) then
    raise exception 'not authorized';
  end if;

  perform public.apply_family_free(p_family_id, true);
end;
$$;

-- -------------------------------------------------------------------------
-- Declencheurs : la designation se recalcule des qu'un element qui la
-- determine change.
-- -------------------------------------------------------------------------

-- Eleve ajoute, retire, change de famille, de classe, de regime ou de statut.
create or replace function public.trg_students_family_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.family_id is not null then
      perform public.apply_family_free(old.family_id);
    end if;
    return null;
  end if;

  if tg_op = 'UPDATE' and old.family_id is not null and old.family_id is distinct from new.family_id then
    perform public.apply_family_free(old.family_id);
  end if;

  if new.family_id is not null then
    perform public.apply_family_free(new.family_id);
  end if;

  return null;
end;
$$;

drop trigger if exists trg_after_student_family_recalc on public.students;
create trigger trg_after_student_family_recalc
  after insert or delete or update of family_id, class_id, regime, status, date_of_birth on public.students
  for each row execute function public.trg_students_family_recalc();

-- Tarifs d'inscription / mensualite modifies : le classement peut changer.
create or replace function public.trg_fee_structures_family_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_concerned boolean;
  v_family record;
begin
  if tg_op = 'DELETE' then
    v_school_id := old.school_id;
    v_concerned := old.fee_type in ('inscription', 'mensualite');
  elsif tg_op = 'INSERT' then
    v_school_id := new.school_id;
    v_concerned := new.fee_type in ('inscription', 'mensualite');
  else
    v_school_id := new.school_id;
    v_concerned := new.fee_type in ('inscription', 'mensualite') or old.fee_type in ('inscription', 'mensualite');
  end if;

  if not v_concerned then
    return null;
  end if;

  for v_family in
    select fa.id
    from public.families fa
    where fa.school_id = v_school_id
      and (fa.free_student_id is not null
           or (select count(*) from public.students s where s.family_id = fa.id and s.status = 'active') >= 4)
  loop
    perform public.apply_family_free(v_family.id);
  end loop;

  return null;
end;
$$;

drop trigger if exists trg_after_fee_structure_family_recalc on public.fee_structures;
create trigger trg_after_fee_structure_family_recalc
  after insert or delete or update of amount, fee_type, class_id, regime, academic_year on public.fee_structures
  for each row execute function public.trg_fee_structures_family_recalc();

-- Nouvelle annee scolaire : chaque famille repart sur la grille de l'annee.
create or replace function public.trg_schools_family_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family record;
begin
  if new.school_year_label is not distinct from old.school_year_label then
    return null;
  end if;

  for v_family in select id from public.families where school_id = new.id loop
    perform public.apply_family_free(v_family.id);
  end loop;

  return null;
end;
$$;

drop trigger if exists trg_after_school_year_family_recalc on public.schools;
create trigger trg_after_school_year_family_recalc
  after update of school_year_label on public.schools
  for each row execute function public.trg_schools_family_recalc();

-- Famille supprimee : l'enfant pris en charge paie de nouveau ses echeances
-- a venir. "after" et non "before" : la famille ne doit plus exister quand
-- recalc_schedule_discount() relit la designation.
create or replace function public.trg_families_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.free_student_id is not null and old.free_year is not null then
    perform public.release_family_free(
      old.free_student_id,
      old.free_year,
      coalesce(old.free_since = current_date, false)
    );
  end if;
  return null;
end;
$$;

drop trigger if exists trg_after_family_delete on public.families;
create trigger trg_after_family_delete
  after delete on public.families
  for each row execute function public.trg_families_after_delete();

-- -------------------------------------------------------------------------
-- Fonctions internes : appelees uniquement par les triggers.
-- -------------------------------------------------------------------------
revoke all on function public.trg_students_check_family() from public, anon, authenticated;
revoke all on function public.student_annual_tuition(uuid) from public, anon, authenticated;
revoke all on function public.family_middle_student(uuid) from public, anon, authenticated;
revoke all on function public.release_family_free(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.apply_family_free(uuid, boolean) from public, anon, authenticated;
revoke all on function public.trg_students_family_recalc() from public, anon, authenticated;
revoke all on function public.trg_fee_structures_family_recalc() from public, anon, authenticated;
revoke all on function public.trg_schools_family_recalc() from public, anon, authenticated;
revoke all on function public.trg_families_after_delete() from public, anon, authenticated;

revoke all on function public.reset_family_free(uuid) from public, anon;
grant execute on function public.reset_family_free(uuid) to authenticated;
