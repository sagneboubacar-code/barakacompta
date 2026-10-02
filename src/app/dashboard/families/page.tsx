import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createFamily } from "@/lib/actions/families";
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardFamiliesDict } from "@/lib/i18n/dictionaries/dashboard-families";

export default async function FamiliesPage({
  searchParams,
}: {
  searchParams: { q?: string; error?: string; success?: string };
}) {
  const appUser = await requireRole(["owner", "admin"]);
  const language = getLanguage();
  const t = dashboardFamiliesDict[language];
  const supabase = createClient();

  let query = supabase
    .from("families")
    .select("id, name, guardian_name, guardian_phone, free_student_id, free_year")
    .order("name");

  const q = searchParams.q?.trim().replace(/[,()%]/g, "");
  if (q) {
    query = query.or(`name.ilike.%${q}%,guardian_name.ilike.%${q}%,guardian_phone.ilike.%${q}%`);
  }

  const [{ data: families }, { data: members }, { data: school }] = await Promise.all([
    query,
    supabase.from("students").select("id, first_name, last_name, family_id, status").not("family_id", "is", null),
    supabase.from("schools").select("school_year_label").eq("id", appUser.school_id ?? "").maybeSingle(),
  ]);

  const activeCount = new Map<string, number>();
  const studentName = new Map<string, string>();
  for (const member of members ?? []) {
    studentName.set(member.id, `${member.last_name} ${member.first_name}`);
    if (member.status === "active" && member.family_id) {
      activeCount.set(member.family_id, (activeCount.get(member.family_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t.pageTitle}</h1>
        <p className="text-sm text-slate-500">{t.pageSubtitle}</p>
      </div>

      {searchParams.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}
      {searchParams.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{searchParams.success}</p>
      )}

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.filterSearchLabel}</span>
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder={t.filterSearchPlaceholder}
            className="w-64 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.filterSubmit}
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{t.colFamily}</th>
              <th className="px-4 py-2 font-medium">{t.colGuardian}</th>
              <th className="px-4 py-2 font-medium">{t.colPhone}</th>
              <th className="px-4 py-2 font-medium">{t.colChildren}</th>
              <th className="px-4 py-2 font-medium">{t.colFree}</th>
            </tr>
          </thead>
          <tbody>
            {(families ?? []).map((family) => {
              const count = activeCount.get(family.id) ?? 0;
              return (
                <tr key={family.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/families/${family.id}`} className="text-slate-900 underline">
                      {family.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{family.guardian_name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {family.guardian_phone ? (
                      <a href={`tel:${family.guardian_phone}`} className="underline">
                        {family.guardian_phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{count}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {family.free_student_id && family.free_year === school?.school_year_label ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {studentName.get(family.free_student_id) ?? "—"}
                      </span>
                    ) : (
                      t.noFree
                    )}
                  </td>
                </tr>
              );
            })}
            {(families ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  {t.noResults}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">{t.addSummary}</summary>
        <form action={createFamily} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formName}</span>
            <input
              name="name"
              required
              placeholder={t.formNamePlaceholder}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formGuardianName}</span>
            <input name="guardian_name" className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formGuardianPhone}</span>
            <input name="guardian_phone" className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
          </label>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              {t.addSubmit}
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
