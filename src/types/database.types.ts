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
      prospects: {
        Row: {
          id: string;
          nom: string;
          ville: string | null;
          quartier: string | null;
          telephone: string | null;
          email: string | null;
          email_fiable: boolean;
          type_etablissement: string | null;
          source_url: string;
          score: number;
          pourquoi: string | null;
          accroche: string | null;
          statut: "nouveau" | "contacte" | "interesse" | "refuse" | "client";
          notes: string | null;
          recherche: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nom: string;
          ville?: string | null;
          quartier?: string | null;
          telephone?: string | null;
          email?: string | null;
          email_fiable?: boolean;
          type_etablissement?: string | null;
          source_url: string;
          score: number;
          pourquoi?: string | null;
          accroche?: string | null;
          statut?: "nouveau" | "contacte" | "interesse" | "refuse" | "client";
          notes?: string | null;
          recherche?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prospects"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          school_id: string | null;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          role: "super_admin" | "owner" | "admin" | "accountant";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          school_id?: string | null;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
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
            | "tenue_sport"
            | "fournitures"
            | "mensualite"
            | "cantine"
            | "internat"
            | "transport"
            | "transport_zone_1"
            | "transport_zone_2"
            | "transport_zone_3"
            | "renforcement"
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
            | "tenue_sport"
            | "fournitures"
            | "mensualite"
            | "cantine"
            | "internat"
            | "transport"
            | "transport_zone_1"
            | "transport_zone_2"
            | "transport_zone_3"
            | "renforcement"
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
          subscribes_renforcement: boolean;
          subscribes_transport: boolean;
          transport_zone: number | null;
          family_id: string | null;
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
          subscribes_renforcement?: boolean;
          subscribes_transport?: boolean;
          transport_zone?: number | null;
          family_id?: string | null;
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
          {
            foreignKeyName: "students_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      families: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          guardian_name: string | null;
          guardian_phone: string | null;
          free_student_id: string | null;
          free_since: string | null;
          free_year: string | null;
          free_from_start: boolean;
          created_at: string;
          updated_at: string;
        };
        // Les colonnes free_* ne s'écrivent que via set_family_free()
        // (0036_prise_en_charge_au_choix.sql) : l'app n'a le droit d'écrire
        // directement que l'identité de la famille.
        Insert: {
          school_id: string;
          name: string;
          guardian_name?: string | null;
          guardian_phone?: string | null;
        };
        Update: {
          name?: string;
          guardian_name?: string | null;
          guardian_phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "families_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "families_free_student_id_fkey";
            columns: ["free_student_id"];
            isOneToOne: false;
            referencedRelation: "students";
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
          family_free: boolean;
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
          family_payment_id: string | null;
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
          {
            foreignKeyName: "payments_family_payment_id_fkey";
            columns: ["family_payment_id"];
            isOneToOne: false;
            referencedRelation: "family_payments";
            referencedColumns: ["id"];
          },
        ];
      };
      // Reçu unique d'une famille : créé uniquement par record_family_payment()
      // (0037_paiement_famille.sql), lecture seule pour l'app.
      family_payments: {
        Row: {
          id: string;
          school_id: string;
          family_id: string | null;
          family_name: string;
          total: number;
          payment_method: "cash" | "wave" | "orange_money" | "bank_transfer";
          paid_at: string;
          reference: string | null;
          notes: string | null;
          received_by: string | null;
          cash_manager_id: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "family_payments_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_payments_cash_manager_id_fkey";
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
            | "location"
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
          // Dépense de l'internat (0043_internat_mensuel.sql).
          internat: boolean;
          // Dépense fixe du mois (0045_depenses_fixes.sql) : la ligne de la
          // liste, le mois concerné ("2026-10") et les heures si à l'heure.
          recurring_expense_id: string | null;
          period: string | null;
          hours: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          category?:
            | "salaires"
            | "location"
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
          internat?: boolean;
          recurring_expense_id?: string | null;
          period?: string | null;
          hours?: number | null;
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
          {
            foreignKeyName: "expenses_recurring_expense_id_fkey";
            columns: ["recurring_expense_id"];
            isOneToOne: false;
            referencedRelation: "recurring_expenses";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_expenses: {
        Row: {
          id: string;
          school_id: string;
          label: string;
          category:
            | "salaires"
            | "location"
            | "fournitures"
            | "eau"
            | "electricite"
            | "internet"
            | "cantine"
            | "transport"
            | "entretien"
            | "autres";
          pay_mode: "fixed" | "hourly";
          amount: number;
          hourly_rate: number | null;
          internat: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          label: string;
          category?:
            | "salaires"
            | "location"
            | "fournitures"
            | "eau"
            | "electricite"
            | "internet"
            | "cantine"
            | "transport"
            | "entretien"
            | "autres";
          pay_mode?: "fixed" | "hourly";
          amount?: number;
          hourly_rate?: number | null;
          internat?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recurring_expenses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
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
      // Signature de 0038 (montant par ligne). Celle de 0037, sans p_amounts,
      // existe encore en base pour l'ancienne version de l'app.
      record_family_payment: {
        Args: {
          p_family_id: string;
          p_schedule_ids: string[];
          p_amounts: number[];
          p_paid_at: string;
          p_payment_method: string;
          p_reference?: string | null;
          p_notes?: string | null;
          p_cash_manager_id?: string | null;
        };
        Returns: string;
      };
      // 0041 : corriger (montant 0 = ligne retirée) ou annuler un paiement famille.
      update_family_payment: {
        Args: {
          p_family_payment_id: string;
          p_paid_at: string;
          p_payment_method: string;
          p_reference: string | null;
          p_notes: string | null;
          p_cash_manager_id: string | null;
          p_payment_ids: string[];
          p_amounts: number[];
        };
        Returns: undefined;
      };
      delete_family_payment: {
        Args: { p_family_payment_id: string };
        Returns: undefined;
      };
      set_family_free: {
        Args: {
          p_family_id: string;
          p_student_id: string | null;
          p_from_start: boolean;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
  };
}
