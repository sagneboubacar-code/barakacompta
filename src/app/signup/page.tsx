import Link from "next/link";
import { signUpSchool } from "@/lib/actions/auth";

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form
        action={signUpSchool}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Baraka Compta" className="h-10 w-10" />
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Inscrire votre école</h1>
          <p className="text-sm text-slate-500">
            Créez l&apos;espace de gestion de votre établissement.
          </p>
        </div>

        {searchParams.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {searchParams.error}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="schoolName" className="text-sm font-medium text-slate-700">
            Nom de l&apos;école
          </label>
          <input
            id="schoolName"
            name="schoolName"
            type="text"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="ownerFullName" className="text-sm font-medium text-slate-700">
            Votre nom complet
          </label>
          <input
            id="ownerFullName"
            name="ownerFullName"
            type="text"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <p className="text-xs text-slate-400">8 caractères minimum.</p>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Créer mon école
        </button>

        <p className="text-center text-sm text-slate-500">
          Déjà inscrit ?{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            Se connecter
          </Link>
        </p>
      </form>
    </main>
  );
}
