-- Ajoute "chariow" comme moyen de paiement valide pour les paiements
-- d'abonnement : une licence achetée sur Chariow (Wave/Orange Money/carte
-- gérés par Chariow) et échangée dans l'app active l'abonnement.
alter table public.subscription_payments
  drop constraint subscription_payments_payment_method_check;

alter table public.subscription_payments
  add constraint subscription_payments_payment_method_check
  check (payment_method in ('wave', 'orange_money', 'card', 'manual', 'chariow'));
