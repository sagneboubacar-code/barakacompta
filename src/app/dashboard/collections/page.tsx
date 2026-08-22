import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { CYCLES, sortByCycle } from "@/lib/constants/cycles";
import { formatMonthLabel } from "@/lib/constants/months";
import { computeCollectionsReport, type CollectionsColorStatus } from "@/lib/reports/collections";
import { PrintButton } from "@/components/PrintButton";

const STATUS_STYLES: Record<CollectionsColorStatus, { label: string; className: string }> = {
  vert: { label: "À jour", className: "border-green-200 bg-green-50 text-green-700" },
  orange: { label: "Partiel ce mois", className: "border-orange-200 bg-orange-50 text-orange-700" },
  rouge: { label: "Impayé", className: "border-red-200 bg-red-50 text-red-700" },
};

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: { cycle?: string; class_id?: string; month?: string };
}) {
  const appUser = await requireRole(["owner", "admin"]);
  const supabase = createClient();

  const [{ data: rawClasses }, { data: school }, report] = await Promise.all([
    supabase.from("classes").select("id, name, level, sort_order").order("sort_order"),
    supabase.from("schools").select("name, address").eq("id", appUser.school_id ?? "").maybeSingle(),
    computeCollectionsReport(supabase, {
      cycle: searchParams.cycle,
      classId: searchParams.class_id,
      month: searchParams.month,
    }),
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
          <h1 className="text-xl font-semibold text-slate-900 print:hidden">Recouvrement</h1>
          <p className="text-sm text-slate-500">
            {overdueCount} élève{overdueCount > 1 ? "s" : ""} impayé{overdueCount > 1 ? "s" : ""} sur{" "}
            {formatMonthLabel(selectedMonth)} · {totalDue} restant dû pour ce mois.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
          <a
            href={`/api/reports/collections/csv?${exportParams.toString()}`}
            className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Export Excel
          </a>
        </div>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 print:hidden"
      >
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Cycle</span>
          <select
            name="cycle"
            defaultValue={searchParams.cycle ?? ""}
            className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            {CYCLES.map((cycle) => (
              <option key={cycle.key} value={cycle.key}>
                {cycle.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Classe</span>
          <select
            name="class_id"
            defaultValue={searchParams.class_id ?? ""}
            className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Toutes</option>
            {(classes ?? []).map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Mois</span>
          <select
            name="month"
            defaultValue={selectedMonth}
            className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {!availableMonths.includes(selectedMonth) && (
              <option value={selectedMonth}>{formatMonthLabel(selectedMonth)}</option>
            )}
            {availableMonths.map((month) => (
              <option key={month} value={month}>
                {formatMonthLabel(month)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Filtrer
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Élève</th>
              <th className="px-4 py-2 font-medium">Classe</th>
              <th className="px-4 py-2 font-medium">Parent</th>
              <th className="px-4 py-2 font-medium">Téléphone parent</th>
              <th className="px-4 py-2 font-medium">Montant restant (mois)</th>
              <th className="px-4 py-2 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const style = STATUS_STYLES[row.colorStatus];
              return (
                <tr key={row.id} className={`border-t border-l-4 ${style.className}`}>
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
                  Aucun élève ne correspond à ces critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
