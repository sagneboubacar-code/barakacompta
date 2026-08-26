import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { NAV_ITEMS } from "@/lib/auth/routes";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { getLanguage } from "@/lib/i18n/get-language";
import { navLabelsDict, roleLabelsDict } from "@/lib/i18n/dictionaries/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = await requireUser();
  const language = getLanguage();

  const supabase = createClient();
  const { data: school } = await supabase
    .from("schools")
    .select("id, name")
    .eq("id", appUser.school_id ?? "")
    .maybeSingle();

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(appUser.role));

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <DashboardSidebar
        schoolName={school?.name ?? "Baraka Compta"}
        userLabel={appUser.full_name ?? appUser.email ?? "Utilisateur"}
        roleLabel={roleLabelsDict[appUser.role]?.[language] ?? appUser.role}
        navItems={visibleNav.map((item) => ({
          href: item.href,
          label: navLabelsDict[item.href]?.[language] ?? item.label,
        }))}
        signOutAction={signOut}
      />
      <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
    </div>
  );
}
