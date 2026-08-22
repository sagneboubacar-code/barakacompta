import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { paymentMethodLabel } from "@/lib/constants/payments";
import { feeTypeLabel } from "@/lib/constants/fees";
import { PrintButton } from "@/components/PrintButton";

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const appUser = await requireRole(["owner", "admin", "accountant"]);
  const supabase = createClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount, payment_method, reference, paid_at, notes, students(first_name, last_name)")
    .eq("id", params.id)
    .maybeSingle();

  if (!payment) {
    redirect("/unauthorized");
  }

  const [{ data: school }, { data: allocations }] = await Promise.all([
    supabase
      .from("schools")
      .select("name, address, phone")
      .eq("id", appUser.school_id ?? "")
      .maybeSingle(),
    supabase
      .from("payment_allocations")
      .select("id, amount, payment_schedules(due_date, fee_structures(fee_type))")
      .eq("payment_id", payment.id)
      .order("id"),
  ]);

  const student = Array.isArray(payment.students) ? payment.students[0] : payment.students;

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-lg border border-slate-200 bg-white p-8 print:border-0 print:shadow-none">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-slate-900">{school?.name}</h1>
        <p className="text-xs text-slate-500">{school?.address}</p>
        <p className="text-xs text-slate-500">{school?.phone}</p>
      </div>
      <h2 className="text-center text-base font-medium text-slate-700">Reçu de paiement</h2>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Élève</dt>
          <dd className="text-slate-900">
            {student ? `${student.last_name} ${student.first_name}` : "—"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Date</dt>
          <dd className="text-slate-900">
            {new Date(payment.paid_at).toLocaleDateString("fr-FR")}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Montant</dt>
          <dd className="text-slate-900">{payment.amount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Moyen de paiement</dt>
          <dd className="text-slate-900">{paymentMethodLabel(payment.payment_method)}</dd>
        </div>
        {payment.reference && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Référence</dt>
            <dd className="text-slate-900">{payment.reference}</dd>
          </div>
        )}
      </dl>

      {(allocations ?? []).length > 0 && (
        <div className="border-t border-slate-200 pt-4">
          <p className="text-xs font-medium text-slate-500">Échéances couvertes</p>
          <ul className="mt-2 space-y-1 text-sm">
            {(allocations ?? []).map((allocation) => {
              const schedule = Array.isArray(allocation.payment_schedules)
                ? allocation.payment_schedules[0]
                : allocation.payment_schedules;
              const feeStructure = schedule
                ? Array.isArray(schedule.fee_structures)
                  ? schedule.fee_structures[0]
                  : schedule.fee_structures
                : null;
              return (
                <li key={allocation.id} className="flex justify-between text-slate-700">
                  <span>
                    {schedule ? new Date(schedule.due_date).toLocaleDateString("fr-FR") : "—"}
                    {feeStructure ? ` — ${feeTypeLabel(feeStructure.fee_type)}` : ""}
                  </span>
                  <span>{allocation.amount}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="text-center text-xs text-slate-400">Reçu #{payment.id.slice(0, 8)}</p>

      <div className="flex justify-center print:hidden">
        <PrintButton />
      </div>
    </div>
  );
}
