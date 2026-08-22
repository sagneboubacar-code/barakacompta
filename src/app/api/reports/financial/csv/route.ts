import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { computeFinancialReport, computeDailyBreakdown, computeCashManagerBreakdown } from "@/lib/reports/financial";
import { toCsvRow, buildCsvResponse } from "@/lib/reports/csv";

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
    .select("name")
    .eq("id", appUser.school_id ?? "")
    .maybeSingle();

  const [report, dailyBreakdown, cashManagerBreakdown] = await Promise.all([
    computeFinancialReport(supabase, from, to),
    computeDailyBreakdown(supabase, from, to),
    computeCashManagerBreakdown(supabase, from, to),
  ]);

  const lines: string[] = [];
  lines.push(toCsvRow([`Rapport financier — ${school?.name ?? ""}`]));
  lines.push(toCsvRow([`Période : ${from} au ${to}`]));
  lines.push("");

  lines.push(toCsvRow(["Recettes détaillées"]));
  lines.push(toCsvRow(["Type", "Attendu", "Encaissé", "Reste"]));
  for (const bucket of report.revenueByType) {
    lines.push(toCsvRow([bucket.label, bucket.expected, bucket.collected, bucket.remaining]));
  }
  lines.push(toCsvRow(["Total", report.totalExpected, report.totalCollected, report.totalRemaining]));
  lines.push("");

  lines.push(toCsvRow(["Dépenses par catégorie"]));
  lines.push(toCsvRow(["Catégorie", "Montant"]));
  for (const category of report.expensesByCategory) {
    lines.push(toCsvRow([category.label, category.amount]));
  }
  lines.push(toCsvRow(["Total", report.totalExpenses]));
  lines.push("");

  if (cashManagerBreakdown.length > 0) {
    lines.push(toCsvRow(["Par responsable"]));
    lines.push(toCsvRow(["Responsable", "Recette", "Dépense", "Solde"]));
    for (const manager of cashManagerBreakdown) {
      lines.push(toCsvRow([manager.name, manager.collected, manager.spent, manager.solde]));
    }
    lines.push(
      toCsvRow(["Compta finale — école", report.totalCollected, report.totalExpenses, report.balance])
    );
    lines.push("");
  }

  lines.push(toCsvRow(["Détail journalier"]));
  lines.push(toCsvRow(["Date", "Recettes", "Dépenses", "Solde"]));
  for (const day of dailyBreakdown) {
    lines.push(toCsvRow([day.label, day.recettes, day.depenses, day.solde]));
  }
  lines.push(
    toCsvRow([
      "Total",
      dailyBreakdown.reduce((sum, d) => sum + d.recettes, 0),
      dailyBreakdown.reduce((sum, d) => sum + d.depenses, 0),
      dailyBreakdown.reduce((sum, d) => sum + d.solde, 0),
    ])
  );
  lines.push("");

  lines.push(toCsvRow(["Résumé"]));
  lines.push(toCsvRow(["Montant attendu", report.totalExpected]));
  lines.push(toCsvRow(["Montant encaissé", report.totalCollected]));
  lines.push(toCsvRow(["Montant à recouvrer", report.totalRemaining]));
  lines.push(toCsvRow(["Total dépenses", report.totalExpenses]));
  lines.push(toCsvRow(["Solde (recettes − dépenses)", report.balance]));

  return buildCsvResponse(lines, `rapport-financier-${from}-au-${to}.csv`);
}
