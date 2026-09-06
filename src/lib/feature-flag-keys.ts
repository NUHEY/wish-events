export type FeatureFlagState = "public" | "beta" | "hidden";
export type FeatureFlagKey =
  | "friend_dm"
  | "floor_group_chat"
  | "event_calendar_export"
  | "availability_matching"
  | "lets_chat_booking"
  | "unit_room_sessions"
  | "ra_question_box"
  | "ra_link_hub"
  | "wish_knowledge"
  | "resident_events"
  | "resident_directory"
  | "share_qr"
  | "split_bill"
  | "group_shuffle"
  | "world_clock";

export const FEATURE_FLAG_KEYS: FeatureFlagKey[] = [
  "friend_dm",
  "floor_group_chat",
  "event_calendar_export",
  "availability_matching",
  "lets_chat_booking",
  "unit_room_sessions",
  "ra_link_hub",
  "wish_knowledge",
  "resident_events",
  "resident_directory",
  "share_qr",
  "split_bill",
  "group_shuffle",
  "world_clock",
];


/** These tools were already public before publication controls were added. */
export function defaultFeatureState(key: FeatureFlagKey): FeatureFlagState {
  return ["resident_directory", "share_qr", "split_bill", "group_shuffle", "world_clock"].includes(key) ? "public" : "hidden";
}
