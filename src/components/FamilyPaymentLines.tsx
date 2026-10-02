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

// Lignes à encaisser pour une famille : tout est coché par défaut, et le total
// suit les cases cochées. Le montant réellement encaissé est recalculé en base
// (record_family_payment) : ce total n'est qu'un affichage.
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
  // `submit` contient « {total} », remplacé par le montant coché (une
  // fonction ne peut pas passer d'un composant serveur à un composant client).
  labels: { child: string; item: string; amount: string; total: string; submit: string };
  children?: ReactNode;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(lines.map((line) => line.id)));
  const total = lines.filter((line) => checked.has(line.id)).reduce((sum, line) => sum + line.amount, 0);
  const money = (amount: number) => formatCurrency(amount, currency, language);

  function toggle(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-[480px] w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="w-8 py-1"></th>
              <th className="py-1 pe-3 font-medium">{labels.child}</th>
              <th className="py-1 pe-3 font-medium">{labels.item}</th>
              <th className="py-1 text-end font-medium">{labels.amount}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const firstOfChild = index === 0 || lines[index - 1].childName !== line.childName;
              return (
                <tr
                  key={line.id}
                  className={`${firstOfChild ? "border-t border-slate-200" : ""} ${
                    checked.has(line.id) ? "" : "text-slate-400"
                  }`}
                >
                  <td className="py-1.5">
                    <input
                      type="checkbox"
                      name="schedule_ids"
                      value={line.id}
                      checked={checked.has(line.id)}
                      onChange={() => toggle(line.id)}
                      aria-label={`${line.childName} — ${line.label}`}
                    />
                  </td>
                  <td className="py-1.5 pe-3 font-medium">{firstOfChild ? line.childName : ""}</td>
                  <td className="py-1.5 pe-3">{line.label}</td>
                  <td className="py-1.5 text-end tabular-nums">{money(line.amount)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300">
              <td></td>
              <td colSpan={2} className="py-2 font-semibold text-slate-900">
                {labels.total}
              </td>
              <td className="py-2 text-end text-base font-semibold tabular-nums text-slate-900">{money(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {children}

      <button
        type="submit"
        disabled={total <= 0}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {labels.submit.replace("{total}", money(total))}
      </button>
    </div>
  );
}
