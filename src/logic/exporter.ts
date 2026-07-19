import { Project, Region } from '../model/types';

export interface ExportOptions {
  showSolution: boolean;
  grayscale: boolean;
  includeTitle: boolean;
  includeIntro: boolean;
  includeAuthor: boolean;
  bleed?: boolean;
  cropMarks?: boolean;
  pageNumber?: number;
}

const CELL = 48;
const PAD = 40;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Rivittää tekstin annettuun merkkileveyteen ja tavuttaa liian pitkät sanat. */
function wrapText(text: string, maxChars: number): string[] {
  const safeMax = Math.max(3, maxChars);
  const words: string[] = [];
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    let w = raw;
    while (w.length > safeMax) {
      words.push(w.slice(0, safeMax - 1) + '-');
      w = w.slice(safeMax - 1);
    }
    words.push(w);
  }
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > safeMax && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Sovittaa tekstin laatikkoon: pienentää fonttia kunnes rivit mahtuvat. */
function fitText(
  text: string,
  boxW: number,
  boxH: number,
  baseFs: number
): { fs: number; lines: string[]; lineH: number } {
  for (let fs = baseFs; fs >= 5.5; fs -= 0.5) {
    const lineH = fs * 1.22;
    const maxChars = Math.floor((boxW - 5) / (fs * 0.56));
    const maxLines = Math.max(1, Math.floor((boxH - 4) / lineH));
    const lines = wrapText(text, maxChars);
    const widest = Math.max(0, ...lines.map((l) => l.length));
    if (lines.length <= maxLines && widest <= maxChars) {
      return { fs, lines, lineH };
    }
  }
  const fs = 5.5;
  const lineH = fs * 1.22;
  const maxChars = Math.floor((boxW - 5) / (fs * 0.56));
  const maxLines = Math.max(1, Math.floor((boxH - 4) / lineH));
  return { fs, lines: wrapText(text, maxChars).slice(0, maxLines), lineH };
}

function arrowSvg(rg: Region, x: number, y: number, w: number, h: number, outline: boolean): string {
  if (!rg.arrow) return '';
  const s = 7;
  const fill = outline ? '#fff' : '#111';
  const stroke = outline ? ' stroke="#111" stroke-width="1.4"' : '';
  if (rg.arrow.edge === 'right') {
    const ax = x + w;
    const ay = y + h / 2;
    if (rg.arrow.dir === 'right-down') {
      return (
        `<path d="M ${ax} ${ay - 4} h 9 v 9" fill="none" stroke="#111" stroke-width="2.2"/>` +
        `<path d="M ${ax + 9 - s / 2} ${ay + 4} l ${s / 2} ${s} l ${s / 2} -${s} z" fill="${fill}"${stroke}/>`
      );
    }
    return `<path d="M ${ax - 1} ${ay - s / 2} l ${s + 2} ${s / 2} l -${s + 2} ${s / 2} z" fill="${fill}"${stroke}/>`;
  }
  const ax = x + w / 2;
  const ay = y + h;
  if (rg.arrow.dir === 'down-right') {
    return (
      `<path d="M ${ax - 4} ${ay} v 9 h 9" fill="none" stroke="#111" stroke-width="2.2"/>` +
      `<path d="M ${ax + 4} ${ay + 9 - s / 2} l ${s} ${s / 2} l -${s} ${s / 2} z" fill="${fill}"${stroke}/>`
    );
  }
  return `<path d="M ${ax - s / 2} ${ay - 1} l ${s / 2} ${s + 2} l ${s / 2} -${s + 2} z" fill="${fill}"${stroke}/>`;
}

/** Rakentaa tulostuskelpoisen SVG-esityksen ristikosta. */
export function buildSvg(p: Project, opts: ExportOptions): string {
  const gw = p.cols * CELL;
  const gh = p.rows * CELL;
  const line = Math.max(1, p.style.gridLine);
  const accent = opts.grayscale ? '#c8c8c8' : p.style.accent;
  const clueBg = opts.grayscale ? '#efefef' : p.style.clueBg;
  const outlineArrows = p.style.arrowStyle === 'outline';

  // Otsikkoalueen korkeus lasketaan sisällöstä
  const introLines = opts.includeIntro && p.style.intro ? wrapText(p.style.intro, Math.floor(gw / 6.4)).slice(0, 4) : [];
  const titleH = opts.includeTitle && p.style.title ? 50 : 0;
  const authorH = opts.includeTitle && opts.includeAuthor && p.style.author ? 17 : 0;
  const introH = introLines.length * 14 + (introLines.length ? 4 : 0);
  const headerH = titleH + authorH + introH + (titleH || authorH || introH ? 14 : 0);

  const bleedPx = opts.bleed ? 14 : 0;
  const markPx = opts.cropMarks ? 18 : 0;
  const off = bleedPx + markPx; // sisällön siirtymä
  const footerH = opts.pageNumber ? 24 : 0;
  const W = gw + PAD * 2 + off * 2;
  const H = gh + PAD * 2 + headerH + footerH + off * 2;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Archivo, Helvetica, Arial, sans-serif">`
  );
  parts.push(`<rect width="${W}" height="${H}" fill="#FFFDF7"/>`);

  // Leikkuumerkit trimmilaatikon kulmiin
  if (opts.cropMarks) {
    const t = markPx;
    const L = 12;
    const x0 = t, y0 = t, x1 = W - t, y1 = H - t;
    const mark = (x: number, y: number, dx: number, dy: number) =>
      `<path d="M ${x + dx * L} ${y} h ${-dx * L} v ${dy * L}" fill="none" stroke="#111" stroke-width="1"/>`;
    parts.push(mark(x0, y0, 1, 1), mark(x1, y0, -1, 1), mark(x0, y1, 1, -1), mark(x1, y1, -1, -1));
  }

  const cx = PAD + off; // sisällön vasen reuna
  let y0 = PAD + off;

  if (titleH) {
    const title = p.style.title;
    const barW = Math.min(gw, Math.round(title.length * 19.5 + 28));
    parts.push(`<rect x="${cx}" y="${y0}" width="${barW}" height="44" fill="${accent}"/>`);
    parts.push(
      `<text x="${cx + 14}" y="${y0 + 31}" font-size="28" font-weight="800" letter-spacing="0.5" fill="#111">${esc(title)}</text>`
    );
    y0 += 50;
  }
  if (authorH) {
    parts.push(`<text x="${cx}" y="${y0 + 11}" font-size="11.5" font-weight="700" fill="#555">${esc(p.style.author)}</text>`);
    y0 += 17;
  }
  for (const ln of introLines) {
    parts.push(`<text x="${cx}" y="${y0 + 11}" font-size="11" fill="#333">${esc(ln)}</text>`);
    y0 += 14;
  }
  if (headerH) y0 += 14;

  const imgById = new Map(p.images.map((i) => [i.id, i]));

  // Ruudut
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      const cell = p.cells[r][c];
      const x = cx + c * CELL;
      const y = y0 + r * CELL;
      if (cell.type === 'empty') continue;
      if (cell.type === 'blocked') {
        parts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${opts.grayscale ? '#222' : '#17151a'}"/>`);
        continue;
      }
      if (cell.type === 'letter') {
        parts.push(
          `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${opts.grayscale ? '#fff' : p.style.cellBg}" stroke="#111" stroke-width="${line}"/>`
        );
        if (opts.showSolution && cell.letter) {
          parts.push(
            `<text x="${x + CELL / 2}" y="${y + CELL / 2 + 9}" font-size="25" font-weight="700" text-anchor="middle" fill="#111">${esc(cell.letter)}</text>`
          );
        }
      }
    }
  }

  // Alueet (vihjeet, kuvat, koristeet)
  for (const rg of p.regions) {
    const x = cx + rg.c * CELL;
    const y = y0 + rg.r * CELL;
    const w = rg.w * CELL;
    const h = rg.h * CELL;
    if (rg.kind === 'text') {
      parts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${rg.bg && !opts.grayscale ? rg.bg : clueBg}" stroke="#111" stroke-width="${line}"/>`
      );
      const { fs, lines, lineH } = fitText(rg.text ?? '', w, h, rg.fontSize ?? 9);
      const blockH = lines.length * lineH;
      const startY = y + (h - blockH) / 2 + lineH * 0.78;
      lines.forEach((ln, i) => {
        parts.push(
          `<text x="${x + w / 2}" y="${(startY + i * lineH).toFixed(1)}" font-size="${fs}" font-weight="600" text-anchor="middle" fill="#111">${esc(ln)}</text>`
        );
      });
      parts.push(arrowSvg(rg, x, y, w, h, outlineArrows));
    } else if (rg.kind === 'image') {
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#111" stroke-width="${line}"/>`);
      const img = rg.imageId ? imgById.get(rg.imageId) : undefined;
      if (img) {
        // clipPath rajaa kuvan alueen sisään (myös zoomattuna)
        const iw = w - 2;
        const ih = h - 2;
        const ix = x + 1;
        const iy = y + 1;
        const zoom = rg.imageZoom ?? 1;
        const par = rg.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';
        const clipId = `clip-${rg.id}`;
        const cxm = ix + iw / 2;
        const cym = iy + ih / 2;
        parts.push(
          `<clipPath id="${clipId}"><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}"/></clipPath>` +
            `<g clip-path="url(#${clipId})"` +
            (zoom !== 1 ? ` transform="translate(${cxm} ${cym}) scale(${zoom}) translate(${-cxm} ${-cym})"` : '') +
            `>` +
            `<image href="${img.dataUrl}" x="${ix}" y="${iy}" width="${iw}" height="${ih}" preserveAspectRatio="${par}"/>` +
            `</g>`
        );
      } else {
        parts.push(`<text x="${x + w / 2}" y="${y + h / 2 + 3}" font-size="10" text-anchor="middle" fill="#888">KUVA</text>`);
      }
      if (p.style.imageBorder) {
        parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#111" stroke-width="${line + 1}"/>`);
      }
      parts.push(arrowSvg(rg, x, y, w, h, outlineArrows));
    } else {
      parts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${opts.grayscale ? '#ddd' : rg.bg ?? accent}" stroke="#111" stroke-width="${line}"/>`
      );
      if (rg.text) {
        const fs = Math.min(15, h * 0.32, (w - 8) / Math.max(1, rg.text.length) / 0.62);
        parts.push(
          `<text x="${x + w / 2}" y="${y + h / 2 + fs * 0.36}" font-size="${fs.toFixed(1)}" font-weight="800" text-anchor="middle" fill="#111">${esc(rg.text)}</text>`
        );
      }
    }
  }

  // Ulkoreuna
  parts.push(`<rect x="${cx}" y="${y0}" width="${gw}" height="${gh}" fill="none" stroke="#111" stroke-width="${line + 1}"/>`);

  // Sivunumero
  if (opts.pageNumber) {
    parts.push(
      `<text x="${W / 2}" y="${H - off - 8}" font-size="10" text-anchor="middle" fill="#555">${opts.pageNumber}</text>`
    );
  }

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
