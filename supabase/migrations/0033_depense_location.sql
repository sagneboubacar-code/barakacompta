-- Nouvelle categorie de depense : "location" (loyer des locaux).
-- Deuxieme poste fixe d'une ecole apres les salaires ; jusqu'ici il finissait
-- dans "autres", ce qui le rendait invisible dans les rapports.
alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses
  add constraint expenses_category_check
  check (category in (
    'salaires', 'location', 'fournitures', 'eau', 'electricite', 'internet',
    'cantine', 'transport', 'entretien', 'autres'
  ));
