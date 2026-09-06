"use client";

import Image from "next/image";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { useEffect, useRef, useState } from "react";
import { UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptFriendRequest, removeFriendRequest, type IncomingFriendRequest } from "@/actions/friends";
import { useDict } from "@/lib/i18n/locale-provider";

/** 自分のマイページで、届いている友達申請を承認/拒否できる一覧。 */
export function IncomingFriendRequests({ requests }: { requests: IncomingFriendRequest[] }) {
  const dict = useDict();
  const [items, setItems] = useState(requests);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  useEffect(() => { setItems(requests); }, [requests]);

  if (items.length === 0) return null;

  async function respond(id: string, action: "accept" | "decline") {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(false);
    try {
      const result = action === "accept" ? await acceptFriendRequest(id) : await removeFriendRequest(id);
      if (result.error || !result.success) setError(true);
      else setItems((current) => current.filter((r) => r.id !== id));
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2 border-t border-border pt-4" aria-busy={pending}>
      {error && <p role="alert" className="text-xs text-destructive">{dict.directory.friendActionError}</p>}
      <p className="text-xs text-muted-foreground">{dict.directory.incomingRequestsTitle}</p>
      <div className="flex flex-col gap-2">
        {items.map((r) => (
          <div key={r.id} className="flex items-center gap-2.5 rounded-xl border border-border p-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm">
              <Image src={r.requester?.avatar_url || DEFAULT_AVATAR_IMAGE_URL} alt="" width={36} height={36} className="h-full w-full object-cover" />
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
