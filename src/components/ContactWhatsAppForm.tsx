"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-provider";
import { contactDict } from "@/lib/i18n/dictionaries/contact";

const WHATSAPP_NUMBER = "221788363394";

const inputClasses =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
const labelClasses = "space-y-1.5 text-sm font-medium text-ink";

// Pas de backend : le message est composé côté client puis envoyé
// directement via WhatsApp, comme demandé — l'équipe reçoit chaque
// demande dans la même conversation que les appels/messages directs.
export function ContactWhatsAppForm() {
  const { language } = useLanguage();
  const t = contactDict[language];
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lines = [
      t.waGreeting,
      `${t.waName} : ${name}`,
      contact ? `${t.waContact} : ${contact}` : "",
      `${t.waMessage} : ${message}`,
    ].filter(Boolean);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className={labelClasses}>
        {t.fullName}
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClasses}
          placeholder={t.fullNamePlaceholder}
        />
      </label>
      <label className={labelClasses}>
        {t.emailOrPhone}
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className={inputClasses}
          placeholder={t.emailOrPhonePlaceholder}
        />
      </label>
      <label className={labelClasses}>
        {t.message}
        <textarea
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={inputClasses}
          placeholder={t.messagePlaceholder}
        />
      </label>
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1DA851]"
      >
        {t.submit}
      </button>
      <p className="text-xs text-slate-400">
        {t.formFootnote}
      </p>
    </form>
  );
}
