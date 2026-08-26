export type Language = "fr" | "ar";

export const DEFAULT_LANGUAGE: Language = "fr";
export const LANGUAGE_COOKIE = "bc_lang";

export function dirOf(language: Language): "ltr" | "rtl" {
  return language === "ar" ? "rtl" : "ltr";
}

export function isLanguage(value: string | undefined | null): value is Language {
  return value === "fr" || value === "ar";
}
