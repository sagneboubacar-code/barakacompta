import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { deleteFamilyPayment, updateFamilyPayment } from "@/lib/actions/payments";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/constants/payments";
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardPaymentsDict } from "@/lib/i18n/dictionaries/dashboard-payments";
import { formatCurrency, formatDate } from "@/lib/format";
import { scheduleItemLabel } from "@/lib/schedules";

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

type FeeStructure = { fee_type: string; month: number };

// Correction d'un paiement famille d'un bloc (date, mode, responsable du reçu
// et montant de chaque enfant) ou annulation complète. Réservé à owner +
// admin (voir updateFamilyPayment / update_family_payment, 0041).
export default async function EditFamilyPaymentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const appUser = await requireRole(["owner", "admin"]);
  const language = getLanguage();
  const t = dashboardPaymentsDict[language];
  const supabase = createClient();

  const { data: receipt } = await supabase
    .from("family_payments")
    .select("id, family_name, payment_method, paid_at, reference, notes, cash_manager_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!receipt) {
    redirect("/unauthorized");
  }

  const [{ data: school }, { data: payments }, { data: cashManagers }] = await Promise.all([
    supabase.from("schools").select("currency").eq("id", appUser.school_id ?? "").maybeSingle(),
    supabase
      .from("payments")
      .select("id, amount, payment_schedule_id, students(first_name, last_name), payment_allocations(amount, payment_schedule_id)")
      .eq("family_payment_id", receipt.id),
    supabase.from("cash_managers").select("id, name").order("sort_order"),
  ]);

  const scheduleIds = Array.from(
    new Set((payments ?? []).map((payment) => payment.payment_schedule_id).filter((id): id is string => Boolean(id)))
  );
  const { data: schedules } = scheduleIds.length
    ? await supabase
        .from("payment_schedules")
        .select("id, due_date, amount_remaining, fee_structures(fee_type, month)")
        .in("id", scheduleIds)
    : { data: [] };
  const scheduleById = new Map((schedules ?? []).map((schedule) => [schedule.id, schedule]));

  const money = (amount: number) => formatCurrency(amount, school?.currency ?? "XOF", language);

  // Une ligne par enfant et par échéance, avec ce qui serait dû sans elle.
  const lines = (payments ?? [])
    .map((payment) => {
      const student = one(payment.students);
      const schedule = payment.payment_schedule_id ? scheduleById.get(payment.payment_schedule_id) : undefined;
      const paidHere = ((payment.payment_allocations ?? []) as { amount: number; payment_schedule_id: string }[])
        .filter((allocation) => allocation.payment_schedule_id === payment.payment_schedule_id)
        .reduce((sum, allocation) => sum + Number(allocation.amount), 0);
      return {
        id: payment.id,
        child: student ? `${student.last_name} ${student.first_name}` : t.dash,
        item: schedule
          ? scheduleItemLabel(one(schedule.fee_structures as FeeStructure | FeeStructure[] | null), schedule.due_date, language)
          : t.dash,
        dueDate: schedule?.due_date ?? "",
        due: schedule ? Number(schedule.amount_remaining) + paidHere : null,
        amount: Number(payment.amount),
      };
    })
    .sort((a, b) => a.child.localeCompare(b.child) || a.dueDate.localeCompare(b.dueDate));
  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/dashboard/payments/family/${receipt.id}`} className="text-sm text-slate-500 underline">
          {t.familyReceipt}
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{t.familyEditTitle(receipt.family_name)}</h1>
        <p className="text-sm text-slate-500">{t.familyEditIntro}</p>
        <p className="mt-1 text-sm text-slate-600">
          {formatDate(receipt.paid_at, language)} · {money(total)} · {paymentMethodLabel(receipt.payment_method, language)}
        </p>
      </div>

      {searchParams.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}

      <form action={updateFamilyPayment} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <input type="hidden" name="id" value={receipt.id} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.dateLabel}</span>
            <input name="paid_at" type="date" defaultValue={receipt.paid_at.slice(0, 10)} required className={inputClass} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.paymentMethodLabel}</span>
            <select name="payment_method" defaultValue={receipt.payment_method} className={inputClass}>
              {PAYMENT_METHODS.map((method) => (
                <option key={method.key} value={method.key}>
                  {paymentMethodLabel(method.key, language)}
                </option>
              ))}
            </select>
          </label>
          {(cashManagers ?? []).length > 0 && (
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">{t.cashManagerLabel}</span>
              <select name="cash_manager_id" defaultValue={receipt.cash_manager_id ?? ""} className={inputClass}>
                <option value="">{t.dash}</option>
                {(cashManagers ?? []).map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.referenceLabel}</span>
            <input name="reference" defaultValue={receipt.reference ?? ""} className={inputClass} />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-slate-600">{t.notesLabel}</span>
            <input name="notes" defaultValue={receipt.notes ?? ""} className={inputClass} />
          </label>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">{t.familyEditLines}</h2>
          <p className="text-xs text-slate-500">{t.familyEditZeroHint}</p>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-[520px] w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1.5 pe-3 font-medium">{t.linesChild}</th>
                  <th className="py-1.5 pe-3 font-medium">{t.linesItem}</th>
                  <th className="py-1.5 pe-3 font-medium">{t.familyEditDue}</th>
                  <th className="w-36 py-1.5 font-medium">{t.familyEditAmount}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-t border-slate-100 align-middle">
                    <td className="py-1.5 pe-3 text-slate-900">{line.child}</td>
                    <td className="py-1.5 pe-3 text-slate-600">
                      {line.item}
                      <Link href={`/dashboard/payments/${line.id}/edit`} className="ms-2 text-xs text-slate-400 underline">
                        {t.familyEditMonth}
                      </Link>
                    </td>
                    <td className="py-1.5 pe-3 tabular-nums text-slate-600">{line.due === null ? t.dash : money(line.due)}</td>
                    <td className="py-1.5">
                      <input type="hidden" name="payment_ids" value={line.id} />
                      <input
                        name="amounts"
                        type="number"
                        min="0"
                        step="1"
                        required
                        defaultValue={line.amount}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">{t.excessNote}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t.editSave}
          </button>
          <Link href={`/dashboard/payments/family/${receipt.id}`} className="text-sm text-slate-500 underline">
            {t.editCancel}
          </Link>
        </div>
      </form>

      <details className="rounded-lg border border-red-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-red-700">{t.familyDeleteTitle}</summary>
        <form action={deleteFamilyPayment} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={receipt.id} />
          <p className="text-sm text-slate-600">{t.familyDeleteHint}</p>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="confirm" value="yes" required />
            {t.familyDeleteConfirm}
          </label>
          <button
            type="submit"
            className="rounded-md border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            {t.familyDeleteButton}
          </button>
        </form>
      </details>
    </div>
  );
}
