import { feeTypeLabel } from "@/lib/constants/fees";
import { formatMonthLabel, mensualiteMonthKey } from "@/lib/constants/months";
import type { Language } from "@/lib/i18n/config";

// Statut d'une échéance tel qu'il faut l'AFFICHER aujourd'hui.
//
// La colonne payment_schedules.status n'est recalculée que quand on touche à
// l'échéance (paiement, réduction...) : une mensualité due le 5 et jamais
// payée resterait « pending » (« À venir ») indéfiniment. Le retard se déduit
// donc de la date, comme le fait déjà le recouvrement.
export function effectiveScheduleStatus(
  schedule: { status: string; due_date: string; amount_remaining: number },
  today: string = new Date().toISOString().slice(0, 10)
): string {
  if (schedule.status === "pending" && schedule.due_date < today && Number(schedule.amount_remaining) > 0) {
    return "overdue";
  }
  return schedule.status;
}

// Services facturés chaque mois, payés d'avance (0040_services_mensuels.sql).
export const MONTHLY_SERVICE_FEE_TYPES = [
  "cantine",
  "renforcement",
  "transport",
  "transport_zone_1",
  "transport_zone_2",
  "transport_zone_3",
];

export function isMonthlyService(feeType: string | null | undefined): boolean {
  return !!feeType && MONTHLY_SERVICE_FEE_TYPES.includes(feeType);
}

// Libellé d'une échéance tel que l'école et les parents en parlent :
//   * mensualité → le mois FACTURÉ (« Mensualité Septembre 2026 », payée le
//     5 octobre, à terme échu) ;
//   * service mensuel → le mois du service, payé d'avance (« Cantine
//     Octobre 2026 », dû début octobre) ;
//   * autres frais → leur nom (« Inscription »).
export function scheduleItemLabel(
  fee: { fee_type: string; month: number } | null,
  dueDate: string,
  language: Language
): string {
  if (!fee) return "—";
  if (fee.fee_type === "mensualite" && fee.month) {
    return `${feeTypeLabel("mensualite", language)} ${formatMonthLabel(mensualiteMonthKey(fee.month, dueDate), language)}`;
  }
  if (isMonthlyService(fee.fee_type)) {
    const name = fee.fee_type.startsWith("transport") && language === "fr" ? "Transport" : feeTypeLabel(fee.fee_type, language);
    return `${name} ${formatMonthLabel(dueDate.slice(0, 7), language)}`;
  }
  return feeTypeLabel(fee.fee_type, language);
}
