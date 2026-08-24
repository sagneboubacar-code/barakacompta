import { NextResponse, type NextRequest } from "next/server";
import { confirmInvoice } from "@/lib/paydunya/client";
import { createAdminClient } from "@/lib/supabase/admin";

// PayDunya appelle cette URL en POST (form-urlencoded) à chaque changement
// de statut d'une facture. On ignore le contenu brut de la requête : seul
// le token sert à revérifier le statut réel auprès de PayDunya (server-to-
// server), pour ne jamais activer un abonnement sur la base d'une requête
// qui pourrait être falsifiée.
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = String(form.get("data[token]") ?? form.get("token") ?? "");

  if (!token) {
    return NextResponse.json({ error: "token manquant" }, { status: 400 });
  }

  let result;
  try {
    result = await confirmInvoice(token);
  } catch (err) {
    console.error("PayDunya IPN — échec de la vérification", err);
    return NextResponse.json({ error: "vérification impossible" }, { status: 502 });
  }

  if (!result.subscriptionPaymentId) {
    return NextResponse.json({ error: "référence de paiement introuvable" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: payment } = await admin
    .from("subscription_payments")
    .select("id, school_id, plan, period_end, status")
    .eq("id", result.subscriptionPaymentId)
    .maybeSingle();

  if (!payment) {
    return NextResponse.json({ error: "demande introuvable" }, { status: 404 });
  }

  // Idempotent : un IPN peut arriver plusieurs fois pour le même paiement.
  if (payment.status === "completed") {
    return NextResponse.json({ ok: true });
  }

  if (result.status === "completed") {
    await admin
      .from("subscription_payments")
      .update({ status: "completed", external_reference: token })
      .eq("id", payment.id);

    await admin
      .from("schools")
      .update({
        plan: payment.plan,
        subscription_status: "active",
        subscription_expires_at: payment.period_end,
      })
      .eq("id", payment.school_id);
  } else if (result.status === "cancelled" || result.status === "failed") {
    await admin
      .from("subscription_payments")
      .update({ status: result.status === "cancelled" ? "cancelled" : "failed", external_reference: token })
      .eq("id", payment.id);
  }

  return NextResponse.json({ ok: true });
}
