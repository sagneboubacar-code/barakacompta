"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { randomSlugSuffix, slugify } from "@/lib/slug";

const UNIQUE_VIOLATION = "23505";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function signUpSchool(formData: FormData) {
  const schoolName = String(formData.get("schoolName") ?? "").trim();
  const ownerFullName = String(formData.get("ownerFullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!schoolName || !ownerFullName || !email || password.length < 8) {
    fail("/signup", "Merci de remplir tous les champs (mot de passe : 8 caractères minimum).");
  }

  const admin = createAdminClient();

  const { data: created, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: ownerFullName },
  });

  if (createUserError || !created.user) {
    const msg = createUserError?.message ?? "";
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
      fail("/signup", "Un compte existe déjà avec cet email.");
    }
    fail("/signup", "Impossible de créer le compte : " + msg);
  }

  const ownerId = created.user.id;
  const baseSlug = slugify(schoolName);
  let schoolId: string | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidateSlug = attempt === 0 ? baseSlug : `${baseSlug}-${randomSlugSuffix()}`;
    const { data, error } = await admin.rpc("create_school_with_owner", {
      p_school_name: schoolName,
      p_school_slug: candidateSlug,
      p_owner_id: ownerId,
      p_owner_email: email,
      p_owner_full_name: ownerFullName,
    });

    if (!error) {
      schoolId = data as unknown as string;
      break;
    }

    if (error.code !== UNIQUE_VIOLATION) {
      await admin.auth.admin.deleteUser(ownerId);
      fail("/signup", "Impossible de créer l'école : " + error.message);
    }
    // sinon : collision de slug, on retente avec un suffixe.
  }

  if (!schoolId) {
    await admin.auth.admin.deleteUser(ownerId);
    fail("/signup", "Impossible de générer un identifiant unique pour cette école, réessayez avec un autre nom.");
  }

  const supabase = createServerSupabase();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    redirect("/login?error=" + encodeURIComponent("Compte créé. Merci de vous connecter."));
  }

  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    fail("/login", "Email et mot de passe requis.");
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    fail("/login", "Identifiants invalides.");
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
