"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useDict } from "@/lib/i18n/locale-provider";

/**
 * リダイレクトを伴う保存系Server Action（createEvent, updateEvent,
 * createAnnouncement, submitProfile 等）は、成功後すぐにredirect()するため
 * 遷移先のページでしかクライアント側の状態を見られない。
 * そのため各actionはリダイレクト先URLに ?saved=1 / ?created=1 / ?updated=1
 * のようなクエリパラメータを付与し、ここ（レイアウトに1つだけ配置）で
 * それを検知してトーストを表示したあと、URLからパラメータを取り除く。
 */
const PARAM_KEYS = ["created", "updated", "saved", "deleted"] as const;
type ParamKey = (typeof PARAM_KEYS)[number];

export function SavedToastWatcher() {
  const dict = useDict();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    let fired = false;

    const messages: Record<ParamKey, string> = {
      created: dict.toast.created,
      updated: dict.toast.updated,
      saved: dict.toast.saved,
      deleted: dict.toast.deleted,
    };

    for (const key of PARAM_KEYS) {
      if (params.has(key)) {
        toast.success(messages[key]);
        params.delete(key);
        fired = true;
      }
    }

    if (fired) {
      const qs = params.toString();
      window.history.replaceState(window.history.state, "", qs ? `${pathname}?${qs}` : pathname);
    }
    // dict/pathnameは変化してもトースト再表示のトリガーにはしない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsString]);

  return null;
}
