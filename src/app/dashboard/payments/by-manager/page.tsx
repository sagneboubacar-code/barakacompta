import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { dayAfter, fetchAll } from "@/lib/reports/financial";
import { schoolYearBounds } from "@/lib/school-year";
import { getLanguage } from "@/lib/i18n/get-language";
import {
  ManagerPaymentsView,
  type ManagerExpenseRow,
  type ManagerPaymentRow,
  type ManagerTransferRow,
} from "./view";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// Relevé de caisse d'un responsable (Directeur, Adjoint…) : ses recettes, ses
// dépenses et les transferts reçus ou remis, sur une période. Mêmes lignes et
// mêmes bornes que computeCashManagerBreakdown, donc le même solde que la
// ligne du responsable sur le tableau de bord ou le rapport — l'école pointe
// chaque montant avec ses reçus et l'argent en main.
//
// ?manager=<id> ou ?manager=none (« Non attribué ») ; ?from&to optionnels
// (période du rapport), sinon l'année scolaire comme le tableau de bord.
export default async function ManagerPaymentsPage({
  searchParams,
}: {
  searchParams: { manager?: string; from?: string; to?: string };
}) {
  const appUser = await requireRole(["owner", "admin", "accountant"]);
  const language = getLanguage();
  const supabase = createClient();
  const canEdit = appUser.role === "owner" || appUser.role === "admin";

  const managerParam = searchParams.manager ?? "";
  const unassigned = managerParam === "none";
  if (!unassigned && !UUID.test(managerParam)) notFound();

  const [{ data: school }, { data: managers }] = await Promise.all([
    supabase
      .from("schools")
      .select("currency, school_year_label, school_year_start_month, school_year_end_month")
      .eq("id", appUser.school_id ?? "")
      .maybeSingle(),
    supabase.from("cash_managers").select("id, name").order("sort_order"),
  ]);
  const manager = unassigned ? null : (managers ?? []).find((m) => m.id === managerParam) ?? null;
  // Responsable inconnu, ou d'une autre école (invisible par la RLS).
  if (!unassigned && !manager) notFound();

  const fromReport = ISO_DATE.test(searchParams.from ?? "") && ISO_DATE.test(searchParams.to ?? "");
  const year = schoolYearBounds(
    school ?? { school_year_label: null, school_year_start_month: 9, school_year_end_month: 6 }
  );
  const from = fromReport ? searchParams.from! : year.from;
  const to = fromReport ? searchParams.to! : year.to;

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
      query = unassigned ? query.is("cash_manager_id", null) : query.eq("cash_manager_id", managerParam);
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
      query = unassigned ? query.is("cash_manager_id", null) : query.eq("cash_manager_id", managerParam);
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
            .or(`from_manager_id.eq.${managerParam},to_manager_id.eq.${managerParam}`)
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
      return (unassigned ? query.is("cash_manager_id", null) : query.eq("cash_manager_id", managerParam))
        .order("id")
        .range(a, b);
    }),
    sumBefore<{ amount: number }>((a, b) => {
      const query = supabase.from("expenses").select("amount").lt("expense_date", from);
      return (unassigned ? query.is("cash_manager_id", null) : query.eq("cash_manager_id", managerParam))
        .order("id")
        .range(a, b);
    }),
    unassigned
      ? Promise.resolve(0)
      : sumBefore<{ amount: number }>((a, b) =>
          supabase
            .from("cash_manager_transfers")
            .select("amount")
            .eq("to_manager_id", managerParam)
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
            .eq("from_manager_id", managerParam)
            .lt("transferred_at", from)
            .order("id")
            .range(a, b)
        ),
  ]);
  const openingBalance = paidBefore - spentBefore + receivedBefore - sentBefore;

  const rows: ManagerPaymentRow[] = payments.map((payment) => {
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
      familyName: family?.family_name ?? null,
    };
  });

  const expenseRows: ManagerExpenseRow[] = expenses.map((expense) => ({
    id: expense.id,
    date: expense.expense_date,
    category: expense.category,
    label: expense.label.trim().replace(/\s+/g, " "),
    amount: Number(expense.amount),
  }));

  const managerName = new Map((managers ?? []).map((m) => [m.id, m.name]));
  const transferRows: ManagerTransferRow[] = transfers.map((transfer) => {
    const received = transfer.to_manager_id === managerParam;
    const other = received ? transfer.from_manager_id : transfer.to_manager_id;
    return {
      id: transfer.id,
      date: transfer.transferred_at,
      received,
      otherName: managerName.get(other) ?? "—",
      notes: transfer.notes,
      amount: Number(transfer.amount),
    };
  });

  return (
    <ManagerPaymentsView
      language={language}
      managerId={unassigned ? "none" : managerParam}
      managerName={manager?.name ?? null}
      managers={managers ?? []}
      from={from}
      to={to}
      currency={school?.currency ?? "XOF"}
      rows={rows}
      expenses={expenseRows}
      transfers={transferRows}
      openingBalance={openingBalance}
      canEdit={canEdit}
      fromReport={fromReport}
    />
  );
}
