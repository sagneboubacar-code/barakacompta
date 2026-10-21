import Link from "next/link";
import type { Language } from "@/lib/i18n/config";
import { dashboardManagerPaymentsDict } from "@/lib/i18n/dictionaries/dashboard-manager-payments";
import { paymentMethodLabel } from "@/lib/constants/payments";
import { formatCurrency, formatDate } from "@/lib/format";

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

// Affichage seul (sans requête) : la page charge les lignes, cette vue les
// présente.
export function ManagerPaymentsView({
  language,
  managerName,
  from,
  to,
  currency,
  rows,
  canEdit,
  fromReport,
}: {
  language: Language;
  managerName: string | null;
  from: string;
  to: string;
  currency: string;
  rows: ManagerPaymentRow[];
  canEdit: boolean;
  fromReport: boolean;
}) {
  const t = dashboardManagerPaymentsDict[language];
  const money = (amount: number) => formatCurrency(amount, currency, language);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  // Même élève, même montant, même jour : le plus souvent un paiement
  // enregistré deux fois. On le signale sans rien supprimer.
  const sameKey = (row: ManagerPaymentRow) => `${row.studentId}|${row.amount}|${row.paidAt.slice(0, 10)}`;
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(sameKey(row), (counts.get(sameKey(row)) ?? 0) + 1);
  const isDuplicate = (row: ManagerPaymentRow) => row.studentId !== null && (counts.get(sameKey(row)) ?? 0) > 1;
  const duplicateCount = rows.filter(isDuplicate).length;

  const backHref = fromReport ? `/dashboard/reports?from=${from}&to=${to}` : "/dashboard";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={backHref} className="text-sm text-slate-500 underline">
          {fromReport ? t.backToReport : t.backToDashboard}
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">{t.title(managerName ?? t.unassigned)}</h1>
        <p className="text-sm text-slate-500">{t.period(formatDate(from, language), formatDate(to, language))}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-base font-semibold text-green-700">{t.summary(rows.length, money(total))}</p>
        <p className="text-xs text-slate-500">{fromReport ? t.sameAsReport : t.sameAsDashboard}</p>
      </div>

      {duplicateCount > 0 && (
        <p className="rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-800">{t.duplicatesWarning(duplicateCount)}</p>
      )}

      {/* overflow-x-auto + largeur minimale, comme la liste des paiements :
          sur téléphone, les colonnes défilent au lieu d'être coupées. */}
      {rows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
          {t.noPayments}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t.colDate}</th>
                <th className="px-4 py-2 font-medium">{t.colStudent}</th>
                <th className="px-4 py-2 font-medium">{t.colClass}</th>
                <th className="px-4 py-2 font-medium">{t.colAmount}</th>
                <th className="px-4 py-2 font-medium">{t.colMethod}</th>
                <th className="px-4 py-2 font-medium">{t.colReceipt}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={`border-t border-slate-100 ${isDuplicate(row) ? "bg-orange-50" : ""}`}>
                  <td className="px-4 py-2 text-slate-600">{formatDate(row.paidAt, language)}</td>
                  <td className="px-4 py-2 text-slate-900">
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
                  <td className="px-4 py-2 text-slate-600">{row.className ?? t.dash}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{money(row.amount)}</td>
                  <td className="px-4 py-2 text-slate-600">{paymentMethodLabel(row.paymentMethod, language)}</td>
                  <td className="px-4 py-2">
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
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="px-4 py-2 text-slate-900" colSpan={3}>
                  {t.total}
                </td>
                <td className="px-4 py-2 text-green-700">{money(total)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
