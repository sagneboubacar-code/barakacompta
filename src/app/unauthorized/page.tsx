import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Accès non autorisé</h1>
      <p className="max-w-md text-slate-600">
        Vous n&apos;avez pas les droits nécessaires pour accéder à cette page, ou
        elle appartient à une autre école.
      </p>
      <Link
        href="/dashboard"
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Retour au tableau de bord
      </Link>
    </main>
  );
}
