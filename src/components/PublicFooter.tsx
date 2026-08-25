import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-slate-400 sm:flex-row">
        <p>© {new Date().getFullYear()} Baraka Compta. Tous droits réservés.</p>
        <div className="flex gap-4">
          <Link href="/contact" className="hover:text-slate-600">Contact</Link>
          <Link href="/login" className="hover:text-slate-600">Se connecter</Link>
          <Link href="/signup" className="hover:text-slate-600">Inscrire mon école</Link>
        </div>
      </div>
    </footer>
  );
}
