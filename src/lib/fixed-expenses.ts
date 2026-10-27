import type { ExpenseCategory } from "@/types";

// Dépenses fixes (0045_depenses_fixes.sql) : la liste des salaires et loyers
// de l'école, enregistrés chaque mois en une fois. Ce module ne lit pas la
// base : il calcule, pour que la page et l'action serveur comptent pareil.

export interface FixedExpenseLine {
  id: string;
  label: string;
  category: ExpenseCategory;
  pay_mode: "fixed" | "hourly";
  amount: number; // montant mensuel habituel (pay_mode = "fixed")
  hourly_rate: number | null; // taux horaire (pay_mode = "hourly")
  internat: boolean;
}

export interface FixedExpenseDraft {
  line: FixedExpenseLine;
  amount: number;
  hours: number | null;
}

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isPeriod(value: string | null | undefined): value is string {
  return !!value && PERIOD.test(value);
}

function addMonths(period: string, months: number): string {
  const [year, month] = period.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

// Mois proposés : les 12 de l'année scolaire, précédés du mois d'avant la
// rentrée (les salaires d'août se paient souvent en septembre).
export function periodOptions(schoolYearFrom: string): string[] {
  const start = schoolYearFrom.slice(0, 7);
  return Array.from({ length: 13 }, (_, i) => addMonths(start, i - 1));
}

// Le mois en cours s'il est proposé ; sinon le plus proche.
export function defaultPeriod(options: string[], today: string): string {
  const current = today.slice(0, 7);
  if (options.includes(current)) return current;
  return current < options[0] ? options[0] : options[options.length - 1];
}

// "32,5" (virgule tapée au clavier) vaut 32.5.
export function parseNumber(value: string | null | undefined): number {
  if (value == null || value.trim() === "") return NaN;
  return Number(value.trim().replace(/\s/g, "").replace(",", "."));
}

// Montant d'une ligne pour le mois : le montant saisi (montant fixe), ou
// heures x taux arrondi au franc (à l'heure). NaN si la saisie ne va pas.
export function lineAmount(line: FixedExpenseLine, input: { amount?: number; hours?: number }): number {
  if (line.pay_mode === "hourly") {
    const hours = input.hours ?? NaN;
    if (!(hours > 0) || !(Number(line.hourly_rate) > 0)) return NaN;
    return Math.round(hours * Number(line.hourly_rate));
  }
  const amount = input.amount ?? NaN;
  return amount > 0 ? Math.round(amount) : NaN;
}

// Lit le formulaire du mois : les lignes cochées (`line_ids`), avec
// `amount_<id>` (montant fixe) ou `hours_<id>` (à l'heure). Le montant d'une
// ligne à l'heure est recalculé ici à partir du taux enregistré : on ne fait
// pas confiance au total affiché dans le navigateur.
export function readFixedExpenses(
  lines: FixedExpenseLine[],
  recorded: Set<string>,
  form: { get(name: string): string | null; getAll(name: string): string[] }
): { drafts: FixedExpenseDraft[]; invalid: string[]; already: string[] } {
  const drafts: FixedExpenseDraft[] = [];
  const invalid: string[] = [];
  const already: string[] = [];
  const byId = new Map(lines.map((line) => [line.id, line]));

  for (const id of Array.from(new Set(form.getAll("line_ids")))) {
    const line = byId.get(id);
    if (!line) continue; // ligne supprimée entre-temps
    if (recorded.has(id)) {
      already.push(line.label);
      continue;
    }
    const hours = line.pay_mode === "hourly" ? parseNumber(form.get(`hours_${id}`)) : NaN;
    const amount = lineAmount(line, { amount: parseNumber(form.get(`amount_${id}`)), hours });
    if (!Number.isFinite(amount)) {
      invalid.push(line.label);
      continue;
    }
    drafts.push({ line, amount, hours: line.pay_mode === "hourly" ? hours : null });
  }

  return { drafts, invalid, already };
}
