"use client";

import { useState, useTransition } from "react";
import { UserCheck, UserPlus, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendFriendRequest, acceptFriendRequest, removeFriendRequest } from "@/actions/friends";
import type { FriendRelation, FriendRelationStatus } from "@/actions/friends";
import { useDict } from "@/lib/i18n/locale-provider";

/**
 * 他の寮生のプロフィールに表示する友達申請ボタン。
 * サーバーから渡された初期状態を楽観的にローカルで上書きし、体感速度を優先する。
 */
export function FriendButton({ targetId, initial }: { targetId: string; initial: FriendRelation }) {
  const dict = useDict();
  const [relation, setRelation] = useState<FriendRelation>(initial);
  const [pending, startTransition] = useTransition();

  function setStatus(status: FriendRelationStatus, requestId: string | null) {
    setRelation({ status, requestId });
  }

  function handleSend() {
    const prev = relation;
    setStatus("pending_sent", relation.requestId);
    startTransition(async () => {
      const result = await sendFriendRequest(targetId);
      if (result.error) {
        setRelation(prev);
        window.alert(dict.directory.friendActionError);
      }
    });
  }

  function handleCancelOrRemove(confirmMessage?: string) {
    if (!relation.requestId) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const prev = relation;
    const requestId = relation.requestId;
    setStatus("none", null);
    startTransition(async () => {
      const result = await removeFriendRequest(requestId);
      if (result.error) {
        setRelation(prev);
        window.alert(dict.directory.friendActionError);
      }
    });
  }

  function handleAccept() {
    if (!relation.requestId) return;
    const prev = relation;
    const requestId = relation.requestId;
    setStatus("friends", requestId);
    startTransition(async () => {
      const result = await acceptFriendRequest(requestId);
      if (result.error) {
        setRelation(prev);
        window.alert(dict.directory.friendActionError);
      }
    });
  }

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
