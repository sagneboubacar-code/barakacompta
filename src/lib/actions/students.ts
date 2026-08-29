"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getPlan } from "@/lib/constants/plans";
import type { FeeRegime, StudentStatus } from "@/types";

const LIST_PATH = "/dashboard/students";
const VALID_REGIMES: FeeRegime[] = ["externat", "internat"];
const VALID_STATUSES: StudentStatus[] = ["active", "inactive"];
const VALID_GENDERS = ["M", "F"];

function targetPath(formData: FormData, fallback: string): string {
  const redirectTo = String(formData.get("redirect_to") ?? fallback);
  return redirectTo.startsWith("/dashboard/students") ? redirectTo : fallback;
}

function fail(base: string, message: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

function ok(base: string, message: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}success=${encodeURIComponent(message)}`);
}

function readStudentFields(formData: FormData) {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const gender = String(formData.get("gender") ?? "");
  const dateOfBirth = String(formData.get("date_of_birth") ?? "").trim() || null;
  const placeOfBirth = String(formData.get("place_of_birth") ?? "").trim() || null;
  const classId = String(formData.get("class_id") ?? "").trim() || null;
  const regime = String(formData.get("regime") ?? "externat");
  const guardianName = String(formData.get("guardian_name") ?? "").trim() || null;
  const guardianPhone = String(formData.get("guardian_phone") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const enrolledAt = String(formData.get("enrolled_at") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "active");
  const subscribesCantine = formData.get("subscribes_cantine") === "on";
  const subscribesTransport = formData.get("subscribes_transport") === "on";

  const valid =
    !!firstName &&
    !!lastName &&
    VALID_GENDERS.includes(gender) &&
    VALID_REGIMES.includes(regime as FeeRegime) &&
    VALID_STATUSES.includes(status as StudentStatus) &&
    (dateOfBirth === null || !isNaN(Date.parse(dateOfBirth))) &&
    (enrolledAt === null || !isNaN(Date.parse(enrolledAt)));

  return {
    valid,
    fields: {
      first_name: firstName,
      last_name: lastName,
      gender: gender as "M" | "F",
      date_of_birth: dateOfBirth,
      place_of_birth: placeOfBirth,
      class_id: classId,
      regime: regime as FeeRegime,
      guardian_name: guardianName,
      guardian_phone: guardianPhone,
      address,
      enrolled_at: enrolledAt ?? undefined,
      status: status as StudentStatus,
      subscribes_cantine: subscribesCantine,
      subscribes_transport: subscribesTransport,
    },
  };
}

export async function createStudent(formData: FormData) {
  const appUser = await requireRole(["owner", "admin"]);
  const base = targetPath(formData, LIST_PATH);
  const supabase = createServerSupabase();

  const { valid, fields } = readStudentFields(formData);
  if (!valid) {
    fail(base, "Merci de renseigner au minimum le prénom, le nom, le sexe, le régime et le statut.");
  }

  const { data: school } = await supabase
    .from("schools")
    .select("plan")
    .eq("id", appUser.school_id ?? "")
    .maybeSingle();
  const maxStudents = getPlan(school?.plan ?? "trial").maxStudents;

  if (maxStudents !== null) {
    const { count: activeStudentCount } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    if ((activeStudentCount ?? 0) >= maxStudents) {
      fail(
        base,
        `Limite de ${maxStudents} élèves atteinte pour votre plan. Passez à un plan supérieur pour continuer.`
      );
    }
  }

  // matricule volontairement absent : généré par le trigger DB (voir 0005_students_module.sql).
  const { error } = await supabase.from("students").insert({
    school_id: appUser.school_id ?? "",
    ...fields,
  });

  if (error) fail(base, "Impossible de créer l'élève : " + error.message);

  ok(base, "Élève ajouté.");
}

export async function updateStudent(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const id = String(formData.get("id") ?? "");
  const base = targetPath(formData, `/dashboard/students/${id}`);
  const supabase = createServerSupabase();

  const { valid, fields } = readStudentFields(formData);
  if (!id || !valid) {
    fail(base, "Merci de renseigner au minimum le prénom, le nom, le sexe, le régime et le statut.");
  }

  const { error } = await supabase.from("students").update(fields).eq("id", id);

  if (error) fail(base, "Impossible de modifier l'élève : " + error.message);

  ok(base, "Fiche élève mise à jour.");
}

export async function deleteStudent(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  if (!id) fail(LIST_PATH, "Élève introuvable.");

  // Supprime aussi en cascade les paiements/échéanciers/remises de l'élève
  // (contraintes ON DELETE CASCADE définies en 0001_init.sql).
  const { error } = await supabase.from("students").delete().eq("id", id);

  if (error) fail(LIST_PATH, "Impossible de supprimer l'élève : " + error.message);

  ok(LIST_PATH, "Élève supprimé.");
}

// Régénère l'échéancier d'un élève (frais d'inscription + mensualités) pour
// l'année scolaire active — idempotent, à rejouer quand une classe change
// ou qu'une nouvelle année scolaire démarre pour cet élève.
export async function regenerateStudentSchedule(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const id = String(formData.get("id") ?? "");
  const base = targetPath(formData, `/dashboard/students/${id}`);
  const supabase = createServerSupabase();

  if (!id) fail(base, "Élève introuvable.");

  const { error } = await supabase.rpc("generate_student_schedule", {
    p_student_id: id,
    p_academic_year: null,
  });

  if (error) fail(base, "Impossible de générer l'échéancier : " + error.message);

  ok(base, "Échéancier généré.");
}
