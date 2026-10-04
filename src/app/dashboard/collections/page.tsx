import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { CYCLES, cycleLabel, sortByCycle } from "@/lib/constants/cycles";
import { formatMonthLabel } from "@/lib/constants/months";
import { computeCollectionsReport, type CollectionsColorStatus } from "@/lib/reports/collections";
import { PrintButton } from "@/components/PrintButton";
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardCollectionsDict } from "@/lib/i18n/dictionaries/dashboard-collections";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: { cycle?: string; class_id?: string; month?: string };
}) {
  const appUser = await requireRole(["owner", "admin"]);
  const language = getLanguage();
  const t = dashboardCollectionsDict[language];
  const STATUS_STYLES: Record<CollectionsColorStatus, { label: string; className: string }> = {
    vert: { label: t.statusOk, className: "border-green-200 bg-green-50 text-green-700" },
    orange: { label: t.statusPartial, className: "border-orange-200 bg-orange-50 text-orange-700" },
    rouge: { label: t.statusOverdue, className: "border-red-200 bg-red-50 text-red-700" },
    attente: { label: t.statusUpcoming, className: "border-sky-200 bg-sky-50 text-sky-800" },
  };
  const supabase = createClient();

  const [{ data: rawClasses }, { data: school }, report] = await Promise.all([
    supabase.from("classes").select("id, name, level, sort_order").order("sort_order"),
    supabase.from("schools").select("name, address, currency").eq("id", appUser.school_id ?? "").maybeSingle(),
    computeCollectionsReport(
      supabase,
      {
        cycle: searchParams.cycle,
        classId: searchParams.class_id,
        month: searchParams.month,
      },
      language
    ),
  ]);
  const classes = sortByCycle(rawClasses ?? []);

  const {
    rows,
    availableMonths,
    selectedMonth,
    overdueCount,
    expectedTotal,
    collectedTotal,
    totalDue,
    overdueTotal,
    upcomingTotal,
    upcomingDueDate,
  } = report;
  const money = (amount: number) => formatCurrency(amount, school?.currency, language);
  const monthLabel = formatMonthLabel(selectedMonth, language);

  const exportParams = new URLSearchParams();
  if (searchParams.cycle) exportParams.set("cycle", searchParams.cycle);
  if (searchParams.class_id) exportParams.set("class_id", searchParams.class_id);
  exportParams.set("month", selectedMonth);

  return (
    <div className="space-y-6">
      <div className="hidden text-center print:block">
        <h1 className="text-lg font-semibold text-slate-900">{school?.name}</h1>
        <p className="text-xs text-slate-500">{school?.address}</p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 print:hidden">{t.title}</h1>
          <p className="text-sm text-slate-500">{t.summary(overdueCount, monthLabel)}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
          <a
            href={`/api/reports/collections/csv?${exportParams.toString()}`}
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
          <span className="text-slate-600">{t.cycle}</span>
          <select
            name="cycle"
            defaultValue={searchParams.cycle ?? ""}
            className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">{t.all}</option>
            {CYCLES.map((cycle) => (
              <option key={cycle.key} value={cycle.key}>
                {cycleLabel(cycle.key, language)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.class}</span>
          <select
            name="class_id"
            defaultValue={searchParams.class_id ?? ""}
            className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">{t.allFem}</option>
            {(classes ?? []).map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.month}</span>
          <select
            name="month"
            defaultValue={selectedMonth}
            className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {!availableMonths.includes(selectedMonth) && (
              <option value={selectedMonth}>{formatMonthLabel(selectedMonth, language)}</option>
            )}
            {availableMonths.map((month) => (
              <option key={month} value={month}>
                {formatMonthLabel(month, language)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.filter}
        </button>
      </form>

      {/* Le montant du mois choisi, en grand : c'est la question qu'on vient
          poser à cette page. Le total de l'année reste au tableau de bord. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t.tileTotal(monthLabel)}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{money(expectedTotal)}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t.tileTotalHint}</p>
          <p className="mt-2 text-xs text-slate-600">
            {t.tileCollected} <strong className="text-green-700">{money(collectedTotal)}</strong>
            {" · "}
            {t.tileRemaining} <strong className="text-slate-900">{money(totalDue)}</strong>
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-red-700">{t.tileOverdue}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-red-700">{money(overdueTotal)}</p>
          <p className="mt-0.5 text-xs text-red-700/80">{t.tileOverdueHint}</p>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-800">{t.tileUpcoming}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-800">{money(upcomingTotal)}</p>
          <p className="mt-0.5 text-xs text-sky-800/80">
            {upcomingDueDate ? t.tileUpcomingHint(formatDate(upcomingDueDate, language)) : t.tileUpcomingNone}
          </p>
        </div>
      </div>

      {/* overflow-x-auto et non overflow-hidden : `hidden` coupait purement et
          simplement les dernières colonnes sur téléphone, sans moyen d'y accéder.
          La largeur minimale est indispensable — sans elle, `w-full` écrase les
          colonnes dans les 375 px et le défilement ne se déclenche jamais. */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-[700px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{t.colStudent}</th>
              <th className="px-4 py-2 font-medium">{t.colClass}</th>
              <th className="px-4 py-2 font-medium">{t.colParent}</th>
              <th className="px-4 py-2 font-medium">{t.colParentPhone}</th>
              <th className="px-4 py-2 font-medium">{t.colRemaining(monthLabel)}</th>
              <th className="px-4 py-2 font-medium">{t.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const style = STATUS_STYLES[row.colorStatus];
              return (
                <tr key={row.id} className={`border-t border-s-4 ${style.className}`}>
                  <td className="px-4 py-2 text-slate-900">{row.name}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {row.className} ({row.cycle})
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.guardianName}</td>
                  <td className="px-4 py-2 text-slate-600">{row.guardianPhone}</td>
                  <td className="px-4 py-2 tabular-nums text-slate-900">{money(row.totalRemaining)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${style.className}`}
                    >
                      {style.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {t.noStudents}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
