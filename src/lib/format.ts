// Formatage monétaire partagé pour l'affichage (écran + impression). Le CSV
// garde des nombres bruts — un montant formaté ("1 234 000 F CFA") casserait
// les formules Excel de l'utilisateur.
export function formatCurrency(amount: number, currency?: string | null): string {
  const code = currency || "XOF";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat("fr-FR").format(amount)} ${code}`.trim();
  }
}

// Même formatage, avec un "+" explicite pour les montants positifs — utile
// pour un solde, où l'absence de signe peut se lire comme "dépense" au
// premier coup d'œil.
export function formatSignedCurrency(amount: number, currency?: string | null): string {
  const formatted = formatCurrency(Math.abs(amount), currency);
  return amount > 0 ? `+${formatted}` : amount < 0 ? `-${formatted}` : formatted;
}
