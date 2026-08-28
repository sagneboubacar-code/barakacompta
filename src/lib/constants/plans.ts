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

export function planIncludesModule(planKey: string, module: GatedModule): boolean {
  return getPlan(planKey).modules.includes(module);
}
