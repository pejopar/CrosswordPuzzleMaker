import { Cell, Dir, Placement, Project, Region, Slot, WordEntry, makeCell, uid } from '../model/types';

export { makeCell };

export function cloneProject(p: Project): Project {
  return structuredClone(p);
}

export function inBounds(p: Project, r: number, c: number): boolean {
  return r >= 0 && r < p.rows && c >= 0 && c < p.cols;
}

export function cellAt(p: Project, r: number, c: number): Cell | null {
  return inBounds(p, r, c) ? p.cells[r][c] : null;
}

/** Etsii valitun ruudun kirjainjonon (vaaka tai pysty). */
export function findSlot(p: Project, r: number, c: number, dir: Dir): Slot | null {
  if (cellAt(p, r, c)?.type !== 'letter') return null;
  let sr = r, sc = c;
  if (dir === 'across') {
    while (cellAt(p, sr, sc - 1)?.type === 'letter') sc--;
  } else {
    while (cellAt(p, sr - 1, sc)?.type === 'letter') sr--;
  }
  let len = 0;
  let pattern = '';
  let rr = sr, cc = sc;
  while (cellAt(p, rr, cc)?.type === 'letter') {
    pattern += p.cells[rr][cc].letter || '_';
    len++;
    if (dir === 'across') cc++;
    else rr++;
  }
  if (len < 2) return null;
  return { r: sr, c: sc, dir, length: len, pattern };
}

/** Sijoituksen kattamat ruudut */
export function placementCells(pl: Placement): { r: number; c: number }[] {
  return Array.from({ length: pl.length }, (_, i) => ({
    r: pl.dir === 'down' ? pl.r + i : pl.r,
    c: pl.dir === 'across' ? pl.c + i : pl.c,
  }));
}

export function placementAt(p: Project, r: number, c: number, dir?: Dir): Placement | undefined {
  return p.placements.find(
    (pl) =>
      (!dir || pl.dir === dir) &&
      placementCells(pl).some((pc) => pc.r === r && pc.c === c)
  );
}

export function regionAt(p: Project, r: number, c: number): Region | undefined {
  const id = cellAt(p, r, c)?.regionId;
  return id ? p.regions.find((rg) => rg.id === id) : undefined;
}

function shiftAfterRowInsert(p: Project, idx: number) {
  for (const rg of p.regions) {
    if (rg.r >= idx) rg.r++;
    else if (rg.r + rg.h > idx) rg.h++;
  }
  for (const pl of p.placements) {
    if (pl.r >= idx) pl.r++;
    else if (pl.dir === 'down' && pl.r + pl.length > idx) pl.length++;
  }
}

function shiftAfterColInsert(p: Project, idx: number) {
  for (const rg of p.regions) {
    if (rg.c >= idx) rg.c++;
    else if (rg.c + rg.w > idx) rg.w++;
  }
  for (const pl of p.placements) {
    if (pl.c >= idx) pl.c++;
    else if (pl.dir === 'across' && pl.c + pl.length > idx) pl.length++;
  }
}

export function addRow(p: Project, idx: number): Project {
  const n = cloneProject(p);
  n.cells.splice(idx, 0, Array.from({ length: n.cols }, () => makeCell()));
  n.rows++;
  shiftAfterRowInsert(n, idx);
  syncRegionCells(n);
  return n;
}

export function addCol(p: Project, idx: number): Project {
  const n = cloneProject(p);
  for (const row of n.cells) row.splice(idx, 0, makeCell());
  n.cols++;
  shiftAfterColInsert(n, idx);
  syncRegionCells(n);
  return n;
}

export function rowHasContent(p: Project, idx: number): boolean {
  return p.cells[idx]?.some((c) => c.type !== 'empty') ?? false;
}

export function colHasContent(p: Project, idx: number): boolean {
  return p.cells.some((row) => row[idx] && row[idx].type !== 'empty');
}

export function deleteRow(p: Project, idx: number): Project {
  if (p.rows <= 2) return p;
  const n = cloneProject(p);
  n.cells.splice(idx, 1);
  n.rows--;
  n.regions = n.regions
    .map((rg) => {
      if (rg.r > idx) return { ...rg, r: rg.r - 1 };
      if (rg.r + rg.h > idx) return { ...rg, h: rg.h - 1 };
      return rg;
    })
    .filter((rg) => rg.h > 0);
  n.placements = n.placements
    .map((pl) => {
      if (pl.dir === 'down') {
        if (pl.r > idx) return { ...pl, r: pl.r - 1 };
        if (pl.r + pl.length > idx) return { ...pl, length: pl.length - 1 };
        return pl;
      }
      if (pl.r === idx) return null;
      if (pl.r > idx) return { ...pl, r: pl.r - 1 };
      return pl;
    })
    .filter((pl): pl is Placement => !!pl && pl.length >= 2);
  syncRegionCells(n);
  return n;
}

export function deleteCol(p: Project, idx: number): Project {
  if (p.cols <= 2) return p;
  const n = cloneProject(p);
  for (const row of n.cells) row.splice(idx, 1);
  n.cols--;
  n.regions = n.regions
    .map((rg) => {
      if (rg.c > idx) return { ...rg, c: rg.c - 1 };
      if (rg.c + rg.w > idx) return { ...rg, w: rg.w - 1 };
      return rg;
    })
    .filter((rg) => rg.w > 0);
  n.placements = n.placements
    .map((pl) => {
      if (pl.dir === 'across') {
        if (pl.c > idx) return { ...pl, c: pl.c - 1 };
        if (pl.c + pl.length > idx) return { ...pl, length: pl.length - 1 };
        return pl;
      }
      if (pl.c === idx) return null;
      if (pl.c > idx) return { ...pl, c: pl.c - 1 };
      return pl;
    })
    .filter((pl): pl is Placement => !!pl && pl.length >= 2);
  syncRegionCells(n);
  return n;
}

export function resizeGrid(p: Project, rows: number, cols: number): Project {
  let n = p;
  while (n.rows < rows) n = addRow(n, n.rows);
  while (n.rows > rows) n = deleteRow(n, n.rows - 1);
  while (n.cols < cols) n = addCol(n, n.cols);
  while (n.cols > cols) n = deleteCol(n, n.cols - 1);
  return n;
}

/** Varmistaa että alueiden ruudut ovat oikeaa tyyppiä ja jäsenyydet ajan tasalla. */
export function syncRegionCells(p: Project) {
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++) {
      const cell = p.cells[r][c];
      if (cell.regionId && !p.regions.some((rg) => rg.id === cell.regionId)) {
        p.cells[r][c] = makeCell();
      }
    }
  for (const rg of p.regions) {
    const type = rg.kind === 'text' ? 'clue' : rg.kind === 'image' ? 'image' : 'decor';
    for (let r = rg.r; r < Math.min(rg.r + rg.h, p.rows); r++)
      for (let c = rg.c; c < Math.min(rg.c + rg.w, p.cols); c++) {
        p.cells[r][c] = { type, letter: '', regionId: rg.id };
      }
  }
}

export function removeRegion(p: Project, regionId: string): Project {
  const n = cloneProject(p);
  n.regions = n.regions.filter((rg) => rg.id !== regionId);
  for (let r = 0; r < n.rows; r++)
    for (let c = 0; c < n.cols; c++)
      if (n.cells[r][c].regionId === regionId) n.cells[r][c] = makeCell();
  return n;
}

/** Poistaa sijoituksen: kirjaimet jäävät vain jos toinen sana risteää niissä. */
export function removePlacement(p: Project, placementId: string): Project {
  const n = cloneProject(p);
  const pl = n.placements.find((x) => x.id === placementId);
  if (!pl) return p;
  n.placements = n.placements.filter((x) => x.id !== placementId);
  for (const pc of placementCells(pl)) {
    const other = n.placements.some((o) =>
      placementCells(o).some((oc) => oc.r === pc.r && oc.c === pc.c)
    );
    if (!other && inBounds(n, pc.r, pc.c)) n.cells[pc.r][pc.c].letter = '';
  }
  return n;
}

/** Sanan kirjoittaminen ruudukkoon + sijoitusmerkintä. */
export function placeWord(
  p: Project,
  entry: WordEntry,
  r: number,
  c: number,
  dir: Dir
): Project {
  const n = cloneProject(p);
  if (!n.entries.some((e) => e.id === entry.id)) n.entries.push(entry);
  const letters = [...entry.answer.toUpperCase()];
  letters.forEach((ch, i) => {
    const rr = dir === 'down' ? r + i : r;
    const cc = dir === 'across' ? c + i : c;
    if (inBounds(n, rr, cc)) n.cells[rr][cc] = { ...n.cells[rr][cc], type: 'letter', letter: ch, regionId: undefined };
  });
  n.placements = n.placements.filter(
    (pl) => !(pl.entryId === entry.id && pl.dir === dir)
  );
  n.placements.push({ id: uid('pl'), entryId: entry.id, r, c, dir, length: letters.length });
  return n;
}

/** Kokeileeko sana sopia ruudukkoon annettuun kohtaan? Palauttaa risteysten määrän tai -1. */
function tryFit(p: Project, word: string, r: number, c: number, dir: Dir): number {
  const letters = [...word];
  let crossings = 0;
  const before = dir === 'across' ? cellAt(p, r, c - 1) : cellAt(p, r - 1, c);
  const after =
    dir === 'across' ? cellAt(p, r, c + letters.length) : cellAt(p, r + letters.length, c);
  if (before?.type === 'letter' || after?.type === 'letter') return -1;
  for (let i = 0; i < letters.length; i++) {
    const rr = dir === 'down' ? r + i : r;
    const cc = dir === 'across' ? c + i : c;
    const cell = cellAt(p, rr, cc);
    if (!cell) return -1;
    if (cell.type === 'letter') {
      if (cell.letter && cell.letter !== letters[i]) return -1;
      if (cell.letter === letters[i]) crossings++;
    } else if (cell.type !== 'empty' && cell.type !== 'blocked') {
      return -1;
    }
  }
  return crossings;
}

/** Julkinen sovitustesti esim. raahaukselle: risteysten määrä tai -1 jos ei sovi. */
export function fitWordAt(p: Project, word: string, r: number, c: number, dir: Dir): number {
  return tryFit(p, word.toUpperCase(), r, c, dir);
}

/** Yksinkertainen automaattinen sijoittelija sijoittamattomille sanoille. */
export function autoPlaceEntries(p: Project, entryIds: string[]): { project: Project; placed: string[]; failed: string[] } {
  let cur = cloneProject(p);
  const placed: string[] = [];
  const failed: string[] = [];
  const ids = [...entryIds].sort((a, b) => {
    const ea = cur.entries.find((e) => e.id === a)!;
    const eb = cur.entries.find((e) => e.id === b)!;
    return eb.answer.length - ea.answer.length;
  });
  for (const id of ids) {
    const entry = cur.entries.find((e) => e.id === id);
    if (!entry) continue;
    const word = entry.answer.toUpperCase();
    let best: { r: number; c: number; dir: Dir; score: number } | null = null;
    const hasLetters = cur.placements.length > 0;
    for (let r = 0; r < cur.rows; r++)
      for (let c = 0; c < cur.cols; c++)
        for (const dir of ['across', 'down'] as Dir[]) {
          const fit = tryFit(cur, word, r, c, dir);
          if (fit < 0) continue;
          if (hasLetters && fit === 0) continue; // vaadi risteys kun ruudukossa on jo sanoja
          const score = fit * 10 - Math.abs(r - cur.rows / 2) - Math.abs(c - cur.cols / 2);
          if (!best || score > best.score) best = { r, c, dir, score };
        }
    if (best) {
      cur = placeWord(cur, entry, best.r, best.c, best.dir);
      placed.push(id);
    } else {
      failed.push(id);
    }
  }
  return { project: cur, placed, failed };
}

export function clearGrid(p: Project): Project {
  const n = cloneProject(p);
  n.cells = n.cells.map((row) => row.map(() => makeCell()));
  n.regions = [];
  n.placements = [];
  return n;
}
