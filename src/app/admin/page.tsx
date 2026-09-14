import { requireRole } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/lib/actions/auth";
import { activateSubscriptionManually } from "@/lib/actions/admin";
import { formatCurrency, formatDate } from "@/lib/format";
import { telHref, whatsappHref, formatPhone } from "@/lib/phone";
import { paymentMethodLabel } from "@/lib/constants/payments";
import { getLanguage } from "@/lib/i18n/get-language";
import { adminDict } from "@/lib/i18n/dictionaries/admin";

// Vue globale multi-écoles réservée au staff Baraka (role="super_admin").
// Utilise le client service_role car ces données traversent volontairement
// toutes les écoles — la RLS normale (scoped à une seule école) ne peut pas
// et ne doit pas laisser passer ça pour un compte "owner"/"admin" classique.
// C'est requireRole ci-dessous qui porte toute la barrière de sécurité.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const appUser = await requireRole(["super_admin"]);
  const language = getLanguage();
  const t = adminDict[language];
  const admin = createAdminClient();

  const today = new Date().toISOString().slice(0, 10);

  // Les listes d'élèves/tarifs/responsables sont ramenées entières puis
  // agrégées ici : à l'échelle de quelques dizaines d'écoles c'est une requête
  // au lieu de trois par école. À revoir le jour où le parc se compte en
  // milliers d'écoles.
  const [{ data: schools }, { data: payments }, { data: students }, { data: fees }, { data: staff }] =
    await Promise.all([
      admin
        .from("schools")
        .select("id, name, plan, subscription_status, subscription_expires_at, created_at, phone")
        .order("created_at", { ascending: false }),
      admin
        .from("subscription_payments")
        .select("id, school_id, plan, amount, currency, status, payment_method, created_at")
        .eq("status", "completed")
        .order("created_at", { ascending: false }),
      admin.from("students").select("school_id, status"),
      admin.from("fee_structures").select("school_id"),
      admin.from("users").select("school_id, full_name, email, phone, role"),
    ]);

  const allSchools = schools ?? [];
  const completedPayments = payments ?? [];

  const studentCount = new Map<string, number>();
  for (const student of students ?? []) {
    if (student.status !== "active" || !student.school_id) continue;
    studentCount.set(student.school_id, (studentCount.get(student.school_id) ?? 0) + 1);
  }

  const feeCount = new Map<string, number>();
  for (const fee of fees ?? []) {
    if (!fee.school_id) continue;
    feeCount.set(fee.school_id, (feeCount.get(fee.school_id) ?? 0) + 1);
  }

  // Le responsable joignable : le propriétaire du compte en priorité, à
  // défaut n'importe quel membre de l'équipe de l'école.
  const contactBySchool = new Map<
    string,
    { full_name: string | null; email: string | null; phone: string | null }
  >();
  for (const member of staff ?? []) {
    if (!member.school_id) continue;
    const current = contactBySchool.get(member.school_id);
    if (!current || member.role === "owner") {
      contactBySchool.set(member.school_id, {
        full_name: member.full_name,
        email: member.email,
        phone: member.phone,
      });
    }
  }

  const daysUntil = (isoDate: string | null) => {
    if (!isoDate) return null;
    const diff = Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
    return Math.round(diff / 86_400_000);
  };

  // "Jamais démarrée" : inscrite, puis plus rien — ni élève, ni tarif. C'est
  // le signal d'une école à rappeler, pas d'une école perdue.
  const neverStartedCount = allSchools.filter(
    (s) => (studentCount.get(s.id) ?? 0) === 0 && (feeCount.get(s.id) ?? 0) === 0
  ).length;

  const expiringSoonCount = allSchools.filter((s) => {
    const days = daysUntil(s.subscription_expires_at);
    return s.subscription_status !== "cancelled" && days !== null && days >= 0 && days <= 7;
  }).length;

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
    { label: t.kpiTotalSchools, value: allSchools.length.toString(), tone: "" },
    { label: t.kpiActiveSubs, value: activeCount.toString(), tone: "" },
    { label: t.kpiTrial, value: trialCount.toString(), tone: "" },
    { label: t.kpiExpired, value: expiredCount.toString(), tone: "" },
    { label: t.kpiNeverStarted, value: neverStartedCount.toString(), tone: "text-amber-700" },
    { label: t.kpiExpiringSoon, value: expiringSoonCount.toString(), tone: "text-rose-700" },
    { label: t.kpiTotalRevenue, value: formatCurrency(totalRevenue, undefined, language), tone: "" },
    { label: t.kpiMonthRevenue, value: formatCurrency(monthRevenue, undefined, language), tone: "" },
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
        {searchParams.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
        )}
        {searchParams.success && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{searchParams.success}</p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p
                className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
                  kpi.tone || "text-slate-900"
                }`}
              >
                {kpi.value}
              </p>
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
                <th className="py-1 font-medium">{t.colStudents}</th>
                <th className="py-1 font-medium">{t.colActivity}</th>
                <th className="py-1 font-medium">{t.colPlan}</th>
                <th className="py-1 font-medium">{t.colStatus}</th>
                <th className="py-1 font-medium">{t.colExpiresOn}</th>
                <th className="py-1 font-medium">{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {allSchools.map((school) => {
                const expired = school.subscription_status === "cancelled" || school.subscription_expires_at < today;
                const students = studentCount.get(school.id) ?? 0;
                const fees = feeCount.get(school.id) ?? 0;
                const neverStarted = students === 0 && fees === 0;
                const contact = contactBySchool.get(school.id);
                const phone = contact?.phone ?? school.phone ?? null;
                const remainingDays = daysUntil(school.subscription_expires_at);
                const urgent = !expired && remainingDays !== null && remainingDays <= 7;
                return (
                  <tr key={school.id} className="border-t border-slate-100 align-top">
                    <td className="py-2 text-slate-900">
                      <span className="font-medium">{school.name}</span>
                      {/* Le contact du responsable est la raison d'être de cet
                          écran : sans lui, repérer une école à relancer ne sert
                          à rien puisqu'on ne peut pas la joindre. */}
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {contact ? `${contact.full_name ?? "—"} · ${contact.email ?? "—"}` : t.noOwner}
                      </span>
                      {/* Le numéro est le plus souvent sur le compte du
                          responsable, pas sur la fiche de l'école : n'afficher
                          que school.phone laissait 5 lignes sur 7 sans numéro. */}
                      {phone ? (
                        <span className="mt-0.5 flex items-center gap-2 text-xs">
                          <a href={telHref(phone) ?? "#"} className="font-medium text-slate-700 hover:underline">
                            {formatPhone(phone)}
                          </a>
                          <a
                            href={whatsappHref(phone) ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            WhatsApp
                          </a>
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-xs text-slate-300">{t.noPhone}</span>
                      )}
                      <span className="block text-xs text-slate-400">
                        {t.colRegisteredOn} {formatDate(school.created_at, language)}
                      </span>
                    </td>
                    <td
                      className={`py-2 font-mono tabular-nums ${
                        students === 0 ? "text-slate-300" : "text-slate-900"
                      }`}
                    >
                      {students}
                    </td>
                    <td className="py-2">
                      {neverStarted ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {t.neverStarted}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">{t.feeCount(fees)}</span>
                      )}
                    </td>
                    <td className="py-2 text-slate-600">{t.planLabels[school.plan] ?? school.plan}</td>
                    <td className={`py-2 font-medium ${expired ? "text-red-700" : "text-green-700"}`}>
                      {expired ? t.statusExpired : t.statusActive}
                    </td>
                    <td className={`py-2 ${urgent ? "text-rose-700" : "text-slate-600"}`}>
                      {formatDate(school.subscription_expires_at, language)}
                      {urgent && remainingDays !== null && (
                        <span className="block text-xs font-medium">{t.expiresInDays(remainingDays)}</span>
                      )}
                    </td>
                    <td className="py-2">
                      <form action={activateSubscriptionManually} className="flex items-center gap-1.5">
                        <input type="hidden" name="school_id" value={school.id} />
                        <select
                          name="plan"
                          required
                          className="rounded-md border border-slate-300 px-1.5 py-1 text-xs"
                        >
                          <option value="basic">{t.planLabels.basic}</option>
                          <option value="pro">{t.planLabels.pro}</option>
                        </select>
                        <input
                          type="number"
                          name="months"
                          defaultValue={1}
                          min={1}
                          max={24}
                          required
                          className="w-14 rounded-md border border-slate-300 px-1.5 py-1 text-xs"
                        />
                        <span className="text-xs text-slate-400">{t.monthsSuffix}</span>
                        <button
                          type="submit"
                          className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                        >
                          {t.activateSubmit}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {allSchools.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-3 text-center text-xs text-slate-400">
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
