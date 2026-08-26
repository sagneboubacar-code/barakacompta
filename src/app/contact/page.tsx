import type { Metadata } from "next";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { ContactWhatsAppForm } from "@/components/ContactWhatsAppForm";
import { getLanguage } from "@/lib/i18n/get-language";
import { contactDict } from "@/lib/i18n/dictionaries/contact";

export const metadata: Metadata = {
  title: "Contact — Baraka Compta",
  description: "Contactez l'équipe Baraka Compta par email, WhatsApp ou via notre formulaire.",
};

const WHATSAPP_NUMBER_DISPLAY = "78 836 33 94";
const WHATSAPP_HREF = "https://wa.me/221788363394";
const CONTACT_EMAIL = "barakacomptasenegal@gmail.com";

export default function ContactPage() {
  const language = getLanguage();
  const t = contactDict[language];

  return (
    <div className="bg-white text-ink">
      <PublicHeader />

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">{t.eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {t.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            {t.subtitle}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 p-5 transition-colors hover:border-brand/40"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{t.byEmail}</p>
                <p className="text-sm text-slate-500">{CONTACT_EMAIL}</p>
              </div>
            </a>

            <a
              href={`tel:+221788363394`}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 p-5 transition-colors hover:border-brand/40"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6.6 10.8c1.3 2.6 3.4 4.7 6 6l2-2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1v3.5c0 .6-.4 1-1 1C9.9 20.7 3.3 14.1 3.3 6c0-.6.4-1 1-1H8c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.2 1l-2 2Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{t.byPhone}</p>
                <p className="text-sm text-slate-500" dir="ltr">+221 {WHATSAPP_NUMBER_DISPLAY}</p>
              </div>
            </a>

            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-2xl border border-slate-200 p-5 transition-colors hover:border-brand/40"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#25D366]/10">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
                  <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.44 1.32 4.94L2 22l5.24-1.37a9.9 9.9 0 0 0 4.8 1.22h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2Zm0 18.2h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.81.83-3.03-.2-.31a8.24 8.24 0 0 1-1.26-4.38c0-4.55 3.7-8.25 8.25-8.25 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.84c0 4.55-3.7 8.23-8.25 8.23Zm4.52-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.04 0 1.2.88 2.37 1 2.53.12.17 1.73 2.64 4.19 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29Z" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{t.onWhatsApp}</p>
                <p className="text-sm text-slate-500">{t.whatsAppText}</p>
              </div>
            </a>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-7">
            <h2 className="font-display text-lg font-semibold text-ink">{t.formTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{t.formSubtitle}</p>
            <div className="mt-6">
              <ContactWhatsAppForm />
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
