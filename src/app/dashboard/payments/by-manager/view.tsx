import Link from "next/link";
import type { Language } from "@/lib/i18n/config";
import { dashboardManagerPaymentsDict } from "@/lib/i18n/dictionaries/dashboard-manager-payments";
import { paymentMethodLabel } from "@/lib/constants/payments";
import { expenseCategoryLabel } from "@/lib/constants/expenses";
import { formatCurrency, formatDate, formatSignedCurrency } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

export interface ManagerPaymentRow {
  id: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
  studentId: string | null;
  studentName: string | null;
  className: string | null;
  familyPaymentId: string | null;
  familyName: string | null;
}

export interface ManagerExpenseRow {
  id: string;
  date: string;
  category: string;
  label: string;
  amount: number;
}

export interface ManagerTransferRow {
  id: string;
  date: string;
  // true : reçu d'un autre responsable ; false : remis à un autre.
  received: boolean;
  otherName: string;
  notes: string | null;
  amount: number;
}

// En-tête de section, comme le rapport financier : petite étiquette capitale
// + filet.
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b-2 border-slate-900 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </h2>
  );
}

// Affichage seul (sans requête) : la page charge les lignes, cette vue les
// présente.
export function ManagerPaymentsView({
  language,
  managerId,
  managerName,
  managers,
  from,
  to,
  currency,
  rows,
  expenses,
  transfers,
  openingBalance,
  canEdit,
  fromReport,
}: {
  language: Language;
  managerId: string;
  managerName: string | null;
  managers: { id: string; name: string }[];
  from: string;
  to: string;
  currency: string;
  rows: ManagerPaymentRow[];
  expenses: ManagerExpenseRow[];
  transfers: ManagerTransferRow[];
  // Solde la veille de la période (tout ce qui précède `from`).
  openingBalance: number;
  canEdit: boolean;
  fromReport: boolean;
}) {
  const t = dashboardManagerPaymentsDict[language];
  const money = (amount: number) => formatCurrency(amount, currency, language);
  const name = managerName ?? t.unassigned;

  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const received = transfers.filter((transfer) => transfer.received);
  const sent = transfers.filter((transfer) => !transfer.received);
  const totalReceived = received.reduce((sum, transfer) => sum + transfer.amount, 0);
  const totalSent = sent.reduce((sum, transfer) => sum + transfer.amount, 0);
  const solde = total + totalReceived - totalExpenses - totalSent;
  const closingBalance = openingBalance + solde;
  const dayBefore = new Date(`${from}T00:00:00Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);

  // Même élève, même montant, même jour : le plus souvent un paiement
  // enregistré deux fois. On le signale sans rien supprimer.
  const sameKey = (row: ManagerPaymentRow) => `${row.studentId}|${row.amount}|${row.paidAt.slice(0, 10)}`;
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(sameKey(row), (counts.get(sameKey(row)) ?? 0) + 1);
  const isDuplicate = (row: ManagerPaymentRow) => row.studentId !== null && (counts.get(sameKey(row)) ?? 0) > 1;
  const duplicateCount = rows.filter(isDuplicate).length;

  const backHref = fromReport ? `/dashboard/reports?from=${from}&to=${to}` : "/dashboard";

  // Le calcul du solde, ligne à ligne, pour le refaire à la main au pointage.
  const summaryLines = [
    { label: t.summaryRevenue(rows.length), amount: total, sign: "+", tone: "text-emerald-700", show: true },
    {
      label: t.summaryReceived(received.length),
      amount: totalReceived,
      sign: "+",
      tone: "text-emerald-700",
      show: received.length > 0,
    },
    { label: t.summaryExpenses(expenses.length), amount: totalExpenses, sign: "−", tone: "text-rose-700", show: true },
    { label: t.summarySent(sent.length), amount: totalSent, sign: "−", tone: "text-rose-700", show: sent.length > 0 },
  ].filter((line) => line.show);

  return (
    <div className="space-y-8 print:space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between print:border-slate-900">
        <div className="space-y-1">
          <Link href={backHref} className="text-sm text-slate-500 underline print:hidden">
            {fromReport ? t.backToReport : t.backToDashboard}
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">{t.title(name)}</h1>
          <p className="text-sm text-slate-500">{t.period(formatDate(from, language), formatDate(to, language))}</p>
        </div>
        <div className="print:hidden">
          <PrintButton />
        </div>
      </div>

      {/* Responsable et période se choisissent ici même, sans repasser par le
          rapport. */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 print:hidden"
      >
        <label className="space-y-1 text-sm">
          <span className="block text-slate-600">{t.filterManager}</span>
          <select
            name="manager"
            defaultValue={managerId}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}
              </option>
            ))}
            {managerId === "none" && <option value="none">{t.unassigned}</option>}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-slate-600">{t.filterFrom}</span>
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-slate-600">{t.filterTo}</span>
          <input name="to" type="date" defaultValue={to} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.apply}
        </button>
      </form>

      <section className="break-inside-avoid space-y-3">
        <SectionHeading>{t.sectionSummary}</SectionHeading>
        <div className="max-w-xl">
          <table className="w-full text-left text-sm">
            <tbody>
              <tr>
                <td className="py-2 text-slate-900">{t.summaryOpening(formatDate(dayBefore, language))}</td>
                <td className="whitespace-nowrap py-2 ps-3 text-right font-mono tabular-nums text-slate-900">{money(openingBalance)}</td>
              </tr>
              {summaryLines.map((line) => (
                <tr key={line.label} className="border-t border-slate-100">
                  <td className="py-2 ps-4 text-slate-700">{line.label}</td>
                  <td className={`whitespace-nowrap py-2 ps-3 text-right font-mono tabular-nums ${line.tone}`}>
                    {line.sign} {money(line.amount)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-300">
                <td className="py-2 ps-4 text-slate-700">{t.summaryPeriod}</td>
                <td className="whitespace-nowrap py-2 ps-3 text-right font-mono tabular-nums text-slate-700">
                  {formatSignedCurrency(solde, currency, language)}
                </td>
              </tr>
              <tr className="border-t-2 border-slate-900 font-semibold">
                <td className="py-2 text-slate-900">{t.summaryBalance(formatDate(to, language))}</td>
                <td
                  className={`whitespace-nowrap py-2 ps-3 text-right font-mono tabular-nums ${
                    closingBalance >= 0 ? "text-slate-900" : "text-rose-700"
                  }`}
                >
                  {money(closingBalance)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">{fromReport ? t.sameAsReport : t.sameAsDashboard}</p>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading>{t.sectionRevenue}</SectionHeading>

        {duplicateCount > 0 && (
          <p className="rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-800">{t.duplicatesWarning(duplicateCount)}</p>
        )}

        {/* overflow-x-auto + largeur minimale, comme la liste des paiements :
            sur téléphone, les colonnes défilent au lieu d'être coupées. */}
        {rows.length === 0 ? (
          <p className="py-3 text-sm text-slate-400">{t.noPayments}</p>
        ) : (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 pe-3 font-medium">{t.colDate}</th>
                  <th className="py-2 pe-3 font-medium">{t.colStudent}</th>
                  <th className="py-2 pe-3 font-medium">{t.colClass}</th>
                  <th className="py-2 pe-3 font-medium">{t.colMethod}</th>
                  <th className="py-2 pe-3 text-right font-medium">{t.colAmount}</th>
                  <th className="py-2 font-medium print:hidden">{t.colReceipt}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`break-inside-avoid border-t border-slate-100 ${isDuplicate(row) ? "bg-orange-50" : ""}`}
                  >
                    <td className="py-1.5 pe-3 text-slate-600">{formatDate(row.paidAt, language)}</td>
                    <td className="py-1.5 pe-3 text-slate-900">
                      {row.studentName ?? t.dash}
                      {row.familyName && (
                        <span className="ms-2 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                          {t.familyTag(row.familyName)}
                        </span>
                      )}
                      {isDuplicate(row) && (
                        <span className="ms-2 whitespace-nowrap rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
                          {t.duplicateTag}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pe-3 text-slate-600">{row.className ?? t.dash}</td>
                    <td className="py-1.5 pe-3 text-slate-600">{paymentMethodLabel(row.paymentMethod, language)}</td>
                    <td className="py-1.5 pe-3 text-right font-mono tabular-nums text-slate-900">{money(row.amount)}</td>
                    <td className="whitespace-nowrap py-1.5 print:hidden">
                      <Link href={`/dashboard/payments/${row.id}/receipt`} className="text-slate-900 underline">
                        {t.viewReceipt}
                      </Link>
                      {row.familyPaymentId && (
                        <Link
                          href={`/dashboard/payments/family/${row.familyPaymentId}`}
                          className="ms-3 text-emerald-700 underline"
                        >
                          {t.familyReceipt}
                        </Link>
                      )}
                      {canEdit && (
                        <Link href={`/dashboard/payments/${row.id}/edit`} className="ms-3 text-slate-500 underline">
                          {t.edit}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-900 font-semibold">
                  <td className="py-2 text-slate-900" colSpan={4}>
                    {t.total}
                  </td>
                  <td className="py-2 pe-3 text-right font-mono tabular-nums text-emerald-700">{money(total)}</td>
                  <td className="print:hidden" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading>{t.sectionExpenses}</SectionHeading>
        {expenses.length === 0 ? (
          <p className="py-3 text-sm text-slate-400">{t.noExpenses}</p>
        ) : (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 pe-3 font-medium">{t.colDate}</th>
                  <th className="py-2 pe-3 font-medium">{t.colDescription}</th>
                  <th className="py-2 pe-3 font-medium">{t.colCategory}</th>
                  <th className="py-2 text-right font-medium">{t.colAmount}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="break-inside-avoid border-t border-slate-100">
                    <td className="py-1.5 pe-3 text-slate-600">{formatDate(expense.date, language)}</td>
                    <td className="py-1.5 pe-3 text-slate-900">{expense.label}</td>
                    <td className="py-1.5 pe-3 text-slate-600">{expenseCategoryLabel(expense.category, language)}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-slate-900">{money(expense.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-900 font-semibold">
                  <td className="py-2 text-slate-900" colSpan={3}>
                    {t.total}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-rose-700">{money(totalExpenses)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {transfers.length > 0 && (
        <section className="space-y-3">
          <SectionHeading>{t.sectionTransfers}</SectionHeading>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 pe-3 font-medium">{t.colDate}</th>
                  <th className="py-2 pe-3 font-medium">{t.colTransfer}</th>
                  <th className="py-2 pe-3 font-medium">{t.colNote}</th>
                  <th className="py-2 text-right font-medium">{t.colAmount}</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((transfer) => (
                  <tr key={transfer.id} className="break-inside-avoid border-t border-slate-100">
                    <td className="py-1.5 pe-3 text-slate-600">{formatDate(transfer.date, language)}</td>
                    <td className="py-1.5 pe-3 text-slate-900">
                      {transfer.received ? t.receivedFrom(transfer.otherName) : t.sentTo(transfer.otherName)}
                    </td>
                    <td className="py-1.5 pe-3 text-slate-600">{transfer.notes || t.dash}</td>
                    <td
                      className={`py-1.5 text-right font-mono tabular-nums ${
                        transfer.received ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatSignedCurrency(transfer.received ? transfer.amount : -transfer.amount, currency, language)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-900 font-semibold">
                  <td className="py-2 text-slate-900" colSpan={3}>
                    {t.total}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-slate-900">
                    {formatSignedCurrency(totalReceived - totalSent, currency, language)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Bloc de signature : uniquement à l'impression, pour le pointage
          remis à la direction. */}
      <div className="hidden grid-cols-2 gap-12 pt-10 text-xs text-slate-500 print:grid">
        <div>
          <p className="border-t border-slate-400 pt-1.5">{t.signedBy(name)}</p>
        </div>
        <div>
          <p className="border-t border-slate-400 pt-1.5">{t.verifiedBy}</p>
        </div>
      </div>
    </div>
  );
}
