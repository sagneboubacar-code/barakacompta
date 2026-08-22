import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  computeFinancialReport,
  computeMonthlyBreakdown,
  computeCashManagerBreakdown,
} from "@/lib/reports/financial";
import { paymentMethodLabel } from "@/lib/constants/payments";
import { expenseCategoryLabel } from "@/lib/constants/expenses";

// Année scolaire active complète (de son mois de début à son mois de fin),
// pas seulement "depuis le début du mois" : la comptabilité affichée doit
// courir sur toute l'année scolaire, jusqu'à son terme.
function schoolYearBounds(school: {
  school_year_label: string | null;
  school_year_start_month: number;
  school_year_end_month: number;
}) {
  const now = new Date();
  const [startYearStr, endYearStr] = (school.school_year_label ?? "").split("-");
  const startYear = Number(startYearStr) || now.getFullYear();
  const endYear = Number(endYearStr) || startYear + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(endYear, school.school_year_end_month, 0).getDate();
  return {
    from: `${startYear}-${pad(school.school_year_start_month)}-01`,
    to: `${endYear}-${pad(school.school_year_end_month)}-${pad(lastDay)}`,
  };
}

export default async function DashboardHomePage() {
  const appUser = await requireUser();
  const supabase = createClient();

  const { data: school } = await supabase
    .from("schools")
    .select("school_year_label, school_year_start_month, school_year_end_month")
    .eq("id", appUser.school_id ?? "")
    .maybeSingle();

  const { from, to } = schoolYearBounds(
    school ?? { school_year_label: null, school_year_start_month: 9, school_year_end_month: 6 }
  );

  // Mois en cours calculé indépendamment de l'année scolaire : un paiement
  // d'aujourd'hui doit compter ici même s'il tombe hors des bornes de
  // l'année scolaire active (ex. juillet/août entre deux années scolaires).
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const currentMonthFrom = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const currentMonthTo = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  )}`;
  const today = now.toISOString().slice(0, 10);

  // RLS filtre déjà automatiquement par school_id : ces requêtes ne peuvent
  // jamais inclure une autre école, quelle que soit la façon dont elles sont écrites.
  const [
    { count: studentCount },
    yearReport,
    [currentMonthReport],
    cashManagerBreakdown,
    { data: outstandingSchedules },
    { data: overdueSchedules },
    { data: recentPayments },
    { data: recentExpenses },
  ] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    computeFinancialReport(supabase, from, to),
    computeMonthlyBreakdown(supabase, currentMonthFrom, currentMonthTo),
    computeCashManagerBreakdown(supabase, from, to),
    supabase.from("payment_schedules").select("amount_remaining").neq("status", "cancelled").lte("due_date", today),
    supabase.from("payment_schedules").select("student_id").eq("status", "overdue"),
    supabase
      .from("payments")
      .select("id, amount, payment_method, paid_at, students(first_name, last_name)")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("expenses")
      .select("id, label, category, amount, expense_date")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const totalReceivable = (outstandingSchedules ?? []).reduce((sum, s) => sum + s.amount_remaining, 0);
  const overdueStudentCount = new Set((overdueSchedules ?? []).map((s) => s.student_id)).size;
  const inscriptionCollected = yearReport.revenueByType.find((r) => r.key === "inscription")?.collected ?? 0;
  const uniformeCollected = yearReport.revenueByType.find((r) => r.key === "uniforme")?.collected ?? 0;

  const kpis = [
    { label: "Élèves", value: studentCount ?? 0, tone: "neutral" as const },
    { label: "Recettes de l'année", value: yearReport.totalCollected, tone: "positive" as const },
    { label: "Inscription encaissée", value: inscriptionCollected, tone: "positive" as const },
    { label: "Uniforme encaissé", value: uniformeCollected, tone: "positive" as const },
    { label: "Dépenses de l'année", value: yearReport.totalExpenses, tone: "neutral" as const },
    {
      label: "Solde actuel",
      value: yearReport.balance,
      tone: yearReport.balance >= 0 ? ("positive" as const) : ("negative" as const),
    },
    { label: "Montant à recouvrir", value: totalReceivable, tone: "warning" as const },
    { label: "Élèves impayés", value: overdueStudentCount, tone: "negative" as const },
  ];

  const toneClasses: Record<string, string> = {
    neutral: "text-slate-900",
    positive: "text-green-700",
    negative: "text-red-700",
    warning: "text-orange-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Bonjour {appUser.full_name ?? ""}</h1>
        <p className="text-sm text-slate-500">
          Vue d&apos;ensemble de votre école — année scolaire {school?.school_year_label ?? "en cours"}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <p className="text-xs text-slate-500 sm:text-sm">{kpi.label}</p>
            <p className={`mt-1 text-xl font-semibold sm:text-2xl ${toneClasses[kpi.tone]}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Derniers paiements</h2>
            <Link href="/dashboard/payments" className="text-xs text-slate-500 underline">
              Tout voir
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {(recentPayments ?? []).map((payment) => {
              const student = Array.isArray(payment.students) ? payment.students[0] : payment.students;
              return (
                <li key={payment.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="text-slate-900">
                      {student ? `${student.last_name} ${student.first_name}` : "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(payment.paid_at).toLocaleDateString("fr-FR")} ·{" "}
                      {paymentMethodLabel(payment.payment_method)}
                    </p>
                  </div>
                  <span className="font-medium text-slate-900">{payment.amount}</span>
                </li>
              );
            })}
            {(recentPayments ?? []).length === 0 && (
              <li className="py-3 text-center text-xs text-slate-400">Aucun paiement enregistré.</li>
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Dernières dépenses</h2>
            <Link href="/dashboard/expenses" className="text-xs text-slate-500 underline">
              Tout voir
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {(recentExpenses ?? []).map((expense) => (
              <li key={expense.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-slate-900">{expense.label}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(expense.expense_date).toLocaleDateString("fr-FR")} ·{" "}
                    {expenseCategoryLabel(expense.category)}
                  </p>
                </div>
                <span className="font-medium text-slate-900">{expense.amount}</span>
              </li>
            ))}
            {(recentExpenses ?? []).length === 0 && (
              <li className="py-3 text-center text-xs text-slate-400">Aucune dépense enregistrée.</li>
            )}
          </ul>
        </section>
      </div>

      {cashManagerBreakdown.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Par responsable — année scolaire {school?.school_year_label ?? "en cours"}
          </h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 font-medium">Responsable</th>
                <th className="py-1 font-medium">Recette</th>
                <th className="py-1 font-medium">Dépense</th>
                <th className="py-1 font-medium">Solde</th>
              </tr>
            </thead>
            <tbody>
              {cashManagerBreakdown.map((manager) => (
                <tr key={manager.cashManagerId ?? "none"} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-900">{manager.name}</td>
                  <td className="py-1.5 text-green-700">{manager.collected}</td>
                  <td className="py-1.5 text-red-700">{manager.spent}</td>
                  <td className={`py-1.5 font-medium ${manager.solde >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {manager.solde}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 font-medium">
                <td className="py-1.5 text-slate-900">Compta finale — école</td>
                <td className="py-1.5 text-slate-900">{yearReport.totalCollected}</td>
                <td className="py-1.5 text-slate-900">{yearReport.totalExpenses}</td>
                <td className="py-1.5 text-slate-900">{yearReport.balance}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Mois en cours — {currentMonthReport?.label ?? ""}
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-50 p-3 sm:p-4">
            <p className="text-xs text-slate-500 sm:text-sm">Recette</p>
            <p className="mt-1 text-xl font-semibold text-green-700 sm:text-2xl">
              {currentMonthReport?.recettes ?? 0}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 sm:p-4">
            <p className="text-xs text-slate-500 sm:text-sm">Dépense</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">
              {currentMonthReport?.depenses ?? 0}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 sm:p-4">
            <p className="text-xs text-slate-500 sm:text-sm">Solde</p>
            <p
              className={`mt-1 text-xl font-semibold sm:text-2xl ${
                (currentMonthReport?.solde ?? 0) >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {currentMonthReport?.solde ?? 0}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
