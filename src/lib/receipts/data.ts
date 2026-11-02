import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { scheduleItemLabel } from "@/lib/schedules";
import type { Language } from "@/lib/i18n/config";

// Données d'un reçu, communes à l'écran et au PDF : les deux doivent dire
// exactement la même chose au parent.

export interface ReceiptItem {
  id: string;
  label: string;
  amount: number;
  // Reste dû sur l'échéance à ce jour (avance du parent) ; 0 si soldée.
  remaining: number;
}

export interface ReceiptChild {
  name: string;
  klass: string | null;
  items: ReceiptItem[];
}

export interface ReceiptSchool {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
}

export interface ReceiptData {
  kind: "student" | "family";
  number: string;
  school: ReceiptSchool;
  // Élève, ou famille (avec le parent) pour un reçu famille.
  payerName: string;
  guardianName: string | null;
  paidAt: string;
  paymentMethod: string;
  reference: string | null;
  children: ReceiptChild[];
  total: number;
  totalRemaining: number;
  // Reçu famille : tout ce que la famille doit encore à la date `asOf`,
  // tous enfants et toutes échéances échues confondus, qu'elles soient sur
  // ce reçu ou non. null pour un reçu d'élève.
  familyRemaining: { amount: number; asOf: string } | null;
  receivedBy: string | null;
  cashManager: string | null;
  freeChildName: string | null;
  familyPaymentId: string | null;
}

type Client = SupabaseClient<Database>;

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

// Le reste de la famille ne s'affiche que s'il apprend quelque chose au
// parent : quand il dépasse le reste des seules lignes du reçu. Sinon le
// reçu disait « reste 29 000 » alors que la famille devait 39 000 (un
// uniforme non réglé, absent du reçu).
export function familyRemainingToShow(receipt: ReceiptData): number | null {
  const amount = receipt.familyRemaining?.amount ?? 0;
  return amount > receipt.totalRemaining ? amount : null;
}

// « Mensualité Septembre 2026 », « Cantine Octobre 2026 » plutôt qu'une date
// d'échéance : c'est ainsi que l'école et les parents parlent des mois.
function itemLabel(
  schedule: { due_date: string; fee_structures: unknown } | null,
  language: Language
): string {
  const fee = one(schedule?.fee_structures as { fee_type: string; month: number } | { fee_type: string; month: number }[] | null);
  return schedule ? scheduleItemLabel(fee, schedule.due_date, language) : "—";
}

type AllocationRow = {
  id: string;
  amount: number;
  payment_schedules: unknown;
};

function toItems(allocations: AllocationRow[] | null | undefined, language: Language): ReceiptItem[] {
  return (allocations ?? []).map((allocation) => {
    const schedule = one(
      allocation.payment_schedules as
        | { id: string; due_date: string; amount_remaining: number; fee_structures: unknown }
        | { id: string; due_date: string; amount_remaining: number; fee_structures: unknown }[]
        | null
    );
    return {
      id: allocation.id,
      label: itemLabel(schedule, language),
      amount: Number(allocation.amount),
      remaining: Math.max(Number(schedule?.amount_remaining ?? 0), 0),
    };
  });
}

async function loadSchool(supabase: Client, schoolId: string) {
  const { data } = await supabase
    .from("schools")
    .select("name, address, phone, email, currency, school_year_label")
    .eq("id", schoolId)
    .maybeSingle();
  return {
    school: {
      name: data?.name ?? "École",
      address: data?.address ?? null,
      phone: data?.phone ?? null,
      email: data?.email ?? null,
      currency: data?.currency ?? "XOF",
    },
    schoolYear: data?.school_year_label ?? null,
  };
}

async function loadNames(supabase: Client, receivedBy: string | null, cashManagerId: string | null) {
  const [{ data: receiver }, { data: manager }] = await Promise.all([
    receivedBy
      ? supabase.from("users").select("full_name").eq("id", receivedBy).maybeSingle()
      : Promise.resolve({ data: null }),
    cashManagerId
      ? supabase.from("cash_managers").select("name").eq("id", cashManagerId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { receivedBy: receiver?.full_name ?? null, cashManager: manager?.name ?? null };
}

const ALLOCATIONS = "payment_allocations(id, amount, payment_schedules(id, due_date, amount_remaining, fee_structures(fee_type, month)))" as const;

// Reçu d'un paiement d'élève. null si introuvable (ou d'une autre école :
// la RLS le rend invisible).
export async function loadStudentReceipt(
  supabase: Client,
  paymentId: string,
  schoolId: string,
  language: Language
): Promise<ReceiptData | null> {
  const { data: payment } = await supabase
    .from("payments")
    .select(
      `id, amount, payment_method, reference, paid_at, received_by, cash_manager_id, family_payment_id, students(first_name, last_name, guardian_name, classes(name)), ${ALLOCATIONS}` as const
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return null;

  const [{ school }, names] = await Promise.all([
    loadSchool(supabase, schoolId),
    loadNames(supabase, payment.received_by, payment.cash_manager_id),
  ]);
  const student = one(payment.students);
  const name = student ? `${student.last_name} ${student.first_name}` : "—";
  const items = toItems(payment.payment_allocations as AllocationRow[], language);

  return {
    kind: "student",
    number: payment.id.slice(0, 8),
    school,
    payerName: name,
    guardianName: student?.guardian_name ?? null,
    paidAt: payment.paid_at,
    paymentMethod: payment.payment_method,
    reference: payment.reference,
    children: [{ name, klass: one(student?.classes)?.name ?? null, items }],
    total: Number(payment.amount),
    totalRemaining: items.reduce((sum, item) => sum + item.remaining, 0),
    familyRemaining: null,
    ...names,
    freeChildName: null,
    familyPaymentId: payment.family_payment_id,
  };
}

// Reçu unique d'un paiement famille (record_family_payment, 0037/0038).
export async function loadFamilyReceipt(
  supabase: Client,
  familyPaymentId: string,
  schoolId: string,
  language: Language
): Promise<ReceiptData | null> {
  const { data: receipt } = await supabase
    .from("family_payments")
    .select("id, family_id, family_name, total, payment_method, paid_at, reference, received_by, cash_manager_id")
    .eq("id", familyPaymentId)
    .maybeSingle();
  if (!receipt) return null;

  const today = new Date().toISOString().slice(0, 10);
  const [{ school, schoolYear }, names, { data: payments }, { data: family }, { data: familySchedules }] =
    await Promise.all([
      loadSchool(supabase, schoolId),
      loadNames(supabase, receipt.received_by, receipt.cash_manager_id),
      supabase
        .from("payments")
        .select(`id, amount, students(first_name, last_name, classes(name)), ${ALLOCATIONS}` as const)
        .eq("family_payment_id", receipt.id),
      receipt.family_id
        ? supabase
            .from("families")
            .select("guardian_name, free_student_id, free_year")
            .eq("id", receipt.family_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // Mêmes échéances ouvertes que « Ce que la famille doit » (onglet Par
      // famille des Paiements), limitées à celles déjà échues.
      receipt.family_id
        ? supabase
            .from("payment_schedules")
            .select("amount_remaining, students!inner(family_id)")
            .eq("students.family_id", receipt.family_id)
            .in("status", ["pending", "partial", "overdue"])
            .gt("amount_remaining", 0)
            .lte("due_date", today)
        : Promise.resolve({ data: null }),
    ]);

  // Une ligne par échéance réglée, regroupées par enfant.
  const byChild = new Map<string, ReceiptChild>();
  for (const payment of payments ?? []) {
    const student = one(payment.students);
    const name = student ? `${student.last_name} ${student.first_name}` : "—";
    const entry = byChild.get(name) ?? { name, klass: one(student?.classes)?.name ?? null, items: [] };
    entry.items.push(...toItems(payment.payment_allocations as AllocationRow[], language));
    byChild.set(name, entry);
  }
  const children = Array.from(byChild.values()).sort((a, b) => a.name.localeCompare(b.name));
  const totalRemaining = children.reduce(
    (sum, child) => sum + child.items.reduce((s, item) => s + item.remaining, 0),
    0
  );

  // Rappel utile au parent : l'enfant pris en charge cette année n'apparaît
  // pas dans les montants, ce n'est pas un oubli.
  let freeChildName: string | null = null;
  if (family?.free_student_id && family.free_year === schoolYear) {
    const { data } = await supabase
      .from("students")
      .select("first_name, last_name")
      .eq("id", family.free_student_id)
      .maybeSingle();
    freeChildName = data ? `${data.last_name} ${data.first_name}` : null;
  }

  return {
    kind: "family",
    number: `F-${receipt.id.slice(0, 8)}`,
    school,
    payerName: receipt.family_name,
    guardianName: family?.guardian_name ?? null,
    paidAt: receipt.paid_at,
    paymentMethod: receipt.payment_method,
    reference: receipt.reference,
    children,
    // Somme des lignes, et non family_payments.total figé à l'encaissement :
    // une ligne corrigée ou supprimée après coup (updatePayment,
    // deletePayment) doit se retrouver dans le total du reçu.
    total: (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0),
    totalRemaining,
    familyRemaining: receipt.family_id
      ? {
          amount: (familySchedules ?? []).reduce((sum, schedule) => sum + Number(schedule.amount_remaining), 0),
          asOf: today,
        }
      : null,
    ...names,
    freeChildName,
    familyPaymentId: receipt.id,
  };
}
