import { FontId } from '../model/types';

export const FONTS: { id: FontId; label: string; family: string }[] = [
  { id: 'sans', label: 'Moderni sans (Archivo)', family: "'Archivo', 'Helvetica Neue', Arial, sans-serif" },
  { id: 'cond', label: 'Paksu display (Archivo Black)', family: "'Archivo Black', 'Arial Black', sans-serif" },
  { id: 'serif', label: 'Klassinen serif (Playfair Display)', family: "'Playfair Display', Georgia, serif" },
  { id: 'slab', label: 'Slab-egyptienne (Roboto Slab)', family: "'Roboto Slab', Georgia, serif" },
  { id: 'rounded', label: 'Pyöreä ja ystävällinen (Quicksand)', family: "'Quicksand', 'Trebuchet MS', sans-serif" },
  { id: 'mono', label: 'Kirjoituskone (Space Mono)', family: "'Space Mono', 'Courier New', monospace" },
];

export function fontFamily(id: string): string {
  return FONTS.find((f) => f.id === id)?.family ?? FONTS[0].family;
}
