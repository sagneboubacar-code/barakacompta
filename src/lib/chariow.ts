import "server-only";
import type { SubscriptionPlan } from "@/types";

// Association produit Chariow -> plan d'abonnement.
const CHARIOW_PRODUCT_PLAN: Record<string, SubscriptionPlan> = {
  prd_ogp6p6ln: "basic",
  prd_0u16tl8e: "pro",
  prd_pn6catq4: "premium",
};

interface ChariowLicense {
  license_key: string;
  status: "pending_activation" | "active" | "expired" | "revoked";
  is_active: boolean;
  is_expired: boolean;
  product: { id: string; name: string };
}

export class ChariowError extends Error {}

// Interroge Chariow pour valider une clé de licence et renvoyer le plan
// Baraka Gestion qu'elle correspond. Ne fait jamais confiance à l'app
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
    throw new ChariowError("Impossible de vérifier la licence auprès de Chariow.");
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
    throw new ChariowError("Cette licence ne correspond à aucun plan Baraka Gestion.");
  }

  return { plan, license: data };
}
