// Jaettu raahaustila. HTML5-raahauksen aikana dataTransferin sisältöä ei voi
// lukea dragover-vaiheessa, joten aktiivinen hyöty­kuorma pidetään täällä,
// jotta ruudukko voi näyttää esikatselun ennen pudotusta.

import { WordEntry } from '../model/types';

export type DragTool = 'text' | 'image' | 'blocked' | 'decor';

export interface DragPayload {
  word?: WordEntry;
  tool?: DragTool;
  imageId?: string;
}

export const dndState: DragPayload = {};

export function startDrag(payload: DragPayload) {
  dndState.word = payload.word;
  dndState.tool = payload.tool;
  dndState.imageId = payload.imageId;
}

export function clearDrag() {
  dndState.word = undefined;
  dndState.tool = undefined;
  dndState.imageId = undefined;
}

export function dragActive(): boolean {
  return !!(dndState.word || dndState.tool || dndState.imageId);
}
