// Tekoälyavustin. Sanaehdotukset perustuvat oikeaan suomenkieliseen
// sanastoon (ks. wordlist.ts) – risteyskirjaimet toimivat rajoitteina,
// joten ehdotukset sopivat aina ruudukkoon. Vihjegeneraattori on yhä
// mock-toteutus, jonka tilalle voi kytkeä oikean AI-palvelun (esim.
// Claude API) muuttamatta editoria.

import { AiSuggestion, Difficulty, uid } from '../model/types';
import { findMatches, isWordlistReady } from './wordlist';

export { ensureWordlist, isWordlistReady } from './wordlist';

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

/** Teemaan sopivien sanojen hakemisto nopeaa teemapisteytystä varten. */
const THEME_WORDS = new Map(MOCK_WORDS.map((m) => [m.word, m.theme]));

export interface SuggestResult {
  suggestions: AiSuggestion[];
  /** Kuvioon sopivien sanojen kokonaismäärä sanastossa */
  total: number;
}

/**
 * Ehdottaa kuvioon sopivia suomen sanoja. Risteyskirjaimet (muut kuin _)
 * toimivat rajoitteina, joten jokainen ehdotus sopii ruudukkoon sellaisenaan.
 */
export function suggestFitting(
  pattern: string,
  opts: { theme?: string; difficulty?: Difficulty; exclude?: string[]; seed?: number; limit?: number } = {}
): SuggestResult {
  const excl = new Set((opts.exclude ?? []).map((w) => w.toUpperCase()));
  const themeKey = (opts.theme ?? '').toLowerCase();
  const seed = opts.seed ?? 0;
  const limit = opts.limit ?? 6;
  const known = pattern.replace(/_/g, '').length;

  if (!isWordlistReady()) {
    // Sanasto latautuu vielä – käytetään suppeaa varasanastoa
    const hits = MOCK_WORDS.filter((m) => matchesPattern(m.word, pattern) && !excl.has(m.word));
    const rot = hits.length ? seed % hits.length : 0;
    const rotated = [...hits.slice(rot), ...hits.slice(0, rot)];
    return {
      total: hits.length,
      suggestions: rotated.slice(0, limit).map((m, i) => ({
        id: uid('sug'),
        word: m.word,
        fit: Math.min(100, 60 + known * 8),
        common: m.common,
        themeFit: m.theme.some((t) => themeKey.includes(t)) ? 88 : 50,
        difficulty: m.difficulty,
        reason: REASONS[(i + seed) % REASONS.length],
      })),
    };
  }

  const { matches, total } = findMatches(pattern, {
    exclude: excl,
    limit,
    offset: seed * limit,
  });
  return {
    total,
    suggestions: matches.map((dw, i) => {
      const themes = THEME_WORDS.get(dw.word);
      const themeFit = themes && themes.some((t) => themeKey.includes(t)) ? 90 : dw.common > 70 ? 55 : 40;
      const difficulty: Difficulty = dw.common > 72 ? 1 : dw.common > 45 ? 2 : 3;
      return {
        id: uid('sug'),
        word: dw.word,
        fit: Math.min(100, 62 + known * 8 + (dw.common > 70 ? 8 : 0)),
        common: dw.common,
        themeFit,
        difficulty,
        reason:
          dw.common > 72
            ? 'Yleinen nykysuomen sana – helppo ratkojalle.'
            : dw.common > 45
              ? REASONS[(i + seed) % REASONS.length]
              : 'Harvinaisempi sana – sopii vaikeampaan ristikkoon.',
      } satisfies AiSuggestion;
    }),
  };
}

/** Yhteensopivuuskääre vanhalle kutsutavalle (mm. automaattitäyttö). */
export function suggestWords(
  pattern: string,
  opts: { theme?: string; difficulty?: Difficulty; exclude?: string[]; seed?: number } = {}
): AiSuggestion[] {
  return suggestFitting(pattern, { ...opts, limit: 4 }).suggestions;
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
