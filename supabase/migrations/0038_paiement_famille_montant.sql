-- =========================================================================
-- Paiement famille : le parent peut verser une AVANCE.
--
-- 0037 soldait chaque ligne cochee. Retour du terrain : souvent le parent
-- donne une partie seulement ("une avance"). L'ecole saisit donc le montant
-- verse, reparti ligne par ligne dans l'ecran ; chaque ligne recoit un
-- montant entre 0 et son reste a payer.
--
-- Nouvelle signature (p_amounts, aligne sur p_schedule_ids). L'ancienne est
-- conservee telle quelle : la version de l'application deja en ligne
-- continue de fonctionner jusqu'au deploiement suivant.
-- =========================================================================

create or replace function public.record_family_payment(
  p_family_id uuid,
  p_schedule_ids uuid[],
  p_amounts numeric[],
  p_paid_at timestamptz,
  p_payment_method text,
  p_reference text default null,
  p_notes text default null,
  p_cash_manager_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family public.families%rowtype;
  v_family_payment_id uuid;
  v_total numeric(12, 2) := 0;
  v_line record;
begin
  select * into v_family from public.families where id = p_family_id;

  if not found or not (
    public.is_super_admin()
    or (v_family.school_id = public.current_school_id()
        and public.has_role(array['owner', 'admin', 'accountant']))
  ) then
    raise exception 'not authorized';
  end if;

  if p_payment_method is null or p_payment_method not in ('cash', 'wave', 'orange_money', 'bank_transfer') then
    raise exception 'mode de paiement invalide';
  end if;

  if p_cash_manager_id is not null and not exists (
    select 1 from public.cash_managers where id = p_cash_manager_id and school_id = v_family.school_id
  ) then
    raise exception 'responsable introuvable';
  end if;

  -- Une ligne = une echeance et un montant ; une echeance ne peut pas
  -- apparaitre deux fois (elle serait payee deux fois sur le meme reste).
  if coalesce(array_length(p_schedule_ids, 1), 0) = 0
     or array_length(p_schedule_ids, 1) is distinct from array_length(p_amounts, 1)
     or (select count(distinct x) from unnest(p_schedule_ids) as x) <> array_length(p_schedule_ids, 1) then
    raise exception 'lignes de paiement invalides';
  end if;

  if exists (select 1 from unnest(p_amounts) as a where a is null or a < 0) then
    raise exception 'montant invalide';
  end if;

  insert into public.family_payments (
    school_id, family_id, family_name, payment_method, paid_at, reference, notes, received_by, cash_manager_id
  )
  values (
    v_family.school_id, v_family.id, v_family.name, p_payment_method, coalesce(p_paid_at, now()),
    nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), auth.uid(), p_cash_manager_id
  )
  returning id into v_family_payment_id;

  -- Les montants sont controles contre le reste a payer relu en base : on
  -- refuse plutot que de tronquer, pour que le recu dise exactement ce que
  -- le parent a verse.
  for v_line in
    select ps.id, ps.student_id, ps.amount_remaining, ps.status, u.amount
    from unnest(p_schedule_ids, p_amounts) as u (schedule_id, amount)
    join public.payment_schedules ps on ps.id = u.schedule_id
    join public.students s on s.id = ps.student_id
    where s.family_id = v_family.id
      and u.amount > 0
    order by s.last_name, s.first_name, ps.due_date
  loop
    if v_line.status not in ('pending', 'partial', 'overdue') or v_line.amount > v_line.amount_remaining then
      raise exception 'un montant dépasse le reste à payer (échéance réglée entre-temps ?) : rechargez la page';
    end if;

    insert into public.payments (
      school_id, student_id, payment_schedule_id, amount, payment_method, reference, paid_at,
      received_by, cash_manager_id, notes, family_payment_id
    )
    values (
      v_family.school_id, v_line.student_id, v_line.id, v_line.amount, p_payment_method,
      nullif(trim(p_reference), ''), coalesce(p_paid_at, now()), auth.uid(), p_cash_manager_id,
      nullif(trim(p_notes), ''), v_family_payment_id
    );
    v_total := v_total + v_line.amount;
  end loop;

  if v_total <= 0 then
    raise exception 'rien à encaisser : saisissez un montant';
  end if;

  update public.family_payments set total = v_total where id = v_family_payment_id;

  return v_family_payment_id;
end;
$$;

revoke all on function public.record_family_payment(uuid, uuid[], numeric[], timestamptz, text, text, text, uuid) from public, anon;
grant execute on function public.record_family_payment(uuid, uuid[], numeric[], timestamptz, text, text, text, uuid) to authenticated;
