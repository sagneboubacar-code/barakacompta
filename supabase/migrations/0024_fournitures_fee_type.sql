-- =========================================================================
-- Nouveau type de frais "fournitures" : certaines écoles facturent les
-- fournitures scolaires en plus de l'inscription. Traité comme
-- uniforme/tenue_sport/autre — dû par tous les élèves de la classe dès
-- qu'un tarif existe (contrairement à cantine/transport qui dépendent d'un
-- abonnement par élève), donc aucune modification de
-- generate_student_schedule() n'est nécessaire.
-- =========================================================================

alter table public.fee_structures drop constraint if exists fee_structures_fee_type_check;
alter table public.fee_structures
  add constraint fee_structures_fee_type_check
  check (fee_type in (
    'inscription', 'uniforme', 'tenue_sport', 'fournitures', 'mensualite',
    'cantine', 'internat', 'transport', 'transport_zone_1',
    'transport_zone_2', 'transport_zone_3', 'autre'
  ));
