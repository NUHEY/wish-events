"use client";

import { useEffect } from "react";

/**
 * ルートレイアウト自体でエラーが起きた場合のフォールバック（error.tsxとは違い、
 * <html>/<body>を自前で描画する必要がある）。真っ白なまま固まって見える
 * ケースの対策として追加。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ja">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1.5rem",
            fontFamily: "sans-serif",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700 }}>問題が発生しました</h1>
          <p style={{ fontSize: "0.875rem", color: "#666" }}>
            しばらくしてからもう一度お試しください。
          </p>
          <button
            onClick={() => reset()}
            style={{
              minHeight: 44,
              padding: "0.5rem 1.25rem",
              borderRadius: "9999px",
              background: "#111",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            もう一度試す
          </button>
          <button onClick={() => window.location.reload()} style={{ minHeight: 44, padding: "0.5rem 1.25rem", textDecoration: "underline" }}>ページを読み込み直す / Reload page</button>
        </div>
      </body>
    </html>
  );
}
