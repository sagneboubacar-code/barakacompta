import Link from "next/link";
import { PLANS } from "@/lib/constants/plans";
import { formatCurrency } from "@/lib/format";
import { Reveal } from "@/components/Reveal";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { getLanguage } from "@/lib/i18n/get-language";
import { landingDict } from "@/lib/i18n/dictionaries/landing";

const WHATSAPP_COMMUNITY_URL = "https://chat.whatsapp.com/CUWfLrN8BVU6UkFX0G0ypc";

export default function LandingPage() {
  const language = getLanguage();
  const t = landingDict[language];
  const { features: FEATURES, painPoints: PAIN_POINTS, steps: STEPS } = t;

  return (
    <div className="bg-white text-ink">
      <PublicHeader />

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
              {t.heroBadge}
            </p>
            <h1 className="mx-auto mt-5 max-w-2xl text-balance font-display text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.25rem]">
              {t.heroTitle}
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-balance text-base leading-relaxed text-slate-600">
              {t.heroText}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/signup"
                className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-brand/30 transition-colors hover:bg-brand-dark"
              >
                {t.ctaSignup}
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-ink hover:text-ink"
              >
                {t.ctaLogin}
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              {t.heroFootnote}
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
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">{t.featuresLabel}</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
              {t.featuresTitle}
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
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink">{t.howItWorksTitle}</h2>
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

      {/* Communauté WhatsApp */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <Reveal>
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-slate-50/60 px-6 py-10 text-center sm:px-10">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#25D366]/10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
                <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.44 1.32 4.94L2 22l5.24-1.37a9.9 9.9 0 0 0 4.8 1.22h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2Zm0 18.2h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.81.83-3.03-.2-.31a8.24 8.24 0 0 1-1.26-4.38c0-4.55 3.7-8.25 8.25-8.25 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.84c0 4.55-3.7 8.23-8.25 8.23Zm4.52-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.04 0 1.2.88 2.37 1 2.53.12.17 1.73 2.64 4.19 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29Z" />
              </svg>
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">{t.communityLabel}</p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                {t.communityTitle}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-balance text-sm leading-relaxed text-slate-500">
                {t.communityText}
              </p>
            </div>
            <a
              href={WHATSAPP_COMMUNITY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1DA851]"
            >
              {t.communityCta}
            </a>
          </div>
        </Reveal>
      </section>

      {/* Tarifs */}
      <section id="tarifs" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <Reveal>
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">{t.pricingLabel}</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
              {t.pricingTitle}
            </h2>
            <p className="mt-3 text-sm text-slate-500">{t.pricingSubtitle}</p>
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
                    <span className="absolute -top-3 start-6 rounded-full bg-brand px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                      {t.recommended}
                    </span>
                  )}
                  <p className={`text-sm font-semibold ${featured ? "text-white" : "text-ink"}`}>
                    {t.planLabels[plan.key] ?? plan.label}
                  </p>
                  <p className="mt-3 font-mono text-2xl font-bold tabular-nums">
                    {plan.priceXOF === 0 ? t.free : formatCurrency(plan.priceXOF ?? 0)}
                  </p>
                  {plan.priceXOF !== 0 && (
                    <p className={`text-xs ${featured ? "text-white/60" : "text-slate-400"}`}>{t.perMonth}</p>
                  )}
                  {plan.trialDays && (
                    <p className={`mt-1 text-xs ${featured ? "text-white/60" : "text-slate-400"}`}>
                      {plan.trialDays} {t.days}
                    </p>
                  )}

                  <ul className={`mt-5 flex-1 space-y-2 text-sm ${featured ? "text-white/80" : "text-slate-600"}`}>
                    <li>
                      {plan.maxStudents === null ? t.unlimitedStudents : t.upToStudents(plan.maxStudents)}
                    </li>
                    <li>{t.coreLine}</li>
                    {plan.modules.includes("collections") && <li>{t.collectionsLine}</li>}
                    {plan.modules.includes("reports") && <li>{t.reportsLine}</li>}
                  </ul>

                  <Link
                    href="/signup"
                    className={`mt-6 rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                      featured
                        ? "bg-white text-ink hover:bg-brand-light"
                        : "bg-ink text-white hover:bg-brand-dark"
                    }`}
                  >
                    {i === 0 ? t.start : t.choose}
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
              {t.finalCtaTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-balance text-sm text-white/60">
              {t.finalCtaText}
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-brand px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition-colors hover:bg-emerald-500"
            >
              {t.finalCtaButton}
            </Link>
          </Reveal>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
