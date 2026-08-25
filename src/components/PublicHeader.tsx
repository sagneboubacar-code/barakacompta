import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" className="h-8 w-8" />
          Baraka <span className="text-brand">Compta</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 sm:flex">
          <Link href="/#fonctionnalites" className="transition-colors hover:text-ink">Fonctionnalités</Link>
          <Link href="/#tarifs" className="transition-colors hover:text-ink">Tarifs</Link>
          <Link href="/contact" className="transition-colors hover:text-ink">Contact</Link>
          <Link href="/login" className="transition-colors hover:text-ink">Se connecter</Link>
        </nav>
        <Link
          href="/signup"
          className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Commencer gratuitement
        </Link>
      </div>
    </header>
  );
}
