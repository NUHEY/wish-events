"use client";

import { useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { saveInstitutionalPermissions } from "@/actions/management-permissions";
import { MANAGEMENT_MODULES, MANAGEMENT_GROUPS, MANAGEMENT_KEYS } from "@/lib/management-permissions";
import { useLocale } from "@/lib/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { useUnsavedChangesGuard } from "@/lib/hooks/use-unsaved-changes-guard";

type Settings = { account_kind: "service_desk" | "university_staff"; permissions: string[]; updated_at: string };
function AccountPermissions({ initial }: { initial: Settings }) {
  const en = useLocale() === "en";
  const [selected, setSelected] = useState<string[]>(initial.permissions);
  const [saved, setSaved] = useState(initial.permissions);
  const [updatedAt, setUpdatedAt] = useState(initial.updated_at);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const dirty = [...selected].sort().join() !== [...saved].sort().join();
  useUnsavedChangesGuard(dirty, en ? "Discard unsaved permission changes?" : "保存していない権限の変更を破棄しますか？");
  const name = initial.account_kind === "service_desk" ? (en ? "2F Service Desk" : "２階生活窓口") : (en ? "Waseda University Student Affairs Division" : "早稲田大学学生生活課");
  function change(next: string[]) { setSelected(next); setFeedback({}); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || !dirty) return;
    inFlight.current = true; setPending(true); setFeedback({});
    try {
      const result = await saveInstitutionalPermissions(initial.account_kind, selected, updatedAt);
      if (result.error) setFeedback({ error: result.error });
      else if (result.updatedAt) { setSaved([...selected]); setUpdatedAt(result.updatedAt); setFeedback({ success: en ? "Permissions saved." : "権限を保存しました。" }); }
    } catch { setFeedback({ error: en ? "Connection failed. Your selections are kept; please try again." : "通信に失敗しました。選択内容は保持されています。もう一度お試しください。" }); }
    finally { inFlight.current = false; setPending(false); }
  }
  return <form method="post" onSubmit={save} aria-busy={pending} className="min-w-0 rounded-2xl border border-border bg-card">
    <div className="space-y-3 border-b border-border p-4 sm:p-5">
      <h2 className="flex items-start gap-2 text-lg font-bold leading-relaxed"><ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-primary" />{name}</h2>
      <p className="text-sm text-muted-foreground">{selected.length === 0 ? (en ? "No management access" : "管理ボードへのアクセスなし") : (en ? `${selected.length} of ${MANAGEMENT_KEYS.length} functions selected` : `${MANAGEMENT_KEYS.length}機能中${selected.length}機能を選択`)}{dirty && <span className="ml-2 font-medium text-primary">{en ? "Unsaved" : "未保存"}</span>}</p>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => change([...MANAGEMENT_KEYS])}>{en ? "Select all" : "すべて許可"}</Button><Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => change([])}>{en ? "Clear all" : "すべて解除"}</Button></div>
    </div>
    <fieldset disabled={pending} className="space-y-5 p-4 sm:p-5"><legend className="sr-only">{en ? "Allowed management functions" : "許可する管理機能"}</legend>
      {MANAGEMENT_GROUPS.map(group => <fieldset key={group.key}><legend className="mb-2 text-sm font-bold">{en ? group.en : group.ja}</legend><div className="grid gap-2 lg:grid-cols-2">{MANAGEMENT_MODULES.filter(module => module.group === group.key).map(module => <label key={module.key} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 ${selected.includes(module.key) ? "border-primary/50 bg-primary/5" : "border-border"}`}><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-primary" checked={selected.includes(module.key)} onChange={event => change(event.target.checked ? [...selected, module.key] : selected.filter(key => key !== module.key))} /><span className="min-w-0"><span className="block text-sm font-semibold">{en ? module.en : module.ja}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{en ? module.detailEn : module.detailJa}</span></span></label>)}</div></fieldset>)}
    </fieldset>
    <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="text-sm">{feedback.error && <p role="alert" className="text-destructive">{feedback.error}</p>}{feedback.success && <p role="status">{feedback.success}</p>}{!feedback.error && !feedback.success && <p className="text-muted-foreground">{en ? "Changes apply after saving." : "保存すると変更が反映されます。"}</p>}</div>
      <Button type="submit" disabled={!dirty || pending} className="shrink-0">{pending ? (en ? "Saving…" : "保存中…") : (en ? "Save permissions" : "権限を保存")}</Button>
    </div>
  </form>;
}
export function InstitutionalPermissionManager({ settings }: { settings: Settings[] }) {
  const en = useLocale() === "en";
  const [active, setActive] = useState<Settings["account_kind"]>("service_desk");
  return <div className="space-y-4"><div role="group" aria-label={en ? "Select staff account" : "設定する関係者を選択"} className="grid grid-cols-2 gap-2">{settings.map(row => <Button key={row.account_kind} type="button" variant={active === row.account_kind ? "default" : "outline"} aria-pressed={active === row.account_kind} onClick={() => setActive(row.account_kind)} className="h-auto min-h-11 whitespace-normal px-2 py-2">{row.account_kind === "service_desk" ? (en ? "Service Desk" : "生活窓口") : (en ? "University staff" : "大学学生生活課")}</Button>)}</div>{settings.map(row => <div key={row.account_kind} hidden={active !== row.account_kind}><AccountPermissions initial={row} /></div>)}</div>;
}
