"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_COOKIE, dirOf, type Language } from "./config";

type LanguageContextValue = {
  language: Language;
  dir: "ltr" | "rtl";
  setLanguage: (language: Language) => void;
  pending: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: Language;
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function setLanguage(next: Language) {
    if (next === language) return;
    document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = next;
    document.documentElement.dir = dirOf(next);
    setLanguageState(next);
    // Les pages dashboard sont des Server Components qui lisent le cookie :
    // un refresh re-render leur contenu déjà traduit avec la nouvelle langue.
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <LanguageContext.Provider value={{ language, dir: dirOf(language), setLanguage, pending }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage doit être utilisé dans LanguageProvider");
  return ctx;
}
