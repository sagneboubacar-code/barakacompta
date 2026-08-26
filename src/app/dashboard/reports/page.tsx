import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  computeFinancialReport,
  computeDailyBreakdown,
  computeCashManagerBreakdown,
} from "@/lib/reports/financial";
import { formatCurrency, formatSignedCurrency, formatDate } from "@/lib/format";
import { expenseCategoryLabel } from "@/lib/constants/expenses";
import { PrintButton } from "@/components/PrintButton";
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardReportsDict } from "@/lib/i18n/dictionaries/dashboard-reports";

function currentMonthBounds() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

// En-tête de section commun aux tableaux : petite étiquette capitale +
// filet — pense "relevé de compte", pas "carte de dashboard".
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b-2 border-slate-900 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </h2>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const appUser = await requireRole(["owner", "admin"]);
  const language = getLanguage();
  const t = dashboardReportsDict[language];
  const supabase = createClient();

  const defaults = currentMonthBounds();
  const from = searchParams.from || defaults.from;
  const to = searchParams.to || defaults.to;

  const [{ data: school }, report, dailyBreakdown, cashManagerBreakdown, { count: activeDiscountCount }] =
    await Promise.all([
      supabase.from("schools").select("name, address, currency").eq("id", appUser.school_id ?? "").maybeSingle(),
      computeFinancialReport(supabase, from, to),
      computeDailyBreakdown(supabase, from, to),
      computeCashManagerBreakdown(supabase, from, to),
      supabase
        .from("discounts")
        .select("id", { count: "exact", head: true })
        .lte("starts_on", to)
        .gte("ends_on", from),
    ]);

  const currency = school?.currency ?? "XOF";
  const money = (amount: number) => formatCurrency(amount, currency, language);
  const exportParams = `from=${from}&to=${to}`;
  const generatedAt = new Date().toLocaleString(language === "ar" ? "ar-SN" : "fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const summaryTiles = [
    { label: t.tileExpected, value: report.totalExpected, accent: "border-t-slate-400 text-slate-900" },
    { label: t.tileCollected, value: report.totalCollected, accent: "border-t-emerald-600 text-emerald-700" },
    { label: t.tileRemaining, value: report.totalRemaining, accent: "border-t-amber-500 text-amber-700" },
    {
      label: t.tileBalance,
      value: report.balance,
      accent:
        report.balance >= 0 ? "border-t-emerald-600 text-emerald-700" : "border-t-rose-600 text-rose-700",
    },
  ];

  return (
    <div className="space-y-8 print:space-y-6">
      {/* En-tête document : visible à l'écran ET à l'impression, contrairement
          à l'ancien bloc réservé à l'impression — c'est le même document. */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between print:border-slate-900">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {school?.name ?? "Baraka Compta"}
            {school?.address ? ` · ${school.address}` : ""}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{t.pageTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t.period(formatDate(from, language), formatDate(to, language))}
            <span className="print:inline hidden">{t.generatedAt(generatedAt)}</span>
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
          <a
            href={`/api/reports/financial/csv?${exportParams}`}
            className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {t.exportExcel}
          </a>
        </div>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 print:hidden"
      >
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.filterFrom}</span>
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.filterTo}</span>
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.apply}
        </button>
      </form>

      {/* Bandeau chiffres clés : filet coloré en tête de tuile + chiffres en
          monospace tabulaire — signature visuelle du document, cohérente
          avec les tableaux ci-dessous. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:gap-2">
        {summaryTiles.map((tile) => (
          <div
            key={tile.label}
            className={`border-t-2 bg-white p-4 shadow-sm print:border print:border-t-2 print:shadow-none ${tile.accent}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{tile.label}</p>
            <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums">{money(tile.value)}</p>
          </div>
        ))}
      </div>

      <section className="break-inside-avoid space-y-3">
        <SectionHeading>{t.sectionRevenue}</SectionHeading>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-400">
              <th className="py-2 font-medium">{t.colType}</th>
              <th className="py-2 text-right font-medium">{t.colExpected}</th>
              <th className="py-2 text-right font-medium">{t.colCollected}</th>
              <th className="py-2 text-right font-medium">{t.colRemaining}</th>
            </tr>
          </thead>
          <tbody>
            {report.revenueByType.map((bucket) => (
              <tr key={bucket.key} className="border-t border-slate-100">
                <td className="py-2 text-slate-900">{t.revenueLabels[bucket.key] ?? bucket.label}</td>
                <td className="py-2 text-right font-mono tabular-nums text-slate-600">
                  {money(bucket.expected)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-emerald-700">
                  {money(bucket.collected)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-amber-700">
                  {money(bucket.remaining)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-900 font-semibold">
              <td className="py-2 text-slate-900">{t.total}</td>
              <td className="py-2 text-right font-mono tabular-nums text-slate-900">
                {money(report.totalExpected)}
              </td>
              <td className="py-2 text-right font-mono tabular-nums text-emerald-700">
                {money(report.totalCollected)}
              </td>
              <td className="py-2 text-right font-mono tabular-nums text-amber-700">
                {money(report.totalRemaining)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="break-inside-avoid space-y-3">
        <SectionHeading>{t.sectionExpenses}</SectionHeading>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-400">
              <th className="py-2 font-medium">{t.colCategory}</th>
              <th className="py-2 text-right font-medium">{t.colAmount}</th>
            </tr>
          </thead>
          <tbody>
            {report.expensesByCategory.map((category) => (
              <tr key={category.key} className="border-t border-slate-100">
                <td className="py-2 text-slate-900">{expenseCategoryLabel(category.key, language)}</td>
                <td className="py-2 text-right font-mono tabular-nums text-rose-700">
                  {money(category.amount)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-900 font-semibold">
              <td className="py-2 text-slate-900">{t.total}</td>
              <td className="py-2 text-right font-mono tabular-nums text-rose-700">
                {money(report.totalExpenses)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {cashManagerBreakdown.length > 0 && (
        <section className="break-inside-avoid space-y-3">
          <SectionHeading>{t.sectionByManager}</SectionHeading>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 font-medium">{t.colManager}</th>
                <th className="py-2 text-right font-medium">{t.colRevenue}</th>
                <th className="py-2 text-right font-medium">{t.colExpense}</th>
                <th className="py-2 text-right font-medium">{t.colBalance}</th>
              </tr>
            </thead>
            <tbody>
              {cashManagerBreakdown.map((manager) => (
                <tr key={manager.cashManagerId ?? "none"} className="border-t border-slate-100">
                  <td className="py-2 text-slate-900">
                    {manager.cashManagerId === null ? t.unassigned : manager.name}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-emerald-700">
                    {money(manager.collected)}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-rose-700">
                    {money(manager.spent)}
                  </td>
                  <td
                    className={`py-2 text-right font-mono font-medium tabular-nums ${
                      manager.solde >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {formatSignedCurrency(manager.solde, currency, language)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-900 font-semibold">
                <td className="py-2 text-slate-900">{t.finalAccounting}</td>
                <td className="py-2 text-right font-mono tabular-nums text-emerald-700">
                  {money(report.totalCollected)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-rose-700">
                  {money(report.totalExpenses)}
                </td>
                <td
                  className={`py-2 text-right font-mono tabular-nums ${
                    report.balance >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {formatSignedCurrency(report.balance, currency, language)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeading>{t.sectionDaily}</SectionHeading>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-400">
              <th className="py-2 font-medium">{t.colDate}</th>
              <th className="py-2 text-right font-medium">{t.colRevenues}</th>
              <th className="py-2 text-right font-medium">{t.colExpenses}</th>
              <th className="py-2 text-right font-medium">{t.colBalance}</th>
            </tr>
          </thead>
          <tbody>
            {dailyBreakdown.map((day) => {
              const isQuiet = day.recettes === 0 && day.depenses === 0;
              return (
                <tr
                  key={day.key}
                  className={`break-inside-avoid border-t border-slate-100 even:bg-slate-50/60 ${
                    isQuiet ? "text-slate-300" : ""
                  }`}
                >
                  <td className={`py-1.5 ${isQuiet ? "" : "text-slate-900"}`}>{day.label}</td>
                  <td
                    className={`py-1.5 text-right font-mono tabular-nums ${
                      isQuiet ? "" : "text-emerald-700"
                    }`}
                  >
                    {isQuiet ? "—" : money(day.recettes)}
                  </td>
                  <td
                    className={`py-1.5 text-right font-mono tabular-nums ${isQuiet ? "" : "text-rose-700"}`}
                  >
                    {isQuiet ? "—" : money(day.depenses)}
                  </td>
                  <td className={`py-1.5 text-right font-mono tabular-nums ${isQuiet ? "" : "font-medium"}`}>
                    {isQuiet ? "—" : formatSignedCurrency(day.solde, currency, language)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-slate-900 font-semibold">
              <td className="py-2 text-slate-900">{t.total}</td>
              <td className="py-2 text-right font-mono tabular-nums text-emerald-700">
                {money(dailyBreakdown.reduce((sum, d) => sum + d.recettes, 0))}
              </td>
              <td className="py-2 text-right font-mono tabular-nums text-rose-700">
                {money(dailyBreakdown.reduce((sum, d) => sum + d.depenses, 0))}
              </td>
              <td className="py-2 text-right font-mono tabular-nums text-slate-900">
                {formatSignedCurrency(dailyBreakdown.reduce((sum, d) => sum + d.solde, 0), currency, language)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <p className="text-xs text-slate-500 print:hidden">{t.discountCount(activeDiscountCount ?? 0)}</p>

      {/* Bloc de signature : uniquement à l'impression — le rapport écran
          n'a pas besoin d'être "validé", le papier remis à la direction si. */}
      <div className="hidden grid-cols-2 gap-12 pt-10 text-xs text-slate-500 print:grid">
        <div>
          <p className="border-t border-slate-400 pt-1.5">{t.signedBy}</p>
        </div>
        <div>
          <p className="border-t border-slate-400 pt-1.5">{t.verifiedBy}</p>
        </div>
      </div>
    </div>
  );
}
