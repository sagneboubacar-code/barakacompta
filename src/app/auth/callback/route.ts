import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Point de retour après OAuth (Google) : Supabase redirige ici avec un
// `code` à échanger contre une session. Ensuite on aiguille vers /dashboard
// si l'utilisateur a déjà une école, sinon /onboarding pour la créer (cas
// d'un tout premier login Google, sans compte email/mot de passe existant).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

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
          .select("school_id")
          .eq("id", user.id)
          .maybeSingle();

        return NextResponse.redirect(`${origin}${appUser?.school_id ? "/dashboard" : "/onboarding"}`);
      }
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Connexion avec Google impossible. Réessayez.")}`
  );
}
