import { StyleSettings, uid } from './types';

/**
 * Teeman visuaaliset avaimet. Sisältö (otsikko, tekijä, johdanto, alatunniste,
 * logo) EI kuulu teemaan – se säilyy teemaa vaihdettaessa.
 */
export type ThemeStyle = Pick<
  StyleSettings,
  | 'accent'
  | 'gridLine'
  | 'gridLineColor'
  | 'cellBg'
  | 'clueBg'
  | 'cornerRadius'
  | 'blockedStyle'
  | 'font'
  | 'arrowStyle'
  | 'arrowSize'
  | 'imageBorder'
  | 'titleStyle'
>;

export interface ThemeDef {
  id: string;
  name: string;
  description: string;
  style: ThemeStyle;
  custom?: boolean;
}

export const THEMES: ThemeDef[] = [
  {
    id: 'pop',
    name: 'Pop',
    description: 'Sähkökeltainen, rohkea ja toimituksellinen',
    style: {
      accent: '#FFD400',
      gridLine: 2,
      gridLineColor: '#17151a',
      cellBg: '#FFFFFF',
      clueBg: '#FFF6D6',
      cornerRadius: 0,
      blockedStyle: 'solid',
      font: 'sans',
      arrowStyle: 'solid',
      arrowSize: 'M',
      imageBorder: true,
      titleStyle: 'bar',
    },
  },
  {
    id: 'klassikko',
    name: 'Klassikko',
    description: 'Sanomalehtimäinen, hillitty ja ajaton',
    style: {
      accent: '#111111',
      gridLine: 1,
      gridLineColor: '#111111',
      cellBg: '#FFFFFF',
      clueBg: '#F2F2F2',
      cornerRadius: 0,
      blockedStyle: 'solid',
      font: 'serif',
      arrowStyle: 'solid',
      arrowSize: 'S',
      imageBorder: true,
      titleStyle: 'underline',
    },
  },
  {
    id: 'retro',
    name: 'Retro',
    description: '70-luvun aikakauslehti: kermaa ja poltettua oranssia',
    style: {
      accent: '#E0641E',
      gridLine: 2,
      gridLineColor: '#3B2A1A',
      cellBg: '#FFF8EC',
      clueBg: '#F7E7C8',
      cornerRadius: 6,
      blockedStyle: 'solid',
      font: 'slab',
      arrowStyle: 'solid',
      arrowSize: 'M',
      imageBorder: true,
      titleStyle: 'boxed',
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Nuorekas ja äänekäs: pinkkiä ja paksut viivat',
    style: {
      accent: '#FF3E8A',
      gridLine: 3,
      gridLineColor: '#17151a',
      cellBg: '#FFFFFF',
      clueBg: '#FFE3F0',
      cornerRadius: 0,
      blockedStyle: 'accent',
      font: 'cond',
      arrowStyle: 'solid',
      arrowSize: 'L',
      imageBorder: true,
      titleStyle: 'bar',
    },
  },
  {
    id: 'luonto',
    name: 'Luonto',
    description: 'Rauhallinen salvia ja pehmeät kulmat',
    style: {
      accent: '#7FA662',
      gridLine: 2,
      gridLineColor: '#2E3B2A',
      cellBg: '#FCFBF4',
      clueBg: '#EAF0DC',
      cornerRadius: 4,
      blockedStyle: 'dark',
      font: 'rounded',
      arrowStyle: 'outline',
      arrowSize: 'M',
      imageBorder: false,
      titleStyle: 'plain',
    },
  },
  {
    id: 'mustavalko',
    name: 'Mustavalko',
    description: 'Painoystävällinen harmaasävy, viivoitetut estot',
    style: {
      accent: '#666666',
      gridLine: 1,
      gridLineColor: '#111111',
      cellBg: '#FFFFFF',
      clueBg: '#EEEEEE',
      cornerRadius: 0,
      blockedStyle: 'hatch',
      font: 'sans',
      arrowStyle: 'solid',
      arrowSize: 'S',
      imageBorder: true,
      titleStyle: 'plain',
    },
  },
];

const CUSTOM_KEY = 'ristikkostudio.customThemes.v1';

export function loadCustomThemes(): ThemeDef[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map((t) => ({ ...t, custom: true })) : [];
  } catch {
    return [];
  }
}

export function saveCustomTheme(name: string, style: StyleSettings): ThemeDef {
  const theme: ThemeDef = {
    id: uid('theme'),
    name: name.trim() || 'Oma teema',
    description: 'Oma tallennettu teema',
    custom: true,
    style: {
      accent: style.accent,
      gridLine: style.gridLine,
      gridLineColor: style.gridLineColor,
      cellBg: style.cellBg,
      clueBg: style.clueBg,
      cornerRadius: style.cornerRadius,
      blockedStyle: style.blockedStyle,
      font: style.font,
      arrowStyle: style.arrowStyle,
      arrowSize: style.arrowSize,
      imageBorder: style.imageBorder,
      titleStyle: style.titleStyle,
    },
  };
  const list = [...loadCustomThemes(), theme];
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  return theme;
}

export function deleteCustomTheme(id: string) {
  const list = loadCustomThemes().filter((t) => t.id !== id);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}

/** Estoruudun täyttöväri/kuviointi teeman asetuksista. */
export function blockedFill(style: StyleSettings): string {
  switch (style.blockedStyle) {
    case 'dark':
      return '#4a4a4a';
    case 'accent':
      return style.accent;
    case 'hatch':
      return 'hatch'; // renderöijä käsittelee erikseen
    default:
      return style.gridLineColor;
  }
}
