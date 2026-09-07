-- =========================================================================
-- Les mensualites commencent au premier mois de l'annee scolaire.
--
-- generate_student_schedule() sautait le premier mois : avec une rentree en
-- septembre, les mensualites couraient d'octobre a juillet. Un eleve inscrit
-- le 7 septembre n'etait donc facture qu'a partir d'octobre.
--
-- Nouvelle regle : mensualites du mois de debut au mois de fin inclus
-- (septembre -> juin). Le nombre d'echeances reste identique, la sequence
-- est simplement avancee d'un mois.
--
-- Effet sur l'existant : aucune ligne n'est supprimee ni modifiee. Dans la
-- grille des tarifs, une colonne apparait au debut (a renseigner) et la
-- derniere colonne de l'ancienne sequence n'est plus proposee. Les
-- echeances deja generees ne sont pas retouchees.
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
  v_mensualite_start int;
  v_mensualite_end int;
  v_month_count int;
  v_fee public.fee_structures%rowtype;
  v_mensualite public.fee_structures%rowtype;
  i int;
  v_month int;
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

  -- Les mensualites couvrent toute l'annee scolaire, du mois de debut au
  -- mois de fin inclus. Elles demarraient au mois SUIVANT le mois de debut,
  -- ce qui decalait tout d'un cran : un eleve inscrit le 7 septembre dans
  -- une ecole qui rentre en septembre voyait sa premiere mensualite tomber
  -- en octobre. L'inscription est un frais distinct, elle ne remplace pas
  -- la mensualite du premier mois.
  v_mensualite_start := v_school_start_month;
  v_mensualite_end := v_school_end_month;
  v_month_count := ((v_mensualite_end - v_mensualite_start + 12) % 12) + 1;

  for i in 0..(v_month_count - 1) loop
    v_month := ((v_mensualite_start - 1 + i) % 12) + 1;
    if v_month >= v_school_start_month then
      v_due_date := make_date(v_calendar_year, v_month, 5);
    else
      v_due_date := make_date(v_calendar_year + 1, v_month, 5);
    end if;

    select * into v_mensualite
    from public.fee_structures
    where school_id = v_school_id and class_id = v_class_id and regime = v_regime
      and academic_year = v_year and fee_type = 'mensualite' and month = v_month
    limit 1;

    if found then
      insert into public.payment_schedules (school_id, student_id, fee_structure_id, due_date, amount_due)
      values (v_school_id, p_student_id, v_mensualite.id, v_due_date, v_mensualite.amount)
      on conflict (student_id, fee_structure_id, due_date) do nothing;

      select id into v_schedule_id
      from public.payment_schedules
      where student_id = p_student_id and fee_structure_id = v_mensualite.id and due_date = v_due_date;

      if v_schedule_id is not null then
        perform public.recalc_schedule_discount(v_schedule_id);
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.generate_student_schedule(uuid, text) from public, anon, authenticated;
