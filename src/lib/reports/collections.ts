import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { cycleLabel } from "@/lib/constants/cycles";
import type { Language } from "@/lib/i18n/config";

type ScheduleRow = {
  student_id: string;
  due_date: string;
  amount_due: number;
  discount_amount: number;
  amount_paid: number;
  amount_remaining: number;
  status: string;
};

// vert : rien à payer sur le mois ; rouge : impayé en retard ; orange : en
// retard mais partiellement réglé ; attente : attendu ce mois-ci, mais
// l'échéance n'est pas encore passée (ex. le 5 du mois).
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
  // Prochaine échéance pas encore passée sur laquelle il reste à payer
  // (« à payer aujourd'hui » le jour même).
  nextDueDate: string | null;
  colorStatus: CollectionsColorStatus;
}

export interface CollectionsReport {
  rows: CollectionsRow[];
  availableMonths: string[];
  selectedMonth: string;
  overdueCount: number;
  // Recette totale du mois si tous les élèves paient (après réductions et
  // prises en charge) = déjà encaissé + reste à payer.
  expectedTotal: number;
  collectedTotal: number;
  // Reste à payer sur le mois choisi = en retard + à encaisser.
  totalDue: number;
  overdueTotal: number;
  upcomingTotal: number;
  // Prochaine échéance de la part « à encaisser » (ex. 5 novembre).
  upcomingDueDate: string | null;
  today: string;
}

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Le mois d'une échéance = le mois où l'école ATTEND l'argent, c'est-à-dire
// sa date d'échéance. « Octobre » = tout ce qui doit rentrer en octobre (les
// inscriptions du 1er, les mensualités du 5) ; « Novembre » = ce qui rentrera
// début novembre. C'est ainsi que l'école organise son recouvrement.
function collectionMonth(schedule: ScheduleRow): string {
  return schedule.due_date.slice(0, 7);
}

// PostgREST plafonne chaque réponse à 1000 lignes : une école de quelques
// centaines d'élèves les dépasse vite. On pagine.
async function fetchSchedules(supabase: SupabaseClient<Database>): Promise<ScheduleRow[]> {
  const rows: ScheduleRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("payment_schedules")
      .select(
        "student_id, due_date, amount_due, discount_amount, amount_paid, amount_remaining, status"
      )
      .neq("status", "cancelled")
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error("Lecture des échéances impossible : " + error.message);
    rows.push(...((data ?? []) as ScheduleRow[]));
    if ((data ?? []).length < 1000) return rows;
  }
}

export interface PeriodReceivables {
  // Reste à payer sur les échéances de la période (en retard + à venir).
  totalDue: number;
  // Élèves en retard sur une échéance de la période déjà passée.
  overdueStudentCount: number;
}

// Recouvrement d'une période quelconque, pour le rapport financier. Mêmes
// règles que l'état de recouvrement (élèves actifs, mois = date d'échéance,
// en retard = échéance passée) : choisir du 1er au 31 octobre donne les
// mêmes chiffres que Recouvrement sur « Octobre ».
export async function computePeriodReceivables(
  supabase: SupabaseClient<Database>,
  from: string,
  to: string
): Promise<PeriodReceivables> {
  type Row = { student_id: string; due_date: string; amount_remaining: number; students: unknown };
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("payment_schedules")
      .select("student_id, due_date, amount_remaining, students!inner(status)")
      .neq("status", "cancelled")
      .gte("due_date", from)
      .lte("due_date", to)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error("Lecture des échéances impossible : " + error.message);
    rows.push(...((data ?? []) as Row[]));
    if ((data ?? []).length < 1000) break;
  }

  const today = new Date().toISOString().slice(0, 10);
  let totalDue = 0;
  const overdueStudents = new Set<string>();
  for (const row of rows) {
    const student = (Array.isArray(row.students) ? row.students[0] : row.students) as { status: string } | null;
    const remaining = Math.max(Number(row.amount_remaining), 0);
    if (student?.status !== "active" || remaining <= 0) continue;
    totalDue += remaining;
    if (row.due_date < today) overdueStudents.add(row.student_id);
  }
  return { totalDue, overdueStudentCount: overdueStudents.size };
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

  const [{ data: students }, schedules] = await Promise.all([studentsQuery, fetchSchedules(supabase)]);

  // Tous les mois de l'échéancier sont proposés, y compris ceux à venir :
  // l'école prépare le recouvrement de début novembre dès fin octobre.
  const schedulesByStudent = new Map<string, (ScheduleRow & { month: string })[]>();
  const monthsSet = new Set<string>();
  for (const schedule of schedules) {
    const month = collectionMonth(schedule);
    const list = schedulesByStudent.get(schedule.student_id) ?? [];
    list.push({ ...schedule, month });
    schedulesByStudent.set(schedule.student_id, list);
    monthsSet.add(month);
  }
  const availableMonths = Array.from(monthsSet).sort();
  const selectedMonth = filters.month || currentMonth;

  let upcomingDueDate: string | null = null;
  let expectedTotal = 0;
  let collectedTotal = 0;
  const rows: CollectionsRow[] = (students ?? []).map((student) => {
    const klass = Array.isArray(student.classes) ? student.classes[0] : student.classes;
    const monthSchedules = (schedulesByStudent.get(student.id) ?? []).filter((s) => s.month === selectedMonth);

    for (const s of monthSchedules) {
      expectedTotal += Math.max(Number(s.amount_due) - Number(s.discount_amount), 0);
      collectedTotal += Number(s.amount_paid);
    }

    let totalRemaining = 0;
    let overdueRemaining = 0;
    let nextDueDate: string | null = null;
    for (const s of monthSchedules) {
      const remaining = Math.max(Number(s.amount_remaining), 0);
      if (remaining <= 0) continue;
      totalRemaining += remaining;
      if (s.due_date < today) {
        overdueRemaining += remaining;
      } else {
        if (!nextDueDate || s.due_date < nextDueDate) nextDueDate = s.due_date;
        if (!upcomingDueDate || s.due_date < upcomingDueDate) upcomingDueDate = s.due_date;
      }
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
      nextDueDate,
      colorStatus,
    };
  });

  // Ceux qui doivent quelque chose d'abord (en retard, puis à payer), les
  // élèves à jour à la fin : c'est une liste de relance.
  const order: Record<CollectionsColorStatus, number> = { rouge: 0, orange: 1, attente: 2, vert: 3 };
  rows.sort((a, b) => order[a.colorStatus] - order[b.colorStatus] || a.name.localeCompare(b.name));

  const totalDue = rows.reduce((sum, r) => sum + r.totalRemaining, 0);
  const overdueTotal = rows.reduce((sum, r) => sum + r.overdueRemaining, 0);

  return {
    rows,
    availableMonths,
    selectedMonth,
    overdueCount: rows.filter((r) => r.colorStatus === "rouge" || r.colorStatus === "orange").length,
    expectedTotal,
    collectedTotal,
    totalDue,
    overdueTotal,
    upcomingTotal: totalDue - overdueTotal,
    upcomingDueDate,
    today,
  };
}
