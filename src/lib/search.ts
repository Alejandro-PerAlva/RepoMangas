export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
export const tokens = (q: string) => norm(q).split(' ').filter(Boolean);

/** 0 = no match. Higher is better: exact > prefix > word-start > substring; every token must match. */
export function score(text: string, q: string): number {
  const t = norm(text);
  const ts = tokens(q);
  if (!ts.length) return 1;
  const whole = ts.join(' ');
  let sc = t === whole ? 100 : t.startsWith(whole) ? 60 : 0;
  const words = t.split(' ');
  for (const k of ts) {
    if (words.includes(k)) sc += 10;
    else if (words.some((w) => w.startsWith(k))) sc += 6;
    else if (t.includes(k)) sc += 2;
    else return 0;
  }
  return sc + 1;
}
export const matches = (text: string, q: string) => score(text, q) > 0;
export function rank<T>(items: T[], q: string, get: (x: T) => string): T[] {
  if (!tokens(q).length) return items;
  return items.map((x) => [x, score(get(x), q)] as const).filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]).map(([x]) => x);
}
