import "server-only";

// Client minimal pour l'API Checkout Invoice de PayDunya — pas de SDK
// tiers pour rester léger, juste des appels fetch directs. Les 4 clés
// (master/private/public/token) sont envoyées en en-têtes sur chaque appel ;
// utiliser les clés "test" ou "live" détermine automatiquement le mode.
const PAYDUNYA_API_BASE = "https://app.paydunya.com/api/v1";

function getHeaders() {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY;
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
  const publicKey = process.env.PAYDUNYA_PUBLIC_KEY;
  const token = process.env.PAYDUNYA_TOKEN;

  if (!masterKey || !privateKey || !publicKey || !token) {
    throw new Error("Clés PayDunya manquantes (variables d'environnement).");
  }

  return {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": masterKey,
    "PAYDUNYA-PRIVATE-KEY": privateKey,
    "PAYDUNYA-PUBLIC-KEY": publicKey,
    "PAYDUNYA-TOKEN": token,
  };
}

export interface CreateInvoiceParams {
  amount: number;
  description: string;
  externalId: string; // notre subscription_payments.id, pour retrouver la demande côté IPN
  returnUrl: string;
  cancelUrl: string;
  ipnUrl: string;
  customer: { name: string; email: string };
}

export interface CreateInvoiceResult {
  token: string;
  checkoutUrl: string;
}

// Crée une facture de paiement et renvoie l'URL de checkout PayDunya vers
// laquelle rediriger l'utilisateur.
export async function createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult> {
  const res = await fetch(`${PAYDUNYA_API_BASE}/checkout-invoice/create`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      invoice: {
        total_amount: params.amount,
        description: params.description,
      },
      store: {
        name: "Baraka Compta",
      },
      custom_data: {
        subscription_payment_id: params.externalId,
      },
      actions: {
        cancel_url: params.cancelUrl,
        return_url: params.returnUrl,
        callback_url: params.ipnUrl,
      },
    }),
  });

  const data = await res.json();

  if (data.response_code !== "00" || !data.token) {
    throw new Error(data.response_text ?? "Échec de la création de la facture PayDunya.");
  }

  return { token: data.token, checkoutUrl: data.response_text as string };
}

export interface ConfirmInvoiceResult {
  status: "completed" | "pending" | "cancelled" | "failed";
  subscriptionPaymentId: string | null;
}

// Revérifie le statut d'une facture directement auprès de PayDunya (jamais
// faire confiance au seul contenu brut de l'IPN, qui peut être falsifié —
// on ne fait confiance qu'à cette requête serveur-à-serveur authentifiée).
export async function confirmInvoice(token: string): Promise<ConfirmInvoiceResult> {
  const res = await fetch(`${PAYDUNYA_API_BASE}/checkout-invoice/confirm/${token}`, {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await res.json();
  const subscriptionPaymentId = data.custom_data?.subscription_payment_id ?? null;

  if (data.status === "completed") {
    return { status: "completed", subscriptionPaymentId };
  }
  if (data.status === "cancelled") {
    return { status: "cancelled", subscriptionPaymentId };
  }
  if (data.status === "pending") {
    return { status: "pending", subscriptionPaymentId };
  }
  return { status: "failed", subscriptionPaymentId };
}
