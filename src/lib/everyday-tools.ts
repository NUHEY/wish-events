export function splitBill(total: number, count: number) {
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isInteger(count) || count < 1 || count > 100) return null;
  const base = Math.floor(total / count);
  return { base, extra: total % count, count };
}

export function makeGroups(names: string[], count: number, random = Math.random): string[][] {
  if (!Number.isInteger(count) || count < 1 || count > names.length) return [];
  const shuffled = [...names];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return Array.from({ length: count }, (_, index) => shuffled.filter((_, i) => i % count === index));
}
