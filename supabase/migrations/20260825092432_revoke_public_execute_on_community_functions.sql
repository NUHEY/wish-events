
-- 前回のREVOKE FROM anonだけでは、PUBLIC (=) 経由でanonに実行権限が残って
-- いたため効果がなかった。PUBLICからも明示的に剥奪し、authenticatedのみ
-- 実行できる状態にする（他のRPCと同じ方針）。
revoke execute on function public.can_access_event_talk(uuid) from public;
revoke execute on function public.event_community_profiles_v3(uuid[]) from public;
grant execute on function public.can_access_event_talk(uuid) to authenticated;
grant execute on function public.event_community_profiles_v3(uuid[]) to authenticated;
