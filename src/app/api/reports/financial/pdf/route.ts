import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  computeFinancialReport,
  computeDailyBreakdown,
  computeCashManagerBreakdown,
} from "@/lib/reports/financial";
import { renderFinancialReportPdf } from "@/lib/reports/pdf/financial-report";
import { fetchPdfLogo } from "@/lib/pdf/logo";

// @react-pdf/renderer s'appuie sur des API Node (streams, Buffer) : le
// runtime Edge par défaut ne suffit pas.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const appUser = await requireRole(["owner", "admin"]);
  const supabase = createClient();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Paramètres from/to requis." }, { status: 400 });
  }

  const { data: school } = await supabase
    .from("schools")
    .select("name, address, phone, email, currency, logo_url")
    .eq("id", appUser.school_id ?? "")
    .maybeSingle();

  const [report, dailyBreakdown, cashManagerBreakdown, logo] = await Promise.all([
    computeFinancialReport(supabase, from, to),
    computeDailyBreakdown(supabase, from, to),
    computeCashManagerBreakdown(supabase, from, to),
    fetchPdfLogo(school?.logo_url),
  ]);

  // Le rendu PDF dépend de ressources résolues à l'exécution : une panne se
  // manifesterait sinon par un 500 muet, impossible à diagnostiquer depuis
  // l'école. On journalise côté serveur et on renvoie un message lisible.
  let pdf: Buffer;
  try {
    pdf = await renderFinancialReportPdf({
      school: {
        name: school?.name ?? "École",
        address: school?.address ?? null,
        phone: school?.phone ?? null,
        email: school?.email ?? null,
        logo,
      },
      currency: school?.currency ?? "XOF",
      from,
      to,
      report,
      dailyBreakdown,
      cashManagerBreakdown,
      generatedAt: new Date(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[rapport-pdf] échec du rendu", error);
    return NextResponse.json(
      { error: "Génération du PDF impossible.", detail: message },
      { status: 500 }
    );
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `inline` : le rapport s'ouvre dans l'onglet, l'école le lit avant de
      // décider de l'enregistrer ou de l'imprimer.
      "Content-Disposition": `inline; filename="rapport-financier-${from}-au-${to}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
