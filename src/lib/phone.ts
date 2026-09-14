// Normalisation des numéros de téléphone pour les liens d'appel et WhatsApp.
//
// Les numéros sont saisis librement : « 77 123 45 67 », « 771234567 »,
// « +221771234567 », « 00221771234567 ». Certains responsables sont à
// l'étranger (indicatifs +33, +39...) : on ne préfixe jamais en 221 un
// numéro qui porte déjà un indicatif, sous peine de le rendre injoignable.

const SENEGAL = "221";

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  if (cleaned.startsWith("+")) return cleaned.slice(1) || null;
  if (cleaned.startsWith("00")) return cleaned.slice(2) || null;

  // Un numéro sénégalais local fait exactement 9 chiffres (77x, 78x, 33x).
  // Au-delà, on considère que l'indicatif est déjà là.
  if (cleaned.length === 9) return SENEGAL + cleaned;

  return cleaned;
}

export function telHref(raw: string | null | undefined): string | null {
  const n = normalizePhone(raw);
  return n ? `tel:+${n}` : null;
}

export function whatsappHref(raw: string | null | undefined, message?: string): string | null {
  const n = normalizePhone(raw);
  if (!n) return null;
  return message ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : `https://wa.me/${n}`;
}

// Affichage lisible : on regroupe par deux à partir de la droite, en gardant
// l'indicatif à part. « 221771234567 » → « +221 77 123 45 67 ».
export function formatPhone(raw: string | null | undefined): string | null {
  const n = normalizePhone(raw);
  if (!n) return null;
  if (n.startsWith(SENEGAL) && n.length === 12) {
    const local = n.slice(3);
    return `+${SENEGAL} ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
  }
  return `+${n}`;
}
