"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleSurveyActive } from "@/actions/surveys";
import { useDict } from "@/lib/i18n/locale-provider";

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
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleSurveyActive(surveyId, !isActive);
          if (result?.error) {
            toast.error(result.error);
          } else {
            toast.success(dict.toast.updated);
            router.refresh();
          }
        })
      }
    >
      {isActive ? dict.surveys.pauseButton : dict.surveys.resumeButton}
    </Button>
  );
}
