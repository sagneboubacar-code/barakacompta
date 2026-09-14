import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";
import { getLanguage } from "@/lib/i18n/get-language";
import { authDict } from "@/lib/i18n/dictionaries/auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; sent?: string };
}) {
  const language = getLanguage();
  const t = authDict[language].forgot;

  const errors: Record<string, string> = {
    invalid: t.invalidEmail,
    rate: t.tooMany,
  };
  const error = searchParams.error ? errors[searchParams.error] ?? t.invalidEmail : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form
        action={requestPasswordReset}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="Baraka Compta" className="h-10 w-10" />
            <h1 className="mt-3 text-xl font-semibold text-slate-900">{t.title}</h1>
            <p className="text-sm text-slate-500">{t.subtitle}</p>
          </div>
          <LanguageSwitcher />
        </div>

        {searchParams.sent && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{t.sent}</p>
        )}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

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
            autoFocus
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.submit}
        </button>

        <p className="text-center text-sm">
          <Link href="/login" className="font-medium text-slate-600 underline hover:text-slate-900">
            {t.backToLogin}
          </Link>
        </p>
      </form>
    </main>
  );
}
