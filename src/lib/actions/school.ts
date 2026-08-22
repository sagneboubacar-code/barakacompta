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

export async function updateSchoolInfo(formData: FormData) {
  const appUser = await requireRole(["owner"]);
  const supabase = createServerSupabase();

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const country = String(formData.get("country") ?? "").trim() || null;
  const currency = String(formData.get("currency") ?? "").trim();

  if (!name || !currency) {
    fail("Le nom de l'école et la devise sont obligatoires.");
  }

  const { error } = await supabase
    .from("schools")
    .update({ name, address, phone, email, country, currency })
    .eq("id", appUser.school_id ?? "");

  if (error) fail("Impossible de mettre à jour l'école : " + error.message);

  ok("Informations générales mises à jour.");
}

export async function updateSchoolYear(formData: FormData) {
  const appUser = await requireRole(["owner"]);
  const supabase = createServerSupabase();

  const label = String(formData.get("school_year_label") ?? "").trim();
  const startMonth = Number(formData.get("school_year_start_month"));
  const endMonth = Number(formData.get("school_year_end_month"));

  const monthsValid =
    Number.isInteger(startMonth) &&
    Number.isInteger(endMonth) &&
    startMonth >= 1 &&
    startMonth <= 12 &&
    endMonth >= 1 &&
    endMonth <= 12;

  if (!label || !monthsValid) {
    fail("Année scolaire invalide.");
  }

  const { error } = await supabase
    .from("schools")
    .update({
      school_year_label: label,
      school_year_start_month: startMonth,
      school_year_end_month: endMonth,
    })
    .eq("id", appUser.school_id ?? "");

  if (error) fail("Impossible de mettre à jour l'année scolaire : " + error.message);

  ok("Année scolaire mise à jour.");
}

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 Mo
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function uploadSchoolLogo(formData: FormData) {
  const appUser = await requireRole(["owner"]);
  const supabase = createServerSupabase();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    fail("Merci de sélectionner un fichier.");
  }
  if (file.size > MAX_LOGO_SIZE) {
    fail("Le logo ne doit pas dépasser 2 Mo.");
  }
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    fail("Format non supporté (PNG, JPEG, WEBP ou SVG uniquement).");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  // Convention de chemin exigée par les policies Storage : <school_id>/<fichier>.
  const path = `${appUser.school_id}/logo-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("school-logos")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) fail("Échec de l'envoi du logo : " + uploadError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("school-logos").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("schools")
    .update({ logo_url: publicUrl })
    .eq("id", appUser.school_id ?? "");

  if (updateError) fail("Logo envoyé mais impossible de l'enregistrer : " + updateError.message);

  ok("Logo mis à jour.");
}
