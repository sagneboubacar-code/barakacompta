import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { requestRenewal } from "@/lib/actions/subscription";
import { PLANS, getPlan, type GatedModule } from "@/lib/constants/plans";
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardBillingDict } from "@/lib/i18n/dictionaries/dashboard-billing";
import { formatDate } from "@/lib/format";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string; upgrade?: string };
}) {
  const appUser = await requireUser();
  const language = getLanguage();
  const t = dashboardBillingDict[language];
  const MODULE_LABELS = t.moduleLabels as Record<GatedModule, string>;
  const supabase = createClient();

  const { data: school } = await supabase
    .from("schools")
    .select("name, plan, subscription_status, subscription_started_at, subscription_expires_at")
    .eq("id", appUser.school_id ?? "")
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const isExpired =
    !school || school.subscription_status === "cancelled" || school.subscription_expires_at < today;

  const daysRemaining = school
    ? Math.ceil(
        (new Date(school.subscription_expires_at).getTime() - new Date(today).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  const currentPlan = getPlan(school?.plan ?? "trial");
  const currentPlanLabel = t.planLabels[currentPlan.key] ?? currentPlan.label;
  const isOwner = appUser.role === "owner";

  const { data: history } = isOwner
    ? await supabase
        .from("subscription_payments")
        .select("id, plan, amount, currency, payment_method, status, created_at")
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: null };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t.title}</h1>
        <p className="text-sm text-slate-500">{school?.name}</p>
      </div>

      {searchParams.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}
      {searchParams.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{searchParams.success}</p>
      )}
      {searchParams.upgrade && (
        <p className="rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-700">
          {t.upgradeNotice(
            MODULE_LABELS[searchParams.upgrade as GatedModule] ?? searchParams.upgrade,
            currentPlanLabel
          )}
        </p>
      )}

      {isExpired ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">{t.expiredTitle}</p>
          <p className="mt-1 text-sm text-red-700">
            {t.expiredText(formatDate(school?.subscription_expires_at ?? today, language))}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-800">
            {t.activePrefix}
            <strong>{currentPlanLabel}</strong>
            {t.activeSuffix(formatDate(school?.subscription_expires_at ?? today, language), daysRemaining)}
          </p>
        </div>
      )}

      {!isOwner && (
        <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
          {t.notOwner}
        </p>
      )}

      {isOwner && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => {
              const isCurrent = plan.key === currentPlan.key;
              return (
                <div
                  key={plan.key}
                  className={`rounded-lg border bg-white p-4 shadow-sm ${
                    isCurrent ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{t.planLabels[plan.key] ?? plan.label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {plan.priceXOF === 0 ? t.free : `${plan.priceXOF} XOF`}
                    {plan.priceXOF !== 0 && <span className="text-xs font-normal text-slate-500">{t.perMonth}</span>}
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-slate-600">
                    <li>{plan.maxStudents === null ? t.unlimitedStudents : t.upToStudents(plan.maxStudents)}</li>
                    <li>{t.coreLine}</li>
                    {plan.modules.map((moduleKey) => (
                      <li key={moduleKey}>{MODULE_LABELS[moduleKey]}</li>
                    ))}
                    {plan.trialDays && <li>{t.trialDaysLine(plan.trialDays)}</li>}
                  </ul>

                  {isCurrent ? (
                    <p className="mt-4 text-center text-xs font-medium text-slate-500">{t.currentPlan}</p>
                  ) : plan.priceXOF === 0 ? (
                    <p className="mt-4 text-center text-xs text-slate-400">{t.reservedNewTrial}</p>
                  ) : (
                    <form action={requestRenewal} className="mt-4 space-y-2">
                      <input type="hidden" name="plan" value={plan.key} />
                      <select
                        name="payment_method"
                        required
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                      >
                        <option value="">{t.paymentMethodPlaceholder}</option>
                        <option value="wave">{t.wave}</option>
                        <option value="orange_money">{t.orangeMoney}</option>
                        <option value="card">{t.card}</option>
                      </select>
                      <button
                        type="submit"
                        className="w-full rounded-md bg-slate-900 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        {t.requestRenewal}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-400">{t.secureRedirectNote}</p>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">{t.historyTitle}</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 font-medium">{t.colDate}</th>
                  <th className="py-1 font-medium">{t.colPlan}</th>
                  <th className="py-1 font-medium">{t.colAmount}</th>
                  <th className="py-1 font-medium">{t.colMethod}</th>
                  <th className="py-1 font-medium">{t.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {(history ?? []).map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">
                      {formatDate(entry.created_at, language)}
                    </td>
                    <td className="py-1.5 text-slate-600">{t.planLabels[entry.plan] ?? getPlan(entry.plan).label}</td>
                    <td className="py-1.5 text-slate-600">
                      {entry.amount} {entry.currency}
                    </td>
                    <td className="py-1.5 text-slate-600">
                      {t.paymentMethodLabels[entry.payment_method] ?? entry.payment_method}
                    </td>
                    <td className="py-1.5 text-slate-600">
                      {t.paymentStatusLabels[entry.status] ?? entry.status}
                    </td>
                  </tr>
                ))}
                {(history ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-xs text-slate-400">
                      {t.noHistory}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
