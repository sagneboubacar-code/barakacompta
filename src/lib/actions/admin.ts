"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlan } from "@/lib/constants/plans";
import type { SubscriptionPlan } from "@/types";

const ADMIN_PATH = "/admin";
const VALID_PLANS: SubscriptionPlan[] = ["basic", "pro"];

function fail(message: string): never {
  redirect(`${ADMIN_PATH}?error=${encodeURIComponent(message)}`);
}

// Active/prolonge manuellement l'abonnement d'une école — réservé au staff
// Baraka (super_admin). Pour les paiements reçus hors app (virement,
// espèces, mobile money envoyé directement) pendant que PayTech est en
// pause et que Chariow se met en place : le staff constate le paiement et
// l'enregistre ici, sans dépendre d'un agrégateur externe.
export async function activateSubscriptionManually(formData: FormData) {
  const staff = await requireRole(["super_admin"]);

  const schoolId = String(formData.get("school_id") ?? "");
  const planKey = String(formData.get("plan") ?? "");
  const months = Number(formData.get("months") ?? 0);

  if (!schoolId || !VALID_PLANS.includes(planKey as SubscriptionPlan) || !Number.isInteger(months) || months < 1) {
    fail("Merci de choisir une école, un plan et une durée valides.");
  }

  const plan = getPlan(planKey);
  const periodStart = new Date().toISOString().slice(0, 10);
  const periodEndDate = new Date();
  periodEndDate.setMonth(periodEndDate.getMonth() + months);
  const periodEnd = periodEndDate.toISOString().slice(0, 10);

  const admin = createAdminClient();

  const { error: insertError } = await admin.from("subscription_payments").insert({
    school_id: schoolId,
    plan: plan.key,
    amount: (plan.priceXOF ?? 0) * months,
    currency: "XOF",
    payment_method: "manual",
    status: "completed",
    period_start: periodStart,
    period_end: periodEnd,
    requested_by: staff.id,
  });

  if (insertError) {
    fail("Impossible d'enregistrer le paiement : " + insertError.message);
  }

  const { error: schoolError } = await admin
    .from("schools")
    .update({ plan: plan.key, subscription_status: "active", subscription_expires_at: periodEnd })
    .eq("id", schoolId);

  if (schoolError) {
    fail("Paiement enregistré, mais l'activation de l'école a échoué : " + schoolError.message);
  }

  redirect(`${ADMIN_PATH}?success=${encodeURIComponent(`Abonnement activé jusqu'au ${periodEnd}.`)}`);
}
