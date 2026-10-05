import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { computeCollectionsReport } from "@/lib/reports/collections";
import { formatMonthLabel } from "@/lib/constants/months";
import { toCsvRow, buildCsvResponse } from "@/lib/reports/csv";

export async function GET(request: NextRequest) {
  const appUser = await requireRole(["owner", "admin"]);
  const supabase = createClient();

  const { searchParams } = new URL(request.url);
  const cycle = searchParams.get("cycle") ?? undefined;
  const classId = searchParams.get("class_id") ?? undefined;
  const month = searchParams.get("month") ?? undefined;

  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", appUser.school_id ?? "")
    .maybeSingle();

  const report = await computeCollectionsReport(supabase, { cycle, classId, month });

  const lines: string[] = [];
  lines.push(toCsvRow([`Recouvrement — ${school?.name ?? ""}`]));
  lines.push(toCsvRow([`Mois : ${formatMonthLabel(report.selectedMonth)}`]));
  lines.push("");

  lines.push(
    toCsvRow(["Élève", "Classe", "Cycle", "Parent", "Téléphone parent", "Reste à payer", "Dont en retard", "Statut"])
  );
  const statusLabels: Record<string, string> = {
    vert: "À jour",
    orange: "Partiel, en retard",
    rouge: "Impayé",
    attente: "À payer",
  };
  for (const row of report.rows) {
    lines.push(
      toCsvRow([
        row.name,
        row.className,
        row.cycle,
        row.guardianName,
        row.guardianPhone,
        row.totalRemaining,
        row.overdueRemaining,
        statusLabels[row.colorStatus],
      ])
    );
  }
  lines.push("");
  lines.push(toCsvRow(["Élèves en retard", report.overdueCount]));
  lines.push(toCsvRow(["Recette totale du mois (si tous les élèves paient)", report.expectedTotal]));
  lines.push(toCsvRow(["Déjà encaissé", report.collectedTotal]));
  lines.push(toCsvRow(["Reste à encaisser", report.totalDue]));
  lines.push(toCsvRow(["Dont déjà en retard", report.overdueTotal]));
  lines.push(toCsvRow(["Dont à payer (échéance pas encore passée)", report.upcomingTotal]));

  return buildCsvResponse(lines, `recouvrement-${report.selectedMonth}.csv`);
}
