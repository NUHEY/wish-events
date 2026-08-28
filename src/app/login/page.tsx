"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useDict } from "@/lib/i18n/locale-provider";
import { signInInstitutionalAccount, type InstitutionalAccountKind } from "@/actions/institutional-login";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
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
  const [institutionalError, setInstitutionalError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<InstitutionalAccountKind | null>(null);
  const [institutionalPending, startInstitutionalTransition] = useTransition();

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

  function handleInstitutionalLogin(kind: InstitutionalAccountKind) {
    if (institutionalPending) return;
    setInstitutionalError(null);
    setSelectedAccount(kind);
    startInstitutionalTransition(async () => {
      const result = await signInInstitutionalAccount(kind);
      if (result?.error) setInstitutionalError(result.error);
      setSelectedAccount(null);
    });
  }

  return (
    <div className="relative flex min-h-[85vh] items-center justify-center overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-hero-radial" />
      <div className="absolute right-0 top-0 flex items-center gap-2 p-2">
        <LocaleToggle />
        <ThemeToggle />
      </div>
      <Card className="relative w-full max-w-sm rounded-2xl shadow-elevated">
        <CardHeader className="items-center gap-3 pt-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-glow">
            W
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xl">{dict.login.title}</CardTitle>
            <CardDescription>{dict.login.subtitle}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-8">
          {error === "invalid_domain" && (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-sm text-destructive">
              {dict.login.invalidDomain}
            </p>
          )}
          {error === "auth_failed" && (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-sm text-destructive">
              {dict.login.authFailed}
            </p>
          )}
          {institutionalError && (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-sm text-destructive">
              {institutionalError}
            </p>
          )}
          <Button onClick={handleLogin} variant="outline" className="h-auto w-full gap-2.5 py-3">
            <GoogleIcon />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-sm font-semibold">{dict.login.googleButton}</span>
              <span className="text-[11px] font-normal text-muted-foreground">{dict.login.googleButtonSub}</span>
            </span>
          </Button>
          <p className="text-center text-xs text-muted-foreground">{dict.login.domainNote}</p>
          <div className="border-t border-border pt-4 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">{dict.login.institutionalPrompt}</p>
            <p className="mt-2 text-sm leading-relaxed">
              <button
                type="button"
                disabled={institutionalPending}
                onClick={() => handleInstitutionalLogin("service_desk")}
                className="font-semibold text-primary underline decoration-primary/35 underline-offset-4 transition-opacity active:opacity-60 disabled:cursor-wait disabled:opacity-50"
              >
                {selectedAccount === "service_desk" ? dict.login.institutionalLoggingIn : dict.login.serviceDeskLogin}
              </button>
              <span className="mx-2 text-muted-foreground" aria-hidden>・</span>
              <button
                type="button"
                disabled={institutionalPending}
                onClick={() => handleInstitutionalLogin("university_staff")}
                className="font-semibold text-primary underline decoration-primary/35 underline-offset-4 transition-opacity active:opacity-60 disabled:cursor-wait disabled:opacity-50"
              >
                {selectedAccount === "university_staff" ? dict.login.institutionalLoggingIn : dict.login.universityStaffLogin}
              </button>
            </p>
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
