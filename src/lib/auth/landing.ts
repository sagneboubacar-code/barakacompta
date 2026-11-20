// Où atterrit un utilisateur juste après s'être connecté — règle unique,
// partagée par le middleware, le retour OAuth et l'action de connexion,
// pour qu'aucun des trois ne puisse diverger.
//
// Le staff Baraka (super_admin) n'a d'ordinaire pas d'école : sans ce test il
// tombait sur /onboarding à chaque connexion, comme si on lui demandait de
// créer une école pour utiliser sa propre console. Un super_admin qui est
// AUSSI propriétaire d'une école (ex. Boubacar avec Houdallah) atterrit
// d'abord sur son tableau de bord d'école, comme avant d'avoir ce rôle ; la
// console /admin reste à un clic, dans le menu.
export function landingPath(user: { role?: string | null; school_id?: string | null } | null): string {
  if (user?.school_id) return "/dashboard";
  if (user?.role === "super_admin") return "/admin";
  return "/onboarding";
}
