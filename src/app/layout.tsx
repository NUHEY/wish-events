import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { AppToaster } from "@/components/layout/app-toaster";
import { SavedToastWatcher } from "@/components/layout/saved-toast-watcher";
import { TopProgressBar } from "@/components/layout/top-progress-bar";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { getLocale } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/i18n/locale-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WISH Events",
  description: "早稲田大学国際学生寮 WISH のイベント一覧・申込サイト / Event site for Waseda's WISH international dorm",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={cn(inter.variable, notoSansJP.variable)}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <LocaleProvider locale={locale}>
          <ConfirmDialogProvider>
            <TopProgressBar />
            <Header />
            <main className="mx-auto max-w-5xl px-4 py-4 pb-24 sm:py-6 sm:pb-6">{children}</main>
            <AppToaster />
            <Suspense fallback={null}>
              <SavedToastWatcher />
            </Suspense>
          </ConfirmDialogProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
