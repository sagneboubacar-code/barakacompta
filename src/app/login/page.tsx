import Link from "next/link";
import { signIn } from "@/lib/actions/auth";
import { getLanguage } from "@/lib/i18n/get-language";
import { authDict } from "@/lib/i18n/dictionaries/auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; reset?: string };
}) {
  const language = getLanguage();
  const t = authDict[language].login;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form
        action={signIn}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="Baraka Compta" className="h-10 w-10" />
            <h1 className="mt-3 text-xl font-semibold text-slate-900">{t.title}</h1>
            <p className="text-sm text-slate-500">
              {t.subtitle}
            </p>
          </div>
          <LanguageSwitcher />
        </div>

        <GoogleAuthButton />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs uppercase tracking-wide text-slate-400">{t.orDivider}</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {searchParams.reset && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {authDict[language].reset.done}
          </p>
        )}

        {/* La sortie de secours est proposée là où l'école bloque — dans le
            message d'échec lui-même. Un lien discret en bas de page ne se
            voit pas quand on est occupé à retaper son mot de passe. */}
        {searchParams.error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{searchParams.error}</p>
            <p className="mt-1 text-xs text-red-600">{t.forgotHint}</p>
            <Link
              href="/mot-de-passe-oublie"
              className="mt-1 inline-block text-xs font-semibold text-red-800 underline"
            >
              {t.forgotLink}
            </Link>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            {t.email}
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
            {t.password}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="text-right">
          <Link href="/mot-de-passe-oublie" className="text-xs text-slate-500 underline hover:text-slate-900">
            {t.forgotLink}
          </Link>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.submit}
        </button>

        <p className="text-center text-sm text-slate-500">
          {t.noAccount}{" "}
          <Link href="/signup" className="font-medium text-slate-900 underline">
            {t.signupLink}
          </Link>
        </p>
      </form>
    </main>
  );
}
