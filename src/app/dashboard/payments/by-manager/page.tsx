import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { dayAfter, fetchAll } from "@/lib/reports/financial";
import { schoolYearBounds } from "@/lib/school-year";
import { getLanguage } from "@/lib/i18n/get-language";
import { ManagerPaymentsView, type ManagerPaymentRow } from "./view";

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

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

// Les paiements derrière la « Recette » d'un responsable (Directeur, Adjoint…)
// sur le tableau de bord ou le rapport : mêmes lignes, même période, donc
// même total — l'école peut enfin voir quels élèves composent ce montant et
// le rapprocher de ses reçus.
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

  const [{ data: school }, { data: manager }] = await Promise.all([
    supabase
      .from("schools")
      .select("currency, school_year_label, school_year_start_month, school_year_end_month")
      .eq("id", appUser.school_id ?? "")
      .maybeSingle(),
    unassigned
      ? Promise.resolve({ data: null })
      : supabase.from("cash_managers").select("id, name").eq("id", managerParam).maybeSingle(),
  ]);
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
  const payments = await fetchAll<PaymentRow>((a, b) => {
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
  });

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

  return (
    <ManagerPaymentsView
      language={language}
      managerName={manager?.name ?? null}
      from={from}
      to={to}
      currency={school?.currency ?? "XOF"}
      rows={rows}
      canEdit={canEdit}
      fromReport={fromReport}
    />
  );
}
