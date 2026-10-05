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
