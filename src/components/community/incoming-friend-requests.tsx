"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptFriendRequest, removeFriendRequest, type IncomingFriendRequest } from "@/actions/friends";
import { useDict } from "@/lib/i18n/locale-provider";

/** 自分のマイページで、届いている友達申請を承認/拒否できる一覧。 */
export function IncomingFriendRequests({ requests }: { requests: IncomingFriendRequest[] }) {
  const dict = useDict();
  const [items, setItems] = useState(requests);
  const [pending, startTransition] = useTransition();

  if (items.length === 0) return null;

  function respond(id: string, action: "accept" | "decline") {
    setItems((current) => current.filter((r) => r.id !== id));
    startTransition(async () => {
      if (action === "accept") await acceptFriendRequest(id);
      else await removeFriendRequest(id);
    });
  }

  return (
    <div className="grid gap-2 border-t border-border pt-4">
      <p className="text-xs text-muted-foreground">{dict.directory.incomingRequestsTitle}</p>
      <div className="flex flex-col gap-2">
        {items.map((r) => (
          <div key={r.id} className="flex items-center gap-2.5 rounded-xl border border-border p-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm">
              {r.requester?.avatar_url ? (
                <Image src={r.requester.avatar_url} alt="" width={36} height={36} className="h-full w-full object-cover" />
              ) : (
                r.requester?.full_name?.charAt(0) ?? "?"
              )}
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{r.requester?.full_name ?? "?"}</p>
            <Button type="button" size="icon" disabled={pending} onClick={() => respond(r.id, "accept")} aria-label={dict.directory.friendAcceptButton}>
              <UserCheck className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" disabled={pending} onClick={() => respond(r.id, "decline")} aria-label={dict.directory.friendDeclineButton}>
              <UserX className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
