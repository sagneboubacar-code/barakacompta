import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { completeGoogleSignup } from "@/lib/actions/auth";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: appUser } = await supabase.from("users").select("school_id").eq("id", user.id).maybeSingle();
  if (appUser?.school_id) {
    redirect("/dashboard");
  }

  const suggestedName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form
        action={completeGoogleSignup}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Baraka Compta" className="h-10 w-10" />
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Dernière étape</h1>
          <p className="text-sm text-slate-500">
            Connecté en tant que {user.email}. Donnez un nom à votre école pour créer votre espace.
          </p>
        </div>

        {searchParams.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
        )}

        <div className="space-y-1">
          <label htmlFor="schoolName" className="text-sm font-medium text-slate-700">
            Nom de l&apos;école
          </label>
          <input
            id="schoolName"
            name="schoolName"
            type="text"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="ownerFullName" className="text-sm font-medium text-slate-700">
            Votre nom complet
          </label>
          <input
            id="ownerFullName"
            name="ownerFullName"
            type="text"
            required
            defaultValue={suggestedName}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Créer mon école
        </button>
      </form>
    </main>
  );
}
