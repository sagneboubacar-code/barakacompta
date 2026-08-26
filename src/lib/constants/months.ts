import type { Language } from "@/lib/i18n/config";

export const MONTH_NAMES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const MONTH_NAMES_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function monthNames(language: Language = "fr"): string[] {
  return language === "ar" ? MONTH_NAMES_AR : MONTH_NAMES;
}

// monthKey au format "YYYY-MM"
export function formatMonthLabel(monthKey: string, language: Language = "fr"): string {
  const [year, month] = monthKey.split("-").map(Number);
  const name = monthNames(language)[(month ?? 1) - 1] ?? monthKey;
  return `${name} ${year}`;
}
