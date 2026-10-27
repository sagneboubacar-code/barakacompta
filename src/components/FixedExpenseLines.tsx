"use client";

import { useState, type ReactNode } from "react";
import { formatCurrency } from "@/lib/format";
import { lineAmount, parseNumber, type FixedExpenseLine } from "@/lib/fixed-expenses";
import type { Language } from "@/lib/i18n/config";

export interface FixedExpenseRow extends FixedExpenseLine {
  categoryLabel: string;
  // Déjà enregistrée pour ce mois : affichée, plus modifiable ici.
  recorded: { amount: number; date: string; hours: number | null } | null;
}

// Les dépenses fixes du mois : cochées par défaut, montant habituel prérempli,
// heures à saisir pour les lignes à l'heure. L'action serveur recalcule chaque
// montant (lib/fixed-expenses.ts) : le total affiché n'est qu'une aide.
export function FixedExpenseLines({
  rows,
  currency,
  language,
  labels,
  children,
}: {
  rows: FixedExpenseRow[];
  currency: string | null;
  language: Language;
  // `submit` contient « {count} » et « {total} » (une fonction ne peut pas
  // passer d'un composant serveur à un composant client).
  labels: {
    recordedOn: string; // « {date} » remplacé
    hoursPlaceholder: string;
    hoursUnit: string;
    hoursMissing: string;
    amountMissing: string;
    perHour: string;
    total: string;
    submit: string;
    internatTag: string;
  };
  children?: ReactNode;
}) {
  const open = rows.filter((row) => !row.recorded);
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(open.map((row) => [row.id, true]))
  );
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(open.map((row) => [row.id, row.pay_mode === "fixed" ? String(row.amount) : ""]))
  );
  const money = (amount: number) => formatCurrency(amount, currency, language);

  const amountOf = (row: FixedExpenseRow) =>
    row.pay_mode === "hourly"
      ? lineAmount(row, { hours: parseNumber(inputs[row.id]) })
      : lineAmount(row, { amount: parseNumber(inputs[row.id]) });

  const selected = open.filter((row) => checked[row.id]);
  const incomplete = selected.some((row) => !Number.isFinite(amountOf(row)));
  const total = selected.reduce((sum, row) => sum + (Number.isFinite(amountOf(row)) ? amountOf(row) : 0), 0);

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => {
          const isChecked = !row.recorded && !!checked[row.id];
          const amount = row.recorded ? row.recorded.amount : amountOf(row);
          return (
            <li key={row.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 ${isChecked || row.recorded ? "" : "text-slate-400"}`}>
              {row.recorded ? (
                <span className="flex h-4 w-4 items-center justify-center text-green-700" aria-hidden>
                  ✓
                </span>
              ) : (
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => setChecked((current) => ({ ...current, [row.id]: !current[row.id] }))}
                  aria-label={row.label}
                  className="h-4 w-4 accent-slate-900"
                />
              )}

              <div className="min-w-[10rem] flex-1">
                <p className={`font-medium ${isChecked || row.recorded ? "text-slate-900" : ""}`}>
                  {row.label}
                  {row.internat && (
                    <span className="ms-2 whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-normal text-indigo-700">
                      {labels.internatTag}
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">{row.categoryLabel}</p>
              </div>

              {row.recorded ? (
                <p className="text-sm text-green-700">
                  {labels.recordedOn.replace("{date}", row.recorded.date)}
                  {row.recorded.hours != null && ` (${row.recorded.hours} ${labels.hoursUnit})`} :{" "}
                  <strong className="tabular-nums">{money(row.recorded.amount)}</strong>
                </p>
              ) : row.pay_mode === "hourly" ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={inputs[row.id] ?? ""}
                    placeholder={labels.hoursPlaceholder}
                    disabled={!isChecked}
                    onChange={(event) => setInputs((current) => ({ ...current, [row.id]: event.target.value }))}
                    className="w-20 rounded-md border border-slate-300 px-2 py-1 text-end tabular-nums disabled:bg-slate-50"
                  />
                  <span className="text-slate-500">
                    {labels.perHour} {money(Number(row.hourly_rate))} =
                  </span>
                  <strong className="w-28 text-end tabular-nums text-slate-900">
                    {Number.isFinite(amount) ? money(amount) : "…"}
                  </strong>
                </div>
              ) : (
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputs[row.id] ?? ""}
                  disabled={!isChecked}
                  onChange={(event) => setInputs((current) => ({ ...current, [row.id]: event.target.value }))}
                  className="w-32 rounded-md border border-slate-300 px-2 py-1 text-end text-sm tabular-nums disabled:bg-slate-50"
                />
              )}

              {isChecked && !Number.isFinite(amount) && (
                <p className="w-full text-end text-xs text-red-600">
                  {row.pay_mode === "hourly" ? labels.hoursMissing : labels.amountMissing}
                </p>
              )}

              {/* Ce qui part réellement au serveur. */}
              {isChecked && (
                <>
                  <input type="hidden" name="line_ids" value={row.id} />
                  <input
                    type="hidden"
                    name={row.pay_mode === "hourly" ? `hours_${row.id}` : `amount_${row.id}`}
                    value={inputs[row.id] ?? ""}
                  />
                </>
              )}
            </li>
          );
        })}
      </ul>

      {open.length > 0 && (
        <>
          <p className="flex justify-between border-t-2 border-slate-900 pt-2 text-sm font-semibold text-slate-900">
            <span>{labels.total}</span>
            <span className="tabular-nums">{money(total)}</span>
          </p>

          {children}

          <button
            type="submit"
            disabled={selected.length === 0 || incomplete}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {labels.submit.replace("{count}", String(selected.length)).replace("{total}", money(total))}
          </button>
        </>
      )}
    </div>
  );
}
