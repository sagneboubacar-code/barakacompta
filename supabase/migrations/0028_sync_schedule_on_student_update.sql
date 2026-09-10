-- =========================================================================
-- L'echeancier d'un eleve se resynchronise quand sa fiche change.
--
-- Jusqu'ici il n'existait qu'un trigger "after insert" : l'echeancier etait
-- construit une seule fois, a la creation de l'eleve. Consequences vues en
-- production :
--
--   * eleve cree sans classe, classe renseignee 3 minutes plus tard :
--     generate_student_schedule() s'etait deja arretee faute de classe, et
--     plus rien ne repassait derriere. L'eleve restait sans aucune echeance,
--     donc affiche "a jour" avec 0 F du.
--   * cantine / transport / renforcement coches apres coup sur un eleve
--     existant : jamais factures.
--   * changement de classe en cours d'annee : l'eleve gardait la grille
--     tarifaire de son ancienne classe.
--
-- Ce trigger "after update" rejoue la generation des que l'un des champs qui
-- determinent l'echeancier change, et retire au passage les echeances
-- devenues sans objet.
--
-- Deux garde-fous sur les suppressions :
--   * jamais une echeance sur laquelle un franc a ete encaisse ;
--   * jamais une echeance annulee (status 'cancelled'), qui serait alors
--     recreee active par la generation juste apres.
-- =========================================================================

create or replace function public.trg_students_sync_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transport_fee_type text;
begin
  -- Aucun champ structurant modifie (simple correction de telephone ou
  -- d'adresse) : on ne touche pas a l'echeancier.
  if new.class_id is not distinct from old.class_id
     and new.regime is not distinct from old.regime
     and new.subscribes_cantine is not distinct from old.subscribes_cantine
     and new.subscribes_transport is not distinct from old.subscribes_transport
     and new.transport_zone is not distinct from old.transport_zone
     and new.subscribes_renforcement is not distinct from old.subscribes_renforcement
  then
    return new;
  end if;

  -- Classe ou regime differents : la grille tarifaire appliquee n'est plus
  -- la bonne, on retire les echeances issues de l'ancienne grille.
  if new.class_id is distinct from old.class_id or new.regime is distinct from old.regime then
    delete from public.payment_schedules ps
    using public.fee_structures f
    where ps.student_id = new.id
      and f.id = ps.fee_structure_id
      and coalesce(ps.amount_paid, 0) = 0
      and ps.status <> 'cancelled'
      and (f.class_id is distinct from new.class_id or f.regime is distinct from new.regime);
  end if;

  -- Le seul tarif de transport applicable a cet eleve : sa zone, ou le
  -- tarif unique s'il n'en a pas.
  v_transport_fee_type := case
    when new.transport_zone is null then 'transport'
    else 'transport_zone_' || new.transport_zone::text
  end;

  -- Services optionnels auxquels l'eleve n'est plus abonne (ou zone de
  -- transport changee) : on retire les echeances correspondantes.
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

drop trigger if exists trg_after_student_update_schedule on public.students;
create trigger trg_after_student_update_schedule
  after update on public.students
  for each row execute function public.trg_students_sync_schedule();

revoke all on function public.trg_students_sync_schedule() from public, anon, authenticated;
