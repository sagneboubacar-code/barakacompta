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

// Caractères que WinAnsi (Windows-1252) ajoute au latin-1, plage 0x80-0x9F.
const WIN_ANSI_EXTRAS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

// Texte libre saisi par l'école (description d'une dépense...) : un caractère
// hors WinAnsi (arabe, emoji, signe moins U+2212) s'imprimerait en caractères
// parasites. On garde l'équivalent quand il existe, sinon « ? ».
export function pdfText(text: string): string {
  const cleaned = text
    .normalize("NFC")
    .replace(/[\u2010\u2011\u2212]/g, "-")
    .replace(/[\s\u00a0\u2007\u2009\u202f]+/g, " ")
    .trim();
  return Array.from(cleaned, (char) => {
    const code = char.codePointAt(0) ?? 0;
    const winAnsi = (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.has(char);
    return winAnsi ? char : "?";
  }).join("");
}

// « 2026-09-12 » → « 12/09/2026 ».
export function pdfShortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
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
