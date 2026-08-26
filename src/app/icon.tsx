import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * ブラウザタブ等に表示するファビコン。早稲田カラー（臙脂色）の丸地に
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
          background: "#7A2140",
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
