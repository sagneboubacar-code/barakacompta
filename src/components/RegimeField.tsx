"use client";

import { useState } from "react";

// Régime de l'élève, et pour un interne la date de début de l'internat
// (0047_interne_depuis.sql). Un élève passé en Internat après coup voit
// apparaître la date, préremplie avec son inscription : sans elle, l'internat
// n'était dû qu'à partir du jour de la modification.
export function RegimeField({
  options,
  defaultRegime,
  defaultSince,
  labels,
}: {
  options: { key: string; label: string }[];
  defaultRegime: string;
  defaultSince: string;
  labels: { regime: string; since: string; sinceHint: string };
}) {
  const [regime, setRegime] = useState(defaultRegime);

  return (
    <>
      <label className="space-y-1 text-sm">
        <span className="text-slate-600">{labels.regime}</span>
        <select
          name="regime"
          value={regime}
          onChange={(event) => setRegime(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {regime === "internat" && (
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{labels.since}</span>
          <input
            name="internat_since"
            type="date"
            required
            defaultValue={defaultSince}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <span className="block text-xs text-slate-500">{labels.sinceHint}</span>
        </label>
      )}
    </>
  );
}
