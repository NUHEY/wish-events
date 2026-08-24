"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { useDict } from "@/lib/i18n/locale-provider";

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

  async function handleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="relative flex min-h-[85vh] items-center justify-center overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"
      />
      <div className="absolute right-0 top-0 p-2">
        <LocaleToggle />
      </div>
      <Card className="relative w-full max-w-sm">
        <CardHeader className="items-center gap-3 pt-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
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
          <Button onClick={handleLogin} variant="outline" className="w-full gap-2.5">
            <GoogleIcon />
            {dict.login.googleButton}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{dict.login.domainNote}</p>
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
