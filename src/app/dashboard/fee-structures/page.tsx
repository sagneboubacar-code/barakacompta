import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  createFeeStructure,
  deleteFeeStructure,
  updateFeeStructureAmount,
  upsertClassFees,
} from "@/lib/actions/feeStructures";
import {
  OTHER_FEE_TYPES,
  REGIMES,
  feeTypeLabel,
  regimeLabel,
  mensualiteMonthsForSchoolYear,
} from "@/lib/constants/fees";
import { CYCLES, cycleLabel, sortByCycle } from "@/lib/constants/cycles";
import type { FeeRegime } from "@/types";
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardFeeStructuresDict } from "@/lib/i18n/dictionaries/dashboard-fee-structures";

type FeeRow = {
  id: string;
  class_id: string;
  regime: string;
  fee_type: string;
  month: number;
  amount: number;
  installments_allowed: boolean;
  academic_year: string;
};

export default async function FeeStructuresPage({
  searchParams,
}: {
  searchParams: {
    cycle?: string;
    class_id?: string;
    year?: string;
    regime?: string;
    error?: string;
    success?: string;
  };
}) {
  const appUser = await requireRole(["owner", "admin"]);
  const language = getLanguage();
  const t = dashboardFeeStructuresDict[language];
  const supabase = createClient();

  const [{ data: school }, { data: rawClasses }] = await Promise.all([
    supabase
      .from("schools")
      .select("school_year_label, school_year_start_month, school_year_end_month")
      .eq("id", appUser.school_id ?? "")
      .maybeSingle(),
    supabase.from("classes").select("id, name, level, sort_order").order("sort_order"),
  ]);
  const classes = sortByCycle(rawClasses ?? []);

  const resolvedYear = searchParams.year?.trim() || school?.school_year_label || "";
  const resolvedRegime: FeeRegime = searchParams.regime === "internat" ? "internat" : "externat";
  const mensualiteMonths = mensualiteMonthsForSchoolYear(
    school?.school_year_start_month ?? 9,
    school?.school_year_end_month ?? 6,
    language
  );

  const { data: feeStructures } = await supabase
    .from("fee_structures")
    .select("id, class_id, regime, fee_type, month, amount, installments_allowed, academic_year")
    .eq("academic_year", resolvedYear);

  const classesInScope = (classes ?? []).filter((klass) => {
    if (searchParams.class_id && klass.id !== searchParams.class_id) return false;
    if (searchParams.cycle && klass.level !== searchParams.cycle) return false;
    return true;
  });

  // Tableau principal (Inscription/Uniforme/Mensualités) : une entrée par
  // classe, pour le régime sélectionné uniquement.
  const mainFeesByClass = new Map<string, Map<string, FeeRow>>();
  // Autres frais (cantine/internat/transport/autre) : tous régimes confondus,
  // gérés à part comme avant.
  const otherFeesByClass = new Map<string, FeeRow[]>();

  for (const fee of (feeStructures ?? []) as FeeRow[]) {
    if (fee.fee_type === "inscription" || fee.fee_type === "uniforme" || fee.fee_type === "mensualite") {
      if (fee.regime !== resolvedRegime) continue;
      const map = mainFeesByClass.get(fee.class_id) ?? new Map<string, FeeRow>();
      map.set(`${fee.fee_type}:${fee.month}`, fee);
      mainFeesByClass.set(fee.class_id, map);
    } else {
      const list = otherFeesByClass.get(fee.class_id) ?? [];
      list.push(fee);
      otherFeesByClass.set(fee.class_id, list);
    }
  }

  const query = new URLSearchParams();
  if (searchParams.cycle) query.set("cycle", searchParams.cycle);
  if (searchParams.class_id) query.set("class_id", searchParams.class_id);
  if (resolvedYear) query.set("year", resolvedYear);
  query.set("regime", resolvedRegime);
  const redirectTo = `/dashboard/fee-structures?${query.toString()}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t.pageTitle}</h1>
        <p className="text-sm text-slate-500">
          {t.subtitle}
        </p>
      </div>

      {searchParams.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}
      {searchParams.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{searchParams.success}</p>
      )}

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.cycleLabel}</span>
          <select
            name="cycle"
            defaultValue={searchParams.cycle ?? ""}
            className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">{t.allCycles}</option>
            {CYCLES.map((cycle) => (
              <option key={cycle.key} value={cycle.key}>
                {cycleLabel(cycle.key, language)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.classLabel}</span>
          <select
            name="class_id"
            defaultValue={searchParams.class_id ?? ""}
            className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">{t.allClasses}</option>
            {(classes ?? []).map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.regimeLabel}</span>
          <select
            name="regime"
            defaultValue={resolvedRegime}
            className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {REGIMES.map((regime) => (
              <option key={regime.key} value={regime.key}>
                {regimeLabel(regime.key, language)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.schoolYearLabel}</span>
          <input
            name="year"
            defaultValue={resolvedYear}
            className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.filterButton}
        </button>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          {t.tariffsByClass(regimeLabel(resolvedRegime, language), resolvedYear || t.undefinedYear)}
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-2 font-medium">{t.mainTable.class}</th>
                <th className="py-1 pr-2 font-medium">{t.mainTable.inscription}</th>
                <th className="py-1 pr-2 font-medium">{t.mainTable.uniforme}</th>
                {mensualiteMonths.map((m) => (
                  <th key={m.month} className="py-1 pr-2 font-medium">
                    {t.mainTable.mensualite(m.label)}
                  </th>
                ))}
                <th className="py-1 pr-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {classesInScope.map((klass) => {
                const feeMap = mainFeesByClass.get(klass.id) ?? new Map<string, FeeRow>();
                const formId = `class-fees-${klass.id}`;
                return (
                  <tr key={klass.id} className="border-t border-slate-100">
                    <td className="py-1.5 pr-2 font-medium text-slate-900">{klass.name}</td>
                    <td className="py-1.5 pr-2">
                      <input
                        form={formId}
                        name="inscription"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={feeMap.get("inscription:0")?.amount ?? ""}
                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        form={formId}
                        name="uniforme"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={feeMap.get("uniforme:0")?.amount ?? ""}
                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    {mensualiteMonths.map((m) => (
                      <td key={m.month} className="py-1.5 pr-2">
                        <input
                          form={formId}
                          name={`mensualite_${m.month}`}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={feeMap.get(`mensualite:${m.month}`)?.amount ?? ""}
                          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>
                    ))}
                    <td className="py-1.5 pr-2">
                      <form id={formId} action={upsertClassFees} className="contents">
                        <input type="hidden" name="class_id" value={klass.id} />
                        <input type="hidden" name="regime" value={resolvedRegime} />
                        <input type="hidden" name="academic_year" value={resolvedYear} />
                        <input type="hidden" name="redirect_to" value={redirectTo} />
                        <button
                          type="submit"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          {t.saveButton}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {classesInScope.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-4 text-center text-xs text-slate-400">
                    {t.noClassMatch}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {t.emptyCellHint}
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t.otherFeesTitle}</h2>
        <div className="mt-3 space-y-6">
          {classesInScope.map((klass) => {
            const fees = otherFeesByClass.get(klass.id) ?? [];
            const existingKeys = new Set(fees.map((f) => `${f.regime}:${f.fee_type}`));
            const missingCombos = REGIMES.flatMap((regime) =>
              OTHER_FEE_TYPES.filter((feeType) => !existingKeys.has(`${regime.key}:${feeType.key}`)).map(
                (feeType) => ({ regime, feeType })
              )
            );

            return (
              <div key={klass.id}>
                <h3 className="text-sm font-medium text-slate-700">{klass.name}</h3>
                <div className="mt-2 space-y-2">
                  {fees.map((fee) => (
                    <div key={fee.id} className="flex items-center gap-2">
                      <span className="w-20 text-xs text-slate-500">{regimeLabel(fee.regime, language)}</span>
                      <span className="w-24 text-xs text-slate-500">{feeTypeLabel(fee.fee_type, language)}</span>
                      <form action={updateFeeStructureAmount} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={fee.id} />
                        <input type="hidden" name="redirect_to" value={redirectTo} />
                        <input
                          name="amount"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={fee.amount}
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                        />
                        <button
                          type="submit"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          {t.saveButton}
                        </button>
                      </form>
                      <form action={deleteFeeStructure}>
                        <input type="hidden" name="id" value={fee.id} />
                        <input type="hidden" name="redirect_to" value={redirectTo} />
                        <button
                          type="submit"
                          className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          {t.deleteButton}
                        </button>
                      </form>
                    </div>
                  ))}
                  {fees.length === 0 && (
                    <p className="text-xs text-slate-400">{t.noOtherFees}</p>
                  )}
                </div>

                {missingCombos.length > 0 && (
                  <form
                    action={createFeeStructure}
                    className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2"
                  >
                    <input type="hidden" name="class_id" value={klass.id} />
                    <input type="hidden" name="redirect_to" value={redirectTo} />
                    <select name="regime" className="rounded-md border border-slate-300 px-2 py-1 text-sm">
                      {REGIMES.map((regime) => (
                        <option key={regime.key} value={regime.key}>
                          {regimeLabel(regime.key, language)}
                        </option>
                      ))}
                    </select>
                    <select name="fee_type" className="rounded-md border border-slate-300 px-2 py-1 text-sm">
                      {OTHER_FEE_TYPES.map((feeType) => (
                        <option key={feeType.key} value={feeType.key}>
                          {feeTypeLabel(feeType.key, language)}
                        </option>
                      ))}
                    </select>
                    <input
                      name="academic_year"
                      defaultValue={resolvedYear}
                      className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <input
                      name="amount"
                      type="number"
                      min="0"
                      step="1"
                      placeholder={t.amountPlaceholder}
                      required
                      className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <label className="flex items-center gap-1 text-xs text-slate-600">
                      <input type="checkbox" name="installments_allowed" defaultChecked />
                      {t.installmentAllowed}
                    </label>
                    <button
                      type="submit"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      {t.addTariff}
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
