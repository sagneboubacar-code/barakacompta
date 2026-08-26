import { cookies } from "next/headers";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, isLanguage, type Language } from "./config";

// Server-only : lit la langue choisie côté cookie pour les Server Components
// (SSR sans flash, y compris les pages dashboard qui ne passent pas par le
// contexte client). Le bouton de bascule écrit dans ce même cookie.
export function getLanguage(): Language {
  const value = cookies().get(LANGUAGE_COOKIE)?.value;
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}
