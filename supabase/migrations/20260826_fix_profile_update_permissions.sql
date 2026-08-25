-- プロフィール公開設定・カバー画像追加後の列権限不足を修正する。
-- RLSの users_update_own により、更新できる行は引き続き本人の行だけです。
grant update (
  full_name,
  student_id,
  floor_number,
  room_number,
  faculty,
  grade_level,
  languages,
  nationalities,
  lived_countries,
  instagram_handle,
  line_qr_path,
  self_intro,
  avatar_url,
  line_id,
  x_handle,
  profile_accent,
  profile_cover_url,
  show_past_events,
  show_sns,
  show_languages,
  show_nationalities
) on public.users to authenticated;
