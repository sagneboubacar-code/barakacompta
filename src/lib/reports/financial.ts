import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { EXPENSE_CATEGORIES } from "@/lib/constants/expenses";

export interface RevenueBucket {
  key: "inscription" | "uniforme" | "mensualite" | "autres";
  label: string;
  expected: number;
  collected: number;
  remaining: number;
}

export interface ExpenseCategoryTotal {
  key: string;
  label: string;
  amount: number;
}

export interface FinancialReport {
  from: string;
  to: string;
  revenueByType: RevenueBucket[];
  totalExpected: number;
  totalCollected: number;
  totalRemaining: number;
  expensesByCategory: ExpenseCategoryTotal[];
  totalExpenses: number;
  balance: number;
}

export interface MonthlyBreakdown {
  key: string; // "2025-10"
  label: string; // "Octobre 2025"
  recettes: number;
  depenses: number;
  solde: number;
}

// Basé exclusivement sur payment_schedules (due_date dans la période) pour
// que attendu = encaissé + à recouvrer soit toujours vérifié exactement —
// mélanger avec les dates de paiement (qui peuvent couvrir d'autres mois en
// cas d'avance) casserait cette cohérence.
export async function computeFinancialReport(
  supabase: SupabaseClient<Database>,
  from: string,
  to: string
): Promise<FinancialReport> {
  const { data: schedules } = await supabase
    .from("payment_schedules")
    .select("amount_due, discount_amount, amount_paid, amount_remaining, fee_structures(fee_type)")
    .gte("due_date", from)
    .lte("due_date", to)
    .neq("status", "cancelled");

  const buckets: Record<RevenueBucket["key"], RevenueBucket> = {
    inscription: { key: "inscription", label: "Inscriptions", expected: 0, collected: 0, remaining: 0 },
    uniforme: { key: "uniforme", label: "Uniforme", expected: 0, collected: 0, remaining: 0 },
    mensualite: { key: "mensualite", label: "Mensualités", expected: 0, collected: 0, remaining: 0 },
    autres: { key: "autres", label: "Autres frais", expected: 0, collected: 0, remaining: 0 },
  };

  for (const schedule of schedules ?? []) {
    const feeStructure = Array.isArray(schedule.fee_structures)
      ? schedule.fee_structures[0]
      : schedule.fee_structures;
    const feeType = feeStructure?.fee_type;
    const key: RevenueBucket["key"] =
      feeType === "inscription"
        ? "inscription"
        : feeType === "uniforme"
          ? "uniforme"
          : feeType === "mensualite"
            ? "mensualite"
            : "autres";

    buckets[key].expected += schedule.amount_due - schedule.discount_amount;
    buckets[key].collected += schedule.amount_paid;
    buckets[key].remaining += schedule.amount_remaining;
  }

  const revenueByType = [buckets.inscription, buckets.uniforme, buckets.mensualite, buckets.autres];
  const totalExpected = revenueByType.reduce((sum, r) => sum + r.expected, 0);
  const totalCollected = revenueByType.reduce((sum, r) => sum + r.collected, 0);
  const totalRemaining = revenueByType.reduce((sum, r) => sum + r.remaining, 0);

  const { data: expenses } = await supabase
    .from("expenses")
    .select("category, amount")
    .gte("expense_date", from)
    .lte("expense_date", to);

  const expenseTotals = new Map<string, number>();
  for (const expense of expenses ?? []) {
    expenseTotals.set(expense.category, (expenseTotals.get(expense.category) ?? 0) + expense.amount);
  }

  const expensesByCategory = EXPENSE_CATEGORIES.map((category) => ({
    key: category.key,
    label: category.label,
    amount: expenseTotals.get(category.key) ?? 0,
  }));
  const totalExpenses = expensesByCategory.reduce((sum, e) => sum + e.amount, 0);

  return {
    from,
    to,
    revenueByType,
    totalExpected,
    totalCollected,
    totalRemaining,
    expensesByCategory,
    totalExpenses,
    balance: totalCollected - totalExpenses,
  };
}

const MONTH_LABELS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// Recettes (paiements encaissés) vs dépenses, mois par mois sur toute la
// période — basé sur les dates réelles (paid_at / expense_date), pas les
// échéances, pour refléter l'argent effectivement entré/sorti chaque mois.
export async function computeMonthlyBreakdown(
  supabase: SupabaseClient<Database>,
  from: string,
  to: string
): Promise<MonthlyBreakdown[]> {
  const [{ data: payments }, { data: expenses }] = await Promise.all([
    supabase.from("payments").select("amount, paid_at").gte("paid_at", from).lte("paid_at", to),
    supabase.from("expenses").select("amount, expense_date").gte("expense_date", from).lte("expense_date", to),
  ]);

  const months: MonthlyBreakdown[] = [];
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  let year = fromYear;
  let month = fromMonth;
  while (year < toYear || (year === toYear && month <= toMonth)) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push({ key, label: `${MONTH_LABELS_FR[month - 1]} ${year}`, recettes: 0, depenses: 0, solde: 0 });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  const byKey = new Map(months.map((m) => [m.key, m]));

  for (const payment of payments ?? []) {
    const key = payment.paid_at.slice(0, 7);
    const bucket = byKey.get(key);
    if (bucket) bucket.recettes += payment.amount;
  }

  for (const expense of expenses ?? []) {
    const key = expense.expense_date.slice(0, 7);
    const bucket = byKey.get(key);
    if (bucket) bucket.depenses += expense.amount;
  }

  for (const bucket of months) {
    bucket.solde = bucket.recettes - bucket.depenses;
  }

  return months;
}

export interface DailyBreakdown {
  key: string; // "2026-08-07"
  label: string; // "07/08/2026"
  recettes: number;
  depenses: number;
  solde: number;
}

// Même principe que computeMonthlyBreakdown, granularité jour — pensé pour
// une période bornée (le rapport financier), pas toute une année scolaire.
export async function computeDailyBreakdown(
  supabase: SupabaseClient<Database>,
  from: string,
  to: string
): Promise<DailyBreakdown[]> {
  const [{ data: payments }, { data: expenses }] = await Promise.all([
    supabase.from("payments").select("amount, paid_at").gte("paid_at", from).lte("paid_at", to),
    supabase.from("expenses").select("amount, expense_date").gte("expense_date", from).lte("expense_date", to),
  ]);

  // Arithmétique entièrement en UTC (parsing avec "Z" + getUTC*/setUTCDate) :
  // mélanger heure locale et UTC ici décale silencieusement les jours d'un
  // cran dès que le serveur ne tourne pas en UTC.
  const days: DailyBreakdown[] = [];
  for (
    const cursor = new Date(`${from}T00:00:00Z`);
    cursor <= new Date(`${to}T00:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const key = cursor.toISOString().slice(0, 10);
    days.push({ key, label: cursor.toLocaleDateString("fr-FR", { timeZone: "UTC" }), recettes: 0, depenses: 0, solde: 0 });
  }

  const byKey = new Map(days.map((d) => [d.key, d]));

  for (const payment of payments ?? []) {
    const bucket = byKey.get(payment.paid_at.slice(0, 10));
    if (bucket) bucket.recettes += payment.amount;
  }

  for (const expense of expenses ?? []) {
    const bucket = byKey.get(expense.expense_date.slice(0, 10));
    if (bucket) bucket.depenses += expense.amount;
  }

  for (const day of days) {
    day.solde = day.recettes - day.depenses;
  }

  return days;
}

export interface CashManagerTotal {
  cashManagerId: string | null;
  name: string;
  collected: number;
  spent: number;
  solde: number;
}

// Répartition par responsable (Directeur, Adjoint...) : un seul comptable
// peut saisir tous les paiements/dépenses, mais chaque ligne est rattachée
// (facultativement) à un cash_manager — utile pour savoir qui a quoi en main
// même quand une seule personne fait la saisie. Les transferts internes entre
// responsables (ex. Directeur → Adjoint) ajustent le solde de chacun sans
// affecter les totaux Recettes/Dépenses de l'école : l'argent ne rentre ni ne
// sort, il change juste de mains.
export async function computeCashManagerBreakdown(
  supabase: SupabaseClient<Database>,
  from: string,
  to: string
): Promise<CashManagerTotal[]> {
  const [{ data: payments }, { data: expenses }, { data: managers }, { data: transfers }] = await Promise.all([
    supabase.from("payments").select("amount, cash_manager_id").gte("paid_at", from).lte("paid_at", to),
    supabase.from("expenses").select("amount, cash_manager_id").gte("expense_date", from).lte("expense_date", to),
    supabase.from("cash_managers").select("id, name").order("sort_order"),
    supabase
      .from("cash_manager_transfers")
      .select("amount, from_manager_id, to_manager_id")
      .gte("transferred_at", from)
      .lte("transferred_at", to),
  ]);

  const totals = new Map<string, CashManagerTotal>();

  // Chaque responsable configuré apparaît même sans activité sur la période
  // (ex. Directeur 2 n'a encore rien encaissé) — seule une activité non
  // attribuée fait apparaître la ligne "Non attribué".
  for (const manager of managers ?? []) {
    totals.set(manager.id, { cashManagerId: manager.id, name: manager.name, collected: 0, spent: 0, solde: 0 });
  }

  function bucket(cashManagerId: string | null): CashManagerTotal {
    const key = cashManagerId ?? "__none__";
    let entry = totals.get(key);
    if (!entry) {
      entry = { cashManagerId, name: "Non attribué", collected: 0, spent: 0, solde: 0 };
      totals.set(key, entry);
    }
    return entry;
  }

  for (const payment of payments ?? []) {
    bucket(payment.cash_manager_id).collected += payment.amount;
  }

  for (const expense of expenses ?? []) {
    bucket(expense.cash_manager_id).spent += expense.amount;
  }

  const result = Array.from(totals.values());
  for (const entry of result) {
    entry.solde = entry.collected - entry.spent;
  }

  // Un transfert connu (from/to renseignés dans cash_managers) ne peut cibler
  // que des managers déjà dans `totals` (contrainte FK) : pas de bucket
  // "Non attribué" à gérer ici.
  for (const transfer of transfers ?? []) {
    const fromEntry = totals.get(transfer.from_manager_id);
    const toEntry = totals.get(transfer.to_manager_id);
    if (fromEntry) fromEntry.solde -= transfer.amount;
    if (toEntry) toEntry.solde += transfer.amount;
  }

  return result.sort((a, b) => (a.cashManagerId === null ? 1 : b.cashManagerId === null ? -1 : 0));
}
