import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// PayTech appelle cette URL en POST à chaque paiement. On revérifie la
// signature HMAC (message = final_item_price|ref_command|api_key, clé =
// api_secret) avant de faire confiance au contenu — jamais activer un
// abonnement sur la base d'une requête qui pourrait être falsifiée.
function isValidSignature(payload: Record<string, string>): boolean {
  const apiKey = process.env.PAYTECH_API_KEY;
  const apiSecret = process.env.PAYTECH_API_SECRET;
  const received = payload.hmac_compute;
  if (!apiKey || !apiSecret || !received) return false;

  const message = `${payload.final_item_price ?? payload.item_price}|${payload.ref_command}|${apiKey}`;
  const expected = createHmac("sha256", apiSecret).update(message).digest("hex");

  const receivedBuf = Buffer.from(received, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  return receivedBuf.length === expectedBuf.length && timingSafeEqual(receivedBuf, expectedBuf);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const payload: Record<string, string> = {};
  form.forEach((value, key) => {
    payload[key] = String(value);
  });

  if (!isValidSignature(payload)) {
    return NextResponse.json({ error: "signature invalide" }, { status: 401 });
  }

  const subscriptionPaymentId = payload.ref_command;
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

  // Idempotent : PayTech peut renvoyer plusieurs fois la même notification.
  if (payment.status === "completed") {
    return NextResponse.json({ ok: true });
  }

  if (payload.type_event === "sale_complete") {
    await admin
      .from("subscription_payments")
      .update({ status: "completed", external_reference: payload.token ?? null })
      .eq("id", payment.id);

    await admin
      .from("schools")
      .update({
        plan: payment.plan,
        subscription_status: "active",
        subscription_expires_at: payment.period_end,
      })
      .eq("id", payment.school_id);
  } else if (payload.type_event === "sale_canceled") {
    await admin
      .from("subscription_payments")
      .update({ status: "cancelled", external_reference: payload.token ?? null })
      .eq("id", payment.id);
  }

  return NextResponse.json({ ok: true });
}
