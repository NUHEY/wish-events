import Link from "next/link";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatEventDateTime } from "@/lib/utils";

export default async function DashboardPage() {
  await requireRa();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("*, registrations(count)")
    .order("event_date", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">管理ダッシュボード</h1>
        <Link href="/events/new" className={buttonVariants({ size: "sm" })}>
          + 新規イベント作成
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {events?.map((event: any) => {
          const count = event.registrations?.[0]?.count ?? 0;
          return (
            <Card key={event.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="secondary">{event.category}</Badge>
                    {event.requires_registration && (
                      <span className="text-xs text-muted-foreground">
                        申込 {count}/{event.capacity}名
                      </span>
                    )}
                    {event.survey_type !== "none" && (
                      <Badge variant="outline">
                        アンケート: {event.survey_type === "external" ? "外部" : "内蔵"}
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium">{event.title}</p>
                  <p className="text-sm text-muted-foreground">{formatEventDateTime(event.event_date)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/events/${event.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    詳細
                  </Link>
                  <Link href={`/events/${event.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    編集
                  </Link>
                  <Link
                    href={`/dashboard/${event.id}/participants`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    参加者一覧
                  </Link>
                  <Link
                    href={`/dashboard/${event.id}/survey`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    アンケート管理
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {events?.length === 0 && (
          <p className="text-sm text-muted-foreground">まだイベントがありません。</p>
        )}
      </div>
    </div>
  );
}
