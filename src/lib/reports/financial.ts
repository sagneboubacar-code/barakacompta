import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { EXPENSE_CATEGORIES } from "@/lib/constants/expenses";
import { feeTypeLabel } from "@/lib/constants/fees";

// Rapport financier = JOURNAL DE CAISSE : l'argent réellement entré
// (paiements, à leur date de paiement) et réellement sorti (dépenses, à leur
// date) pendant la période. Toutes les sections en découlent — synthèse,
// recettes par type, responsables, détail journalier — et donnent donc
// forcément le même solde.
//
// Jusqu'au 4 octobre 2026, la synthèse comptait l'argent payé SUR LES
// ÉCHÉANCES de la période et le détail journalier l'argent REÇU pendant la
// période : deux soldes différents à l'écran (septembre : 117 500 F contre
// 402 500 F). Le suivi des échéances (attendu, reste à payer) relève de
// l'état de recouvrement, pas du journal de caisse.

type Client = SupabaseClient<Database>;

export interface RevenueBucket {
  // Type de frais ("inscription", "mensualite", "transport"...) ou
  // "non_affecte" pour une avance qui n'a encore trouvé aucune échéance.
  key: string;
  label: string;
  collected: number;
}

export interface ExpenseItem {
  id: string;
  date: string; // "2026-09-12"
  label: string; // description saisie : « Achat de cartouches »
  amount: number;
}

export interface ExpenseCategoryTotal {
  // Catégorie de la liste (« salaires »), ou « autres:<nom> » pour une
  // dépense hors liste.
  key: string;
  label: string;
  // true : `label` est le nom saisi par l'école, à afficher tel quel (et non
  // un libellé de catégorie à traduire).
  freeText: boolean;
  amount: number;
  // Les dépenses de la catégorie, par date : le total seul ne disait pas à
  // la direction ce qui avait été acheté.
  items: ExpenseItem[];
}

export interface FinancialReport {
  from: string;
  to: string;
  // Seulement les types réellement encaissés sur la période.
  revenueByType: RevenueBucket[];
  totalCollected: number;
  paymentsCount: number;
  // Seulement les catégories réellement dépensées sur la période.
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

export interface DailyBreakdown {
  key: string; // "2026-08-07"
  label: string; // "07/08/2026"
  recettes: number;
  depenses: number;
  solde: number;
  // Solde cumulé depuis le début de la période : ce qui doit être en caisse
  // le soir de ce jour-là (hors argent antérieur à la période).
  cumul: number;
}

export interface CashManagerTotal {
  cashManagerId: string | null;
  name: string;
  collected: number;
  spent: number;
  // Transferts reçus moins transferts remis : sans cette colonne, le solde
  // ne se retrouvait pas en faisant Recette − Dépense.
  transfers: number;
  solde: number;
}

// `paid_at` est un horodatage : comparé à « 2026-09-30 », il s'arrête à
// minuit et oublie les paiements de la journée. On borne donc au lendemain.
export function dayAfter(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// PostgREST plafonne chaque réponse à 1000 lignes ; une année de paiements
// d'une école les dépasse vite. On pagine.
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error("Lecture du rapport impossible : " + error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

type PaymentRow = {
  id: string;
  amount: number;
  paid_at: string;
  cash_manager_id: string | null;
  payment_allocations: unknown;
};

type ExpenseRow = {
  id: string;
  amount: number;
  expense_date: string;
  category: string;
  label: string;
  cash_manager_id: string | null;
};

function fetchPayments(supabase: Client, from: string, to: string) {
  return fetchAll<PaymentRow>((a, b) =>
    supabase
      .from("payments")
      .select("id, amount, paid_at, cash_manager_id, payment_allocations(amount, payment_schedules(fee_structures(fee_type)))")
      .gte("paid_at", from)
      .lt("paid_at", dayAfter(to))
      .order("id")
      .range(a, b) as unknown as PromiseLike<{ data: PaymentRow[] | null; error: { message: string } | null }>
  );
}

function fetchExpenses(supabase: Client, from: string, to: string) {
  return fetchAll<ExpenseRow>((a, b) =>
    supabase
      .from("expenses")
      .select("id, amount, expense_date, category, label, cash_manager_id")
      .gte("expense_date", from)
      .lte("expense_date", to)
      .order("id")
      .range(a, b)
  );
}

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

// Libellés au pluriel pour les postes principaux ; les trois tarifs de
// transport par zone sont regroupés en un seul poste « Transport ».
function revenueKey(feeType: string | null | undefined): string {
  if (!feeType) return "autre";
  return feeType.startsWith("transport") ? "transport" : feeType;
}
const REVENUE_LABELS: Record<string, string> = {
  inscription: "Inscriptions",
  mensualite: "Mensualités",
  uniforme: "Uniformes",
  transport: "Transport",
  non_affecte: "Avances non encore affectées",
};
const REVENUE_ORDER = ["inscription", "mensualite", "uniforme"];

export async function computeFinancialReport(supabase: Client, from: string, to: string): Promise<FinancialReport> {
  const [payments, expenses] = await Promise.all([fetchPayments(supabase, from, to), fetchExpenses(supabase, from, to)]);

  // Chaque paiement est ventilé selon les échéances qu'il a réglées ; ce qui
  // n'a trouvé aucune échéance (avance au-delà de tout l'échéancier) reste
  // une recette, comptée à part.
  const revenue = new Map<string, number>();
  const add = (key: string, amount: number) => revenue.set(key, (revenue.get(key) ?? 0) + amount);
  for (const payment of payments) {
    let allocated = 0;
    for (const allocation of (payment.payment_allocations ?? []) as { amount: number; payment_schedules: unknown }[]) {
      const schedule = one(allocation.payment_schedules as { fee_structures: unknown } | null);
      const fee = one(schedule?.fee_structures as { fee_type: string } | null);
      add(revenueKey(fee?.fee_type), Number(allocation.amount));
      allocated += Number(allocation.amount);
    }
    const unallocated = Number(payment.amount) - allocated;
    if (unallocated > 0.005) add("non_affecte", unallocated);
  }

  const revenueByType: RevenueBucket[] = Array.from(revenue.entries())
    .filter(([, amount]) => amount > 0)
    .map(([key, collected]) => ({ key, label: REVENUE_LABELS[key] ?? feeTypeLabel(key, "fr"), collected }))
    .sort((a, b) => {
      const rank = (k: string) => (k === "non_affecte" ? 99 : REVENUE_ORDER.includes(k) ? REVENUE_ORDER.indexOf(k) : 10);
      return rank(a.key) - rank(b.key) || b.collected - a.collected;
    });
  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  // Une ligne « Autres » ne disait rien de ce qui avait été payé : une
  // dépense hors liste apparaît sous le nom saisi en description (« Achat de
  // cartouches »), et les dépenses de même nom sont additionnées.
  const groups = new Map<string, ExpenseCategoryTotal>();
  for (const expense of expenses) {
    const name = expense.label.trim().replace(/\s+/g, " ");
    const freeText = expense.category === "autres";
    const key = freeText ? `autres:${name.toLocaleLowerCase("fr")}` : expense.category;
    let group = groups.get(key);
    if (!group) {
      const label = freeText ? name : EXPENSE_CATEGORIES.find((c) => c.key === expense.category)?.label ?? expense.category;
      group = { key, label, freeText, amount: 0, items: [] };
      groups.set(key, group);
    }
    group.amount += Number(expense.amount);
    group.items.push({ id: expense.id, date: expense.expense_date, label: name, amount: Number(expense.amount) });
  }
  // Catégories dans l'ordre de la liste, puis les dépenses hors liste par nom.
  const rank = (group: ExpenseCategoryTotal) => {
    const index = EXPENSE_CATEGORIES.findIndex((c) => c.key === group.key);
    return index === -1 ? EXPENSE_CATEGORIES.length : index;
  };
  const expensesByCategory = Array.from(groups.values())
    .filter((group) => group.amount > 0)
    .sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label, "fr"));
  for (const group of expensesByCategory) {
    group.items.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label, "fr"));
  }
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return {
    from,
    to,
    revenueByType,
    totalCollected,
    paymentsCount: payments.length,
    expensesByCategory,
    totalExpenses,
    balance: totalCollected - totalExpenses,
  };
}

const MONTH_LABELS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// Recettes (paiements encaissés) vs dépenses, mois par mois sur la période.
export async function computeMonthlyBreakdown(supabase: Client, from: string, to: string): Promise<MonthlyBreakdown[]> {
  const [payments, expenses] = await Promise.all([fetchPayments(supabase, from, to), fetchExpenses(supabase, from, to)]);

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
  for (const payment of payments) {
    const bucket = byKey.get(payment.paid_at.slice(0, 7));
    if (bucket) bucket.recettes += Number(payment.amount);
  }
  for (const expense of expenses) {
    const bucket = byKey.get(expense.expense_date.slice(0, 7));
    if (bucket) bucket.depenses += Number(expense.amount);
  }
  for (const bucket of months) {
    bucket.solde = bucket.recettes - bucket.depenses;
  }
  return months;
}

// Jours où de l'argent est entré ou sorti, avec le cumul de la période.
// Les jours sans mouvement ne sont pas listés : trente lignes de tirets
// noyaient les quelques jours qui comptent.
export async function computeDailyBreakdown(supabase: Client, from: string, to: string): Promise<DailyBreakdown[]> {
  const [payments, expenses] = await Promise.all([fetchPayments(supabase, from, to), fetchExpenses(supabase, from, to)]);

  const days = new Map<string, { recettes: number; depenses: number }>();
  const day = (key: string) => {
    let entry = days.get(key);
    if (!entry) {
      entry = { recettes: 0, depenses: 0 };
      days.set(key, entry);
    }
    return entry;
  };
  // Dates en UTC de bout en bout (le Sénégal est à UTC+0) : mélanger heure
  // locale et UTC décalerait silencieusement les jours d'un cran.
  for (const payment of payments) day(payment.paid_at.slice(0, 10)).recettes += Number(payment.amount);
  for (const expense of expenses) day(expense.expense_date.slice(0, 10)).depenses += Number(expense.amount);

  let cumul = 0;
  return Array.from(days.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { recettes, depenses }]) => {
      const solde = recettes - depenses;
      cumul += solde;
      const [y, m, d] = key.split("-");
      return { key, label: `${d}/${m}/${y}`, recettes, depenses, solde, cumul };
    });
}

// Répartition par responsable (Directeur, Adjoint...) : un seul comptable
// peut saisir tous les paiements/dépenses, mais chaque ligne est rattachée
// (facultativement) à un cash_manager — utile pour savoir qui a quoi en main
// même quand une seule personne fait la saisie. Les transferts internes entre
// responsables (ex. Directeur → Adjoint) ajustent le solde de chacun sans
// affecter les totaux Recettes/Dépenses de l'école : l'argent ne rentre ni ne
// sort, il change juste de mains.
export async function computeCashManagerBreakdown(supabase: Client, from: string, to: string): Promise<CashManagerTotal[]> {
  const [payments, expenses, { data: managers }, { data: transfers }] = await Promise.all([
    fetchPayments(supabase, from, to),
    fetchExpenses(supabase, from, to),
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
    totals.set(manager.id, { cashManagerId: manager.id, name: manager.name, collected: 0, spent: 0, transfers: 0, solde: 0 });
  }

  function bucket(cashManagerId: string | null): CashManagerTotal {
    const key = cashManagerId ?? "__none__";
    let entry = totals.get(key);
    if (!entry) {
      entry = { cashManagerId, name: "Non attribué", collected: 0, spent: 0, transfers: 0, solde: 0 };
      totals.set(key, entry);
    }
    return entry;
  }

  for (const payment of payments) bucket(payment.cash_manager_id).collected += Number(payment.amount);
  for (const expense of expenses) bucket(expense.cash_manager_id).spent += Number(expense.amount);

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
    if (fromEntry) {
      fromEntry.transfers -= Number(transfer.amount);
      fromEntry.solde -= Number(transfer.amount);
    }
    if (toEntry) {
      toEntry.transfers += Number(transfer.amount);
      toEntry.solde += Number(transfer.amount);
    }
  }

  return result.sort((a, b) => (a.cashManagerId === null ? 1 : b.cashManagerId === null ? -1 : 0));
}
