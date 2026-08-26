"use client";

import { useLanguage } from "@/lib/i18n/language-provider";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage, pending } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Langue"
      className={`inline-flex shrink-0 items-center rounded-full border border-slate-200 p-0.5 text-xs font-semibold ${className}`}
    >
      <button
        type="button"
        onClick={() => setLanguage("fr")}
        disabled={pending}
        aria-pressed={language === "fr"}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          language === "fr" ? "bg-ink text-white" : "text-slate-500 hover:text-ink"
        }`}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => setLanguage("ar")}
        disabled={pending}
        aria-pressed={language === "ar"}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          language === "ar" ? "bg-ink text-white" : "text-slate-500 hover:text-ink"
        }`}
      >
        AR
      </button>
    </div>
  );
}
