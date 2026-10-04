import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { cycleLabel } from "@/lib/constants/cycles";
import { mensualiteMonthKey } from "@/lib/constants/months";
import type { Language } from "@/lib/i18n/config";

type ScheduleRow = {
  student_id: string;
  due_date: string;
  amount_remaining: number;
  status: string;
  fee_structures: { fee_type: string; month: number } | { fee_type: string; month: number }[] | null;
};

// vert : rien à payer sur le mois ; rouge : impayé en retard ; orange : en
// retard mais partiellement réglé ; attente : dû, mais l'échéance n'est pas
// encore passée (la mensualité du mois en cours se paie le 5 du mois suivant).
export type CollectionsColorStatus = "vert" | "orange" | "rouge" | "attente";

export interface CollectionsRow {
  id: string;
  name: string;
  className: string;
  cycle: string;
  guardianName: string;
  guardianPhone: string;
  totalRemaining: number;
  overdueRemaining: number;
  colorStatus: CollectionsColorStatus;
}

export interface CollectionsReport {
  rows: CollectionsRow[];
  availableMonths: string[];
  selectedMonth: string;
  overdueCount: number;
  // Reste à payer sur le mois choisi = en retard + à encaisser.
  totalDue: number;
  overdueTotal: number;
  upcomingTotal: number;
  // Prochaine échéance de la part « à encaisser » (ex. 5 novembre).
  upcomingDueDate: string | null;
}

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Le mois d'une échéance, tel que l'école en parle : pour une mensualité, le
// mois FACTURÉ (« octobre », payable le 5 novembre depuis 0032) ; pour les
// autres frais (inscription, uniforme...), le mois où ils sont dus.
function billingMonth(schedule: ScheduleRow): string {
  const fee = Array.isArray(schedule.fee_structures) ? schedule.fee_structures[0] : schedule.fee_structures;
  if (fee?.fee_type === "mensualite" && fee.month) return mensualiteMonthKey(fee.month, schedule.due_date);
  return schedule.due_date.slice(0, 7);
}

// PostgREST plafonne chaque réponse à 1000 lignes : une école de quelques
// centaines d'élèves les dépasse vite. On pagine.
async function fetchSchedules(supabase: SupabaseClient<Database>, dueBefore: string): Promise<ScheduleRow[]> {
  const rows: ScheduleRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("payment_schedules")
      .select("student_id, due_date, amount_remaining, status, fee_structures(fee_type, month)")
      .neq("status", "cancelled")
      .lt("due_date", dueBefore)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error("Lecture des échéances impossible : " + error.message);
    rows.push(...((data ?? []) as ScheduleRow[]));
    if ((data ?? []).length < 1000) return rows;
  }
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

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentMonth = monthKeyOf(now);
  // Mois proposés : jusqu'au mois en cours inclus. Sa mensualité n'est due que
  // le 5 du mois suivant : on lit donc les échéances jusqu'à la fin de ce
  // mois suivant.
  const dueBefore = monthKeyOf(new Date(now.getFullYear(), now.getMonth() + 2, 1)) + "-01";

  const [{ data: students }, schedules] = await Promise.all([studentsQuery, fetchSchedules(supabase, dueBefore)]);

  const schedulesByStudent = new Map<string, (ScheduleRow & { month: string })[]>();
  const monthsSet = new Set<string>();
  for (const schedule of schedules) {
    const month = billingMonth(schedule);
    if (month > currentMonth) continue;
    const list = schedulesByStudent.get(schedule.student_id) ?? [];
    list.push({ ...schedule, month });
    schedulesByStudent.set(schedule.student_id, list);
    monthsSet.add(month);
  }
  const availableMonths = Array.from(monthsSet).sort();
  const selectedMonth = filters.month || currentMonth;

  let upcomingDueDate: string | null = null;
  const rows: CollectionsRow[] = (students ?? []).map((student) => {
    const klass = Array.isArray(student.classes) ? student.classes[0] : student.classes;
    const monthSchedules = (schedulesByStudent.get(student.id) ?? []).filter((s) => s.month === selectedMonth);

    let totalRemaining = 0;
    let overdueRemaining = 0;
    for (const s of monthSchedules) {
      const remaining = Math.max(Number(s.amount_remaining), 0);
      if (remaining <= 0) continue;
      totalRemaining += remaining;
      if (s.due_date < today) overdueRemaining += remaining;
      else if (!upcomingDueDate || s.due_date < upcomingDueDate) upcomingDueDate = s.due_date;
    }

    let colorStatus: CollectionsColorStatus = "vert";
    if (overdueRemaining > 0) {
      colorStatus = monthSchedules.some((s) => s.due_date < today && s.status === "partial") ? "orange" : "rouge";
    } else if (totalRemaining > 0) {
      colorStatus = "attente";
    }

    return {
      id: student.id,
      name: `${student.last_name} ${student.first_name}`,
      className: klass?.name ?? "—",
      cycle: cycleLabel(klass?.level ?? null, language),
      guardianName: student.guardian_name ?? "—",
      guardianPhone: student.guardian_phone ?? "—",
      totalRemaining,
      overdueRemaining,
      colorStatus,
    };
  });

  const totalDue = rows.reduce((sum, r) => sum + r.totalRemaining, 0);
  const overdueTotal = rows.reduce((sum, r) => sum + r.overdueRemaining, 0);

  return {
    rows,
    availableMonths,
    selectedMonth,
    overdueCount: rows.filter((r) => r.colorStatus === "rouge" || r.colorStatus === "orange").length,
    totalDue,
    overdueTotal,
    upcomingTotal: totalDue - overdueTotal,
    upcomingDueDate,
  };
}
