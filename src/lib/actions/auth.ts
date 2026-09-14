"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { randomSlugSuffix, slugify } from "@/lib/slug";
import { landingPath } from "@/lib/auth/landing";

const UNIQUE_VIOLATION = "23505";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function signUpSchool(formData: FormData) {
  const schoolName = String(formData.get("schoolName") ?? "").trim();
  const ownerFullName = String(formData.get("ownerFullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!schoolName || !ownerFullName || !phone || !email || password.length < 8) {
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
      p_owner_phone: phone,
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

// Dernière étape après une première connexion Google : l'utilisateur Auth
// existe déjà (créé par Supabase via OAuth), il ne reste qu'à créer son
// école et sa ligne public.users — on réutilise la même RPC que le signup
// classique, seul le point de départ diffère (pas de création de compte).
export async function completeGoogleSignup(formData: FormData) {
  const schoolName = String(formData.get("schoolName") ?? "").trim();
  const ownerFullName = String(formData.get("ownerFullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!schoolName || !phone) {
    fail("/onboarding", "Merci d'indiquer le nom de votre école et votre numéro de téléphone.");
  }

  // Idempotence : en cas de double soumission, ne recrée rien si l'école
  // existe déjà pour cet utilisateur.
  const { data: existing } = await supabase.from("users").select("school_id").eq("id", user.id).maybeSingle();
  if (existing?.school_id) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const email = user.email ?? "";
  const finalOwnerName = ownerFullName || (user.user_metadata?.full_name as string | undefined) || email;
  const baseSlug = slugify(schoolName);
  let schoolId: string | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidateSlug = attempt === 0 ? baseSlug : `${baseSlug}-${randomSlugSuffix()}`;
    const { data, error } = await admin.rpc("create_school_with_owner", {
      p_school_name: schoolName,
      p_school_slug: candidateSlug,
      p_owner_id: user.id,
      p_owner_email: email,
      p_owner_full_name: finalOwnerName,
      p_owner_phone: phone,
    });

    if (!error) {
      schoolId = data as unknown as string;
      break;
    }

    if (error.code !== UNIQUE_VIOLATION) {
      fail("/onboarding", "Impossible de créer l'école : " + error.message);
    }
    // sinon : collision de slug, on retente avec un suffixe.
  }

  if (!schoolId) {
    fail("/onboarding", "Impossible de générer un identifiant unique pour cette école, réessayez avec un autre nom.");
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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    fail("/login", "Identifiants invalides.");
  }

  // Envoyer tout le monde sur /dashboard laisserait le middleware rattraper
  // le staff Baraka par une redirection de plus : autant viser juste ici.
  const { data: appUser } = await supabase
    .from("users")
    .select("role, school_id")
    .eq("id", data.user.id)
    .maybeSingle();

  redirect(landingPath(appUser));
}

export async function signOut() {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

// L'origine réelle de la requête, pour que le lien reçu par e-mail ramène
// sur le domaine d'où part la demande (production comme local) plutôt que
// sur une adresse codée en dur.
function requestOrigin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.barakacompta.com";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Envoi du lien de réinitialisation. Le message de retour est le même que
// l'adresse existe ou non : répondre « compte inconnu » permettrait de
// savoir quelles écoles sont inscrites chez Baraka.
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const base = "/mot-de-passe-oublie";

  if (!email || !email.includes("@")) {
    fail(base, "invalid");
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // On repasse par /auth/callback : c'est lui qui échange le code contre
    // une session, exactement comme pour la connexion Google.
    redirectTo: `${requestOrigin()}/auth/callback?next=/reinitialiser-mot-de-passe`,
  });

  // Seule la limite d'envoi mérite d'être signalée : l'école doit savoir
  // qu'il faut patienter, et non renvoyer dix fois de suite.
  if (error && /rate|limit|seconds/i.test(error.message)) {
    fail(base, "rate");
  }

  redirect(`${base}?sent=1`);
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const base = "/reinitialiser-mot-de-passe";

  if (password.length < 8) {
    fail(base, "short");
  }
  if (password !== confirm) {
    fail(base, "mismatch");
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password });

  // Sans session valide (lien périmé ou déjà utilisé), Supabase refuse.
  if (error) {
    fail(base, "expired");
  }

  // On ferme la session ouverte par le lien avant de renvoyer vers /login :
  // sans ça le middleware, voyant un utilisateur connecté, redirige aussitôt
  // vers le tableau de bord et l'école ne voit jamais la confirmation. La
  // reconnexion immédiate lui prouve en outre que son nouveau mot de passe
  // fonctionne.
  await supabase.auth.signOut();

  redirect("/login?reset=1");
}
