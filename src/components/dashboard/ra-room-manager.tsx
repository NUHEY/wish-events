"use client";

import { useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
import { FLOORS } from "@/lib/constants";
import { formatRoomNumber } from "@/lib/utils";
import { addRaRoom, demoteUserToResident, removeRaRoom } from "@/actions/ra-rooms";
import type { RaRoomRow, UserRow } from "@/types/database";
import { useDict } from "@/lib/i18n/locale-provider";

function AddRoomSubmitButton() {
  const { pending } = useFormStatus();
  const dict = useDict();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? dict.raRooms.adding : dict.raRooms.add}
    </Button>
  );
}

function AddRoomForm() {
  const [state, formAction] = useFormState(addRaRoom, undefined);
  const dict = useDict();

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="floor_number">{dict.raRooms.floorLabel}</Label>
        <Select id="floor_number" name="floor_number" required defaultValue="" className="w-28">
          <option value="" disabled>
            {dict.raRooms.selectPlaceholder}
          </option>
          {FLOORS.map((f) => (
            <option key={f} value={f}>
              {f}
              {dict.event.floorUnit}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="room_number">{dict.raRooms.roomLabel}</Label>
        <Input
          id="room_number"
          name="room_number"
          required
          maxLength={2}
          placeholder={dict.raRooms.roomInputPlaceholder}
          className="w-32"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="note">{dict.raRooms.noteLabel}</Label>
        <Input id="note" name="note" placeholder={dict.raRooms.noteInputPlaceholder} className="w-40" />
      </div>
      <AddRoomSubmitButton />
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

function RoomRosterTable({ rooms }: { rooms: RaRoomRow[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dict = useDict();

  function handleRemove(room: RaRoomRow) {
    startTransition(async () => {
      await removeRaRoom(room.id, room.floor_number, room.room_number);
      router.refresh();
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{dict.raRooms.roomColumn}</TableHead>
          <TableHead>{dict.raRooms.noteColumn}</TableHead>
          <TableHead>{dict.raRooms.dateColumn}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rooms.map((room) => (
          <TableRow key={room.id}>
            <TableCell className="font-medium">
              {formatRoomNumber(room.floor_number, room.room_number)}
            </TableCell>
            <TableCell className="text-muted-foreground">{room.note ?? "-"}</TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(room.created_at).toLocaleDateString("ja-JP")}
            </TableCell>
            <TableCell>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => handleRemove(room)}>
                {dict.common.delete}
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {rooms.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              {dict.raRooms.noRooms}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

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
    <Table>
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
    </Table>
  );
}

export function RaRoomManager({
  rooms,
  raUsers,
  currentUserId,
}: {
  rooms: RaRoomRow[];
  raUsers: UserRow[];
  currentUserId: string;
}) {
  const dict = useDict();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.raRooms.listTitle}</CardTitle>
          <CardDescription>{dict.raRooms.listSubtitle}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AddRoomForm />
          <RoomRosterTable rooms={rooms} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.raRooms.currentRaTitle}</CardTitle>
          <CardDescription>{dict.raRooms.currentRaSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <CurrentRaTable raUsers={raUsers} currentUserId={currentUserId} />
        </CardContent>
      </Card>
    </div>
  );
}
