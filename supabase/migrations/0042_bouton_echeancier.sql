-- =========================================================================
-- Bouton « Générer / actualiser l'échéancier » de la fiche élève.
--
-- Le bouton appelle generate_student_schedule() avec la session de
-- l'utilisateur (supabase.rpc). Depuis 0025, chaque reprise de la fonction
-- se terminait par un « revoke ... from authenticated », copié du
-- durcissement de 0021 qui visait les fonctions de triggers : le bouton
-- échouait avec « permission denied for function generate_student_schedule ».
--
-- On rend le droit d'exécution aux utilisateurs connectés, comme en 0006 :
-- la fonction vérifie elle-même que l'élève appartient à l'école de
-- l'utilisateur, et n'ajoute que les lignes manquantes (on conflict do
-- nothing) sans toucher aux montants déjà payés.
--
-- Une future reprise de la fonction doit garder ce grant, et non le revoke.
-- =========================================================================

grant execute on function public.generate_student_schedule(uuid, text) to authenticated;
