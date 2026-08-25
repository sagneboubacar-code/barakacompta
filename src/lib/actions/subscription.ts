"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getPlan } from "@/lib/constants/plans";
import { createPaymentRequest } from "@/lib/paytech/client";
import { resolveChariowLicense, ChariowError } from "@/lib/chariow";
import { createAdminClient } from "@/lib/supabase/admin";
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
  } catch (err) {
    // Clés PayTech pas encore configurées, ou service indisponible : on
    // garde la demande "pending" et on retombe sur le parcours manuel
    // plutôt que de bloquer l'utilisateur.
    console.error("PayTech — création de la demande de paiement impossible", err);
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

// Active l'abonnement à partir d'une clé de licence achetée sur Chariow.
// La vérification (validité, produit -> plan) se fait entièrement côté
// serveur auprès de Chariow ; une clé ne peut être échangée qu'une seule
// fois (contrôle sur external_reference) pour empêcher sa réutilisation par
// une autre école.
export async function redeemChariowLicense(formData: FormData) {
  const appUser = await requireRole(["owner"]);

  const licenseKey = String(formData.get("license_key") ?? "").trim();
  if (!licenseKey) {
    fail("Merci de renseigner votre clé de licence Chariow.");
  }

  // service_role : l'activation d'un plan (status "completed") est un
  // traitement de confiance, volontairement hors de portée de l'écriture
  // normale (RLS) — la vérification qui précède, faite serveur-à-serveur
  // auprès de Chariow, est ce qui la rend légitime ici. Nécessaire aussi
  // pour repérer une licence déjà utilisée par une AUTRE école (RLS
  // limiterait sinon la recherche à la seule école courante).
  const admin = createAdminClient();

  const { data: alreadyUsed } = await admin
    .from("subscription_payments")
    .select("id")
    .eq("payment_method", "chariow")
    .eq("external_reference", licenseKey)
    .eq("status", "completed")
    .maybeSingle();

  if (alreadyUsed) {
    fail("Cette clé de licence a déjà été utilisée.");
  }

  let plan;
  try {
    ({ plan } = await resolveChariowLicense(licenseKey));
  } catch (err) {
    fail(err instanceof ChariowError ? err.message : "Vérification de la licence impossible.");
  }

  const planDef = getPlan(plan);
  const periodStart = new Date().toISOString().slice(0, 10);
  const periodEndDate = new Date();
  periodEndDate.setMonth(periodEndDate.getMonth() + 1);
  const periodEnd = periodEndDate.toISOString().slice(0, 10);

  const { error: insertError } = await admin.from("subscription_payments").insert({
    school_id: appUser.school_id ?? "",
    plan: planDef.key,
    amount: planDef.priceXOF ?? 0,
    currency: "XOF",
    payment_method: "chariow" as SubscriptionPaymentMethod,
    status: "completed",
    external_reference: licenseKey,
    period_start: periodStart,
    period_end: periodEnd,
    requested_by: appUser.id,
  });

  if (insertError) {
    fail("Licence valide, mais l'enregistrement a échoué : " + insertError.message);
  }

  const { error: schoolError } = await admin
    .from("schools")
    .update({ plan: planDef.key, subscription_status: "active", subscription_expires_at: periodEnd })
    .eq("id", appUser.school_id ?? "");

  if (schoolError) {
    fail("Licence enregistrée, mais l'activation du plan a échoué : " + schoolError.message);
  }

  redirect(
    `${BILLING_PATH}?success=${encodeURIComponent(`Plan ${planDef.label} activé avec succès.`)}`
  );
}
