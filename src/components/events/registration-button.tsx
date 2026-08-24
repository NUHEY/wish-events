"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { registerForEvent, cancelRegistration } from "@/actions/registrations";

export function RegistrationButton({
  eventId,
  isRegistered,
  isFull,
}: {
  eventId: string;
  isRegistered: boolean;
  isFull: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = isRegistered
        ? await cancelRegistration(eventId)
        : await registerForEvent(eventId);

      if (result?.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleClick}
        disabled={pending || (!isRegistered && isFull)}
        variant={isRegistered ? "outline" : "default"}
        className="w-full sm:w-auto"
      >
        {pending
          ? "処理中..."
          : isRegistered
          ? "キャンセルする"
          : isFull
          ? "定員に達しました"
          : "申し込む"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
