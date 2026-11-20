import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES, expenseCategoryLabel } from "@/lib/constants/expenses";
import { formatMonthLabel } from "@/lib/constants/months";
import { defaultPeriod, isPeriod, periodOptions, type FixedExpenseLine } from "@/lib/fixed-expenses";
import { schoolYearBounds } from "@/lib/school-year";
import { getLanguage } from "@/lib/i18n/get-language";
import { formatDate } from "@/lib/format";
import { FixedExpensesView } from "./view";

// Dépenses fixes (0045_depenses_fixes.sql) : la liste de l'école et
// l'enregistrement du mois. Le comptable enregistre ; la liste se gère par le
// propriétaire et l'administrateur (même règle que la RLS).
export default async function FixedExpensesPage({
  searchParams,
}: {
  searchParams: { period?: string; error?: string; success?: string };
}) {
  const appUser = await requireRole(["owner", "admin", "accountant"]);
  const language = getLanguage();
  const supabase = createClient();

  const { data: school } = await supabase
    .from("schools")
    .select("currency, school_year_label, school_year_start_month")
    .eq("id", appUser.school_id ?? "")
    .maybeSingle();

  const year = schoolYearBounds(school ?? { school_year_label: null, school_year_start_month: 9 });
  const options = periodOptions(year.from);
  const today = new Date().toISOString().slice(0, 10);
  const period =
    isPeriod(searchParams.period) && options.includes(searchParams.period)
      ? searchParams.period
      : defaultPeriod(options, today);

  const [{ data: lines }, { data: recordedRows }, { data: cashManagers }] = await Promise.all([
    supabase.from("recurring_expenses").select("id, label, category, pay_mode, amount, hourly_rate, internat"),
    supabase
      .from("expenses")
      .select("recurring_expense_id, amount, expense_date, hours")
      .eq("period", period)
      .not("recurring_expense_id", "is", null),
    supabase.from("cash_managers").select("id, name").order("sort_order"),
  ]);

  const recorded = new Map((recordedRows ?? []).map((row) => [row.recurring_expense_id as string, row]));
  // Salaires d'abord, puis l'ordre des catégories de dépenses, puis le nom.
  const rank = (category: string) => EXPENSE_CATEGORIES.findIndex((c) => c.key === category);
  const rows = ((lines ?? []) as FixedExpenseLine[])
    .map((line) => ({
      ...line,
      amount: Number(line.amount),
      hourly_rate: line.hourly_rate == null ? null : Number(line.hourly_rate),
      categoryLabel: expenseCategoryLabel(line.category, language),
      recorded: recorded.has(line.id)
        ? {
            amount: Number(recorded.get(line.id)!.amount),
            date: formatDate(recorded.get(line.id)!.expense_date, language),
            hours: recorded.get(line.id)!.hours == null ? null : Number(recorded.get(line.id)!.hours),
          }
        : null,
    }))
    .sort((a, b) => rank(a.category) - rank(b.category) || a.label.localeCompare(b.label, "fr"));

  return (
    <FixedExpensesView
      language={language}
      currency={school?.currency ?? "XOF"}
      period={period}
      periods={options.map((key) => ({ key, label: formatMonthLabel(key, language) }))}
      rows={rows}
      cashManagers={cashManagers ?? []}
      canManage={appUser.role === "owner" || appUser.role === "admin" || appUser.role === "super_admin"}
      today={today}
      error={searchParams.error}
      success={searchParams.success}
    />
  );
}
