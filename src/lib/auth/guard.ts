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
  if (!roles.includes(appUser.role)) {
    redirect("/unauthorized");
  }
  return appUser;
}
