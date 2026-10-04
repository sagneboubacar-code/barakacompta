import { Fragment } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { paymentMethodLabel } from "@/lib/constants/payments";
import { feeTypeLabel } from "@/lib/constants/fees";
import { formatMonthLabel, mensualiteMonthKey } from "@/lib/constants/months";
import { PrintButton } from "@/components/PrintButton";
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardReceiptDict } from "@/lib/i18n/dictionaries/dashboard-receipt";
import { formatCurrency, formatDate } from "@/lib/format";

// Reçu unique remis au parent quand la famille règle pour tous ses enfants
// (voir record_family_payment, 0037_paiement_famille.sql).
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
  const supabase = createClient();

  const { data: receipt } = await supabase
    .from("family_payments")
    .select("id, family_id, family_name, total, payment_method, paid_at, reference, notes, received_by, cash_manager_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!receipt) {
    redirect("/unauthorized");
  }

  const [{ data: school }, { data: payments }, { data: receiver }, { data: manager }, { data: family }] =
    await Promise.all([
      supabase
        .from("schools")
        .select("name, address, phone, currency, school_year_label")
        .eq("id", appUser.school_id ?? "")
        .maybeSingle(),
      supabase
        .from("payments")
        .select(
          "id, amount, students(first_name, last_name, classes(name)), payment_allocations(id, amount, payment_schedules(id, due_date, amount_remaining, fee_structures(fee_type, month)))"
        )
        .eq("family_payment_id", receipt.id),
      receipt.received_by
        ? supabase.from("users").select("full_name").eq("id", receipt.received_by).maybeSingle()
        : Promise.resolve({ data: null }),
      receipt.cash_manager_id
        ? supabase.from("cash_managers").select("name").eq("id", receipt.cash_manager_id).maybeSingle()
        : Promise.resolve({ data: null }),
      receipt.family_id
        ? supabase
            .from("families")
            .select("guardian_name, guardian_phone, free_student_id, free_year")
            .eq("id", receipt.family_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const money = (amount: number) => formatCurrency(amount, school?.currency, language);
  const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? value[0] ?? null : value);

  // Une ligne par échéance réglée, regroupées par enfant. `remaining` : ce
  // qui reste dû sur l'échéance à ce jour (avance du parent).
  const byChild = new Map<
    string,
    { name: string; klass: string | null; items: { id: string; label: string; amount: number; remaining: number }[] }
  >();
  const remainingBySchedule = new Map<string, number>();
  for (const payment of payments ?? []) {
    const student = one(payment.students);
    const name = student ? `${student.last_name} ${student.first_name}` : t.dash;
    const entry = byChild.get(name) ?? { name, klass: one(student?.classes ?? null)?.name ?? null, items: [] };
    for (const allocation of payment.payment_allocations ?? []) {
      const schedule = one(allocation.payment_schedules);
      const fee = one(schedule?.fee_structures ?? null);
      const label =
        fee?.fee_type === "mensualite" && fee.month && schedule
          ? `${feeTypeLabel("mensualite", language)} ${formatMonthLabel(mensualiteMonthKey(fee.month, schedule.due_date), language)}`
          : fee
            ? feeTypeLabel(fee.fee_type, language)
            : t.dash;
      const remaining = Math.max(Number(schedule?.amount_remaining ?? 0), 0);
      if (schedule) remainingBySchedule.set(schedule.id, remaining);
      entry.items.push({ id: allocation.id, label, amount: Number(allocation.amount), remaining });
    }
    byChild.set(name, entry);
  }
  const children = Array.from(byChild.values()).sort((a, b) => a.name.localeCompare(b.name));
  const totalRemaining = Array.from(remainingBySchedule.values()).reduce((sum, value) => sum + value, 0);

  // Rappel utile au parent : l'enfant pris en charge cette année n'apparaît
  // pas dans les montants, ce n'est pas un oubli.
  const freeChildName =
    family?.free_student_id && family.free_year === school?.school_year_label
      ? await supabase
          .from("students")
          .select("first_name, last_name")
          .eq("id", family.free_student_id)
          .maybeSingle()
          .then(({ data }) => (data ? `${data.last_name} ${data.first_name}` : null))
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/dashboard/payments?mode=family" className="text-sm text-slate-500 underline">
          {t.backToPayments}
        </Link>
        <PrintButton />
      </div>

      {searchParams.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 print:hidden">{searchParams.success}</p>
      )}

      <div className="mx-auto max-w-xl space-y-6 rounded-lg border border-slate-200 bg-white p-8 print:border-0 print:shadow-none">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-slate-900">{school?.name}</h1>
          <p className="text-xs text-slate-500">{school?.address}</p>
          <p className="text-xs text-slate-500">{school?.phone}</p>
        </div>
        <h2 className="text-center text-base font-medium text-slate-700">{t.familyReceiptTitle}</h2>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">{t.family}</dt>
            <dd className="text-end text-slate-900">
              {receipt.family_name}
              {family?.guardian_name ? ` — ${family.guardian_name}` : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">{t.date}</dt>
            <dd className="text-slate-900">{formatDate(receipt.paid_at, language)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">{t.paymentMethod}</dt>
            <dd className="text-slate-900">{paymentMethodLabel(receipt.payment_method, language)}</dd>
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
            {children.map((child) => (
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
                {money(Number(receipt.total))}
              </td>
            </tr>
            {totalRemaining > 0 && (
              <tr>
                <td colSpan={2} className="pt-1 text-sm text-red-700">
                  {t.remainingToday}
                </td>
                <td className="pt-1 text-end text-sm font-medium tabular-nums text-red-700">{money(totalRemaining)}</td>
              </tr>
            )}
          </tfoot>
        </table>

        {freeChildName && <p className="text-xs text-emerald-700">{t.familyFreeNote(freeChildName)}</p>}

        <dl className="space-y-1 text-xs text-slate-500">
          {receiver?.full_name && (
            <div className="flex justify-between gap-4">
              <dt>{t.receivedBy}</dt>
              <dd>{receiver.full_name}</dd>
            </div>
          )}
          {manager?.name && (
            <div className="flex justify-between gap-4">
              <dt>{t.cashManager}</dt>
              <dd>{manager.name}</dd>
            </div>
          )}
        </dl>

        <p className="text-center text-xs text-slate-400">{t.receiptNumber(`F-${receipt.id.slice(0, 8)}`)}</p>
      </div>
    </div>
  );
}
