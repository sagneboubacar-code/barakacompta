import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase/middleware";
import { findRouteRule } from "@/lib/auth/routes";
import { planIncludesModule } from "@/lib/constants/plans";

const AUTH_PAGES = ["/login", "/signup"];
const BILLING_PATH = "/dashboard/billing";

export async function middleware(request: NextRequest) {
  const { supabase, getResponse } = createMiddlewareSupabaseClient(request);
  const { pathname } = request.nextUrl;

  // getUser() (pas getSession()) : revalide le token auprès du serveur Auth,
  // seule méthode fiable dans un middleware pour ne pas faire confiance à un
  // cookie potentiellement périmé/forgé.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname === "/onboarding") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return getResponse();
  }

  const needsAppUser =
    AUTH_PAGES.includes(pathname) ||
    pathname === "/onboarding" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin");
  if (!needsAppUser) {
    return getResponse();
  }

  // La RLS protège déjà les données ; cette vérification évite en plus de
  // rendre une page vide/trompeuse à un utilisateur sans le bon rôle — on
  // le redirige explicitement vers /unauthorized.
  const { data: appUser } = await supabase
    .from("users")
    .select("role, school_id")
    .eq("id", user.id)
    .maybeSingle();

  // Compte Auth existant (ex. créé via Google) mais sans école : seule
  // /onboarding doit rester accessible tant que ce n'est pas fait.
  if (pathname === "/onboarding") {
    if (appUser?.school_id) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return getResponse();
  }

  if (AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL(appUser?.school_id ? "/dashboard" : "/onboarding", request.url));
  }

  // Défense en profondeur pour /admin (staff Baraka uniquement) : la page
  // vérifie déjà le rôle elle-même via requireRole, mais contrairement à
  // /dashboard elle n'avait aucun filet au niveau middleware — un oubli de
  // requireRole sur une future route /admin/* passerait alors inaperçu.
  if (pathname.startsWith("/admin")) {
    if (appUser?.role !== "super_admin") {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
    return getResponse();
  }

  if (pathname.startsWith("/dashboard")) {
    if (!appUser || !appUser.school_id) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    const rule = findRouteRule(pathname);
    if (rule && !rule.roles.includes(appUser.role)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    // La page d'abonnement doit toujours rester accessible : c'est le seul
    // moyen de sortir d'un abonnement expiré ou de voir pourquoi un module
    // est verrouillé.
    if (!pathname.startsWith(BILLING_PATH)) {
      const { data: school } = await supabase
        .from("schools")
        .select("plan, subscription_status, subscription_expires_at")
        .eq("id", appUser.school_id)
        .maybeSingle();

      const today = new Date().toISOString().slice(0, 10);
      const expired =
        !school ||
        school.subscription_status === "cancelled" ||
        school.subscription_expires_at < today;

      if (expired) {
        return NextResponse.redirect(new URL(BILLING_PATH, request.url));
      }

      if (rule?.moduleKey && !planIncludesModule(school.plan, rule.moduleKey)) {
        const url = new URL(BILLING_PATH, request.url);
        url.searchParams.set("upgrade", rule.moduleKey);
        return NextResponse.redirect(url);
      }
    }
  }

  return getResponse();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
