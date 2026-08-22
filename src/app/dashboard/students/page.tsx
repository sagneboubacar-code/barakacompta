import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createStudent, deleteStudent } from "@/lib/actions/students";
import { CYCLES, cycleLabel, sortByCycle } from "@/lib/constants/cycles";
import { REGIMES, regimeLabel } from "@/lib/constants/fees";
import { PrintButton } from "@/components/PrintButton";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    cycle?: string;
    class_id?: string;
    regime?: string;
    status?: string;
    error?: string;
    success?: string;
  };
}) {
  const appUser = await requireRole(["owner", "admin"]);
  const supabase = createClient();

  const [{ data: rawClasses }, { data: school }] = await Promise.all([
    supabase.from("classes").select("id, name, level, sort_order").order("sort_order"),
    supabase.from("schools").select("name, address").eq("id", appUser.school_id ?? "").maybeSingle(),
  ]);
  const classes = sortByCycle(rawClasses ?? []);

  let query = supabase
    .from("students")
    .select(
      "id, matricule, first_name, last_name, regime, status, class_id, date_of_birth, place_of_birth, guardian_phone, classes(name, level)"
    )
    .order("last_name");

  const q = searchParams.q?.trim().replace(/[,()%]/g, "");
  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,matricule.ilike.%${q}%`);
  }
  if (searchParams.class_id) {
    query = query.eq("class_id", searchParams.class_id);
  } else if (searchParams.cycle) {
    const classIds = (classes ?? []).filter((c) => c.level === searchParams.cycle).map((c) => c.id);
    query = query.in("class_id", classIds.length > 0 ? classIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (searchParams.regime === "externat" || searchParams.regime === "internat") {
    query = query.eq("regime", searchParams.regime);
  }
  if (searchParams.status === "active" || searchParams.status === "inactive") {
    query = query.eq("status", searchParams.status);
  }

  const { data: students } = await query;

  const query_ = new URLSearchParams();
  if (searchParams.q) query_.set("q", searchParams.q);
  if (searchParams.cycle) query_.set("cycle", searchParams.cycle);
  if (searchParams.class_id) query_.set("class_id", searchParams.class_id);
  if (searchParams.regime) query_.set("regime", searchParams.regime);
  if (searchParams.status) query_.set("status", searchParams.status);
  const redirectTo = `/dashboard/students${query_.toString() ? `?${query_.toString()}` : ""}`;
  const selectedClass = (classes ?? []).find((c) => c.id === searchParams.class_id);
  const exportParams = query_.toString();

  // Registre imprimable : trié par prénom puis nom, indépendamment de l'ordre
  // d'affichage à l'écran (qui reste trié par nom pour la gestion courante).
  const rosterRows = [...(students ?? [])].sort(
    (a, b) => a.first_name.localeCompare(b.first_name) || a.last_name.localeCompare(b.last_name)
  );

  return (
    <div className="space-y-6">
      <div className="hidden text-center print:block">
        <h1 className="text-lg font-semibold text-slate-900">{school?.name}</h1>
        <p className="text-xs text-slate-500">{school?.address}</p>
        <p className="mt-2 text-base font-medium text-slate-900">
          Liste des élèves{selectedClass ? ` — ${selectedClass.name}` : ""}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 print:hidden">Élèves</h1>
          <p className="text-sm text-slate-500 print:hidden">
            Recherche, filtres et gestion des dossiers élèves.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
          <a
            href={`/api/students/csv${exportParams ? `?${exportParams}` : ""}`}
            className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Export Excel
          </a>
        </div>
      </div>

      {searchParams.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}
      {searchParams.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{searchParams.success}</p>
      )}

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 print:hidden"
      >
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Recherche</span>
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Nom, prénom, matricule"
            className="w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Cycle</span>
          <select
            name="cycle"
            defaultValue={searchParams.cycle ?? ""}
            className="w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            {CYCLES.map((cycle) => (
              <option key={cycle.key} value={cycle.key}>
                {cycle.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Classe</span>
          <select
            name="class_id"
            defaultValue={searchParams.class_id ?? ""}
            className="w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Toutes</option>
            {(classes ?? []).map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Régime</span>
          <select
            name="regime"
            defaultValue={searchParams.regime ?? ""}
            className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            {REGIMES.map((regime) => (
              <option key={regime.key} value={regime.key}>
                {regime.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Statut</span>
          <select
            name="status"
            defaultValue={searchParams.status ?? ""}
            className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Filtrer
        </button>
      </form>

      {/* Registre imprimable : matricule, prénom, nom, date/lieu de naissance, parent — visible uniquement à l'impression. Colonnes alignées avec l'export Excel. */}
      <table className="hidden w-full text-left text-sm print:table">
        <thead>
          <tr>
            <th className="border-b border-slate-300 py-1 pr-3 font-medium">Matricule</th>
            <th className="border-b border-slate-300 py-1 pr-3 font-medium">Prénom</th>
            <th className="border-b border-slate-300 py-1 pr-3 font-medium">Nom</th>
            <th className="border-b border-slate-300 py-1 pr-3 font-medium">Date de naissance</th>
            <th className="border-b border-slate-300 py-1 pr-3 font-medium">Lieu de naissance</th>
            <th className="border-b border-slate-300 py-1 font-medium">Numéro parent</th>
          </tr>
        </thead>
        <tbody>
          {rosterRows.map((student) => (
            <tr key={student.id}>
              <td className="border-b border-slate-100 py-1 pr-3">{student.matricule ?? "—"}</td>
              <td className="border-b border-slate-100 py-1 pr-3">{student.first_name}</td>
              <td className="border-b border-slate-100 py-1 pr-3">{student.last_name}</td>
              <td className="border-b border-slate-100 py-1 pr-3">
                {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("fr-FR") : "—"}
              </td>
              <td className="border-b border-slate-100 py-1 pr-3">{student.place_of_birth ?? "—"}</td>
              <td className="border-b border-slate-100 py-1">{student.guardian_phone ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white print:hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Matricule</th>
              <th className="px-4 py-2 font-medium">Nom</th>
              <th className="px-4 py-2 font-medium">Classe</th>
              <th className="px-4 py-2 font-medium">Cycle</th>
              <th className="px-4 py-2 font-medium">Régime</th>
              <th className="px-4 py-2 font-medium">Statut</th>
              <th className="px-4 py-2 font-medium print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {(students ?? []).map((student) => {
              const klass = Array.isArray(student.classes) ? student.classes[0] : student.classes;
              return (
                <tr key={student.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-600">{student.matricule ?? "—"}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/students/${student.id}`}
                      className="text-slate-900 underline"
                    >
                      {student.last_name} {student.first_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{klass?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{cycleLabel(klass?.level ?? null)}</td>
                  <td className="px-4 py-2 text-slate-600">{regimeLabel(student.regime)}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {student.status === "active" ? "Actif" : "Inactif"}
                  </td>
                  <td className="px-4 py-2 print:hidden">
                    <form action={deleteStudent}>
                      <input type="hidden" name="id" value={student.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {(students ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  Aucun élève ne correspond à ces critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="rounded-lg border border-slate-200 bg-white p-4 print:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Ajouter un élève
        </summary>
        <form action={createStudent} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="redirect_to" value={redirectTo} />
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Prénom</span>
            <input
              name="first_name"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Nom</span>
            <input
              name="last_name"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Sexe</span>
            <select name="gender" required className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm">
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Date de naissance</span>
            <input
              name="date_of_birth"
              type="date"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Lieu de naissance</span>
            <input
              name="place_of_birth"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Classe</span>
            <select name="class_id" className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm">
              <option value="">Aucune</option>
              {(classes ?? []).map((klass) => (
                <option key={klass.id} value={klass.id}>
                  {klass.name} ({cycleLabel(klass.level)})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Régime</span>
            <select name="regime" defaultValue="externat" className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm">
              {REGIMES.map((regime) => (
                <option key={regime.key} value={regime.key}>
                  {regime.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Nom du parent</span>
            <input
              name="guardian_name"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Téléphone parent</span>
            <input
              name="guardian_phone"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-slate-600">Adresse</span>
            <input
              name="address"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Date d&apos;inscription</span>
            <input
              name="enrolled_at"
              type="date"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Statut</span>
            <select name="status" defaultValue="active" className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm">
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </label>
          <div className="flex items-center gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="subscribes_cantine" />
              Inscrit à la cantine
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="subscribes_transport" />
              Inscrit au transport
            </label>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Ajouter
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
