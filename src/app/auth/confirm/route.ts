import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Point d'entrée des liens reçus par e-mail (réinitialisation de mot de
// passe, confirmation d'adresse).
//
// Pourquoi cette route en plus de /auth/callback : le flux PKCE utilisé par
// /auth/callback exige que le lien soit ouvert dans le navigateur qui a fait
// la demande, parce qu'il y dépose un « vérificateur ». Une directrice qui
// demande le lien sur son ordinateur et ouvre l'e-mail sur son téléphone
// serait bloquée. Ici, le jeton porté par l'URL suffit : aucun état local
// n'est nécessaire, le lien marche sur n'importe quel appareil.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Chemin interne uniquement : une URL absolue ferait de cette route une
  // redirection ouverte, exploitable pour du hameçonnage.
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/mot-de-passe-oublie?error=invalid`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    // Lien périmé, déjà utilisé, ou jeton invalide : on renvoie vers la
    // demande d'un nouveau lien plutôt que vers un formulaire inutilisable.
    return NextResponse.redirect(`${origin}/reinitialiser-mot-de-passe?error=expired`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
