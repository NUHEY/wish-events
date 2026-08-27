import { notFound } from "next/navigation";
import { LinkHubView } from "@/components/tools/link-hub-view";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DirectoryProfileRow } from "@/types/database";

export default async function LinkHubPage({ params }: { params: { slug: string } }) {
  await getCurrentProfile();
  const supabase = await createClient();
  const { data: hub } = await supabase.from("ra_link_hubs").select("*").eq("slug", params.slug).maybeSingle();
  if (!hub) notFound();
  const [{ data: items }, { data: profiles }] = await Promise.all([supabase.from("ra_link_items").select("*").eq("hub_id", hub.id).eq("is_enabled", true).order("position"), supabase.rpc("directory_profiles", { p_user_id: hub.owner_id })]);
  const owner = ((profiles ?? []) as DirectoryProfileRow[])[0];
  return <LinkHubView hub={{ slug: hub.slug, title: hub.title, bio: hub.bio, owner_name: owner?.full_name, floor_number: owner?.floor_number }} items={(items ?? []).map((item) => ({ id: item.id, title: item.title, url: item.url, description: item.description, icon: item.icon }))} />;
}
