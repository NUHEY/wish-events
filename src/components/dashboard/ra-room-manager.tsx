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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRoomNumber } from "@/lib/utils";
import { demoteUserToResident } from "@/actions/ra-rooms";
import type { UserRow } from "@/types/database";
import { useDict } from "@/lib/i18n/locale-provider";
import { PendingFeedback } from "@/components/ui/pending-feedback";

function CurrentRaTable({ raUsers, currentUserId }: { raUsers: UserRow[]; currentUserId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dict = useDict();

  function handleDemote(userId: string) {
    startTransition(async () => {
      await demoteUserToResident(userId);
      router.refresh();
    });
  }

  return (
    <><PendingFeedback active={pending} label="RA権限を更新しています…" /><Table>
      <TableHeader>
        <TableRow>
          <TableHead>{dict.raRooms.nameColumn}</TableHead>
          <TableHead>{dict.raRooms.roomColumn}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {raUsers.map((u) => (
          <TableRow key={u.id}>
            <TableCell className="font-medium">
              {u.full_name ?? dict.common.notRegistered}
              {u.id === currentUserId && (
                <Badge variant="outline" className="ml-2">
                  {dict.raRooms.you}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatRoomNumber(u.floor_number, u.room_number)}
            </TableCell>
            <TableCell>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => handleDemote(u.id)}>
                {dict.raRooms.demote}
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {raUsers.length === 0 && (
          <TableRow>
            <TableCell colSpan={3} className="text-center text-muted-foreground">
              {dict.raRooms.noRa}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table></>
  );
}

export function RaRoomManager({
  raUsers,
  currentUserId,
}: {
  raUsers: UserRow[];
  currentUserId: string;
}) {
  const dict = useDict();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{dict.raRooms.currentRaTitle}</CardTitle>
        <CardDescription>{dict.raRooms.currentRaSubtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <CurrentRaTable raUsers={raUsers} currentUserId={currentUserId} />
      </CardContent>
    </Card>
  );
}
