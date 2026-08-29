"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { DiscountType } from "@/types";

const VALID_TYPES: DiscountType[] = ["percentage", "fixed_amount"];

function fail(base: string, message: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

function ok(base: string, message: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}success=${encodeURIComponent(message)}`);
}

// Une remise "percentage" au-delà de 100 rendrait un montant dû négatif ;
// starts_on/ends_on sont comparées en chaînes plus bas (format YYYY-MM-DD
// attendu) — on vérifie ici qu'il s'agit bien de dates réelles avant de
// leur faire confiance.
function isValidDiscount(discountType: string, value: number, startsOn: string, endsOn: string): boolean {
  if (!VALID_TYPES.includes(discountType as DiscountType)) return false;
  if (!Number.isFinite(value) || value <= 0) return false;
  if (discountType === "percentage" && value > 100) return false;
  if (isNaN(Date.parse(startsOn)) || isNaN(Date.parse(endsOn))) return false;
  return endsOn >= startsOn;
}

export async function createDiscount(formData: FormData) {
  const appUser = await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const studentId = String(formData.get("student_id") ?? "");
  const base = `/dashboard/students/${studentId}`;

  const label = String(formData.get("label") ?? "").trim();
  const discountType = String(formData.get("discount_type") ?? "");
  const value = Number(formData.get("value"));
  const startsOn = String(formData.get("starts_on") ?? "").trim();
  const endsOn = String(formData.get("ends_on") ?? "").trim();

  if (!studentId || !label || !isValidDiscount(discountType, value, startsOn, endsOn)) {
    fail(
      base,
      "Merci de renseigner un motif, un type, une valeur positive (max 100% pour un pourcentage) et une période valide."
    );
  }

  const { error } = await supabase.from("discounts").insert({
    school_id: appUser.school_id ?? "",
    student_id: studentId,
    label,
    discount_type: discountType as DiscountType,
    value,
    starts_on: startsOn,
    ends_on: endsOn,
    approved_by: appUser.id,
  });

  if (error) fail(base, "Impossible de créer la réduction : " + error.message);

  ok(base, "Réduction ajoutée.");
}

export async function updateDiscount(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const base = `/dashboard/students/${studentId}`;

  const label = String(formData.get("label") ?? "").trim();
  const discountType = String(formData.get("discount_type") ?? "");
  const value = Number(formData.get("value"));
  const startsOn = String(formData.get("starts_on") ?? "").trim();
  const endsOn = String(formData.get("ends_on") ?? "").trim();

  if (!id || !label || !isValidDiscount(discountType, value, startsOn, endsOn)) {
    fail(
      base,
      "Merci de renseigner un motif, un type, une valeur positive (max 100% pour un pourcentage) et une période valide."
    );
  }

  const { error } = await supabase
    .from("discounts")
    .update({
      label,
      discount_type: discountType as DiscountType,
      value,
      starts_on: startsOn,
      ends_on: endsOn,
    })
    .eq("id", id);

  if (error) fail(base, "Impossible de modifier la réduction : " + error.message);

  ok(base, "Réduction mise à jour.");
}

export async function deleteDiscount(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const base = `/dashboard/students/${studentId}`;

  if (!id) fail(base, "Réduction introuvable.");

  const { error } = await supabase.from("discounts").delete().eq("id", id);

  if (error) fail(base, "Impossible de supprimer la réduction : " + error.message);

  ok(base, "Réduction supprimée.");
}
