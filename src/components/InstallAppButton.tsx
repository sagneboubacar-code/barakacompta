"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/language-provider";

// Événement non standard exposé par Chrome/Edge/Android avant Next 16 —
// pas encore dans le lib.dom.d.ts de TypeScript, on le type nous-mêmes.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const LABEL = { fr: "Installer l'application", ar: "تثبيت التطبيق" };
const IOS_HINT = {
  fr: "Sur iPhone : appuyez sur Partager, puis « Sur l'écran d'accueil ».",
  ar: "على آيفون: اضغط على مشاركة، ثم «إضافة إلى الشاشة الرئيسية».",
};

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS expose ce flag propriétaire au lieu du media query standard.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallAppButton({ className = "" }: { className?: string }) {
  const { language } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [installed, setInstalled] = useState(false);
  // null tant que le rendu client n'a pas eu lieu : window/navigator
  // n'existent pas côté serveur, donc rien de tout ceci ne peut être
  // calculé pendant le rendu initial (SSR ou premier passage React).
  const [ios, setIos] = useState<boolean | null>(null);

  useEffect(() => {
    setIos(isIos());

    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    function handleInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (installed || ios === null) return null;
  // Sur iOS, aucune API ne permet de déclencher l'installation par code —
  // on affiche le bouton quand même, mais il ouvre juste l'instruction.
  if (!deferredPrompt && !ios) return null;

  async function handleClick() {
    if (ios && !deferredPrompt) {
      setShowIosHint((v) => !v);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  }

  return (
    <div className={`fixed bottom-5 end-5 z-40 ${className}`}>
      {/* Halo pulsé discret pour attirer l'œil sans être agaçant en continu
          (animation CSS pure, s'arrête après quelques cycles). */}
      <span className="absolute inset-0 -z-10 animate-[ping_2.5s_ease-out_3] rounded-full bg-brand/50" />

      <button
        type="button"
        onClick={handleClick}
        className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand to-brand-dark px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-dark/30 ring-1 ring-white/20 transition-transform hover:scale-105 hover:shadow-xl active:scale-95"
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20 transition-transform group-hover:-translate-y-0.5">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M10 3v9m0 0 3.5-3.5M10 12l-3.5-3.5M4 14.5V16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {LABEL[language]}
      </button>

      {showIosHint && (
        <div className="absolute bottom-full end-0 z-50 mb-3 w-60 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 shadow-xl">
          <p className="mb-1 font-semibold text-ink">{LABEL[language]}</p>
          {IOS_HINT[language]}
        </div>
      )}
    </div>
  );
}
