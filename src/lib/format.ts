import type { Language } from "@/lib/i18n/config";

// Formatage monétaire partagé pour l'affichage (écran + impression). Le CSV
// garde des nombres bruts — un montant formaté ("1 234 000 F CFA") casserait
// les formules Excel de l'utilisateur.
export function formatCurrency(amount: number, currency?: string | null, language: Language = "fr"): string {
  const code = currency || "XOF";
  const locale = language === "ar" ? "ar-SN" : "fr-FR";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat(locale).format(amount)} ${code}`.trim();
  }
}

// Même formatage, avec un "+" explicite pour les montants positifs — utile
// pour un solde, où l'absence de signe peut se lire comme "dépense" au
// premier coup d'œil.
export function formatSignedCurrency(amount: number, currency?: string | null, language: Language = "fr"): string {
  const formatted = formatCurrency(Math.abs(amount), currency, language);
  return amount > 0 ? `+${formatted}` : amount < 0 ? `-${formatted}` : formatted;
}

// Date courte (jour/mois/année). "ar-SN" force le calendrier grégorien et
// les chiffres latins — le calendrier hégirien par défaut d'"ar-SA" n'a pas
// sa place dans une comptabilité scolaire au Sénégal.
export function formatDate(date: string | Date, language: Language = "fr"): string {
  const locale = language === "ar" ? "ar-SN" : "fr-FR";
  return new Date(date).toLocaleDateString(locale);
}
