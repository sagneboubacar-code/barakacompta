import "server-only";

// Client minimal pour l'API PayTech (paytech.sn) — paiement Wave, Orange
// Money, Free Money, Wizall et carte pour le marché sénégalais. Pas de SDK
// tiers, juste des appels fetch directs avec les 2 clés API_KEY/API_SECRET
// envoyées en en-têtes.
const PAYTECH_API_BASE = "https://paytech.sn/api";

function getHeaders() {
  const apiKey = process.env.PAYTECH_API_KEY;
  const apiSecret = process.env.PAYTECH_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("Clés PayTech manquantes (variables d'environnement).");
  }

  return {
    "Content-Type": "application/json",
    API_KEY: apiKey,
    API_SECRET: apiSecret,
  };
}

export interface CreatePaymentParams {
  amount: number;
  itemName: string;
  refCommand: string; // notre subscription_payments.id, pour retrouver la demande côté IPN
  successUrl: string;
  cancelUrl: string;
  ipnUrl: string;
}

export interface CreatePaymentResult {
  token: string;
  redirectUrl: string;
}

// Crée une demande de paiement et renvoie l'URL de checkout PayTech vers
// laquelle rediriger l'utilisateur.
export async function createPaymentRequest(params: CreatePaymentParams): Promise<CreatePaymentResult> {
  const res = await fetch(`${PAYTECH_API_BASE}/payment/request-payment`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      item_name: params.itemName,
      item_price: params.amount,
      currency: "XOF",
      ref_command: params.refCommand,
      command_name: params.itemName,
      env: process.env.PAYTECH_ENV === "prod" ? "prod" : "test",
      ipn_url: params.ipnUrl,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    }),
  });

  const data = await res.json();

  if (data.success !== 1 || !data.token) {
    throw new Error(data.message ?? "Échec de la création de la demande de paiement PayTech.");
  }

  return { token: data.token, redirectUrl: data.redirect_url ?? data.redirectUrl };
}

export interface PaymentStatusResult {
  status: "sale_complete" | "sale_canceled" | "pending" | "unknown";
}

// Revérifie le statut d'un paiement directement auprès de PayTech (jamais
// faire confiance au seul contenu brut de l'IPN, qui peut être falsifié —
// on ne fait confiance qu'à cette requête serveur-à-serveur authentifiée).
export async function getPaymentStatus(token: string): Promise<PaymentStatusResult> {
  const res = await fetch(`${PAYTECH_API_BASE}/payment/get-status?token_payment=${encodeURIComponent(token)}`, {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await res.json();
  const status = String(data.status ?? data.type_event ?? "").toLowerCase();

  if (status.includes("complete")) return { status: "sale_complete" };
  if (status.includes("cancel")) return { status: "sale_canceled" };
  if (status) return { status: "pending" };
  return { status: "unknown" };
}
