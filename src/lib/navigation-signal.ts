export const NAVIGATION_START_EVENT = "wish:navigation-start";

/** router.push/replaceを使うボタンからも、リンクと同じ即時ローディング表示を開始する。 */
export function signalNavigation(href: string): boolean {
  if (typeof window === "undefined") return false;
  // cancelableにすることで、すでに別の遷移が進行中ならNavigationFeedback側から
  // 呼び出し元のrouter.push/replace自体を止められる。複数コンポーネントが持つ
  // 個別のpending状態だけでは防げない、同時タップによるRSC取得の競合を防ぐ。
  return window.dispatchEvent(
    new CustomEvent(NAVIGATION_START_EVENT, { detail: { href }, cancelable: true })
  );
}
