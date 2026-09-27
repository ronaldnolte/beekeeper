export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_qa_history: {
        Row: {
          answer: string
          context_data: Json | null
          created_at: string | null
          id: string
          question_original: string
          user_id: string | null
        }
        Insert: {
          answer: string
          context_data?: Json | null
          created_at?: string | null
          id?: string
          question_original: string
          user_id?: string | null
        }
        Update: {
          answer?: string
          context_data?: Json | null
          created_at?: string | null
          id?: string
          question_original?: string
          user_id?: string | null
        }
        Relationships: []
      }
      apiaries: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          updated_at: string
          user_id: string
          zip_code: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
          zip_code: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          zip_code?: string
        }
        Relationships: []
      }
      apiary_shares: {
        Row: {
          apiary_id: string
          created_at: string | null
          id: string
          owner_id: string
          viewer_id: string
        }
        Insert: {
          apiary_id: string
          created_at?: string | null
          id?: string
          owner_id: string
          viewer_id: string
        }
        Update: {
          apiary_id?: string
          created_at?: string | null
          id?: string
          owner_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apiary_shares_apiary_id_fkey"
            columns: ["apiary_id"]
            isOneToOne: false
            referencedRelation: "apiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apiary_shares_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apiary_shares_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_feedback: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
        }
        Relationships: []
      }
      beta_signups: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      feature_requests: {
        Row: {
          created_at: string
          description: string | null
          id: string
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_votes: {
        Row: {
          created_at: string
          feature_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_votes_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "feature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      hive_snapshots: {
        Row: {
          active_bar_count: number | null
          bars: string
          brood_bar_count: number | null
          created_at: string
          deleted_at: string | null
          empty_bar_count: number | null
          follower_board_position: number | null
          hive_id: string
          id: string
          inactive_bar_count: number | null
          notes: string | null
          resource_bar_count: number | null
          timestamp: string
          updated_at: string
          weather: Json | null
        }
        Insert: {
          active_bar_count?: number | null
          bars: string
          brood_bar_count?: number | null
          created_at?: string
          deleted_at?: string | null
          empty_bar_count?: number | null
          follower_board_position?: number | null
          hive_id: string
          id?: string
          inactive_bar_count?: number | null
          notes?: string | null
          resource_bar_count?: number | null
          timestamp?: string
          updated_at?: string
          weather?: Json | null
        }
        Update: {
          active_bar_count?: number | null
          bars?: string
          brood_bar_count?: number | null
          created_at?: string
          deleted_at?: string | null
          empty_bar_count?: number | null
          follower_board_position?: number | null
          hive_id?: string
          id?: string
          inactive_bar_count?: number | null
          notes?: string | null
          resource_bar_count?: number | null
          timestamp?: string
          updated_at?: string
          weather?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "hive_snapshots_hive_id_fkey"
            columns: ["hive_id"]
            isOneToOne: false
            referencedRelation: "hives"
            referencedColumns: ["id"]
          },
        ]
      }
      hives: {
        Row: {
          apiary_id: string
          bar_count: number | null
          bars: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          last_inspection_date: string | null
          name: string
          notes: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          apiary_id: string
          bar_count?: number | null
          bars?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          last_inspection_date?: string | null
          name: string
          notes?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          apiary_id?: string
          bar_count?: number | null
          bars?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          last_inspection_date?: string | null
          name?: string
          notes?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hives_apiary_id_fkey"
            columns: ["apiary_id"]
            isOneToOne: false
            referencedRelation: "apiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_attachments: {
        Row: {
          audio_path: string | null
          byte_size: number | null
          created_at: string
          height: number | null
          id: string
          inspection_id: string
          kind: string
          owner: string
          parent_id: string | null
          sort_order: number
          storage_path: string | null
          thumb_path: string | null
          transcript: string | null
          transcript_status: string
          width: number | null
        }
        Insert: {
          audio_path?: string | null
          byte_size?: number | null
          created_at?: string
          height?: number | null
          id?: string
          inspection_id: string
          kind: string
          owner: string
          parent_id?: string | null
          sort_order?: number
          storage_path?: string | null
          thumb_path?: string | null
          transcript?: string | null
          transcript_status?: string
          width?: number | null
        }
        Update: {
          audio_path?: string | null
          byte_size?: number | null
          created_at?: string
          height?: number | null
          id?: string
          inspection_id?: string
          kind?: string
          owner?: string
          parent_id?: string | null
          sort_order?: number
          storage_path?: string | null
          thumb_path?: string | null
          transcript?: string | null
          transcript_status?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_attachments_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_attachments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "inspection_attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          brood_pattern: string | null
          created_at: string
          deleted_at: string | null
          hive_id: string
          honey_stores: string | null
          id: string
          observations: string | null
          pollen_stores: string | null
          population_strength: string | null
          queen_status: string
          review_status: string
          snapshot_id: string | null
          temperament: string | null
          timestamp: string
          updated_at: string
          user_id: string | null
          weather: Json | null
        }
        Insert: {
          brood_pattern?: string | null
          created_at?: string
          deleted_at?: string | null
          hive_id: string
          honey_stores?: string | null
          id?: string
          observations?: string | null
          pollen_stores?: string | null
          population_strength?: string | null
          queen_status: string
          review_status?: string
          snapshot_id?: string | null
          temperament?: string | null
          timestamp: string
          updated_at?: string
          user_id?: string | null
          weather?: Json | null
        }
        Update: {
          brood_pattern?: string | null
          created_at?: string
          deleted_at?: string | null
          hive_id?: string
          honey_stores?: string | null
          id?: string
          observations?: string | null
          pollen_stores?: string | null
          population_strength?: string | null
          queen_status?: string
          review_status?: string
          snapshot_id?: string | null
          temperament?: string | null
          timestamp?: string
          updated_at?: string
          user_id?: string | null
          weather?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_hive_id_fkey"
            columns: ["hive_id"]
            isOneToOne: false
            referencedRelation: "hives"
            referencedColumns: ["id"]
          },
        ]
      }
      interventions: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          hive_id: string
          id: string
          inspection_id: string | null
          notes: string | null
          timestamp: string
          type: string
          updated_at: string
          weather: Json | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          hive_id: string
          id?: string
          inspection_id?: string | null
          notes?: string | null
          timestamp: string
          type: string
          updated_at?: string
          weather?: Json | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          hive_id?: string
          id?: string
          inspection_id?: string | null
          notes?: string | null
          timestamp?: string
          type?: string
          updated_at?: string
          weather?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "interventions_hive_id_fkey"
            columns: ["hive_id"]
            isOneToOne: false
            referencedRelation: "hives"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          display_name: string
          is_accepting_students: boolean | null
          location: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          display_name: string
          is_accepting_students?: boolean | null
          location?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          display_name?: string
          is_accepting_students?: boolean | null
          location?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          analytics_opt_out: boolean
          created_at: string
          default_bar_count: number | null
          default_hive_type: string | null
          display_name: string | null
          experience_years: number | null
          id: string
          treatment_approach: string | null
          updated_at: string
        }
        Insert: {
          analytics_opt_out?: boolean
          created_at?: string
          default_bar_count?: number | null
          default_hive_type?: string | null
          display_name?: string | null
          experience_years?: number | null
          id: string
          treatment_approach?: string | null
          updated_at?: string
        }
        Update: {
          analytics_opt_out?: boolean
          created_at?: string
          default_bar_count?: number | null
          default_hive_type?: string | null
          display_name?: string | null
          experience_years?: number | null
          id?: string
          treatment_approach?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          apiary_id: string | null
          assigned_user_id: string | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          hive_id: string | null
          id: string
          is_synced: boolean | null
          priority: string | null
          scope: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          apiary_id?: string | null
          assigned_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          hive_id?: string | null
          id?: string
          is_synced?: boolean | null
          priority?: string | null
          scope?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          apiary_id?: string | null
          assigned_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          hive_id?: string | null
          id?: string
          is_synced?: boolean | null
          priority?: string | null
          scope?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_apiary_id_fkey"
            columns: ["apiary_id"]
            isOneToOne: false
            referencedRelation: "apiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_hive_id_fkey"
            columns: ["hive_id"]
            isOneToOne: false
            referencedRelation: "hives"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string
          id: string
          is_mentor: boolean | null
          mentor_bio: string | null
          mentor_location: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email: string
          id: string
          is_mentor?: boolean | null
          mentor_bio?: string | null
          mentor_location?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          is_mentor?: boolean | null
          mentor_bio?: string | null
          mentor_location?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      varroa_tests: {
        Row: {
          bee_count: number
          created_at: string | null
          hive_id: string
          id: string
          mite_count: number
          mite_pct: number | null
          notes: string | null
          reset_at: string | null
          tested_at: string
          threshold: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bee_count?: number
          created_at?: string | null
          hive_id: string
          id?: string
          mite_count: number
          mite_pct?: number | null
          notes?: string | null
          reset_at?: string | null
          tested_at?: string
          threshold: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bee_count?: number
          created_at?: string | null
          hive_id?: string
          id?: string
          mite_count?: number
          mite_pct?: number | null
          notes?: string | null
          reset_at?: string | null
          tested_at?: string
          threshold?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "varroa_tests_hive_id_fkey"
            columns: ["hive_id"]
            isOneToOne: false
            referencedRelation: "hives"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_forecasts: {
        Row: {
          apiary_id: string
          created_at: string | null
          data: Json
          forecast_date: string
          id: string
          updated_at: string | null
        }
        Insert: {
          apiary_id: string
          created_at?: string | null
          data: Json
          forecast_date: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          apiary_id?: string
          created_at?: string | null
          data?: Json
          forecast_date?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_forecasts_apiary_id_fkey"
            columns: ["apiary_id"]
            isOneToOne: false
            referencedRelation: "apiaries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_hive_access:
        | { Args: { hive_id: string }; Returns: boolean }
        | { Args: { hive_id_input: string }; Returns: boolean }
        | { Args: { p_hive_id: string; p_user_id: string }; Returns: boolean }
      delete_user_entirely: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      get_user_by_email_for_admin: {
        Args: { email_input: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
