"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getPlan } from "@/lib/constants/plans";
import { createInvoice } from "@/lib/paydunya/client";
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

// Crée la demande de renouvellement puis, si PayDunya est configuré, une
// facture de paiement réelle vers laquelle on redirige l'utilisateur.
// L'activation du plan ne se fait jamais ici : seul le webhook IPN
// (server-to-server, revérifié auprès de PayDunya) peut faire passer la
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
    const invoice = await createInvoice({
      amount: plan.priceXOF ?? 0,
      description: `Abonnement Baraka Gestion — ${plan.label} — ${school?.name ?? ""}`,
      externalId: inserted.id,
      returnUrl: `${siteUrl()}${BILLING_PATH}?success=${encodeURIComponent("Paiement reçu, activation en cours.")}`,
      cancelUrl: `${siteUrl()}${BILLING_PATH}?error=${encodeURIComponent("Paiement annulé.")}`,
      ipnUrl: `${siteUrl()}/api/paydunya/ipn`,
      customer: { name: appUser.full_name ?? "", email: appUser.email ?? "" },
    });

    await supabase
      .from("subscription_payments")
      .update({ external_reference: invoice.token })
      .eq("id", inserted.id);

    checkoutUrl = invoice.checkoutUrl;
  } catch (err) {
    // Clés PayDunya pas encore configurées, ou service indisponible : on
    // garde la demande "pending" et on retombe sur le parcours manuel
    // plutôt que de bloquer l'utilisateur.
    console.error("PayDunya — création de facture impossible", err);
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
