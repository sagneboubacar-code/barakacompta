import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, UserRole } from "@/types";

export async function requireUser(): Promise<AppUser> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("id, school_id, full_name, email, role, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!appUser) {
    redirect("/login");
  }

  return appUser as AppUser;
}

export async function requireRole(roles: UserRole[]): Promise<AppUser> {
  const appUser = await requireUser();
  // super_admin (équipe Baraka, hors école) passe toujours : c'est le rôle le
  // plus privilégié, il ne doit jamais perdre l'accès aux pages d'une école
  // (dashboard, paiements, rapports…) réservées à owner/admin/accountant.
  if (appUser.role !== "super_admin" && !roles.includes(appUser.role)) {
    redirect("/unauthorized");
  }
  return appUser;
}
