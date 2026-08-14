// Kuvien käsittely: isotkin valokuvat pienennetään selaimessa ennen
// tallennusta, jotta projekti mahtuu selaimen paikalliseen tallennustilaan
// (n. 5 Mt) ja pysyy silti tulostuslaatuisena.

/** Pisin sivu pikseleinä tallennuksen jälkeen. Riittää A4-tulostukseen. */
const MAX_EDGE = 1400;
const JPEG_QUALITY = 0.82;

export interface ProcessedImage {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
  bytes: number;
  /** true jos kuvaa pienennettiin alkuperäisestä */
  resized: boolean;
}

export const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/svg+xml';

function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  const b64 = dataUrl.slice(i + 1);
  return Math.round((b64.length * 3) / 4);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Tiedoston lukeminen epäonnistui'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Kuvaa ei voitu avata'));
    img.src = src;
  });
}

/**
 * Lukee ja tarvittaessa pienentää kuvatiedoston. SVG-kuvat säilytetään
 * sellaisenaan, koska ne ovat vektorimuotoisia ja kevyitä.
 */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  const original = await readAsDataUrl(file);
  const name = file.name;

  if (file.type === 'image/svg+xml') {
    return { dataUrl: original, name, width: 0, height: 0, bytes: dataUrlBytes(original), resized: false };
  }

  const img = await loadImage(original);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  // Läpinäkyvyyttä tukevat lähteet pakataan WebP:ksi (tai PNG:ksi, jos
  // selain ei tue WebP-koodausta). JPEG-lähteet pysyvät JPEG:nä.
  const keepsAlpha = file.type === 'image/png' || file.type === 'image/webp';
  let out: string;
  if (keepsAlpha) {
    out = canvas.toDataURL('image/webp', JPEG_QUALITY);
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/png');
  } else {
    out = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  }

  // Jos pakkaus kasvatti tiedostoa (esim. pieni PNG-grafiikka), pidetään alkuperäinen
  if (scale === 1 && dataUrlBytes(out) > dataUrlBytes(original)) {
    return { dataUrl: original, name, width: img.width, height: img.height, bytes: dataUrlBytes(original), resized: false };
  }

  return { dataUrl: out, name, width: w, height: h, bytes: dataUrlBytes(out), resized: scale < 1 };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} t`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kt`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mt`;
}

/** Karkea arvio projektin viemästä tilasta selaimen muistissa. */
export function estimateProjectBytes(images: { dataUrl: string }[]): number {
  let n = 0;
  for (const img of images) n += img.dataUrl.length;
  return n;
}

/** Selaimen localStorage-katto on käytännössä ~5 Mt. */
export const STORAGE_LIMIT = 5 * 1024 * 1024;
