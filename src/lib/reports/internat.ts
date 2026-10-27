import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { dayAfter, fetchAll } from "@/lib/reports/financial";
import { formatMonthLabel } from "@/lib/constants/months";
import type { Language } from "@/lib/i18n/config";

// Bilan de l'internat : la part de la comptabilité de l'école qui le
// concerne, sans comptabilité séparée.
//   * recettes = l'argent des paiements affecté aux mois d'internat
//     (payment_allocations vers une échéance « internat »), plus tout ce
//     qui est payé pour une classe rattachée à l'internat (classes.internat,
//     ex. « Coran spécial »), à la date du paiement, comme le journal de
//     caisse ;
//   * dépenses = les dépenses cochées « Dépense de l'internat » ;
//   * reste à payer = les mois d'internat échus et pas encore réglés, et les
//     échéances échues des classes rattachées.
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

// D'où viennent les recettes : les frais d'internat, puis chaque classe
// rattachée. Leur somme fait les recettes de l'internat.
export interface InternatSource {
  classId: string | null; // null = frais d'internat
  className: string | null;
  amount: number;
}

export interface InternatReport {
  from: string;
  to: string;
  boarders: number;
  collected: number;
  spent: number;
  balance: number;
  months: InternatMonth[];
  sources: InternatSource[];
  expenses: InternatExpense[];
  receivable: number;
  late: InternatLateBoarder[];
}

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

type PaymentRow = { paid_at: string; payment_allocations: unknown };
type ExpenseRow = { id: string; amount: number; expense_date: string; category: string; label: string };
type ScheduleRow = { student_id: string; due_date: string; amount_remaining: number; students: unknown };

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

const SCHEDULE_COLUMNS =
  "student_id, due_date, amount_remaining, fee_structures!inner(fee_type, class_id), students!inner(first_name, last_name, status, classes(name))";

export async function computeInternatReport(
  supabase: Client,
  from: string,
  to: string,
  language: Language,
  today: string = new Date().toISOString().slice(0, 10)
): Promise<InternatReport> {
  // Colonne absente (SQL 0044 pas encore passé) : aucune classe rattachée.
  const { data: attachedClasses } = await supabase
    .from("classes")
    .select("id, name")
    .eq("internat", true)
    .order("sort_order");
  const attachedIds = (attachedClasses ?? []).map((c) => c.id);
  const attached = new Set(attachedIds);

  // Internes = élèves au régime Internat, plus ceux des classes rattachées.
  const boardersQuery = supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active");

  const [payments, expenses, boarderSchedules, classSchedules, { count: boarders }] = await Promise.all([
    fetchAll<PaymentRow>(
      (a, b) =>
        supabase
          .from("payments")
          .select("paid_at, payment_allocations(amount, payment_schedules(fee_structures(fee_type, class_id)))")
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
    // Échéances échues, pas encore réglées, des élèves encore inscrits (même
    // population que le recouvrement) : les mois d'internat...
    fetchAll<ScheduleRow>(
      (a, b) =>
        supabase
          .from("payment_schedules")
          .select(SCHEDULE_COLUMNS)
          .eq("fee_structures.fee_type", "internat")
          .eq("students.status", "active")
          .neq("status", "cancelled")
          .lte("due_date", today)
          .gt("amount_remaining", 0)
          .order("id")
          .range(a, b) as unknown as Page<ScheduleRow>
    ),
    // ... et tout le reste des classes rattachées (sans recompter l'internat).
    attachedIds.length === 0
      ? Promise.resolve([] as ScheduleRow[])
      : fetchAll<ScheduleRow>(
          (a, b) =>
            supabase
              .from("payment_schedules")
              .select(SCHEDULE_COLUMNS)
              .in("fee_structures.class_id", attachedIds)
              .neq("fee_structures.fee_type", "internat")
              .eq("students.status", "active")
              .neq("status", "cancelled")
              .lte("due_date", today)
              .gt("amount_remaining", 0)
              .order("id")
              .range(a, b) as unknown as Page<ScheduleRow>
        ),
    attachedIds.length === 0
      ? boardersQuery.eq("regime", "internat")
      : boardersQuery.or(`regime.eq.internat,class_id.in.(${attachedIds.join(",")})`),
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

  // Les frais d'internat d'abord, puis les classes rattachées dans l'ordre
  // des classes, même à zéro : l'école voit que la classe est bien comptée.
  const sources: InternatSource[] = [
    { classId: null, className: null, amount: 0 },
    ...(attachedClasses ?? []).map((c) => ({ classId: c.id, className: c.name, amount: 0 })),
  ];
  const sourceByKey = new Map(sources.map((s) => [s.classId ?? "internat", s]));

  let collected = 0;
  for (const payment of payments) {
    for (const allocation of (payment.payment_allocations ?? []) as { amount: number; payment_schedules: unknown }[]) {
      const schedule = one(allocation.payment_schedules as { fee_structures: unknown } | null);
      const fee = one(schedule?.fee_structures as { fee_type: string; class_id: string | null } | null);
      if (!fee) continue;
      const sourceKey = fee.fee_type === "internat" ? "internat" : fee.class_id && attached.has(fee.class_id) ? fee.class_id : null;
      if (!sourceKey) continue;
      const amount = Number(allocation.amount);
      collected += amount;
      sourceByKey.get(sourceKey)!.amount += amount;
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

  // Un élève d'une classe rattachée peut devoir, le même mois, sa mensualité
  // et d'autres frais : on compte les MOIS en retard, pas les lignes.
  const lateByStudent = new Map<string, InternatLateBoarder>();
  const lateMonthsByStudent = new Map<string, Set<string>>();
  let receivable = 0;
  for (const schedule of [...boarderSchedules, ...classSchedules]) {
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
      lateMonthsByStudent.set(schedule.student_id, new Set());
    }
    const lateMonths = lateMonthsByStudent.get(schedule.student_id)!;
    lateMonths.add(schedule.due_date.slice(0, 7));
    entry.lateMonths = lateMonths.size;
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
    sources,
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
