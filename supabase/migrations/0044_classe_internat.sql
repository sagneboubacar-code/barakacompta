-- =========================================================================
-- Classe rattachee a l'internat.
--
-- Retour d'une ecole cliente (27 octobre 2026) : une classe « Coran
-- special » depend de l'internat. Tout ce que ses eleves paient
-- (inscription, mensualites...) revient a l'internat, comme les frais
-- d'internat eux-memes.
--
-- Une case sur la classe (Parametres -> Classes). Le bilan de l'internat
-- compte alors les paiements de la classe dans ses recettes, ses eleves
-- parmi les internes et leurs retards dans le reste a payer. Rien ne change
-- pour l'echeancier ni pour les totaux de l'ecole.
--
-- ABANDONNE le meme jour : la classe « Coran special » est une classe comme
-- les autres, ou chaque eleve est interne OU externe (regime de l'eleve) ;
-- seuls les internes relevent de l'internat, via le frais « Internat » de
-- la grille Internat. Le code ne lit plus classes.internat ; la colonne est
-- supprimee par 0046_supprimer_classe_internat.sql.
-- =========================================================================

alter table public.classes
  add column if not exists internat boolean not null default false;
