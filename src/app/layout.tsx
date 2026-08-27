import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { AppToaster } from "@/components/layout/app-toaster";
import { SavedToastWatcher } from "@/components/layout/saved-toast-watcher";
import { NavigationFeedback } from "@/components/layout/navigation-feedback";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { getLocale } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { getSiteSettings, buildSiteThemeStyle, SITE_DEFAULT_TITLE, SITE_DEFAULT_DESCRIPTION } from "@/lib/site-settings";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { themeInitScript } from "@/lib/theme";

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

// iOSのホームインジケーター領域まで背景を連続させたうえで、操作要素には
// safe-area-insetを個別に足す。下部タブとCTAの間にブラウザ背景が見えるのを防ぐ。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// サイト設定（RAダッシュボードの「サイト設定」から変更可能）を反映した動的メタデータ。
// カスタムOGP画像が未設定の場合は openGraph.images を敢えて指定しないことで、
// Next.jsのファイル規約による自動生成画像（src/app/opengraph-image.tsx）が使われる。
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const title = settings.ogTitle || SITE_DEFAULT_TITLE;
  const description = settings.ogDescription || SITE_DEFAULT_DESCRIPTION;

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://wish-events.vercel.app"),
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: SITE_DEFAULT_TITLE,
      ...(settings.ogImageUrl
        ? { images: [{ url: settings.ogImageUrl, width: 1200, height: 630 }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, siteSettings] = await Promise.all([getLocale(), getSiteSettings()]);
  const siteThemeStyle = buildSiteThemeStyle(siteSettings);

  return (
    <html lang={locale} className={cn(inter.variable, notoSansJP.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* RAダッシュボードのサイト設定で選べるアクセントカラー・状態色の上書き。 */}
        <style dangerouslySetInnerHTML={{ __html: siteThemeStyle }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          <LocaleProvider locale={locale}>
            <ConfirmDialogProvider>
              <NavigationFeedback />
              <Header />
              <main className="mx-auto max-w-5xl px-4 py-4 pb-24 sm:py-6 sm:pb-6">{children}</main>
              <AppToaster />
              <Suspense fallback={null}>
                <SavedToastWatcher />
              </Suspense>
            </ConfirmDialogProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
