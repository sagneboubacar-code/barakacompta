"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/types";

const VALID_METHODS: PaymentMethod[] = ["cash", "wave", "orange_money", "bank_transfer"];

function fail(base: string, message: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

function ok(base: string, message: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}success=${encodeURIComponent(message)}`);
}

// Enregistre un paiement ; la répartition sur une ou plusieurs échéances
// (mois concerné + cascade sur les suivantes en cas d'avance) est entièrement
// automatique côté base de données (trigger trg_after_payment_insert_allocate,
// voir 0007_payments_module.sql) — cette action ne fait que créer la ligne.
export async function recordPayment(formData: FormData) {
  const appUser = await requireRole(["owner", "admin", "accountant"]);
  const supabase = createServerSupabase();

  const studentId = String(formData.get("student_id") ?? "");
  const base = `/dashboard/payments${studentId ? `?student_id=${studentId}` : ""}`;

  const paidAt = String(formData.get("paid_at") ?? "").trim();
  const paymentScheduleId = String(formData.get("payment_schedule_id") ?? "").trim() || null;
  const amount = Number(formData.get("amount"));
  const paymentMethod = String(formData.get("payment_method") ?? "");
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const cashManagerId = String(formData.get("cash_manager_id") ?? "").trim() || null;

  if (
    !studentId ||
    !paidAt ||
    isNaN(Date.parse(paidAt)) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !VALID_METHODS.includes(paymentMethod as PaymentMethod)
  ) {
    fail(base, "Merci de renseigner l'élève, une date valide, un montant positif et un mode de paiement valide.");
  }

  const { error } = await supabase.from("payments").insert({
    school_id: appUser.school_id ?? "",
    student_id: studentId,
    payment_schedule_id: paymentScheduleId,
    amount,
    payment_method: paymentMethod as PaymentMethod,
    reference,
    paid_at: new Date(paidAt).toISOString(),
    received_by: appUser.id,
    cash_manager_id: cashManagerId,
    notes,
  });

  if (error) fail(base, "Impossible d'enregistrer le paiement : " + error.message);

  ok(base, "Paiement enregistré.");
}
