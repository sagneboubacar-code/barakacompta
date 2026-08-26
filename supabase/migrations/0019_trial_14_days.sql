-- Rétablit la limite de 14 jours pour l'essai gratuit des NOUVELLES écoles
-- (retour sur la migration 0018_unlimited_trial.sql). Seule la valeur par
-- défaut de la colonne change : les écoles déjà en essai illimité gardent
-- leur subscription_expires_at actuelle, aucune ligne existante n'est
-- modifiée — décision explicite pour ne pas couper l'accès à des écoles
-- déjà inscrites.
alter table public.schools
  alter column subscription_expires_at set default (current_date + 14);
