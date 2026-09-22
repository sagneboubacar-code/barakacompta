import type { SubscriptionPlan } from "@/types";

// Modules avancés soumis au plan — les modules "cœur" (élèves, tarifs,
// paiements, dépenses, paramètres) restent toujours disponibles quel que
// soit le plan : une école ne doit jamais perdre l'accès à ses opérations
// courantes, y compris en essai gratuit ou en cas de rétrogradation.
export type GatedModule = "collections" | "reports";

export interface PlanDefinition {
  key: SubscriptionPlan;
  label: string;
  priceXOF: number | null; // null = essai gratuit, pas de tarif
  maxStudents: number | null; // null = illimité
  modules: GatedModule[];
  trialDays?: number;
}

export const PLANS: PlanDefinition[] = [
  {
    key: "trial",
    label: "Essai gratuit",
    priceXOF: 0,
    maxStudents: 30,
    modules: [],
    trialDays: 14,
  },
  {
    key: "basic",
    label: "Basic",
    priceXOF: 15000,
    maxStudents: 150,
    modules: ["collections", "reports"],
  },
  {
    key: "pro",
    label: "Pro",
    priceXOF: 25000,
    maxStudents: null,
    modules: ["collections", "reports"],
  },
];

export function getPlan(key: string): PlanDefinition {
  return PLANS.find((p) => p.key === key) ?? PLANS[0];
}

// Période de lancement : jusqu'à cette date incluse, toutes les écoles ont
// accès à tout — Recouvrement, Rapports, élèves illimités — quel que soit
// leur plan. Le but est qu'elles jugent le vrai logiciel, pas une version
// amputée de ce qui fait sa valeur.
//
// La restriction revient d'elle-même le lendemain : rien à désactiver à la
// main. Les dates d'abonnement ont été alignées sur cette même date
// (migration 0034), pour que l'accès et les fonctions s'arrêtent ensemble.
export const FREE_ACCESS_UNTIL = "2026-12-10";

export function isFreeAccessPeriod(today: string = new Date().toISOString().slice(0, 10)): boolean {
  return today <= FREE_ACCESS_UNTIL;
}

export function planIncludesModule(planKey: string, module: GatedModule): boolean {
  if (isFreeAccessPeriod()) return true;
  return getPlan(planKey).modules.includes(module);
}

// Plafond d'élèves réellement appliqué : aucun pendant la période de lancement.
export function effectiveMaxStudents(planKey: string): number | null {
  if (isFreeAccessPeriod()) return null;
  return getPlan(planKey).maxStudents;
}
