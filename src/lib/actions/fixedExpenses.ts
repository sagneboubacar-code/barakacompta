"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES } from "@/lib/constants/expenses";
import { formatMonthLabel } from "@/lib/constants/months";
import { formatCurrency } from "@/lib/format";
import { isPeriod, parseNumber, readFixedExpenses, type FixedExpenseLine } from "@/lib/fixed-expenses";
import type { ExpenseCategory } from "@/types";

const PAGE_PATH = "/dashboard/expenses/fixed";
const VALID_CATEGORIES = EXPENSE_CATEGORIES.map((c) => c.key);

function pagePath(period?: string | null): string {
  return isPeriod(period) ? `${PAGE_PATH}?period=${period}` : PAGE_PATH;
}

function fail(base: string, message: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

function ok(base: string, message: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}success=${encodeURIComponent(message)}`);
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
};

// Enregistre les dépenses fixes cochées pour le mois choisi : une dépense
// normale par ligne, liée à la ligne et au mois. La base refuse une même
// ligne deux fois dans le mois (index uq_expenses_recurring_period).
export async function recordFixedExpenses(formData: FormData) {
  const appUser = await requireRole(["owner", "admin", "accountant"]);
  const supabase = createServerSupabase();

  const period = text(formData, "period");
  const base = pagePath(period);
  const expenseDate = (text(formData, "expense_date") ?? "").trim();
  const cashManagerId = (text(formData, "cash_manager_id") ?? "").trim() || null;

  if (!isPeriod(period)) fail(PAGE_PATH, "Choisissez le mois.");
  if (!expenseDate || isNaN(Date.parse(expenseDate))) fail(base, "Choisissez la date du paiement.");

  const [{ data: lines, error: linesError }, { data: recordedRows, error: recordedError }] = await Promise.all([
    supabase.from("recurring_expenses").select("id, label, category, pay_mode, amount, hourly_rate, internat"),
    supabase.from("expenses").select("recurring_expense_id").eq("period", period).not("recurring_expense_id", "is", null),
  ]);
  if (linesError || recordedError) fail(base, "Lecture impossible : " + (linesError ?? recordedError)!.message);

  const recorded = new Set((recordedRows ?? []).map((row) => row.recurring_expense_id as string));
  const { drafts, invalid, already } = readFixedExpenses((lines ?? []) as FixedExpenseLine[], recorded, {
    get: (name) => text(formData, name),
    getAll: (name) => formData.getAll(name).filter((v): v is string => typeof v === "string"),
  });

  // Rien n'est enregistré tant qu'une ligne cochée est incomplète : on ne
  // veut pas d'un mois à moitié saisi.
  if (invalid.length > 0) fail(base, `Montant ou heures manquants pour : ${invalid.join(", ")}.`);
  if (drafts.length === 0) {
    fail(base, already.length > 0 ? `Déjà enregistré ce mois-ci : ${already.join(", ")}.` : "Cochez au moins une dépense.");
  }

  const { error } = await supabase.from("expenses").insert(
    drafts.map((draft) => ({
      school_id: appUser.school_id ?? "",
      category: draft.line.category,
      label: draft.line.label,
      amount: draft.amount,
      expense_date: expenseDate,
      paid_by: appUser.id,
      cash_manager_id: cashManagerId,
      internat: draft.line.internat,
      recurring_expense_id: draft.line.id,
      period,
      hours: draft.hours,
    }))
  );

  if (error) {
    // Double clic, ou quelqu'un d'autre vient d'enregistrer le même mois.
    if (error.code === "23505") {
      fail(base, "Une de ces dépenses vient déjà d'être enregistrée pour ce mois. Rien n'a été ajouté : vérifiez la liste.");
    }
    fail(base, "Impossible d'enregistrer les dépenses : " + error.message);
  }

  const { data: school } = await supabase
    .from("schools")
    .select("currency")
    .eq("id", appUser.school_id ?? "")
    .maybeSingle();
  const total = drafts.reduce((sum, draft) => sum + draft.amount, 0);
  ok(
    base,
    `${drafts.length} dépense${drafts.length > 1 ? "s" : ""} enregistrée${drafts.length > 1 ? "s" : ""} pour ${formatMonthLabel(
      period,
      "fr"
    )} (${formatCurrency(total, school?.currency, "fr")}).`
  );
}

// ---- La liste (propriétaire et administrateur) ---------------------------------

function readLine(formData: FormData, base: string) {
  const label = (text(formData, "label") ?? "").trim();
  const category = text(formData, "category") ?? "";
  const payMode = text(formData, "pay_mode") === "hourly" ? "hourly" : "fixed";
  const amount = parseNumber(text(formData, "amount"));
  const hourlyRate = parseNumber(text(formData, "hourly_rate"));
  const internat = formData.get("internat") === "on";

  if (!label || !VALID_CATEGORIES.includes(category as ExpenseCategory)) {
    fail(base, "Merci de renseigner un nom et une catégorie.");
  }
  if (payMode === "fixed" && !(amount > 0)) fail(base, "Merci de renseigner le montant mensuel.");
  if (payMode === "hourly" && !(hourlyRate > 0)) fail(base, "Merci de renseigner le taux horaire.");

  return {
    label,
    category: category as ExpenseCategory,
    pay_mode: payMode as "fixed" | "hourly",
    // Une ligne à l'heure garde 0 comme montant fixe : seul le taux compte.
    amount: payMode === "fixed" ? Math.round(amount) : 0,
    hourly_rate: payMode === "hourly" ? hourlyRate : null,
    internat,
  };
}

export async function createFixedExpenseLine(formData: FormData) {
  const appUser = await requireRole(["owner", "admin"]);
  const base = pagePath(text(formData, "period"));
  const supabase = createServerSupabase();

  const line = readLine(formData, base);
  const { error } = await supabase.from("recurring_expenses").insert({ school_id: appUser.school_id ?? "", ...line });
  if (error) fail(base, "Impossible d'ajouter la dépense fixe : " + error.message);

  ok(base, `« ${line.label} » ajoutée à la liste.`);
}

export async function updateFixedExpenseLine(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const base = pagePath(text(formData, "period"));
  const supabase = createServerSupabase();

  const id = text(formData, "id") ?? "";
  if (!id) fail(base, "Dépense fixe introuvable.");
  const line = readLine(formData, base);

  // Ne touche pas aux dépenses déjà enregistrées : un nouveau montant vaut
  // pour les mois à venir.
  const { error } = await supabase.from("recurring_expenses").update(line).eq("id", id);
  if (error) fail(base, "Impossible de modifier la dépense fixe : " + error.message);

  ok(base, `« ${line.label} » modifiée.`);
}

export async function deleteFixedExpenseLine(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const base = pagePath(text(formData, "period"));
  const supabase = createServerSupabase();

  const id = text(formData, "id") ?? "";
  if (!id) fail(base, "Dépense fixe introuvable.");

  // Les dépenses déjà enregistrées restent (expenses.recurring_expense_id
  // passe à null) : elles appartiennent à la comptabilité.
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  if (error) fail(base, "Impossible de supprimer la dépense fixe : " + error.message);

  ok(base, "Dépense fixe retirée de la liste. Les dépenses déjà enregistrées restent.");
}
