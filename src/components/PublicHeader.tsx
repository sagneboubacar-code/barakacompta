"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-provider";
import { headerDict } from "@/lib/i18n/dictionaries/header";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { InstallAppButton } from "@/components/InstallAppButton";

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { language } = useLanguage();
  const t = headerDict[language];

  const navLinks = [
    { href: "/#fonctionnalites", label: t.features },
    { href: "/#tarifs", label: t.pricing },
    { href: "/contact", label: t.contact },
    { href: "/login", label: t.login },
  ];

  return (
    <>
      <InstallAppButton />
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex min-w-0 items-center gap-2 font-display text-lg font-bold tracking-tight text-ink"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" className="h-8 w-8 shrink-0" />
          <span className="truncate">
            {t.brandFirst} <span className="text-brand">{t.brandSecond}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 sm:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          <LanguageSwitcher />
          <Link
            href="/signup"
            className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            {t.signup}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? t.closeMenu : t.openMenu}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink sm:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-slate-200/80 bg-white px-6 py-4 sm:hidden">
          <ul className="flex flex-col gap-4 text-sm font-medium text-slate-600">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} onClick={() => setOpen(false)} className="transition-colors hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <LanguageSwitcher />
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-full bg-ink px-5 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              {t.signup}
            </Link>
          </div>
        </nav>
      )}
      </header>
    </>
  );
}
