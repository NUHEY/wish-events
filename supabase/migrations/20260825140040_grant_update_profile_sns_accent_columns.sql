-- プロフィール編集で「保存に失敗しました: permission denied for table users」に
-- なっていた不具合の修正。usersテーブルは列単位のGRANT UPDATEで許可列を絞って
-- いるが、line_id/x_handle/profile_accent列を追加した際にここへの追加を忘れていた。
grant update (line_id, x_handle, profile_accent) on public.users to authenticated;
