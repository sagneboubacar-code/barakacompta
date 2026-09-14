"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { chercherProspects } from "@/lib/prospection/agent";

const PATH = "/admin/prospection";

function fail(message: string): never {
  redirect(`${PATH}?error=${encodeURIComponent(message)}`);
}

export async function lancerProspection(formData: FormData) {
  await requireRole(["super_admin"]);

  const zone = String(formData.get("zone") ?? "").trim();
  if (!zone) {
    fail("Indiquez une zone ou un type d'école à chercher.");
  }

  const admin = createAdminClient();

  // On transmet les noms déjà connus à l'agent : sans ça il repropose les
  // mêmes annuaires et donc les mêmes écoles à chaque recherche.
  const { data: existants } = await admin.from("prospects").select("nom");
  const dejaConnus = (existants ?? []).map((p) => p.nom);

  let resultat;
  try {
    resultat = await chercherProspects({ zone, maxProspects: 10, dejaConnus });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[prospection] échec", error);
    fail(message);
  }

  if (resultat.prospects.length === 0) {
    redirect(`${PATH}?vide=1&zone=${encodeURIComponent(zone)}`);
  }

  // `upsert` sur (nom, ville) : une école déjà en base garde son statut et ses
  // notes, on ne les écrase pas avec une nouvelle recherche.
  const lignes = resultat.prospects.map((p) => ({
    nom: p.nom,
    ville: p.ville || null,
    quartier: p.quartier || null,
    telephone: p.telephone || null,
    email: p.email || null,
    email_fiable: p.email_fiable,
    type_etablissement: p.type_etablissement || null,
    source_url: p.source_url,
    score: p.score,
    pourquoi: p.pourquoi,
    accroche: p.accroche,
    recherche: zone,
  }));

  const { error } = await admin
    .from("prospects")
    .upsert(lignes, { onConflict: "nom,ville", ignoreDuplicates: true });

  if (error) {
    fail("Prospects trouvés mais impossible de les enregistrer : " + error.message);
  }

  revalidatePath(PATH);
  redirect(`${PATH}?ajoutes=${resultat.prospects.length}`);
}

export async function changerStatutProspect(formData: FormData) {
  await requireRole(["super_admin"]);

  const id = String(formData.get("id") ?? "");
  const statut = String(formData.get("statut") ?? "");
  const valides = ["nouveau", "contacte", "interesse", "refuse", "client"] as const;
  type Statut = (typeof valides)[number];

  if (!id || !valides.includes(statut as Statut)) {
    fail("Statut invalide.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("prospects")
    .update({ statut: statut as Statut })
    .eq("id", id);

  if (error) fail("Impossible de mettre à jour : " + error.message);

  revalidatePath(PATH);
  redirect(PATH);
}

export async function supprimerProspect(formData: FormData) {
  await requireRole(["super_admin"]);

  const id = String(formData.get("id") ?? "");
  if (!id) fail("Prospect introuvable.");

  const admin = createAdminClient();
  const { error } = await admin.from("prospects").delete().eq("id", id);

  if (error) fail("Impossible de supprimer : " + error.message);

  revalidatePath(PATH);
  redirect(PATH);
}
