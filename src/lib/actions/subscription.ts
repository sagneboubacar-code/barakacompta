"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getPlan } from "@/lib/constants/plans";
import { resolveChariowLicense, ChariowError } from "@/lib/chariow";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionPaymentMethod, SubscriptionPlan } from "@/types";

const BILLING_PATH = "/dashboard/billing";
const VALID_PLANS: SubscriptionPlan[] = ["basic", "pro"];

function fail(message: string): never {
  redirect(`${BILLING_PATH}?error=${encodeURIComponent(message)}`);
}

// Enregistre une demande de renouvellement (statut "pending") sans paiement
// en ligne : le parcours payant passe par Chariow (voir
// redeemChariowLicense). Cette demande sert aux cas traités hors app —
// virement, espèces, mobile money envoyé directement — que le staff
// confirme ensuite depuis l'espace d'administration.
export async function requestRenewal(formData: FormData) {
  const appUser = await requireRole(["owner"]);
  const supabase = createServerSupabase();

  const planKey = String(formData.get("plan") ?? "");

  if (!VALID_PLANS.includes(planKey as SubscriptionPlan)) {
    fail("Merci de choisir un plan valide.");
  }

  const plan = getPlan(planKey);
  const periodStart = new Date().toISOString().slice(0, 10);
  const periodEndDate = new Date();
  periodEndDate.setMonth(periodEndDate.getMonth() + 1);
  const periodEnd = periodEndDate.toISOString().slice(0, 10);

  const { data: inserted, error } = await supabase
    .from("subscription_payments")
    .insert({
      school_id: appUser.school_id ?? "",
      plan: plan.key,
      amount: plan.priceXOF ?? 0,
      currency: "XOF",
      payment_method: "manual" as SubscriptionPaymentMethod,
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

  redirect(
    `${BILLING_PATH}?success=${encodeURIComponent(
      "Demande enregistrée. Notre équipe vous contacte pour finaliser l'activation."
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
