-- L'essai gratuit n'a plus de limite de durée : la restriction utile est
-- désormais uniquement le plafond d'élèves (30) du plan trial, pas une
-- date d'expiration. On repousse très loin la valeur par défaut pour les
-- nouvelles écoles plutôt que de rendre la colonne nullable (plus simple,
-- aucune logique de comparaison de date à changer ailleurs dans l'app).
alter table public.schools
  alter column subscription_expires_at set default (current_date + (365 * 100));

-- Les écoles déjà en essai gratuit ne doivent pas expirer non plus.
update public.schools
set subscription_expires_at = current_date + (365 * 100)
where plan = 'trial' and subscription_status = 'active';
