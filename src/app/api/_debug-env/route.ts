import { NextResponse } from "next/server";

// Route de diagnostic temporaire — ne révèle jamais la valeur des clés,
// seulement leur longueur et la position d'un éventuel caractère invalide
// (> 255, incompatible avec un header HTTP). À supprimer après usage.
function inspect(name: string) {
  const value = process.env[name];
  if (value === undefined) return { name, present: false };
  const badIndex = [...value].findIndex((c) => c.charCodeAt(0) > 255);
  return {
    name,
    present: true,
    length: value.length,
    startsWithEyJ: value.startsWith("eyJ"),
    firstCharCode: value.charCodeAt(0),
    lastCharCode: value.charCodeAt(value.length - 1),
    hasTrailingWhitespace: /\s$/.test(value),
    hasLeadingWhitespace: /^\s/.test(value),
    invalidCharIndex: badIndex,
    invalidCharCode: badIndex >= 0 ? value.charCodeAt(badIndex) : null,
  };
}

export async function GET() {
  return NextResponse.json({
    url: inspect("NEXT_PUBLIC_SUPABASE_URL"),
    anon: inspect("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    service: inspect("SUPABASE_SERVICE_ROLE_KEY"),
  });
}
