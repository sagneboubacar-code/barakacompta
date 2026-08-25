"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
        <span className="text-sm font-semibold text-slate-900">{schoolName}</span>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Ouvrir le menu"
          className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 text-slate-600"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M2.5 5h15M2.5 10h15M2.5 15h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-slate-200 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Baraka Compta</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">{schoolName}</p>
        </div>

        {navList}

        <div className="border-t border-slate-200 p-4">
          <p className="truncate text-sm font-medium text-slate-900">{userLabel}</p>
          <p className="text-xs text-slate-500">{roleLabel}</p>
          <form action={signOutAction} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
