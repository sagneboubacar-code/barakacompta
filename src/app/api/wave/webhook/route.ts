import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Wave signe chaque webhook via l'en-tête Wave-Signature : "t=<timestamp>,v1=<hmac>"
// où hmac = HMAC-SHA256(secret, timestamp + corps brut de la requête). On
// revérifie cette signature avant de faire confiance au contenu — jamais
// activer un abonnement sur la base d'une requête qui pourrait être falsifiée.
function isValidSignature(header: string | null, rawBody: string): boolean {
  const secret = process.env.WAVE_WEBHOOK_SECRET;
  if (!header || !secret) return false;

  const parts: Record<string, string> = {};
  for (const part of header.split(",")) {
    const [key, value] = part.split("=");
    if (key && value) parts[key] = value;
  }

  const timestamp = parts.t;
  const received = parts.v1;
  if (!timestamp || !received) return false;

  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("hex");

  const receivedBuf = Buffer.from(received, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  return receivedBuf.length === expectedBuf.length && timingSafeEqual(receivedBuf, expectedBuf);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!isValidSignature(request.headers.get("Wave-Signature"), rawBody)) {
    return NextResponse.json({ error: "signature invalide" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true });
  }

  const subscriptionPaymentId = event.data?.client_reference;
  if (!subscriptionPaymentId) {
    return NextResponse.json({ error: "référence de paiement manquante" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: payment } = await admin
    .from("subscription_payments")
    .select("id, school_id, plan, period_end, status")
    .eq("id", subscriptionPaymentId)
    .maybeSingle();

  if (!payment) {
    return NextResponse.json({ error: "demande introuvable" }, { status: 404 });
  }

  // Idempotent : Wave peut renvoyer plusieurs fois la même notification.
  if (payment.status === "completed") {
    return NextResponse.json({ ok: true });
  }

  if (event.data.payment_status === "succeeded") {
    await admin
      .from("subscription_payments")
      .update({
        status: "completed",
        external_reference: event.data.transaction_id ?? event.data.id ?? null,
      })
      .eq("id", payment.id);

    await admin
      .from("schools")
      .update({
        plan: payment.plan,
        subscription_status: "active",
        subscription_expires_at: payment.period_end,
      })
      .eq("id", payment.school_id);
  }

  return NextResponse.json({ ok: true });
}
