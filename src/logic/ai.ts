// Tekoälyavustimen mock-toteutus.
// Rajapinta on eriytetty niin, että oikean AI-palvelun voi kytkeä tilalle
// (esim. korvaamalla nämä funktiot API-kutsuilla) muuttamatta editoria.

import { AiSuggestion, Difficulty, uid } from '../model/types';

/** Mock-sanasto: luonnollista, nykyaikaista suomen kieltä. */
const MOCK_WORDS: { word: string; common: number; theme: string[]; difficulty: Difficulty }[] = [
  { word: 'TALO', common: 95, theme: ['arki'], difficulty: 1 },
  { word: 'KOTI', common: 96, theme: ['arki'], difficulty: 1 },
  { word: 'VESI', common: 97, theme: ['luonto'], difficulty: 1 },
  { word: 'LUMI', common: 92, theme: ['luonto', 'talvi'], difficulty: 1 },
  { word: 'JÄRVI', common: 90, theme: ['luonto'], difficulty: 1 },
  { word: 'METSÄ', common: 91, theme: ['luonto'], difficulty: 1 },
  { word: 'KESÄ', common: 95, theme: ['luonto'], difficulty: 1 },
  { word: 'RANTA', common: 90, theme: ['luonto'], difficulty: 1 },
  { word: 'SALSA', common: 62, theme: ['musiikki', 'pop'], difficulty: 2 },
  { word: 'KITARA', common: 80, theme: ['musiikki', 'pop'], difficulty: 1 },
  { word: 'BIISI', common: 75, theme: ['musiikki', 'pop'], difficulty: 1 },
  { word: 'KEIKKA', common: 78, theme: ['musiikki', 'pop'], difficulty: 1 },
  { word: 'LAULU', common: 88, theme: ['musiikki'], difficulty: 1 },
  { word: 'TANSSI', common: 84, theme: ['musiikki', 'pop'], difficulty: 1 },
  { word: 'LEVY', common: 82, theme: ['musiikki'], difficulty: 1 },
  { word: 'DISKO', common: 66, theme: ['musiikki', 'pop'], difficulty: 2 },
  { word: 'POPPI', common: 70, theme: ['musiikki', 'pop'], difficulty: 1 },
  { word: 'RÄPPI', common: 68, theme: ['musiikki', 'pop'], difficulty: 2 },
  { word: 'SOME', common: 85, theme: ['media', 'pop'], difficulty: 1 },
  { word: 'MEEMI', common: 72, theme: ['media', 'pop'], difficulty: 2 },
  { word: 'STRIIMI', common: 64, theme: ['media', 'pop'], difficulty: 2 },
  { word: 'SARJA', common: 88, theme: ['media'], difficulty: 1 },
  { word: 'LEFFA', common: 80, theme: ['media', 'pop'], difficulty: 1 },
  { word: 'TAIDE', common: 85, theme: ['kulttuuri'], difficulty: 1 },
  { word: 'RUNO', common: 82, theme: ['kulttuuri'], difficulty: 1 },
  { word: 'VALO', common: 90, theme: ['arki'], difficulty: 1 },
  { word: 'KAUPUNKI', common: 92, theme: ['paikat'], difficulty: 1 },
  { word: 'TURKU', common: 85, theme: ['paikat'], difficulty: 1 },
  { word: 'TAMPERE', common: 86, theme: ['paikat'], difficulty: 1 },
  { word: 'OULU', common: 82, theme: ['paikat'], difficulty: 1 },
  { word: 'KUUSI', common: 88, theme: ['luonto'], difficulty: 1 },
  { word: 'KANSA', common: 84, theme: ['arki'], difficulty: 2 },
  { word: 'KASVI', common: 84, theme: ['luonto'], difficulty: 1 },
  { word: 'KAUSI', common: 82, theme: ['media'], difficulty: 1 },
  { word: 'PASTA', common: 84, theme: ['ruoka'], difficulty: 1 },
  { word: 'PIZZA', common: 86, theme: ['ruoka'], difficulty: 1 },
  { word: 'PULLA', common: 87, theme: ['ruoka'], difficulty: 1 },
  { word: 'LAKKA', common: 60, theme: ['luonto', 'ruoka'], difficulty: 2 },
  { word: 'AURINKO', common: 93, theme: ['luonto'], difficulty: 1 },
  { word: 'FANI', common: 74, theme: ['pop'], difficulty: 1 },
  { word: 'IDOLI', common: 66, theme: ['pop'], difficulty: 2 },
  { word: 'LAVASTE', common: 55, theme: ['kulttuuri'], difficulty: 2 },
  { word: 'STUDIO', common: 76, theme: ['media', 'pop'], difficulty: 1 },
  { word: 'RADIO', common: 90, theme: ['media'], difficulty: 1 },
  { word: 'TUBE', common: 58, theme: ['media', 'pop'], difficulty: 2 },
  { word: 'HITTI', common: 72, theme: ['musiikki', 'pop'], difficulty: 1 },
  { word: 'BÄNDI', common: 76, theme: ['musiikki', 'pop'], difficulty: 1 },
  { word: 'SOOLO', common: 68, theme: ['musiikki'], difficulty: 2 },
  { word: 'KUORO', common: 78, theme: ['musiikki'], difficulty: 1 },
];

/** Sopiiko sana kuvioon, esim. "_A_SA" */
export function matchesPattern(word: string, pattern: string): boolean {
  if (word.length !== pattern.length) return false;
  const w = word.toUpperCase();
  const pt = pattern.toUpperCase();
  for (let i = 0; i < w.length; i++) {
    if (pt[i] !== '_' && pt[i] !== w[i]) return false;
  }
  return true;
}

const REASONS = [
  'Sopii risteyskirjaimiin ja on tuttu useimmille ratkojille.',
  'Yleinen nykysuomen sana, hyvä täyttöön.',
  'Teemaan istuva valinta, ei liian kulunut ristikkosana.',
  'Helppo vihjeistää sekä tekstillä että kuvalla.',
  'Ratkojaystävällinen sana, jolla hyvät risteysmahdollisuudet.',
];

export function suggestWords(
  pattern: string,
  opts: { theme?: string; difficulty?: Difficulty; exclude?: string[]; seed?: number } = {}
): AiSuggestion[] {
  const excl = new Set((opts.exclude ?? []).map((w) => w.toUpperCase()));
  const themeKey = (opts.theme ?? '').toLowerCase();
  const seed = opts.seed ?? 0;
  const hits = MOCK_WORDS.filter(
    (m) => matchesPattern(m.word, pattern) && !excl.has(m.word)
  );
  const scored = hits.map((m, i) => {
    const themeFit = m.theme.some((t) => themeKey.includes(t)) ? 85 + (i % 10) : 45 + (i % 20);
    const known = pattern.replace(/_/g, '').length;
    const fit = Math.min(100, 60 + known * 8 + (m.common > 80 ? 10 : 0));
    return {
      id: uid('sug'),
      word: m.word,
      fit,
      common: m.common,
      themeFit,
      difficulty: m.difficulty,
      reason: REASONS[(i + seed) % REASONS.length],
    } satisfies AiSuggestion;
  });
  scored.sort((a, b) => b.fit + b.themeFit / 2 - (a.fit + a.themeFit / 2));
  // "Kokeile toista" kierrättää listaa
  const rot = seed % Math.max(1, scored.length);
  return [...scored.slice(rot), ...scored.slice(0, rot)].slice(0, 4);
}

/** Mock-vihjegeneraattori */
const CLUE_TEMPLATES: Record<string, string[]> = {
  TALO: ['Rakennus asumiseen', 'Siinä on katto ja seinät'],
  KOTI: ['Oma rakas paikka', 'Siellä sydän on'],
  VESI: ['Janoisen juoma', 'H₂O'],
  KITARA: ['Kuusikielinen soitin', 'Bändin peruspilari'],
  RADIO: ['Kuuluu keittiössä aamuisin', 'Aaltopituuksien media'],
  KESÄ: ['Lomakausi', 'Vuodenajoista lämpimin'],
};

export function generateClue(answer: string, style: 'normaali' | 'helpompi' | 'vaikeampi' | 'lyhyempi' | 'hauskempi' = 'normaali', seed = 0): string {
  const base = CLUE_TEMPLATES[answer.toUpperCase()];
  if (base) return base[seed % base.length];
  const a = answer.toUpperCase();
  switch (style) {
    case 'helpompi':
      return `Alkaa ${a[0]}-kirjaimella, ${a.length} kirjainta – tuttu sana arjesta`;
    case 'vaikeampi':
      return `Kiertoilmaus sanalle, joka liittyy teemaan (${a.length} kirjainta)`;
    case 'lyhyempi':
      return `${a[0]}${'·'.repeat(Math.max(0, a.length - 1))}`;
    case 'hauskempi':
      return `Tätä et arvaa ensimmäisellä yrittämällä 😉 (${a.length} kirj.)`;
    default:
      return `Suomen kielen sana (${a.length} kirjainta)`;
  }
}

export function rewriteClue(clue: string, mode: 'helpompi' | 'vaikeampi' | 'lyhyempi' | 'hauskempi'): string {
  const c = clue.trim() || 'Vihje';
  switch (mode) {
    case 'helpompi':
      return `${c} (arkinen ja tuttu)`;
    case 'vaikeampi':
      return c.replace(/\s*\(.*\)$/, '') + ' – kierrellen ilmaistuna';
    case 'lyhyempi':
      return c.split(' ').slice(0, 3).join(' ');
    case 'hauskempi':
      return `${c} 😄`;
  }
}

/** Ehdottaa sopisiko vastaus paremmin kuvavihjeellä. */
export function suggestsImageClue(answer: string): boolean {
  return ['KANA', 'KALA', 'KESÄ', 'AURINKO', 'KITARA', 'TALO', 'KUUSI'].includes(answer.toUpperCase());
}
