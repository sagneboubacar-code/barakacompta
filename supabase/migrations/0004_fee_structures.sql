-- =========================================================================
-- Module "Gestion des tarifs" : tarifs par classe + régime + type de frais,
-- versionnés par année scolaire (une ligne = un tarif figé pour une année
-- donnée ; les années passées ne sont jamais écrasées).
-- =========================================================================

alter table public.fee_structures
  add column if not exists regime text not null default 'externat'
    check (regime in ('externat', 'internat')),
  add column if not exists fee_type text not null default 'inscription'
    check (fee_type in ('inscription', 'mensualite', 'cantine', 'internat', 'transport', 'autre'));

alter table public.fee_structures alter column regime drop default;
alter table public.fee_structures alter column fee_type drop default;

-- Un tarif est toujours rattaché à une classe précise. On resserre la
-- contrainte (auparavant nullable) et on passe le ON DELETE à CASCADE :
-- supprimer une classe n'a plus de sens à conserver ses tarifs orphelins.
alter table public.fee_structures drop constraint if exists fee_structures_class_id_fkey;
alter table public.fee_structures alter column class_id set not null;
alter table public.fee_structures
  add constraint fee_structures_class_id_fkey
  foreign key (class_id) references public.classes (id) on delete cascade;

-- Clé naturelle d'un tarif : une seule ligne par (classe, régime, type de
-- frais, année scolaire). Permet un upsert propre depuis le tableau éditable
-- et empêche les doublons silencieux.
alter table public.fee_structures drop constraint if exists fee_structures_unique_tariff;
alter table public.fee_structures
  add constraint fee_structures_unique_tariff
  unique (school_id, class_id, regime, fee_type, academic_year);
