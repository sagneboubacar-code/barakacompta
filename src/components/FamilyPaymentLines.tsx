"use client";

import { useState, type ReactNode } from "react";
import { formatCurrency } from "@/lib/format";
import type { Language } from "@/lib/i18n/config";

export interface FamilyPaymentLine {
  id: string;
  childName: string;
  label: string;
  amount: number;
}

// Lignes à encaisser pour une famille. Le parent peut tout régler ou verser
// une avance : le « montant versé » se répartit dans l'ordre des lignes (chaque
// ligne jusqu'à son reste à payer), et chaque ligne reste modifiable à la main.
// La base revérifie chaque montant (record_family_payment, 0038) : ce qui est
// calculé ici n'est qu'une aide à la saisie.
export function FamilyPaymentLines({
  lines,
  currency,
  language,
  labels,
  children,
}: {
  lines: FamilyPaymentLine[];
  currency: string | null;
  language: Language;
  // `submit` contient « {total} », remplacé par le montant versé (une
  // fonction ne peut pas passer d'un composant serveur à un composant client).
  labels: {
    child: string;
    item: string;
    due: string;
    paid: string;
    totalDue: string;
    received: string;
    receivedHint: string;
    remainingAfter: string;
    submit: string;
  };
  children?: ReactNode;
}) {
  const [amounts, setAmounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((line) => [line.id, line.amount]))
  );
  const money = (amount: number) => formatCurrency(amount, currency, language);
  const totalDue = lines.reduce((sum, line) => sum + line.amount, 0);
  const received = lines.reduce((sum, line) => sum + (amounts[line.id] ?? 0), 0);
  const clamp = (value: number, max: number) => (Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 0), max) : 0);

  // Montant global : on remplit les lignes une à une, dans l'ordre affiché.
  function distribute(value: number) {
    let left = clamp(value, totalDue);
    const next: Record<string, number> = {};
    for (const line of lines) {
      next[line.id] = Math.min(line.amount, left);
      left -= next[line.id];
    }
    setAmounts(next);
  }

  function setLine(line: FamilyPaymentLine, value: number) {
    setAmounts((current) => ({ ...current, [line.id]: clamp(value, line.amount) }));
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-[540px] w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="w-8 py-1"></th>
              <th className="py-1 pe-3 font-medium">{labels.child}</th>
              <th className="py-1 pe-3 font-medium">{labels.item}</th>
              <th className="py-1 pe-3 text-end font-medium">{labels.due}</th>
              <th className="py-1 text-end font-medium">{labels.paid}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const firstOfChild = index === 0 || lines[index - 1].childName !== line.childName;
              const value = amounts[line.id] ?? 0;
              return (
                <tr
                  key={line.id}
                  className={`${firstOfChild ? "border-t border-slate-200" : ""} ${value > 0 ? "" : "text-slate-400"}`}
                >
                  <td className="py-1.5">
                    <input
                      type="checkbox"
                      checked={value > 0}
                      onChange={() => setLine(line, value > 0 ? 0 : line.amount)}
                      aria-label={`${line.childName} — ${line.label}`}
                      className="h-4 w-4 accent-emerald-700"
                    />
                  </td>
                  <td className="py-1.5 pe-3 font-medium">{firstOfChild ? line.childName : ""}</td>
                  <td className="py-1.5 pe-3">{line.label}</td>
                  <td className="py-1.5 pe-3 text-end tabular-nums">{money(line.amount)}</td>
                  <td className="py-1.5 text-end">
                    <input
                      type="number"
                      min={0}
                      max={line.amount}
                      step={1}
                      value={value}
                      onChange={(event) => setLine(line, Number(event.target.value))}
                      className="w-28 rounded-md border border-slate-300 px-2 py-1 text-end text-sm tabular-nums"
                    />
                    {/* Ce qui part réellement au serveur : une échéance et son montant. */}
                    {value > 0 && (
                      <>
                        <input type="hidden" name="schedule_ids" value={line.id} />
                        <input type="hidden" name="amounts" value={value} />
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300">
              <td></td>
              <td colSpan={2} className="py-2 font-semibold text-slate-900">
                {labels.totalDue}
              </td>
              <td className="py-2 pe-3 text-end font-semibold tabular-nums text-slate-900">{money(totalDue)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-md bg-emerald-50 p-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-800">{labels.received}</span>
          <input
            type="number"
            min={0}
            max={totalDue}
            step={1}
            value={received}
            onChange={(event) => distribute(Number(event.target.value))}
            className="block w-40 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-end text-base font-semibold tabular-nums"
          />
        </label>
        <p className="text-sm text-slate-700">
          {labels.remainingAfter}{" "}
          <strong className={totalDue - received > 0 ? "text-red-700" : "text-green-700"}>
            {money(totalDue - received)}
          </strong>
        </p>
        <p className="w-full text-xs text-slate-500">{labels.receivedHint}</p>
      </div>

      {children}

      <button
        type="submit"
        disabled={received <= 0}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {labels.submit.replace("{total}", money(received))}
      </button>
    </div>
  );
}
