"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FLOORS } from "@/lib/constants";
import { submitProfile } from "@/actions/profile";
import type { UserRole } from "@/types/database";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "送信中..." : "登録する"}
    </Button>
  );
}

export function ProfileForm({ role }: { role: UserRole }) {
  const [state, formAction] = useFormState(submitProfile, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="full_name">氏名</Label>
        <Input id="full_name" name="full_name" required placeholder="例: 早稲田 太郎" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="student_id">学籍番号（英数字8桁）</Label>
        <Input id="student_id" name="student_id" required maxLength={8} placeholder="例: 1A23B456" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label htmlFor="floor_number">階</Label>
          <Select id="floor_number" name="floor_number" required defaultValue="">
            <option value="" disabled>
              選択
            </option>
            {FLOORS.map((f) => (
              <option key={f} value={f}>
                {f}階
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="room_number">部屋番号</Label>
          <Input
            id="room_number"
            name="room_number"
            required
            placeholder={role === "ra" ? "例: 01" : "例: 01A"}
          />
          <p className="text-xs text-muted-foreground">
            {role === "ra" ? "数字2桁のみ（例: 01）" : "数字2桁＋ユニット記号A〜D（例: 01A）"}
          </p>
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton />
    </form>
  );
}
