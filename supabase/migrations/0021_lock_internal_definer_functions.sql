-- Durcissement : plusieurs fonctions SECURITY DEFINER internes (déclenchées
-- normalement uniquement par des triggers) n'avaient pas de restriction
-- d'exécution explicite. Par défaut Postgres accorde EXECUTE à PUBLIC sur
-- toute nouvelle fonction : sans ce retrait, n'importe quel utilisateur
-- connecté (peu importe son école) pouvait en théorie les appeler
-- directement via supabase.rpc(...) avec l'UUID d'une AUTRE école — ces
-- fonctions contournant volontairement le RLS (SECURITY DEFINER) et
-- n'ayant pas de vérification d'appartenance interne comme le fait déjà
-- generate_student_schedule().
--
-- L'app n'appelle jamais ces fonctions directement (vérifié : aucun
-- .rpc(...) dessus dans le code) — seuls les triggers les invoquent, et le
-- retrait d'EXECUTE ne bloque pas ce mécanisme (un trigger n'a pas besoin
-- du privilège EXECUTE de l'utilisateur déclencheur pour s'exécuter).

revoke all on function public.next_matricule(uuid, int, text) from public, anon, authenticated;
revoke all on function public.set_student_matricule() from public, anon, authenticated;

revoke all on function public.recalc_payment_schedule(uuid) from public, anon, authenticated;
revoke all on function public.trg_payments_recalc_schedule() from public, anon, authenticated;
revoke all on function public.trg_students_generate_schedule() from public, anon, authenticated;
revoke all on function public.trg_payment_allocations_recalc() from public, anon, authenticated;

revoke all on function public.allocate_payment(uuid) from public, anon, authenticated;
revoke all on function public.trg_payments_allocate() from public, anon, authenticated;
revoke all on function public.trg_payments_reallocate() from public, anon, authenticated;

revoke all on function public.recalc_schedule_discount(uuid) from public, anon, authenticated;
revoke all on function public.trg_discounts_recalc() from public, anon, authenticated;
