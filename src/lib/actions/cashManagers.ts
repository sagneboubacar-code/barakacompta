"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

const SETTINGS_PATH = "/dashboard/settings";

function fail(message: string): never {
  redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message)}`);
}

function ok(message: string): never {
  redirect(`${SETTINGS_PATH}?success=${encodeURIComponent(message)}`);
}

export async function createCashManager(formData: FormData) {
  const appUser = await requireRole(["owner"]);
  const supabase = createServerSupabase();

  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  if (!name) fail("Nom du responsable requis.");

  const { error } = await supabase.from("cash_managers").insert({
    school_id: appUser.school_id ?? "",
    name,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
  });

  if (error) {
    if (error.code === "23505") fail("Un responsable porte déjà ce nom.");
    fail("Impossible de créer le responsable : " + error.message);
  }

  ok("Responsable ajouté.");
}

export async function updateCashManager(formData: FormData) {
  await requireRole(["owner"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  if (!id || !name) fail("Nom du responsable requis.");

  const { error } = await supabase
    .from("cash_managers")
    .update({ name, sort_order: Number.isFinite(sortOrder) ? sortOrder : 0 })
    .eq("id", id);

  if (error) fail("Impossible de modifier le responsable : " + error.message);

  ok("Responsable modifié.");
}

export async function deleteCashManager(formData: FormData) {
  await requireRole(["owner"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  if (!id) fail("Responsable introuvable.");

  // payments.cash_manager_id / expenses.cash_manager_id sont en ON DELETE
  // SET NULL : la suppression détache l'historique sans le casser.
  const { error } = await supabase.from("cash_managers").delete().eq("id", id);

  if (error) fail("Impossible de supprimer le responsable : " + error.message);

  ok("Responsable supprimé.");
}
