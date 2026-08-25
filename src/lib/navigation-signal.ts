export const NAVIGATION_START_EVENT = "wish:navigation-start";

/** router.push/replaceを使うボタンからも、リンクと同じ即時ローディング表示を開始する。 */
export function signalNavigation(href: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NAVIGATION_START_EVENT, { detail: { href } }));
}
