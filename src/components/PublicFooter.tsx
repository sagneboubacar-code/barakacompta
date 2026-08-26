"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-provider";
import { footerDict } from "@/lib/i18n/dictionaries/footer";

export function PublicFooter() {
  const { language } = useLanguage();
  const t = footerDict[language];

  return (
    <footer className="border-t border-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-slate-400 sm:flex-row">
        <p>{t.rights(new Date().getFullYear())}</p>
        <div className="flex gap-4">
          <Link href="/contact" className="hover:text-slate-600">{t.contact}</Link>
          <Link href="/login" className="hover:text-slate-600">{t.login}</Link>
          <Link href="/signup" className="hover:text-slate-600">{t.signup}</Link>
        </div>
      </div>
    </footer>
  );
}
