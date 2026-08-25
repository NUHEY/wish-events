import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { buttonVariants } from "@/components/ui/button";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const isRa = profile.role === "ra";

  const { data: announcements, error } = await supabase
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="relative flex flex-col gap-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-6 left-1/2 -z-10 h-56 w-[36rem] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{dict.homeFeed.title}</h1>
          <p className="text-sm text-muted-foreground">{dict.homeFeed.subtitle}</p>
        </div>
        {isRa && (
          <Link href="/announcements/new" className={buttonVariants({ size: "sm" })}>
            <Plus className="mr-1 h-4 w-4" />
            {dict.homeFeed.newButton}
          </Link>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {dict.home.loadError}: {error.message}
        </p>
      )}

      {announcements && announcements.length === 0 && (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium">{dict.homeFeed.empty}</p>
          <p className="text-xs text-muted-foreground">{dict.homeFeed.emptyHint}</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {announcements?.map((a) => (
          <AnnouncementCard key={a.id} announcement={a} isRa={isRa} />
        ))}
      </div>
    </div>
  );
}
