"use client";

import { useLanguage } from "@/lib/i18n/language-provider";

const LABEL = { fr: "Imprimer", ar: "طباعة" };

export function PrintButton() {
  const { language } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 print:hidden"
    >
      {LABEL[language]}
    </button>
  );
}
