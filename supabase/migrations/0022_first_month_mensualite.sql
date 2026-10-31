-- =========================================================================
-- Mensualité du premier mois de l'année scolaire, pour les classes qui
-- commencent les cours dès ce mois-là.
--
-- Jusqu'ici, le premier mois de l'année scolaire (septembre par défaut)
-- était toujours réservé à l'inscription : les mensualités commençaient le
-- mois suivant pour TOUTES les classes. Or certaines classes (ex. Coran
-- spécial) commencent les cours en septembre : un élève inscrit début
-- septembre doit septembre ET octobre, mais son échéancier ne comptait
-- qu'octobre — d'où un seul mois en retard au lieu de deux.
--
-- Désormais, le tableau des tarifs propose aussi une mensualité pour le
-- premier mois. Elle est facultative : une classe qui la laisse vide garde
-- exactement le comportement actuel ; une classe qui y saisit un montant
-- voit ce mois ajouté à l'échéancier de ses élèves (dû le 5 du mois).
--
-- Rien d'autre ne change : mêmes frais ponctuels, mêmes dates d'échéance,
-- mêmes remises. La fonction reste idempotente (ON CONFLICT DO NOTHING) :
-- la rejouer sur un élève existant ajoute seulement les mois manquants.
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
  select school_id, class_id, regime, enrolled_at, subscribes_cantine, subscribes_transport
    into v_school_id, v_class_id, v_regime, v_enrolled_at, v_subscribes_cantine, v_subscribes_transport
  from public.students
  where id = p_student_id;

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

  -- Frais à échéance unique : inscription/uniforme/autre sont dus par tous
  -- les élèves de la classe dès qu'un tarif existe ; cantine/transport ne le
  -- sont que pour les élèves abonnés à ce service.
  for v_fee in
    select * from public.fee_structures
    where school_id = v_school_id and class_id = v_class_id and regime = v_regime
      and academic_year = v_year and fee_type <> 'mensualite' and month = 0
      and (fee_type <> 'cantine' or v_subscribes_cantine)
      and (fee_type <> 'transport' or v_subscribes_transport)
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

  -- Mensualités possibles : du mois de DÉBUT de l'année scolaire au mois
  -- suivant sa fin (ex. début=septembre, fin=juin → septembre à juillet).
  -- Une échéance n'est créée que si la classe a un tarif pour ce mois : les
  -- classes qui commencent les cours le mois suivant laissent le premier
  -- mois sans tarif, il reste réservé à l'inscription (comportement
  -- inchangé pour elles).
  v_mensualite_start := v_school_start_month;
  v_mensualite_end := (v_school_end_month % 12) + 1;
  v_month_count := ((v_mensualite_end - v_mensualite_start + 12) % 12) + 1;
  if v_mensualite_end = v_mensualite_start then
    v_month_count := 12; -- année scolaire de 12 mois pleins
  end if;

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
