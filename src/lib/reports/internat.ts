import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { dayAfter, fetchAll } from "@/lib/reports/financial";
import { formatMonthLabel } from "@/lib/constants/months";
import type { Language } from "@/lib/i18n/config";

// Bilan de l'internat : la part de la comptabilité de l'école qui le
// concerne, sans comptabilité séparée.
//   * recettes = l'argent des paiements affecté aux mois d'internat
//     (payment_allocations vers une échéance « internat »), à la date du
//     paiement, comme le journal de caisse ;
//   * dépenses = les dépenses cochées « Dépense de l'internat » ;
//   * reste à payer = les mois d'internat échus et pas encore réglés.
// Ces montants sont DÉJÀ compris dans les totaux de l'école (tableau de
// bord, rapport financier) : ils n'y sont ni retirés ni ajoutés.

type Client = SupabaseClient<Database>;

export interface InternatMonth {
  key: string; // "2026-10"
  label: string; // "Octobre 2026"
  recettes: number;
  depenses: number;
  solde: number;
}

export interface InternatExpense {
  id: string;
  date: string;
  label: string;
  category: string;
  amount: number;
}

export interface InternatLateBoarder {
  studentId: string;
  name: string;
  klass: string | null;
  lateMonths: number;
  remaining: number;
}

export interface InternatReport {
  from: string;
  to: string;
  boarders: number;
  collected: number;
  spent: number;
  balance: number;
  months: InternatMonth[];
  expenses: InternatExpense[];
  receivable: number;
  late: InternatLateBoarder[];
}

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

type PaymentRow = { paid_at: string; payment_allocations: unknown };
type ExpenseRow = { id: string; amount: number; expense_date: string; category: string; label: string };
type ScheduleRow = { student_id: string; amount_remaining: number; students: unknown };

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export async function computeInternatReport(
  supabase: Client,
  from: string,
  to: string,
  language: Language,
  today: string = new Date().toISOString().slice(0, 10)
): Promise<InternatReport> {
  const [payments, expenses, schedules, { count: boarders }] = await Promise.all([
    fetchAll<PaymentRow>(
      (a, b) =>
        supabase
          .from("payments")
          .select("paid_at, payment_allocations(amount, payment_schedules(fee_structures(fee_type)))")
          .gte("paid_at", from)
          .lt("paid_at", dayAfter(to))
          .order("id")
          .range(a, b) as unknown as Page<PaymentRow>
    ),
    fetchAll<ExpenseRow>(
      (a, b) =>
        supabase
          .from("expenses")
          .select("id, amount, expense_date, category, label")
          .eq("internat", true)
          .gte("expense_date", from)
          .lte("expense_date", to)
          .order("expense_date")
          .order("id")
          .range(a, b) as unknown as Page<ExpenseRow>
    ),
    // Mois d'internat échus, pas encore réglés, des internes encore inscrits
    // (même population que le recouvrement).
    fetchAll<ScheduleRow>(
      (a, b) =>
        supabase
          .from("payment_schedules")
          .select(
            "student_id, amount_remaining, fee_structures!inner(fee_type), students!inner(first_name, last_name, status, classes(name))"
          )
          .eq("fee_structures.fee_type", "internat")
          .eq("students.status", "active")
          .neq("status", "cancelled")
          .lte("due_date", today)
          .gt("amount_remaining", 0)
          .order("id")
          .range(a, b) as unknown as Page<ScheduleRow>
    ),
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("regime", "internat"),
  ]);

  // Un mois par mois de la période, même sans mouvement : le bilan se lit
  // d'un coup d'œil sur toute l'année.
  const months: InternatMonth[] = [];
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  for (let year = fromYear, month = fromMonth; year < toYear || (year === toYear && month <= toMonth); ) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push({ key, label: formatMonthLabel(key, language), recettes: 0, depenses: 0, solde: 0 });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  const byKey = new Map(months.map((m) => [m.key, m]));

  let collected = 0;
  for (const payment of payments) {
    for (const allocation of (payment.payment_allocations ?? []) as { amount: number; payment_schedules: unknown }[]) {
      const schedule = one(allocation.payment_schedules as { fee_structures: unknown } | null);
      const fee = one(schedule?.fee_structures as { fee_type: string } | null);
      if (fee?.fee_type !== "internat") continue;
      const amount = Number(allocation.amount);
      collected += amount;
      const bucket = byKey.get(payment.paid_at.slice(0, 7));
      if (bucket) bucket.recettes += amount;
    }
  }

  let spent = 0;
  for (const expense of expenses) {
    spent += Number(expense.amount);
    const bucket = byKey.get(expense.expense_date.slice(0, 7));
    if (bucket) bucket.depenses += Number(expense.amount);
  }
  for (const bucket of months) bucket.solde = bucket.recettes - bucket.depenses;

  const lateByStudent = new Map<string, InternatLateBoarder>();
  let receivable = 0;
  for (const schedule of schedules) {
    const remaining = Number(schedule.amount_remaining);
    receivable += remaining;
    const student = one(schedule.students as { first_name: string; last_name: string; classes: unknown } | null);
    let entry = lateByStudent.get(schedule.student_id);
    if (!entry) {
      entry = {
        studentId: schedule.student_id,
        name: student ? `${student.last_name} ${student.first_name}` : "—",
        klass: one(student?.classes as { name: string } | null)?.name ?? null,
        lateMonths: 0,
        remaining: 0,
      };
      lateByStudent.set(schedule.student_id, entry);
    }
    entry.lateMonths += 1;
    entry.remaining += remaining;
  }

  return {
    from,
    to,
    boarders: boarders ?? 0,
    collected,
    spent,
    balance: collected - spent,
    months,
    expenses: expenses.map((e) => ({
      id: e.id,
      date: e.expense_date,
      label: e.label,
      category: e.category,
      amount: Number(e.amount),
    })),
    receivable,
    late: Array.from(lateByStudent.values()).sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name, "fr")),
  };
}
