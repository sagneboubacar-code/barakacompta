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
    toCsvRow(["Élève", "Classe", "Cycle", "Parent", "Téléphone parent", "Montant restant", "Statut"])
  );
  const statusLabels: Record<string, string> = { vert: "À jour", orange: "Partiel ce mois", rouge: "Impayé" };
  for (const row of report.rows) {
    lines.push(
      toCsvRow([
        row.name,
        row.className,
        row.cycle,
        row.guardianName,
        row.guardianPhone,
        row.totalRemaining,
        statusLabels[row.colorStatus],
      ])
    );
  }
  lines.push("");
  lines.push(toCsvRow(["Élèves impayés", report.overdueCount]));
  lines.push(toCsvRow(["Total restant dû", report.totalDue]));

  return buildCsvResponse(lines, `recouvrement-${report.selectedMonth}.csv`);
}
