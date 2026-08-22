export type UserRole = "super_admin" | "owner" | "admin" | "accountant";

export type StudentStatus = "active" | "inactive";
export type ScheduleStatus = "pending" | "partial" | "paid" | "overdue" | "cancelled";
export type PaymentMethod = "cash" | "wave" | "orange_money" | "bank_transfer";
export type DiscountType = "percentage" | "fixed_amount";

export type SchoolClassCycle = "prescolaire" | "elementaire" | "college" | "lycee";

export type SubscriptionPlan = "trial" | "basic" | "pro" | "premium";
export type SubscriptionStatus = "active" | "cancelled";
export type SubscriptionPaymentMethod = "wave" | "orange_money" | "card" | "manual";
export type SubscriptionPaymentStatus = "pending" | "completed" | "failed" | "cancelled";

export interface School {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  currency: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  email: string | null;
  school_year_label: string | null;
  school_year_start_month: number;
  school_year_end_month: number;
  matricule_prefix: string;
  plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  subscription_started_at: string;
  subscription_expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPayment {
  id: string;
  school_id: string;
  plan: SubscriptionPlan;
  amount: number;
  currency: string;
  payment_method: SubscriptionPaymentMethod;
  status: SubscriptionPaymentStatus;
  external_reference: string | null;
  period_start: string;
  period_end: string;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  school_id: string | null;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface SchoolClass {
  id: string;
  school_id: string;
  name: string;
  level: SchoolClassCycle | null;
  academic_year: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type FeeRegime = "externat" | "internat";
export type FeeType =
  | "inscription"
  | "uniforme"
  | "mensualite"
  | "cantine"
  | "internat"
  | "transport"
  | "autre";

export interface FeeStructure {
  id: string;
  school_id: string;
  class_id: string;
  academic_year: string;
  label: string;
  amount: number;
  installments_allowed: boolean;
  regime: FeeRegime;
  fee_type: FeeType;
  // 0 = non applicable (frais ponctuel) ; sinon mois calendaire (10-12, 1-7)
  // pour une ligne "mensualite" — une mensualité distincte par mois.
  month: number;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  school_id: string;
  class_id: string | null;
  matricule: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  place_of_birth: string | null;
  gender: "M" | "F" | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  address: string | null;
  regime: FeeRegime;
  status: StudentStatus;
  enrolled_at: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentSchedule {
  id: string;
  school_id: string;
  student_id: string;
  fee_structure_id: string | null;
  due_date: string;
  amount_due: number;
  discount_amount: number;
  amount_paid: number;
  amount_remaining: number;
  status: ScheduleStatus;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  school_id: string;
  student_id: string;
  payment_schedule_id: string | null;
  amount: number;
  payment_method: PaymentMethod;
  reference: string | null;
  paid_at: string;
  received_by: string | null;
  cash_manager_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Certaines écoles répartissent l'argent entre plusieurs responsables
// (ex. Directeur, Adjoint) alors qu'un seul comptable saisit tout — ce n'est
// donc pas lié aux comptes de connexion, juste une étiquette configurable
// rattachable à chaque paiement/dépense.
export interface CashManager {
  id: string;
  school_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentAllocation {
  id: string;
  school_id: string;
  payment_id: string;
  payment_schedule_id: string;
  amount: number;
  created_at: string;
}

export interface Discount {
  id: string;
  school_id: string;
  student_id: string;
  label: string;
  discount_type: DiscountType;
  value: number;
  starts_on: string;
  ends_on: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseCategory =
  | "salaires"
  | "fournitures"
  | "eau"
  | "electricite"
  | "internet"
  | "cantine"
  | "transport"
  | "entretien"
  | "autres";

export interface Expense {
  id: string;
  school_id: string;
  category: ExpenseCategory;
  label: string;
  amount: number;
  expense_date: string;
  paid_by: string | null;
  cash_manager_id: string | null;
  receipt_path: string | null;
  created_at: string;
  updated_at: string;
}
