import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { computeCollectionsReport } from "@/lib/reports/collections";
import { renderCollectionsReportPdf } from "@/lib/reports/pdf/collections-report";
import { formatMonthLabel } from "@/lib/constants/months";
import { cycleLabel } from "@/lib/constants/cycles";
import { fetchPdfLogo } from "@/lib/pdf/logo";

// @react-pdf/renderer s'appuie sur des API Node (streams, Buffer).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Même calcul et mêmes filtres que la page Recouvrement et son export Excel.
export async function GET(request: NextRequest) {
  const appUser = await requireRole(["owner", "admin"]);
  const supabase = createClient();

  const { searchParams } = new URL(request.url);
  const cycle = searchParams.get("cycle") || undefined;
  const classId = searchParams.get("class_id") || undefined;
  const month = searchParams.get("month") || undefined;

  const [{ data: school }, report, { data: klass }] = await Promise.all([
    supabase
      .from("schools")
      .select("name, address, phone, email, currency, logo_url")
      .eq("id", appUser.school_id ?? "")
      .maybeSingle(),
    computeCollectionsReport(supabase, { cycle, classId, month }, "fr"),
    classId ? supabase.from("classes").select("name").eq("id", classId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const filtersLabel = klass?.name ? `Classe ${klass.name}` : cycle ? `Cycle ${cycleLabel(cycle, "fr")}` : "";
  const monthLabel = formatMonthLabel(report.selectedMonth, "fr");
  const logo = await fetchPdfLogo(school?.logo_url);

  // Une panne du rendu (polices résolues à l'exécution) se manifesterait
  // sinon par un 500 muet : on journalise et on renvoie un message lisible.
  let pdf: Buffer;
  try {
    pdf = await renderCollectionsReportPdf({
      school: {
        name: school?.name ?? "École",
        address: school?.address ?? null,
        phone: school?.phone ?? null,
        email: school?.email ?? null,
        currency: school?.currency ?? "XOF",
        logo,
      },
      monthLabel,
      filtersLabel,
      report,
      generatedAt: new Date(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[recouvrement-pdf] échec du rendu", error);
    return NextResponse.json({ error: "Génération du PDF impossible.", detail: message }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="etat-recouvrement-${report.selectedMonth}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
