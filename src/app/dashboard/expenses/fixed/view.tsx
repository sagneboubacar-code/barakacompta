import Link from "next/link";
import type { Language } from "@/lib/i18n/config";
import { dashboardFixedExpensesDict } from "@/lib/i18n/dictionaries/dashboard-fixed-expenses";
import { EXPENSE_CATEGORIES, expenseCategoryLabel } from "@/lib/constants/expenses";
import { formatMonthLabel } from "@/lib/constants/months";
import { formatCurrency } from "@/lib/format";
import {
  createFixedExpenseLine,
  deleteFixedExpenseLine,
  recordFixedExpenses,
  updateFixedExpenseLine,
} from "@/lib/actions/fixedExpenses";
import { FixedExpenseLines, type FixedExpenseRow } from "@/components/FixedExpenseLines";

// Affichage seul (sans requête) : la page lit la base, cette vue présente le
// mois puis la liste.
export function FixedExpensesView({
  language,
  currency,
  period,
  periods,
  rows,
  cashManagers,
  canManage,
  today,
  error,
  success,
}: {
  language: Language;
  currency: string;
  period: string;
  periods: { key: string; label: string }[];
  rows: FixedExpenseRow[];
  cashManagers: { id: string; name: string }[];
  canManage: boolean;
  today: string;
  error?: string;
  success?: string;
}) {
  const t = dashboardFixedExpensesDict[language];
  const money = (amount: number) => formatCurrency(amount, currency, language);
  const monthLabel = formatMonthLabel(period, language);
  const allRecorded = rows.length > 0 && rows.every((row) => row.recorded);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/expenses" className="text-xs text-slate-500 underline">
          {t.backToExpenses}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{t.title}</h1>
        <p className="text-sm text-slate-500">{t.subtitle}</p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.month}</span>
            <select
              name="period"
              defaultValue={period}
              className="block w-44 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {periods.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            {t.show}
          </button>
        </form>

        <h2 className="mt-5 text-sm font-semibold text-slate-900">{t.monthTitle(monthLabel)}</h2>

        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{canManage ? t.noLines : t.noLinesAccountant}</p>
        ) : (
          <form action={recordFixedExpenses} className="mt-2">
            <input type="hidden" name="period" value={period} />
            {allRecorded && <p className="mb-2 text-sm text-green-700">{t.allRecorded(monthLabel)}</p>}
            {/* `key` : un autre mois repart des montants habituels, pas de
                la saisie du mois précédent. */}
            <FixedExpenseLines
              key={period}
              rows={rows}
              currency={currency}
              language={language}
              labels={{
                recordedOn: t.recordedOn("{date}"),
                hoursPlaceholder: t.hoursPlaceholder,
                hoursUnit: t.hoursUnit,
                hoursMissing: t.hoursMissing,
                amountMissing: t.amountMissing,
                perHour: t.perHour,
                total: t.total,
                submit: t.submit,
                internatTag: t.internatTag,
              }}
            >
              <div className="flex flex-wrap items-end gap-3">
                <label className="space-y-1 text-sm">
                  <span className="text-slate-600">{t.paidOn}</span>
                  <input
                    name="expense_date"
                    type="date"
                    defaultValue={today}
                    required
                    className="block rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                {cashManagers.length > 0 && (
                  <label className="space-y-1 text-sm">
                    <span className="text-slate-600">{t.manager}</span>
                    <select
                      name="cash_manager_id"
                      defaultValue=""
                      className="block w-44 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">—</option>
                      {cashManagers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </FixedExpenseLines>
            {rows.some((row) => row.recorded) && <p className="mt-3 text-xs text-slate-500">{t.recordedHint}</p>}
          </form>
        )}
      </section>

      {canManage && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t.listTitle}</h2>
          <p className="mt-1 text-xs text-slate-500">{t.listHint}</p>

          {rows.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 py-2.5 text-sm">
                  <div className="min-w-[10rem] flex-1">
                    <p className="font-medium text-slate-900">
                      {row.label}
                      {row.internat && (
                        <span className="ms-2 whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-normal text-indigo-700">
                          {t.internatTag}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.categoryLabel} ·{" "}
                      {row.pay_mode === "hourly"
                        ? t.rateLabel(money(Number(row.hourly_rate)))
                        : t.monthlyLabel(money(row.amount))}
                    </p>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-xs text-slate-600 underline">{t.edit}</summary>
                    <LineForm
                      action={updateFixedExpenseLine}
                      period={period}
                      language={language}
                      submitLabel={t.save}
                      line={row}
                    />
                  </details>
                  <form action={deleteFixedExpenseLine}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="period" value={period} />
                    <button
                      type="submit"
                      className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      {t.delete}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <details className="mt-4 border-t border-slate-100 pt-3" open={rows.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-slate-900">{t.addTitle}</summary>
            <LineForm action={createFixedExpenseLine} period={period} language={language} submitLabel={t.add} />
          </details>
        </section>
      )}
    </div>
  );
}

// Formulaire d'une ligne de la liste (ajout ou modification). Sans
// JavaScript : les deux montants sont visibles, seul celui du mode choisi
// compte (l'action serveur vérifie).
function LineForm({
  action,
  period,
  language,
  submitLabel,
  line,
}: {
  action: (formData: FormData) => Promise<void>;
  period: string;
  language: Language;
  submitLabel: string;
  line?: FixedExpenseRow;
}) {
  const t = dashboardFixedExpensesDict[language];
  return (
    <form action={action} className="mt-2 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
      {line && <input type="hidden" name="id" value={line.id} />}
      <input type="hidden" name="period" value={period} />
      <label className="space-y-1 text-sm sm:col-span-2">
        <span className="text-slate-600">{t.name}</span>
        <input
          name="label"
          required
          defaultValue={line?.label ?? ""}
          placeholder={t.namePlaceholder}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="text-slate-600">{t.category}</span>
        <select
          name="category"
          defaultValue={line?.category ?? "salaires"}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          {EXPENSE_CATEGORIES.map((category) => (
            <option key={category.key} value={category.key}>
              {expenseCategoryLabel(category.key, language)}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="text-slate-600">{t.payMode}</span>
        <select
          name="pay_mode"
          defaultValue={line?.pay_mode ?? "fixed"}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="fixed">{t.modeFixed}</option>
          <option value="hourly">{t.modeHourly}</option>
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="text-slate-600">{t.monthlyAmount}</span>
        <input
          name="amount"
          type="text"
          inputMode="numeric"
          defaultValue={line && line.pay_mode === "fixed" ? String(line.amount) : ""}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="text-slate-600">{t.hourlyRate}</span>
        <input
          name="hourly_rate"
          type="text"
          inputMode="decimal"
          defaultValue={line?.hourly_rate != null ? String(line.hourly_rate) : ""}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input name="internat" type="checkbox" defaultChecked={line?.internat ?? false} />
        <span className="text-slate-700">{t.internatCheckbox}</span>
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
