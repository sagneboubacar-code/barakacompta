import type { SchoolClassCycle } from "@/types";
import type { Language } from "@/lib/i18n/config";

export const CYCLES: { key: SchoolClassCycle; label: string }[] = [
  { key: "prescolaire", label: "Préscolaire" },
  { key: "elementaire", label: "Élémentaire" },
  { key: "college", label: "Collège" },
  { key: "lycee", label: "Lycée" },
];

const CYCLE_LABELS_AR: Record<string, string> = {
  prescolaire: "التحضيري",
  elementaire: "الابتدائي",
  college: "المتوسط",
  lycee: "الثانوي",
};

export function cycleLabel(key: string | null, language: Language = "fr"): string {
  if (key === null) return "—";
  if (language === "ar") return CYCLE_LABELS_AR[key] ?? "—";
  return CYCLES.find((c) => c.key === key)?.label ?? "—";
}

// Postgres trie "level" par ordre alphabétique (collège avant élémentaire,
// préscolaire en dernier) : ce tri re-classe les résultats dans l'ordre
// pédagogique préscolaire → élémentaire → collège → lycée avant affichage.
export function sortByCycle<T extends { level: string | null; sort_order?: number | null }>(
  items: T[]
): T[] {
  const order = new Map(CYCLES.map((c, i) => [c.key as string, i]));
  return [...items].sort((a, b) => {
    const ai = a.level !== null && order.has(a.level) ? order.get(a.level)! : CYCLES.length;
    const bi = b.level !== null && order.has(b.level) ? order.get(b.level)! : CYCLES.length;
    if (ai !== bi) return ai - bi;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}
