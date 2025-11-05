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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      appointment_messages: {
        Row: {
          appointment_id: string
          created_at: string | null
          id: string
          message: string
          sender_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string | null
          id?: string
          message: string
          sender_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string | null
          id?: string
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          created_at: string | null
          end_time: string
          id: string
          notes: string | null
          start_time: string
          status: string
          student_id: string | null
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          appointment_date: string
          created_at?: string | null
          end_time: string
          id?: string
          notes?: string | null
          start_time: string
          status?: string
          student_id?: string | null
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string
          created_at?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          start_time?: string
          status?: string
          student_id?: string | null
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      coaching_sessions: {
        Row: {
          analysis_data: Json | null
          created_at: string | null
          file_name: string
          file_url: string
          group_id: string | null
          id: string
          max_score: number | null
          notes: string | null
          ocr_data: Json | null
          reviewed_at: string | null
          score: number | null
          session_number: number
          status: Database["public"]["Enums"]["coaching_status"] | null
          student_id: string
          teacher_comment: string | null
          teacher_id: string | null
          updated_at: string | null
        }
        Insert: {
          analysis_data?: Json | null
          created_at?: string | null
          file_name: string
          file_url: string
          group_id?: string | null
          id?: string
          max_score?: number | null
          notes?: string | null
          ocr_data?: Json | null
          reviewed_at?: string | null
          score?: number | null
          session_number: number
          status?: Database["public"]["Enums"]["coaching_status"] | null
          student_id: string
          teacher_comment?: string | null
          teacher_id?: string | null
          updated_at?: string | null
        }
        Update: {
          analysis_data?: Json | null
          created_at?: string | null
          file_name?: string
          file_url?: string
          group_id?: string | null
          id?: string
          max_score?: number | null
          notes?: string | null
          ocr_data?: Json | null
          reviewed_at?: string | null
          score?: number | null
          session_number?: number
          status?: Database["public"]["Enums"]["coaching_status"] | null
          student_id?: string
          teacher_comment?: string | null
          teacher_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      event_requests: {
        Row: {
          created_at: string | null
          description: string
          end_time: string
          event_date: string
          event_name: string
          event_type: string
          expected_participants: number | null
          id: string
          location: string | null
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_time: string
          status: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          end_time: string
          event_date: string
          event_name: string
          event_type: string
          expected_participants?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_time: string
          status?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          end_time?: string
          event_date?: string
          event_name?: string
          event_type?: string
          expected_participants?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_time?: string
          status?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          is_leader: boolean | null
          student_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          is_leader?: boolean | null
          student_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          is_leader?: boolean | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          leave_type: string
          notes: string | null
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          leave_type: string
          notes?: string | null
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          leave_type?: string
          notes?: string | null
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      line_channel_assignments: {
        Row: {
          created_at: string | null
          id: string
          line_notification_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          line_notification_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          line_notification_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_channel_assignments_line_notification_id_fkey"
            columns: ["line_notification_id"]
            isOneToOne: false
            referencedRelation: "line_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_channel_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      line_notifications: {
        Row: {
          channel_access_token: string | null
          channel_secret: string | null
          created_at: string | null
          description: string | null
          enabled: boolean | null
          group_id: string | null
          id: string
          name: string
          notification_type: string | null
          updated_at: string | null
        }
        Insert: {
          channel_access_token?: string | null
          channel_secret?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          group_id?: string | null
          id?: string
          name?: string
          notification_type?: string | null
          updated_at?: string | null
        }
        Update: {
          channel_access_token?: string | null
          channel_secret?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          group_id?: string | null
          id?: string
          name?: string
          notification_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          employee_id: string | null
          first_name: string
          group_id: string | null
          id: string
          last_name: string
          major: string | null
          required_sessions: number | null
          student_id: string | null
          updated_at: string | null
          year_level: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          employee_id?: string | null
          first_name: string
          group_id?: string | null
          id: string
          last_name: string
          major?: string | null
          required_sessions?: number | null
          student_id?: string | null
          updated_at?: string | null
          year_level?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          employee_id?: string | null
          first_name?: string
          group_id?: string | null
          id?: string
          last_name?: string
          major?: string | null
          required_sessions?: number | null
          student_id?: string | null
          updated_at?: string | null
          year_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      room_bookings: {
        Row: {
          booking_date: string
          created_at: string | null
          end_time: string
          id: string
          notes: string | null
          purpose: string
          reviewed_at: string | null
          reviewed_by: string | null
          room_name: string
          start_time: string
          status: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          booking_date: string
          created_at?: string | null
          end_time: string
          id?: string
          notes?: string | null
          purpose: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          room_name: string
          start_time: string
          status?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          booking_date?: string
          created_at?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          purpose?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          room_name?: string
          start_time?: string
          status?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_bookings_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_groups: {
        Row: {
          created_at: string | null
          id: string
          major: string
          name: string
          required_sessions: number
          year_level: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          major: string
          name: string
          required_sessions?: number
          year_level: string
        }
        Update: {
          created_at?: string | null
          id?: string
          major?: string
          name?: string
          required_sessions?: number
          year_level?: string
        }
        Relationships: []
      }
      teacher_assignments: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_appointment_atomic: {
        Args: { appointment_id: string; student_id: string }
        Returns: boolean
      }
      get_user_group_id: { Args: { user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "admin" | "super_admin"
      coaching_status: "pending" | "approved" | "rejected"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "teacher", "admin", "super_admin"],
      coaching_status: ["pending", "approved", "rejected"],
    },
  },
} as const
