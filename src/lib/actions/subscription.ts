"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getPlan } from "@/lib/constants/plans";
import { createPaymentRequest } from "@/lib/paytech/client";
import { createCheckoutSession as createWaveCheckoutSession } from "@/lib/wave/client";
import type { SubscriptionPaymentMethod, SubscriptionPlan } from "@/types";

const BILLING_PATH = "/dashboard/billing";
const VALID_PLANS: SubscriptionPlan[] = ["basic", "pro", "premium"];
const VALID_METHODS: SubscriptionPaymentMethod[] = ["wave", "orange_money", "card"];

function fail(message: string): never {
  redirect(`${BILLING_PATH}?error=${encodeURIComponent(message)}`);
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://barakacompta.vercel.app";
}

// Crée la demande de renouvellement puis, si PayTech est configuré, une
// demande de paiement réelle vers laquelle on redirige l'utilisateur.
// L'activation du plan ne se fait jamais ici : seul le webhook IPN
// (server-to-server, revérifié auprès de PayTech) peut faire passer la
// demande de "pending" à "completed".
export async function requestRenewal(formData: FormData) {
  const appUser = await requireRole(["owner"]);
  const supabase = createServerSupabase();

  const planKey = String(formData.get("plan") ?? "");
  const method = String(formData.get("payment_method") ?? "");

  if (!VALID_PLANS.includes(planKey as SubscriptionPlan) || !VALID_METHODS.includes(method as SubscriptionPaymentMethod)) {
    fail("Merci de choisir un plan et un moyen de paiement valides.");
  }

  const plan = getPlan(planKey);
  const periodStart = new Date().toISOString().slice(0, 10);
  const periodEndDate = new Date();
  periodEndDate.setMonth(periodEndDate.getMonth() + 1);
  const periodEnd = periodEndDate.toISOString().slice(0, 10);

  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", appUser.school_id ?? "")
    .maybeSingle();

  const { data: inserted, error } = await supabase
    .from("subscription_payments")
    .insert({
      school_id: appUser.school_id ?? "",
      plan: plan.key,
      amount: plan.priceXOF ?? 0,
      currency: "XOF",
      payment_method: method as SubscriptionPaymentMethod,
      status: "pending",
      period_start: periodStart,
      period_end: periodEnd,
      requested_by: appUser.id,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    fail("Impossible d'enregistrer la demande : " + (error?.message ?? ""));
  }

  // redirect() lève une exception interne pour interrompre le rendu : elle
  // ne doit jamais se retrouver dans le try/catch ci-dessous, sous peine
  // d'être avalée par le catch et transformée en faux message d'erreur.
  let checkoutUrl: string | null = null;
  try {
    if (method === "wave") {
      // Intégration directe Wave (pas via PayTech) : leur sous-intégration
      // Wave plafonne les transactions réelles à un montant test fixe,
      // indépendamment du montant envoyé — on contourne le problème en
      // parlant directement à l'API Wave pour ce moyen de paiement précis.
      const session = await createWaveCheckoutSession({
        amount: plan.priceXOF ?? 0,
        clientReference: inserted.id,
        successUrl: `${siteUrl()}${BILLING_PATH}?success=${encodeURIComponent("Paiement reçu, activation en cours.")}`,
        errorUrl: `${siteUrl()}${BILLING_PATH}?error=${encodeURIComponent("Paiement annulé.")}`,
      });

      await supabase
        .from("subscription_payments")
        .update({ external_reference: session.id })
        .eq("id", inserted.id);

      checkoutUrl = session.launchUrl;
    } else {
      const payment = await createPaymentRequest({
        amount: plan.priceXOF ?? 0,
        itemName: `Abonnement Baraka Compta — ${plan.label} — ${school?.name ?? ""}`,
        refCommand: inserted.id,
        successUrl: `${siteUrl()}${BILLING_PATH}?success=${encodeURIComponent("Paiement reçu, activation en cours.")}`,
        cancelUrl: `${siteUrl()}${BILLING_PATH}?error=${encodeURIComponent("Paiement annulé.")}`,
        ipnUrl: `${siteUrl()}/api/paytech/ipn`,
      });

      await supabase
        .from("subscription_payments")
        .update({ external_reference: payment.token })
        .eq("id", inserted.id);

      checkoutUrl = payment.redirectUrl;
    }
  } catch (err) {
    // Clés pas encore configurées, ou service indisponible : on garde la
    // demande "pending" et on retombe sur le parcours manuel plutôt que de
    // bloquer l'utilisateur.
    console.error("Création de la demande de paiement impossible", err);
  }

  if (checkoutUrl) {
    redirect(checkoutUrl);
  }

  redirect(
    `${BILLING_PATH}?success=${encodeURIComponent(
      "Demande enregistrée. Le paiement en ligne n'est pas encore actif : notre équipe vous contacte pour finaliser l'activation."
    )}`
  );
}
