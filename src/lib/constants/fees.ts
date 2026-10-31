import type { FeeRegime, FeeType } from "@/types";
import type { Language } from "@/lib/i18n/config";
import { monthNames } from "@/lib/constants/months";

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
  { key: "tenue_sport", label: "Tenue de sport" },
  { key: "fournitures", label: "Fournitures" },
  { key: "cantine", label: "Cantine" },
  { key: "internat", label: "Internat" },
  { key: "transport", label: "Transport (tarif unique)" },
  { key: "transport_zone_1", label: "Transport zone 1" },
  { key: "transport_zone_2", label: "Transport zone 2" },
  { key: "transport_zone_3", label: "Transport zone 3" },
  { key: "renforcement", label: "Cours de renforcement" },
  { key: "autre", label: "Autre" },
];

const FEE_TYPE_LABELS_AR: Record<string, string> = {
  inscription: "التسجيل",
  uniforme: "الزي الموحد",
  mensualite: "الشهرية",
  tenue_sport: "الزي الرياضي",
  fournitures: "اللوازم المدرسية",
  cantine: "المطعم",
  internat: "الداخلي",
  transport: "النقل (تعريفة موحدة)",
  transport_zone_1: "النقل المنطقة 1",
  transport_zone_2: "النقل المنطقة 2",
  transport_zone_3: "النقل المنطقة 3",
  renforcement: "دروس الدعم",
  autre: "أخرى",
};

// Grille des tarifs : tous les mois de mensualité possibles de l'année
// scolaire, du "mois de début" (la rentrée) jusqu'au mois suivant le "mois
// de fin". Ex. début=septembre, fin=juin → septembre à juillet.
//
// Seuls les mois remplis sont facturés (0032) : chaque mois tarifé donne une
// échéance le 5 du mois suivant, si l'élève était là ce mois-là. Le premier
// mois est donc facultatif : la plupart des classes commencent les cours le
// mois suivant et le laissent vide ; une classe qui commence dès la rentrée
// (ex. 3e, CM1, CM2, Coran spécial) y met un montant.
//
// C'est bien la liste des mois *facturables par l'école*, pas celle d'un
// élève donné : un élève inscrit en cours d'année n'est facturé qu'à partir
// de son mois d'arrivée, filtrage fait par generate_student_schedule() côté
// SQL à partir de sa date d'inscription.
export function mensualiteMonthsForSchoolYear(
  startMonth: number,
  endMonth: number,
  language: Language = "fr"
): { month: number; label: string }[] {
  const names = monthNames(language);
  const last = (endMonth % 12) + 1;
  const months: { month: number; label: string }[] = [];
  let m = startMonth;
  for (let i = 0; i < 12; i++) {
    months.push({ month: m, label: names[m - 1] });
    // i > 0 : quand le mois suivant la fin retombe sur la rentrée, l'année
    // compte 12 mois pleins.
    if (m === last && i > 0) break;
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
