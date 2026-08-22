import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { requestRenewal } from "@/lib/actions/subscription";
import { PLANS, getPlan, type GatedModule } from "@/lib/constants/plans";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  card: "Carte bancaire",
};

const SUBSCRIPTION_PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  completed: "Confirmé",
  failed: "Échoué",
  cancelled: "Annulé",
};

const MODULE_LABELS: Record<GatedModule, string> = {
  collections: "Recouvrement",
  reports: "Rapports financiers",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string; upgrade?: string };
}) {
  const appUser = await requireUser();
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
        <h1 className="text-xl font-semibold text-slate-900">Abonnement</h1>
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
          Le module &laquo; {MODULE_LABELS[searchParams.upgrade as GatedModule] ?? searchParams.upgrade} &raquo;
          n&apos;est pas inclus dans votre plan actuel ({currentPlan.label}).
        </p>
      )}

      {isExpired ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Abonnement expiré</p>
          <p className="mt-1 text-sm text-red-700">
            L&apos;accès aux fonctionnalités de l&apos;école est bloqué depuis le{" "}
            {new Date(school?.subscription_expires_at ?? today).toLocaleDateString("fr-FR")}. Renouvelez
            votre abonnement ci-dessous pour rétablir l&apos;accès.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-800">
            Plan <strong>{currentPlan.label}</strong> actif jusqu&apos;au{" "}
            {new Date(school?.subscription_expires_at ?? today).toLocaleDateString("fr-FR")} ({daysRemaining}{" "}
            jour{daysRemaining > 1 ? "s" : ""} restant{daysRemaining > 1 ? "s" : ""}).
          </p>
        </div>
      )}

      {!isOwner && (
        <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Seul le propriétaire de l&apos;école peut renouveler l&apos;abonnement. Contactez-le si l&apos;accès
          est bloqué.
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
                  <p className="text-sm font-semibold text-slate-900">{plan.label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {plan.priceXOF === 0 ? "Gratuit" : `${plan.priceXOF} XOF`}
                    {plan.priceXOF !== 0 && <span className="text-xs font-normal text-slate-500">/mois</span>}
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-slate-600">
                    <li>{plan.maxStudents === null ? "Élèves illimités" : `Jusqu'à ${plan.maxStudents} élèves`}</li>
                    <li>Élèves, tarifs, paiements, dépenses</li>
                    {plan.modules.map((moduleKey) => (
                      <li key={moduleKey}>{MODULE_LABELS[moduleKey]}</li>
                    ))}
                    {plan.trialDays && <li>{plan.trialDays} jours d&apos;essai</li>}
                  </ul>

                  {isCurrent ? (
                    <p className="mt-4 text-center text-xs font-medium text-slate-500">Plan actuel</p>
                  ) : plan.priceXOF === 0 ? (
                    <p className="mt-4 text-center text-xs text-slate-400">Réservé au nouvel essai</p>
                  ) : (
                    <form action={requestRenewal} className="mt-4 space-y-2">
                      <input type="hidden" name="plan" value={plan.key} />
                      <select
                        name="payment_method"
                        required
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                      >
                        <option value="">Moyen de paiement</option>
                        <option value="wave">Wave</option>
                        <option value="orange_money">Orange Money</option>
                        <option value="card">Carte bancaire</option>
                      </select>
                      <button
                        type="submit"
                        className="w-full rounded-md bg-slate-900 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Demander le renouvellement
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-400">
            Le paiement en ligne (Wave, Orange Money, carte bancaire) n&apos;est pas encore activé. Votre
            demande est enregistrée et notre équipe vous contacte pour finaliser l&apos;activation.
          </p>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Historique des demandes</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 font-medium">Date</th>
                  <th className="py-1 font-medium">Plan</th>
                  <th className="py-1 font-medium">Montant</th>
                  <th className="py-1 font-medium">Moyen</th>
                  <th className="py-1 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {(history ?? []).map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">
                      {new Date(entry.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="py-1.5 text-slate-600">{getPlan(entry.plan).label}</td>
                    <td className="py-1.5 text-slate-600">
                      {entry.amount} {entry.currency}
                    </td>
                    <td className="py-1.5 text-slate-600">
                      {PAYMENT_METHOD_LABELS[entry.payment_method] ?? entry.payment_method}
                    </td>
                    <td className="py-1.5 text-slate-600">
                      {SUBSCRIPTION_PAYMENT_STATUS_LABELS[entry.status] ?? entry.status}
                    </td>
                  </tr>
                ))}
                {(history ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-xs text-slate-400">
                      Aucune demande enregistrée.
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
