import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { NAV_ITEMS } from "@/lib/auth/routes";

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  accountant: "Comptable",
  super_admin: "Staff Baraka",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = await requireUser();

  const supabase = createClient();
  const { data: school } = await supabase
    .from("schools")
    .select("id, name")
    .eq("id", appUser.school_id ?? "")
    .maybeSingle();

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(appUser.role));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {school?.name ?? "Baraka Gestion"}
            </p>
            <p className="text-xs text-slate-500">
              {appUser.full_name ?? appUser.email} · {ROLE_LABELS[appUser.role] ?? appUser.role}
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Déconnexion
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-4 px-6 pb-3">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
