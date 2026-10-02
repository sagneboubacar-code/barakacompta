import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  attachStudentsToFamily,
  deleteFamily,
  detachStudentFromFamily,
  setFamilyFree,
  updateFamily,
} from "@/lib/actions/families";
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardFamiliesDict } from "@/lib/i18n/dictionaries/dashboard-families";
import { formatCurrency } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { AttachStudentsList } from "@/components/AttachStudentsList";

// Comparaison de noms insensible à la casse et aux accents (« Diop » = « DIOP »).
function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const clean = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return !!a && !!b && clean(a) === clean(b);
}

export default async function FamilyDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { q?: string; error?: string; success?: string };
}) {
  const appUser = await requireRole(["owner", "admin"]);
  const language = getLanguage();
  const t = dashboardFamiliesDict[language];
  const supabase = createClient();

  const { data: family } = await supabase
    .from("families")
    .select("id, name, guardian_name, guardian_phone, free_student_id, free_year, free_from_start")
    .eq("id", params.id)
    .maybeSingle();

  // Même logique que la fiche élève : la RLS rend invisible une famille
  // d'une autre école, traitée comme un accès non autorisé.
  if (!family) {
    redirect("/unauthorized");
  }

  const { data: school } = await supabase
    .from("schools")
    .select("school_year_label, currency")
    .eq("id", appUser.school_id ?? "")
    .maybeSingle();
  const year = school?.school_year_label ?? "";

  // Élèves à rattacher : la recherche porte sur toute l'école ; sans
  // recherche, on propose les élèves sans famille qui partagent le nom ou le
  // téléphone du parent avec cette famille.
  const q = searchParams.q?.trim().replace(/[,()%]/g, "") ?? "";
  const candidateFields =
    "id, first_name, last_name, matricule, guardian_phone, status, family_id, classes(name)" as const;
  let candidatesQuery = supabase.from("students").select(candidateFields).order("last_name");
  if (q) {
    // « Awa Diop » : chaque mot doit se retrouver dans le prénom, le nom ou le matricule.
    for (const word of q.split(/\s+/)) {
      candidatesQuery = candidatesQuery.or(
        `first_name.ilike.%${word}%,last_name.ilike.%${word}%,matricule.ilike.%${word}%`
      );
    }
    candidatesQuery = candidatesQuery.limit(50);
  } else {
    candidatesQuery = candidatesQuery.is("family_id", null);
  }

  const [{ data: children }, { data: fees }, { data: rawCandidates }, { data: otherFamilies }] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name, class_id, regime, status, guardian_phone, classes(name)")
      .eq("family_id", family.id),
    supabase
      .from("fee_structures")
      .select("class_id, regime, amount")
      .eq("academic_year", year)
      .in("fee_type", ["inscription", "mensualite"]),
    candidatesQuery,
    supabase.from("families").select("id, name"),
  ]);

  const familyPhones = new Set(
    [family.guardian_phone, ...(children ?? []).map((c) => c.guardian_phone)]
      .map((phone) => normalizePhone(phone))
      .filter((phone): phone is string => !!phone)
  );
  const familyNames = [family.name, ...(children ?? []).map((c) => c.last_name)];
  const candidates = (rawCandidates ?? []).filter((student) => {
    if (student.family_id === family.id) return false;
    if (q) return true;
    const phone = normalizePhone(student.guardian_phone);
    return (phone && familyPhones.has(phone)) || familyNames.some((name) => sameName(name, student.last_name));
  });
  const familyNameById = new Map((otherFamilies ?? []).map((f) => [f.id, f.name]));

  // Frais annuels de chaque enfant d'après la grille de sa classe : aide
  // l'école à choisir l'enfant qu'elle prend en charge.
  const tuitionByGrid = new Map<string, number>();
  for (const fee of fees ?? []) {
    const key = `${fee.class_id}|${fee.regime}`;
    tuitionByGrid.set(key, (tuitionByGrid.get(key) ?? 0) + Number(fee.amount));
  }
  const tuitionOf = (child: { class_id: string | null; regime: string }) =>
    child.class_id ? tuitionByGrid.get(`${child.class_id}|${child.regime}`) ?? 0 : 0;
  const money = (amount: number) => formatCurrency(amount, school?.currency, language);

  const byName = (a: { last_name: string; first_name: string }, b: { last_name: string; first_name: string }) =>
    a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);
  const active = (children ?? []).filter((c) => c.status === "active").sort((a, b) => tuitionOf(b) - tuitionOf(a) || byName(a, b));
  const inactive = (children ?? []).filter((c) => c.status !== "active").sort(byName);

  const freeChild = (children ?? []).find((c) => c.id === family.free_student_id);
  // Une prise en charge vaut pour une année scolaire : celle d'une année
  // précédente ne couvre rien aujourd'hui, l'école doit la reconfirmer.
  const freeThisYear = !!freeChild && family.free_year === year;
  const fullName = (c: { last_name: string; first_name: string }) => `${c.last_name} ${c.first_name}`;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/families" className="text-sm text-slate-500 underline">
        {t.backToList}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{t.familyTitle(family.name)}</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/payments?mode=family&family_id=${family.id}`}
            className="rounded-md bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {t.collectPayment}
          </Link>
          <a
            href="#rattacher"
            className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {t.attachExisting}
          </a>
          <Link
            href={`/dashboard/students?add_family=${family.id}#ajout`}
            className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t.addChild}
          </Link>
        </div>
      </div>

      {searchParams.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}
      {searchParams.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{searchParams.success}</p>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t.sectionChildren}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[520px] w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 font-medium">{t.colStudent}</th>
                <th className="py-1 font-medium">{t.colClass}</th>
                <th className="py-1 font-medium">{t.colYearFees}</th>
                <th className="py-1 font-medium">{t.colStatus}</th>
                <th className="py-1 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {[...active, ...inactive].map((child) => {
                const klass = Array.isArray(child.classes) ? child.classes[0] : child.classes;
                const isFree = freeThisYear && child.id === family.free_student_id;
                return (
                  <tr key={child.id} className={`border-t border-slate-100 ${isFree ? "bg-emerald-50/60" : ""}`}>
                    <td className="py-1.5">
                      <Link href={`/dashboard/students/${child.id}`} className="text-slate-900 underline">
                        {fullName(child)}
                      </Link>
                      {isFree && (
                        <span className="ms-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          {t.badgeFree}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-slate-600">{klass?.name ?? "—"}</td>
                    <td className="py-1.5 text-slate-600">{money(tuitionOf(child))}</td>
                    <td className="py-1.5 text-slate-600">
                      {child.status === "active" ? t.statusActive : t.statusInactive}
                    </td>
                    <td className="py-1.5 text-end">
                      <form action={detachStudentFromFamily}>
                        <input type="hidden" name="id" value={family.id} />
                        <input type="hidden" name="student_id" value={child.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          {t.detach}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {(children ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-xs text-slate-400">
                    {t.noChildren}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="rattacher" className="scroll-mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t.sectionAttach}</h2>
        <p className="mt-1 text-xs text-slate-600">{t.attachExplain}</p>

        <form
          method="get"
          action={`/dashboard/families/${family.id}#rattacher`}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder={t.attachSearchPlaceholder}
            className="w-64 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            {t.attachSearch}
          </button>
        </form>

        <p className="mt-4 text-xs font-medium text-slate-500">{q ? t.resultsTitle(q) : t.suggestionsTitle}</p>
        {candidates.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">{q ? t.noResultsSearch : t.noSuggestions}</p>
        ) : (
          <form action={attachStudentsToFamily} className="mt-2">
            <input type="hidden" name="id" value={family.id} />
            <AttachStudentsList
              key={q}
              candidates={candidates.map((student) => {
                const klass = Array.isArray(student.classes) ? student.classes[0] : student.classes;
                const otherFamily = student.family_id ? familyNameById.get(student.family_id) : undefined;
                return {
                  id: student.id,
                  name: `${student.last_name} ${student.first_name}`,
                  details: [student.matricule, klass?.name, student.guardian_phone].filter(Boolean).join(" · "),
                  badges: [
                    ...(otherFamily ? [{ text: t.inOtherFamily(otherFamily), tone: "amber" as const }] : []),
                    ...(student.status !== "active" ? [{ text: t.inactiveNote, tone: "slate" as const }] : []),
                  ],
                };
              })}
              labels={{
                hint: t.attachCheckHint,
                submitNone: t.attachSubmitNone,
                submitOne: t.attachSubmitOne,
                submitMany: t.attachSubmitMany,
              }}
            />
          </form>
        )}
      </section>

      <section
        className={`rounded-lg border p-4 ${
          freeThisYear ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
        }`}
      >
        <h2 className="text-sm font-semibold text-slate-900">{t.sectionFree}</h2>
        <p className="mt-1 text-sm font-medium text-slate-800">
          {freeThisYear && freeChild
            ? t.freeStatus(fullName(freeChild), year)
            : freeChild && family.free_year
              ? t.previousYear(fullName(freeChild), family.free_year)
              : t.noFreeStatus}
        </p>
        <p className="mt-2 text-xs text-slate-600">{t.freeExplain}</p>

        {active.length > 0 && (
          <form action={setFamilyFree} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={family.id} />
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">{t.formChild}</span>
              <select
                name="student_id"
                defaultValue={freeThisYear ? family.free_student_id ?? "" : ""}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">{t.formChildNone}</option>
                {active.map((child) => {
                  const klass = Array.isArray(child.classes) ? child.classes[0] : child.classes;
                  return (
                    <option key={child.id} value={child.id}>
                      {fullName(child)}
                      {klass?.name ? ` — ${klass.name}` : ""} — {money(tuitionOf(child))}
                    </option>
                  );
                })}
              </select>
            </label>
            <fieldset className="space-y-1 text-sm">
              <legend className="text-slate-600">{t.formScope}</legend>
              <div className="flex flex-wrap gap-4 pt-1.5">
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="radio"
                    name="scope"
                    value="year"
                    defaultChecked={!freeThisYear || family.free_from_start}
                  />
                  {t.scopeYear}
                </label>
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="radio"
                    name="scope"
                    value="today"
                    defaultChecked={freeThisYear && !family.free_from_start}
                  />
                  {t.scopeToday}
                </label>
              </div>
            </fieldset>
            <p className="text-xs text-slate-500 sm:col-span-2">{t.scopeHint}</p>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                {t.saveFree}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t.sectionEdit}</h2>
        <form action={updateFamily} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input type="hidden" name="id" value={family.id} />
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formName}</span>
            <input
              name="name"
              required
              defaultValue={family.name}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formGuardianName}</span>
            <input
              name="guardian_name"
              defaultValue={family.guardian_name ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.formGuardianPhone}</span>
            <input
              name="guardian_phone"
              defaultValue={family.guardian_phone ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              {t.save}
            </button>
          </div>
        </form>
        <form action={deleteFamily} className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <input type="hidden" name="id" value={family.id} />
          <p className="flex-1 text-xs text-slate-600">{t.deleteExplain}</p>
          <button
            type="submit"
            className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            {t.deleteSubmit}
          </button>
        </form>
      </section>
    </div>
  );
}
