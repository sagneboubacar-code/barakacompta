"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getPlan } from "@/lib/constants/plans";
import type { SubscriptionPaymentMethod, SubscriptionPlan } from "@/types";

const BILLING_PATH = "/dashboard/billing";
const VALID_PLANS: SubscriptionPlan[] = ["basic", "pro", "premium"];
const VALID_METHODS: SubscriptionPaymentMethod[] = ["wave", "orange_money", "card"];

function fail(message: string): never {
  redirect(`${BILLING_PATH}?error=${encodeURIComponent(message)}`);
}

function ok(message: string): never {
  redirect(`${BILLING_PATH}?success=${encodeURIComponent(message)}`);
}

// Aucune intégration de paiement réelle : cette action pose uniquement la
// structure — elle enregistre une demande "pending". Un futur traitement de
// confiance (webhook Wave/Orange Money, retour de la passerelle carte),
// exécuté avec la service_role, sera seul habilité à la faire passer à
// completed/failed.
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

  const { error } = await supabase.from("subscription_payments").insert({
    school_id: appUser.school_id ?? "",
    plan: plan.key,
    amount: plan.priceXOF ?? 0,
    currency: "XOF",
    payment_method: method as SubscriptionPaymentMethod,
    status: "pending",
    period_start: periodStart,
    period_end: periodEnd,
    requested_by: appUser.id,
  });

  if (error) fail("Impossible d'enregistrer la demande : " + error.message);

  ok(
    "Demande enregistrée. Le paiement en ligne n'est pas encore activé : notre équipe vous contactera pour finaliser l'activation de votre abonnement."
  );
}
