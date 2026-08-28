import { requireRole } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/lib/actions/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/constants/payments";
import { getLanguage } from "@/lib/i18n/get-language";
import { adminDict } from "@/lib/i18n/dictionaries/admin";

// Vue globale multi-écoles réservée au staff Baraka (role="super_admin").
// Utilise le client service_role car ces données traversent volontairement
// toutes les écoles — la RLS normale (scoped à une seule école) ne peut pas
// et ne doit pas laisser passer ça pour un compte "owner"/"admin" classique.
// C'est requireRole ci-dessous qui porte toute la barrière de sécurité.
export default async function AdminPage() {
  const appUser = await requireRole(["super_admin"]);
  const language = getLanguage();
  const t = adminDict[language];
  const admin = createAdminClient();

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: schools }, { data: payments }] = await Promise.all([
    admin
      .from("schools")
      .select("id, name, plan, subscription_status, subscription_expires_at, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("subscription_payments")
      .select("id, school_id, plan, amount, currency, status, payment_method, created_at")
      .eq("status", "completed")
      .order("created_at", { ascending: false }),
  ]);

  const allSchools = schools ?? [];
  const completedPayments = payments ?? [];

  const activeCount = allSchools.filter(
    (s) => s.subscription_status === "active" && s.subscription_expires_at >= today && s.plan !== "trial"
  ).length;
  const trialCount = allSchools.filter((s) => s.plan === "trial").length;
  const expiredCount = allSchools.filter(
    (s) => s.subscription_status === "cancelled" || s.subscription_expires_at < today
  ).length;

  const totalRevenue = completedPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const currentMonthPrefix = today.slice(0, 7);
  const monthRevenue = completedPayments
    .filter((p) => p.created_at.slice(0, 7) === currentMonthPrefix)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const revenueByPlan = (["basic", "pro"] as const).map((planKey) => ({
    plan: planKey,
    schools: allSchools.filter((s) => s.plan === planKey).length,
    revenue: completedPayments.filter((p) => p.plan === planKey).reduce((sum, p) => sum + Number(p.amount), 0),
  }));

  const kpis = [
    { label: t.kpiTotalSchools, value: allSchools.length.toString() },
    { label: t.kpiActiveSubs, value: activeCount.toString() },
    { label: t.kpiTrial, value: trialCount.toString() },
    { label: t.kpiExpired, value: expiredCount.toString() },
    { label: t.kpiTotalRevenue, value: formatCurrency(totalRevenue, undefined, language) },
    { label: t.kpiMonthRevenue, value: formatCurrency(monthRevenue, undefined, language) },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">{t.brand}</p>
            <p className="text-sm text-slate-500">{appUser.full_name ?? appUser.email}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              {t.signOut}
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">{kpi.value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t.revenueByPlan}</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 font-medium">{t.colPlan}</th>
                <th className="py-1 font-medium">{t.colSchools}</th>
                <th className="py-1 font-medium">{t.colTotalRevenue}</th>
              </tr>
            </thead>
            <tbody>
              {revenueByPlan.map((row) => (
                <tr key={row.plan} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-900">{t.planLabels[row.plan] ?? row.plan}</td>
                  <td className="py-1.5 text-slate-600">{row.schools}</td>
                  <td className="py-1.5 font-mono tabular-nums text-slate-600">
                    {formatCurrency(row.revenue, undefined, language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t.schoolsSection(allSchools.length)}</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 font-medium">{t.colSchool}</th>
                <th className="py-1 font-medium">{t.colPlan}</th>
                <th className="py-1 font-medium">{t.colStatus}</th>
                <th className="py-1 font-medium">{t.colExpiresOn}</th>
                <th className="py-1 font-medium">{t.colRegisteredOn}</th>
              </tr>
            </thead>
            <tbody>
              {allSchools.map((school) => {
                const expired = school.subscription_status === "cancelled" || school.subscription_expires_at < today;
                return (
                  <tr key={school.id} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-900">{school.name}</td>
                    <td className="py-1.5 text-slate-600">{t.planLabels[school.plan] ?? school.plan}</td>
                    <td className={`py-1.5 font-medium ${expired ? "text-red-700" : "text-green-700"}`}>
                      {expired ? t.statusExpired : t.statusActive}
                    </td>
                    <td className="py-1.5 text-slate-600">
                      {formatDate(school.subscription_expires_at, language)}
                    </td>
                    <td className="py-1.5 text-slate-600">{formatDate(school.created_at, language)}</td>
                  </tr>
                );
              })}
              {allSchools.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-xs text-slate-400">
                    {t.noSchools}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t.recentPayments}</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 font-medium">{t.colDate}</th>
                <th className="py-1 font-medium">{t.colSchool}</th>
                <th className="py-1 font-medium">{t.colPlan}</th>
                <th className="py-1 font-medium">{t.colAmount}</th>
                <th className="py-1 font-medium">{t.colMethod}</th>
              </tr>
            </thead>
            <tbody>
              {completedPayments.slice(0, 15).map((payment) => (
                <tr key={payment.id} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-600">{formatDate(payment.created_at, language)}</td>
                  <td className="py-1.5 text-slate-900">
                    {allSchools.find((s) => s.id === payment.school_id)?.name ?? "—"}
                  </td>
                  <td className="py-1.5 text-slate-600">{t.planLabels[payment.plan] ?? payment.plan}</td>
                  <td className="py-1.5 font-mono tabular-nums text-slate-600">
                    {formatCurrency(Number(payment.amount), payment.currency, language)}
                  </td>
                  <td className="py-1.5 text-slate-600">
                    {paymentMethodLabel(payment.payment_method, language)}
                  </td>
                </tr>
              ))}
              {completedPayments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-xs text-slate-400">
                    {t.noPayments}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
