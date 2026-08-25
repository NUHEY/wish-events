"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv, formatEventDateTime, formatRoomNumber, toCsv } from "@/lib/utils";
import { removeRegistrationAsRa } from "@/actions/registrations";
import { setPaymentStatus } from "@/actions/payments";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import type { RegistrationQuestionRow } from "@/types/database";

export type ParticipantRow = {
  user_id: string;
  full_name: string | null;
  student_id: string | null;
  floor_number: number | null;
  room_number: string | null;
  registered_at: string;
  registration_id: string;
  payment_status: "unpaid" | "paid" | "waived";
  /** 事前質問への回答。key = question_id */
  answers?: Record<string, string>;
};

export function ParticipantTable({
  eventId,
  eventTitle,
  participants,
  questions = [],
  collectionRequired = false,
}: {
  eventId: string;
  eventTitle: string;
  participants: ParticipantRow[];
  /** requires_registrationのイベントで事前質問が設定されている場合、回答を列として表示する */
  questions?: RegistrationQuestionRow[];
  collectionRequired?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dict = useDict();
  const locale = useLocale();

  function handleDownload() {
    const csv = toCsv(
      participants.map((p) => ({
        full_name: p.full_name ?? "",
        student_id: p.student_id ?? "",
        room: formatRoomNumber(p.floor_number, p.room_number),
        registered_at: formatEventDateTime(p.registered_at, locale),
        ...Object.fromEntries(questions.map((q) => [q.id, p.answers?.[q.id] ?? ""])),
      })),
      [
        { key: "full_name", label: dict.participants.nameColumn },
        { key: "student_id", label: dict.participants.studentIdColumn },
        { key: "room", label: dict.participants.roomColumn },
        { key: "registered_at", label: dict.participants.dateColumn },
        ...questions.map((q) => ({ key: q.id, label: q.question_text })),
      ]
    );
    downloadCsv(`${eventTitle}_${dict.participants.title}.csv`, csv);
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      await removeRegistrationAsRa(eventId, userId);
      toast.success(dict.toast.removed);
      router.refresh();
    });
  }
  function setPayment(p: ParticipantRow, status: "unpaid" | "paid" | "waived") {
    startTransition(async () => { const result = await setPaymentStatus(p.registration_id, eventId, status); if (result?.error) toast.error(result.error); else { toast.success("支払い状況を更新しました"); router.refresh(); } });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {dict.participants.count}: {participants.length}
          {dict.participants.countUnit}
        </p>
        <Button size="sm" variant="outline" onClick={handleDownload} disabled={!participants.length}>
          {dict.participants.downloadCsv}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{dict.participants.nameColumn}</TableHead>
            <TableHead>{dict.participants.studentIdColumn}</TableHead>
            <TableHead>{dict.participants.roomColumn}</TableHead>
            <TableHead>{dict.participants.dateColumn}</TableHead>
            {collectionRequired && <TableHead>集金</TableHead>}
            {questions.map((q) => (
              <TableHead key={q.id}>{q.question_text}</TableHead>
            ))}
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {participants.map((p) => (
            <TableRow key={p.user_id}>
              <TableCell>{p.full_name}</TableCell>
              <TableCell>{p.student_id}</TableCell>
              <TableCell>{formatRoomNumber(p.floor_number, p.room_number)}</TableCell>
              <TableCell>{formatEventDateTime(p.registered_at, locale)}</TableCell>
              {collectionRequired && <TableCell><select value={p.payment_status} disabled={pending} onChange={(e) => setPayment(p, e.target.value as "unpaid" | "paid" | "waived")} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="unpaid">未払い</option><option value="paid">支払い済み</option><option value="waived">免除</option></select></TableCell>}
              {questions.map((q) => (
                <TableCell key={q.id}>{p.answers?.[q.id] || "-"}</TableCell>
              ))}
              <TableCell>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => handleRemove(p.user_id)}
                >
                  {dict.participants.removeButton}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {participants.length === 0 && (
            <TableRow>
              <TableCell colSpan={5 + questions.length + (collectionRequired ? 1 : 0)} className="text-center text-muted-foreground">
                {dict.participants.noParticipants}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
