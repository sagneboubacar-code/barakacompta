import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { deletePayment, updatePayment } from "@/lib/actions/payments";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/constants/payments";
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardPaymentsDict } from "@/lib/i18n/dictionaries/dashboard-payments";
import { formatCurrency, formatDate } from "@/lib/format";
import { scheduleItemLabel } from "@/lib/schedules";

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

type FeeStructure = { fee_type: string; month: number };

// Correction d'un paiement saisi par erreur (montant, mois concerné, date...)
// ou suppression. Réservé à owner + admin (voir updatePayment).
export default async function EditPaymentPage({
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

  const { data: payment } = await supabase
    .from("payments")
    .select(
      "id, student_id, amount, payment_schedule_id, payment_method, paid_at, reference, notes, cash_manager_id, family_payment_id, students(first_name, last_name), family_payments(family_name), payment_allocations(amount, payment_schedule_id)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!payment) {
    redirect("/unauthorized");
  }

  const [{ data: school }, { data: schedules }, { data: cashManagers }] = await Promise.all([
    supabase.from("schools").select("currency").eq("id", appUser.school_id ?? "").maybeSingle(),
    supabase
      .from("payment_schedules")
      .select("id, due_date, amount_remaining, status, fee_structures(fee_type, month)")
      .eq("student_id", payment.student_id)
      .neq("status", "cancelled")
      .order("due_date"),
    supabase.from("cash_managers").select("id, name").order("sort_order"),
  ]);

  const money = (amount: number) => formatCurrency(amount, school?.currency ?? "XOF", language);
  const student = one(payment.students);
  const studentName = student ? `${student.last_name} ${student.first_name}` : t.dash;
  const familyName = one(payment.family_payments)?.family_name ?? null;

  // Ce que ce paiement règle aujourd'hui, échéance par échéance.
  const allocated = new Map<string, number>();
  for (const allocation of (payment.payment_allocations ?? []) as { amount: number; payment_schedule_id: string }[]) {
    allocated.set(allocation.payment_schedule_id, (allocated.get(allocation.payment_schedule_id) ?? 0) + Number(allocation.amount));
  }
  const scheduleLabel = (schedule: { due_date: string; fee_structures: unknown }) =>
    scheduleItemLabel(one(schedule.fee_structures as FeeStructure | FeeStructure[] | null), schedule.due_date, language);
  const currentLines = (schedules ?? [])
    .filter((schedule) => allocated.has(schedule.id))
    .map((schedule) => ({ id: schedule.id, label: scheduleLabel(schedule), amount: allocated.get(schedule.id) ?? 0 }));
  const unallocated = Number(payment.amount) - currentLines.reduce((sum, line) => sum + line.amount, 0);

  // Mois concerné possibles : ce qui resterait dû si ce paiement n'existait
  // pas (les échéances qu'il solde aujourd'hui redeviennent choisissables).
  const monthOptions = (schedules ?? [])
    .map((schedule) => ({
      id: schedule.id,
      label: t.scheduleOption(
        formatDate(schedule.due_date, language),
        scheduleLabel(schedule),
        Number(schedule.amount_remaining) + (allocated.get(schedule.id) ?? 0)
      ),
      open: Number(schedule.amount_remaining) + (allocated.get(schedule.id) ?? 0) > 0,
    }))
    .filter((option) => option.open || option.id === payment.payment_schedule_id);

  const isFamilyLine = Boolean(payment.family_payment_id);
  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/dashboard/payments?student_id=${payment.student_id}`} className="text-sm text-slate-500 underline">
          {t.paymentHistory(studentName)}
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{t.editTitle}</h1>
        <p className="text-sm text-slate-500">{t.editIntro}</p>
      </div>

      {searchParams.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <p className="font-semibold text-slate-900">
          {studentName}
          {familyName && (
            <span className="ms-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-normal text-emerald-700">
              {t.familyTag(familyName)}
            </span>
          )}
        </p>
        <p className="mt-1 text-slate-600">
          {formatDate(payment.paid_at, language)} · {money(Number(payment.amount))} ·{" "}
          {paymentMethodLabel(payment.payment_method, language)}
        </p>
        <p className="mt-3 text-xs font-medium text-slate-500">{t.editCurrent}</p>
        <ul className="mt-1 space-y-0.5">
          {currentLines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3 text-slate-700">
              <span>{line.label}</span>
              <span className="tabular-nums">{money(line.amount)}</span>
            </li>
          ))}
          {unallocated > 0.005 && (
            <li className="flex justify-between gap-3 text-slate-500">
              <span>{t.editUnallocated}</span>
              <span className="tabular-nums">{money(unallocated)}</span>
            </li>
          )}
        </ul>
      </section>

      <form action={updatePayment} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={payment.id} />
        {isFamilyLine && familyName && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 sm:col-span-2">
            {t.editFamilyNote(familyName)}
          </p>
        )}
        {!isFamilyLine && (
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.dateLabel}</span>
            <input
              name="paid_at"
              type="date"
              defaultValue={payment.paid_at.slice(0, 10)}
              required
              className={inputClass}
            />
          </label>
        )}
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.monthConcerned}</span>
          <select name="payment_schedule_id" defaultValue={payment.payment_schedule_id ?? ""} className={inputClass}>
            {!payment.payment_schedule_id && <option value="">{t.monthAuto}</option>}
            {monthOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.amountLabel}</span>
          <input
            name="amount"
            type="number"
            min="1"
            step="1"
            required
            defaultValue={Number(payment.amount)}
            className={inputClass}
          />
        </label>
        {!isFamilyLine && (
          <>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">{t.paymentMethodLabel}</span>
              <select name="payment_method" defaultValue={payment.payment_method} className={inputClass}>
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
                <select name="cash_manager_id" defaultValue={payment.cash_manager_id ?? ""} className={inputClass}>
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
              <input name="reference" defaultValue={payment.reference ?? ""} className={inputClass} />
            </label>
          </>
        )}
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.notesLabel}</span>
          <input name="notes" defaultValue={payment.notes ?? ""} className={inputClass} />
        </label>
        <p className="text-xs text-slate-400 sm:col-span-2">{t.excessNote}</p>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t.editSave}
          </button>
          <Link href={`/dashboard/payments/${payment.id}/receipt`} className="text-sm text-slate-500 underline">
            {t.editCancel}
          </Link>
        </div>
      </form>

      <details className="rounded-lg border border-red-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-red-700">{t.deleteTitle}</summary>
        <form action={deletePayment} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={payment.id} />
          <p className="text-sm text-slate-600">{t.deleteHint}</p>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="confirm" value="yes" required />
            {t.deleteConfirm}
          </label>
          <button
            type="submit"
            className="rounded-md border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            {t.deleteButton}
          </button>
        </form>
      </details>
    </div>
  );
}
