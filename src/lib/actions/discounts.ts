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

  if (
    !studentId ||
    !label ||
    !VALID_TYPES.includes(discountType as DiscountType) ||
    !Number.isFinite(value) ||
    value <= 0 ||
    !startsOn ||
    !endsOn ||
    endsOn < startsOn
  ) {
    fail(base, "Merci de renseigner un motif, un type, une valeur positive et une période valide.");
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

  if (
    !id ||
    !label ||
    !VALID_TYPES.includes(discountType as DiscountType) ||
    !Number.isFinite(value) ||
    value <= 0 ||
    !startsOn ||
    !endsOn ||
    endsOn < startsOn
  ) {
    fail(base, "Merci de renseigner un motif, un type, une valeur positive et une période valide.");
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
