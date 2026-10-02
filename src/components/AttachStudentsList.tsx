"use client";

import { useState } from "react";

export interface AttachCandidate {
  id: string;
  name: string;
  details: string;
  badges: { text: string; tone: "amber" | "slate" }[];
}

// Liste à cocher des élèves à rattacher à une famille. Le bouton reste grisé
// tant que rien n'est coché et annonce le nombre d'élèves : sans ça, on
// cliquait « Rattacher » en pensant que les suggestions suffisaient.
// Les libellés contiennent « {n} » (une fonction ne passe pas du serveur au client).
export function AttachStudentsList({
  candidates,
  labels,
}: {
  candidates: AttachCandidate[];
  labels: { hint: string; submitNone: string; submitOne: string; submitMany: string };
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());

  function toggle(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const count = checked.size;
  const submitLabel =
    count === 0 ? labels.submitNone : count === 1 ? labels.submitOne : labels.submitMany.replace("{n}", String(count));

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{labels.hint}</p>
      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {candidates.map((student) => (
          <li key={student.id}>
            <label
              className={`flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm ${
                checked.has(student.id) ? "bg-emerald-50" : "hover:bg-slate-50"
              }`}
            >
              <input
                type="checkbox"
                name="student_ids"
                value={student.id}
                checked={checked.has(student.id)}
                onChange={() => toggle(student.id)}
                className="h-5 w-5 accent-emerald-700"
              />
              <span className="font-medium text-slate-900">{student.name}</span>
              <span className="text-slate-500">{student.details}</span>
              {student.badges.map((badge) => (
                <span
                  key={badge.text}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    badge.tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {badge.text}
                </span>
              ))}
            </label>
          </li>
        ))}
      </ul>
      <button
        type="submit"
        disabled={count === 0}
        className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitLabel}
      </button>
    </div>
  );
}
