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
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardHomeDict } from "@/lib/i18n/dictionaries/dashboard-home";
import { formatDate } from "@/lib/format";
import { schoolYearBounds } from "@/lib/school-year";
import { KpiGrid, type Kpi } from "./kpi-grid";

export default async function DashboardHomePage() {
  const appUser = await requireUser();
  const language = getLanguage();
  const t = dashboardHomeDict[language];
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
    { data: recentPayments },
    { data: recentExpenses },
  ] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    computeFinancialReport(supabase, from, to),
    computeMonthlyBreakdown(supabase, currentMonthFrom, currentMonthTo),
    computeCashManagerBreakdown(supabase, from, to),
    // Les échéances déjà exigibles aujourd'hui, qui servent à la fois au
    // "Restant dû" et au décompte des élèves impayés — mêmes lignes, donc
    // deux chiffres qui racontent forcément la même histoire.
    supabase
      .from("payment_schedules")
      .select("student_id, amount_remaining, students!inner(status)")
      .neq("status", "cancelled")
      .lte("due_date", today),
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

  const dueSchedules = outstandingSchedules ?? [];
  const totalReceivable = dueSchedules.reduce((sum, s) => sum + s.amount_remaining, 0);

  // Un élève est impayé s'il lui reste quelque chose à régler sur une
  // échéance déjà passée — c'est déduit des dates et des montants, pas lu
  // dans la colonne `status`. Ce statut n'est en effet recalculé que quand
  // on touche la ligne (création, paiement, réduction) : une échéance créée
  // en septembre pour le 5 octobre reste "pending" indéfiniment une fois le
  // 5 octobre passé, et l'élève n'apparaissait donc jamais comme impayé.
  //
  // Population identique à celle du tableau Recouvrement (élèves actifs),
  // pour que les deux écrans ne puissent pas afficher des comptes différents.
  const overdueStudentCount = new Set(
    dueSchedules
      .filter((s) => {
        const student = Array.isArray(s.students) ? s.students[0] : s.students;
        return s.amount_remaining > 0 && student?.status === "active";
      })
      .map((s) => s.student_id)
  ).size;
  const inscriptionCollected = yearReport.revenueByType.find((r) => r.key === "inscription")?.collected ?? 0;
  const uniformeCollected = yearReport.revenueByType.find((r) => r.key === "uniforme")?.collected ?? 0;
  const mensualiteCollected = yearReport.revenueByType.find((r) => r.key === "mensualite")?.collected ?? 0;
  const internatCollected = yearReport.revenueByType.find((r) => r.key === "internat")?.collected ?? 0;
  // Tout le reste (cantine, transport, renforcement, avances…) : avec
  // seulement Inscription et Uniforme à l'écran, leur somme ne retrouvait
  // pas les Recettes de l'année et l'école croyait à une erreur de calcul.
  const otherCollected =
    yearReport.totalCollected - inscriptionCollected - uniformeCollected - mensualiteCollected - internatCollected;
  // Le bilan de l'internat est réservé à la direction (comme les rapports).
  const canSeeInternat = appUser.role === "owner" || appUser.role === "admin" || appUser.role === "super_admin";

  // Première ligne : l'essentiel, en commençant par le nombre d'élèves
  // (demandé par l'école).
  const summaryKpis: Kpi[] = [
    { label: t.kpiStudents, value: studentCount ?? 0, tone: "neutral" as const },
    { label: t.kpiYearRevenue, value: yearReport.totalCollected, tone: "positive" as const, hint: t.kpiYearRevenueHint },
    { label: t.kpiYearExpenses, value: yearReport.totalExpenses, tone: "neutral" as const },
    {
      label: t.kpiBalance,
      value: yearReport.balance,
      tone: yearReport.balance >= 0 ? ("positive" as const) : ("negative" as const),
    },
    { label: t.kpiReceivable, value: totalReceivable, tone: "warning" as const },
    { label: t.kpiOverdueStudents, value: overdueStudentCount, tone: "negative" as const },
  ];
  // Deuxième ligne : le détail des recettes de l'année, qui s'additionnent
  // pour la retrouver. Une grille à part, à cinq colonnes, pour qu'elle soit
  // pleine elle aussi : à la suite de la première, elle laissait un trou au
  // bout de la ligne.
  const revenueDetailKpis: Kpi[] = [
    { label: t.kpiInscription, value: inscriptionCollected, tone: "positive" as const },
    { label: t.kpiUniform, value: uniformeCollected, tone: "positive" as const },
    { label: t.kpiMonthly, value: mensualiteCollected, tone: "positive" as const },
    {
      label: t.kpiInternat,
      value: internatCollected,
      tone: "positive" as const,
      hint: canSeeInternat ? t.kpiInternatHint : undefined,
      href: canSeeInternat ? "/dashboard/internat" : undefined,
    },
    { label: t.kpiOtherRevenue, value: otherCollected, tone: "positive" as const, hint: t.kpiOtherRevenueHint },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t.greeting(appUser.full_name ?? "")}</h1>
        <p className="text-sm text-slate-500">
          {t.overview(school?.school_year_label ?? t.ongoing)}.
        </p>
      </div>

      <div className="space-y-3">
        <KpiGrid kpis={summaryKpis} />
        <KpiGrid kpis={revenueDetailKpis} columns={5} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{t.recentPayments}</h2>
            <Link href="/dashboard/payments" className="text-xs text-slate-500 underline">
              {t.seeAll}
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
                      {formatDate(payment.paid_at, language)} ·{" "}
                      {paymentMethodLabel(payment.payment_method, language)}
                    </p>
                  </div>
                  <span className="font-medium text-slate-900">{payment.amount}</span>
                </li>
              );
            })}
            {(recentPayments ?? []).length === 0 && (
              <li className="py-3 text-center text-xs text-slate-400">{t.noPayments}</li>
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{t.recentExpenses}</h2>
            <Link href="/dashboard/expenses" className="text-xs text-slate-500 underline">
              {t.seeAll}
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {(recentExpenses ?? []).map((expense) => (
              <li key={expense.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-slate-900">{expense.label}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(expense.expense_date, language)} ·{" "}
                    {expenseCategoryLabel(expense.category, language)}
                  </p>
                </div>
                <span className="font-medium text-slate-900">{expense.amount}</span>
              </li>
            ))}
            {(recentExpenses ?? []).length === 0 && (
              <li className="py-3 text-center text-xs text-slate-400">{t.noExpenses}</li>
            )}
          </ul>
        </section>
      </div>

      {cashManagerBreakdown.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {t.byManager(school?.school_year_label ?? t.ongoing)}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{t.byManagerHint}</p>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 font-medium">{t.manager}</th>
                <th className="py-1 font-medium">{t.revenue}</th>
                <th className="py-1 font-medium">{t.expense}</th>
                <th className="py-1 font-medium">{t.balance}</th>
              </tr>
            </thead>
            <tbody>
              {cashManagerBreakdown.map((manager) => (
                <tr key={manager.cashManagerId ?? "none"} className="border-t border-slate-100">
                  {/* Cliquer sur un responsable ouvre la liste des paiements
                      derrière sa recette : sans elle, impossible de retrouver
                      d'où vient un montant qui ne colle pas aux reçus. */}
                  <td className="py-1.5">
                    <Link
                      href={`/dashboard/payments/by-manager?manager=${manager.cashManagerId ?? "none"}`}
                      className="text-slate-900 underline"
                    >
                      {manager.name}
                    </Link>
                  </td>
                  <td className="py-1.5">
                    <Link
                      href={`/dashboard/payments/by-manager?manager=${manager.cashManagerId ?? "none"}`}
                      className="text-green-700 underline"
                    >
                      {manager.collected}
                    </Link>
                  </td>
                  <td className="py-1.5 text-red-700">{manager.spent}</td>
                  <td className={`py-1.5 font-medium ${manager.solde >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {manager.solde}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 font-medium">
                <td className="py-1.5 text-slate-900">{t.finalAccounting}</td>
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
          {t.currentMonth(currentMonthReport?.label ?? "")}
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-50 p-3 sm:p-4">
            <p className="text-xs text-slate-500 sm:text-sm">{t.revenue}</p>
            <p className="mt-1 text-xl font-semibold text-green-700 sm:text-2xl">
              {currentMonthReport?.recettes ?? 0}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 sm:p-4">
            <p className="text-xs text-slate-500 sm:text-sm">{t.expense}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">
              {currentMonthReport?.depenses ?? 0}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 sm:p-4">
            <p className="text-xs text-slate-500 sm:text-sm">{t.balance}</p>
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
