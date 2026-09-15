-- =========================================================================
-- Les mensualites se paient A TERME ECHU : un mois se regle une fois ecoule.
--
-- Constat sur les donnees reelles d'ECOLE FRANCO ARABE HOUDALLAH :
-- l'echeance du 5 novembre portait le tarif de NOVEMBRE, alors que l'ecole
-- fait payer le mois d'OCTOBRE a cette date. Consequence directe : le mois
-- de septembre, tarife 17 000 F pour 3e / CM1 / CM2, n'etait facture a
-- AUCUN des 18 eleves de ces classes -- 341 000 F jamais reclames.
--
-- Deuxieme correction, aussi importante : la sequence des mois ne se deduit
-- plus des reglages "mois de debut / mois de fin" de l'ecole, mais des mois
-- REELLEMENT TARIFES pour chaque classe. Chez Houdallah, seules 3e, CM1 et
-- CM2 ont un septembre ; les dix autres classes commencent en octobre.
-- Aucun reglage global ne peut exprimer cette difference -- alors que la
-- grille tarifaire, elle, la porte deja.
--
-- La regle tient desormais en une phrase :
--   chaque mois tarife donne une echeance le 5 du mois suivant,
--   a condition que l'eleve ait ete la ce mois-la.
-- =========================================================================

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
  v_transport_fee_type text;
  v_year text;
  v_calendar_year int;
  v_school_start_month int;
  v_school_end_month int;
  v_arrivee_mois date;
  v_mois_scolaire date;
  v_fee public.fee_structures%rowtype;
  v_mensualite public.fee_structures%rowtype;
  v_due_date date;
  v_schedule_id uuid;
begin
  select school_id, class_id, regime, enrolled_at, subscribes_cantine, subscribes_transport,
         transport_zone, subscribes_renforcement
    into v_school_id, v_class_id, v_regime, v_enrolled_at, v_subscribes_cantine, v_subscribes_transport,
         v_transport_zone, v_subscribes_renforcement
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

  -- Frais à échéance unique : inscription/uniforme/tenue_sport/fournitures/
  -- autre sont dus par tous les élèves de la classe dès qu'un tarif existe ;
  -- cantine/transport/renforcement ne le sont que pour les élèves abonnés.
  for v_fee in
    select * from public.fee_structures
    where school_id = v_school_id and class_id = v_class_id and regime = v_regime
      and academic_year = v_year and fee_type <> 'mensualite' and month = 0
      and (fee_type <> 'cantine' or v_subscribes_cantine)
      and (fee_type <> 'renforcement' or v_subscribes_renforcement)
      and (
        fee_type not in ('transport', 'transport_zone_1', 'transport_zone_2', 'transport_zone_3')
        or (v_subscribes_transport and fee_type = v_transport_fee_type)
      )
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

  -- On parcourt les mois REELLEMENT tarifes pour cette classe, au lieu de
  -- derouler une sequence deduite des reglages de l'ecole. C'est l'ecole qui
  -- decide quels mois elle facture, en les tarifant ou non : chez Houdallah,
  -- seules 3e, CM1 et CM2 ont un mois de septembre, les dix autres classes
  -- demarrent en octobre. Aucun reglage global ne peut exprimer ca.
  for v_mensualite in
    select * from public.fee_structures
    where school_id = v_school_id and class_id = v_class_id and regime = v_regime
      and academic_year = v_year and fee_type = 'mensualite'
    order by month
  loop
    -- Un mois >= mois de rentree appartient a la premiere annee civile du
    -- libelle (2026-2027 -> septembre 2026), les suivants a la seconde
    -- (janvier 2027).
    if v_mensualite.month >= v_school_start_month then
      v_mois_scolaire := make_date(v_calendar_year, v_mensualite.month, 1);
    else
      v_mois_scolaire := make_date(v_calendar_year + 1, v_mensualite.month, 1);
    end if;

    -- Mois anterieur a l'arrivee de l'eleve : il n'etait pas la, rien n'est du.
    if v_mois_scolaire < v_arrivee_mois then
      continue;
    end if;

    -- PAIEMENT A TERME ECHU : on regle un mois une fois qu'il est ecoule.
    -- Le mois de septembre se paie le 5 octobre, octobre le 5 novembre.
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
end;
$$;

revoke all on function public.generate_student_schedule(uuid, text) from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- Resynchronisation : on repart des mensualites a zero plutot que d'essayer
-- de deviner lesquelles sont devenues fausses. Les dates d'echeance ayant
-- change de sens, un rapprochement ligne a ligne serait fragile ; une
-- regeneration complete est exacte par construction.
--
-- Les echeances portant un paiement ne sont JAMAIS touchees : l'argent
-- encaisse est un fait, pas un calcul.
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

  -- Frais a echeance unique issus d'une grille qui n'est plus la sienne.
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

  delete from public.payment_schedules ps
  using public.fee_structures f
  where ps.student_id = new.id
    and f.id = ps.fee_structure_id
    and coalesce(ps.amount_paid, 0) = 0
    and ps.status <> 'cancelled'
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
-- Reprise des echeanciers deja en base.
--
-- Les mensualites existantes ont ete calculees avec l'ancienne regle : leurs
-- dates ne correspondent plus aux mois qu'elles representent. On les efface
-- et on les regenere. Verifie avant ecriture de cette migration : aucune des
-- 175 mensualites en base ne porte le moindre paiement.
--
-- Les frais d'inscription, d'uniforme et autres ne sont pas concernes : ils
-- restent dus a la date d'inscription, pas a terme echu.
-- -------------------------------------------------------------------------
do $$
declare
  v_eleve record;
  v_supprimees int;
begin
  delete from public.payment_schedules ps
  using public.fee_structures f
  where f.id = ps.fee_structure_id
    and f.fee_type = 'mensualite'
    and coalesce(ps.amount_paid, 0) = 0
    and ps.status <> 'cancelled';
  get diagnostics v_supprimees = row_count;
  raise notice 'mensualites effacees : %', v_supprimees;

  for v_eleve in select id from public.students where class_id is not null loop
    perform public.generate_student_schedule(v_eleve.id, null);
  end loop;
end $$;
