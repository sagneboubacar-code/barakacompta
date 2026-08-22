-- =========================================================================
-- Ajoute le lieu de naissance, nécessaire pour les registres/listes de
-- classe imprimables (prénom, nom, date et lieu de naissance, tuteur).
-- =========================================================================

alter table public.students add column if not exists place_of_birth text;
