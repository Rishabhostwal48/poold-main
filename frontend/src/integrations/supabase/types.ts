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
      admin_statistics: {
        Row: {
          ai_api_calls: number | null
          created_at: string
          date: string
          estimated_cost_usd: number | null
          id: string
          processing_time_seconds: number | null
          total_cv_analyses: number | null
          total_gap_analyses: number | null
          total_interviews: number | null
          updated_at: string
        }
        Insert: {
          ai_api_calls?: number | null
          created_at?: string
          date?: string
          estimated_cost_usd?: number | null
          id?: string
          processing_time_seconds?: number | null
          total_cv_analyses?: number | null
          total_gap_analyses?: number | null
          total_interviews?: number | null
          updated_at?: string
        }
        Update: {
          ai_api_calls?: number | null
          created_at?: string
          date?: string
          estimated_cost_usd?: number | null
          id?: string
          processing_time_seconds?: number | null
          total_cv_analyses?: number | null
          total_gap_analyses?: number | null
          total_interviews?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          applicant_id: string
          cover_letter: string | null
          created_at: string
          id: string
          opportunity_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          applicant_id: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          opportunity_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          opportunity_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cv_analysis_results: {
        Row: {
          candidate_profile: Json
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          processed_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          candidate_profile: Json
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          processed_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          candidate_profile?: Json
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          processed_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cv_data: {
        Row: {
          certifications: Json | null
          created_at: string
          education: Json | null
          email: string | null
          experience: Json | null
          extracted_at: string | null
          full_name: string | null
          id: string
          languages: string[] | null
          location: string | null
          phone: string | null
          skills: string[] | null
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          certifications?: Json | null
          created_at?: string
          education?: Json | null
          email?: string | null
          experience?: Json | null
          extracted_at?: string | null
          full_name?: string | null
          id?: string
          languages?: string[] | null
          location?: string | null
          phone?: string | null
          skills?: string[] | null
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          certifications?: Json | null
          created_at?: string
          education?: Json | null
          email?: string | null
          experience?: Json | null
          extracted_at?: string | null
          full_name?: string | null
          id?: string
          languages?: string[] | null
          location?: string | null
          phone?: string | null
          skills?: string[] | null
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gap_analysis_results: {
        Row: {
          created_at: string
          cv_analysis_id: string | null
          gap_analysis: Json | null
          id: string
          job_description: string
          job_posting_id: string | null
          job_profile: Json
          robust_gap_analysis: Json | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          cv_analysis_id?: string | null
          gap_analysis?: Json | null
          id?: string
          job_description: string
          job_posting_id?: string | null
          job_profile: Json
          robust_gap_analysis?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          cv_analysis_id?: string | null
          gap_analysis?: Json | null
          id?: string
          job_description?: string
          job_posting_id?: string | null
          job_profile?: Json
          robust_gap_analysis?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gap_analysis_results_cv_analysis_id_fkey"
            columns: ["cv_analysis_id"]
            isOneToOne: false
            referencedRelation: "cv_analysis_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gap_analysis_results_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_analysis: {
        Row: {
          ai_summary: string | null
          communication_score: number | null
          created_at: string
          cultural_fit_score: number | null
          final_decision: string | null
          id: string
          interview_session_id: string | null
          notes: string | null
          overall_score: number | null
          recommendations: string | null
          strengths: string[] | null
          technical_score: number | null
          updated_at: string
          weaknesses: string[] | null
        }
        Insert: {
          ai_summary?: string | null
          communication_score?: number | null
          created_at?: string
          cultural_fit_score?: number | null
          final_decision?: string | null
          id?: string
          interview_session_id?: string | null
          notes?: string | null
          overall_score?: number | null
          recommendations?: string | null
          strengths?: string[] | null
          technical_score?: number | null
          updated_at?: string
          weaknesses?: string[] | null
        }
        Update: {
          ai_summary?: string | null
          communication_score?: number | null
          created_at?: string
          cultural_fit_score?: number | null
          final_decision?: string | null
          id?: string
          interview_session_id?: string | null
          notes?: string | null
          overall_score?: number | null
          recommendations?: string | null
          strengths?: string[] | null
          technical_score?: number | null
          updated_at?: string
          weaknesses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_analysis_interview_session_id_fkey"
            columns: ["interview_session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_questions: {
        Row: {
          created_at: string
          id: string
          interview_session_id: string | null
          order_index: number | null
          question_text: string
          question_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          interview_session_id?: string | null
          order_index?: number | null
          question_text: string
          question_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          interview_session_id?: string | null
          order_index?: number | null
          question_text?: string
          question_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_questions_interview_session_id_fkey"
            columns: ["interview_session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_responses: {
        Row: {
          ai_analysis: Json | null
          created_at: string
          duration_seconds: number | null
          id: string
          interview_session_id: string | null
          question_id: string | null
          response_audio_url: string | null
          response_text: string | null
          score: number | null
          transcript: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          interview_session_id?: string | null
          question_id?: string | null
          response_audio_url?: string | null
          response_text?: string | null
          score?: number | null
          transcript?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          interview_session_id?: string | null
          question_id?: string | null
          response_audio_url?: string | null
          response_text?: string | null
          score?: number | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_responses_interview_session_id_fkey"
            columns: ["interview_session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "interview_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          audio_url: string | null
          candidate_id: string
          completed_at: string | null
          created_at: string
          id: string
          job_posting_id: string | null
          recruiter_id: string
          scheduled_at: string | null
          started_at: string | null
          status: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          candidate_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          job_posting_id?: string | null
          recruiter_id: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          candidate_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          job_posting_id?: string | null
          recruiter_id?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_sessions_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          company_name: string | null
          created_at: string
          description: string | null
          employment_type: string | null
          id: string
          location: string | null
          requirements: string | null
          salary_range: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          description?: string | null
          employment_type?: string | null
          id?: string
          location?: string | null
          requirements?: string | null
          salary_range?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          description?: string | null
          employment_type?: string | null
          id?: string
          location?: string | null
          requirements?: string | null
          salary_range?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      maya_interviews: {
        Row: {
          candidate_name: string | null
          candidate_phone: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          questions: Json
          responses: Json
          session_id: string
          started_at: string
          transcript: Json
          updated_at: string
          user_email: string | null
        }
        Insert: {
          candidate_name?: string | null
          candidate_phone?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          questions?: Json
          responses?: Json
          session_id: string
          started_at?: string
          transcript?: Json
          updated_at?: string
          user_email?: string | null
        }
        Update: {
          candidate_name?: string | null
          candidate_phone?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          questions?: Json
          responses?: Json
          session_id?: string
          started_at?: string
          transcript?: Json
          updated_at?: string
          user_email?: string | null
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          applications_count: number | null
          budget_max: number | null
          budget_min: number | null
          company_name: string | null
          created_at: string
          description: string | null
          duration: string | null
          employment_type: string | null
          experience_level: string | null
          id: string
          is_urgent: boolean | null
          location: string | null
          remote_allowed: boolean | null
          requirements: string | null
          skills: string[] | null
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applications_count?: number | null
          budget_max?: number | null
          budget_min?: number | null
          company_name?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          employment_type?: string | null
          experience_level?: string | null
          id?: string
          is_urgent?: boolean | null
          location?: string | null
          remote_allowed?: boolean | null
          requirements?: string | null
          skills?: string[] | null
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applications_count?: number | null
          budget_max?: number | null
          budget_min?: number | null
          company_name?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          employment_type?: string | null
          experience_level?: string | null
          id?: string
          is_urgent?: boolean | null
          location?: string | null
          remote_allowed?: boolean | null
          requirements?: string | null
          skills?: string[] | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          availability: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          experience: string | null
          hourly_rate: number | null
          id: string
          location: string | null
          name: string | null
          phone: string | null
          skills: string[] | null
          title: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          availability?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          experience?: string | null
          hourly_rate?: number | null
          id?: string
          location?: string | null
          name?: string | null
          phone?: string | null
          skills?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          availability?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          experience?: string | null
          hourly_rate?: number | null
          id?: string
          location?: string | null
          name?: string | null
          phone?: string | null
          skills?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget: number | null
          company_name: string | null
          created_at: string
          description: string | null
          duration: string | null
          experience_level: string | null
          github_url: string | null
          id: string
          image_url: string | null
          industry: string | null
          is_urgent: boolean | null
          live_url: string | null
          requirements: string | null
          team_size: string | null
          technologies: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number | null
          company_name?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          experience_level?: string | null
          github_url?: string | null
          id?: string
          image_url?: string | null
          industry?: string | null
          is_urgent?: boolean | null
          live_url?: string | null
          requirements?: string | null
          team_size?: string | null
          technologies?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number | null
          company_name?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          experience_level?: string | null
          github_url?: string | null
          id?: string
          image_url?: string | null
          industry?: string | null
          is_urgent?: boolean | null
          live_url?: string | null
          requirements?: string | null
          team_size?: string | null
          technologies?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          message: string | null
          referee_company: string | null
          referee_email: string
          referee_name: string
          referral_type: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          referee_company?: string | null
          referee_email: string
          referee_name: string
          referral_type: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          referee_company?: string | null
          referee_email?: string
          referee_name?: string
          referral_type?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          description: string
          id?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_experiences: {
        Row: {
          company: string
          created_at: string
          description: string | null
          duration: string | null
          id: string
          position: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company: string
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          position: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          position?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "interviewer" | "interviewee"
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
      app_role: ["admin", "interviewer", "interviewee"],
    },
  },
} as const
