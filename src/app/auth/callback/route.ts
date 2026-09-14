import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { landingPath } from "@/lib/auth/landing";

// Point de retour après OAuth (Google) : Supabase redirige ici avec un
// `code` à échanger contre une session. Ensuite on aiguille vers /dashboard
// si l'utilisateur a déjà une école, sinon /onboarding pour la créer (cas
// d'un tout premier login Google, sans compte email/mot de passe existant).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // `next` sert au lien de réinitialisation de mot de passe, qui doit
  // atterrir sur le formulaire de changement et non sur le tableau de bord.
  // On n'accepte qu'un chemin interne : une URL absolue ferait de cette
  // route une redirection ouverte, exploitable pour du hameçonnage.
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: appUser } = await supabase
          .from("users")
          .select("role, school_id")
          .eq("id", user.id)
          .maybeSingle();

        return NextResponse.redirect(`${origin}${next ?? landingPath(appUser)}`);
      }
    }
  }

  // Cette route sert aussi aux liens de réinitialisation de mot de passe :
  // annoncer un échec « Google » induisait en erreur une école qui venait
  // simplement de cliquer sur un lien périmé.
  const message = next
    ? "Ce lien n'est plus valable. Demandez-en un nouveau."
    : "Connexion avec Google impossible. Réessayez.";
  const destination = next ? "/mot-de-passe-oublie" : "/login";

  return NextResponse.redirect(`${origin}${destination}?error=${encodeURIComponent(message)}`);
}
