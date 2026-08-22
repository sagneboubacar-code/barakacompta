import type { UserRole } from "@/types";
import type { GatedModule } from "@/lib/constants/plans";

// Source unique de vérité pour le gating par rôle, consommée à la fois par
// le middleware (edge) et par la navigation du dashboard (server component).
// Les préfixes les plus longs doivent être testés en premier par l'appelant.
// `moduleKey` : module avancé soumis au plan d'abonnement (voir constants/plans.ts) ;
// absent = module "cœur" toujours disponible quel que soit le plan.
export const NAV_ITEMS: { href: string; label: string; roles: UserRole[]; moduleKey?: GatedModule }[] = [
  { href: "/dashboard", label: "Tableau de bord", roles: ["owner", "admin", "accountant"] },
  { href: "/dashboard/students", label: "Élèves", roles: ["owner", "admin"] },
  { href: "/dashboard/fee-structures", label: "Tarifs", roles: ["owner", "admin"] },
  { href: "/dashboard/collections", label: "Recouvrement", roles: ["owner", "admin"], moduleKey: "collections" },
  { href: "/dashboard/reports", label: "Rapports", roles: ["owner", "admin"], moduleKey: "reports" },
  { href: "/dashboard/payments", label: "Paiements", roles: ["owner", "admin", "accountant"] },
  { href: "/dashboard/expenses", label: "Dépenses", roles: ["owner", "admin", "accountant"] },
  { href: "/dashboard/transfers", label: "Transferts", roles: ["owner", "admin", "accountant"] },
  { href: "/dashboard/billing", label: "Abonnement", roles: ["owner", "admin", "accountant"] },
  { href: "/dashboard/settings", label: "Paramètres", roles: ["owner"] },
];

export function findRouteRule(pathname: string) {
  return [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
