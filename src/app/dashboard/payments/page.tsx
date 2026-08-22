import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { recordPayment } from "@/lib/actions/payments";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/constants/payments";
import { feeTypeLabel, regimeLabel } from "@/lib/constants/fees";
import { cycleLabel } from "@/lib/constants/cycles";

const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  pending: "À venir",
  partial: "Partiel",
  paid: "Payé",
  overdue: "En retard",
  cancelled: "Annulé",
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { student_id?: string; q?: string; error?: string; success?: string };
}) {
  // Accessible aux 3 rôles : c'est le cœur du périmètre "accountant".
  await requireRole(["owner", "admin", "accountant"]);
  const supabase = createClient();

  let studentsQuery = supabase
    .from("students")
    .select("id, first_name, last_name, matricule")
    .order("last_name");

  const q = searchParams.q?.trim().replace(/[,()%]/g, "");
  if (q) {
    studentsQuery = studentsQuery.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,matricule.ilike.%${q}%`);
  }

  const { data: students } = await studentsQuery;

  // L'élève sélectionné peut ne plus apparaître dans une liste filtrée par
  // la recherche courante : on le résout séparément pour ne jamais perdre
  // la sélection active à cause d'une recherche restrictive.
  const selectedStudent = searchParams.student_id
    ? ((
        await supabase
          .from("students")
          .select(
            "id, first_name, last_name, matricule, regime, guardian_name, guardian_phone, classes(name, level)"
          )
          .eq("id", searchParams.student_id)
          .maybeSingle()
      ).data ?? null)
    : null;

  let allSchedules: {
    id: string;
    due_date: string;
    amount_due: number;
    discount_amount: number;
    amount_paid: number;
    amount_remaining: number;
    status: string;
    fee_structures: { fee_type: string } | { fee_type: string }[] | null;
  }[] = [];

  if (selectedStudent) {
    const { data } = await supabase
      .from("payment_schedules")
      .select("id, due_date, amount_due, discount_amount, amount_paid, amount_remaining, status, fee_structures(fee_type)")
      .eq("student_id", selectedStudent.id)
      .order("due_date");
    allSchedules = data ?? [];
  }

  const outstandingSchedules = allSchedules.filter((s) =>
    ["pending", "partial", "overdue"].includes(s.status)
  );
  const studentBalance = allSchedules
    .filter((s) => s.status !== "cancelled")
    .reduce((sum, s) => sum + s.amount_remaining, 0);
  const selectedStudentClass = selectedStudent
    ? Array.isArray(selectedStudent.classes)
      ? selectedStudent.classes[0]
      : selectedStudent.classes
    : null;

  let paymentsQuery = supabase
    .from("payments")
    .select("id, amount, payment_method, paid_at, students(first_name, last_name)")
    .order("paid_at", { ascending: false });

  if (selectedStudent) {
    paymentsQuery = paymentsQuery.eq("student_id", selectedStudent.id);
  }

  const { data: payments } = await paymentsQuery;

  const { data: cashManagers } = await supabase.from("cash_managers").select("id, name").order("sort_order");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Paiements</h1>

      {searchParams.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}
      {searchParams.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{searchParams.success}</p>
      )}

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Rechercher un élève</span>
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Nom, prénom, matricule"
            className="w-52 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Élève</span>
          <select
            name="student_id"
            defaultValue={searchParams.student_id ?? ""}
            className="w-64 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">
              {q ? `— ${(students ?? []).length} résultat(s) —` : "— Choisir un élève —"}
            </option>
            {(students ?? []).map((student) => (
              <option key={student.id} value={student.id}>
                {student.last_name} {student.first_name}
                {student.matricule ? ` (${student.matricule})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Rechercher / Choisir
        </button>
        {(selectedStudent || q) && (
          <Link href="/dashboard/payments" className="text-sm text-slate-500 underline">
            Réinitialiser
          </Link>
        )}
      </form>

      {selectedStudent && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {selectedStudent.last_name} {selectedStudent.first_name}
              {selectedStudent.matricule ? ` (${selectedStudent.matricule})` : ""}
            </h2>
            <Link
              href={`/dashboard/students/${selectedStudent.id}`}
              className="text-xs text-slate-500 underline"
            >
              Voir la fiche complète
            </Link>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-500">Classe</dt>
              <dd className="text-slate-900">
                {selectedStudentClass
                  ? `${selectedStudentClass.name} (${cycleLabel(selectedStudentClass.level)})`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Régime</dt>
              <dd className="text-slate-900">{regimeLabel(selectedStudent.regime)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Parent</dt>
              <dd className="text-slate-900">{selectedStudent.guardian_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Téléphone parent</dt>
              <dd className="text-slate-900">{selectedStudent.guardian_phone ?? "—"}</dd>
            </div>
          </dl>

          <p className="mt-3 text-sm text-slate-600">
            Solde restant dû :{" "}
            <strong className={studentBalance > 0 ? "text-red-700" : "text-green-700"}>
              {studentBalance}
            </strong>
          </p>

          {allSchedules.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Échéance</th>
                    <th className="py-1 pr-3 font-medium">Type</th>
                    <th className="py-1 pr-3 font-medium">Prévu</th>
                    <th className="py-1 pr-3 font-medium">Payé</th>
                    <th className="py-1 pr-3 font-medium">Reste</th>
                    <th className="py-1 pr-3 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {allSchedules.map((schedule) => {
                    const feeStructure = Array.isArray(schedule.fee_structures)
                      ? schedule.fee_structures[0]
                      : schedule.fee_structures;
                    return (
                      <tr key={schedule.id} className="border-t border-slate-100">
                        <td className="py-1 pr-3 text-slate-600">
                          {new Date(schedule.due_date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-1 pr-3 text-slate-600">
                          {feeStructure ? feeTypeLabel(feeStructure.fee_type) : "—"}
                        </td>
                        <td className="py-1 pr-3 text-slate-600">{schedule.amount_due}</td>
                        <td className="py-1 pr-3 text-slate-600">{schedule.amount_paid}</td>
                        <td className="py-1 pr-3 text-slate-600">{schedule.amount_remaining}</td>
                        <td className="py-1 pr-3 text-slate-600">
                          {SCHEDULE_STATUS_LABELS[schedule.status] ?? schedule.status}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="mt-5 text-sm font-semibold text-slate-900">Enregistrer un paiement</h3>

          {outstandingSchedules.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">
              Aucune échéance en attente pour cet élève (échéancier non généré, ou déjà soldé).
            </p>
          ) : (
            <form action={recordPayment} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input type="hidden" name="student_id" value={selectedStudent.id} />
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Date</span>
                <input
                  name="paid_at"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Mois concerné</span>
                <select
                  name="payment_schedule_id"
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  {outstandingSchedules.map((schedule) => {
                    const feeStructure = Array.isArray(schedule.fee_structures)
                      ? schedule.fee_structures[0]
                      : schedule.fee_structures;
                    return (
                      <option key={schedule.id} value={schedule.id}>
                        {new Date(schedule.due_date).toLocaleDateString("fr-FR")} —{" "}
                        {feeStructure ? feeTypeLabel(feeStructure.fee_type) : "—"} (reste{" "}
                        {schedule.amount_remaining})
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Montant</span>
                <input
                  name="amount"
                  type="number"
                  min="1"
                  step="1"
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Mode de paiement</span>
                <select
                  name="payment_method"
                  defaultValue="cash"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.key} value={method.key}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
              {(cashManagers ?? []).length > 0 && (
                <label className="space-y-1 text-sm">
                  <span className="text-slate-600">Responsable (optionnel)</span>
                  <select
                    name="cash_manager_id"
                    defaultValue=""
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    {(cashManagers ?? []).map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Référence (optionnel)</span>
                <input
                  name="reference"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Notes (optionnel)</span>
                <input
                  name="notes"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <p className="text-xs text-slate-400 sm:col-span-2">
                Si le montant dépasse le reste dû du mois choisi, l&apos;excédent est
                automatiquement affecté aux échéances suivantes (avance).
              </p>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Enregistrer le paiement
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {selectedStudent && (
          <h2 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900">
            Historique des paiements — {selectedStudent.last_name} {selectedStudent.first_name}
          </h2>
        )}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Élève</th>
              <th className="px-4 py-2 font-medium">Montant</th>
              <th className="px-4 py-2 font-medium">Moyen</th>
              <th className="px-4 py-2 font-medium">Reçu</th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((payment) => {
              const student = Array.isArray(payment.students)
                ? payment.students[0]
                : payment.students;
              return (
                <tr key={payment.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-600">
                    {new Date(payment.paid_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-2 text-slate-900">
                    {student ? `${student.last_name} ${student.first_name}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{payment.amount}</td>
                  <td className="px-4 py-2 text-slate-600">{paymentMethodLabel(payment.payment_method)}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/payments/${payment.id}/receipt`}
                      className="text-slate-900 underline"
                    >
                      Voir le reçu
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(payments ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Aucun paiement enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
