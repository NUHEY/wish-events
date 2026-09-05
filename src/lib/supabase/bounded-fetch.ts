/** Bound reads so an unavailable backend cannot leave the application shell waiting forever.
 * Writes retain their normal behavior: a timed-out mutation can still commit remotely.
 */
export const boundedFetch: typeof fetch = async (input, init) => {
  const request = typeof Request !== "undefined" && input instanceof Request ? input : undefined;
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return fetch(input, init);
  const upstream = init?.signal ?? request?.signal;
  const controller = new AbortController();
  const cancel = () => controller.abort(upstream?.reason);
  if (upstream?.aborted) cancel();
  else upstream?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException("Backend read timed out", "TimeoutError")), 12_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    upstream?.removeEventListener("abort", cancel);
  }
};
