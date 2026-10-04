// Formatage partagé des documents PDF (rapport financier, reçus).
//
// Les polices PDF standard (Helvetica) sont limitées au jeu WinAnsi : pas de
// signe moins U+2212, pas d'espace fine insécable. Les espaces fines que
// produit Intl.NumberFormat("fr-FR") s'y afficheraient en caractères
// parasites. D'où ce formatage maison, à l'espace ordinaire.
export function pdfMoney(amount: number, currency: string): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped} ${currency === "XOF" ? "F CFA" : currency}`;
}

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// « 2026-10-04 » → « 4 octobre 2026 ».
export function pdfLongDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
