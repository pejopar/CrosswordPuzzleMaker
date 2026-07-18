import {
  Project,
  Region,
  WordEntry,
  Placement,
  ImageAsset,
  makeGrid,
  uid,
  Dir,
} from './types';

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Abstrakti piirroskuva: kana */
const IMG_KANA = svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<rect width="120" height="120" fill="#FFF3C4"/>
<circle cx="62" cy="66" r="30" fill="#111"/>
<circle cx="84" cy="44" r="14" fill="#111"/>
<polygon points="96,42 110,47 96,52" fill="#F59E0B"/>
<circle cx="88" cy="41" r="2.6" fill="#FFF3C4"/>
<path d="M76 30 q3 -10 8 -4 q4 -8 8 -1 q6 -5 5 4 l-9 6 z" fill="#E11D48"/>
<path d="M40 60 q-14 4 -10 16 q8 4 16 -4" fill="#111"/>
<rect x="54" y="94" width="4" height="14" fill="#F59E0B"/>
<rect x="68" y="94" width="4" height="14" fill="#F59E0B"/>
</svg>`);

/** Abstrakti piirroskuva: kesä */
const IMG_KESA = svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<rect width="120" height="120" fill="#BFE7F2"/>
<circle cx="86" cy="30" r="16" fill="#FFD400"/>
<g stroke="#FFD400" stroke-width="4" stroke-linecap="round">
<line x1="86" y1="6" x2="86" y2="0"/><line x1="106" y1="12" x2="112" y2="8"/><line x1="112" y1="30" x2="120" y2="30"/></g>
<path d="M0 84 q30 -22 60 0 q30 22 60 0 v36 h-120 z" fill="#1D9E6E"/>
<path d="M0 96 q30 -16 60 0 q30 16 60 0 v24 h-120 z" fill="#12684A"/>
</svg>`);

/** Abstrakti piirroskuva: mikrofoni */
const IMG_MIKKI = svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<rect width="120" height="120" fill="#FBD3E0"/>
<rect x="48" y="20" width="24" height="44" rx="12" fill="#111"/>
<path d="M38 52 v6 a22 22 0 0 0 44 0 v-6" fill="none" stroke="#111" stroke-width="6"/>
<line x1="60" y1="82" x2="60" y2="98" stroke="#111" stroke-width="6"/>
<line x1="44" y1="100" x2="76" y2="100" stroke="#111" stroke-width="6"/>
</svg>`);

/** Abstrakti piirroskuva: kitara */
const IMG_KITARA = svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<rect width="120" height="120" fill="#DCEBC5"/>
<circle cx="48" cy="78" r="24" fill="#C97B2D"/>
<circle cx="66" cy="58" r="17" fill="#C97B2D"/>
<circle cx="56" cy="70" r="7" fill="#111"/>
<rect x="66" y="14" width="8" height="52" rx="3" transform="rotate(35 70 40)" fill="#7A4A18"/>
<rect x="88" y="6" width="12" height="14" rx="3" fill="#111"/>
</svg>`);

const sampleImages: ImageAsset[] = [
  { id: 'img_kana', name: 'kana.svg', dataUrl: IMG_KANA, alt: 'Piirroskuva kanasta', usedAt: 2 },
  { id: 'img_kesa', name: 'kesa.svg', dataUrl: IMG_KESA, alt: 'Aurinkoinen kesämaisema', usedAt: 1 },
  { id: 'img_mikki', name: 'mikrofoni.svg', dataUrl: IMG_MIKKI, alt: 'Piirroskuva mikrofonista' },
  { id: 'img_kitara', name: 'kitara.svg', dataUrl: IMG_KITARA, alt: 'Piirroskuva kitarasta' },
];

interface SampleWord {
  id: string;
  answer: string;
  clue: string;
  required: boolean;
  difficulty: 1 | 2 | 3;
  category?: string;
  place?: { r: number; c: number; dir: Dir };
  clueCell?: { r: number; c: number; edge: 'right' | 'bottom'; dir: 'right' | 'down' };
  imageRegion?: { r: number; c: number; w: number; h: number; imageId: string; edge: 'right' | 'bottom'; dir: 'right' | 'down' };
  notes?: string;
}

const WORDS: SampleWord[] = [
  { id: 'e_helsinki', answer: 'HELSINKI', clue: 'Suomen pääkaupunki', required: true, difficulty: 1, category: 'Paikat', place: { r: 1, c: 1, dir: 'down' }, clueCell: { r: 0, c: 1, edge: 'bottom', dir: 'down' } },
  { id: 'e_elokuva', answer: 'ELOKUVA', clue: 'Valkokankaalla nähtävä teos', required: true, difficulty: 1, category: 'Kulttuuri', place: { r: 2, c: 1, dir: 'across' }, clueCell: { r: 2, c: 0, edge: 'right', dir: 'right' } },
  { id: 'e_sauna', answer: 'SAUNA', clue: 'Suomalainen löylypaikka', required: true, difficulty: 1, category: 'Perinne', place: { r: 4, c: 1, dir: 'across' }, clueCell: { r: 4, c: 0, edge: 'right', dir: 'right' } },
  { id: 'e_kahvi', answer: 'KAHVI', clue: 'Suosituin aamujuoma', required: true, difficulty: 1, category: 'Ruoka', place: { r: 7, c: 1, dir: 'across' }, clueCell: { r: 7, c: 0, edge: 'right', dir: 'right' } },
  { id: 'e_lava', answer: 'LAVA', clue: 'Esiintyjän paikka festareilla', required: false, difficulty: 1, category: 'Musiikki', place: { r: 1, c: 7, dir: 'down' }, clueCell: { r: 0, c: 7, edge: 'bottom', dir: 'down' } },
  { id: 'e_festari', answer: 'FESTARI', clue: 'Kesän musiikkitapahtuma (puhek.)', required: true, difficulty: 2, category: 'Musiikki', place: { r: 1, c: 9, dir: 'down' }, clueCell: { r: 0, c: 9, edge: 'bottom', dir: 'down' } },
  { id: 'e_visa', answer: 'VISA', clue: 'Tietokilpailu', required: false, difficulty: 2, place: { r: 3, c: 7, dir: 'across' }, clueCell: { r: 3, c: 6, edge: 'right', dir: 'right' } },
  { id: 'e_kala', answer: 'KALA', clue: 'Ui vedessä', required: false, difficulty: 1, category: 'Luonto', place: { r: 5, c: 8, dir: 'across' }, clueCell: { r: 5, c: 7, edge: 'right', dir: 'right' } },
  { id: 'e_kana', answer: 'KANA', clue: '', required: false, difficulty: 1, category: 'Luonto', place: { r: 2, c: 4, dir: 'down' }, imageRegion: { r: 0, c: 3, w: 2, h: 2, imageId: 'img_kana', edge: 'bottom', dir: 'down' }, notes: 'Kuvavihje' },
  { id: 'e_kesa', answer: 'KESÄ', clue: '', required: false, difficulty: 1, place: { r: 8, c: 4, dir: 'across' }, imageRegion: { r: 8, c: 2, w: 2, h: 2, imageId: 'img_kesa', edge: 'right', dir: 'right' }, notes: 'Kuvavihje' },
  // Sijoittamattomat sanat
  { id: 'e_radio', answer: 'RADIO', clue: 'Kuuluu keittiössä aamuisin', required: true, difficulty: 1, category: 'Media' },
  { id: 'e_artisti', answer: 'ARTISTI', clue: 'Esiintyvä taiteilija', required: false, difficulty: 2, category: 'Musiikki' },
  { id: 'e_podcast', answer: 'PODCAST', clue: 'Kuunneltava verkko-ohjelma', required: false, difficulty: 2, category: 'Media' },
];

export function createSampleProject(): Project {
  const rows = 10;
  const cols = 12;
  const cells = makeGrid(rows, cols);
  const regions: Region[] = [];
  const entries: WordEntry[] = [];
  const placements: Placement[] = [];

  for (const w of WORDS) {
    entries.push({
      id: w.id,
      answer: w.answer,
      clue: w.clue,
      category: w.category,
      difficulty: w.difficulty,
      priority: w.required ? 1 : 2,
      required: w.required,
      notes: w.notes,
      imageId: w.imageRegion?.imageId,
    });
    if (!w.place) continue;
    const { r, c, dir } = w.place;
    const letters = [...w.answer];
    placements.push({ id: uid('pl'), entryId: w.id, r, c, dir, length: letters.length });
    letters.forEach((ch, i) => {
      const rr = dir === 'down' ? r + i : r;
      const cc = dir === 'across' ? c + i : c;
      cells[rr][cc] = { type: 'letter', letter: ch };
    });
    if (w.clueCell) {
      const regId = uid('reg');
      regions.push({
        id: regId,
        kind: 'text',
        r: w.clueCell.r,
        c: w.clueCell.c,
        w: 1,
        h: 1,
        text: w.clue,
        entryId: w.id,
        arrow: { edge: w.clueCell.edge, dir: w.clueCell.dir },
      });
      cells[w.clueCell.r][w.clueCell.c] = { type: 'clue', letter: '', regionId: regId };
    }
    if (w.imageRegion) {
      const regId = uid('reg');
      const ir = w.imageRegion;
      regions.push({
        id: regId,
        kind: 'image',
        r: ir.r,
        c: ir.c,
        w: ir.w,
        h: ir.h,
        imageId: ir.imageId,
        fit: 'cover',
        entryId: w.id,
        arrow: { edge: ir.edge, dir: ir.dir },
      });
      for (let rr = ir.r; rr < ir.r + ir.h; rr++)
        for (let cc = ir.c; cc < ir.c + ir.w; cc++)
          cells[rr][cc] = { type: 'image', letter: '', regionId: regId };
    }
  }

  // Koristealue
  const decorId = uid('reg');
  regions.push({
    id: decorId,
    kind: 'decor',
    r: 6,
    c: 4,
    w: 3,
    h: 1,
    text: '★ POP ★',
    bg: '#FFD400',
  });
  for (let cc = 4; cc <= 6; cc++) cells[6][cc] = { type: 'decor', letter: '', regionId: decorId };

  // Loput ruudut estetyiksi
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (cells[r][c].type === 'empty') cells[r][c] = { type: 'blocked', letter: '' };

  return {
    id: uid('proj'),
    name: 'Viikon pop-ristikko',
    page: { size: 'A4', orientation: 'portrait', margins: 12 },
    rows,
    cols,
    cells,
    regions,
    entries,
    placements,
    images: sampleImages.map((i) => ({ ...i })),
    style: {
      accent: '#FFD400',
      gridLine: 2,
      cellBg: '#FFFFFF',
      clueBg: '#FFF6D6',
      font: 'sans',
      arrowStyle: 'solid',
      imageBorder: true,
      showHeader: true,
      title: 'VIIKON POP-RISTIKKO',
      author: 'Ristikkostudio',
      intro: 'Ratkaise vihjeet ja täytä ruudut. Nuolet kertovat vastauksen suunnan – vastaukset kulkevat aina oikealle tai alas.',
    },
    theme: 'Suomalainen popkulttuuri',
    difficulty: 1,
  };
}

export function createBlankProject(opts: {
  name: string;
  size: 'A4' | 'A3' | 'Letter';
  orientation: 'portrait' | 'landscape';
  rows: number;
  cols: number;
  difficulty: 1 | 2 | 3;
  theme: string;
}): Project {
  return {
    id: uid('proj'),
    name: opts.name || 'Nimetön ristikko',
    page: { size: opts.size, orientation: opts.orientation, margins: 12 },
    rows: opts.rows,
    cols: opts.cols,
    cells: makeGrid(opts.rows, opts.cols),
    regions: [],
    entries: [],
    placements: [],
    images: sampleImages.map((i) => ({ ...i, usedAt: undefined })),
    style: {
      accent: '#FFD400',
      gridLine: 2,
      cellBg: '#FFFFFF',
      clueBg: '#FFF6D6',
      font: 'sans',
      arrowStyle: 'solid',
      imageBorder: true,
      showHeader: true,
      title: (opts.name || 'UUSI RISTIKKO').toUpperCase(),
      author: '',
      intro: '',
    },
    theme: opts.theme,
    difficulty: opts.difficulty,
  };
}
