import { Project, Region } from '../model/types';

export interface ExportOptions {
  showSolution: boolean;
  grayscale: boolean;
  includeTitle: boolean;
  includeIntro: boolean;
  includeAuthor: boolean;
}

const CELL = 48;
const PAD = 40;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 6);
}

function arrowPath(rg: Region, x: number, y: number, w: number, h: number): string {
  const s = 7;
  if (!rg.arrow) return '';
  if (rg.arrow.edge === 'right') {
    const ax = x + w;
    const ay = y + h / 2;
    if (rg.arrow.dir === 'right-down') {
      return `<path d="M ${ax} ${ay - 4} h 10 v 10" fill="none" stroke="#111" stroke-width="2.4"/><path d="M ${ax + 10 - s / 2} ${ay + 4} l ${s / 2} ${s} l ${s / 2} -${s} z" fill="#111"/>`;
    }
    return `<path d="M ${ax - 2} ${ay - s / 2} l ${s + 2} ${s / 2} l -${s + 2} ${s / 2} z" fill="#111"/>`;
  }
  const ax = x + w / 2;
  const ay = y + h;
  if (rg.arrow.dir === 'down-right') {
    return `<path d="M ${ax - 4} ${ay} v 10 h 10" fill="none" stroke="#111" stroke-width="2.4"/><path d="M ${ax + 4} ${ay + 10 - s / 2} l ${s} ${s / 2} l -${s} ${s / 2} z" fill="#111"/>`;
  }
  return `<path d="M ${ax - s / 2} ${ay - 2} l ${s / 2} ${s + 2} l ${s / 2} -${s + 2} z" fill="#111"/>`;
}

/** Rakentaa tulostuskelpoisen SVG-esityksen ristikosta. */
export function buildSvg(p: Project, opts: ExportOptions): string {
  const gw = p.cols * CELL;
  const gh = p.rows * CELL;
  const headerH = opts.includeTitle ? 90 : 20;
  const W = gw + PAD * 2;
  const H = gh + PAD * 2 + headerH;
  const line = Math.max(1, p.style.gridLine);
  const accent = opts.grayscale ? '#bbb' : p.style.accent;
  const clueBg = opts.grayscale ? '#eee' : p.style.clueBg;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Archivo, Helvetica, Arial, sans-serif">`
  );
  parts.push(`<rect width="${W}" height="${H}" fill="#FFFDF7"/>`);

  let y0 = PAD;
  if (opts.includeTitle) {
    parts.push(`<rect x="${PAD}" y="${PAD - 10}" width="${Math.min(gw, 16 + p.style.title.length * 22)}" height="44" fill="${accent}"/>`);
    parts.push(`<text x="${PAD + 8}" y="${PAD + 22}" font-size="30" font-weight="800" fill="#111">${esc(p.style.title)}</text>`);
    if (opts.includeAuthor && p.style.author) {
      parts.push(`<text x="${PAD}" y="${PAD + 52}" font-size="12" fill="#444">${esc(p.style.author)}</text>`);
    }
    if (opts.includeIntro && p.style.intro) {
      wrapText(p.style.intro, 90).forEach((ln, i) => {
        parts.push(`<text x="${PAD}" y="${PAD + 68 + i * 14}" font-size="11" fill="#333">${esc(ln)}</text>`);
      });
    }
    y0 = PAD + headerH;
  }

  const imgById = new Map(p.images.map((i) => [i.id, i]));

  // Ruudut
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      const cell = p.cells[r][c];
      const x = PAD + c * CELL;
      const y = y0 + r * CELL;
      if (cell.type === 'empty') continue;
      if (cell.type === 'blocked') {
        parts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${opts.grayscale ? '#222' : '#17151a'}"/>`);
        continue;
      }
      if (cell.type === 'letter') {
        parts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${opts.grayscale ? '#fff' : p.style.cellBg}" stroke="#111" stroke-width="${line}"/>`);
        if (opts.showSolution && cell.letter) {
          parts.push(`<text x="${x + CELL / 2}" y="${y + CELL / 2 + 9}" font-size="26" font-weight="700" text-anchor="middle" fill="#111">${esc(cell.letter)}</text>`);
        }
      }
    }
  }

  // Alueet (vihjeet, kuvat, koristeet)
  for (const rg of p.regions) {
    const x = PAD + rg.c * CELL;
    const y = y0 + rg.r * CELL;
    const w = rg.w * CELL;
    const h = rg.h * CELL;
    if (rg.kind === 'text') {
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${rg.bg && !opts.grayscale ? rg.bg : clueBg}" stroke="#111" stroke-width="${line}"/>`);
      const fs = rg.fontSize ?? 8.5;
      const lines = wrapText(rg.text ?? '', Math.max(4, Math.floor(w / (fs * 0.62))));
      const startY = y + h / 2 - ((lines.length - 1) * (fs + 2)) / 2 + fs / 2.6;
      lines.forEach((ln, i) => {
        parts.push(`<text x="${x + w / 2}" y="${startY + i * (fs + 2)}" font-size="${fs}" font-weight="600" text-anchor="middle" fill="#111">${esc(ln)}</text>`);
      });
      parts.push(arrowPath(rg, x, y, w, h));
    } else if (rg.kind === 'image') {
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#111" stroke-width="${line}"/>`);
      const img = rg.imageId ? imgById.get(rg.imageId) : undefined;
      if (img) {
        parts.push(`<image href="${img.dataUrl}" x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" preserveAspectRatio="${rg.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}"/>`);
      } else {
        parts.push(`<text x="${x + w / 2}" y="${y + h / 2}" font-size="10" text-anchor="middle" fill="#888">KUVA</text>`);
      }
      if (p.style.imageBorder) {
        parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#111" stroke-width="${line + 1}"/>`);
      }
      parts.push(arrowPath(rg, x, y, w, h));
    } else {
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${opts.grayscale ? '#ddd' : rg.bg ?? accent}" stroke="#111" stroke-width="${line}"/>`);
      if (rg.text) {
        parts.push(`<text x="${x + w / 2}" y="${y + h / 2 + 5}" font-size="14" font-weight="800" text-anchor="middle" fill="#111">${esc(rg.text)}</text>`);
      }
    }
  }

  // Ulkoreuna
  parts.push(`<rect x="${PAD}" y="${y0}" width="${gw}" height="${gh}" fill="none" stroke="#111" stroke-width="${line + 1}"/>`);
  parts.push('</svg>');
  return parts.join('\n');
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function exportSvg(p: Project, opts: ExportOptions) {
  const svg = buildSvg(p, opts);
  download(`${p.name || 'ristikko'}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
}

export async function exportPng(p: Project, opts: ExportOptions, scale = 2): Promise<void> {
  const svg = buildSvg(p, opts);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) download(`${p.name || 'ristikko'}.png`, blob);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('PNG-viennin kuvan lataus epäonnistui'));
    img.src = url;
  });
}

export function exportProjectFile(p: Project) {
  const json = JSON.stringify({ app: 'ristikkostudio', version: 1, project: p }, null, 2);
  download(`${p.name || 'ristikko'}.ristikko.json`, new Blob([json], { type: 'application/json' }));
}

export function parseProjectFile(text: string): Project {
  const data = JSON.parse(text);
  const project = data.project ?? data;
  if (!project.cells || !project.rows || !project.cols) {
    throw new Error('Tiedosto ei ole kelvollinen Ristikkostudio-projekti');
  }
  return project as Project;
}
