import type { FeeRegime, FeeType } from "@/types";
import type { Language } from "@/lib/i18n/config";
import { MONTH_NAMES, monthNames } from "@/lib/constants/months";

export const REGIMES: { key: FeeRegime; label: string }[] = [
  { key: "externat", label: "Externat" },
  { key: "internat", label: "Internat" },
];

const REGIME_LABELS_AR: Record<string, string> = {
  externat: "خارجي",
  internat: "داخلي",
};

export const FEE_TYPES: { key: FeeType; label: string }[] = [
  { key: "inscription", label: "Inscription" },
  { key: "uniforme", label: "Uniforme" },
  { key: "mensualite", label: "Mensualité" },
  { key: "cantine", label: "Cantine" },
  { key: "internat", label: "Internat" },
  { key: "transport", label: "Transport" },
  { key: "autre", label: "Autre" },
];

const FEE_TYPE_LABELS_AR: Record<string, string> = {
  inscription: "التسجيل",
  uniforme: "الزي الموحد",
  mensualite: "الشهرية",
  cantine: "المطعم",
  internat: "الداخلي",
  transport: "النقل",
  autre: "أخرى",
};

// Les mois de mensualité courent du mois SUIVANT le "mois de début" de
// l'année scolaire jusqu'au mois suivant son "mois de fin" (le premier mois
// de l'année scolaire est réservé à l'inscription, pas à une mensualité) —
// même règle que generate_student_schedule() côté SQL. Ex. début=septembre,
// fin=juin → mensualités d'octobre à juillet.
export function mensualiteMonthsForSchoolYear(
  startMonth: number,
  endMonth: number,
  language: Language = "fr"
): { month: number; label: string }[] {
  const names = monthNames(language);
  const first = (startMonth % 12) + 1;
  const last = (endMonth % 12) + 1;
  const months: { month: number; label: string }[] = [];
  let m = first;
  for (let i = 0; i < 12; i++) {
    months.push({ month: m, label: names[m - 1] });
    if (m === last) break;
    m = (m % 12) + 1;
  }
  return months;
}

// Par défaut (début=septembre, fin=juin) — utilisé uniquement quand l'école
// n'est pas disponible dans le contexte courant.
export const MENSUALITE_MONTHS: { month: number; label: string }[] = mensualiteMonthsForSchoolYear(9, 6);

// Types de frais gérés hors du tableau principal (Inscription/Uniforme/
// Mensualités), via le formulaire ligne à ligne existant.
export const OTHER_FEE_TYPES: { key: FeeType; label: string }[] = FEE_TYPES.filter(
  (f) => f.key !== "inscription" && f.key !== "uniforme" && f.key !== "mensualite"
);

export function feeTypeLabel(key: string, language: Language = "fr"): string {
  if (language === "ar") return FEE_TYPE_LABELS_AR[key] ?? key;
  return FEE_TYPES.find((f) => f.key === key)?.label ?? key;
}

export function regimeLabel(key: string, language: Language = "fr"): string {
  if (language === "ar") return REGIME_LABELS_AR[key] ?? key;
  return REGIMES.find((r) => r.key === key)?.label ?? key;
}

export function mensualiteMonthLabel(month: number, language: Language = "fr"): string {
  return monthNames(language)[month - 1] ?? String(month);
}
