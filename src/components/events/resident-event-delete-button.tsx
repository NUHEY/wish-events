"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteOwnResidentEvent } from "@/actions/resident-events";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function ResidentEventDeleteButton({ eventId, title }: { eventId: string; title: string }) {
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <Button type="button" size="sm" variant="ghost" className="mt-1 w-full text-muted-foreground" disabled={pending} onClick={async () => { const ok = await confirm({ title: "募集を削除しますか？", message: `「${title}」の申込・トーク・コメントも利用できなくなります。`, confirmLabel: "削除する", danger: true }); if (!ok) return; startTransition(async () => { const result = await deleteOwnResidentEvent(eventId); if (result.error) toast.error(result.error); else { toast.success("募集を削除しました"); router.refresh(); } }); }}><Trash2 className="h-3.5 w-3.5" />{pending ? "削除中…" : "この募集を削除"}</Button>;
}
