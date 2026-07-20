import React, { useEffect, useRef, useState } from 'react';
import { Dir, Project, Region } from '../../model/types';
import { useStore, Rect } from '../../state/store';
import {
  addCol,
  addRow,
  canPlaceRegion,
  cloneProject,
  findSlot,
  fitWordAt,
  makeCell,
  moveRegion,
  moveRegions,
  movePlacement,
  placementAt,
  placementCells,
  placeWord,
  regionAt,
  removePlacement,
  removeRegion,
  syncRegionCells,
} from '../../logic/grid';
import { uid } from '../../model/types';
import { dndState, dragActive, clearDrag } from '../../state/dnd';
import { fontFamily } from '../../logic/fonts';
import { blockedFill } from '../../model/themes';

export interface GridViewProps {
  project: Project;
  mode: 'editor' | 'preview' | 'answers';
  cellSize: number;
  interactive: boolean;
}

function normRect(a: { r: number; c: number }, b: { r: number; c: number }): Rect {
  return {
    r0: Math.min(a.r, b.r),
    c0: Math.min(a.c, b.c),
    r1: Math.max(a.r, b.r),
    c1: Math.max(a.c, b.c),
  };
}

const ARROW_ORDER = ['right', 'down', 'right-down', 'down-right'] as const;

type MovingState =
  | {
      kind: 'region';
      regionId: string;
      offR: number;
      offC: number;
      w: number;
      h: number;
      transposed: boolean;
      /** Ryhmäsiirto: muut valitut alueet suhteellisine siirtymineen */
      group: { id: string; dr: number; dc: number; w: number; h: number }[];
      cur: { r: number; c: number };
    }
  | {
      kind: 'word';
      placementId: string;
      word: string;
      grabIndex: number;
      dir: Dir;
      cur: { r: number; c: number };
    };

export default function GridView({ project: p, mode, cellSize: S, interactive }: GridViewProps) {
  const { state, mutate, ui, toast } = useStore();
  const { tool, sel, selRect, selRegionId, aiPreview } = state.ui;
  const lw = Math.max(1, p.style.gridLine);
  const [drag, setDrag] = useState<{ start: { r: number; c: number }; cur: { r: number; c: number } } | null>(null);
  const [editingRegion, setEditingRegion] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ regionId: string; startX: number; startY: number; w: number; h: number } | null>(null);
  const [hoverGrid, setHoverGrid] = useState(false);
  const [dndHover, setDndHover] = useState<{ r: number; c: number; dir: Dir } | null>(null);
  const [moving, setMoving] = useState<MovingState | null>(null);
  const movingRef = useRef<MovingState | null>(null);
  movingRef.current = moving;
  /** Projekti ilman siirrettävää sanaa – sopivuustarkistusta varten */
  const moveTempRef = useRef<Project | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Raahauksen päättyessä (myös peruutettaessa) siivotaan esikatselu
  useEffect(() => {
    const onDragEnd = () => setDndHover(null);
    window.addEventListener('dragend', onDragEnd);
    return () => window.removeEventListener('dragend', onDragEnd);
  }, []);

  const showLetters = mode !== 'preview';
  const isEditor = mode === 'editor' && interactive;

  // Maalauksen / valinnan päättäminen
  useEffect(() => {
    if (!drag || !isEditor) return;
    const onUp = () => {
      const rect = normRect(drag.start, drag.cur);
      const single = rect.r0 === rect.r1 && rect.c0 === rect.c1;
      finishDrag(rect, single);
      setDrag(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, isEditor]);

  // Alueen koon muuttaminen kahvasta
  useEffect(() => {
    if (!resizing) return;
    const zoom = state.ui.zoom;
    const onMove = (e: MouseEvent) => {
      const dw = Math.round((e.clientX - resizing.startX) / (S * zoom));
      const dh = Math.round((e.clientY - resizing.startY) / (S * zoom));
      const rg = p.regions.find((r) => r.id === resizing.regionId);
      if (!rg) return;
      const w = Math.max(1, Math.min(p.cols - rg.c, resizing.w + dw));
      const h = Math.max(1, Math.min(p.rows - rg.r, resizing.h + dh));
      if (w !== rg.w || h !== rg.h) {
        mutate((pr) => {
          const n = cloneProject(pr);
          const reg = n.regions.find((r) => r.id === resizing.regionId);
          if (!reg) return pr;
          // Vapauta vanhat ruudut, varaa uudet
          for (let rr = reg.r; rr < reg.r + reg.h; rr++)
            for (let cc = reg.c; cc < reg.c + reg.w; cc++)
              if (n.cells[rr]?.[cc]?.regionId === reg.id) n.cells[rr][cc] = makeCell();
          reg.w = w;
          reg.h = h;
          syncRegionCells(n);
          return n;
        });
      }
    };
    const onUp = () => setResizing(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing, S, p, mutate, state.ui.zoom]);

  function finishDrag(rect: Rect, single: boolean) {
    switch (tool) {
      case 'select':
        if (!single) ui({ selRect: rect });
        break;
      case 'letter':
        mutate((pr) => {
          const n = cloneProject(pr);
          for (let r = rect.r0; r <= rect.r1; r++)
            for (let c = rect.c0; c <= rect.c1; c++) {
              const cell = n.cells[r][c];
              if (cell.regionId) continue;
              n.cells[r][c] = { ...cell, type: 'letter', regionId: undefined };
            }
          return n;
        });
        break;
      case 'blocked':
        mutate((pr) => {
          const n = cloneProject(pr);
          for (let r = rect.r0; r <= rect.r1; r++)
            for (let c = rect.c0; c <= rect.c1; c++) {
              if (n.cells[r][c].regionId) continue;
              n.cells[r][c] = { type: 'blocked', letter: '' };
            }
          return n;
        });
        break;
      case 'eraser':
        mutate((pr) => {
          let n = cloneProject(pr);
          const removed = new Set<string>();
          for (let r = rect.r0; r <= rect.r1; r++)
            for (let c = rect.c0; c <= rect.c1; c++) {
              const id = n.cells[r][c].regionId;
              if (id && !removed.has(id)) {
                removed.add(id);
                n = removeRegion(n, id);
              } else if (!id) {
                n.cells[r][c] = makeCell();
              }
            }
          return n;
        });
        break;
      case 'textClue':
      case 'imageClue':
      case 'decor': {
        const kind = tool === 'textClue' ? 'text' : tool === 'imageClue' ? 'image' : 'decor';
        const regId = uid('reg');
        let blockedByRegion = false;
        mutate((pr) => {
          for (let r = rect.r0; r <= rect.r1; r++)
            for (let c = rect.c0; c <= rect.c1; c++)
              if (pr.cells[r][c].regionId) {
                blockedByRegion = true;
                return pr;
              }
          const n = cloneProject(pr);
          const region: Region = {
            id: regId,
            kind,
            r: rect.r0,
            c: rect.c0,
            w: rect.c1 - rect.c0 + 1,
            h: rect.r1 - rect.r0 + 1,
            text: kind === 'decor' ? '' : undefined,
            fit: kind === 'image' ? 'cover' : undefined,
            arrow: kind !== 'decor' ? { edge: 'right', dir: 'right' } : undefined,
          };
          n.regions.push(region);
          syncRegionCells(n);
          return n;
        });
        if (!blockedByRegion) {
          ui({ selRegionId: regId, sel: { r: rect.r0, c: rect.c0 }, selRect: null });
          if (kind === 'text') setEditingRegion(regId);
        }
        break;
      }
      case 'arrow': {
        const rg = regionAt(p, rect.r0, rect.c0);
        if (rg) {
          mutate((pr) => {
            const n = cloneProject(pr);
            const reg = n.regions.find((r) => r.id === rg.id)!;
            if (!reg.arrow) {
              reg.arrow = { edge: 'right', dir: 'right' };
            } else {
              const idx = ARROW_ORDER.indexOf(reg.arrow.dir);
              if (idx === ARROW_ORDER.length - 1) {
                reg.arrow = undefined;
              } else {
                const dir = ARROW_ORDER[idx + 1];
                reg.arrow = { edge: dir.startsWith('down') ? 'bottom' : 'right', dir };
              }
            }
            return n;
          });
        }
        break;
      }
    }
  }

  function onCellMouseDown(e: React.MouseEvent, r: number, c: number) {
    if (!isEditor || e.button === 2) return;
    e.preventDefault();
    const rg = regionAt(p, r, c);
    // Ctrl/Cmd-klikkaus lisää alueen monivalintaan tai poistaa siitä
    if (rg && (e.ctrlKey || e.metaKey) && (tool === 'select' || tool === 'move')) {
      const set = new Set(state.ui.selRegionIds.length ? state.ui.selRegionIds : selRegionId ? [selRegionId] : []);
      if (set.has(rg.id)) set.delete(rg.id);
      else set.add(rg.id);
      const ids = [...set];
      ui({
        sel: { r, c },
        selRect: null,
        selRegionId: ids.length ? (set.has(rg.id) ? rg.id : ids[ids.length - 1]) : null,
        selRegionIds: ids,
        aiPreview: null,
      });
      return;
    }
    if (tool === 'move') {
      if (rg) {
        // Jos tartuttu alue kuuluu monivalintaan, siirretään koko ryhmä
        const multi = state.ui.selRegionIds.length > 1 && state.ui.selRegionIds.includes(rg.id);
        const group = multi
          ? state.ui.selRegionIds
              .filter((id) => id !== rg.id)
              .map((id) => {
                const g = p.regions.find((x) => x.id === id);
                return g ? { id, dr: g.r - rg.r, dc: g.c - rg.c, w: g.w, h: g.h } : null;
              })
              .filter((g): g is { id: string; dr: number; dc: number; w: number; h: number } => !!g)
          : [];
        ui({
          sel: { r, c },
          selRegionId: rg.id,
          selRegionIds: multi ? state.ui.selRegionIds : [rg.id],
          selRect: null,
        });
        setMoving({
          kind: 'region',
          regionId: rg.id,
          offR: r - rg.r,
          offC: c - rg.c,
          w: rg.w,
          h: rg.h,
          transposed: false,
          group,
          cur: { r, c },
        });
        return;
      }
      const pl = placementAt(p, r, c);
      if (pl) {
        const entry = p.entries.find((en) => en.id === pl.entryId);
        if (entry) {
          moveTempRef.current = removePlacement(p, pl.id);
          ui({ sel: { r, c }, selRegionId: null, selRect: null, dirPref: pl.dir });
          setMoving({
            kind: 'word',
            placementId: pl.id,
            word: entry.answer.toUpperCase(),
            grabIndex: pl.dir === 'across' ? c - pl.c : r - pl.r,
            dir: pl.dir,
            cur: { r, c },
          });
          return;
        }
      }
      ui({ sel: { r, c }, selRegionId: null, selRect: null });
      return;
    }
    if (tool === 'select') {
      if (e.shiftKey && sel) {
        ui({ selRect: normRect(sel, { r, c }) });
        return;
      }
      const sameCell = sel?.r === r && sel?.c === c;
      ui({
        sel: { r, c },
        selRegionId: rg?.id ?? null,
        selRect: null,
        dirPref: sameCell ? (state.ui.dirPref === 'across' ? 'down' : 'across') : state.ui.dirPref,
        aiPreview: null,
      });
    } else {
      ui({ sel: { r, c }, selRegionId: rg?.id ?? null, selRect: null });
    }
    setDrag({ start: { r, c }, cur: { r, c } });
  }

  function onCellEnter(r: number, c: number) {
    if (!drag) return;
    setDrag((d) => (d ? { ...d, cur: { r, c } } : d));
    if (tool === 'select') {
      const rect = normRect(drag.start, { r, c });
      if (rect.r0 !== rect.r1 || rect.c0 !== rect.c1) ui({ selRect: rect });
    }
  }

  // Kaksoisklikkaus kirjainruudussa valitsee koko sanan
  function onCellDoubleClick(r: number, c: number) {
    if (!isEditor) return;
    if (cellAtType(r, c) !== 'letter') return;
    const slot =
      findSlot(p, r, c, state.ui.dirPref) ??
      findSlot(p, r, c, state.ui.dirPref === 'across' ? 'down' : 'across');
    if (!slot) return;
    ui({
      sel: { r, c },
      selRegionId: null,
      selRect: {
        r0: slot.r,
        c0: slot.c,
        r1: slot.dir === 'down' ? slot.r + slot.length - 1 : slot.r,
        c1: slot.dir === 'across' ? slot.c + slot.length - 1 : slot.c,
      },
      dirPref: slot.dir,
    });
  }

  function cellAtType(r: number, c: number) {
    return p.cells[r]?.[c]?.type;
  }

  function onCellContext(e: React.MouseEvent, r: number, c: number) {
    if (!isEditor) return;
    e.preventDefault();
    e.stopPropagation();
    const rg = regionAt(p, r, c);
    ui({ ctxMenu: { x: e.clientX, y: e.clientY, r, c }, sel: { r, c }, selRegionId: rg?.id ?? null });
  }

  function onRegionDblClick(rg: Region) {
    if (!isEditor) return;
    if (rg.kind === 'image') {
      ui({ selRegionId: rg.id });
      document.getElementById(`region-img-input-${rg.id}`)?.click();
    } else {
      setEditingRegion(rg.id);
    }
  }

  /** Siirrettävän alueen kohderuutu (vasen yläkulma) tartuntapisteen mukaan. */
  function regionTargetPos(m: Extract<MovingState, { kind: 'region' }>) {
    const w = m.transposed ? m.h : m.w;
    const h = m.transposed ? m.w : m.h;
    const offR = Math.min(m.offR, h - 1);
    const offC = Math.min(m.offC, w - 1);
    return {
      r: Math.max(0, Math.min(p.rows - h, m.cur.r - offR)),
      c: Math.max(0, Math.min(p.cols - w, m.cur.c - offC)),
      w,
      h,
    };
  }

  /** Siirrettävän sanan alkuruutu niin, että tartuttu kirjain pysyy kursorin alla. */
  function wordTargetPos(m: Extract<MovingState, { kind: 'word' }>) {
    const len = m.word.length;
    const r =
      m.dir === 'down'
        ? Math.max(0, Math.min(p.rows - len, m.cur.r - m.grabIndex))
        : m.cur.r;
    const c =
      m.dir === 'across'
        ? Math.max(0, Math.min(p.cols - len, m.cur.c - m.grabIndex))
        : m.cur.c;
    return { r, c };
  }

  function commitMove(m: MovingState) {
    if (m.kind === 'region') {
      const t = regionTargetPos(m);
      const rg = p.regions.find((x) => x.id === m.regionId);
      if (!rg) return;
      if (t.r === rg.r && t.c === rg.c && !m.transposed) return;
      if (m.group.length) {
        // Ryhmäsiirto: kaikki valitut alueet samalla siirtymällä
        const moves = [
          { id: m.regionId, r: t.r, c: t.c },
          ...m.group.map((g) => ({ id: g.id, r: t.r + g.dr, c: t.c + g.dc })),
        ];
        const res = moveRegions(p, moves);
        if (res) {
          mutate(() => res);
          ui({
            sel: { r: t.r, c: t.c },
            selRegionId: m.regionId,
            selRegionIds: moves.map((mv) => mv.id),
            selRect: null,
          });
          toast(`${moves.length} aluetta siirretty – kumoa halutessasi (Ctrl+Z)`);
        } else {
          toast('Alueet eivät mahdu tähän kohtaan – kokeile toista paikkaa');
        }
        return;
      }
      const res = moveRegion(p, m.regionId, t.r, t.c, m.transposed);
      if (res) {
        mutate(() => res);
        ui({ sel: { r: t.r, c: t.c }, selRegionId: m.regionId, selRect: null });
      } else {
        toast('Alue ei mahdu tähän kohtaan – kokeile toista paikkaa');
      }
    } else {
      const t = wordTargetPos(m);
      const pl = p.placements.find((x) => x.id === m.placementId);
      if (!pl) return;
      if (t.r === pl.r && t.c === pl.c && m.dir === pl.dir) return;
      const res = movePlacement(p, m.placementId, t.r, t.c, m.dir);
      if (res) {
        mutate(() => res);
        ui({ sel: { r: t.r, c: t.c }, selRect: null, selRegionId: null, dirPref: m.dir });
        toast('Sana siirretty – kumoa halutessasi (Ctrl+Z)');
      } else {
        toast('Sana ei sovi tähän kohtaan – risteyskirjaimet eivät täsmää');
      }
    }
  }

  // Siirtotyökalun raahaus: seurataan hiirtä, R kääntää, Esc peruu
  useEffect(() => {
    if (!moving) return;
    const zoom = state.ui.zoom;
    const cellFromEvent = (e: MouseEvent) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return {
        r: Math.max(0, Math.min(p.rows - 1, Math.floor((e.clientY - rect.top) / (S * zoom)))),
        c: Math.max(0, Math.min(p.cols - 1, Math.floor((e.clientX - rect.left) / (S * zoom)))),
      };
    };
    const onMove = (e: MouseEvent) => {
      const cur = cellFromEvent(e);
      if (!cur) return;
      setMoving((m) => (m && (m.cur.r !== cur.r || m.cur.c !== cur.c) ? { ...m, cur } : m));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setMoving((m) => {
          if (!m) return m;
          // Ryhmäsiirrossa kääntö ohitetaan – suhteelliset sijainnit säilyvät
          if (m.kind === 'region') return m.group.length ? m : { ...m, transposed: !m.transposed };
          return { ...m, dir: m.dir === 'across' ? 'down' : 'across', grabIndex: 0 };
        });
      } else if (e.key === 'Escape') {
        moveTempRef.current = null;
        setMoving(null);
      }
    };
    const onUp = () => {
      const m = movingRef.current;
      if (m) commitMove(m);
      moveTempRef.current = null;
      setMoving(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!moving, p, S, state.ui.zoom]);

  // Raahaus ruudun päälle: sana, työkalu tai kuva
  function onCellDragOver(e: React.DragEvent, r: number, c: number) {
    if (!isEditor || !dragActive()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const dir: Dir = e.shiftKey ? 'down' : 'across';
    if (!dndHover || dndHover.r !== r || dndHover.c !== c || dndHover.dir !== dir) {
      setDndHover({ r, c, dir });
    }
  }

  // Pudotus ruutuun
  function onCellDrop(e: React.DragEvent, r: number, c: number) {
    if (!isEditor || !dragActive()) return;
    e.preventDefault();
    setDndHover(null);
    const dir: Dir = e.shiftKey ? 'down' : 'across';

    if (dndState.word) {
      const entry = dndState.word;
      const fit = fitWordAt(p, entry.answer, r, c, dir);
      if (fit < 0) {
        toast(`${entry.answer} ei mahdu tähän ${dir === 'across' ? 'vaakasuunnassa' : 'pystysuunnassa'} – kokeile toista kohtaa (Shift = pystysuunta)`);
      } else {
        mutate((pr) => {
          let n = pr;
          for (const pl of pr.placements.filter((x) => x.entryId === entry.id)) {
            n = removePlacement(n, pl.id);
          }
          return placeWord(n, entry, r, c, dir);
        });
        ui({ sel: { r, c }, selRect: null, selRegionId: null, dirPref: dir });
        toast(`${entry.answer} sijoitettu – kumoa halutessasi (Ctrl+Z)`);
      }
    } else if (dndState.tool) {
      const t = dndState.tool;
      if (p.cells[r][c].regionId) {
        toast('Ruudussa on jo alue – poista se ensin');
      } else if (t === 'blocked') {
        mutate((pr) => {
          const n = cloneProject(pr);
          n.cells[r][c] = { type: 'blocked', letter: '' };
          return n;
        });
      } else {
        const regId = uid('reg');
        mutate((pr) => {
          const n = cloneProject(pr);
          n.regions.push({
            id: regId,
            kind: t,
            r,
            c,
            w: 1,
            h: 1,
            arrow: t !== 'decor' ? { edge: 'right', dir: 'right' } : undefined,
            fit: t === 'image' ? 'cover' : undefined,
          });
          syncRegionCells(n);
          return n;
        });
        ui({ selRegionId: regId, sel: { r, c }, selRect: null });
      }
    } else if (dndState.imageId) {
      const assetId = dndState.imageId;
      const existing = regionAt(p, r, c);
      if (existing) {
        // Pudotus olemassa olevaan alueeseen hoidetaan alueen omassa käsittelijässä
      } else {
        const regId = uid('reg');
        mutate((pr) => {
          const n = cloneProject(pr);
          n.regions.push({
            id: regId,
            kind: 'image',
            r,
            c,
            w: 1,
            h: 1,
            imageId: assetId,
            fit: 'cover',
            arrow: { edge: 'right', dir: 'right' },
          });
          const img = n.images.find((i) => i.id === assetId);
          if (img) img.usedAt = Date.now();
          syncRegionCells(n);
          return n;
        });
        ui({ selRegionId: regId, sel: { r, c }, selRect: null });
        toast('Kuvavihje luotu – venytä aluetta kahvasta tarvittaessa');
      }
    }
    clearDrag();
  }

  // Raahaus kuvapaneelista alueelle
  function onRegionDrop(e: React.DragEvent, rg: Region) {
    const assetId = e.dataTransfer.getData('ristikkostudio/image-id') || dndState.imageId;
    if (!assetId) return;
    e.preventDefault();
    e.stopPropagation();
    setDndHover(null);
    clearDrag();
    mutate((pr) => {
      const n = cloneProject(pr);
      const reg = n.regions.find((r) => r.id === rg.id);
      if (reg) {
        if (reg.kind !== 'image') reg.kind = 'image';
        reg.imageId = assetId;
        const img = n.images.find((i) => i.id === assetId);
        if (img) img.usedAt = Date.now();
        syncRegionCells(n);
      }
      return n;
    });
  }

  // Kirjoitussuunnan mukainen sanajono korostetaan kevyesti
  const slotCells = new Set<string>();
  if (isEditor && sel && !selRegionId && (tool === 'select' || tool === 'letter' || tool === 'move')) {
    const slot = findSlot(p, sel.r, sel.c, state.ui.dirPref);
    if (slot) {
      for (let i = 0; i < slot.length; i++) {
        slotCells.add(
          slot.dir === 'across' ? `${slot.r},${slot.c + i}` : `${slot.r + i},${slot.c}`
        );
      }
    }
  }

  const movingWordCells = new Set<string>();
  if (moving?.kind === 'word') {
    const pl = p.placements.find((x) => x.id === moving.placementId);
    if (pl) for (const pc of placementCells(pl)) movingWordCells.add(`${pc.r},${pc.c}`);
  }

  const dragRect = drag && tool !== 'select' ? normRect(drag.start, drag.cur) : null;
  const previewByCell = new Map<string, string>();
  if (aiPreview) for (const c of aiPreview.cells) previewByCell.set(`${c.r},${c.c}`, c.letter);

  const gridW = p.cols * S + lw;
  const gridH = p.rows * S + lw;
  const gridFont = fontFamily(p.style.font);

  return (
    <div
      ref={wrapRef}
      className={`grid-wrap ${isEditor ? 'editor' : 'static'} tool-${tool}`}
      style={{ width: gridW, height: gridH, fontFamily: gridFont, ['--line' as string]: p.style.gridLineColor }}
      onMouseEnter={() => setHoverGrid(true)}
      onMouseLeave={() => setHoverGrid(false)}
    >
      {/* Ruudut */}
      {p.cells.map((row, r) =>
        row.map((cell, c) => {
          const key = `${r}-${c}`;
          const x = c * S;
          const y = r * S;
          const inSelRect =
            selRect && r >= selRect.r0 && r <= selRect.r1 && c >= selRect.c0 && c <= selRect.c1;
          const isSel = sel?.r === r && sel?.c === c;
          const previewLetter = previewByCell.get(`${r},${c}`);
          const cls = ['cell', `cell-${cell.type}`];
          if (isSel && isEditor) cls.push('cell-selected');
          if (inSelRect && isEditor) cls.push('cell-in-rect');
          if (dragRect && r >= dragRect.r0 && r <= dragRect.r1 && c >= dragRect.c0 && c <= dragRect.c1)
            cls.push('cell-drag-target');
          if (cell.locked) cls.push('cell-locked');
          if (movingWordCells.has(`${r},${c}`)) cls.push('cell-moving');
          if (slotCells.has(`${r},${c}`) && !isSel) cls.push('cell-in-slot');
          if (mode !== 'editor' && cell.type === 'empty') cls.push('cell-invisible');
          const style: React.CSSProperties = {
            left: x,
            top: y,
            width: S + lw,
            height: S + lw,
            borderWidth: cell.type === 'empty' ? 1 : lw,
          };
          if (cell.type === 'letter') style.background = p.style.cellBg;
          if (p.style.cornerRadius > 0 && (cell.type === 'letter' || cell.type === 'blocked')) {
            style.borderRadius = p.style.cornerRadius;
          }
          if (cell.type === 'blocked') {
            const bf = blockedFill(p.style);
            if (bf === 'hatch') {
              style.background = `repeating-linear-gradient(45deg, #fff 0 3px, ${p.style.gridLineColor} 3px 5px)`;
              style.borderColor = p.style.gridLineColor;
            } else {
              style.background = bf;
              style.borderColor = bf;
            }
          }
          return (
            <div
              key={key}
              className={cls.join(' ')}
              style={style}
              onMouseDown={(e) => onCellMouseDown(e, r, c)}
              onMouseEnter={() => onCellEnter(r, c)}
              onContextMenu={(e) => onCellContext(e, r, c)}
              onDragOver={(e) => onCellDragOver(e, r, c)}
              onDrop={(e) => onCellDrop(e, r, c)}
              onDoubleClick={() => onCellDoubleClick(r, c)}
              role={isEditor ? 'gridcell' : undefined}
              aria-selected={isEditor ? isSel : undefined}
              data-rc={key}
            >
              {cell.type === 'letter' && showLetters && !previewLetter && (
                <span className="cell-letter" style={{ fontSize: S * 0.52 }}>
                  {cell.letter}
                </span>
              )}
              {cell.type === 'letter' && previewLetter && (
                <span className="cell-letter ai-preview-letter" style={{ fontSize: S * 0.52 }}>
                  {previewLetter}
                </span>
              )}
              {cell.locked && isEditor && <span className="lock-badge" title="Lukittu">🔒</span>}
            </div>
          );
        })
      )}

      {/* Alueet: vihjeet, kuvat, koristeet */}
      {p.regions.map((rg) => {
        const x = rg.c * S;
        const y = rg.r * S;
        const w = rg.w * S + lw;
        const h = rg.h * S + lw;
        const selected = (selRegionId === rg.id || state.ui.selRegionIds.includes(rg.id)) && isEditor;
        const soloSelected = selected && state.ui.selRegionIds.length <= 1;
        const img = rg.imageId ? p.images.find((i) => i.id === rg.imageId) : undefined;
        const editing = editingRegion === rg.id;
        return (
          <div
            key={rg.id}
            className={`region region-${rg.kind} ${selected ? 'region-selected' : ''} ${
              moving?.kind === 'region' && moving.regionId === rg.id ? 'region-moving' : ''
            }`}
            style={{
              left: x,
              top: y,
              width: w,
              height: h,
              borderWidth: lw,
              borderRadius: p.style.cornerRadius > 0 ? p.style.cornerRadius : undefined,
              background:
                rg.kind === 'text'
                  ? rg.bg ?? p.style.clueBg
                  : rg.kind === 'decor'
                    ? rg.bg ?? p.style.accent
                    : '#fff',
            }}
            onMouseDown={(e) => onCellMouseDown(e, rg.r, rg.c)}
            onDoubleClick={() => onRegionDblClick(rg)}
            onContextMenu={(e) => onCellContext(e, rg.r, rg.c)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onRegionDrop(e, rg)}
            title={rg.kind === 'text' ? 'Vihjealue – kaksoisklikkaa muokataksesi' : rg.kind === 'image' ? 'Kuvavihje' : 'Koristealue'}
          >
            {rg.kind === 'image' &&
              (img ? (
                <img
                  src={img.dataUrl}
                  alt={img.alt}
                  className="region-img"
                  draggable={false}
                  style={{
                    objectFit: rg.fit ?? 'cover',
                    transform: rg.imageZoom ? `scale(${rg.imageZoom})` : undefined,
                    outline: p.style.imageBorder ? `${lw}px solid #111` : undefined,
                  }}
                />
              ) : (
                <span className="region-img-placeholder">Pudota kuva tähän</span>
              ))}
            {rg.kind !== 'image' && !editing && (
              <span
                className="region-text"
                style={{
                  fontSize: rg.fontSize ?? (rg.kind === 'decor' ? Math.max(11, S * 0.3) : Math.max(7, Math.min(9, S * 0.16))),
                  textAlign: rg.align ?? 'center',
                  fontWeight: rg.kind === 'decor' ? 800 : 600,
                }}
              >
                {rg.text || (isEditor && rg.kind === 'text' ? 'Kaksoisklikkaa…' : '')}
              </span>
            )}
            {editing && (
              <textarea
                className="region-edit"
                autoFocus
                defaultValue={rg.text ?? ''}
                aria-label="Vihjeteksti"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const text = e.target.value;
                  mutate((pr) => {
                    const n = cloneProject(pr);
                    const reg = n.regions.find((r) => r.id === rg.id);
                    if (reg) reg.text = text;
                    return n;
                  });
                  setEditingRegion(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    (e.target as HTMLTextAreaElement).blur();
                  }
                  if (e.key === 'Escape') setEditingRegion(null);
                }}
              />
            )}
            {/* Suuntanuoli */}
            {rg.arrow && (
              <Arrow
                edge={rg.arrow.edge}
                dir={rg.arrow.dir}
                size={S * ({ S: 0.2, M: 0.28, L: 0.38 }[p.style.arrowSize] ?? 0.28)}
                outline={p.style.arrowStyle === 'outline'}
                color={p.style.gridLineColor}
              />
            )}
            {/* Koonmuutoskahva (vain yksittäisvalinnassa) */}
            {soloSelected && (
              <div
                className="region-handle"
                title="Muuta alueen kokoa vetämällä"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setResizing({ regionId: rg.id, startX: e.clientX, startY: e.clientY, w: rg.w, h: rg.h });
                }}
              />
            )}
            {/* Piilotettu tiedostovalitsin kuvan vaihtoon */}
            {rg.kind === 'image' && isEditor && (
              <input
                id={`region-img-input-${rg.id}`}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = reader.result as string;
                    mutate((pr) => {
                      const n = cloneProject(pr);
                      const assetId = uid('img');
                      n.images.push({ id: assetId, name: file.name, dataUrl, alt: file.name, usedAt: Date.now() });
                      const reg = n.regions.find((r) => r.id === rg.id);
                      if (reg) reg.imageId = assetId;
                      return n;
                    });
                  };
                  reader.readAsDataURL(file);
                }}
              />
            )}
          </div>
        );
      })}

      {/* Raahauksen esikatselu */}
      {dndHover && isEditor && dndState.word && (() => {
        const word = [...dndState.word.answer.toUpperCase()];
        const ok = fitWordAt(p, dndState.word.answer, dndHover.r, dndHover.c, dndHover.dir) >= 0;
        return word.map((ch, i) => {
          const rr = dndHover.dir === 'down' ? dndHover.r + i : dndHover.r;
          const cc = dndHover.dir === 'across' ? dndHover.c + i : dndHover.c;
          if (rr >= p.rows || cc >= p.cols) return null;
          return (
            <div
              key={`ghost-${i}`}
              className={`dnd-ghost ${ok ? 'dnd-ok' : 'dnd-bad'}`}
              style={{ left: cc * S, top: rr * S, width: S + lw, height: S + lw, fontSize: S * 0.5 }}
              aria-hidden
            >
              {ch}
            </div>
          );
        });
      })()}
      {dndHover && isEditor && (dndState.tool || dndState.imageId) && (
        <div
          className="dnd-ghost dnd-ok"
          style={{ left: dndHover.c * S, top: dndHover.r * S, width: S + lw, height: S + lw, fontSize: S * 0.45 }}
          aria-hidden
        >
          {dndState.tool === 'blocked' ? '■' : dndState.tool === 'text' ? '❝' : dndState.tool === 'decor' ? '✦' : '▣'}
        </div>
      )}

      {/* Siirron esikatselu */}
      {moving && isEditor && moving.kind === 'region' && (() => {
        const t = regionTargetPos(moving);
        if (moving.group.length) {
          const moves = [
            { id: moving.regionId, r: t.r, c: t.c, w: t.w, h: t.h },
            ...moving.group.map((g) => ({ id: g.id, r: t.r + g.dr, c: t.c + g.dc, w: g.w, h: g.h })),
          ];
          const ok = moveRegions(p, moves) !== null;
          return moves.map((mv) => (
            <div
              key={`gm-${mv.id}`}
              className={`dnd-ghost ${ok ? 'dnd-ok' : 'dnd-bad'}`}
              style={{ left: mv.c * S, top: mv.r * S, width: mv.w * S + lw, height: mv.h * S + lw, fontSize: S * 0.4 }}
              aria-hidden
            >
              ✥
            </div>
          ));
        }
        const ok = canPlaceRegion(p, moving.regionId, t.r, t.c, t.w, t.h);
        return (
          <div
            className={`dnd-ghost ${ok ? 'dnd-ok' : 'dnd-bad'}`}
            style={{ left: t.c * S, top: t.r * S, width: t.w * S + lw, height: t.h * S + lw, fontSize: S * 0.4 }}
            aria-hidden
          >
            ✥
          </div>
        );
      })()}
      {moving && isEditor && moving.kind === 'word' && (() => {
        const t = wordTargetPos(moving);
        const temp = moveTempRef.current;
        const ok = temp ? fitWordAt(temp, moving.word, t.r, t.c, moving.dir) >= 0 : false;
        return [...moving.word].map((ch, i) => {
          const rr = moving.dir === 'down' ? t.r + i : t.r;
          const cc = moving.dir === 'across' ? t.c + i : t.c;
          if (rr >= p.rows || cc >= p.cols) return null;
          return (
            <div
              key={`mv-${i}`}
              className={`dnd-ghost ${ok ? 'dnd-ok' : 'dnd-bad'}`}
              style={{ left: cc * S, top: rr * S, width: S + lw, height: S + lw, fontSize: S * 0.5 }}
              aria-hidden
            >
              {ch}
            </div>
          );
        });
      })()}

      {/* Valitun ruudun korostus */}
      {sel && isEditor && !selRegionId && (
        <div
          className="sel-outline"
          style={{ left: sel.c * S, top: sel.r * S, width: S + lw, height: S + lw }}
          aria-hidden
        >
          {p.cells[sel.r]?.[sel.c]?.type === 'letter' && (
            <span className="dir-badge" title="Kirjoitussuunta">
              {state.ui.dirPref === 'across' ? '→' : '↓'}
            </span>
          )}
        </div>
      )}

      {/* Plus-painikkeet reunoilla */}
      {isEditor && (
        <div className={`plus-controls ${hoverGrid ? 'visible' : ''}`}>
          <button
            className="plus-btn plus-top"
            style={{ left: gridW / 2 - 14, top: -34 }}
            title="Lisää rivi yläpuolelle"
            onClick={() => mutate((pr) => addRow(pr, 0))}
          >
            +
          </button>
          <button
            className="plus-btn plus-bottom"
            style={{ left: gridW / 2 - 14, top: gridH + 6 }}
            title="Lisää rivi alapuolelle"
            onClick={() => mutate((pr) => addRow(pr, pr.rows))}
          >
            +
          </button>
          <button
            className="plus-btn plus-left"
            style={{ left: -34, top: gridH / 2 - 14 }}
            title="Lisää sarake vasemmalle"
            onClick={() => mutate((pr) => addCol(pr, 0))}
          >
            +
          </button>
          <button
            className="plus-btn plus-right"
            style={{ left: gridW + 6, top: gridH / 2 - 14 }}
            title="Lisää sarake oikealle"
            onClick={() => mutate((pr) => addCol(pr, pr.cols))}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

function Arrow({ edge, dir, size, outline, color }: { edge: 'right' | 'bottom'; dir: string; size: number; outline: boolean; color: string }) {
  const s = Math.max(8, size);
  const fill = outline ? 'none' : color;
  const stroke = color;
  if (edge === 'right') {
    const bend = dir === 'right-down';
    return (
      <svg
        className="region-arrow"
        style={{ right: -s - 2, top: '50%', marginTop: -s / 2 }}
        width={s + 4}
        height={bend ? s * 1.8 : s}
        viewBox={bend ? '0 0 14 24' : '0 0 12 12'}
        aria-hidden
      >
        {bend ? (
          <>
            <path d="M0 4 h8 v10" fill="none" stroke={stroke} strokeWidth="2.4" />
            <path d="M4 13 l4 7 l4 -7 z" fill={fill} stroke={stroke} strokeWidth={outline ? 1.6 : 0} />
          </>
        ) : (
          <path d="M1 1 l10 5 l-10 5 z" fill={fill} stroke={stroke} strokeWidth={outline ? 1.6 : 0} />
        )}
      </svg>
    );
  }
  const bend = dir === 'down-right';
  return (
    <svg
      className="region-arrow"
      style={{ bottom: -s - 2, left: '50%', marginLeft: -s / 2 }}
      width={bend ? s * 1.8 : s}
      height={s + 4}
      viewBox={bend ? '0 0 24 14' : '0 0 12 12'}
      aria-hidden
    >
      {bend ? (
        <>
          <path d="M4 0 v8 h10" fill="none" stroke={stroke} strokeWidth="2.4" />
          <path d="M13 4 l7 4 l-7 4 z" fill={fill} stroke={stroke} strokeWidth={outline ? 1.6 : 0} />
        </>
      ) : (
        <path d="M1 1 l5 10 l5 -10 z" fill={fill} stroke={stroke} strokeWidth={outline ? 1.6 : 0} />
      )}
    </svg>
  );
}
