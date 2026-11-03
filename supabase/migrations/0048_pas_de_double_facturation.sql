-- =========================================================================
-- Un frais deja facture a un eleve ne l'est pas une deuxieme fois quand on
-- change sa classe ou sa date d'inscription.
--
-- Constat du 3 novembre 2026 : quatre eleves avaient deux inscriptions (et
-- deux uniformes) pour 2026-2027, l'une payee, l'autre a payer.
--   * changement de classe (kante oumar, Ndiaye El hadj Mapathe) : 0028
--     garde l'inscription deja payee de l'ancienne classe, puis la
--     generation cree celle de la nouvelle classe, un autre tarif ;
--   * changement de la date d'inscription (TINE MOSSANE, NDAO MOUSTAPHA) :
--     l'inscription est due ce jour-la, et la generation suivante en creait
--     une autre a la nouvelle date.
-- Les doublons n'etaient evites que pour un meme tarif a une meme date.
--
-- Regles :
--   * frais ponctuels (inscription, uniforme...) : un par type et par annee
--     scolaire ;
--   * mensualites, services mensuels, internat : un par type et par mois ;
--     un mois paye dans l'ancienne classe reste a son ancien tarif, les
--     mois suivants prennent celui de la nouvelle classe (0028 retire les
--     echeances non payees de l'ancienne) ;
--   * les doublons existants sont retires : seulement l'echeance sans
--     aucun paiement, quand une autre du meme frais et de la meme periode a
--     deja ete payee, en tout ou en partie.
--
-- Une reprise de generate_student_schedule() finit par le grant de 0042.
-- =========================================================================

-- Echeance deja facturee a l'eleve pour ce frais et cette periode, quel que
-- soit le tarif (classe, regime, zone) ou la date : celle du tarif demande
-- d'abord, sinon la plus ancienne. Les zones de transport comptent pour un
-- seul frais. La periode, dans l'annee scolaire du tarif :
--   * mensualite : son mois scolaire (fee_structures.month), pas la date
--     d'echeance, dont la regle a change en cours de route (0032) ;
--   * service mensuel et internat : le mois [p_period_start, p_period_end) ;
--   * frais ponctuel (p_period_start null) : l'annee entiere.
create or replace function public.existing_schedule_for(
  p_student_id uuid,
  p_fee_structure_id uuid,
  p_period_start date,
  p_period_end date
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ps.id
  from public.payment_schedules ps
  join public.fee_structures f on f.id = ps.fee_structure_id
  join public.fee_structures demande on demande.id = p_fee_structure_id
  where ps.student_id = p_student_id
    and ps.status <> 'cancelled'
    and f.academic_year = demande.academic_year
    and (
      f.fee_type = demande.fee_type
      or (f.fee_type like 'transport%' and demande.fee_type like 'transport%')
    )
    and (
      (demande.month > 0 and f.month = demande.month)
      or (demande.month = 0 and p_period_start is null)
      or (demande.month = 0 and ps.due_date >= p_period_start and ps.due_date < p_period_end)
    )
  order by (ps.fee_structure_id = p_fee_structure_id) desc, ps.due_date, ps.created_at
  limit 1;
$$;
revoke all on function public.existing_schedule_for(uuid, uuid, date, date) from public, anon, authenticated;

-- generate_student_schedule() : reprise de 0047 ; seule change la recherche
-- d'une echeance deja facturee, avant chaque insertion.
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
  -- tarif existe, une fois par année scolaire. Les services mensuels et
  -- l'internat sont traités plus bas.
  for v_fee in
    select * from public.fee_structures
    where school_id = v_school_id and class_id = v_class_id and regime = v_regime
      and academic_year = v_year and fee_type <> 'mensualite' and month = 0
      and fee_type not in ('cantine', 'renforcement', 'transport', 'transport_zone_1', 'transport_zone_2', 'transport_zone_3', 'internat')
  loop
    v_schedule_id := public.existing_schedule_for(p_student_id, v_fee.id, null, null);

    if v_schedule_id is null then
      insert into public.payment_schedules (school_id, student_id, fee_structure_id, due_date, amount_due)
      values (v_school_id, p_student_id, v_fee.id, coalesce(v_enrolled_at, current_date), v_fee.amount)
      on conflict (student_id, fee_structure_id, due_date) do nothing;

      select id into v_schedule_id
      from public.payment_schedules
      where student_id = p_student_id and fee_structure_id = v_fee.id
        and due_date = coalesce(v_enrolled_at, current_date);
    end if;

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

    v_schedule_id := public.existing_schedule_for(p_student_id, v_mensualite.id, null, null);

    if v_schedule_id is null then
      insert into public.payment_schedules (school_id, student_id, fee_structure_id, due_date, amount_due)
      values (v_school_id, p_student_id, v_mensualite.id, v_due_date, v_mensualite.amount)
      on conflict (student_id, fee_structure_id, due_date) do nothing;

      select id into v_schedule_id
      from public.payment_schedules
      where student_id = p_student_id and fee_structure_id = v_mensualite.id and due_date = v_due_date;
    end if;

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

      v_schedule_id := public.existing_schedule_for(
        p_student_id, v_fee.id, v_mois_scolaire, (v_mois_scolaire + interval '1 month')::date
      );

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
        -- fois, meme a une autre date (debut d'internat deplace) ou dans
        -- une autre classe.
        v_schedule_id := public.existing_schedule_for(
          p_student_id, v_fee.id, v_mois_scolaire, (v_mois_scolaire + interval '1 month')::date
        );

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

revoke all on function public.generate_student_schedule(uuid, text) from public, anon;
grant execute on function public.generate_student_schedule(uuid, text) to authenticated;

-- -------------------------------------------------------------------------
-- Doublons existants : on retire l'echeance qui n'a recu aucun paiement
-- quand une autre du meme frais et de la meme periode a deja ete payee, en
-- tout ou en partie. Rien d'autre n'est touche.
-- -------------------------------------------------------------------------
delete from public.payment_schedules s
using public.fee_structures fs
where fs.id = s.fee_structure_id
  and s.status <> 'cancelled'
  and coalesce(s.amount_paid, 0) = 0
  and not exists (
    select 1 from public.payment_allocations pa where pa.payment_schedule_id = s.id
  )
  and exists (
    select 1
    from public.payment_schedules t
    join public.fee_structures ft on ft.id = t.fee_structure_id
    where t.student_id = s.student_id
      and t.id <> s.id
      and t.status <> 'cancelled'
      and coalesce(t.amount_paid, 0) > 0
      and ft.academic_year = fs.academic_year
      and (
        ft.fee_type = fs.fee_type
        or (ft.fee_type like 'transport%' and fs.fee_type like 'transport%')
      )
      and (
        -- mensualite : le meme mois scolaire
        (fs.month > 0 and ft.month = fs.month)
        -- service mensuel et internat : le meme mois
        or (fs.month = 0 and fs.fee_type in ('cantine', 'renforcement', 'transport', 'transport_zone_1',
                                             'transport_zone_2', 'transport_zone_3', 'internat')
            and date_trunc('month', t.due_date) = date_trunc('month', s.due_date))
        -- frais ponctuel : la meme annee scolaire
        or (fs.month = 0 and fs.fee_type not in ('cantine', 'renforcement', 'transport', 'transport_zone_1',
                                                 'transport_zone_2', 'transport_zone_3', 'internat'))
      )
  );
