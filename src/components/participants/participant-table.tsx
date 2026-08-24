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
import { downloadCsv, formatEventDateTime, formatRoomNumber, toCsv } from "@/lib/utils";
import { removeRegistrationAsRa } from "@/actions/registrations";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";

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
  const dict = useDict();
  const locale = useLocale();

  function handleDownload() {
    const csv = toCsv(
      participants.map((p) => ({
        full_name: p.full_name ?? "",
        student_id: p.student_id ?? "",
        room: formatRoomNumber(p.floor_number, p.room_number),
        registered_at: formatEventDateTime(p.registered_at, locale),
      })),
      [
        { key: "full_name", label: dict.participants.nameColumn },
        { key: "student_id", label: dict.participants.studentIdColumn },
        { key: "room", label: dict.participants.roomColumn },
        { key: "registered_at", label: dict.participants.dateColumn },
      ]
    );
    downloadCsv(`${eventTitle}_${dict.participants.title}.csv`, csv);
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
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                {dict.participants.noParticipants}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
