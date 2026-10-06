"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/types";
import type { Database } from "@/types/database.types";

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

// Corrige un paiement saisi par erreur. Seuls les champs réellement changés
// sont envoyés : quand le montant ou le mois concerné change, la base
// réaffecte d'elle-même le paiement sur les échéances (trigger
// trg_after_payment_update_reallocate, 0007) ; une simple correction de date
// ne touche pas à la répartition. Réservé à owner + admin, comme la
// suppression : revenir sur une recette encaissée relève de la direction.
export async function updatePayment(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const base = `/dashboard/payments/${id}/edit`;

  const { data: payment } = await supabase
    .from("payments")
    .select(
      "id, student_id, amount, payment_schedule_id, payment_method, paid_at, reference, notes, cash_manager_id, family_payment_id"
    )
    .eq("id", id)
    .maybeSingle();
  if (!payment) fail("/dashboard/payments", "Paiement introuvable.");

  const amount = Number(formData.get("amount"));
  const scheduleId = String(formData.get("payment_schedule_id") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) {
    fail(base, "Merci de saisir un montant positif.");
  }

  if (scheduleId && scheduleId !== payment.payment_schedule_id) {
    const { data: schedule } = await supabase
      .from("payment_schedules")
      .select("id")
      .eq("id", scheduleId)
      .eq("student_id", payment.student_id)
      .neq("status", "cancelled")
      .maybeSingle();
    if (!schedule) fail(base, "Ce mois concerné n'existe pas pour cet élève.");
  }

  const changes: Database["public"]["Tables"]["payments"]["Update"] = {};
  if (amount !== Number(payment.amount)) changes.amount = amount;
  if (scheduleId !== payment.payment_schedule_id) changes.payment_schedule_id = scheduleId;
  if (notes !== payment.notes) changes.notes = notes;

  // La date, le mode de paiement et le responsable d'une ligne de paiement
  // famille sont ceux du reçu famille : le formulaire ne les propose pas.
  if (!payment.family_payment_id) {
    const paidAt = String(formData.get("paid_at") ?? "").trim();
    const paymentMethod = String(formData.get("payment_method") ?? "");
    const reference = String(formData.get("reference") ?? "").trim() || null;
    const cashManagerId = String(formData.get("cash_manager_id") ?? "").trim() || null;

    if (!paidAt || isNaN(Date.parse(paidAt)) || !VALID_METHODS.includes(paymentMethod as PaymentMethod)) {
      fail(base, "Merci de renseigner une date valide et un mode de paiement valide.");
    }
    // Même jour : on garde l'heure d'origine plutôt que de la ramener à minuit.
    if (paidAt !== payment.paid_at.slice(0, 10)) changes.paid_at = new Date(paidAt).toISOString();
    if (paymentMethod !== payment.payment_method) changes.payment_method = paymentMethod as PaymentMethod;
    if (reference !== payment.reference) changes.reference = reference;
    if (cashManagerId !== payment.cash_manager_id) changes.cash_manager_id = cashManagerId;
  }

  const receipt = `/dashboard/payments/${id}/receipt`;
  if (Object.keys(changes).length === 0) ok(receipt, "Aucune modification : le paiement est inchangé.");

  const { error } = await supabase.from("payments").update(changes).eq("id", id);
  if (error) fail(base, "Impossible de modifier le paiement : " + error.message);

  ok(receipt, "Paiement modifié : le reçu ci-dessous est à jour.");
}

// Supprime un paiement qui n'aurait jamais dû exister (saisi sur le mauvais
// élève, en double...). Ses répartitions partent avec lui (ON DELETE CASCADE)
// et les échéances qu'il réglait redeviennent dues. La RLS réserve déjà la
// suppression à owner + admin (0001).
export async function deletePayment(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const base = `/dashboard/payments/${id}/edit`;

  const { data: payment } = await supabase.from("payments").select("id, student_id").eq("id", id).maybeSingle();
  if (!payment) fail("/dashboard/payments", "Paiement introuvable.");

  if (formData.get("confirm") !== "yes") {
    fail(base, "Cochez la case pour confirmer la suppression.");
  }

  const { data: deleted, error } = await supabase.from("payments").delete().eq("id", id).select("id");
  if (error || !deleted?.length) {
    fail(base, "Impossible de supprimer le paiement" + (error ? " : " + error.message : "."));
  }

  ok(
    `/dashboard/payments?student_id=${payment.student_id}`,
    "Paiement supprimé : les échéances qu'il réglait sont de nouveau à payer."
  );
}

// Tant que le SQL 0041 n'a pas été exécuté dans Supabase, la fonction
// n'existe pas : le dire plutôt que d'afficher le message technique.
function familyRpcError(message: string): string {
  return /could not find the function|does not exist|schema cache/i.test(message)
    ? "la mise à jour de la base n'a pas encore été faite (SQL 0041 à exécuter dans Supabase)."
    : message;
}

// Corrige un paiement famille d'un bloc (update_family_payment, 0041) : date,
// mode, responsable, référence et note du reçu, recopiés sur chaque ligne, et
// montant de chaque ligne (0 = ligne retirée). Tout ou rien, en une
// transaction ; la base réaffecte les montants changés.
export async function updateFamilyPayment(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const base = `/dashboard/payments/family/${id}/edit`;

  const { data: receipt } = await supabase.from("family_payments").select("id, paid_at").eq("id", id).maybeSingle();
  if (!receipt) fail("/dashboard/payments?mode=family", "Paiement famille introuvable.");

  // Une ligne = un paiement du reçu et son nouveau montant, dans le même ordre.
  const paymentIds = formData.getAll("payment_ids").map((value) => String(value).trim());
  const amounts = formData.getAll("amounts").map((value) => Number(value));
  const paidAt = String(formData.get("paid_at") ?? "").trim();
  const paymentMethod = String(formData.get("payment_method") ?? "");
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const cashManagerId = String(formData.get("cash_manager_id") ?? "").trim() || null;

  if (
    paymentIds.length === 0 ||
    paymentIds.length !== amounts.length ||
    paymentIds.some((paymentId) => !paymentId) ||
    amounts.some((amount) => !Number.isFinite(amount) || amount < 0)
  ) {
    fail(base, "Merci de saisir un montant positif (ou 0) pour chaque ligne.");
  }
  if (amounts.every((amount) => amount === 0)) {
    fail(base, "Tous les montants sont à 0 : pour tout annuler, utilisez « Annuler tout le paiement famille ».");
  }
  if (!paidAt || isNaN(Date.parse(paidAt)) || !VALID_METHODS.includes(paymentMethod as PaymentMethod)) {
    fail(base, "Merci de renseigner une date valide et un mode de paiement valide.");
  }

  const { error } = await supabase.rpc("update_family_payment", {
    p_family_payment_id: id,
    // Même jour : on garde l'heure d'origine plutôt que de la ramener à minuit.
    p_paid_at: paidAt === receipt.paid_at.slice(0, 10) ? receipt.paid_at : new Date(paidAt).toISOString(),
    p_payment_method: paymentMethod,
    p_reference: reference,
    p_notes: notes,
    p_cash_manager_id: cashManagerId,
    p_payment_ids: paymentIds,
    p_amounts: amounts,
  });
  if (error) fail(base, "Impossible de modifier le paiement famille : " + familyRpcError(error.message));

  ok(`/dashboard/payments/family/${id}`, "Paiement famille modifié : le reçu ci-dessous est à jour.");
}

// Annule tout un paiement famille saisi par erreur (delete_family_payment,
// 0041) : le reçu et toutes ses lignes ; les échéances redeviennent dues.
export async function deleteFamilyPayment(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const base = `/dashboard/payments/family/${id}/edit`;

  const { data: receipt } = await supabase.from("family_payments").select("id, family_id").eq("id", id).maybeSingle();
  if (!receipt) fail("/dashboard/payments?mode=family", "Paiement famille introuvable.");

  if (formData.get("confirm") !== "yes") {
    fail(base, "Cochez la case pour confirmer l'annulation.");
  }

  const { error } = await supabase.rpc("delete_family_payment", { p_family_payment_id: id });
  if (error) fail(base, "Impossible d'annuler le paiement famille : " + familyRpcError(error.message));

  ok(
    `/dashboard/payments?mode=family${receipt.family_id ? `&family_id=${receipt.family_id}` : ""}`,
    "Paiement famille annulé : les échéances qu'il réglait sont de nouveau à payer."
  );
}

// Encaisse en une fois, avec un seul reçu, ce que la famille verse sur les
// échéances de ses enfants — tout, ou une avance répartie ligne par ligne.
// Tout se passe dans record_family_payment() (0037, montants par ligne en
// 0038) : chaque montant est revérifié contre le reste à payer en base, et
// soit toute la famille est encaissée, soit rien ne l'est.
export async function recordFamilyPayment(formData: FormData) {
  await requireRole(["owner", "admin", "accountant"]);
  const supabase = createServerSupabase();

  const familyId = String(formData.get("family_id") ?? "");
  const period = String(formData.get("period") ?? "");
  const base = `/dashboard/payments?mode=family${familyId ? `&family_id=${familyId}` : ""}${
    period ? `&period=${encodeURIComponent(period)}` : ""
  }`;

  // Une ligne = une échéance et le montant versé dessus, dans le même ordre.
  const scheduleIds = formData.getAll("schedule_ids").map((value) => String(value).trim());
  const amounts = formData.getAll("amounts").map((value) => Number(value));
  const paidAt = String(formData.get("paid_at") ?? "").trim();
  const paymentMethod = String(formData.get("payment_method") ?? "");
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const cashManagerId = String(formData.get("cash_manager_id") ?? "").trim() || null;

  if (
    !familyId ||
    scheduleIds.length === 0 ||
    scheduleIds.length !== amounts.length ||
    scheduleIds.some((id) => !id) ||
    amounts.some((amount) => !Number.isFinite(amount) || amount < 0) ||
    amounts.every((amount) => amount === 0)
  ) {
    fail(base, "Saisissez le montant versé par le parent.");
  }
  if (!paidAt || isNaN(Date.parse(paidAt)) || !VALID_METHODS.includes(paymentMethod as PaymentMethod)) {
    fail(base, "Merci de renseigner une date valide et un mode de paiement valide.");
  }

  const { data: familyPaymentId, error } = await supabase.rpc("record_family_payment", {
    p_family_id: familyId,
    p_schedule_ids: scheduleIds,
    p_amounts: amounts,
    p_paid_at: new Date(paidAt).toISOString(),
    p_payment_method: paymentMethod,
    p_reference: reference,
    p_notes: notes,
    p_cash_manager_id: cashManagerId,
  });

  if (error || !familyPaymentId) {
    fail(base, "Impossible d'enregistrer le paiement de la famille : " + (error?.message ?? ""));
  }

  // Directement sur le reçu, prêt à imprimer pour le parent.
  ok(`/dashboard/payments/family/${familyPaymentId}`, "Paiement de la famille enregistré.");
}
