import { Fragment } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { paymentMethodLabel } from "@/lib/constants/payments";
import { PrintButton } from "@/components/PrintButton";
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardReceiptDict } from "@/lib/i18n/dictionaries/dashboard-receipt";
import { formatCurrency, formatDate } from "@/lib/format";
import { loadFamilyReceipt } from "@/lib/receipts/data";

// Reçu unique remis au parent quand la famille règle pour tous ses enfants
// (voir record_family_payment, 0037/0038). Mêmes données que le PDF
// (lib/receipts/data.ts) : l'écran et le fichier disent la même chose.
export default async function FamilyReceiptPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { success?: string };
}) {
  const appUser = await requireRole(["owner", "admin", "accountant"]);
  const language = getLanguage();
  const t = dashboardReceiptDict[language];

  const receipt = await loadFamilyReceipt(createClient(), params.id, appUser.school_id ?? "", language);
  if (!receipt) {
    redirect("/unauthorized");
  }

  const money = (amount: number) => formatCurrency(amount, receipt.school.currency, language);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/dashboard/payments?mode=family" className="text-sm text-slate-500 underline">
          {t.backToPayments}
        </Link>
        <div className="flex flex-wrap gap-2">
          {(appUser.role === "owner" || appUser.role === "admin") && (
            <Link
              href={`/dashboard/payments/family/${params.id}/edit`}
              className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {t.editFamilyPayment}
            </Link>
          )}
          <a
            href={`/api/payments/family/${params.id}/pdf`}
            download
            className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {t.downloadPdf}
          </a>
          <PrintButton />
        </div>
      </div>

      {searchParams.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 print:hidden">{searchParams.success}</p>
      )}

      <div className="mx-auto max-w-xl space-y-6 rounded-lg border border-slate-200 bg-white p-8 print:border-0 print:shadow-none">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-slate-900">{receipt.school.name}</h1>
          <p className="text-xs text-slate-500">{receipt.school.address}</p>
          <p className="text-xs text-slate-500">{receipt.school.phone}</p>
        </div>
        <h2 className="text-center text-base font-medium text-slate-700">{t.familyReceiptTitle}</h2>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">{t.family}</dt>
            <dd className="text-end text-slate-900">
              {receipt.payerName}
              {receipt.guardianName ? ` — ${receipt.guardianName}` : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">{t.date}</dt>
            <dd className="text-slate-900">{formatDate(receipt.paidAt, language)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">{t.paymentMethod}</dt>
            <dd className="text-slate-900">{paymentMethodLabel(receipt.paymentMethod, language)}</dd>
          </div>
          {receipt.reference && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t.reference}</dt>
              <dd className="text-slate-900">{receipt.reference}</dd>
            </div>
          )}
        </dl>

        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="pb-1 font-medium">{t.child}</th>
              <th className="pb-1 font-medium">{t.item}</th>
              <th className="pb-1 text-end font-medium">{t.amount}</th>
            </tr>
          </thead>
          <tbody>
            {receipt.children.map((child) => (
              <Fragment key={child.name}>
                {child.items.map((item, index) => (
                  <tr key={item.id} className={index === 0 ? "border-t border-slate-200" : ""}>
                    <td className="py-1 pe-3 align-top text-slate-900">
                      {index === 0 ? (
                        <>
                          {child.name}
                          {child.klass && <span className="block text-xs text-slate-500">{child.klass}</span>}
                        </>
                      ) : null}
                    </td>
                    <td className="py-1 pe-3 text-slate-700">
                      {item.label}
                      {item.remaining > 0 && (
                        <span className="block text-xs text-red-700">{t.itemRemaining(money(item.remaining))}</span>
                      )}
                    </td>
                    <td className="py-1 text-end tabular-nums text-slate-900">{money(item.amount)}</td>
                  </tr>
                ))}
                {child.items.length > 1 && (
                  <tr>
                    <td></td>
                    <td className="pb-1 pe-3 text-xs text-slate-500">{t.subtotal}</td>
                    <td className="pb-1 text-end text-xs tabular-nums text-slate-500">
                      {money(child.items.reduce((sum, item) => sum + item.amount, 0))}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300">
              <td colSpan={2} className="pt-2 font-semibold text-slate-900">
                {t.total}
              </td>
              <td className="pt-2 text-end text-base font-semibold tabular-nums text-slate-900">
                {money(receipt.total)}
              </td>
            </tr>
            {receipt.totalRemaining > 0 && (
              <tr>
                <td colSpan={2} className="pt-1 text-sm text-red-700">
                  {t.remainingToday}
                </td>
                <td className="pt-1 text-end text-sm font-medium tabular-nums text-red-700">
                  {money(receipt.totalRemaining)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>

        {receipt.freeChildName && <p className="text-xs text-emerald-700">{t.familyFreeNote(receipt.freeChildName)}</p>}

        <dl className="space-y-1 text-xs text-slate-500">
          {receipt.receivedBy && (
            <div className="flex justify-between gap-4">
              <dt>{t.receivedBy}</dt>
              <dd>{receipt.receivedBy}</dd>
            </div>
          )}
          {receipt.cashManager && (
            <div className="flex justify-between gap-4">
              <dt>{t.cashManager}</dt>
              <dd>{receipt.cashManager}</dd>
            </div>
          )}
        </dl>

        <p className="text-center text-xs text-slate-400">{t.receiptNumber(receipt.number)}</p>
      </div>
    </div>
  );
}
