import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { dayAfter, fetchAll } from "@/lib/reports/financial";

// Relevé de caisse d'un responsable (Directeur, Adjoint…) : ses recettes, ses
// dépenses et les transferts reçus ou remis, sur une période. Mêmes lignes et
// mêmes bornes que computeCashManagerBreakdown, donc le même solde que la
// ligne du responsable sur le tableau de bord ou le rapport — l'école pointe
// chaque montant avec ses reçus et l'argent en main. La page et le PDF
// lisent tous deux ces lignes-ci.

type Client = SupabaseClient<Database>;

export interface ManagerPaymentRow {
  id: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
  studentId: string | null;
  studentName: string | null;
  className: string | null;
  familyPaymentId: string | null;
  familyName: string | null;
}

export interface ManagerExpenseRow {
  id: string;
  date: string;
  category: string;
  label: string;
  amount: number;
}

export interface ManagerTransferRow {
  id: string;
  date: string;
  // true : reçu d'un autre responsable ; false : remis à un autre.
  received: boolean;
  otherName: string;
  notes: string | null;
  amount: number;
}

export interface ManagerStatement {
  rows: ManagerPaymentRow[];
  expenses: ManagerExpenseRow[];
  transfers: ManagerTransferRow[];
  // Solde la veille de la période (tout ce qui précède `from`).
  openingBalance: number;
}

type PaymentRow = {
  id: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  student_id: string | null;
  family_payment_id: string | null;
  students: unknown;
  family_payments: unknown;
};

type ExpenseRow = {
  id: string;
  amount: number;
  expense_date: string;
  category: string;
  label: string;
};

type TransferRow = {
  id: string;
  amount: number;
  transferred_at: string;
  notes: string | null;
  from_manager_id: string;
  to_manager_id: string;
};

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

// `managerId` : l'id du responsable, ou "none" pour « Non attribué ».
// `managers` : les responsables de l'école, pour nommer l'autre côté d'un
// transfert.
export async function loadManagerStatement(
  supabase: Client,
  managerId: string,
  managers: { id: string; name: string }[],
  from: string,
  to: string
): Promise<ManagerStatement> {
  const unassigned = managerId === "none";

  // Mêmes bornes que fetchPayments (rapport financier) : paid_at est un
  // horodatage, d'où le « < lendemain » pour garder la dernière journée.
  const [payments, expenses, transfers] = await Promise.all([
    fetchAll<PaymentRow>((a, b) => {
      let query = supabase
        .from("payments")
        .select(
          "id, amount, payment_method, paid_at, student_id, family_payment_id, students(first_name, last_name, classes(name)), family_payments(family_name)"
        )
        .gte("paid_at", from)
        .lt("paid_at", dayAfter(to));
      query = unassigned ? query.is("cash_manager_id", null) : query.eq("cash_manager_id", managerId);
      return query.order("paid_at").order("id").range(a, b) as unknown as PromiseLike<{
        data: PaymentRow[] | null;
        error: { message: string } | null;
      }>;
    }),
    fetchAll<ExpenseRow>((a, b) => {
      let query = supabase
        .from("expenses")
        .select("id, amount, expense_date, category, label")
        .gte("expense_date", from)
        .lte("expense_date", to);
      query = unassigned ? query.is("cash_manager_id", null) : query.eq("cash_manager_id", managerId);
      return query.order("expense_date").order("id").range(a, b);
    }),
    // Un transfert va toujours d'un responsable à un autre : rien à montrer
    // pour « Non attribué ».
    unassigned
      ? Promise.resolve([] as TransferRow[])
      : fetchAll<TransferRow>((a, b) =>
          supabase
            .from("cash_manager_transfers")
            .select("id, amount, transferred_at, notes, from_manager_id, to_manager_id")
            .or(`from_manager_id.eq.${managerId},to_manager_id.eq.${managerId}`)
            .gte("transferred_at", from)
            .lte("transferred_at", to)
            .order("transferred_at")
            .order("id")
            .range(a, b)
        ),
  ]);

  // Ce que le responsable avait en main la veille de la période : tout ce
  // qu'il a encaissé, dépensé, reçu ou remis avant. Sans ce report, un mois
  // où il remet l'argent encaissé le mois d'avant sortait en négatif.
  const sumBefore = <T extends { amount: number }>(
    page: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
  ) => fetchAll<T>(page).then((list) => list.reduce((sum, row) => sum + Number(row.amount), 0));
  const [paidBefore, spentBefore, receivedBefore, sentBefore] = await Promise.all([
    sumBefore<{ amount: number }>((a, b) => {
      const query = supabase.from("payments").select("amount").lt("paid_at", from);
      return (unassigned ? query.is("cash_manager_id", null) : query.eq("cash_manager_id", managerId))
        .order("id")
        .range(a, b);
    }),
    sumBefore<{ amount: number }>((a, b) => {
      const query = supabase.from("expenses").select("amount").lt("expense_date", from);
      return (unassigned ? query.is("cash_manager_id", null) : query.eq("cash_manager_id", managerId))
        .order("id")
        .range(a, b);
    }),
    unassigned
      ? Promise.resolve(0)
      : sumBefore<{ amount: number }>((a, b) =>
          supabase
            .from("cash_manager_transfers")
            .select("amount")
            .eq("to_manager_id", managerId)
            .lt("transferred_at", from)
            .order("id")
            .range(a, b)
        ),
    unassigned
      ? Promise.resolve(0)
      : sumBefore<{ amount: number }>((a, b) =>
          supabase
            .from("cash_manager_transfers")
            .select("amount")
            .eq("from_manager_id", managerId)
            .lt("transferred_at", from)
            .order("id")
            .range(a, b)
        ),
  ]);

  const managerName = new Map(managers.map((m) => [m.id, m.name]));

  return {
    rows: payments.map((payment) => {
      const student = one(payment.students as { first_name: string; last_name: string; classes: unknown } | null);
      const family = one(payment.family_payments as { family_name: string } | null);
      return {
        id: payment.id,
        amount: Number(payment.amount),
        paymentMethod: payment.payment_method,
        paidAt: payment.paid_at,
        studentId: payment.student_id,
        studentName: student ? `${student.last_name} ${student.first_name}` : null,
        className: one(student?.classes as { name: string } | null)?.name ?? null,
        familyPaymentId: payment.family_payment_id,
        // Affiché « Famille X » : certaines familles s'appellent déjà
        // « FAMILLE DEMBA MBOUP », qui donnait « Famille FAMILLE DEMBA MBOUP ».
        familyName: family ? family.family_name.replace(/^famille\s+/i, "") : null,
      };
    }),
    expenses: expenses.map((expense) => ({
      id: expense.id,
      date: expense.expense_date,
      category: expense.category,
      label: expense.label.trim().replace(/\s+/g, " "),
      amount: Number(expense.amount),
    })),
    transfers: transfers.map((transfer) => {
      const received = transfer.to_manager_id === managerId;
      const other = received ? transfer.from_manager_id : transfer.to_manager_id;
      return {
        id: transfer.id,
        date: transfer.transferred_at,
        received,
        otherName: managerName.get(other) ?? "—",
        notes: transfer.notes,
        amount: Number(transfer.amount),
      };
    }),
    openingBalance: paidBefore - spentBefore + receivedBefore - sentBefore,
  };
}

// Le calcul du solde, commun à la page et au PDF.
export function managerStatementTotals(statement: ManagerStatement) {
  const collected = statement.rows.reduce((sum, row) => sum + row.amount, 0);
  const spent = statement.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const received = statement.transfers.filter((transfer) => transfer.received);
  const sent = statement.transfers.filter((transfer) => !transfer.received);
  const totalReceived = received.reduce((sum, transfer) => sum + transfer.amount, 0);
  const totalSent = sent.reduce((sum, transfer) => sum + transfer.amount, 0);
  const solde = collected + totalReceived - spent - totalSent;
  return {
    collected,
    spent,
    receivedCount: received.length,
    sentCount: sent.length,
    totalReceived,
    totalSent,
    solde,
    closingBalance: statement.openingBalance + solde,
  };
}
