-- =========================================================================
-- Interne depuis le... : une date de debut de l'internat sur la fiche, et
-- un seul mois d'internat par mois.
--
-- Constat du 27 octobre 2026 (ECOLE FRANCO ARABE HOUDALLAH) : deux eleves
-- de CORAN SPECIAL inscrits le 3 septembre ont ete passes en Internat le
-- 27 octobre. 0043 faisait alors partir l'internat du jour de la
-- modification : ni septembre ni le debut d'octobre n'etaient factures.
-- Un autre interne avait deux lignes pour octobre (le 1er et le 5).
--
-- Regles :
--   * la fiche eleve porte « Interne depuis le » (students.internat_since,
--     deja creee par 0043), preremplie avec l'inscription quand on passe un
--     eleve en Internat. Une date saisie est gardee telle quelle, jamais
--     avant l'inscription ;
--   * sans date saisie, la regle de 0043 reste : l'inscription, ou le jour
--     du passage a l'internat ;
--   * quand la date change, les mois d'internat non payes sont refaits a
--     partir d'elle ; les mois deja payes restent ;
--   * un mois d'internat deja facture (paye ou non) n'est jamais facture
--     une deuxieme fois.
--
-- Reprend aussi le droit d'execution de 0042 (bouton « Generer / actualiser
-- l'echeancier ») : une reprise de la fonction doit finir par ce grant.
-- =========================================================================

-- Reprise de 0043 ; seule change la date de debut de l'internat.
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
    new.internat_since := case
      when new.regime = 'internat' then greatest(coalesce(new.internat_since, new.enrolled_at, current_date), new.enrolled_at)
    end;
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

  -- Une date saisie sur la fiche (« Interne depuis le ») est gardee. Sinon :
  -- jour du passage a l'internat, et interne depuis son inscription si
  -- celle-ci est corrigee.
  if new.regime is distinct from 'internat' then
    new.internat_since := null;
  elsif new.internat_since is not null and new.internat_since is distinct from old.internat_since then
    null;
  elsif old.regime is distinct from 'internat' or old.internat_since is null then
    new.internat_since := current_date;
  elsif new.enrolled_at is distinct from old.enrolled_at
        and old.internat_since is not distinct from old.enrolled_at then
    new.internat_since := coalesce(new.enrolled_at, old.internat_since);
  end if;

  -- Jamais interne avant d'etre inscrit.
  if new.internat_since is not null then
    new.internat_since := greatest(new.internat_since, new.enrolled_at);
  end if;

  return new;
end;
$$;

revoke all on function public.trg_students_services_since() from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- generate_student_schedule() : reprise de 0043 ; seul change l'internat,
-- qui ne facture plus un mois deja present dans l'echeancier.
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
  v_internat_since date;
  v_transport_fee_type text;
  v_year text;
  v_calendar_year int;
  v_school_start_month int;
  v_school_end_month int;
  v_arrivee_mois date;
  v_mois_scolaire date;
  v_rentree date;
  v_fee public.fee_structures%rowtype;
  v_mensualite public.fee_structures%rowtype;
  v_service_start date;
  v_service_start_month date;
  v_due_date date;
  v_schedule_id uuid;
begin
  select school_id, class_id, regime, enrolled_at, subscribes_cantine, subscribes_transport,
         transport_zone, subscribes_renforcement, cantine_since, transport_since, renforcement_since,
         internat_since
    into v_school_id, v_class_id, v_regime, v_enrolled_at, v_subscribes_cantine, v_subscribes_transport,
         v_transport_zone, v_subscribes_renforcement, v_cantine_since, v_transport_since, v_renforcement_since,
         v_internat_since
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
  -- fournitures, autre) : dus par tous les élèves de la classe dès qu'un
  -- tarif existe. Les services mensuels et l'internat sont traités plus bas.
  for v_fee in
    select * from public.fee_structures
    where school_id = v_school_id and class_id = v_class_id and regime = v_regime
      and academic_year = v_year and fee_type <> 'mensualite' and month = 0
      and fee_type not in ('cantine', 'renforcement', 'transport', 'transport_zone_1', 'transport_zone_2', 'transport_zone_3', 'internat')
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

  -- Services mensuels (0040, inchange), payes d'avance : un mois de service
  -- par mois tarife de la classe, a partir du mois de debut du service.
  -- Premier mois du le jour du debut (inscription ou abonnement), les
  -- suivants le 5 du mois.
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

  -- Internat : 12 mois sans pause, du mois de rentree de l'ecole au mois
  -- qui precede la rentree suivante, a partir du mois ou l'eleve devient
  -- interne. Premier mois du le jour du debut (a la rentree pour un eleve
  -- inscrit avant elle), les suivants le 5 du mois.
  if v_regime = 'internat' then
    v_rentree := make_date(v_calendar_year, v_school_start_month, 1);
    v_service_start := greatest(coalesce(v_internat_since, v_enrolled_at, current_date), v_rentree);
    v_service_start_month := date_trunc('month', v_service_start::timestamp)::date;

    for v_fee in
      select * from public.fee_structures
      where school_id = v_school_id and class_id = v_class_id and regime = v_regime
        and academic_year = v_year and fee_type = 'internat' and month = 0
    loop
      for i in 0..11 loop
        v_mois_scolaire := (v_rentree + make_interval(months => i))::date;

        if v_mois_scolaire < v_service_start_month then
          continue;
        end if;

        v_due_date := case
          when v_mois_scolaire = v_service_start_month then v_service_start
          else v_mois_scolaire + 4
        end;

        -- Un mois deja facture (paye ou non) ne l'est pas une deuxieme
        -- fois, meme a une autre date (debut d'internat deplace).
        select id into v_schedule_id
        from public.payment_schedules
        where student_id = p_student_id and fee_structure_id = v_fee.id and status <> 'cancelled'
          and due_date >= v_mois_scolaire and due_date < (v_mois_scolaire + interval '1 month')::date
        order by due_date
        limit 1;

        if v_schedule_id is null then
          insert into public.payment_schedules (school_id, student_id, fee_structure_id, due_date, amount_due)
          values (v_school_id, p_student_id, v_fee.id, v_due_date, v_fee.amount)
          on conflict (student_id, fee_structure_id, due_date) do nothing;

          select id into v_schedule_id
          from public.payment_schedules
          where student_id = p_student_id and fee_structure_id = v_fee.id and due_date = v_due_date;
        end if;

        if v_schedule_id is not null then
          perform public.recalc_schedule_discount(v_schedule_id);
        end if;
      end loop;
    end loop;
  end if;
end;
$$;

-- Le bouton « Generer / actualiser l'echeancier » appelle la fonction avec
-- la session de l'utilisateur (voir 0042) : on garde le droit d'execution.
revoke all on function public.generate_student_schedule(uuid, text) from public, anon;
grant execute on function public.generate_student_schedule(uuid, text) to authenticated;

-- -------------------------------------------------------------------------
-- Resynchronisation a la modification de la fiche (reprise de 0043).
-- Change : une date de debut de l'internat modifiee refait les mois
-- d'internat non payes.
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
     and new.internat_since is not distinct from old.internat_since
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

  -- Frais issus d'une grille qui n'est plus la sienne. Exception : les mois
  -- d'internat deja ecoules d'un eleve qui n'est plus interne restent dus.
  if new.class_id is distinct from old.class_id or new.regime is distinct from old.regime then
    delete from public.payment_schedules ps
    using public.fee_structures f
    where ps.student_id = new.id
      and f.id = ps.fee_structure_id
      and coalesce(ps.amount_paid, 0) = 0
      and ps.status <> 'cancelled'
      and (f.class_id is distinct from new.class_id or f.regime is distinct from new.regime)
      and not (f.fee_type = 'internat' and new.regime is distinct from 'internat' and ps.due_date < current_date);
  end if;

  -- Debut de l'internat deplace (fiche, ou inscription corrigee) : les mois
  -- d'internat non payes sont refaits a partir de la nouvelle date.
  if new.regime = 'internat' and old.regime = 'internat'
     and new.internat_since is distinct from old.internat_since then
    delete from public.payment_schedules ps
    using public.fee_structures f
    where ps.student_id = new.id
      and f.id = ps.fee_structure_id
      and f.fee_type = 'internat'
      and coalesce(ps.amount_paid, 0) = 0
      and ps.status <> 'cancelled';
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
-- Reprise :
--   1. un mois d'internat facture deux fois : la ligne non payee en trop est
--      retiree (on garde la ligne payee, sinon la premiere) ;
--   2. chaque interne est regenere : les mois manquants de l'annee scolaire
--      sont ajoutes (aout 2027, depuis que la rentree est passee d'aout a
--      septembre le 27 octobre 2026).
-- -------------------------------------------------------------------------
delete from public.payment_schedules ps
using public.fee_structures f
where f.id = ps.fee_structure_id
  and f.fee_type = 'internat'
  and coalesce(ps.amount_paid, 0) = 0
  and ps.status <> 'cancelled'
  and exists (
    select 1
    from public.payment_schedules o
    where o.student_id = ps.student_id
      and o.fee_structure_id = ps.fee_structure_id
      and o.id <> ps.id
      and o.status <> 'cancelled'
      and date_trunc('month', o.due_date) = date_trunc('month', ps.due_date)
      and (coalesce(o.amount_paid, 0) > 0 or o.due_date < ps.due_date)
  );

do $$
declare
  v_eleve record;
begin
  for v_eleve in
    select id from public.students where regime = 'internat' and class_id is not null
  loop
    perform public.generate_student_schedule(v_eleve.id, null);
  end loop;
end $$;
