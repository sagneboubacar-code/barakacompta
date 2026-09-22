-- =========================================================================
-- Periode de lancement : Baraka Compta est gratuit, toutes fonctionnalites
-- comprises, jusqu'au 10 decembre 2026 inclus.
--
-- Deux volets, qui doivent aller ensemble :
--   * les FONCTIONS sont ouvertes cote code (FREE_ACCESS_UNTIL dans
--     src/lib/constants/plans.ts) : Recouvrement, Rapports, eleves illimites ;
--   * l'ACCES est garanti ici : aucune ecole ne doit expirer avant la fin de
--     la periode, sinon elle serait bloquee malgre la gratuite.
-- =========================================================================

-- Ecoles existantes : celles qui expirent avant le 10 decembre y sont
-- repoussees. Idempotent : rejouer ce script ne change rien de plus. Les
-- plans ne sont pas touches -- une ecole Pro reste Pro, un essai reste essai.
update public.schools
set subscription_expires_at = date '2026-12-10'
where subscription_expires_at < date '2026-12-10';

-- Nouvelles inscriptions : au moins jusqu'au 10 decembre. `greatest` rend la
-- regle permanente sans intervention : passe cette date, current_date + 14
-- l'emporte toujours, et l'essai redevient de 14 jours tout seul.
alter table public.schools
  alter column subscription_expires_at
  set default greatest(current_date + 14, date '2026-12-10');
