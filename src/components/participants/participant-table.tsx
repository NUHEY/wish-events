"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv, formatRoomNumber, toCsv } from "@/lib/utils";
import { removeRegistrationAsRa } from "@/actions/registrations";

export type ParticipantRow = {
  user_id: string;
  full_name: string | null;
  student_id: string | null;
  floor_number: number | null;
  room_number: string | null;
  registered_at: string;
};

export function ParticipantTable({
  eventId,
  eventTitle,
  participants,
}: {
  eventId: string;
  eventTitle: string;
  participants: ParticipantRow[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDownload() {
    const csv = toCsv(
      participants.map((p) => ({
        full_name: p.full_name ?? "",
        student_id: p.student_id ?? "",
        room: formatRoomNumber(p.floor_number, p.room_number),
        registered_at: new Date(p.registered_at).toLocaleString("ja-JP"),
      })),
      [
        { key: "full_name", label: "氏名" },
        { key: "student_id", label: "学籍番号" },
        { key: "room", label: "部屋番号" },
        { key: "registered_at", label: "申込日時" },
      ]
    );
    downloadCsv(`${eventTitle}_参加者一覧.csv`, csv);
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      await removeRegistrationAsRa(eventId, userId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          申込者数: {participants.length}名
        </p>
        <Button size="sm" variant="outline" onClick={handleDownload} disabled={!participants.length}>
          CSVダウンロード
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>氏名</TableHead>
            <TableHead>学籍番号</TableHead>
            <TableHead>部屋番号</TableHead>
            <TableHead>申込日時</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {participants.map((p) => (
            <TableRow key={p.user_id}>
              <TableCell>{p.full_name}</TableCell>
              <TableCell>{p.student_id}</TableCell>
              <TableCell>{formatRoomNumber(p.floor_number, p.room_number)}</TableCell>
              <TableCell>{new Date(p.registered_at).toLocaleString("ja-JP")}</TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => handleRemove(p.user_id)}
                >
                  取消
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {participants.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                まだ申込者はいません
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
