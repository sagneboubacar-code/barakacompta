import type { ExpenseCategory } from "@/types";
import type { Language } from "@/lib/i18n/config";

export const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: "salaires", label: "Salaires" },
  { key: "fournitures", label: "Fournitures" },
  { key: "eau", label: "Eau" },
  { key: "electricite", label: "Électricité" },
  { key: "internet", label: "Internet" },
  { key: "cantine", label: "Cantine" },
  { key: "transport", label: "Transport" },
  { key: "entretien", label: "Entretien" },
  { key: "autres", label: "Autres" },
];

const EXPENSE_CATEGORY_LABELS_AR: Record<string, string> = {
  salaires: "الرواتب",
  fournitures: "اللوازم",
  eau: "الماء",
  electricite: "الكهرباء",
  internet: "الإنترنت",
  cantine: "المطعم",
  transport: "النقل",
  entretien: "الصيانة",
  autres: "أخرى",
};

export function expenseCategoryLabel(key: string, language: Language = "fr"): string {
  if (language === "ar") return EXPENSE_CATEGORY_LABELS_AR[key] ?? key;
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
