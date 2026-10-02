"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

const LIST_PATH = "/dashboard/families";

function fail(base: string, message: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

function ok(base: string, message: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}success=${encodeURIComponent(message)}`);
}

function readFamilyFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    guardian_name: String(formData.get("guardian_name") ?? "").trim() || null,
    guardian_phone: String(formData.get("guardian_phone") ?? "").trim() || null,
  };
}

export async function createFamily(formData: FormData) {
  const appUser = await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const fields = readFamilyFields(formData);
  if (!fields.name) fail(LIST_PATH, "Merci de donner un nom à la famille.");

  const { data, error } = await supabase
    .from("families")
    .insert({ school_id: appUser.school_id ?? "", ...fields })
    .select("id")
    .single();

  if (error || !data) fail(LIST_PATH, "Impossible de créer la famille : " + (error?.message ?? ""));

  ok(`${LIST_PATH}/${data.id}`, "Famille créée. Ajoutez-y maintenant les enfants.");
}

export async function updateFamily(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const base = `${LIST_PATH}/${id}`;
  const fields = readFamilyFields(formData);
  if (!id || !fields.name) fail(base, "Merci de donner un nom à la famille.");

  const { error } = await supabase.from("families").update(fields).eq("id", id);

  if (error) fail(base, "Impossible de modifier la famille : " + error.message);

  ok(base, "Famille mise à jour.");
}

export async function deleteFamily(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  if (!id) fail(LIST_PATH, "Famille introuvable.");

  // Les élèves ne sont pas supprimés : ils sont simplement détachés
  // (ON DELETE SET NULL), et l'enfant pris en charge paie de nouveau ses
  // échéances à venir (voir 0035_familles.sql).
  const { error } = await supabase.from("families").delete().eq("id", id);

  if (error) fail(`${LIST_PATH}/${id}`, "Impossible de supprimer la famille : " + error.message);

  ok(LIST_PATH, "Famille supprimée. Les élèves sont conservés.");
}

// Élèves enregistrés avant la création de la famille : on les rattache sans
// les ressaisir. Un élève déjà dans une autre famille y est retiré (la base
// arrête alors sa prise en charge dans l'ancienne, voir 0036).
export async function attachStudentsToFamily(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const base = `${LIST_PATH}/${id}`;
  if (!id) fail(LIST_PATH, "Famille introuvable.");

  const studentIds = formData
    .getAll("student_ids")
    .map((value) => String(value).trim())
    .filter(Boolean);
  if (studentIds.length === 0) fail(base, "Cochez au moins un élève à rattacher.");

  const { error } = await supabase.from("students").update({ family_id: id }).in("id", studentIds);

  if (error) fail(base, "Impossible de rattacher les élèves : " + error.message);

  ok(base, studentIds.length === 1 ? "Élève rattaché à la famille." : `${studentIds.length} élèves rattachés à la famille.`);
}

export async function detachStudentFromFamily(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const base = `${LIST_PATH}/${id}`;
  if (!id || !studentId) fail(base, "Élève introuvable.");

  const { error } = await supabase
    .from("students")
    .update({ family_id: null })
    .eq("id", studentId)
    .eq("family_id", id);

  if (error) fail(base, "Impossible de retirer l'élève : " + error.message);

  ok(base, "Élève retiré de la famille.");
}

// L'école choisit l'enfant pris en charge — ou aucun : rien n'est
// automatique, certaines familles n'ont pas besoin d'aide.
export async function setFamilyFree(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const base = `${LIST_PATH}/${id}`;
  if (!id) fail(LIST_PATH, "Famille introuvable.");

  const studentId = String(formData.get("student_id") ?? "").trim() || null;
  // "year" : toute l'année scolaire (sauf ce qui est déjà payé) ;
  // "today" : seulement les échéances à partir d'aujourd'hui.
  const fromStart = String(formData.get("scope") ?? "year") !== "today";

  const { error } = await supabase.rpc("set_family_free", {
    p_family_id: id,
    p_student_id: studentId,
    p_from_start: fromStart,
  });

  if (error) fail(base, "Impossible d'enregistrer la prise en charge : " + error.message);

  ok(base, studentId ? "Prise en charge enregistrée." : "Prise en charge retirée.");
}
