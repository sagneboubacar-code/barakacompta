"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

const LIST_PATH = "/dashboard/transfers";

function fail(message: string): never {
  redirect(`${LIST_PATH}?error=${encodeURIComponent(message)}`);
}

function ok(message: string): never {
  redirect(`${LIST_PATH}?success=${encodeURIComponent(message)}`);
}

export async function createCashTransfer(formData: FormData) {
  const appUser = await requireRole(["owner", "admin", "accountant"]);
  const supabase = createServerSupabase();

  const fromManagerId = String(formData.get("from_manager_id") ?? "").trim();
  const toManagerId = String(formData.get("to_manager_id") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const transferredAt = String(formData.get("transferred_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (
    !fromManagerId ||
    !toManagerId ||
    fromManagerId === toManagerId ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !transferredAt
  ) {
    fail("Merci de choisir deux responsables différents, une date et un montant positif.");
  }

  const { error } = await supabase.from("cash_manager_transfers").insert({
    school_id: appUser.school_id ?? "",
    from_manager_id: fromManagerId,
    to_manager_id: toManagerId,
    amount,
    transferred_at: transferredAt,
    notes,
    created_by: appUser.id,
  });

  if (error) fail("Impossible d'enregistrer le transfert : " + error.message);

  ok("Transfert enregistré.");
}

export async function deleteCashTransfer(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  if (!id) fail("Transfert introuvable.");

  const { error } = await supabase.from("cash_manager_transfers").delete().eq("id", id);

  if (error) fail("Impossible de supprimer le transfert : " + error.message);

  ok("Transfert supprimé.");
}
