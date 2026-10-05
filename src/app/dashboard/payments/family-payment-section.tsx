import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { recordFamilyPayment } from "@/lib/actions/payments";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/constants/payments";
import { scheduleItemLabel } from "@/lib/schedules";
import { formatMonthLabel } from "@/lib/constants/months";
import { FamilyPaymentLines, type FamilyPaymentLine } from "@/components/FamilyPaymentLines";
import { dashboardPaymentsDict } from "@/lib/i18n/dictionaries/dashboard-payments";
import type { Language } from "@/lib/i18n/config";
import { formatCurrency } from "@/lib/format";


// Onglet « Par famille » de la page Paiements : la famille choisie, ce
// qu'elle doit période par période (mois de mensualité, ou inscription et
// autres frais), puis l'encaissement en une fois avec un seul reçu.
export async function FamilyPaymentSection({
  familyId,
  period,
  language,
  schoolId,
  cashManagers,
}: {
  familyId?: string;
  period?: string;
  language: Language;
  schoolId: string;
  cashManagers: { id: string; name: string }[];
}) {
  const t = dashboardPaymentsDict[language];
  const supabase = createClient();

  const [{ data: families }, { data: members }, { data: school }] = await Promise.all([
    supabase.from("families").select("id, name").order("name"),
    supabase
      .from("students")
      .select("id, first_name, last_name, family_id, status")
      .not("family_id", "is", null)
      .order("last_name")
      .order("first_name"),
    supabase.from("schools").select("currency").eq("id", schoolId).maybeSingle(),
  ]);
  const money = (amount: number) => formatCurrency(amount, school?.currency, language);

  if ((families ?? []).length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        {t.noFamilies}{" "}
        <Link href="/dashboard/families" className="underline">
          {t.familyLabel}
        </Link>
      </section>
    );
  }

  const childrenOf = (id: string) => (members ?? []).filter((m) => m.family_id === id);
  const family = (families ?? []).find((f) => f.id === familyId);
  const children = family ? childrenOf(family.id) : [];
  const childName = new Map(children.map((c) => [c.id, `${c.last_name} ${c.first_name}`]));

  const { data: schedules } =
    children.length > 0
      ? await supabase
          .from("payment_schedules")
          .select("id, student_id, due_date, amount_remaining, status, fee_structures(fee_type, month)")
          .in(
            "student_id",
            children.map((c) => c.id)
          )
          .in("status", ["pending", "partial", "overdue"])
          .gt("amount_remaining", 0)
          .order("due_date")
      : { data: [] };

  // Chaque échéance due est rangée dans le mois où elle est à payer, comme au
  // recouvrement : début novembre, la famille règle ensemble la mensualité
  // d'octobre (terme échu) et la cantine de novembre (payée d'avance). Le
  // libellé de chaque ligne dit de quel mois il s'agit.
  const due = (schedules ?? []).map((schedule) => {
    const fee = Array.isArray(schedule.fee_structures) ? schedule.fee_structures[0] : schedule.fee_structures;
    return {
      id: schedule.id,
      studentId: schedule.student_id,
      amount: Number(schedule.amount_remaining),
      periodKey: schedule.due_date.slice(0, 7),
      label: scheduleItemLabel(fee ?? null, schedule.due_date, language),
    };
  });

  const periodTotals = new Map<string, number>();
  for (const item of due) periodTotals.set(item.periodKey, (periodTotals.get(item.periodKey) ?? 0) + item.amount);
  const periods = Array.from(periodTotals.keys()).sort((a, b) => a.localeCompare(b));
  const periodLabel = (key: string) => formatMonthLabel(key, language);

  const selectedPeriod = period && periodTotals.has(period) ? period : undefined;
  const lines: FamilyPaymentLine[] = selectedPeriod
    ? due
        .filter((item) => item.periodKey === selectedPeriod)
        .sort(
          (a, b) =>
            (childName.get(a.studentId) ?? "").localeCompare(childName.get(b.studentId) ?? "") ||
            a.label.localeCompare(b.label)
        )
        .map((item) => ({
          id: item.id,
          childName: childName.get(item.studentId) ?? t.dash,
          label: item.label,
          amount: item.amount,
        }))
    : [];
  const periodHref = (key: string) =>
    `/dashboard/payments?mode=family&family_id=${family?.id}&period=${encodeURIComponent(key)}`;

  return (
    <>
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <input type="hidden" name="mode" value="family" />
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.familyLabel}</span>
          <select
            name="family_id"
            defaultValue={family?.id ?? ""}
            className="w-72 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">{t.chooseFamily}</option>
            {(families ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {t.familyOption(f.name, childrenOf(f.id).filter((c) => c.status === "active").length)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.chooseFamilyButton}
        </button>
      </form>

      {family && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {t.familyOwesTitle} — {family.name}
            </h2>
            <Link href={`/dashboard/families/${family.id}`} className="text-xs text-slate-500 underline">
              {t.viewFullProfile}
            </Link>
          </div>

          {periods.length === 0 ? (
            <p className="mt-3 text-sm text-green-700">{t.familyNothingDue}</p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 pe-3 font-medium">{t.periodCol}</th>
                  <th className="py-1 pe-3 text-end font-medium">{t.amountDueCol}</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {periods.map((key) => (
                  <tr
                    key={key}
                    className={`border-t border-slate-100 ${key === selectedPeriod ? "bg-emerald-50" : ""}`}
                  >
                    <td className="py-1.5 pe-3 text-slate-900">{periodLabel(key)}</td>
                    <td className="py-1.5 pe-3 text-end tabular-nums text-slate-900">
                      {money(periodTotals.get(key) ?? 0)}
                    </td>
                    <td className="py-1.5 text-end">
                      {key === selectedPeriod ? (
                        <span className="text-xs font-medium text-emerald-700">{t.periodSelected}</span>
                      ) : (
                        <Link
                          href={periodHref(key)}
                          className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          {t.periodChoose}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {family && selectedPeriod && (
        <section className="rounded-lg border border-emerald-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t.familyLinesTitle(periodLabel(selectedPeriod))}</h2>
          <form action={recordFamilyPayment} className="mt-3">
            <input type="hidden" name="family_id" value={family.id} />
            <input type="hidden" name="period" value={selectedPeriod} />
            <FamilyPaymentLines
              key={`${family.id}-${selectedPeriod}`}
              lines={lines}
              currency={school?.currency ?? null}
              language={language}
              labels={{
                child: t.linesChild,
                item: t.linesItem,
                due: t.linesDue,
                paid: t.linesPaid,
                totalDue: t.linesTotal,
                received: t.receivedLabel,
                receivedHint: t.receivedHint,
                remainingAfter: t.remainingAfter,
                submit: t.familySubmit,
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-slate-600">{t.dateLabel}</span>
                  <input
                    name="paid_at"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-slate-600">{t.paymentMethodLabel}</span>
                  <select
                    name="payment_method"
                    defaultValue="cash"
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method.key} value={method.key}>
                        {paymentMethodLabel(method.key, language)}
                      </option>
                    ))}
                  </select>
                </label>
                {cashManagers.length > 0 && (
                  <label className="space-y-1 text-sm">
                    <span className="text-slate-600">{t.cashManagerLabel}</span>
                    <select
                      name="cash_manager_id"
                      defaultValue=""
                      className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                      <option value="">{t.dash}</option>
                      {cashManagers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="space-y-1 text-sm">
                  <span className="text-slate-600">{t.referenceLabel}</span>
                  <input name="reference" className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
                </label>
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="text-slate-600">{t.notesLabel}</span>
                  <input name="notes" className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
                </label>
                <p className="text-xs text-slate-400 sm:col-span-2">{t.familyHint}</p>
              </div>
            </FamilyPaymentLines>
          </form>
        </section>
      )}
    </>
  );
}
