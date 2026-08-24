// Écrit à la main pour refléter supabase/migrations/0001_init.sql et 0002_school_signup.sql.
// À régénérer/vérifier avec la Supabase CLI une fois un vrai projet lié :
//   npx supabase gen types typescript --project-id <project-id> --schema public > src/types/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: {
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
          plan: "trial" | "basic" | "pro" | "premium";
          subscription_status: "active" | "cancelled";
          subscription_started_at: string;
          subscription_expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          country?: string | null;
          currency?: string;
          phone?: string | null;
          address?: string | null;
          logo_url?: string | null;
          email?: string | null;
          school_year_label?: string | null;
          school_year_start_month?: number;
          school_year_end_month?: number;
          matricule_prefix?: string;
          plan?: "trial" | "basic" | "pro" | "premium";
          subscription_status?: "active" | "cancelled";
          subscription_started_at?: string;
          subscription_expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["schools"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          school_id: string | null;
          full_name: string | null;
          email: string | null;
          role: "super_admin" | "owner" | "admin" | "accountant";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          school_id?: string | null;
          full_name?: string | null;
          email?: string | null;
          role?: "super_admin" | "owner" | "admin" | "accountant";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "users_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          level: "prescolaire" | "elementaire" | "college" | "lycee" | null;
          academic_year: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          level?: "prescolaire" | "elementaire" | "college" | "lycee" | null;
          academic_year: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["classes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      fee_structures: {
        Row: {
          id: string;
          school_id: string;
          class_id: string;
          academic_year: string;
          label: string;
          amount: number;
          installments_allowed: boolean;
          regime: "externat" | "internat";
          fee_type:
            | "inscription"
            | "uniforme"
            | "mensualite"
            | "cantine"
            | "internat"
            | "transport"
            | "autre";
          month: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          class_id: string;
          academic_year: string;
          label: string;
          amount: number;
          installments_allowed?: boolean;
          regime: "externat" | "internat";
          fee_type:
            | "inscription"
            | "uniforme"
            | "mensualite"
            | "cantine"
            | "internat"
            | "transport"
            | "autre";
          month?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fee_structures"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "fee_structures_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_structures_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
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
          regime: "externat" | "internat";
          status: "active" | "inactive";
          enrolled_at: string;
          subscribes_cantine: boolean;
          subscribes_transport: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          class_id?: string | null;
          matricule?: string | null;
          first_name: string;
          last_name: string;
          date_of_birth?: string | null;
          place_of_birth?: string | null;
          gender?: "M" | "F" | null;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          guardian_email?: string | null;
          address?: string | null;
          regime?: "externat" | "internat";
          status?: "active" | "inactive";
          enrolled_at?: string;
          subscribes_cantine?: boolean;
          subscribes_transport?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["students"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_schedules: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          fee_structure_id: string | null;
          due_date: string;
          amount_due: number;
          discount_amount: number;
          amount_paid: number;
          amount_remaining: number;
          status: "pending" | "partial" | "paid" | "overdue" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          fee_structure_id?: string | null;
          due_date: string;
          amount_due: number;
          discount_amount?: number;
          amount_paid?: number;
          status?: "pending" | "partial" | "paid" | "overdue" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_schedules"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payment_schedules_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_schedules_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_schedules_fee_structure_id_fkey";
            columns: ["fee_structure_id"];
            isOneToOne: false;
            referencedRelation: "fee_structures";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          payment_schedule_id: string | null;
          amount: number;
          payment_method: "cash" | "wave" | "orange_money" | "bank_transfer";
          reference: string | null;
          paid_at: string;
          received_by: string | null;
          cash_manager_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          payment_schedule_id?: string | null;
          amount: number;
          payment_method?: "cash" | "wave" | "orange_money" | "bank_transfer";
          reference?: string | null;
          paid_at?: string;
          received_by?: string | null;
          cash_manager_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_payment_schedule_id_fkey";
            columns: ["payment_schedule_id"];
            isOneToOne: false;
            referencedRelation: "payment_schedules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_cash_manager_id_fkey";
            columns: ["cash_manager_id"];
            isOneToOne: false;
            referencedRelation: "cash_managers";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_allocations: {
        Row: {
          id: string;
          school_id: string;
          payment_id: string;
          payment_schedule_id: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          payment_id: string;
          payment_schedule_id: string;
          amount: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_allocations"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payment_allocations_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_payment_schedule_id_fkey";
            columns: ["payment_schedule_id"];
            isOneToOne: false;
            referencedRelation: "payment_schedules";
            referencedColumns: ["id"];
          },
        ];
      };
      discounts: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          label: string;
          discount_type: "percentage" | "fixed_amount";
          value: number;
          starts_on: string;
          ends_on: string;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          label: string;
          discount_type: "percentage" | "fixed_amount";
          value: number;
          starts_on: string;
          ends_on: string;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["discounts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "discounts_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discounts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          school_id: string;
          category:
            | "salaires"
            | "fournitures"
            | "eau"
            | "electricite"
            | "internet"
            | "cantine"
            | "transport"
            | "entretien"
            | "autres";
          label: string;
          amount: number;
          expense_date: string;
          paid_by: string | null;
          cash_manager_id: string | null;
          receipt_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          category?:
            | "salaires"
            | "fournitures"
            | "eau"
            | "electricite"
            | "internet"
            | "cantine"
            | "transport"
            | "entretien"
            | "autres";
          label: string;
          amount: number;
          expense_date?: string;
          paid_by?: string | null;
          cash_manager_id?: string | null;
          receipt_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "expenses_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_cash_manager_id_fkey";
            columns: ["cash_manager_id"];
            isOneToOne: false;
            referencedRelation: "cash_managers";
            referencedColumns: ["id"];
          },
        ];
      };
      cash_managers: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cash_managers"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "cash_managers_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      cash_manager_transfers: {
        Row: {
          id: string;
          school_id: string;
          from_manager_id: string;
          to_manager_id: string;
          amount: number;
          transferred_at: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          from_manager_id: string;
          to_manager_id: string;
          amount: number;
          transferred_at?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cash_manager_transfers"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "cash_manager_transfers_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_manager_transfers_from_manager_id_fkey";
            columns: ["from_manager_id"];
            isOneToOne: false;
            referencedRelation: "cash_managers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_manager_transfers_to_manager_id_fkey";
            columns: ["to_manager_id"];
            isOneToOne: false;
            referencedRelation: "cash_managers";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_payments: {
        Row: {
          id: string;
          school_id: string;
          plan: "trial" | "basic" | "pro" | "premium";
          amount: number;
          currency: string;
          payment_method: "wave" | "orange_money" | "card" | "manual" | "chariow";
          status: "pending" | "completed" | "failed" | "cancelled";
          external_reference: string | null;
          period_start: string;
          period_end: string;
          requested_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          plan: "trial" | "basic" | "pro" | "premium";
          amount: number;
          currency?: string;
          payment_method: "wave" | "orange_money" | "card" | "manual" | "chariow";
          status?: "pending" | "completed" | "failed" | "cancelled";
          external_reference?: string | null;
          period_start: string;
          period_end: string;
          requested_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscription_payments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "subscription_payments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_payments_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_school_with_owner: {
        Args: {
          p_school_name: string;
          p_school_slug: string;
          p_owner_id: string;
          p_owner_email: string;
          p_owner_full_name: string;
        };
        Returns: string;
      };
      generate_student_schedule: {
        Args: {
          p_student_id: string;
          p_academic_year: string | null;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
  };
}
