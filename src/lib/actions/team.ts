"use server";

import crypto from "node:crypto";
import { requireRole } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

const VALID_ROLES: UserRole[] = ["admin", "accountant"];

export type InviteTeamMemberResult =
  | { success: true; email: string; tempPassword: string }
  | { success: false; error: string };

function generateTempPassword(): string {
  // 12 caractères lisibles (base64url), suffisant pour un mot de passe
  // temporaire à usage unique — l'utilisateur devra le changer lui-même
  // (pas de flux "changer mon mot de passe" pour l'instant).
  return crypto.randomBytes(9).toString("base64url");
}

// Crée un compte admin/comptable pour l'école du owner connecté. Le mot de
// passe est généré côté serveur et renvoyé une seule fois au propriétaire
// (jamais via l'URL) : à lui de le communiquer à la personne concernée.
export async function inviteTeamMember(formData: FormData): Promise<InviteTeamMemberResult> {
  const appUser = await requireRole(["owner"]);

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");

  if (!fullName || !email || !VALID_ROLES.includes(role as UserRole)) {
    return { success: false, error: "Merci de renseigner un nom, un email et un rôle valides." };
  }

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    const msg = createError?.message ?? "";
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
      return { success: false, error: "Un compte existe déjà avec cet email." };
    }
    return { success: false, error: "Impossible de créer le compte : " + msg };
  }

  // Insertion via le client authentifié (pas l'admin) : la RLS
  // (users_owner_manage_school_users) revérifie que l'appelant est bien
  // owner de l'école ciblée — défense en profondeur, pas juste ce contrôle applicatif.
  const supabase = createServerSupabase();
  const { error: insertError } = await supabase.from("users").insert({
    id: created.user.id,
    school_id: appUser.school_id ?? "",
    full_name: fullName,
    email,
    role: role as UserRole,
  });

  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { success: false, error: "Impossible de rattacher le compte à l'école : " + insertError.message };
  }

  return { success: true, email, tempPassword };
}
