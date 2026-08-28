import "server-only";
import type { SubscriptionPlan } from "@/types";

// Association produit Chariow -> plan d'abonnement (boutique "Baraka Compta").
const CHARIOW_PRODUCT_PLAN: Record<string, SubscriptionPlan> = {
  prd_b9tsldo1: "basic",
  prd_tsfif9ph: "pro",
};

const CHARIOW_STORE_URL = "https://goaukwbl.mychariow.com";

// Lien direct vers la page de paiement Chariow de chaque plan — évite au
// client de chercher lui-même le bon produit sur la boutique. Chariow n'a
// pas d'API de création de commande côté serveur (contrairement à
// PayTech/Wave) : impossible de faire mieux qu'un lien vers leur checkout
// hébergé tant que ce n'est pas le cas.
export const CHARIOW_CHECKOUT_URLS: Partial<Record<SubscriptionPlan, string>> = Object.fromEntries(
  Object.entries(CHARIOW_PRODUCT_PLAN).map(([productId, plan]) => [
    plan,
    `${CHARIOW_STORE_URL}/${productId}/checkout`,
  ])
);

interface ChariowLicense {
  license_key: string;
  status: "pending_activation" | "active" | "expired" | "revoked";
  is_active: boolean;
  is_expired: boolean;
  product: { id: string; name: string };
}

export class ChariowError extends Error {}

// Interroge Chariow pour valider une clé de licence et renvoyer le plan
// Baraka Compta qu'elle correspond. Ne fait jamais confiance à l'app
// cliente : cet appel côté serveur, avec la clé API secrète, est la seule
// source de vérité sur la validité d'une licence.
export async function resolveChariowLicense(
  licenseKey: string
): Promise<{ plan: SubscriptionPlan; license: ChariowLicense }> {
  const apiKey = process.env.CHARIOW_API_KEY;
  if (!apiKey) {
    throw new ChariowError("Intégration Chariow non configurée.");
  }

  const response = await fetch(
    `https://api.chariow.com/v1/licenses/${encodeURIComponent(licenseKey.trim())}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
  );

  if (response.status === 404) {
    throw new ChariowError("Clé de licence introuvable.");
  }
  if (!response.ok) {
    // Détail technique temporaire (à retirer une fois le diagnostic terminé) :
    // le message générique ne suffisait pas à distinguer clé invalide,
    // permissions manquantes ou panne côté Chariow.
    const bodyText = await response.text().catch(() => "");
    throw new ChariowError(
      `Impossible de vérifier la licence auprès de Chariow (HTTP ${response.status}). ${bodyText.slice(0, 200)}`
    );
  }

  let { data } = (await response.json()) as { data: ChariowLicense };

  if (data.is_expired) {
    throw new ChariowError("Cette licence a expiré.");
  }

  // Chariow émet les licences en "pending_activation" par défaut (pensé
  // pour un contrôle par appareil). On ne fait pas de suivi par appareil
  // ici — une licence correspond à une école — donc on l'active nous-mêmes
  // dès la première vérification plutôt que d'exiger une étape en plus.
  if (data.status === "pending_activation") {
    const activateRes = await fetch(
      `https://api.chariow.com/v1/licenses/${encodeURIComponent(licenseKey.trim())}/activate`,
      { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );
    if (activateRes.ok) {
      ({ data } = (await activateRes.json()) as { data: ChariowLicense });
    }
  }

  if (!data.is_active) {
    throw new ChariowError("Cette licence n'est pas active.");
  }

  const plan = CHARIOW_PRODUCT_PLAN[data.product.id];
  if (!plan) {
    throw new ChariowError("Cette licence ne correspond à aucun plan Baraka Compta.");
  }

  return { plan, license: data };
}
