-- =========================================================================
-- Modifier ou annuler un paiement famille.
--
-- Un paiement famille (0037/0038) = un recu (family_payments) + une ligne de
-- paiement par echeance reglee (payments.family_payment_id). family_payments
-- est en lecture seule pour l'app : ces deux fonctions sont le seul moyen de
-- le corriger, en une seule transaction (tout ou rien).
--
--   * update_family_payment : date, mode de paiement, responsable, reference
--     et note du recu, recopies sur chacune de ses lignes ; montant de chaque
--     ligne (0 = la ligne est retiree). Un montant change est reparti a
--     nouveau sur les echeances par le trigger de 0007.
--   * delete_family_payment : supprime le recu et toutes ses lignes ; les
--     echeances qu'elles reglaient redeviennent dues.
--
-- Reserve au proprietaire et a l'admin, comme la modification d'un paiement
-- d'eleve : revenir sur une recette encaissee releve de la direction.
-- =========================================================================

create or replace function public.update_family_payment(
  p_family_payment_id uuid,
  p_paid_at timestamptz,
  p_payment_method text,
  p_reference text,
  p_notes text,
  p_cash_manager_id uuid,
  p_payment_ids uuid[],
  p_amounts numeric[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.family_payments%rowtype;
begin
  select * into v_receipt from public.family_payments where id = p_family_payment_id;

  if not found or not (
    public.is_super_admin()
    or (v_receipt.school_id = public.current_school_id() and public.has_role(array['owner', 'admin']))
  ) then
    raise exception 'not authorized';
  end if;

  if p_paid_at is null then
    raise exception 'date invalide';
  end if;

  if p_payment_method is null or p_payment_method not in ('cash', 'wave', 'orange_money', 'bank_transfer') then
    raise exception 'mode de paiement invalide';
  end if;

  if p_cash_manager_id is not null and not exists (
    select 1 from public.cash_managers where id = p_cash_manager_id and school_id = v_receipt.school_id
  ) then
    raise exception 'responsable introuvable';
  end if;

  -- Une ligne = un paiement de CE recu et son nouveau montant.
  if coalesce(array_length(p_payment_ids, 1), 0) = 0
     or array_length(p_payment_ids, 1) is distinct from array_length(p_amounts, 1)
     or (select count(distinct x) from unnest(p_payment_ids) as x) <> array_length(p_payment_ids, 1) then
    raise exception 'lignes de paiement invalides';
  end if;

  if exists (select 1 from unnest(p_amounts) as a where a is null or a < 0) then
    raise exception 'montant invalide';
  end if;

  if exists (
    select 1 from unnest(p_payment_ids) as x
    where not exists (
      select 1 from public.payments p where p.id = x and p.family_payment_id = p_family_payment_id
    )
  ) then
    raise exception 'ligne introuvable dans ce paiement famille';
  end if;

  if not exists (
    select 1
    from public.payments p
    left join unnest(p_payment_ids, p_amounts) as u (payment_id, amount) on u.payment_id = p.id
    where p.family_payment_id = p_family_payment_id
      and coalesce(u.amount, p.amount) > 0
  ) then
    raise exception 'tous les montants sont a 0 : pour tout annuler, supprimez le paiement famille';
  end if;

  update public.family_payments
  set paid_at = p_paid_at,
      payment_method = p_payment_method,
      reference = nullif(trim(p_reference), ''),
      notes = nullif(trim(p_notes), ''),
      cash_manager_id = p_cash_manager_id
  where id = p_family_payment_id;

  -- Meme recu, memes date et mode de paiement : les rapports (qui lisent les
  -- lignes) suivent la correction.
  update public.payments
  set paid_at = p_paid_at,
      payment_method = p_payment_method,
      reference = nullif(trim(p_reference), ''),
      cash_manager_id = p_cash_manager_id
  where family_payment_id = p_family_payment_id;

  -- Lignes retirees d'abord, puis montants baisses, puis montants augmentes :
  -- une hausse peut alors reprendre ce qu'une baisse vient de liberer.
  delete from public.payments p
  using unnest(p_payment_ids, p_amounts) as u (payment_id, amount)
  where p.id = u.payment_id and p.family_payment_id = p_family_payment_id and u.amount = 0;

  update public.payments p
  set amount = u.amount
  from unnest(p_payment_ids, p_amounts) as u (payment_id, amount)
  where p.id = u.payment_id and p.family_payment_id = p_family_payment_id
    and u.amount > 0 and u.amount < p.amount;

  update public.payments p
  set amount = u.amount
  from unnest(p_payment_ids, p_amounts) as u (payment_id, amount)
  where p.id = u.payment_id and p.family_payment_id = p_family_payment_id
    and u.amount > p.amount;

  update public.family_payments
  set total = (select coalesce(sum(amount), 0) from public.payments where family_payment_id = p_family_payment_id)
  where id = p_family_payment_id;
end;
$$;

revoke all on function public.update_family_payment(uuid, timestamptz, text, text, text, uuid, uuid[], numeric[]) from public, anon;
grant execute on function public.update_family_payment(uuid, timestamptz, text, text, text, uuid, uuid[], numeric[]) to authenticated;

create or replace function public.delete_family_payment(p_family_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.family_payments%rowtype;
begin
  select * into v_receipt from public.family_payments where id = p_family_payment_id;

  if not found or not (
    public.is_super_admin()
    or (v_receipt.school_id = public.current_school_id() and public.has_role(array['owner', 'admin']))
  ) then
    raise exception 'not authorized';
  end if;

  -- Les repartitions partent avec les lignes (ON DELETE CASCADE) et le
  -- trigger de 0007 remet les echeances a jour.
  delete from public.payments where family_payment_id = p_family_payment_id;
  delete from public.family_payments where id = p_family_payment_id;
end;
$$;

revoke all on function public.delete_family_payment(uuid) from public, anon;
grant execute on function public.delete_family_payment(uuid) to authenticated;

-- Controle : les deux lignes doivent afficher true.
select 'update_family_payment' as fonction,
       to_regprocedure('public.update_family_payment(uuid, timestamptz, text, text, text, uuid, uuid[], numeric[])') is not null as installee
union all
select 'delete_family_payment',
       to_regprocedure('public.delete_family_payment(uuid)') is not null;
