// Script de vérification manuelle de l'isolation multi-tenant (RLS) et des
// restrictions de rôle. Nécessite un vrai projet Supabase avec les
// migrations 0001/0002 appliquées.
//
// Utilisation :
//   NEXT_PUBLIC_SUPABASE_URL=...
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
//   SUPABASE_SERVICE_ROLE_KEY=...
//   npx tsx scripts/test-tenant-isolation.ts
//
// Charge automatiquement .env.local s'il existe.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // pas de .env.local : on suppose que les variables sont déjà dans l'environnement.
}

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

type TeamClients = {
  schoolId: string;
  userIds: string[];
  ownerClient: SupabaseClient<Database>;
  adminClient: SupabaseClient<Database>;
  accountantClient: SupabaseClient<Database>;
};

async function createSchoolWithTeam(
  admin: SupabaseClient<Database>,
  url: string,
  anonKey: string,
  name: string,
  tag: string
): Promise<TeamClients> {
  const password = "Test1234!";

  const ownerEmail = `owner-${tag}@example.test`;
  const { data: ownerCreated, error: ownerErr } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password,
    email_confirm: true,
  });
  if (ownerErr || !ownerCreated.user) {
    throw new Error(`Impossible de créer l'owner de "${name}": ${ownerErr?.message}`);
  }

  const { data: schoolId, error: rpcErr } = await admin.rpc("create_school_with_owner", {
    p_school_name: name,
    p_school_slug: `test-${tag}`,
    p_owner_id: ownerCreated.user.id,
    p_owner_email: ownerEmail,
    p_owner_full_name: `Owner ${tag}`,
  });
  if (rpcErr || !schoolId) {
    throw new Error(`Impossible de créer l'école "${name}": ${rpcErr?.message}`);
  }

  async function createMember(role: "admin" | "accountant") {
    const email = `${role}-${tag}@example.test`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !created.user) {
      throw new Error(`Impossible de créer ${role} pour "${name}": ${error?.message}`);
    }
    const { error: insertErr } = await admin.from("users").insert({
      id: created.user.id,
      school_id: schoolId as string,
      email,
      full_name: `${role} ${tag}`,
      role,
    });
    if (insertErr) {
      throw new Error(`Impossible d'attacher ${role} à "${name}": ${insertErr.message}`);
    }
    return created.user.id;
  }

  const adminId = await createMember("admin");
  const accountantId = await createMember("accountant");

  async function signIn(email: string) {
    const client = createClient<Database>(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(`Connexion impossible pour ${email}: ${error.message}`);
    }
    return client;
  }

  return {
    schoolId: schoolId as string,
    userIds: [ownerCreated.user.id, adminId, accountantId],
    ownerClient: await signIn(ownerEmail),
    adminClient: await signIn(`admin-${tag}@example.test`),
    accountantClient: await signIn(`accountant-${tag}@example.test`),
  };
}

async function cleanup(admin: SupabaseClient<Database>, schools: TeamClients[]) {
  for (const school of schools) {
    await admin.from("schools").delete().eq("id", school.schoolId);
    for (const id of school.userIds) {
      await admin.auth.admin.deleteUser(id);
    }
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    console.error(
      "Variables manquantes : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const suffix = Math.random().toString(36).slice(2, 8);
  console.log("Création des écoles fictives de test...");
  const schoolA = await createSchoolWithTeam(admin, url, anonKey, `École Test A ${suffix}`, `a-${suffix}`);
  const schoolB = await createSchoolWithTeam(admin, url, anonKey, `École Test B ${suffix}`, `b-${suffix}`);

  try {
    console.log("\n-- Isolation des écoles --");
    {
      const { data } = await schoolA.ownerClient
        .from("schools")
        .select("id")
        .eq("id", schoolB.schoolId)
        .maybeSingle();
      check("Owner A ne peut pas lire l'école B", data === null);
    }
    {
      const { data } = await schoolA.ownerClient
        .from("schools")
        .select("id")
        .eq("id", schoolA.schoolId)
        .maybeSingle();
      check("Owner A peut lire sa propre école", data?.id === schoolA.schoolId);
    }

    console.log("\n-- Classes par défaut (pré-remplies à la création) --");
    {
      const { data: defaultClasses } = await schoolA.ownerClient.from("classes").select("id, level");
      check(
        "16 classes par défaut ont été créées pour l'école A",
        (defaultClasses ?? []).length === 16,
        `obtenu : ${(defaultClasses ?? []).length}`
      );
      const cycles = new Set((defaultClasses ?? []).map((c) => c.level));
      check(
        "Les 4 cycles (préscolaire/élémentaire/collège/lycée) sont représentés",
        ["prescolaire", "elementaire", "college", "lycee"].every((c) => cycles.has(c as never))
      );
    }

    console.log("\n-- Isolation des données métier (classes) --");
    const { data: classA, error: classAErr } = await schoolA.ownerClient
      .from("classes")
      .insert({ school_id: schoolA.schoolId, name: "CP1", academic_year: "2025-2026" })
      .select("id")
      .single();
    check("Owner A peut créer une classe dans son école", !classAErr && !!classA, classAErr?.message);

    const { data: classFromB } = await schoolB.ownerClient
      .from("classes")
      .select("id")
      .eq("id", classA?.id ?? "")
      .maybeSingle();
    check("Owner B ne voit pas la classe de l'école A", classFromB === null);

    const { data: updatedRows } = await schoolB.ownerClient
      .from("classes")
      .update({ name: "Hack" })
      .eq("id", classA?.id ?? "")
      .select("id");
    check("Owner B ne peut pas modifier la classe de l'école A", (updatedRows ?? []).length === 0);

    const { data: deletedRows } = await schoolB.ownerClient
      .from("classes")
      .delete()
      .eq("id", classA?.id ?? "")
      .select("id");
    check("Owner B ne peut pas supprimer la classe de l'école A", (deletedRows ?? []).length === 0);

    const { data: crossInsert, error: crossErr } = await schoolA.ownerClient
      .from("classes")
      .insert({ school_id: schoolB.schoolId, name: "Intrusion", academic_year: "2025-2026" })
      .select("id");
    check(
      "Owner A ne peut pas créer une classe pour l'école B (WITH CHECK)",
      !!crossErr || (crossInsert ?? []).length === 0
    );

    console.log("\n-- Restrictions par rôle --");
    const { data: accClassInsert, error: accClassErr } = await schoolA.accountantClient
      .from("classes")
      .insert({ school_id: schoolA.schoolId, name: "CE1", academic_year: "2025-2026" })
      .select("id");
    check(
      "Le comptable de l'école A ne peut pas créer de classe",
      !!accClassErr || (accClassInsert ?? []).length === 0
    );

    const { data: student, error: studentErr } = await schoolA.adminClient
      .from("students")
      .insert({ school_id: schoolA.schoolId, first_name: "Aminata", last_name: "Diallo" })
      .select("id")
      .single();
    check("Admin A peut créer un élève", !studentErr && !!student, studentErr?.message);

    const { data: payment, error: paymentErr } = await schoolA.accountantClient
      .from("payments")
      .insert({ school_id: schoolA.schoolId, student_id: student?.id ?? "", amount: 5000 })
      .select("id")
      .single();
    check(
      "Le comptable de l'école A peut enregistrer un paiement",
      !paymentErr && !!payment,
      paymentErr?.message
    );

    const { data: delRows } = await schoolA.accountantClient
      .from("payments")
      .delete()
      .eq("id", payment?.id ?? "")
      .select("id");
    check(
      "Le comptable ne peut pas supprimer un paiement (réservé owner/admin)",
      (delRows ?? []).length === 0
    );

    const { data: paymentFromB } = await schoolB.ownerClient
      .from("payments")
      .select("id")
      .eq("id", payment?.id ?? "")
      .maybeSingle();
    check("Owner B ne voit pas le paiement de l'école A", paymentFromB === null);

    console.log("\n-- Paramètres école (owner uniquement) --");
    const { data: adminSettingsRows } = await schoolA.adminClient
      .from("schools")
      .update({ phone: "000" })
      .eq("id", schoolA.schoolId)
      .select("id");
    check(
      "Un admin (non owner) ne peut pas modifier les paramètres de l'école",
      (adminSettingsRows ?? []).length === 0
    );

    const { data: ownerSettingsRows, error: ownerSettingsErr } = await schoolA.ownerClient
      .from("schools")
      .update({ phone: "+225 00 00 00 00" })
      .eq("id", schoolA.schoolId)
      .select("id");
    check(
      "Le owner peut modifier les paramètres de son école",
      !ownerSettingsErr && (ownerSettingsRows ?? []).length === 1,
      ownerSettingsErr?.message
    );

    console.log("\n-- Isolation de la table users --");
    const { data: crossUsers } = await schoolA.ownerClient
      .from("users")
      .select("id")
      .eq("school_id", schoolB.schoolId);
    check("Owner A ne voit aucun utilisateur de l'école B", (crossUsers ?? []).length === 0);
  } finally {
    console.log("\nNettoyage des données de test...");
    await cleanup(admin, [schoolA, schoolB]);
  }

  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erreur fatale du script de test :", err);
  process.exit(1);
});
