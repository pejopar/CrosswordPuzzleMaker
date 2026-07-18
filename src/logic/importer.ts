import { WordEntry, uid } from '../model/types';

export interface ParsedRow {
  answer: string;
  clue: string;
  duplicate?: boolean;
  missingClue?: boolean;
}

/**
 * Jäsentää liitetyn listan tai CSV:n muodoissa:
 *   VASTAUS; VIHJE
 *   VASTAUS, VIHJE  (CSV)
 *   VASTAUS<sarkain>VIHJE
 *   VASTAUS         (pelkkä sana)
 */
export function parseWordList(text: string, existing: string[] = []): ParsedRow[] {
  const seen = new Set(existing.map((w) => w.toUpperCase()));
  const rows: ParsedRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let answer = '';
    let clue = '';
    if (line.includes(';')) {
      const idx = line.indexOf(';');
      answer = line.slice(0, idx).trim();
      clue = line.slice(idx + 1).trim();
    } else if (line.includes('\t')) {
      const idx = line.indexOf('\t');
      answer = line.slice(0, idx).trim();
      clue = line.slice(idx + 1).trim();
    } else if (line.includes(',')) {
      const idx = line.indexOf(',');
      answer = line.slice(0, idx).trim();
      clue = line.slice(idx + 1).trim();
    } else {
      answer = line;
    }
    answer = answer.replace(/^"|"$/g, '').toUpperCase();
    clue = clue.replace(/^"|"$/g, '');
    if (!answer || !/^[A-ZÅÄÖ\- ]+$/i.test(answer)) continue;
    const dup = seen.has(answer);
    seen.add(answer);
    rows.push({ answer, clue, duplicate: dup, missingClue: !clue });
  }
  return rows;
}

export function rowsToEntries(rows: ParsedRow[]): WordEntry[] {
  return rows
    .filter((r) => !r.duplicate)
    .map((r) => ({
      id: uid('e'),
      answer: r.answer,
      clue: r.clue,
      difficulty: 2 as const,
      priority: 2 as const,
      required: false,
    }));
}
