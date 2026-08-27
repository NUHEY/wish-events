"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatRoomNumber } from "@/lib/utils";
import { releaseRoom, resetAllRoomAssignments } from "@/actions/residents";
import type { UserRow } from "@/types/database";
import { useDict } from "@/lib/i18n/locale-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";

function isNewResident(entryMonth: string | null) {
  if (!entryMonth) return false;
  const [year, month] = entryMonth.slice(0, 7).split("-").map(Number);
  const now = new Date();
  const elapsedMonths = now.getFullYear() * 12 + now.getMonth() - (year * 12 + month - 1);
  return elapsedMonths >= 0 && elapsedMonths < 6;
}

function ResidentTable({ residents }: { residents: UserRow[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dict = useDict();
  const confirm = useConfirm();

  async function handleRelease(resident: UserRow) {
    const ok = await confirm({
      message: `${resident.full_name ?? resident.email} ${dict.residents.releaseConfirm}`,
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await releaseRoom(resident.id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(dict.toast.updated);
        router.refresh();
      }
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{dict.residents.nameColumn}</TableHead>
          <TableHead>{dict.residents.roomColumn}</TableHead>
          <TableHead>{dict.residents.typeColumn}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {residents.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">
              {r.full_name ?? dict.common.notRegistered}
              <p className="text-xs font-normal text-muted-foreground">{r.email}</p>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatRoomNumber(r.floor_number, r.room_number)}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">{r.role === "ra" ? <Badge variant="default">RA</Badge> : <Badge variant="secondary">{dict.residents.resident}</Badge>}{isNewResident(r.wish_entry_month) && <Badge variant="outline">新寮生</Badge>}</div>{r.wish_entry_month && <p className="mt-1 text-[10px] text-muted-foreground">{r.wish_entry_month.slice(0, 7).replace("-", "年")}月入居</p>}
            </TableCell>
            <TableCell>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => handleRelease(r)}>{dict.residents.releaseButton}</Button>
            </TableCell>
          </TableRow>
        ))}
        {residents.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              {dict.residents.noResidents}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function BulkResetPanel() {
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();
  const dict = useDict();
  const confirm = useConfirm();

  async function handleReset() {
    const ok = await confirm({ message: dict.residents.resetConfirm, danger: true });
    if (!ok) return;

    startTransition(async () => {
      const res = await resetAllRoomAssignments(confirmText);
      if (res?.error) {
        setResult(`${dict.residents.resetError}: ${res.error}`);
      } else {
        setResult(`${res?.count ?? 0}${dict.residents.resetResult}`);
        setConfirmText("");
        router.refresh();
      }
    });
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base">{dict.residents.resetTitle}</CardTitle>
        <CardDescription>
          {dict.residents.resetSubtitle}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="confirm" className="text-xs font-medium text-muted-foreground">
            {dict.residents.resetConfirmLabel}
          </label>
          <Input
            id="confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET"
            className="w-40"
          />
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={pending || confirmText !== "RESET"}
          onClick={handleReset}
        >
          {pending ? dict.residents.resetting : dict.residents.resetButton}
        </Button>
        {result && <p className="w-full text-sm text-muted-foreground">{result}</p>}
      </CardContent>
    </Card>
  );
}

export function ResidentManager({ residents }: { residents: UserRow[] }) {
  const dict = useDict();
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.residents.listTitle}</CardTitle>
          <CardDescription>
            {dict.residents.listSubtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResidentTable residents={residents} />
        </CardContent>
      </Card>

      <BulkResetPanel />
    </div>
  );
}
