-- =========================================================================
-- Nouveau type de frais "tenue_sport" : certaines écoles facturent une tenue
-- de sport en plus de l'uniforme. Traité comme uniforme/autre — dû par tous
-- les élèves de la classe dès qu'un tarif existe (contrairement à
-- cantine/transport qui dépendent d'un abonnement par élève), donc aucune
-- modification de generate_student_schedule() n'est nécessaire.
-- =========================================================================

alter table public.fee_structures drop constraint if exists fee_structures_fee_type_check;
alter table public.fee_structures
  add constraint fee_structures_fee_type_check
  check (fee_type in (
    'inscription', 'uniforme', 'tenue_sport', 'mensualite',
    'cantine', 'internat', 'transport', 'autre'
  ));
