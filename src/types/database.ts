/**
 * 手書きの型定義（簡易版）。
 * 本番運用時は Supabase CLI で正式な型を生成してこのファイルを置き換えてください:
 *   npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
 */

export type UserRole = "resident" | "ra";
export type EventCategory =
  | "RR"
  | "SI"
  | "公式イベント"
  | "フロアイベント"
  | "サポーター募集"
  | "その他";
export type SurveyType = "none" | "external" | "internal";
export type QuestionType =
  | "text"
  | "single_choice"
  | "multiple_choice"
  | "rating";

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  student_id: string | null;
  floor_number: number | null;
  room_number: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  title: string;
  category: EventCategory;
  description: string | null;
  poster_url: string | null;
  location: string | null;
  target_audience: string | null;
  event_date: string;
  requires_registration: boolean;
  capacity: number | null;
  target_floors: number[] | null;
  survey_type: SurveyType;
  survey_external_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RegistrationRow {
  id: string;
  event_id: string;
  user_id: string;
  registered_at: string;
}

export interface SurveyRow {
  id: string;
  event_id: string;
  title: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SurveyQuestionRow {
  id: string;
  survey_id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  is_required: boolean;
  position: number;
}

export interface SurveyResponseRow {
  id: string;
  survey_id: string;
  user_id: string;
  submitted_at: string;
}

export interface SurveyAnswerRow {
  id: string;
  response_id: string;
  question_id: string;
  answer_text: string | null;
  answer_options: string[] | null;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Partial<UserRow> & { id: string; email: string };
        Update: Partial<UserRow>;
        Relationships: [];
      };
      events: {
        Row: EventRow;
        Insert: Partial<EventRow> & {
          title: string;
          category: EventCategory;
          event_date: string;
          created_by: string;
        };
        Update: Partial<EventRow>;
        Relationships: [];
      };
      registrations: {
        Row: RegistrationRow;
        Insert: Partial<RegistrationRow> & {
          event_id: string;
          user_id: string;
        };
        Update: Partial<RegistrationRow>;
        Relationships: [];
      };
      surveys: {
        Row: SurveyRow;
        Insert: Partial<SurveyRow> & {
          event_id: string;
          title: string;
          created_by: string;
        };
        Update: Partial<SurveyRow>;
        Relationships: [];
      };
      survey_questions: {
        Row: SurveyQuestionRow;
        Insert: Partial<SurveyQuestionRow> & {
          survey_id: string;
          question_text: string;
          question_type: QuestionType;
        };
        Update: Partial<SurveyQuestionRow>;
        Relationships: [];
      };
      survey_responses: {
        Row: SurveyResponseRow;
        Insert: Partial<SurveyResponseRow> & {
          survey_id: string;
          user_id: string;
        };
        Update: Partial<SurveyResponseRow>;
        Relationships: [];
      };
      survey_answers: {
        Row: SurveyAnswerRow;
        Insert: Partial<SurveyAnswerRow> & {
          response_id: string;
          question_id: string;
        };
        Update: Partial<SurveyAnswerRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
