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
  faculty: string | null;
  grade_level: string | null;
  languages: string[] | null;
  nationalities: string[] | null;
  lived_countries: string[] | null;
  instagram_handle: string | null;
  line_qr_path: string | null;
  self_intro: string | null;
  avatar_url: string | null;
  moved_out_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 寮生ディレクトリ表示用（directory_profiles()関数の返り値）。email/student_id/line_qr_pathは含まない。 */
export interface DirectoryProfileRow {
  id: string;
  full_name: string | null;
  role: UserRole;
  floor_number: number | null;
  room_number: string | null;
  faculty: string | null;
  grade_level: string | null;
  languages: string[] | null;
  nationalities: string[] | null;
  lived_countries: string[] | null;
  instagram_handle: string | null;
  self_intro: string | null;
  avatar_url: string | null;
}

export interface EventRow {
  id: string;
  title: string;
  title_en: string | null;
  category: EventCategory;
  description: string | null;
  description_en: string | null;
  poster_url: string | null;
  location: string | null;
  location_en: string | null;
  target_audience: string | null;
  target_audience_en: string | null;
  event_date: string;
  requires_registration: boolean;
  capacity: number | null;
  fee_amount: number | null;
  payment_info: string | null;
  publish_at: string | null;
  registration_opens_at: string | null;
  registration_requires_answers: boolean;
  target_floors: number[] | null;
  survey_type: SurveyType;
  survey_external_url: string | null;
  registration_closes_at: string | null;
  location_url: string | null;
  contact_info: string | null;
  notes: string | null;
  is_pinned: boolean;
  member_ids: string[];
  all_ra_members: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type HomeLayoutSectionKey = "week_events" | "floor_events" | "announcements";
export type HomeAccentKey = "wine" | "gold" | "teal" | "forest" | null;

export interface HomeLayoutSectionRow {
  id: string;
  section_key: HomeLayoutSectionKey;
  visible: boolean;
  position: number;
  accent: string | null;
  title_ja: string | null;
  title_en: string | null;
  updated_at: string;
}

export interface EventLocationOptionRow {
  id: string;
  label_ja: string;
  label_en: string | null;
  position: number;
  created_at: string;
}

export interface EventAudienceOptionRow {
  id: string;
  label_ja: string;
  label_en: string | null;
  position: number;
  created_at: string;
}

export interface RegistrationRow {
  id: string;
  event_id: string;
  user_id: string;
  registered_at: string;
}

export interface EventMessageRow {
  id: string;
  event_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface EventCommentRow {
  id: string;
  event_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
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

export interface RaRoomRow {
  id: string;
  floor_number: number;
  room_number: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface RegistrationQuestionRow {
  id: string;
  event_id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  is_required: boolean;
  position: number;
  created_at: string;
}

export interface RegistrationAnswerRow {
  id: string;
  registration_id: string;
  question_id: string;
  answer_text: string | null;
  answer_options: string[] | null;
  created_at: string;
}

export interface AnnouncementRow {
  id: string;
  title: string;
  category_label: string | null;
  body: string;
  cover_image_url: string | null;
  pinned: boolean;
  member_ids: string[];
  all_ra_members: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** イベント・お知らせの企画メンバー表示に必要な最小限のプロフィール。 */
export interface TeamMemberRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
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
      event_messages: {
        Row: EventMessageRow;
        Insert: Partial<EventMessageRow> & { event_id: string; sender_id: string; body: string };
        Update: Partial<EventMessageRow>;
        Relationships: [];
      };
      event_comments: {
        Row: EventCommentRow;
        Insert: Partial<EventCommentRow> & { event_id: string; user_id: string; body: string };
        Update: Partial<EventCommentRow>;
        Relationships: [];
      };
      event_comment_likes: {
        Row: { comment_id: string; user_id: string; created_at: string };
        Insert: { comment_id: string; user_id: string };
        Update: never;
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
      ra_rooms: {
        Row: RaRoomRow;
        Insert: Partial<RaRoomRow> & {
          floor_number: number;
          room_number: string;
        };
        Update: Partial<RaRoomRow>;
        Relationships: [];
      };
      registration_questions: {
        Row: RegistrationQuestionRow;
        Insert: Partial<RegistrationQuestionRow> & {
          event_id: string;
          question_text: string;
        };
        Update: Partial<RegistrationQuestionRow>;
        Relationships: [];
      };
      registration_answers: {
        Row: RegistrationAnswerRow;
        Insert: Partial<RegistrationAnswerRow> & {
          registration_id: string;
          question_id: string;
        };
        Update: Partial<RegistrationAnswerRow>;
        Relationships: [];
      };
      announcements: {
        Row: AnnouncementRow;
        Insert: Partial<AnnouncementRow> & {
          title: string;
          body: string;
          created_by: string;
        };
        Update: Partial<AnnouncementRow>;
        Relationships: [];
      };
      home_layout_sections: {
        Row: HomeLayoutSectionRow;
        Insert: Partial<HomeLayoutSectionRow> & {
          section_key: HomeLayoutSectionKey;
          position: number;
        };
        Update: Partial<HomeLayoutSectionRow>;
        Relationships: [];
      };
      event_location_options: {
        Row: EventLocationOptionRow;
        Insert: Partial<EventLocationOptionRow> & { label_ja: string };
        Update: Partial<EventLocationOptionRow>;
        Relationships: [];
      };
      event_audience_options: {
        Row: EventAudienceOptionRow;
        Insert: Partial<EventAudienceOptionRow> & { label_ja: string };
        Update: Partial<EventAudienceOptionRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      sync_own_role: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      resync_room_role: {
        Args: { p_floor: number; p_room: string };
        Returns: undefined;
      };
      demote_to_resident: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      release_room: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      reset_all_room_assignments: {
        Args: { p_confirm: string };
        Returns: number;
      };
      directory_profiles: {
        Args: { p_user_id?: string | null };
        Returns: DirectoryProfileRow[];
      };
      self_move_out: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
