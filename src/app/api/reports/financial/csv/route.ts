import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { computeFinancialReport, computeDailyBreakdown, computeCashManagerBreakdown } from "@/lib/reports/financial";
import { computePeriodReceivables } from "@/lib/reports/collections";
import { toCsvRow, buildCsvResponse } from "@/lib/reports/csv";

// Journal de caisse de la période : mêmes chiffres que l'écran et le PDF.
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

  const [report, dailyBreakdown, cashManagerBreakdown, receivables, { count: studentCount }] = await Promise.all([
    computeFinancialReport(supabase, from, to),
    computeDailyBreakdown(supabase, from, to),
    computeCashManagerBreakdown(supabase, from, to),
    computePeriodReceivables(supabase, from, to),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);
  const collectedOf = (key: string) => report.revenueByType.find((r) => r.key === key)?.collected ?? 0;

  const lines: string[] = [];
  lines.push(toCsvRow([`Rapport financier — ${school?.name ?? ""}`]));
  lines.push(toCsvRow([`Période : ${from} au ${to}`]));
  lines.push("");

  lines.push(toCsvRow(["Synthèse"]));
  lines.push(toCsvRow(["Élèves (actifs aujourd'hui)", studentCount ?? 0]));
  lines.push(toCsvRow(["Recettes encaissées", report.totalCollected]));
  lines.push(toCsvRow(["Inscription encaissée", collectedOf("inscription")]));
  lines.push(toCsvRow(["Uniforme encaissé", collectedOf("uniforme")]));
  lines.push(toCsvRow(["Dépenses", report.totalExpenses]));
  lines.push(toCsvRow(["Solde de caisse", report.balance]));
  lines.push(toCsvRow(["Montant à recouvrir", receivables.totalDue]));
  lines.push(toCsvRow(["Élèves impayés", receivables.overdueStudentCount]));
  lines.push("");

  lines.push(toCsvRow(["Recettes par type"]));
  lines.push(toCsvRow(["Type", "Encaissé"]));
  for (const bucket of report.revenueByType) {
    lines.push(toCsvRow([bucket.label, bucket.collected]));
  }
  lines.push(toCsvRow(["Total", report.totalCollected]));
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

  if (report.expensesByCategory.length > 0) {
    lines.push(toCsvRow(["Détail des dépenses"]));
    lines.push(toCsvRow(["Date", "Catégorie", "Description", "Montant"]));
    for (const category of report.expensesByCategory) {
      for (const item of category.items) {
        lines.push(toCsvRow([item.date.split("-").reverse().join("/"), category.label, item.label, item.amount]));
      }
    }
    lines.push(toCsvRow(["Total", "", "", report.totalExpenses]));
    lines.push("");
  }

  lines.push(toCsvRow(["Détail journalier"]));
  lines.push(toCsvRow(["Date", "Recettes", "Dépenses", "Solde du jour", "Cumul"]));
  for (const day of dailyBreakdown) {
    lines.push(toCsvRow([day.label, day.recettes, day.depenses, day.solde, day.cumul]));
  }
  lines.push(toCsvRow(["Total", report.totalCollected, report.totalExpenses, report.balance, report.balance]));

  return buildCsvResponse(lines, `rapport-financier-${from}-au-${to}.csv`);
}
