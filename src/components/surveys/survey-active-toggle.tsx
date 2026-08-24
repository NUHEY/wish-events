"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleSurveyActive } from "@/actions/surveys";

export function SurveyActiveToggle({
  surveyId,
  isActive,
}: {
  surveyId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleSurveyActive(surveyId, !isActive);
          router.refresh();
        })
      }
    >
      {isActive ? "回答受付を停止する" : "回答受付を再開する"}
    </Button>
  );
}
