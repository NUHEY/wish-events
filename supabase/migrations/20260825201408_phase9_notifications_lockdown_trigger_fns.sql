-- notify_*関数はトリガーからのみ発火されるべきで、直接RPCとして呼び出す必要はない。
-- security advisorの「anon/authenticatedがSECURITY DEFINER関数を実行可能」という
-- 警告を解消するため、全ロールからEXECUTE権限を剥奪する
-- （トリガー自体は発火時にEXECUTE権限を再チェックしないため、これで発火は妨げられない）。
revoke all on function public.notify_friend_request() from public, anon, authenticated;
revoke all on function public.notify_friend_accept() from public, anon, authenticated;
revoke all on function public.notify_event_like() from public, anon, authenticated;
revoke all on function public.notify_event_comment() from public, anon, authenticated;
revoke all on function public.notify_event_comment_like() from public, anon, authenticated;
revoke all on function public.notify_announcement_comment() from public, anon, authenticated;
revoke all on function public.notify_announcement_comment_like() from public, anon, authenticated;
