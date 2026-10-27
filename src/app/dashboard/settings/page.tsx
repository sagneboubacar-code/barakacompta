import Image from "next/image";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { updateSchoolInfo, updateSchoolYear, uploadSchoolLogo } from "@/lib/actions/school";
import { createClass, deleteClass, updateClass } from "@/lib/actions/classes";
import { createCashManager, deleteCashManager, updateCashManager } from "@/lib/actions/cashManagers";
import { CYCLES, cycleLabel } from "@/lib/constants/cycles";
import { monthNames } from "@/lib/constants/months";
import { InviteTeamMemberForm } from "@/components/InviteTeamMemberForm";
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardSettingsDict } from "@/lib/i18n/dictionaries/dashboard-settings";
import { roleLabelsDict } from "@/lib/i18n/dictionaries/dashboard-shell";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const appUser = await requireRole(["owner"]);
  const language = getLanguage();
  const t = dashboardSettingsDict[language];
  const supabase = createClient();

  const [{ data: school }, { data: team }, { data: classes }, { data: cashManagers }] = await Promise.all([
    supabase
      .from("schools")
      .select(
        "name, slug, country, currency, phone, address, email, logo_url, school_year_label, school_year_start_month, school_year_end_month"
      )
      .eq("id", appUser.school_id ?? "")
      .maybeSingle(),
    supabase.from("users").select("id, full_name, email, role").order("role"),
    supabase
      .from("classes")
      .select("id, name, level, sort_order, academic_year")
      .order("level")
      .order("sort_order"),
    supabase.from("cash_managers").select("id, name, sort_order").order("sort_order"),
  ]);

  const classesByCycle = CYCLES.map((cycle) => ({
    ...cycle,
    classes: (classes ?? []).filter((c) => c.level === cycle.key),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t.pageTitle}</h1>
        <p className="text-sm text-slate-500">{t.pageSubtitle}</p>
      </div>

      {searchParams.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      )}
      {searchParams.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {searchParams.success}
        </p>
      )}

      {/* Informations générales */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t.generalInfo}</h2>

        <div className="mt-4 flex items-center gap-4">
          {school?.logo_url ? (
            <Image
              src={school.logo_url}
              alt={t.logoAlt}
              width={56}
              height={56}
              className="h-14 w-14 rounded-md border border-slate-200 object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400">
              {t.logoPlaceholder}
            </div>
          )}
          <form action={uploadSchoolLogo} encType="multipart/form-data" className="flex items-center gap-2">
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              required
              className="text-xs text-slate-600"
            />
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {t.send}
            </button>
          </form>
        </div>

        <form action={updateSchoolInfo} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.schoolName}</span>
            <input
              name="name"
              defaultValue={school?.name ?? ""}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.currency}</span>
            <input
              name="currency"
              defaultValue={school?.currency ?? "XOF"}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.country}</span>
            <input
              name="country"
              defaultValue={school?.country ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.phone}</span>
            <input
              name="phone"
              defaultValue={school?.phone ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.email}</span>
            <input
              name="email"
              type="email"
              defaultValue={school?.email ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-slate-600">{t.address}</span>
            <input
              name="address"
              defaultValue={school?.address ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              {t.save}
            </button>
          </div>
        </form>
      </section>

      {/* Année scolaire active */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t.activeSchoolYear}</h2>
        <form action={updateSchoolYear} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.yearLabel}</span>
            <input
              name="school_year_label"
              defaultValue={school?.school_year_label ?? ""}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.startMonth}</span>
            <select
              name="school_year_start_month"
              defaultValue={school?.school_year_start_month ?? 9}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {monthNames(language).map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.endMonth}</span>
            <select
              name="school_year_end_month"
              defaultValue={school?.school_year_end_month ?? 6}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {monthNames(language).map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
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
      </section>

      {/* Classes par cycle */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t.classesByCycle}</h2>
        <p className="text-xs text-slate-500">
          {t.classesByCycleDesc(school?.school_year_label ?? "")}
        </p>

        <div className="mt-4 space-y-6">
          {classesByCycle.map((cycle) => (
            <div key={cycle.key}>
              <h3 className="text-sm font-medium text-slate-700">{cycleLabel(cycle.key, language)}</h3>
              <div className="mt-2 space-y-2">
                {cycle.classes.map((klass) => (
                  <div key={klass.id} className="flex items-center gap-2">
                    <form action={updateClass} className="flex flex-1 items-center gap-2">
                      <input type="hidden" name="id" value={klass.id} />
                      <input type="hidden" name="level" value={cycle.key} />
                      <input
                        name="name"
                        defaultValue={klass.name}
                        className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                      <input
                        name="sort_order"
                        type="number"
                        defaultValue={klass.sort_order}
                        className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        {t.save}
                      </button>
                    </form>
                    <form action={deleteClass}>
                      <input type="hidden" name="id" value={klass.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        {t.delete}
                      </button>
                    </form>
                  </div>
                ))}
                {cycle.classes.length === 0 && (
                  <p className="text-xs text-slate-400">{t.noClassInCycle}</p>
                )}
              </div>

              <form action={createClass} className="mt-2 flex items-center gap-2">
                <input type="hidden" name="level" value={cycle.key} />
                <input
                  name="name"
                  placeholder={t.classNamePlaceholder}
                  required
                  className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <input
                  name="sort_order"
                  type="number"
                  placeholder={t.orderPlaceholder}
                  defaultValue={cycle.classes.length + 1}
                  className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  {t.add}
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      {/* Responsables (caisse) */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t.cashManagers}</h2>
        <p className="text-xs text-slate-500">{t.cashManagersDesc}</p>

        <div className="mt-4 space-y-2">
          {(cashManagers ?? []).map((manager) => (
            <div key={manager.id} className="flex items-center gap-2">
              <form action={updateCashManager} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="id" value={manager.id} />
                <input
                  name="name"
                  defaultValue={manager.name}
                  className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={manager.sort_order}
                  className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  {t.save}
                </button>
              </form>
              <form action={deleteCashManager}>
                <input type="hidden" name="id" value={manager.id} />
                <button
                  type="submit"
                  className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  {t.delete}
                </button>
              </form>
            </div>
          ))}
          {(cashManagers ?? []).length === 0 && (
            <p className="text-xs text-slate-400">{t.noManager}</p>
          )}
        </div>

        <form action={createCashManager} className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          <input
            name="name"
            placeholder={t.managerNamePlaceholder}
            required
            className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            name="sort_order"
            type="number"
            placeholder={t.orderPlaceholder}
            defaultValue={(cashManagers ?? []).length + 1}
            className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            {t.add}
          </button>
        </form>
      </section>

      {/* Équipe */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t.team}</h2>
        <p className="text-xs text-slate-500">{t.teamDesc}</p>
        <div className="mt-3 border-b border-slate-100 pb-4">
          <InviteTeamMemberForm />
        </div>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 font-medium">{t.colName}</th>
              <th className="py-1 font-medium">{t.colEmail}</th>
              <th className="py-1 font-medium">{t.colRole}</th>
            </tr>
          </thead>
          <tbody>
            {(team ?? []).map((member) => (
              <tr key={member.id} className="border-t border-slate-100">
                <td className="py-1.5 text-slate-900">{member.full_name ?? "—"}</td>
                <td className="py-1.5 text-slate-600">{member.email}</td>
                <td className="py-1.5 text-slate-600">
                  {roleLabelsDict[member.role]?.[language] ?? member.role}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
