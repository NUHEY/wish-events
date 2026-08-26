import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * ブラウザタブ等に表示するファビコン。えんじ色を軽くしたベリー色の地に
 * 頭文字の"W"を置いた、ブランド専用の画像アセットを持たずコードだけで
 * 生成できるシンプルなマーク。
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#A84F6D",
          color: "#ffffff",
          fontSize: 20,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        W
      </div>
    ),
    { ...size }
  );
}
