"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleSurveyActive } from "@/actions/surveys";
import { useDict } from "@/lib/i18n/locale-provider";
import { PendingFeedback } from "@/components/ui/pending-feedback";

export function SurveyActiveToggle({
  surveyId,
  isActive,
}: {
  surveyId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dict = useDict();

  return (
    <><PendingFeedback active={pending} label="アンケート設定を更新しています…" /><Button
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
      {isActive ? dict.surveys.pauseButton : dict.surveys.resumeButton}
    </Button></>
  );
}
