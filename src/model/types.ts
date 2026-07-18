// Ristikkostudio – tietomalli suomalaiselle kuvaristikolle

export type CellType = 'empty' | 'letter' | 'clue' | 'image' | 'blocked' | 'decor';
export type Dir = 'across' | 'down';
export type ArrowDir = 'right' | 'down' | 'right-down' | 'down-right';
export type Difficulty = 1 | 2 | 3;

export interface Cell {
  type: CellType;
  /** Ratkaisukirjain (vain letter-ruuduissa) */
  letter: string;
  /** Vihje-, kuva- tai koristealueen jäsenyys */
  regionId?: string;
  locked?: boolean;
}

export interface RegionArrow {
  /** Mistä reunasta nuoli lähtee */
  edge: 'right' | 'bottom';
  /** Vastauksen suunta – ei koskaan diagonaalinen */
  dir: ArrowDir;
}

export interface Region {
  id: string;
  kind: 'text' | 'image' | 'decor';
  r: number;
  c: number;
  w: number;
  h: number;
  text?: string;
  imageId?: string;
  /** Kuvasovitus */
  fit?: 'contain' | 'cover';
  imageZoom?: number;
  entryId?: string;
  arrow?: RegionArrow;
  fontSize?: number;
  align?: 'left' | 'center';
  bg?: string;
}

export interface WordEntry {
  id: string;
  answer: string;
  clue: string;
  imageId?: string;
  category?: string;
  difficulty: Difficulty;
  priority: Difficulty;
  required: boolean;
  notes?: string;
}

export interface Placement {
  id: string;
  entryId: string;
  r: number;
  c: number;
  dir: Dir;
  length: number;
  locked?: boolean;
}

export interface ImageAsset {
  id: string;
  name: string;
  dataUrl: string;
  alt: string;
  usedAt?: number;
}

export interface PageSettings {
  size: 'A4' | 'A3' | 'Letter';
  orientation: 'portrait' | 'landscape';
  /** millimetreinä */
  margins: number;
}

export interface StyleSettings {
  accent: string;
  gridLine: number;
  cellBg: string;
  clueBg: string;
  font: 'sans' | 'serif' | 'cond';
  arrowStyle: 'solid' | 'outline';
  imageBorder: boolean;
  showHeader: boolean;
  title: string;
  author: string;
  intro: string;
  logoDataUrl?: string;
}

export interface Project {
  id: string;
  name: string;
  page: PageSettings;
  rows: number;
  cols: number;
  /** cells[r][c] */
  cells: Cell[][];
  regions: Region[];
  entries: WordEntry[];
  placements: Placement[];
  images: ImageAsset[];
  style: StyleSettings;
  theme: string;
  difficulty: Difficulty;
}

export type Severity = 'virhe' | 'varoitus' | 'ehdotus';

export interface Issue {
  severity: Severity;
  message: string;
  target?: { r: number; c: number };
}

export interface AiSuggestion {
  id: string;
  word: string;
  fit: number; // 0–100
  common: number; // 0–100
  themeFit: number; // 0–100
  difficulty: Difficulty;
  reason: string;
}

/** Vaaka- tai pystysuuntainen kirjainruutujen jono */
export interface Slot {
  r: number;
  c: number;
  dir: Dir;
  length: number;
  pattern: string; // esim. "_A_SA"
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: 'Helppo',
  2: 'Keskitaso',
  3: 'Vaikea',
};

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function makeCell(type: CellType = 'empty'): Cell {
  return { type, letter: '' };
}

export function makeGrid(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => makeCell())
  );
}
