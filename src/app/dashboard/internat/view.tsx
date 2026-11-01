import Link from "next/link";
import type { Language } from "@/lib/i18n/config";
import type { InternatReport } from "@/lib/reports/internat";
import { dashboardInternatDict } from "@/lib/i18n/dictionaries/dashboard-internat";
import { expenseCategoryLabel } from "@/lib/constants/expenses";
import { formatCurrency, formatSignedCurrency, formatDate } from "@/lib/format";

// Affichage seul (sans requête) : la page calcule le bilan, cette vue le
// présente.
export function InternatView({
  language,
  currency,
  report,
  yearFrom,
  yearTo,
}: {
  language: Language;
  currency: string;
  report: InternatReport;
  yearFrom: string;
  yearTo: string;
}) {
  const t = dashboardInternatDict[language];
  const money = (amount: number) => formatCurrency(amount, currency, language);
  const isWholeYear = report.from === yearFrom && report.to === yearTo;

  const tiles: { label: string; value: string; tone: string; href?: string; hint?: string }[] = [
    {
      label: t.tileBoarders,
      value: String(report.boarders),
      tone: "text-slate-900",
      // Les mêmes élèves que ce nombre : inscrits, au régime internat.
      href: "/dashboard/students?regime=internat&status=active",
      hint: t.seeBoarders,
    },
    { label: t.tileCollected, value: money(report.collected), tone: "text-green-700" },
    { label: t.tileSpent, value: money(report.spent), tone: "text-red-700" },
    {
      label: t.tileBalance,
      value: formatSignedCurrency(report.balance, currency, language),
      tone: report.balance >= 0 ? "text-green-700" : "text-red-700",
    },
    { label: t.tileReceivable, value: money(report.receivable), tone: "text-orange-700" },
    { label: t.tileLate, value: String(report.late.length), tone: "text-red-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t.title}</h1>
        <p className="text-sm text-slate-500">{t.subtitle}</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.from}</span>
          <input
            name="from"
            type="date"
            defaultValue={report.from}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.to}</span>
          <input
            name="to"
            type="date"
            defaultValue={report.to}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.filter}
        </button>
        {!isWholeYear && (
          <Link href="/dashboard/internat" className="py-1.5 text-sm text-slate-600 underline">
            {t.wholeYear}
          </Link>
        )}
        <p className="w-full text-xs text-slate-500">
          {t.period(formatDate(report.from, language), formatDate(report.to, language))}
        </p>
      </form>

      {/* Trois cases par ligne au plus : avec des montants comme
          « +392 250 F CFA », six cases côte à côte débordaient de leur cadre. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => {
          const content = (
            <>
              <p className="text-xs text-slate-500 sm:text-sm">{tile.label}</p>
              <p className={`mt-1 text-base font-semibold tabular-nums sm:text-xl ${tile.tone}`}>{tile.value}</p>
              {tile.hint && <p className="mt-1 text-[11px] leading-snug text-slate-400">{tile.hint}</p>}
            </>
          );
          const className = "rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4";
          return tile.href ? (
            <Link key={tile.label} href={tile.href} className={`${className} block hover:border-slate-400`}>
              {content}
            </Link>
          ) : (
            <div key={tile.label} className={className}>
              {content}
            </div>
          );
        })}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t.byMonthTitle}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1.5 font-medium">{t.colMonth}</th>
                <th className="py-1.5 text-right font-medium">{t.colRevenue}</th>
                <th className="py-1.5 text-right font-medium">{t.colExpense}</th>
                <th className="py-1.5 text-right font-medium">{t.colBalance}</th>
              </tr>
            </thead>
            <tbody>
              {report.months.map((month) =>
                // Mois sans aucun mouvement (à venir, le plus souvent) : un
                // tiret, pour que les mois actifs ressortent.
                month.recettes === 0 && month.depenses === 0 ? (
                  <tr key={month.key} className="border-t border-slate-100 text-slate-300">
                    <td className="py-1.5 text-slate-500">{month.label}</td>
                    <td className="py-1.5 text-right">{t.dash}</td>
                    <td className="py-1.5 text-right">{t.dash}</td>
                    <td className="py-1.5 text-right">{t.dash}</td>
                  </tr>
                ) : (
                  <tr key={month.key} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-900">{month.label}</td>
                    <td className="py-1.5 text-right tabular-nums text-green-700">{money(month.recettes)}</td>
                    <td className="py-1.5 text-right tabular-nums text-red-700">{money(month.depenses)}</td>
                    <td
                      className={`py-1.5 text-right font-medium tabular-nums ${
                        month.solde >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {formatSignedCurrency(month.solde, currency, language)}
                    </td>
                  </tr>
                )
              )}
              <tr className="border-t-2 border-slate-900 font-semibold">
                <td className="py-1.5 text-slate-900">{t.total}</td>
                <td className="py-1.5 text-right tabular-nums text-green-700">{money(report.collected)}</td>
                <td className="py-1.5 text-right tabular-nums text-red-700">{money(report.spent)}</td>
                <td
                  className={`py-1.5 text-right tabular-nums ${report.balance >= 0 ? "text-green-700" : "text-red-700"}`}
                >
                  {formatSignedCurrency(report.balance, currency, language)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{t.expensesTitle}</h2>
          <div className="flex gap-3 text-xs">
            <Link href="/dashboard/expenses" className="text-slate-900 underline">
              {t.addExpense}
            </Link>
            <Link
              href={`/dashboard/expenses?section=internat&from=${report.from}&to=${report.to}`}
              className="text-slate-500 underline"
            >
              {t.seeInExpenses}
            </Link>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">{t.expensesHint}</p>
        {report.expenses.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">{t.noExpenses}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1.5 font-medium">{t.colDate}</th>
                  <th className="py-1.5 font-medium">{t.colCategory}</th>
                  <th className="py-1.5 font-medium">{t.colDescription}</th>
                  <th className="py-1.5 text-right font-medium">{t.colAmount}</th>
                </tr>
              </thead>
              <tbody>
                {report.expenses.map((expense) => (
                  <tr key={expense.id} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">{formatDate(expense.date, language)}</td>
                    <td className="py-1.5 text-slate-600">{expenseCategoryLabel(expense.category, language)}</td>
                    <td className="py-1.5 text-slate-900">{expense.label}</td>
                    <td className="py-1.5 text-right tabular-nums text-red-700">{money(expense.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t.lateTitle}</h2>
        <p className="mt-1 text-xs text-slate-500">{t.lateHint}</p>
        {report.late.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">{t.noLate}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1.5 font-medium">{t.colStudent}</th>
                  <th className="py-1.5 font-medium">{t.colClass}</th>
                  <th className="py-1.5 font-medium">{t.colLateMonths}</th>
                  <th className="py-1.5 text-right font-medium">{t.colRemaining}</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {report.late.map((boarder) => (
                  <tr key={boarder.studentId} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-900">{boarder.name}</td>
                    <td className="py-1.5 text-slate-600">{boarder.klass ?? t.dash}</td>
                    <td className="py-1.5 text-slate-600">{boarder.lateMonths}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums text-orange-700">
                      {money(boarder.remaining)}
                    </td>
                    <td className="py-1.5 text-right">
                      <Link href={`/dashboard/students/${boarder.studentId}`} className="text-xs text-slate-600 underline">
                        {t.seeStudent}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
