import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { loadManagerStatement } from "@/lib/reports/manager-statement";
import { renderManagerStatementPdf } from "@/lib/reports/pdf/manager-statement";
import { fetchPdfLogo } from "@/lib/pdf/logo";

// @react-pdf/renderer s'appuie sur des API Node (streams, Buffer) : le
// runtime Edge par défaut ne suffit pas.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Relevé de caisse d'un responsable en PDF : mêmes droits et mêmes lignes que
// la page /dashboard/payments/by-manager.
// ?manager=<id> ou ?manager=none, ?from&to obligatoires.
export async function GET(request: NextRequest) {
  const appUser = await requireRole(["owner", "admin", "accountant"]);
  const supabase = createClient();

  const { searchParams } = new URL(request.url);
  const managerParam = searchParams.get("manager") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const unassigned = managerParam === "none";

  if ((!unassigned && !UUID.test(managerParam)) || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return NextResponse.json({ error: "Paramètres manager, from et to requis." }, { status: 400 });
  }

  const [{ data: school }, { data: managers }] = await Promise.all([
    supabase
      .from("schools")
      .select("name, address, phone, email, currency, logo_url")
      .eq("id", appUser.school_id ?? "")
      .maybeSingle(),
    supabase.from("cash_managers").select("id, name").order("sort_order"),
  ]);
  const manager = unassigned ? null : (managers ?? []).find((m) => m.id === managerParam) ?? null;
  // Responsable inconnu, ou d'une autre école (invisible par la RLS).
  if (!unassigned && !manager) {
    return NextResponse.json({ error: "Responsable introuvable." }, { status: 404 });
  }

  const [statement, logo] = await Promise.all([
    loadManagerStatement(supabase, managerParam, managers ?? [], from, to),
    fetchPdfLogo(school?.logo_url),
  ]);

  // Le rendu PDF dépend de ressources résolues à l'exécution : une panne se
  // manifesterait sinon par un 500 muet. On journalise côté serveur et on
  // renvoie un message lisible.
  let pdf: Buffer;
  try {
    pdf = await renderManagerStatementPdf({
      school: {
        name: school?.name ?? "École",
        address: school?.address ?? null,
        phone: school?.phone ?? null,
        email: school?.email ?? null,
        logo,
      },
      currency: school?.currency ?? "XOF",
      managerName: manager?.name ?? null,
      from,
      to,
      statement,
      generatedAt: new Date(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[releve-caisse-pdf] échec du rendu", error);
    return NextResponse.json({ error: "Génération du PDF impossible.", detail: message }, { status: 500 });
  }

  const slug = (manager?.name ?? "non-attribue")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `inline` : le relevé s'ouvre dans l'onglet, l'école le lit avant de
      // décider de l'enregistrer ou de l'imprimer.
      "Content-Disposition": `inline; filename="releve-caisse-${slug || "responsable"}-${from}-au-${to}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
