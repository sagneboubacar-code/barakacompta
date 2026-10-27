"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { SchoolClassCycle } from "@/types";

const SETTINGS_PATH = "/dashboard/settings";
const VALID_CYCLES: SchoolClassCycle[] = ["prescolaire", "elementaire", "college", "lycee"];

function fail(message: string): never {
  redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message)}`);
}

function ok(message: string): never {
  redirect(`${SETTINGS_PATH}?success=${encodeURIComponent(message)}`);
}

export async function createClass(formData: FormData) {
  const appUser = await requireRole(["owner"]);
  const supabase = createServerSupabase();

  const name = String(formData.get("name") ?? "").trim();
  const level = String(formData.get("level") ?? "");
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  if (!name || !VALID_CYCLES.includes(level as SchoolClassCycle)) {
    fail("Nom de classe et cycle requis.");
  }

  // Une classe créée manuellement rejoint l'année scolaire active de l'école.
  const { data: school } = await supabase
    .from("schools")
    .select("school_year_label")
    .eq("id", appUser.school_id ?? "")
    .maybeSingle();

  const { error } = await supabase.from("classes").insert({
    school_id: appUser.school_id ?? "",
    name,
    level: level as SchoolClassCycle,
    academic_year: school?.school_year_label ?? String(new Date().getFullYear()),
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
  });

  if (error) fail("Impossible de créer la classe : " + error.message);

  ok("Classe ajoutée.");
}

export async function updateClass(formData: FormData) {
  await requireRole(["owner"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const level = String(formData.get("level") ?? "");
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  if (!id || !name || !VALID_CYCLES.includes(level as SchoolClassCycle)) {
    fail("Données de classe invalides.");
  }

  const { error } = await supabase
    .from("classes")
    .update({
      name,
      level: level as SchoolClassCycle,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    })
    .eq("id", id);

  if (error) fail("Impossible de modifier la classe : " + error.message);

  ok("Classe modifiée.");
}

export async function deleteClass(formData: FormData) {
  await requireRole(["owner"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  if (!id) fail("Classe introuvable.");

  // students.class_id est en ON DELETE SET NULL : la suppression ne casse
  // pas les élèves déjà affectés, elle les détache simplement de la classe.
  const { error } = await supabase.from("classes").delete().eq("id", id);

  if (error) fail("Impossible de supprimer la classe : " + error.message);

  ok("Classe supprimée.");
}
