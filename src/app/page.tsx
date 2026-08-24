import Link from "next/link";
import { PLANS } from "@/lib/constants/plans";
import { formatCurrency } from "@/lib/format";

const FEATURES = [
  {
    title: "Élèves & inscriptions",
    text: "Un dossier par élève : classe, responsables, statut, historique complet — fini les cahiers et les fiches volantes.",
  },
  {
    title: "Tarifs & échéanciers",
    text: "Définissez vos frais (inscription, mensualités, uniforme...) une fois, l'échéancier de chaque élève se génère automatiquement.",
  },
  {
    title: "Paiements",
    text: "Enregistrez chaque paiement en quelques secondes, par espèces, Wave, Orange Money ou virement.",
  },
  {
    title: "Recouvrement",
    text: "Voyez d'un coup d'œil qui est à jour et qui est en retard, élève par élève, classe par classe.",
  },
  {
    title: "Rapports financiers",
    text: "Recettes, dépenses, solde par responsable, détail journalier — prêts à imprimer ou exporter en un clic.",
  },
  {
    title: "Dépenses & transferts",
    text: "Suivez les sorties de caisse et les transferts entre responsables, avec une comptabilité consolidée pour l'école.",
  },
];

const STEPS = [
  { n: "01", title: "Inscrivez votre école", text: "Créez votre espace en moins de deux minutes, sans engagement." },
  { n: "02", title: "Ajoutez élèves et tarifs", text: "Importez vos élèves et configurez vos frais scolaires." },
  { n: "03", title: "Suivez tout en temps réel", text: "Paiements, retards et rapports, accessibles à toute votre équipe." },
];

export default function LandingPage() {
  return (
    <div className="bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="font-semibold tracking-tight text-slate-900">
            Baraka <span className="text-emerald-700">Gestion</span>
          </span>
          <nav className="hidden items-center gap-7 text-sm text-slate-600 sm:flex">
            <a href="#fonctionnalites" className="hover:text-slate-900">Fonctionnalités</a>
            <a href="#tarifs" className="hover:text-slate-900">Tarifs</a>
            <Link href="/login" className="hover:text-slate-900">Se connecter</Link>
          </nav>
          <Link
            href="/signup"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Essai gratuit
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 py-20 sm:py-28 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
            Gestion financière scolaire
          </p>
          <h1 className="mt-4 text-balance text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            La comptabilité de votre école, sans les cahiers ni les fichiers Excel.
          </h1>
          <p className="mt-5 max-w-lg text-balance text-base leading-relaxed text-slate-600">
            Baraka Gestion centralise les élèves, les paiements, les dépenses et les rapports de votre
            établissement — pour savoir, à tout moment, où en est votre trésorerie.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="rounded-md bg-emerald-700 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Essai gratuit — {PLANS[0].trialDays} jours
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Se connecter
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Sans engagement · Aucune carte bancaire requise
          </p>
        </div>

        {/* Signature element — même langage visuel que les rapports produits */}
        <div className="relative">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Tableau de bord — Année 2025-2026
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="border-t-2 border-emerald-600 bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Recettes du mois</p>
                <p className="mt-1 font-mono text-base font-semibold tabular-nums text-emerald-700">
                  {formatCurrency(1850000)}
                </p>
              </div>
              <div className="border-t-2 border-amber-500 bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">À recouvrer</p>
                <p className="mt-1 font-mono text-base font-semibold tabular-nums text-amber-700">
                  {formatCurrency(430000)}
                </p>
              </div>
              <div className="border-t-2 border-slate-400 bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Élèves</p>
                <p className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-900">214</p>
              </div>
            </div>

            <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
              {[
                { name: "Aïssatou Diop", detail: "Mensualité — Février", status: "Payé", ok: true },
                { name: "Moussa Ndiaye", detail: "Mensualité — Février", status: "En retard", ok: false },
                { name: "Fatou Sarr", detail: "Frais d'inscription", status: "Payé", ok: true },
              ].map((row) => (
                <div key={row.name} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-500">{row.detail}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      row.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Points de douleur */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <p className="font-mono text-2xl font-bold text-slate-300">01</p>
              <p className="mt-2 text-sm font-medium text-slate-900">Suivi manuel, source d&apos;erreurs</p>
              <p className="mt-1 text-sm text-slate-500">
                Cahiers et fichiers Excel dispersés entre plusieurs responsables.
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-slate-300">02</p>
              <p className="mt-2 text-sm font-medium text-slate-900">Retards difficiles à repérer</p>
              <p className="mt-1 text-sm text-slate-500">
                Impossible de savoir rapidement quels élèves sont à jour.
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-slate-300">03</p>
              <p className="mt-2 text-sm font-medium text-slate-900">Rapports longs à préparer</p>
              <p className="mt-1 text-sm text-slate-500">
                Des heures perdues avant chaque réunion avec la direction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Fonctionnalités */}
      <section id="fonctionnalites" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Fonctionnalités</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Tout ce qu&apos;il faut pour gérer la caisse de l&apos;école
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Comment ça marche</h2>
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="border-l-2 border-emerald-600/30 pl-5">
                <span className="font-mono text-2xl font-bold text-emerald-700/40">{s.n}</span>
                <p className="mt-2 font-semibold text-slate-900">{s.title}</p>
                <p className="mt-1 text-sm text-slate-500">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tarifs */}
      <section id="tarifs" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Tarifs</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Un tarif simple, qui grandit avec votre école
          </h2>
          <p className="mt-3 text-sm text-slate-500">Facturation mensuelle, sans engagement.</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => {
            const featured = plan.key === "pro";
            return (
              <div
                key={plan.key}
                className={`flex flex-col rounded-2xl border p-6 ${
                  featured ? "border-emerald-600 bg-emerald-700 text-white shadow-lg" : "border-slate-200 bg-white"
                }`}
              >
                <p className={`text-sm font-semibold ${featured ? "text-white" : "text-slate-900"}`}>
                  {plan.label}
                </p>
                <p className="mt-3 font-mono text-2xl font-bold tabular-nums">
                  {plan.priceXOF === 0 ? "Gratuit" : formatCurrency(plan.priceXOF ?? 0)}
                </p>
                {plan.priceXOF !== 0 && (
                  <p className={`text-xs ${featured ? "text-emerald-100" : "text-slate-400"}`}>/ mois</p>
                )}
                {plan.trialDays && (
                  <p className={`mt-1 text-xs ${featured ? "text-emerald-100" : "text-slate-400"}`}>
                    {plan.trialDays} jours
                  </p>
                )}

                <ul className={`mt-5 flex-1 space-y-2 text-sm ${featured ? "text-emerald-50" : "text-slate-600"}`}>
                  <li>
                    {plan.maxStudents === null ? "Élèves illimités" : `Jusqu'à ${plan.maxStudents} élèves`}
                  </li>
                  <li>Élèves, tarifs, paiements, dépenses</li>
                  {plan.modules.includes("collections") && <li>Recouvrement</li>}
                  {plan.modules.includes("reports") && <li>Rapports financiers</li>}
                </ul>

                <Link
                  href="/signup"
                  className={`mt-6 rounded-md px-4 py-2 text-center text-sm font-semibold ${
                    featured
                      ? "bg-white text-emerald-700 hover:bg-emerald-50"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {i === 0 ? "Commencer" : "Choisir"}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="text-balance text-3xl font-bold text-white sm:text-4xl">
            Prêt à simplifier la gestion de votre école ?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-balance text-sm text-slate-400">
            Créez votre espace en moins de deux minutes.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center justify-center rounded-md bg-emerald-600 px-8 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Essai gratuit — {PLANS[0].trialDays} jours
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Baraka Gestion. Tous droits réservés.</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-slate-600">Se connecter</Link>
            <Link href="/signup" className="hover:text-slate-600">Inscrire mon école</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
