import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Space_Grotesk, Tajawal } from "next/font/google";
import { getLanguage } from "@/lib/i18n/get-language";
import { dirOf } from "@/lib/i18n/config";
import { LanguageProvider } from "@/lib/i18n/language-provider";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "600", "700"],
  display: "swap",
});
// Ajoutée en secours dans les piles sans-serif/display (tailwind.config.ts) :
// les caractères latins restent rendus par Geist/Space Grotesk, les
// caractères arabes basculent automatiquement sur cette police au niveau
// glyphe, sans logique conditionnelle côté JS.
const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  variable: "--font-tajawal",
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Baraka Compta — Comptabilité scolaire",
  description: "Gestion financière et comptable pour établissements scolaires.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Baraka Compta",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E7C5A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = getLanguage();

  return (
    <html lang={language} dir={dirOf(language)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${tajawal.variable} antialiased`}
      >
        <LanguageProvider initialLanguage={language}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
