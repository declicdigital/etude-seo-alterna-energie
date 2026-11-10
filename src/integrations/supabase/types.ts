export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      _backup_editorial_kv_20261105: {
        Row: {
          created_at: string | null;
          key: string | null;
          updated_at: string | null;
          value: string | null;
        };
        Insert: {
          created_at?: string | null;
          key?: string | null;
          updated_at?: string | null;
          value?: string | null;
        };
        Update: {
          created_at?: string | null;
          key?: string | null;
          updated_at?: string | null;
          value?: string | null;
        };
        Relationships: [];
      };
      article_comments: {
        Row: {
          article_id: string;
          author_email: string;
          author_name: string | null;
          body: string;
          created_at: string;
          id: string;
          mentions: string[];
          step_key: string | null;
        };
        Insert: {
          article_id: string;
          author_email: string;
          author_name?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          mentions?: string[];
          step_key?: string | null;
        };
        Update: {
          article_id?: string;
          author_email?: string;
          author_name?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          mentions?: string[];
          step_key?: string | null;
        };
        Relationships: [];
      };
      assistant_questions: {
        Row: {
          correction: string | null;
          corrected_at: string | null;
          unanswered: boolean;
          created_at: string;
          id: string;
          page: string | null;
          question: string;
          reply: string | null;
          resolved_at: string | null;
          source: string;
          user_id: string | null;
          user_name: string | null;
        };
        Insert: {
          correction?: string | null;
          corrected_at?: string | null;
          unanswered?: boolean;
          created_at?: string;
          id?: string;
          page?: string | null;
          question: string;
          reply?: string | null;
          resolved_at?: string | null;
          source?: string;
          user_id?: string | null;
          user_name?: string | null;
        };
        Update: {
          correction?: string | null;
          corrected_at?: string | null;
          unanswered?: boolean;
          created_at?: string;
          id?: string;
          page?: string | null;
          question?: string;
          reply?: string | null;
          resolved_at?: string | null;
          source?: string;
          user_id?: string | null;
          user_name?: string | null;
        };
        Relationships: [];
      };
      benchmark_months: {
        Row: {
          data: Json;
          label: string;
          month_key: string;
          saved_at: string;
          updated_at: string;
        };
        Insert: {
          data: Json;
          label: string;
          month_key: string;
          saved_at?: string;
          updated_at?: string;
        };
        Update: {
          data?: Json;
          label?: string;
          month_key?: string;
          saved_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      editorial_kv: {
        Row: {
          created_at: string;
          key: string;
          updated_at: string;
          value: string;
        };
        Insert: {
          created_at?: string;
          key: string;
          updated_at?: string;
          value: string;
        };
        Update: {
          created_at?: string;
          key?: string;
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
      game_scores: {
        Row: {
          avatar: string;
          created_at: string;
          duration_s: number;
          id: string;
          map: string;
          player_name: string;
          score: number;
          user_id: string;
        };
        Insert: {
          avatar: string;
          created_at?: string;
          duration_s?: number;
          id?: string;
          map: string;
          player_name?: string;
          score: number;
          user_id?: string;
        };
        Update: {
          avatar?: string;
          created_at?: string;
          duration_s?: number;
          id?: string;
          map?: string;
          player_name?: string;
          score?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      org_cards: {
        Row: {
          assignee_id: string | null;
          attachments: Json;
          column_id: string;
          content: string;
          created_at: string;
          created_by: string | null;
          due_date: string | null;
          id: string;
          position: number;
          tagged_ids: string[];
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          assignee_id?: string | null;
          attachments?: Json;
          column_id: string;
          content?: string;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          position?: number;
          tagged_ids?: string[];
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assignee_id?: string | null;
          attachments?: Json;
          column_id?: string;
          content?: string;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          position?: number;
          tagged_ids?: string[];
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "org_cards_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "org_cards_column_id_fkey";
            columns: ["column_id"];
            isOneToOne: false;
            referencedRelation: "org_columns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "org_cards_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "org_cards_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      org_columns: {
        Row: {
          created_at: string;
          id: string;
          position: number;
          title: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          position?: number;
          title: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          position?: number;
          title?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          allowed_sections: string[] | null;
          email: string;
          full_name: string | null;
          id: string;
          requested_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
        };
        Insert: {
          allowed_sections?: string[] | null;
          email: string;
          full_name?: string | null;
          id: string;
          requested_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
        };
        Update: {
          allowed_sections?: string[] | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          requested_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      sheet_cells: {
        Row: {
          col: number;
          row_id: number;
          sheet: string;
          updated_at: string;
          value: string | null;
        };
        Insert: {
          col: number;
          row_id: number;
          sheet: string;
          updated_at?: string;
          value?: string | null;
        };
        Update: {
          col?: number;
          row_id?: number;
          sheet?: string;
          updated_at?: string;
          value?: string | null;
        };
        Relationships: [];
      };
      sheet_meta: {
        Row: {
          key: string;
          scope: string;
          updated_at: string;
          value: string | null;
        };
        Insert: {
          key: string;
          scope: string;
          updated_at?: string;
          value?: string | null;
        };
        Update: {
          key?: string;
          scope?: string;
          updated_at?: string;
          value?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      assistant_corrections: {
        Args: never;
        Returns: {
          correction: string;
          question: string;
        }[];
      };
      admin_access_activity: {
        Args: never;
        Returns: {
          invitation_accepted: boolean;
          invited_at: string;
          last_sign_in_at: string;
          user_id: string;
        }[];
      };
      approved_users: {
        Args: never;
        Returns: {
          email: string;
          full_name: string;
          id: string;
        }[];
      };
      can_use_organisation: { Args: { _user_id: string }; Returns: boolean };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_approved: { Args: { _user_id: string }; Returns: boolean };
      organisation_members: {
        Args: never;
        Returns: {
          email: string;
          full_name: string;
          id: string;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "member";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "member"],
    },
  },
} as const;
