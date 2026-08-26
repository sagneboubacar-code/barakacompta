import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { regenerateStudentSchedule, updateStudent } from "@/lib/actions/students";
import { createDiscount, deleteDiscount, updateDiscount } from "@/lib/actions/discounts";
import { cycleLabel, sortByCycle } from "@/lib/constants/cycles";
import { REGIMES, feeTypeLabel, regimeLabel } from "@/lib/constants/fees";
import { paymentMethodLabel } from "@/lib/constants/payments";
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardStudentDetailDict } from "@/lib/i18n/dictionaries/dashboard-student-detail";
import { formatDate } from "@/lib/format";

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; success?: string };
}) {
  await requireRole(["owner", "admin"]);
  const language = getLanguage();
  const t = dashboardStudentDetailDict[language];
  const supabase = createClient();

  const { data: student } = await supabase
    .from("students")
    .select(
      "id, first_name, last_name, matricule, gender, date_of_birth, place_of_birth, class_id, regime, guardian_name, guardian_phone, address, enrolled_at, status, subscribes_cantine, subscribes_transport"
    )
    .eq("id", params.id)
    .maybeSingle();

  // La RLS filtre déjà par school_id : si l'élève appartient à une autre
  // école (ou n'existe pas), la requête ci-dessus renvoie simplement `null`
  // plutôt qu'une erreur — on traite ce cas comme un accès non autorisé.
  if (!student) {
    redirect("/unauthorized");
  }

  const [{ data: rawClasses }, { data: schedules }, { data: payments }, { data: discounts }] = await Promise.all([
    supabase.from("classes").select("id, name, level, sort_order").order("sort_order"),
    supabase
      .from("payment_schedules")
      .select(
        "id, due_date, amount_due, discount_amount, amount_paid, amount_remaining, status, fee_structures(fee_type)"
      )
      .eq("student_id", student.id)
      .order("due_date"),
    supabase
      .from("payments")
      .select("id, amount, payment_method, paid_at")
      .eq("student_id", student.id)
      .order("paid_at", { ascending: false }),
    supabase
      .from("discounts")
      .select("id, label, discount_type, value, starts_on, ends_on")
      .eq("student_id", student.id)
      .order("starts_on", { ascending: false }),
  ]);
  const classes = sortByCycle(rawClasses ?? []);

  const balance = (schedules ?? [])
    .filter((s) => s.status !== "cancelled")
    .reduce((sum, s) => sum + s.amount_remaining, 0);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/students" className="text-sm text-slate-500 underline">
        {t.backToList}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">
          {student.last_name} {student.first_name}
        </h1>
        <span className="text-sm text-slate-500">{t.matricule(student.matricule ?? "—")}</span>
      </div>

      {searchParams.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}
      {searchParams.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{searchParams.success}</p>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t.sectionInfo}</h2>
        <form action={updateStudent} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={student.id} />
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formFirstName}</span>
            <input
              name="first_name"
              defaultValue={student.first_name}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formLastName}</span>
            <input
              name="last_name"
              defaultValue={student.last_name}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formGender}</span>
            <select
              name="gender"
              defaultValue={student.gender ?? "M"}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="M">{t.genderMale}</option>
              <option value="F">{t.genderFemale}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formDob}</span>
            <input
              name="date_of_birth"
              type="date"
              defaultValue={student.date_of_birth ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formPob}</span>
            <input
              name="place_of_birth"
              defaultValue={student.place_of_birth ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formClass}</span>
            <select
              name="class_id"
              defaultValue={student.class_id ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">{t.formClassNone}</option>
              {(classes ?? []).map((klass) => (
                <option key={klass.id} value={klass.id}>
                  {klass.name} ({cycleLabel(klass.level, language)})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formRegime}</span>
            <select
              name="regime"
              defaultValue={student.regime}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {REGIMES.map((regime) => (
                <option key={regime.key} value={regime.key}>
                  {regimeLabel(regime.key, language)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formGuardianName}</span>
            <input
              name="guardian_name"
              defaultValue={student.guardian_name ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formGuardianPhone}</span>
            <input
              name="guardian_phone"
              defaultValue={student.guardian_phone ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-slate-600">{t.formAddress}</span>
            <input
              name="address"
              defaultValue={student.address ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formEnrolledAt}</span>
            <input
              name="enrolled_at"
              type="date"
              defaultValue={student.enrolled_at}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formStatus}</span>
            <select
              name="status"
              defaultValue={student.status}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="active">{t.statusActive}</option>
              <option value="inactive">{t.statusInactive}</option>
            </select>
          </label>
          <div className="flex items-center gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="subscribes_cantine" defaultChecked={student.subscribes_cantine} />
              {t.cantine}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="subscribes_transport" defaultChecked={student.subscribes_transport} />
              {t.transport}
            </label>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              {t.save}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{t.sectionSchedule}</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              {t.currentBalance}
              <strong className="text-slate-900">{balance}</strong>
            </span>
            <form action={regenerateStudentSchedule}>
              <input type="hidden" name="id" value={student.id} />
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                {t.regenerateSchedule}
              </button>
            </form>
          </div>
        </div>

        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 font-medium">{t.colDueDate}</th>
              <th className="py-1 font-medium">{t.colType}</th>
              <th className="py-1 font-medium">{t.colDue}</th>
              <th className="py-1 font-medium">{t.colDiscount}</th>
              <th className="py-1 font-medium">{t.colPaid}</th>
              <th className="py-1 font-medium">{t.colRemaining}</th>
              <th className="py-1 font-medium">{t.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {(schedules ?? []).map((schedule) => {
              const feeStructure = Array.isArray(schedule.fee_structures)
                ? schedule.fee_structures[0]
                : schedule.fee_structures;
              return (
                <tr key={schedule.id} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-600">
                    {formatDate(schedule.due_date, language)}
                  </td>
                  <td className="py-1.5 text-slate-600">
                    {feeStructure ? feeTypeLabel(feeStructure.fee_type, language) : "—"}
                  </td>
                  <td className="py-1.5 text-slate-600">{schedule.amount_due}</td>
                  <td className="py-1.5 text-slate-600">
                    {schedule.discount_amount > 0 ? `- ${schedule.discount_amount}` : "—"}
                  </td>
                  <td className="py-1.5 text-slate-600">{schedule.amount_paid}</td>
                  <td className="py-1.5 text-slate-600">{schedule.amount_remaining}</td>
                  <td className="py-1.5 text-slate-600">
                    {t.scheduleStatus[schedule.status] ?? schedule.status}
                  </td>
                </tr>
              );
            })}
            {(schedules ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="py-3 text-center text-xs text-slate-400">
                  {t.noSchedule}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t.sectionDiscounts}</h2>
        <p className="text-xs text-slate-500">
          {t.discountsHint}
        </p>

        <div className="mt-3 space-y-2">
          {(discounts ?? []).map((discount) => (
            <div key={discount.id} className="flex items-center gap-2">
              <form action={updateDiscount} className="flex flex-1 flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={discount.id} />
                <input type="hidden" name="student_id" value={student.id} />
                <input
                  name="label"
                  defaultValue={discount.label}
                  placeholder={t.discountLabelPlaceholder}
                  className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <select
                  name="discount_type"
                  defaultValue={discount.discount_type}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                >
                  <option value="percentage">{t.discountTypePercentage}</option>
                  <option value="fixed_amount">{t.discountTypeFixed}</option>
                </select>
                <input
                  name="value"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={discount.value}
                  className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <input
                  name="starts_on"
                  type="date"
                  defaultValue={discount.starts_on}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <input
                  name="ends_on"
                  type="date"
                  defaultValue={discount.ends_on}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  {t.save}
                </button>
              </form>
              <form action={deleteDiscount}>
                <input type="hidden" name="id" value={discount.id} />
                <input type="hidden" name="student_id" value={student.id} />
                <button
                  type="submit"
                  className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  {t.delete}
                </button>
              </form>
            </div>
          ))}
          {(discounts ?? []).length === 0 && (
            <p className="text-xs text-slate-400">{t.noDiscounts}</p>
          )}
        </div>

        <form action={createDiscount} className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="student_id" value={student.id} />
          <input
            name="label"
            placeholder={t.discountLabelPlaceholder}
            required
            className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <select name="discount_type" defaultValue="percentage" className="rounded-md border border-slate-300 px-2 py-1 text-sm">
            <option value="percentage">{t.discountTypePercentage}</option>
            <option value="fixed_amount">{t.discountTypeFixed}</option>
          </select>
          <input
            name="value"
            type="number"
            min="0"
            step="1"
            placeholder={t.formValuePlaceholder}
            required
            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <input name="starts_on" type="date" required className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
          <input name="ends_on" type="date" required className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            {t.addDiscount}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t.sectionPaymentHistory}</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 font-medium">{t.colDate}</th>
              <th className="py-1 font-medium">{t.colAmount}</th>
              <th className="py-1 font-medium">{t.colMethod}</th>
              <th className="py-1 font-medium">{t.colReceipt}</th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((payment) => (
              <tr key={payment.id} className="border-t border-slate-100">
                <td className="py-1.5 text-slate-600">
                  {formatDate(payment.paid_at, language)}
                </td>
                <td className="py-1.5 text-slate-600">{payment.amount}</td>
                <td className="py-1.5 text-slate-600">{paymentMethodLabel(payment.payment_method, language)}</td>
                <td className="py-1.5">
                  <Link
                    href={`/dashboard/payments/${payment.id}/receipt`}
                    className="text-slate-900 underline"
                  >
                    {t.viewReceipt}
                  </Link>
                </td>
              </tr>
            ))}
            {(payments ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-center text-xs text-slate-400">
                  {t.noPayments}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
