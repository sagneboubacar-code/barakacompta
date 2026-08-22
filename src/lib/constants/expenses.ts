import type { ExpenseCategory } from "@/types";

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

export function expenseCategoryLabel(key: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
