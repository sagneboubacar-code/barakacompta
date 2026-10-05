-- =========================================================================
-- Cantine, transport et cours de renforcement : des frais MENSUELS, payes
-- D'AVANCE.
--
-- Jusqu'ici ces services etaient factures une seule fois, a l'inscription,
-- comme l'inscription elle-meme. Retour de l'ecole (5 octobre 2026) : un
-- eleve inscrit a la cantine paie chaque mois, au debut du mois ou il en
-- profite -- la cantine d'octobre se paie debut octobre (a l'inscription
-- pour un nouvel eleve), celle de novembre debut novembre, etc. Le montant
-- saisi dans la grille des tarifs est donc un montant MENSUEL.
--
-- Regles :
--   * un mois de service par mois tarife de la classe (les memes mois que
--     les mensualites), a partir du mois ou l'eleve commence le service ;
--   * premier mois du a la date de debut (inscription ou abonnement), les
--     suivants le 5 du mois ;
--   * l'eleve qui s'abonne en cours d'annee ne paie qu'a partir de ce mois :
--     la date de debut de chaque service est memorisee (*_since) ;
--   * celui qui se desabonne ne doit plus les mois A VENIR ; les mois passes
--     non payes restent dus.
-- Les mensualites (a terme echu, 0032) ne changent pas.
-- =========================================================================

-- ---- Date de debut de chaque service ------------------------------------------
alter table public.students
  add column if not exists cantine_since date,
  add column if not exists transport_since date,
  add column if not exists renforcement_since date;

-- Abonnes actuels : abonnes depuis leur inscription.
update public.students set cantine_since = coalesce(enrolled_at, current_date)
where subscribes_cantine and cantine_since is null;
update public.students set transport_since = coalesce(enrolled_at, current_date)
where subscribes_transport and transport_since is null;
update public.students set renforcement_since = coalesce(enrolled_at, current_date)
where subscribes_renforcement and renforcement_since is null;

-- Tenue automatique : a l'inscription, le service commence avec l'eleve ; un
-- abonnement pris plus tard commence le jour ou il est coche ; un changement
-- de zone de transport repart du jour du changement.
create or replace function public.trg_students_services_since()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.cantine_since := case when new.subscribes_cantine then coalesce(new.cantine_since, new.enrolled_at, current_date) end;
    new.transport_since := case when new.subscribes_transport then coalesce(new.transport_since, new.enrolled_at, current_date) end;
    new.renforcement_since := case when new.subscribes_renforcement then coalesce(new.renforcement_since, new.enrolled_at, current_date) end;
    return new;
  end if;

  if not new.subscribes_cantine then
    new.cantine_since := null;
  elsif not old.subscribes_cantine or old.cantine_since is null then
    new.cantine_since := current_date;
  end if;

  if not new.subscribes_transport then
    new.transport_since := null;
  elsif not old.subscribes_transport or old.transport_since is null
        or new.transport_zone is distinct from old.transport_zone then
    new.transport_since := current_date;
  end if;

  if not new.subscribes_renforcement then
    new.renforcement_since := null;
  elsif not old.subscribes_renforcement or old.renforcement_since is null then
    new.renforcement_since := current_date;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_before_student_services_since on public.students;
create trigger trg_before_student_services_since
  before insert or update on public.students
  for each row execute function public.trg_students_services_since();

revoke all on function public.trg_students_services_since() from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- generate_student_schedule() : reprise de 0032 ; seuls changent les
-- services (cantine, transport, renforcement), desormais mensuels.
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
  v_subscribes_cantine boolean;
  v_subscribes_transport boolean;
  v_subscribes_renforcement boolean;
  v_transport_zone smallint;
  v_cantine_since date;
  v_transport_since date;
  v_renforcement_since date;
  v_transport_fee_type text;
  v_year text;
  v_calendar_year int;
  v_school_start_month int;
  v_school_end_month int;
  v_arrivee_mois date;
  v_mois_scolaire date;
  v_fee public.fee_structures%rowtype;
  v_mensualite public.fee_structures%rowtype;
  v_service_start date;
  v_service_start_month date;
  v_due_date date;
  v_schedule_id uuid;
begin
  select school_id, class_id, regime, enrolled_at, subscribes_cantine, subscribes_transport,
         transport_zone, subscribes_renforcement, cantine_since, transport_since, renforcement_since
    into v_school_id, v_class_id, v_regime, v_enrolled_at, v_subscribes_cantine, v_subscribes_transport,
         v_transport_zone, v_subscribes_renforcement, v_cantine_since, v_transport_since, v_renforcement_since
  from public.students
  where id = p_student_id;

  -- Le seul tarif de transport applicable à cet élève : sa zone, ou le
  -- tarif unique s'il n'en a pas.
  v_transport_fee_type := case
    when v_transport_zone is null then 'transport'
    else 'transport_zone_' || v_transport_zone::text
  end;

  if v_school_id is null or v_class_id is null then
    return; -- élève introuvable ou sans classe assignée
  end if;

  if not (public.is_super_admin() or public.current_school_id() = v_school_id) then
    raise exception 'not authorized';
  end if;

  select school_year_label, coalesce(school_year_start_month, 9), coalesce(school_year_end_month, 6)
    into v_year, v_school_start_month, v_school_end_month
  from public.schools
  where id = v_school_id;

  v_year := coalesce(p_academic_year, v_year);
  if v_year is null then
    return;
  end if;

  -- Frais à échéance unique (inscription, uniforme, tenue de sport,
  -- fournitures, internat, autre) : dus par tous les élèves de la classe dès
  -- qu'un tarif existe. Les services mensuels sont traités plus bas.
  for v_fee in
    select * from public.fee_structures
    where school_id = v_school_id and class_id = v_class_id and regime = v_regime
      and academic_year = v_year and fee_type <> 'mensualite' and month = 0
      and fee_type not in ('cantine', 'renforcement', 'transport', 'transport_zone_1', 'transport_zone_2', 'transport_zone_3')
  loop
    insert into public.payment_schedules (school_id, student_id, fee_structure_id, due_date, amount_due)
    values (v_school_id, p_student_id, v_fee.id, coalesce(v_enrolled_at, current_date), v_fee.amount)
    on conflict (student_id, fee_structure_id, due_date) do nothing;

    select id into v_schedule_id
    from public.payment_schedules
    where student_id = p_student_id and fee_structure_id = v_fee.id
      and due_date = coalesce(v_enrolled_at, current_date);

    if v_schedule_id is not null then
      perform public.recalc_schedule_discount(v_schedule_id);
    end if;
  end loop;

  begin
    v_calendar_year := split_part(v_year, '-', 1)::int;
  exception when others then
    v_calendar_year := extract(year from current_date)::int;
  end;

  -- Premier mois scolaire du par l'eleve : celui de son arrivee.
  v_arrivee_mois := date_trunc('month', coalesce(v_enrolled_at, current_date)::timestamp)::date;

  -- Mensualites (0032, inchange) : chaque mois tarife donne une echeance le
  -- 5 du mois suivant (terme echu), a condition que l'eleve ait ete la.
  for v_mensualite in
    select * from public.fee_structures
    where school_id = v_school_id and class_id = v_class_id and regime = v_regime
      and academic_year = v_year and fee_type = 'mensualite'
    order by month
  loop
    if v_mensualite.month >= v_school_start_month then
      v_mois_scolaire := make_date(v_calendar_year, v_mensualite.month, 1);
    else
      v_mois_scolaire := make_date(v_calendar_year + 1, v_mensualite.month, 1);
    end if;

    if v_mois_scolaire < v_arrivee_mois then
      continue;
    end if;

    v_due_date := (v_mois_scolaire + interval '1 month')::date + 4;

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

  -- Services mensuels, payes d'avance : un mois de service par mois tarife de
  -- la classe, a partir du mois de debut du service. Premier mois du le jour
  -- du debut (inscription ou abonnement), les suivants le 5 du mois.
  for v_fee in
    select * from public.fee_structures
    where school_id = v_school_id and class_id = v_class_id and regime = v_regime
      and academic_year = v_year and month = 0
      and (
        (fee_type = 'cantine' and v_subscribes_cantine)
        or (fee_type = 'renforcement' and v_subscribes_renforcement)
        or (v_subscribes_transport and fee_type = v_transport_fee_type)
      )
  loop
    v_service_start := greatest(
      coalesce(v_enrolled_at, current_date),
      coalesce(
        case v_fee.fee_type
          when 'cantine' then v_cantine_since
          when 'renforcement' then v_renforcement_since
          else v_transport_since
        end,
        v_enrolled_at,
        current_date
      )
    );
    v_service_start_month := date_trunc('month', v_service_start::timestamp)::date;

    for v_mensualite in
      select * from public.fee_structures
      where school_id = v_school_id and class_id = v_class_id and regime = v_regime
        and academic_year = v_year and fee_type = 'mensualite'
      order by month
    loop
      if v_mensualite.month >= v_school_start_month then
        v_mois_scolaire := make_date(v_calendar_year, v_mensualite.month, 1);
      else
        v_mois_scolaire := make_date(v_calendar_year + 1, v_mensualite.month, 1);
      end if;

      if v_mois_scolaire < v_service_start_month then
        continue;
      end if;

      v_due_date := case
        when v_mois_scolaire = v_service_start_month then v_service_start
        else v_mois_scolaire + 4
      end;

      insert into public.payment_schedules (school_id, student_id, fee_structure_id, due_date, amount_due)
      values (v_school_id, p_student_id, v_fee.id, v_due_date, v_fee.amount)
      on conflict (student_id, fee_structure_id, due_date) do nothing;

      select id into v_schedule_id
      from public.payment_schedules
      where student_id = p_student_id and fee_structure_id = v_fee.id and due_date = v_due_date;

      if v_schedule_id is not null then
        perform public.recalc_schedule_discount(v_schedule_id);
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function public.generate_student_schedule(uuid, text) from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- Resynchronisation a la modification de la fiche (reprise de 0032).
-- Change : un service retire (desabonnement, autre zone de transport) ne
-- supprime plus que les mois A VENIR non payes -- les mois passes restent
-- dus. Le regenerer ensuite recree le service a partir de son nouveau debut.
-- -------------------------------------------------------------------------
create or replace function public.trg_students_sync_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transport_fee_type text;
begin
  if new.class_id is not distinct from old.class_id
     and new.regime is not distinct from old.regime
     and new.enrolled_at is not distinct from old.enrolled_at
     and new.subscribes_cantine is not distinct from old.subscribes_cantine
     and new.subscribes_transport is not distinct from old.subscribes_transport
     and new.transport_zone is not distinct from old.transport_zone
     and new.subscribes_renforcement is not distinct from old.subscribes_renforcement
  then
    return new;
  end if;

  -- Toutes les mensualites non payees : elles seront regenerees justes.
  delete from public.payment_schedules ps
  using public.fee_structures f
  where ps.student_id = new.id
    and f.id = ps.fee_structure_id
    and f.fee_type = 'mensualite'
    and coalesce(ps.amount_paid, 0) = 0
    and ps.status <> 'cancelled';

  -- Frais issus d'une grille qui n'est plus la sienne.
  if new.class_id is distinct from old.class_id or new.regime is distinct from old.regime then
    delete from public.payment_schedules ps
    using public.fee_structures f
    where ps.student_id = new.id
      and f.id = ps.fee_structure_id
      and coalesce(ps.amount_paid, 0) = 0
      and ps.status <> 'cancelled'
      and (f.class_id is distinct from new.class_id or f.regime is distinct from new.regime);
  end if;

  v_transport_fee_type := case
    when new.transport_zone is null then 'transport'
    else 'transport_zone_' || new.transport_zone::text
  end;

  -- Services retires : seulement les mois a venir non payes.
  delete from public.payment_schedules ps
  using public.fee_structures f
  where ps.student_id = new.id
    and f.id = ps.fee_structure_id
    and coalesce(ps.amount_paid, 0) = 0
    and ps.status <> 'cancelled'
    and ps.due_date >= current_date
    and (
      (f.fee_type = 'cantine' and not new.subscribes_cantine)
      or (f.fee_type = 'renforcement' and not new.subscribes_renforcement)
      or (
        f.fee_type in ('transport', 'transport_zone_1', 'transport_zone_2', 'transport_zone_3')
        and (not new.subscribes_transport or f.fee_type <> v_transport_fee_type)
      )
    );

  perform public.generate_student_schedule(new.id, null);
  return new;
end;
$$;

revoke all on function public.trg_students_sync_schedule() from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- Reprise : les abonnes actuels recoivent leurs mois de service. Une
-- echeance de service deja creee (unique, a l'inscription) devient le
-- premier mois : meme tarif, meme date de debut, elle n'est pas doublee.
-- -------------------------------------------------------------------------
do $$
declare
  v_eleve record;
begin
  for v_eleve in
    select id from public.students
    where class_id is not null
      and (subscribes_cantine or subscribes_transport or subscribes_renforcement)
  loop
    perform public.generate_student_schedule(v_eleve.id, null);
  end loop;
end $$;
