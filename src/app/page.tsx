import Link from "next/link";
import { PLANS } from "@/lib/constants/plans";
import { formatCurrency } from "@/lib/format";
import { Reveal } from "@/components/Reveal";

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

const PAIN_POINTS = [
  {
    title: "Suivi manuel, source d'erreurs",
    text: "Cahiers et fichiers Excel dispersés entre plusieurs responsables.",
  },
  {
    title: "Retards difficiles à repérer",
    text: "Impossible de savoir rapidement quels élèves sont à jour.",
  },
  {
    title: "Rapports longs à préparer",
    text: "Des heures perdues avant chaque réunion avec la direction.",
  },
];

const STEPS = [
  { n: "01", title: "Inscrivez votre école", text: "Créez votre espace en moins de deux minutes, sans engagement." },
  { n: "02", title: "Ajoutez élèves et tarifs", text: "Importez vos élèves et configurez vos frais scolaires." },
  { n: "03", title: "Suivez tout en temps réel", text: "Paiements, retards et rapports, accessibles à toute votre équipe." },
];

export default function LandingPage() {
  return (
    <div className="bg-white text-ink">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="font-display text-lg font-bold tracking-tight text-ink">
            Baraka <span className="text-brand">Compta</span>
          </span>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 sm:flex">
            <a href="#fonctionnalites" className="transition-colors hover:text-ink">Fonctionnalités</a>
            <a href="#tarifs" className="transition-colors hover:text-ink">Tarifs</a>
            <Link href="/login" className="transition-colors hover:text-ink">Se connecter</Link>
          </nav>
          <Link
            href="/signup"
            className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Essai gratuit
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-[-10%] h-[560px] w-[560px] rounded-full opacity-[0.16] blur-3xl"
          style={{ background: "radial-gradient(circle, #0E7C5A 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-16 text-center sm:pb-28 sm:pt-24">
          <Reveal>
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-light px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-dark">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Gestion financière scolaire
            </p>
            <h1 className="mx-auto mt-5 max-w-2xl text-balance font-display text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.25rem]">
              La comptabilité de votre école, sans les cahiers ni les fichiers Excel.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-balance text-base leading-relaxed text-slate-600">
              Baraka Compta centralise les élèves, les paiements, les dépenses et les rapports de votre
              établissement — pour savoir, à tout moment, où en est votre trésorerie.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/signup"
                className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-brand/30 transition-colors hover:bg-brand-dark"
              >
                Essai gratuit — {PLANS[0].trialDays} jours
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-ink hover:text-ink"
              >
                Se connecter
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Sans engagement · Aucune carte bancaire requise
            </p>
          </Reveal>
        </div>
      </section>

      {/* Points de douleur */}
      <section className="border-y border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-3">
            {PAIN_POINTS.map((point, i) => (
              <Reveal key={point.title} delay={i * 90}>
                <div className="border-t-2 border-slate-300 pt-4">
                  <p className="font-display text-base font-semibold text-ink">{point.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{point.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Fonctionnalités */}
      <section id="fonctionnalites" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <Reveal>
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">Fonctionnalités</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
              Tout ce qu&apos;il faut pour gérer la caisse de l&apos;école
            </h2>
          </div>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <div className="h-full rounded-2xl border border-slate-200 p-6 transition-colors hover:border-brand/40">
                <h3 className="font-display text-base font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="border-y border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <Reveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink">Comment ça marche</h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="border-l-2 border-brand/30 pl-5">
                  <span className="font-mono text-2xl font-bold text-brand/40">{s.n}</span>
                  <p className="mt-2 font-display text-lg font-semibold text-ink">{s.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Tarifs */}
      <section id="tarifs" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <Reveal>
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">Tarifs</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
              Un tarif simple, qui grandit avec votre école
            </h2>
            <p className="mt-3 text-sm text-slate-500">Facturation mensuelle, sans engagement.</p>
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => {
            const featured = plan.key === "pro";
            return (
              <Reveal key={plan.key} delay={i * 70}>
                <div
                  className={`relative flex h-full flex-col rounded-2xl border p-6 ${
                    featured ? "border-brand bg-ink text-white shadow-xl shadow-ink/20" : "border-slate-200 bg-white"
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                      Recommandé
                    </span>
                  )}
                  <p className={`text-sm font-semibold ${featured ? "text-white" : "text-ink"}`}>
                    {plan.label}
                  </p>
                  <p className="mt-3 font-mono text-2xl font-bold tabular-nums">
                    {plan.priceXOF === 0 ? "Gratuit" : formatCurrency(plan.priceXOF ?? 0)}
                  </p>
                  {plan.priceXOF !== 0 && (
                    <p className={`text-xs ${featured ? "text-white/60" : "text-slate-400"}`}>/ mois</p>
                  )}
                  {plan.trialDays && (
                    <p className={`mt-1 text-xs ${featured ? "text-white/60" : "text-slate-400"}`}>
                      {plan.trialDays} jours
                    </p>
                  )}

                  <ul className={`mt-5 flex-1 space-y-2 text-sm ${featured ? "text-white/80" : "text-slate-600"}`}>
                    <li>
                      {plan.maxStudents === null ? "Élèves illimités" : `Jusqu'à ${plan.maxStudents} élèves`}
                    </li>
                    <li>Élèves, tarifs, paiements, dépenses</li>
                    {plan.modules.includes("collections") && <li>Recouvrement</li>}
                    {plan.modules.includes("reports") && <li>Rapports financiers</li>}
                  </ul>

                  <Link
                    href="/signup"
                    className={`mt-6 rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                      featured
                        ? "bg-white text-ink hover:bg-brand-light"
                        : "bg-ink text-white hover:bg-brand-dark"
                    }`}
                  >
                    {i === 0 ? "Commencer" : "Choisir"}
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-ink">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-24">
          <Reveal>
            <h2 className="text-balance font-display text-3xl font-bold text-white sm:text-4xl">
              Prêt à simplifier la gestion de votre école ?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-balance text-sm text-white/60">
              Créez votre espace en moins de deux minutes.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-brand px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition-colors hover:bg-emerald-500"
            >
              Essai gratuit — {PLANS[0].trialDays} jours
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Baraka Compta. Tous droits réservés.</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-slate-600">Se connecter</Link>
            <Link href="/signup" className="hover:text-slate-600">Inscrire mon école</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
