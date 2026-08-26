import "server-only";

// Client minimal pour l'API Wave Checkout (docs.wave.com/checkout) —
// intégration directe, en contournant PayTech pour ce moyen de paiement
// précis (leur sous-intégration Wave plafonne les transactions réelles
// à un montant test fixe, indépendamment du montant envoyé).
const WAVE_API_BASE = "https://api.wave.com";

function getHeaders() {
  const apiKey = process.env.WAVE_API_KEY;

  if (!apiKey) {
    throw new Error("Clé Wave manquante (variable d'environnement).");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

export interface CreateCheckoutSessionParams {
  amount: number;
  clientReference: string; // notre subscription_payments.id, pour retrouver la demande côté webhook
  successUrl: string;
  errorUrl: string;
}

export interface CheckoutSessionResult {
  id: string;
  launchUrl: string;
}

// Crée une session de paiement et renvoie l'URL vers laquelle rediriger
// l'utilisateur (doit être ouverte par le navigateur, pas en webview).
export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult> {
  const res = await fetch(`${WAVE_API_BASE}/v1/checkout/sessions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      amount: String(params.amount),
      currency: "XOF",
      client_reference: params.clientReference,
      success_url: params.successUrl,
      error_url: params.errorUrl,
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.wave_launch_url) {
    throw new Error(data.message ?? "Échec de la création de la session de paiement Wave.");
  }

  return { id: data.id, launchUrl: data.wave_launch_url };
}
