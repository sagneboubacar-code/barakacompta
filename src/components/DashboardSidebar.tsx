"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-provider";
import { sidebarDict } from "@/lib/i18n/dictionaries/dashboard-shell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface NavItem {
  href: string;
  label: string;
}

export function DashboardSidebar({
  schoolName,
  userLabel,
  roleLabel,
  navItems,
  signOutAction,
}: {
  schoolName: string;
  userLabel: string;
  roleLabel: string;
  navItems: NavItem[];
  signOutAction: () => void;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { language } = useLanguage();
  const t = sidebarDict[language];

  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  const navList = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {navItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Barre mobile : logo + bouton menu, la sidebar devient un panneau coulissant */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" className="h-6 w-6" />
          {schoolName}
        </span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={t.openMenu}
            className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 text-slate-600"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M2.5 5h15M2.5 10h15M2.5 15h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 start-0 z-50 flex w-64 flex-col border-e border-slate-200 bg-white transition-transform lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Baraka Compta</p>
            <p className="truncate text-sm font-semibold text-slate-900">{schoolName}</p>
          </div>
        </div>

        {navList}

        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{userLabel}</p>
              <p className="text-xs text-slate-500">{roleLabel}</p>
            </div>
            <LanguageSwitcher className="hidden lg:inline-flex" />
          </div>
          <form action={signOutAction} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              {t.signOut}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
