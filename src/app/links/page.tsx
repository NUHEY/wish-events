import Link from "next/link";
import { ChevronRight, Link2 } from "lucide-react";
import { redirect } from "next/navigation";
import { BetaBadge } from "@/components/tools/beta-badge";
import { getCurrentProfile } from "@/lib/auth";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import type { DirectoryProfileRow } from "@/types/database";

export default async function LinkHubsPage() {
  const profile = await getCurrentProfile();
  if ((await getFeatureFlagState("ra_link_hub")) === "hidden" && profile.role !== "ra") redirect("/tools");
  const supabase = await createClient();
  const [{ data: hubs }, { data: profiles }] = await Promise.all([supabase.from("ra_link_hubs").select("*").eq("is_published", true).order("title"), supabase.rpc("directory_profiles")]);
  const people = new Map(((profiles ?? []) as DirectoryProfileRow[]).map((person) => [person.id, person]));
  return <div className="mx-auto max-w-3xl space-y-5"><header><div className="flex items-center gap-2"><BetaBadge /><span className="text-xs font-semibold text-muted-foreground">Quick links</span></div><h1 className="mt-2 text-2xl font-extrabold">RAリンクページ</h1><p className="mt-1 text-sm text-muted-foreground">各RAがまとめた、寮生活でよく使うリンクです。</p></header>{(hubs ?? []).length === 0 ? <div className="rounded-2xl border border-dashed border-border p-10 text-center"><Link2 className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-3 font-bold">公開中のページはありません</p></div> : <div className="grid gap-3 sm:grid-cols-2">{(hubs ?? []).map((hub) => { const owner = people.get(hub.owner_id); return <Link key={hub.id} href={`/links/${hub.slug}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card active:scale-[0.99]"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Link2 className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate font-bold">{hub.title}</span><span className="text-xs text-muted-foreground">{owner?.full_name ?? "RA"}{owner?.floor_number ? ` · ${owner.floor_number}F` : ""}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>; })}</div>}</div>;
}
