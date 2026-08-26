import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { cycleLabel } from "@/lib/constants/cycles";
import type { Language } from "@/lib/i18n/config";

type ScheduleRow = {
  student_id: string;
  due_date: string;
  amount_remaining: number;
  status: string;
};

export type CollectionsColorStatus = "vert" | "orange" | "rouge";

export interface CollectionsRow {
  id: string;
  name: string;
  className: string;
  cycle: string;
  guardianName: string;
  guardianPhone: string;
  totalRemaining: number;
  colorStatus: CollectionsColorStatus;
}

export interface CollectionsReport {
  rows: CollectionsRow[];
  availableMonths: string[];
  selectedMonth: string;
  overdueCount: number;
  totalDue: number;
}

function defaultMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Partagé entre la page /dashboard/collections et son export CSV, pour que
// les deux restent exactement cohérents avec les mêmes filtres.
export async function computeCollectionsReport(
  supabase: SupabaseClient<Database>,
  filters: { cycle?: string; classId?: string; month?: string },
  language: Language = "fr"
): Promise<CollectionsReport> {
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, level, sort_order")
    .order("level")
    .order("sort_order");

  let studentsQuery = supabase
    .from("students")
    .select("id, first_name, last_name, class_id, guardian_name, guardian_phone, classes(name, level)")
    .eq("status", "active")
    .order("last_name");

  if (filters.classId) {
    studentsQuery = studentsQuery.eq("class_id", filters.classId);
  } else if (filters.cycle) {
    const classIds = (classes ?? []).filter((c) => c.level === filters.cycle).map((c) => c.id);
    studentsQuery = studentsQuery.in(
      "class_id",
      classIds.length > 0 ? classIds : ["00000000-0000-0000-0000-000000000000"]
    );
  }

  // "Recouvrement" = dettes déjà exigibles aujourd'hui, pas les mensualités
  // futures qui n'ont pas encore d'échéance passée.
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: students }, { data: schedules }] = await Promise.all([
    studentsQuery,
    supabase
      .from("payment_schedules")
      .select("student_id, due_date, amount_remaining, status")
      .neq("status", "cancelled")
      .lte("due_date", today),
  ]);

  const schedulesByStudent = new Map<string, ScheduleRow[]>();
  const monthsSet = new Set<string>();
  for (const schedule of schedules ?? []) {
    const list = schedulesByStudent.get(schedule.student_id) ?? [];
    list.push(schedule);
    schedulesByStudent.set(schedule.student_id, list);
    monthsSet.add(schedule.due_date.slice(0, 7));
  }
  const availableMonths = Array.from(monthsSet).sort();
  const selectedMonth = filters.month || defaultMonth();

  const rows: CollectionsRow[] = (students ?? []).map((student) => {
    const klass = Array.isArray(student.classes) ? student.classes[0] : student.classes;
    const studentSchedules = schedulesByStudent.get(student.id) ?? [];
    const monthSchedules = studentSchedules.filter((s) => s.due_date.slice(0, 7) === selectedMonth);
    const totalRemaining = monthSchedules.reduce((sum, s) => sum + s.amount_remaining, 0);

    let colorStatus: CollectionsColorStatus = "vert";
    if (monthSchedules.some((s) => s.status === "pending" || s.status === "overdue")) {
      colorStatus = "rouge";
    } else if (monthSchedules.some((s) => s.status === "partial")) {
      colorStatus = "orange";
    }

    return {
      id: student.id,
      name: `${student.last_name} ${student.first_name}`,
      className: klass?.name ?? "—",
      cycle: cycleLabel(klass?.level ?? null, language),
      guardianName: student.guardian_name ?? "—",
      guardianPhone: student.guardian_phone ?? "—",
      totalRemaining,
      colorStatus,
    };
  });

  return {
    rows,
    availableMonths,
    selectedMonth,
    overdueCount: rows.filter((r) => r.colorStatus === "rouge").length,
    totalDue: rows.reduce((sum, r) => sum + r.totalRemaining, 0),
  };
}
