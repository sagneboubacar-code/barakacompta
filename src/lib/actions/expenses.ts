"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES } from "@/lib/constants/expenses";
import type { ExpenseCategory } from "@/types";

const LIST_PATH = "/dashboard/expenses";
const VALID_CATEGORIES = EXPENSE_CATEGORIES.map((c) => c.key);
const MAX_RECEIPT_SIZE = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_RECEIPT_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

function targetPath(formData: FormData): string {
  const redirectTo = String(formData.get("redirect_to") ?? LIST_PATH);
  return redirectTo.startsWith(LIST_PATH) ? redirectTo : LIST_PATH;
}

function fail(base: string, message: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

function ok(base: string, message: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}success=${encodeURIComponent(message)}`);
}

async function uploadReceiptIfProvided(
  supabase: ReturnType<typeof createServerSupabase>,
  schoolId: string,
  formData: FormData,
  base: string
): Promise<string | null | undefined> {
  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) {
    return undefined; // aucun fichier fourni : ne pas toucher le justificatif existant
  }
  if (file.size > MAX_RECEIPT_SIZE) {
    fail(base, "Le justificatif ne doit pas dépasser 5 Mo.");
  }
  if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {
    fail(base, "Format non supporté (image PNG/JPEG/WEBP ou PDF uniquement).");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${schoolId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from("expense-receipts")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) fail(base, "Échec de l'envoi du justificatif : " + error.message);

  return path;
}

export async function createExpense(formData: FormData) {
  const appUser = await requireRole(["owner", "admin", "accountant"]);
  const base = targetPath(formData);
  const supabase = createServerSupabase();

  const expenseDate = String(formData.get("expense_date") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const cashManagerId = String(formData.get("cash_manager_id") ?? "").trim() || null;

  if (
    !expenseDate ||
    isNaN(Date.parse(expenseDate)) ||
    !VALID_CATEGORIES.includes(category as ExpenseCategory) ||
    !label ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    fail(base, "Merci de renseigner une date, une catégorie, une description et un montant positif.");
  }

  const receiptPath = await uploadReceiptIfProvided(supabase, appUser.school_id ?? "", formData, base);

  const { error } = await supabase.from("expenses").insert({
    school_id: appUser.school_id ?? "",
    category: category as ExpenseCategory,
    label,
    amount,
    expense_date: expenseDate,
    paid_by: appUser.id,
    cash_manager_id: cashManagerId,
    receipt_path: receiptPath ?? null,
  });

  if (error) fail(base, "Impossible de créer la dépense : " + error.message);

  ok(base, "Dépense ajoutée.");
}

export async function updateExpense(formData: FormData) {
  const appUser = await requireRole(["owner", "admin", "accountant"]);
  const id = String(formData.get("id") ?? "");
  const base = targetPath(formData);
  const supabase = createServerSupabase();

  const expenseDate = String(formData.get("expense_date") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const cashManagerId = String(formData.get("cash_manager_id") ?? "").trim() || null;

  if (
    !id ||
    !expenseDate ||
    isNaN(Date.parse(expenseDate)) ||
    !VALID_CATEGORIES.includes(category as ExpenseCategory) ||
    !label ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    fail(base, "Merci de renseigner une date, une catégorie, une description et un montant positif.");
  }

  const receiptPath = await uploadReceiptIfProvided(supabase, appUser.school_id ?? "", formData, base);

  const { error } = await supabase
    .from("expenses")
    .update({
      category: category as ExpenseCategory,
      label,
      amount,
      expense_date: expenseDate,
      cash_manager_id: cashManagerId,
      ...(receiptPath !== undefined ? { receipt_path: receiptPath } : {}),
    })
    .eq("id", id);

  if (error) fail(base, "Impossible de modifier la dépense : " + error.message);

  ok(base, "Dépense mise à jour.");
}

export async function deleteExpense(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  if (!id) fail(LIST_PATH, "Dépense introuvable.");

  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) fail(LIST_PATH, "Impossible de supprimer la dépense : " + error.message);

  ok(LIST_PATH, "Dépense supprimée.");
}
