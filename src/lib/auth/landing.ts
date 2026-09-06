// Où atterrit un utilisateur juste après s'être connecté — règle unique,
// partagée par le middleware, le retour OAuth et l'action de connexion,
// pour qu'aucun des trois ne puisse diverger.
//
// Le staff Baraka (super_admin) n'a volontairement pas d'école : sans ce
// test il tombait sur /onboarding à chaque connexion, comme si on lui
// demandait de créer une école pour utiliser sa propre console.
export function landingPath(user: { role?: string | null; school_id?: string | null } | null): string {
  if (user?.role === "super_admin") return "/admin";
  return user?.school_id ? "/dashboard" : "/onboarding";
}
