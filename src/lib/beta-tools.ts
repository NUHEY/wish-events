import type { FeatureFlagKey, FeatureFlagState } from "@/lib/feature-flags";

export type ScheduleKind = "general" | "lets_chat" | "urs";

export const SCHEDULE_COPY: Record<ScheduleKind, { title: string; shortTitle: string; description: string; flag: FeatureFlagKey }> = {
  general: {
    title: "みんなの日程調整",
    shortTitle: "日程調整",
    description: "2人以上の空き時間を重ねて、集まりやすい時間を見つけます。",
    flag: "availability_matching",
  },
  lets_chat: {
    title: "Let's Chat! 予約",
    shortTitle: "Let's Chat!",
    description: "同じフロアのRAが登録した空き時間から、1対1の時間を予約します。",
    flag: "lets_chat_booking",
  },
  urs: {
    title: "Unit Room Session",
    shortTitle: "URS",
    description: "ルームメイトとRAが全員参加できる時間を探します。",
    flag: "unit_room_sessions",
  },
};

export type ToolFlagStates = Record<FeatureFlagKey, FeatureFlagState>;

export type ScheduleSession = {
  id: string;
  share_token: string;
  kind: ScheduleKind;
  title: string;
  description: string | null;
  created_by: string;
  floor_number: number | null;
  start_date: string;
  end_date: string;
  daily_start_time: string;
  daily_end_time: string;
  slot_minutes: 15 | 30 | 60;
  status: "open" | "closed";
  created_at: string;
};

export type ScheduleParticipant = {
  session_id: string;
  user_id: string;
  participant_role: "organizer" | "participant" | "ra";
  full_name?: string | null;
  avatar_url?: string | null;
  floor_number?: number | null;
  room_number?: string | null;
  faculty?: string | null;
  languages?: string[] | null;
  self_intro?: string | null;
};

export type ScheduleAvailability = {
  id: string;
  session_id: string;
  user_id: string;
  start_at: string;
  end_at: string;
};

export type ScheduleBooking = {
  id: string;
  session_id: string;
  resident_id: string;
  ra_id: string;
  start_at: string;
  end_at: string;
  status: "confirmed" | "cancelled";
  completed_at?: string | null;
};
