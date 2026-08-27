"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BarChart3, CalendarCheck, ClipboardList, Edit3, Eye, MessageCircle, MoreHorizontal, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { deleteEventFromDashboard } from "@/actions/events";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PendingFeedback } from "@/components/ui/pending-feedback";

export function EventActionsMenu({ eventId, title, hasRegistrationQuestions }: { eventId: string; title: string; hasRegistrationQuestions: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleDelete() {
    const accepted = await confirm({
      title: "イベントを削除",
      message: `「${title}」を削除します。\n申込、トーク、コメント、アンケートも削除され、元に戻せません。`,
      confirmLabel: "削除する",
      danger: true,
    });
    if (!accepted) return;
    startTransition(async () => {
      const result = await deleteEventFromDashboard(eventId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("イベントを削除しました");
      router.refresh();
    });
  }

  return <><PendingFeedback active={pending} label="イベントを削除しています…" /><DropdownMenu open={open} onOpenChange={(next) => !pending && setOpen(next)}><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" disabled={pending} aria-label={`${title}の管理メニュー`} className="shrink-0 rounded-full"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent className="w-64"><DropdownMenuLabel><span className="line-clamp-2 text-foreground">{title}</span><span className="mt-0.5 block text-[10px] font-normal">イベントのすべての管理機能</span></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href={`/events/${eventId}`}><Eye className="h-4 w-4" />公開ページを確認</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`/events/${eventId}/edit`}><Edit3 className="h-4 w-4" />基本情報を編集</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`/events/${eventId}/questions`}><ClipboardList className="h-4 w-4" />事前質問を編集{hasRegistrationQuestions && <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">設定済み</span>}</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`/dashboard/${eventId}/participants`}><Users className="h-4 w-4" />参加者・回答・集金</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`/dashboard/${eventId}/survey`}><CalendarCheck className="h-4 w-4" />アンケートを管理</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`/dashboard/${eventId}/survey/results`}><BarChart3 className="h-4 w-4" />アンケート結果</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`/talks/${eventId}`}><MessageCircle className="h-4 w-4" />イベントトークを確認</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem destructive onSelect={(event) => { event.preventDefault(); setOpen(false); void handleDelete(); }}><Trash2 className="h-4 w-4" />イベントを削除</DropdownMenuItem></DropdownMenuContent></DropdownMenu></>;
}
