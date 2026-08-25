"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const PAYMENT_LABELS = { unpaid: "未払い", paid: "支払い済み", waived: "免除" } as const;

export type ParticipantRow = {
  user_id: string;
  full_name: string | null;
  student_id: string | null;
  floor_number: number | null;
  room_number: string | null;
  email: string | null;
  faculty: string | null;
  grade_level: string | null;
  line_qr_url: string;
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
  const [query, setQuery] = useState("");

  function facultyLabel(faculty: string | null) {
    if (!faculty) return "";
    return dict.faculties[faculty as keyof typeof dict.faculties] ?? faculty;
  }
  function gradeLevelLabel(grade: string | null) {
    if (!grade) return "";
    return dict.gradeLevels[grade as keyof typeof dict.gradeLevels] ?? grade;
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) => {
      const haystack = [
        p.full_name ?? "",
        p.student_id ?? "",
        formatRoomNumber(p.floor_number, p.room_number),
        p.email ?? "",
        facultyLabel(p.faculty),
        gradeLevelLabel(p.grade_level),
        PAYMENT_LABELS[p.payment_status],
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, query, dict]);

  function handleDownload() {
    const csv = toCsv(
      filtered.map((p) => ({
        full_name: p.full_name ?? "",
        student_id: p.student_id ?? "",
        room: formatRoomNumber(p.floor_number, p.room_number),
        email: p.email ?? "",
        faculty: facultyLabel(p.faculty),
        grade_level: gradeLevelLabel(p.grade_level),
        line_qr_url: p.line_qr_url,
        payment_status: collectionRequired ? PAYMENT_LABELS[p.payment_status] : "",
        registered_at: formatEventDateTime(p.registered_at, locale),
        ...Object.fromEntries(questions.map((q) => [q.id, p.answers?.[q.id] ?? ""])),
      })),
      [
        { key: "full_name", label: dict.participants.nameColumn },
        { key: "student_id", label: dict.participants.studentIdColumn },
        { key: "room", label: dict.participants.roomColumn },
        { key: "email", label: dict.participants.emailColumn },
        { key: "faculty", label: dict.participants.facultyColumn },
        { key: "grade_level", label: dict.participants.gradeLevelColumn },
        { key: "line_qr_url", label: "LINE QR URL" },
        ...(collectionRequired ? [{ key: "payment_status", label: dict.participants.paymentColumn }] : []),
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

  const columnCount = 7 + questions.length + (collectionRequired ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {dict.participants.count}: {filtered.length}
          {dict.participants.countUnit}
          {query && participants.length !== filtered.length && ` / ${participants.length}${dict.participants.countUnit}`}
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.participants.searchPlaceholder}
              className="h-9 w-64 rounded-full pl-8 text-sm"
            />
          </div>
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={!filtered.length}>
            {dict.participants.downloadCsv}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.participants.nameColumn}</TableHead>
              <TableHead>{dict.participants.studentIdColumn}</TableHead>
              <TableHead>{dict.participants.roomColumn}</TableHead>
              <TableHead>{dict.participants.emailColumn}</TableHead>
              <TableHead>{dict.participants.facultyColumn}</TableHead>
              <TableHead>{dict.participants.gradeLevelColumn}</TableHead>
              <TableHead>{dict.participants.dateColumn}</TableHead>
              {collectionRequired && <TableHead>{dict.participants.paymentColumn}</TableHead>}
              {questions.map((q) => (
                <TableHead key={q.id}>{q.question_text}</TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.user_id}>
                <TableCell>{p.full_name}</TableCell>
                <TableCell>{p.student_id}</TableCell>
                <TableCell>{formatRoomNumber(p.floor_number, p.room_number)}</TableCell>
                <TableCell className="max-w-40 truncate">{p.email}</TableCell>
                <TableCell>{facultyLabel(p.faculty) || "-"}</TableCell>
                <TableCell>{gradeLevelLabel(p.grade_level) || "-"}</TableCell>
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
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnCount} className="text-center text-muted-foreground">
                  {query ? dict.participants.noSearchResults : dict.participants.noParticipants}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
