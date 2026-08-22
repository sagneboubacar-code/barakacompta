"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import {
  FEE_TYPES,
  REGIMES,
  feeTypeLabel,
  mensualiteMonthLabel,
  mensualiteMonthsForSchoolYear,
} from "@/lib/constants/fees";
import type { FeeRegime, FeeType } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const DEFAULT_PATH = "/dashboard/fee-structures";
const VALID_REGIMES = REGIMES.map((r) => r.key);
const VALID_FEE_TYPES = FEE_TYPES.map((f) => f.key);

// Champs du tableau "par classe" : Inscription + Uniforme (frais ponctuels,
// month=0) puis une mensualité distincte par mois, calculée selon les mois
// de début/fin d'année scolaire propres à l'école (Paramètres).
async function classFeeFields(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<{ key: string; feeType: FeeType; month: number }[]> {
  const { data: school } = await supabase
    .from("schools")
    .select("school_year_start_month, school_year_end_month")
    .eq("id", schoolId)
    .maybeSingle();

  const months = mensualiteMonthsForSchoolYear(
    school?.school_year_start_month ?? 9,
    school?.school_year_end_month ?? 6
  );

  return [
    { key: "inscription", feeType: "inscription", month: 0 },
    { key: "uniforme", feeType: "uniforme", month: 0 },
    ...months.map((m) => ({ key: `mensualite_${m.month}`, feeType: "mensualite" as FeeType, month: m.month })),
  ];
}

// Les formulaires transmettent le chemin+filtres courants dans un champ
// caché "redirect_to" pour qu'une édition ne réinitialise pas les filtres
// actifs (cycle/classe/année). On restreint la cible au préfixe attendu :
// c'est un champ de formulaire, donc en théorie manipulable côté client.
function targetPath(formData: FormData): string {
  const redirectTo = String(formData.get("redirect_to") ?? DEFAULT_PATH);
  return redirectTo.startsWith(DEFAULT_PATH) ? redirectTo : DEFAULT_PATH;
}

function fail(base: string, message: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

function ok(base: string, message: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}success=${encodeURIComponent(message)}`);
}

// Enregistre en une fois les 12 colonnes du tableau (Inscription, Uniforme,
// 10 mensualités) pour une classe+régime+année : une case remplie est
// upsertée, une case vidée supprime le tarif correspondant s'il existait.
export async function upsertClassFees(formData: FormData) {
  const appUser = await requireRole(["owner", "admin"]);
  const base = targetPath(formData);
  const supabase = createServerSupabase();

  const classId = String(formData.get("class_id") ?? "");
  const regime = String(formData.get("regime") ?? "");
  const academicYear = String(formData.get("academic_year") ?? "").trim();

  if (!classId || !VALID_REGIMES.includes(regime as FeeRegime) || !academicYear) {
    fail(base, "Classe, régime et année scolaire requis.");
  }

  const fields = await classFeeFields(supabase, appUser.school_id ?? "");

  for (const field of fields) {
    const raw = String(formData.get(field.key) ?? "").trim();

    if (raw === "") {
      await supabase
        .from("fee_structures")
        .delete()
        .eq("class_id", classId)
        .eq("regime", regime as FeeRegime)
        .eq("academic_year", academicYear)
        .eq("fee_type", field.feeType)
        .eq("month", field.month);
      continue;
    }

    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      fail(base, `Montant invalide pour ${field.key}.`);
    }

    const label =
      field.month > 0
        ? `${feeTypeLabel(field.feeType)} — ${mensualiteMonthLabel(field.month)}`
        : feeTypeLabel(field.feeType);

    const { error } = await supabase.from("fee_structures").upsert(
      {
        school_id: appUser.school_id ?? "",
        class_id: classId,
        regime: regime as FeeRegime,
        fee_type: field.feeType,
        month: field.month,
        academic_year: academicYear,
        label,
        amount,
      },
      { onConflict: "school_id,class_id,regime,fee_type,academic_year,month" }
    );

    if (error) fail(base, "Impossible d'enregistrer le tarif : " + error.message);
  }

  ok(base, "Tarifs mis à jour.");
}

// Frais "autres" (cantine, internat, transport, autre) : formulaire ligne à
// ligne conservé, distinct du tableau principal.
export async function createFeeStructure(formData: FormData) {
  const appUser = await requireRole(["owner", "admin"]);
  const base = targetPath(formData);
  const supabase = createServerSupabase();

  const classId = String(formData.get("class_id") ?? "");
  const regime = String(formData.get("regime") ?? "");
  const feeType = String(formData.get("fee_type") ?? "");
  const academicYear = String(formData.get("academic_year") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const installmentsAllowed = formData.get("installments_allowed") === "on";

  if (
    !classId ||
    !VALID_REGIMES.includes(regime as FeeRegime) ||
    !VALID_FEE_TYPES.includes(feeType as FeeType) ||
    !academicYear ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    fail(base, "Merci de renseigner une classe, un régime, un type de frais, une année et un montant valides.");
  }

  const { error } = await supabase.from("fee_structures").insert({
    school_id: appUser.school_id ?? "",
    class_id: classId,
    regime: regime as FeeRegime,
    fee_type: feeType as FeeType,
    academic_year: academicYear,
    label: feeTypeLabel(feeType),
    amount,
    installments_allowed: installmentsAllowed,
  });

  if (error) {
    if (error.code === "23505") {
      fail(base, "Un tarif existe déjà pour cette classe/régime/type de frais/année.");
    }
    fail(base, "Impossible de créer le tarif : " + error.message);
  }

  ok(base, "Tarif ajouté.");
}

export async function updateFeeStructureAmount(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const base = targetPath(formData);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const amount = Number(formData.get("amount"));
  const installmentsAllowed = formData.get("installments_allowed") === "on";

  if (!id || !Number.isFinite(amount) || amount < 0) {
    fail(base, "Montant invalide.");
  }

  const { error } = await supabase
    .from("fee_structures")
    .update({ amount, installments_allowed: installmentsAllowed })
    .eq("id", id);

  if (error) fail(base, "Impossible de modifier le tarif : " + error.message);

  ok(base, "Tarif mis à jour.");
}

export async function deleteFeeStructure(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const base = targetPath(formData);
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  if (!id) fail(base, "Tarif introuvable.");

  const { error } = await supabase.from("fee_structures").delete().eq("id", id);

  if (error) fail(base, "Impossible de supprimer le tarif : " + error.message);

  ok(base, "Tarif supprimé.");
}
