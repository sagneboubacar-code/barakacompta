import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { CYCLES, cycleLabel, sortByCycle } from "@/lib/constants/cycles";
import { formatMonthLabel } from "@/lib/constants/months";
import { computeCollectionsReport, type CollectionsColorStatus } from "@/lib/reports/collections";
import { PrintButton } from "@/components/PrintButton";
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardCollectionsDict } from "@/lib/i18n/dictionaries/dashboard-collections";

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
  };
  const supabase = createClient();

  const [{ data: rawClasses }, { data: school }, report] = await Promise.all([
    supabase.from("classes").select("id, name, level, sort_order").order("sort_order"),
    supabase.from("schools").select("name, address").eq("id", appUser.school_id ?? "").maybeSingle(),
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

  const { rows, availableMonths, selectedMonth, overdueCount, totalDue } = report;

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
          <p className="text-sm text-slate-500">
            {t.summary(overdueCount, formatMonthLabel(selectedMonth, language), totalDue)}
          </p>
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

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{t.colStudent}</th>
              <th className="px-4 py-2 font-medium">{t.colClass}</th>
              <th className="px-4 py-2 font-medium">{t.colParent}</th>
              <th className="px-4 py-2 font-medium">{t.colParentPhone}</th>
              <th className="px-4 py-2 font-medium">{t.colRemaining}</th>
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
                  <td className="px-4 py-2 text-slate-900">{row.totalRemaining}</td>
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
