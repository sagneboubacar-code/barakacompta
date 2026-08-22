"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteTeamMember, type InviteTeamMemberResult } from "@/lib/actions/team";

export function InviteTeamMemberForm() {
  const [result, setResult] = useState<InviteTeamMemberResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await inviteTeamMember(formData);
      setResult(res);
      if (res.success) {
        // Re-fetch le tableau Équipe (Server Component) sans perdre l'affichage
        // du mot de passe temporaire, qui vit dans le state de ce composant client.
        router.refresh();
      }
    });
  }

  return (
    <div>
      <form action={handleSubmit} className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Nom complet</span>
          <input
            name="full_name"
            required
            className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Email</span>
          <input
            name="email"
            type="email"
            required
            className="w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Rôle</span>
          <select name="role" defaultValue="admin" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="admin">Administrateur</option>
            <option value="accountant">Comptable</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? "Création…" : "Ajouter"}
        </button>
      </form>

      {result && !result.success && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</p>
      )}
      {result?.success && (
        <div className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          <p>
            Compte créé pour <strong>{result.email}</strong>.
          </p>
          <p className="mt-1">
            Mot de passe temporaire :{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-900">
              {result.tempPassword}
            </code>
          </p>
          <p className="mt-1 text-xs text-green-700">
            Communiquez-le en privé à la personne concernée — il ne sera plus affiché après avoir quitté
            cette page.
          </p>
        </div>
      )}
    </div>
  );
}
