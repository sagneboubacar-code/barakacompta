-- =========================================================================
-- Suppression de la case « Rattachee a l'internat » des classes (0044).
--
-- La classe « Coran special » est une classe comme les autres, avec son
-- tarif ; chaque eleve y est interne ou externe (regime de l'eleve). Le
-- code ne lit plus classes.internat depuis le 27 octobre 2026 : la colonne
-- disparait.
-- =========================================================================

alter table public.classes drop column if exists internat;
