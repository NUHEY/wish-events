import { ImageResponse } from "next/og";
import { getSiteSettings, SITE_DEFAULT_TITLE, SITE_DEFAULT_DESCRIPTION } from "@/lib/site-settings";

export const alt = "WISH Events";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * URLを共有した際のデフォルトのプレビュー画像。RAが/dashboard/settingsで
 * 専用の画像をアップロードしている場合はそちらが使われ、これはあくまで
 * 未設定時のフォールバックとして常に生成される。
 */
export default async function OgImage() {
  const settings = await getSiteSettings();
  const title = settings.ogTitle || SITE_DEFAULT_TITLE;
  const description = settings.ogDescription || SITE_DEFAULT_DESCRIPTION;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: "linear-gradient(135deg, #7A2140 0%, #4f1526 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 9999,
              background: "#ffffff",
              color: "#7A2140",
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            W
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 4, color: "#f2d9e2" }}>
            WISH
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 60, fontWeight: 700, lineHeight: 1.25, color: "#ffffff" }}>
          {title}
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 26, color: "#f2d9e2", maxWidth: 920 }}>
          {description}
        </div>
      </div>
    ),
    { ...size }
  );
}
