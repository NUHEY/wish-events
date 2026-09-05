/** Stable pagination for rows that can share a database transaction timestamp. */
export type MessageCursor = { created_at: string; id: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

/** Keep the original timestamp precision; JavaScript Date would discard microseconds. */
export function messageCursorFilter(cursor: MessageCursor, direction: "before" | "after" = "before"): string {
  if (!UUID_PATTERN.test(cursor.id) || !TIMESTAMP_PATTERN.test(cursor.created_at) || !Number.isFinite(Date.parse(cursor.created_at))) {
    throw new Error("メッセージの読み込み位置が正しくありません");
  }
  const operator = direction === "before" ? "lt" : "gt";
  return `created_at.${operator}.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.${operator}.${cursor.id})`;
}

/** Recovery advances only after a completed database fetch, never from optimistic messages. */
export function initialMessageCursor(messages: MessageCursor[]): MessageCursor {
  const latest = messages.at(-1);
  return latest
    ? { created_at: latest.created_at, id: latest.id }
    : { created_at: "1970-01-01T00:00:00.000Z", id: "00000000-0000-0000-0000-000000000000" };
}

function timestampKey(timestamp: string): string {
  // Date supplies the UTC second; preserve PostgreSQL's sub-millisecond fraction.
  const fraction = timestamp.match(/\.(\d+)/)?.[1] ?? "";
  return `${new Date(timestamp).toISOString().slice(0, 19)}.${fraction.padEnd(6, "0")}`;
}

/** Realtime and recovery may overlap or arrive out of order. */
export function mergeMessages<T extends MessageCursor>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => {
    const left = timestampKey(a.created_at);
    const right = timestampKey(b.created_at);
    return left < right ? -1 : left > right ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
