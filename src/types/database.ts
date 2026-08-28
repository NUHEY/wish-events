/**
 * 手書きの型定義（簡易版）。
 * 本番運用時は Supabase CLI で正式な型を生成してこのファイルを置き換えてください:
 *   npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
 */

export type UserRole = "resident" | "ra";
export type UserAccountKind = "resident" | "service_desk" | "university_staff";
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
  account_kind: UserAccountKind;
  faculty: string | null;
  grade_level: string | null;
  languages: string[] | null;
  nationalities: string[] | null;
  lived_countries: string[] | null;
  instagram_handle: string | null;
  line_qr_path: string | null;
  self_intro: string | null;
  avatar_url: string | null;
  line_id: string | null;
  x_handle: string | null;
  /** @deprecated profile_accents（配列・最大5色）に置き換え済み。互換のため列は残している。 */
  profile_accent: string | null;
  profile_accents: string[] | null;
  profile_cover_url: string | null;
  moved_out_at: string | null;
  wish_entry_month: string | null;
  is_new_resident: boolean;
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
  line_id: string | null;
  x_handle: string | null;
  profile_accents: string[] | null;
  profile_cover_url: string | null;
}

export type BadgeCriteriaType =
  | "event_count"
  | "survey_count"
  | "friend_count"
  | "comment_count"
  | "message_count"
  | "like_given_count";

/** ゲーム要素（マイページのバッジ）の定義。/dashboard/badgesでRAが編集する。 */
export interface BadgeRow {
  id: string;
  key: string;
  label: string;
  label_en: string | null;
  description: string | null;
  description_en: string | null;
  icon: string;
  color: string;
  criteria_type: BadgeCriteriaType;
  criteria_value: number;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** user_engagement_stats()関数の返り値。バッジ判定・アイコンの金色リング表示に使う。 */
export interface EngagementStats {
  event_count: number;
  survey_count: number;
  friend_count: number;
  comment_count: number;
  message_count: number;
  like_given_count: number;
}

export type FriendRequestStatus = "pending" | "accepted";

/** 寮生同士の「友達」申請・承認。 */
export interface FriendRequestRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendRequestStatus;
  created_at: string;
  responded_at: string | null;
}

export interface EventRow {
  id: string;
  title: string;
  title_en: string | null;
  category: EventCategory;
  description: string | null;
  description_en: string | null;
  poster_url: string | null;
  thumbnail_url: string | null;
  creator_type: "ra" | "resident";
  moderation_status: "published" | "pending" | "rejected";
  location: string | null;
  location_en: string | null;
  target_audience: string | null;
  target_audience_en: string | null;
  event_date: string;
  requires_registration: boolean;
  capacity: number | null;
  fee_amount: number | null;
  show_free_tag: boolean;
  payment_info: string | null;
  payment_due_at: string | null;
  payment_destination: string | null;
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

/**
 * EventCard の表示に必要な列だけを抜き出した型。
 * 一覧系ページで select("*") の代わりに絞り込んだ列だけを取得する際に使う
 * （src/lib/utils.ts の EVENT_CARD_COLUMNS と対応させること）。
 */
export type EventCardData = Pick<
  EventRow,
  | "id"
  | "title"
  | "title_en"
  | "category"
  | "poster_url"
  | "thumbnail_url"
  | "creator_type"
  | "fee_amount"
  | "show_free_tag"
  | "event_date"
  | "created_at"
  | "registration_closes_at"
>;

export type HomeLayoutSectionKey =
  | "week_events"
  | "floor_events"
  | "announcements"
  | "featured_events"
  | "popular_events"
  | "friends_events"
  | "resident_events"
  | "tools";
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

export interface FeatureFlagRow {
  key: string;
  state: "public" | "beta" | "hidden";
  show_on_home: boolean;
  home_position: number;
  updated_by: string | null;
  updated_at: string;
}

export interface WishQuestionRow {
  id: string;
  asked_by: string;
  title: string;
  body: string;
  category: "life" | "rules" | "study" | "food" | "local" | "other";
  accepted_answer_id: string | null;
  answer_count: number;
  created_at: string;
  updated_at: string;
}

export interface WishAnswerRow {
  id: string;
  question_id: string;
  answered_by: string;
  body: string;
  created_at: string;
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

export interface RegistrationPaymentRow {
  registration_id: string;
  status: "unpaid" | "paid" | "waived";
  confirmed_at: string | null;
  confirmed_by: string | null;
  note: string | null;
  updated_at: string;
}

export interface EventMessageRow {
  id: string;
  event_id: string;
  sender_id: string;
  body: string;
  message_type: "text" | "image" | "tool" | "poll";
  media_path: string | null;
  action_url: string | null;
  action_label: string | null;
  poll_id: string | null;
  created_at: string;
}

export interface DirectMessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  message_type: "text" | "image";
  media_path: string | null;
  created_at: string;
}

export interface FloorMessageRow {
  id: string;
  floor_number: number;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface EventMessageReactionRow {
  message_id: string;
  user_id: string;
  emoji: "❤️" | "👍" | "🎉" | "😂" | "👀";
  created_at: string;
}

export interface EventPollRow {
  id: string;
  event_id: string;
  question: string;
  options: string[];
  created_by: string;
  created_at: string;
  closes_at: string | null;
}

export interface EventCommentRow {
  id: string;
  event_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementCommentRow {
  id: string;
  announcement_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export type NotificationType =
  | "friend_request"
  | "friend_accept"
  | "event_like"
  | "event_comment"
  | "event_comment_reply"
  | "event_comment_like"
  | "announcement_comment"
  | "announcement_comment_reply"
  | "announcement_comment_like"
  | "ra_broadcast";

export interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  link: string;
  preview_text: string | null;
  sender_label: string | null;
  read_at: string | null;
  created_at: string;
  broadcast_id?: string | null;
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
  is_active: boolean;
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
  tags: string[];
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

export interface SiteSettingsRow {
  id: number;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  favicon_url: string | null;
  apple_touch_icon_url: string | null;
  app_short_name: string;
  theme_color: string;
  accent_color: string | null;
  colorful_status: boolean;
  event_label_rotation_enabled: boolean;
  event_label_duration_ms: number;
  event_label_jitter_percent: number;
  event_label_shuffle_enabled: boolean;
  event_label_limit: number;
  event_label_position: "top-left" | "top-right";
  event_show_category_label: boolean;
  event_show_new_label: boolean;
  event_show_deadline_label: boolean;
  event_show_fee_label: boolean;
  event_show_free_label: boolean;
  event_new_days: number;
  event_deadline_hours: number;
  event_title_lines: 1 | 2 | 3;
  event_card_density: "compact" | "comfortable";
  navigation_lock_enabled: boolean;
  navigation_stall_seconds: number;
  mobile_touch_feedback_enabled: boolean;
  mobile_touch_feedback_ms: number;
  motion_level: "subtle" | "standard" | "lively";
  cta_blur_px: number;
  cta_fade_height_px: number;
  cta_transition_ms: number;
  home_tool_density: "minimal" | "compact";
  schedule_default_start_time: string;
  schedule_default_end_time: string;
  schedule_default_slot_minutes: 15 | 30 | 60;
  schedule_max_days: number;
  updated_by: string | null;
  updated_at: string;
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
      site_settings: {
        Row: SiteSettingsRow;
        Insert: Partial<SiteSettingsRow> & { id?: number };
        Update: Partial<SiteSettingsRow>;
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
      wish_questions: {
        Row: WishQuestionRow;
        Insert: Partial<WishQuestionRow> & { asked_by: string; title: string; body: string };
        Update: Partial<WishQuestionRow>;
        Relationships: [];
      };
      wish_answers: {
        Row: WishAnswerRow;
        Insert: Partial<WishAnswerRow> & { question_id: string; answered_by: string; body: string };
        Update: Partial<WishAnswerRow>;
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
      registration_payments: {
        Row: RegistrationPaymentRow;
        Insert: Partial<RegistrationPaymentRow> & { registration_id: string };
        Update: Partial<RegistrationPaymentRow>;
        Relationships: [];
      };
      event_messages: {
        Row: EventMessageRow;
        Insert: Partial<EventMessageRow> & { event_id: string; sender_id: string; body: string };
        Update: Partial<EventMessageRow>;
        Relationships: [];
      };
      event_message_reactions: {
        Row: EventMessageReactionRow;
        Insert: EventMessageReactionRow;
        Update: never;
        Relationships: [];
      };
      event_polls: {
        Row: EventPollRow;
        Insert: Partial<EventPollRow> & { event_id: string; question: string; options: string[]; created_by: string };
        Update: Partial<EventPollRow>;
        Relationships: [];
      };
      event_poll_votes: {
        Row: { poll_id: string; user_id: string; option_index: number; created_at: string };
        Insert: { poll_id: string; user_id: string; option_index: number };
        Update: { option_index?: number };
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
      announcement_comments: {
        Row: AnnouncementCommentRow;
        Insert: Partial<AnnouncementCommentRow> & { announcement_id: string; user_id: string; body: string };
        Update: Partial<AnnouncementCommentRow>;
        Relationships: [];
      };
      announcement_comment_likes: {
        Row: { comment_id: string; user_id: string; created_at: string };
        Insert: { comment_id: string; user_id: string };
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: never;
        Update: Partial<Pick<NotificationRow, "read_at">>;
        Relationships: [];
      };
      event_likes: {
        Row: { event_id: string; user_id: string; created_at: string };
        Insert: { event_id: string; user_id: string };
        Update: never;
        Relationships: [];
      };
      event_chat_reads: {
        Row: { event_id: string; user_id: string; last_read_at: string };
        Insert: { event_id: string; user_id: string; last_read_at?: string };
        Update: { last_read_at?: string };
        Relationships: [];
      };
      direct_messages: {
        Row: DirectMessageRow;
        Insert: Partial<DirectMessageRow> & { sender_id: string; recipient_id: string; body: string };
        Update: never;
        Relationships: [];
      };
      direct_message_reads: {
        Row: { user_id: string; other_user_id: string; last_read_at: string };
        Insert: { user_id: string; other_user_id: string; last_read_at?: string };
        Update: { last_read_at?: string };
        Relationships: [];
      };
      floor_messages: {
        Row: FloorMessageRow;
        Insert: Partial<FloorMessageRow> & { floor_number: number; sender_id: string; body: string };
        Update: never;
        Relationships: [];
      };
      floor_message_reads: {
        Row: { user_id: string; floor_number: number; last_read_at: string };
        Insert: { user_id: string; floor_number: number; last_read_at?: string };
        Update: { last_read_at?: string };
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
      feature_flags: {
        Row: FeatureFlagRow;
        Insert: Partial<FeatureFlagRow> & { key: string };
        Update: Partial<FeatureFlagRow>;
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
      badges: {
        Row: BadgeRow;
        Insert: Partial<BadgeRow> & { key: string; label: string; criteria_type: BadgeCriteriaType; criteria_value: number };
        Update: Partial<BadgeRow>;
        Relationships: [];
      };
      friend_requests: {
        Row: FriendRequestRow;
        Insert: Partial<FriendRequestRow> & { requester_id: string; addressee_id: string };
        Update: Partial<FriendRequestRow>;
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
      user_engagement_stats: {
        Args: { p_user_id: string };
        Returns: EngagementStats[];
      };
      self_move_out: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      can_access_event_talk: {
        Args: { target_event_id: string };
        Returns: boolean;
      };
      event_community_profiles_v3: {
        Args: { profile_ids: string[] };
        Returns: { id: string; full_name: string | null; avatar_url: string | null; role: UserRole }[];
      };
      popular_upcoming_events: {
        Args: { p_limit?: number };
        Returns: { event_id: string; registration_count: number }[];
      };
      friends_attending_events: {
        Args: Record<string, never>;
        Returns: { event_id: string; friend_id: string }[];
      };
      event_registration_user_ids: {
        Args: { p_event_id: string };
        Returns: { user_id: string; registered_at: string }[];
      };
      event_registration_user_ids_batch: {
        Args: { p_event_ids: string[] };
        Returns: { event_id: string; user_id: string; registered_at: string }[];
      };
      event_registration_count: {
        Args: { p_event_id: string };
        Returns: number;
      };
      friend_dm_threads: {
        Args: Record<string, never>;
        Returns: {
          friend_id: string;
          last_message_body: string | null;
          last_message_type: string | null;
          last_message_at: string | null;
          last_sender_id: string | null;
          unread: boolean;
        }[];
      };
      floor_group_thread: {
        Args: Record<string, never>;
        Returns: {
          floor_number: number;
          last_message_body: string | null;
          last_message_at: string | null;
          last_sender_id: string | null;
          unread: boolean;
          member_count: number;
        }[];
      };
      floor_group_profiles: {
        Args: Record<string, never>;
        Returns: { id: string; full_name: string | null; avatar_url: string | null; role: UserRole; room_number: string | null }[];
      };
      can_access_dm_media: {
        Args: { p_pair: string };
        Returns: boolean;
      };
      send_ra_broadcast_notification: {
        Args: { p_target_ids: string[]; p_preview_text: string; p_link: string; p_broadcast_id: string; p_sender_mode: string; p_sender_label: string };
        Returns: number;
      };
      create_schedule_session: {
        Args: {
          p_kind: string;
          p_title: string;
          p_description: string | null;
          p_start_date: string;
          p_end_date: string;
          p_daily_start_time: string;
          p_daily_end_time: string;
          p_slot_minutes: number;
          p_floor_number: number | null;
          p_participant_ids: string[];
          p_ra_ids: string[];
        };
        Returns: { id: string; share_token: string }[];
      };
      submit_survey_response: {
        Args: { p_survey_id: string; p_answers: unknown };
        Returns: string;
      };
      save_event_survey: {
        Args: { p_event_id: string; p_title: string; p_questions: unknown };
        Returns: string;
      };
      set_schedule_status: {
        Args: { p_session_id: string; p_status: string };
        Returns: undefined;
      };
      delete_schedule_session: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
      set_lets_chat_completed: {
        Args: { p_booking_id: string; p_completed: boolean };
        Returns: undefined;
      };
      create_resident_event: {
        Args: { p_title: string; p_description: string; p_location: string; p_event_date: string; p_capacity: number | null; p_image_url: string };
        Returns: string;
      };
      accept_wish_answer: {
        Args: { p_question_id: string; p_answer_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
