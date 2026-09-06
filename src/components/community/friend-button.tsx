"use client";

import { useEffect, useRef, useState } from "react";
import { UserCheck, UserPlus, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendFriendRequest, acceptFriendRequest, removeFriendRequest } from "@/actions/friends";
import type { FriendActionResult, FriendRelation } from "@/actions/friends";
import { useDict } from "@/lib/i18n/locale-provider";

/** 保存結果に合わせて状態を更新し、送信・承認・取り消しの重複操作を防ぐ。 */
export function FriendButton({ targetId, initial }: { targetId: string; initial: FriendRelation }) {
  const dict = useDict();
  const [relation, setRelation] = useState<FriendRelation>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);

  useEffect(() => { setRelation({ status: initial.status, requestId: initial.requestId }); }, [initial.status, initial.requestId, targetId]);

  async function run(action: () => Promise<FriendActionResult>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(false);
    try {
      const result = await action();
      if (!result.success || !result.relation || result.error) setError(true);
      else setRelation(result.relation);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function handleSend() { void run(() => sendFriendRequest(targetId)); }

  function handleCancelOrRemove(confirmMessage?: string) {
    if (busy.current || !relation.requestId) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const requestId = relation.requestId;
    void run(() => removeFriendRequest(requestId));
  }

  function handleAccept() {
    if (!relation.requestId) return;
    const requestId = relation.requestId;
    void run(() => acceptFriendRequest(requestId));
  }

  function renderButton() {
  if (relation.status === "none") {
    return (
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleSend} className="gap-1.5">
        <UserPlus className="h-4 w-4" />
        {dict.directory.friendAddButton}
      </Button>
    );
  }

  if (relation.status === "pending_sent") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => handleCancelOrRemove()}
        className="gap-1.5 text-muted-foreground"
      >
        <UserX className="h-4 w-4" />
        {dict.directory.friendPendingSentButton}
      </Button>
    );
  }

  if (relation.status === "pending_received") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{dict.directory.friendPendingReceivedNote}</span>
        <Button type="button" size="sm" disabled={pending} onClick={handleAccept} className="gap-1.5">
          <UserCheck className="h-4 w-4" />
          {dict.directory.friendAcceptButton}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => handleCancelOrRemove()}
        >
          {dict.directory.friendDeclineButton}
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => handleCancelOrRemove(dict.directory.friendRemoveConfirm)}
      className="gap-1.5"
    >
      <UserCheck className="h-4 w-4" />
      {dict.directory.friendStatusButton}
    </Button>
  );
  }

  return <div className="flex min-w-0 flex-col items-end gap-1.5" aria-busy={pending}>
    {renderButton()}
    {error && <p role="alert" className="max-w-64 text-xs text-destructive">{dict.directory.friendActionError}</p>}
  </div>;
}
