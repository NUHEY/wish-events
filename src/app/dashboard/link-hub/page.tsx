import { LinkHubEditor, type LinkHubInitial } from "@/components/dashboard/link-hub-editor";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLinkHubPage() {
  const profile = await requireRa();
  const supabase = await createClient();
  const { data: hub } = await supabase.from("ra_link_hubs").select("*").eq("owner_id", profile.id).maybeSingle();
  const { data: items } = hub ? await supabase.from("ra_link_items").select("*").eq("hub_id", hub.id).order("position") : { data: [] };
  const baseSlug = `${profile.floor_number ? `${profile.floor_number}f-` : ""}${(profile.full_name ?? "ra").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ra"}`.slice(0, 40);
  return <div className="mx-auto max-w-3xl space-y-4"><header><h1 className="text-2xl font-bold">RAリンクページ</h1><p className="mt-1 text-sm text-muted-foreground">外泊届、SNS、資料、予約ページなどを1つのURLにまとめます。</p></header><LinkHubEditor initialHub={hub as LinkHubInitial} initialItems={(items ?? []).map((item) => ({ id: item.id, title: item.title, url: item.url, description: item.description ?? "", icon: item.icon, enabled: item.is_enabled }))} defaultSlug={baseSlug.length >= 3 ? baseSlug : "wish-ra"} defaultTitle={`${profile.floor_number ? `${profile.floor_number}F ` : ""}RA Links`} /></div>;
}
