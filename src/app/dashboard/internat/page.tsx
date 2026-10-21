import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { computeInternatReport } from "@/lib/reports/internat";
import { schoolYearBounds } from "@/lib/school-year";
import { getLanguage } from "@/lib/i18n/get-language";
import { InternatView } from "./view";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Bilan de l'internat (voir lib/reports/internat.ts). Par défaut, l'exercice
// entier (septembre → août) : l'internat se paie les 12 mois.
export default async function InternatPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const appUser = await requireRole(["owner", "admin"]);
  const language = getLanguage();
  const supabase = createClient();

  const { data: school } = await supabase
    .from("schools")
    .select("currency, school_year_label, school_year_start_month")
    .eq("id", appUser.school_id ?? "")
    .maybeSingle();

  const year = schoolYearBounds(school ?? { school_year_label: null, school_year_start_month: 9 });
  const from = ISO_DATE.test(searchParams.from ?? "") ? searchParams.from! : year.from;
  const to = ISO_DATE.test(searchParams.to ?? "") ? searchParams.to! : year.to;

  const report = await computeInternatReport(supabase, from, to, language);

  return (
    <InternatView
      language={language}
      currency={school?.currency ?? "XOF"}
      report={report}
      yearFrom={year.from}
      yearTo={year.to}
    />
  );
}
