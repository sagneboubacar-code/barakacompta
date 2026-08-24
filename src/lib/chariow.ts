import "server-only";
import type { SubscriptionPlan } from "@/types";

// Association produit Chariow -> plan d'abonnement. Un seul produit existe
// pour l'instant (Basic) ; Pro et Premium seront ajoutés ici une fois créés
// sur Chariow.
const CHARIOW_PRODUCT_PLAN: Record<string, SubscriptionPlan> = {
  prd_ogp6p6ln: "basic",
  // prd_xxxxxxxx: "pro",
  // prd_xxxxxxxx: "premium",
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

  const { data } = (await response.json()) as { data: ChariowLicense };

  if (data.is_expired) {
    throw new ChariowError("Cette licence a expiré.");
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
