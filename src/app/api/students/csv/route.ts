import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { sortByCycle } from "@/lib/constants/cycles";
import { toCsvRow, buildCsvResponse } from "@/lib/reports/csv";

export async function GET(request: NextRequest) {
  const appUser = await requireRole(["owner", "admin"]);
  const supabase = createClient();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().replace(/[,()%]/g, "");
  const cycle = searchParams.get("cycle") ?? undefined;
  const classId = searchParams.get("class_id") ?? undefined;
  const regime = searchParams.get("regime") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const [{ data: school }, { data: rawClasses }] = await Promise.all([
    supabase.from("schools").select("name").eq("id", appUser.school_id ?? "").maybeSingle(),
    supabase.from("classes").select("id, name, level, sort_order").order("sort_order"),
  ]);
  const classes = sortByCycle(rawClasses ?? []);

  let query = supabase
    .from("students")
    .select("matricule, first_name, last_name, regime, status, date_of_birth, place_of_birth, guardian_phone")
    .order("first_name")
    .order("last_name");

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,matricule.ilike.%${q}%`);
  }
  if (classId) {
    query = query.eq("class_id", classId);
  } else if (cycle) {
    const classIds = classes.filter((c) => c.level === cycle).map((c) => c.id);
    query = query.in("class_id", classIds.length > 0 ? classIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (regime === "externat" || regime === "internat") {
    query = query.eq("regime", regime);
  }
  if (status === "active" || status === "inactive") {
    query = query.eq("status", status);
  }

  const { data: students } = await query;
  const selectedClass = classes.find((c) => c.id === classId);

  const lines: string[] = [];
  lines.push(
    toCsvRow([`Liste nominative${selectedClass ? ` — ${selectedClass.name}` : ""} — ${school?.name ?? ""}`])
  );
  lines.push("");
  lines.push(
    toCsvRow(["Matricule", "Prénom", "Nom", "Date de naissance", "Lieu de naissance", "Numéro parent"])
  );

  for (const student of students ?? []) {
    lines.push(
      toCsvRow([
        student.matricule ?? "",
        student.first_name,
        student.last_name,
        student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("fr-FR") : "",
        student.place_of_birth ?? "",
        student.guardian_phone ?? "",
      ])
    );
  }

  if (!students || students.length === 0) {
    return NextResponse.json({ error: "Aucun élève ne correspond à ces critères." }, { status: 404 });
  }

  const fileSuffix = selectedClass ? selectedClass.name.replace(/[^a-z0-9]+/gi, "-") : "tous";
  return buildCsvResponse(lines, `liste-nominative-${fileSuffix}.csv`);
}
