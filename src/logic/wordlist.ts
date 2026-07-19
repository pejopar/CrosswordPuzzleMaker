// Suomenkielinen sanasto sanaehdotuksia varten.
// Ladataan laiskasti (dynamic import), jotta sovelluksen käynnistys pysyy kevyenä.

export interface DictWord {
  word: string;
  /** 0–100, suurempi = yleisempi */
  common: number;
}

let buckets: Map<number, DictWord[]> | null = null;
let loading: Promise<void> | null = null;

function decode(concat: string, len: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + len <= concat.length; i += len) out.push(concat.slice(i, i + len));
  return out;
}

export function isWordlistReady(): boolean {
  return buckets !== null;
}

export function wordlistSize(): number {
  if (!buckets) return 0;
  let n = 0;
  for (const list of buckets.values()) n += list.length;
  return n;
}

/** Lataa sanaston taustalla. Turvallinen kutsua monta kertaa. */
export function ensureWordlist(): Promise<void> {
  if (buckets) return Promise.resolve();
  if (!loading) {
    loading = import('./words-fi').then(({ COMMON, REST }) => {
      const map = new Map<number, DictWord[]>();
      for (const [lenStr, concat] of Object.entries(COMMON)) {
        const len = Number(lenStr);
        const words = decode(concat, len);
        const list: DictWord[] = words.map((word, i) => ({
          // Yleisyys laskee sijoituksen mukana: kärki ~97, häntä ~55
          word,
          common: Math.max(55, Math.round(97 - 42 * (i / Math.max(1, words.length)))),
        }));
        map.set(len, list);
      }
      for (const [lenStr, concat] of Object.entries(REST)) {
        const len = Number(lenStr);
        const list = map.get(len) ?? [];
        for (const word of decode(concat, len)) list.push({ word, common: 32 });
        map.set(len, list);
      }
      buckets = map;
    });
  }
  return loading;
}

/**
 * Etsii kuvioon sopivat sanat, esim. "_A_SA".
 * Palauttaa osumat yleisyysjärjestyksessä sekä osumien kokonaismäärän.
 */
export function findMatches(
  pattern: string,
  opts: { exclude?: Set<string>; limit?: number; offset?: number } = {}
): { matches: DictWord[]; total: number } {
  const len = pattern.length;
  const list = buckets?.get(len);
  if (!list) return { matches: [], total: 0 };
  const pt = pattern.toUpperCase();
  const fixed: [number, string][] = [];
  for (let i = 0; i < len; i++) if (pt[i] !== '_') fixed.push([i, pt[i]]);
  const exclude = opts.exclude;
  const all: DictWord[] = [];
  outer: for (const dw of list) {
    for (const [i, ch] of fixed) if (dw.word[i] !== ch) continue outer;
    if (exclude?.has(dw.word)) continue;
    all.push(dw);
  }
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 6;
  const start = all.length ? offset % all.length : 0;
  const rotated = start ? [...all.slice(start), ...all.slice(0, start)] : all;
  return { matches: rotated.slice(0, limit), total: all.length };
}
