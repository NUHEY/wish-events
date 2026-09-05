"use client";

import { Suspense, useState, useRef, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import type { InstitutionalAccountKind } from "@/lib/institutional-accounts";

type InstitutionalLoginResponse =
  | { success: true }
  | { success: false; code: string; error: string };

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.11A11.998 11.998 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.28A11.998 11.998 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l3.99-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.61l3.99 3.11C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const supabase = createClient();
  const dict = useDict();
  const locale = useLocale();
  const universityLabel = locale === "en"
    ? <><span className="inline-block">Waseda University</span>{" "}<span className="inline-block">Student Affairs Division</span></>
    : dict.login.universityStaffLogin;
  const [institutionalError, setInstitutionalError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<InstitutionalAccountKind | null>(null);
  const [institutionalPassword, setInstitutionalPassword] = useState("");
  const [institutionalPending, setInstitutionalPending] = useState(false);
  const loginInFlight = useRef(false);

  async function handleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Googleのアカウント選択画面をwaseda.jpのGoogle Workspaceアカウントに
        // 絞り込むヒント。複数のGoogleアカウントを使い分けている人が誤って
        // 個人のGmailアカウントを選んでしまう事故を減らす（強制ではないため
        // サーバー側のドメインチェックは別途必須で残す）。
        queryParams: {
          hd: "waseda.jp",
        },
      },
    });
  }

  function selectInstitutionalAccount(kind: InstitutionalAccountKind) {
    if (institutionalPending) return;
    setInstitutionalError(null);
    setSelectedAccount(kind);
    setInstitutionalPassword("");
  }

  async function handleInstitutionalLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginInFlight.current || !selectedAccount || !institutionalPassword) return;
    loginInFlight.current = true;
    setInstitutionalPending(true);
    setInstitutionalError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25_000);
    let navigating = false;
    try {
      const response = await fetch("/api/auth/institutional-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({ kind: selectedAccount, password: institutionalPassword }),
      });
      const result = await response.json() as InstitutionalLoginResponse;
      if (!response.ok || !result.success) {
        setInstitutionalError(!result.success ? result.error : dict.login.authFailed);
        return;
      }
      // APIのSet-Cookieで認証は完了済み。ブラウザでの再認証を待たずに移動する。
      setInstitutionalPassword("");
      window.location.replace("/");
      navigating = true;
    } catch {
      setInstitutionalError(controller.signal.aborted ? dict.login.institutionalTimeout : dict.login.authFailed);
    } finally {
      window.clearTimeout(timeout);
      if (!navigating) {
        loginInFlight.current = false;
        setInstitutionalPending(false);
      }
    }
  }

  return (
    <div className="relative flex min-h-[85vh] items-center justify-center pb-6 pt-16">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-hero-radial" />
      <div className="absolute right-0 top-0 flex items-center gap-2 p-2">
        <LocaleToggle />
        <ThemeToggle />
      </div>
      <Card className="relative w-full max-w-sm shadow-elevated">
        <CardHeader className="items-center gap-3 pt-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground shadow-glow">
            W
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xl">{dict.login.title}</CardTitle>
            <CardDescription>{dict.login.subtitle}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-8">
          {error === "invalid_domain" && (
            <p role="alert" className="break-words rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-sm leading-relaxed text-destructive">
              {dict.login.invalidDomain}
            </p>
          )}
          {error === "auth_failed" && (
            <p role="alert" className="break-words rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-sm leading-relaxed text-destructive">
              {dict.login.authFailed}
            </p>
          )}
          {institutionalError && (
            <p role="alert" className="break-words rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-sm leading-relaxed text-destructive">
              {institutionalError}
            </p>
          )}
          <Button disabled={institutionalPending} onClick={handleLogin} variant="outline" className="h-auto w-full gap-2.5 py-3">
            <GoogleIcon />
            <span className="flex min-w-0 flex-col items-start whitespace-normal text-left leading-tight">
              <span className="text-sm font-semibold">{dict.login.googleButton}</span>
              <span className="text-[11px] font-normal text-muted-foreground">{dict.login.googleButtonSub}</span>
            </span>
          </Button>
          <p className="text-center text-xs text-muted-foreground">{dict.login.domainNote}</p>
          <div className="border-t border-border pt-4 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">{dict.login.institutionalPrompt}</p>
            <p className="mt-3 grid gap-2 text-sm leading-relaxed">
              <button
                type="button"
                disabled={institutionalPending}
                onClick={() => selectInstitutionalAccount("service_desk")}
                aria-pressed={selectedAccount === "service_desk"}
                className="min-h-11 rounded-md border border-border px-3 py-2 font-semibold text-primary transition-colors hover:bg-accent disabled:cursor-wait disabled:opacity-50"
              >
                {dict.login.serviceDeskLogin}
              </button>
              <button
                type="button"
                disabled={institutionalPending}
                onClick={() => selectInstitutionalAccount("university_staff")}
                aria-pressed={selectedAccount === "university_staff"}
                className="min-h-11 rounded-md border border-border px-3 py-2 font-semibold text-primary transition-colors hover:bg-accent disabled:cursor-wait disabled:opacity-50"
              >
                {universityLabel}
              </button>
            </p>
            {selectedAccount && (
              <form method="post" aria-busy={institutionalPending} onSubmit={handleInstitutionalLogin} className="mt-3 rounded-xl border border-border bg-secondary/35 p-3 text-left">
                <p className="mb-2 text-center text-xs font-semibold text-foreground">
                  {selectedAccount === "service_desk" ? dict.login.serviceDeskLogin : universityLabel}
                </p>
                <label htmlFor="institutional-password" className="text-xs font-medium text-muted-foreground">
                  {dict.login.institutionalPasswordLabel}
                </label>
                <Input
                  id="institutional-password"
                  type="password"
                  value={institutionalPassword}
                  onChange={(event) => setInstitutionalPassword(event.target.value)}
                  placeholder={dict.login.institutionalPasswordPlaceholder}
                  autoComplete="current-password"
                  autoFocus
                  maxLength={256}
                  disabled={institutionalPending}
                  className="mt-1.5 h-11 bg-background text-base"
                />
                {institutionalPending && <p role="status" className="mt-2 text-sm text-muted-foreground">{dict.login.institutionalLoggingIn}</p>}
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 flex-1"
                    disabled={institutionalPending}
                    onClick={() => { setSelectedAccount(null); setInstitutionalPassword(""); setInstitutionalError(null); }}
                  >
                    {dict.login.institutionalCancel}
                  </Button>
                  <Button type="submit" className="min-h-11 flex-1" disabled={institutionalPending || !institutionalPassword}>
                    {institutionalPending ? dict.login.institutionalLoggingIn : dict.login.institutionalSubmit}
                  </Button>
                </div>
              </form>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">{dict.login.institutionalNote}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
