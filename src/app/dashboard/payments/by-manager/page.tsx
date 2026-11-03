import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { loadManagerStatement } from "@/lib/reports/manager-statement";
import { schoolYearBounds } from "@/lib/school-year";
import { getLanguage } from "@/lib/i18n/get-language";
import { ManagerPaymentsView } from "./view";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Relevé de caisse d'un responsable, à l'écran (voir
// lib/reports/manager-statement.ts) ; le même en PDF sous
// /api/reports/manager/pdf.
//
// ?manager=<id> ou ?manager=none (« Non attribué ») ; ?from&to optionnels
// (période du rapport), sinon l'année scolaire comme le tableau de bord.
export default async function ManagerPaymentsPage({
  searchParams,
}: {
  searchParams: { manager?: string; from?: string; to?: string };
}) {
  const appUser = await requireRole(["owner", "admin", "accountant"]);
  const language = getLanguage();
  const supabase = createClient();
  const canEdit = appUser.role === "owner" || appUser.role === "admin";

  const managerParam = searchParams.manager ?? "";
  const unassigned = managerParam === "none";
  if (!unassigned && !UUID.test(managerParam)) notFound();

  const [{ data: school }, { data: managers }] = await Promise.all([
    supabase
      .from("schools")
      .select("currency, school_year_label, school_year_start_month, school_year_end_month")
      .eq("id", appUser.school_id ?? "")
      .maybeSingle(),
    supabase.from("cash_managers").select("id, name").order("sort_order"),
  ]);
  const manager = unassigned ? null : (managers ?? []).find((m) => m.id === managerParam) ?? null;
  // Responsable inconnu, ou d'une autre école (invisible par la RLS).
  if (!unassigned && !manager) notFound();

  const fromReport = ISO_DATE.test(searchParams.from ?? "") && ISO_DATE.test(searchParams.to ?? "");
  const year = schoolYearBounds(
    school ?? { school_year_label: null, school_year_start_month: 9, school_year_end_month: 6 }
  );
  const from = fromReport ? searchParams.from! : year.from;
  const to = fromReport ? searchParams.to! : year.to;

  const statement = await loadManagerStatement(supabase, managerParam, managers ?? [], from, to);

  return (
    <ManagerPaymentsView
      language={language}
      managerId={unassigned ? "none" : managerParam}
      managerName={manager?.name ?? null}
      managers={managers ?? []}
      from={from}
      to={to}
      currency={school?.currency ?? "XOF"}
      statement={statement}
      canEdit={canEdit}
      fromReport={fromReport}
    />
  );
}
