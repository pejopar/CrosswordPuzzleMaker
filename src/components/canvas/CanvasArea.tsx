import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../state/store';
import GridView from './GridView';
import {
  cloneProject,
  findSlot,
  movePlacement,
  moveRegion,
  placementAt,
  placeWord,
  removeRegion,
  rotatePlacement,
  rotateRegion,
} from '../../logic/grid';
import { suggestFitting } from '../../logic/ai';
import { uid } from '../../model/types';

const PAGE_PX: Record<string, { w: number; h: number }> = {
  A4: { w: 794, h: 1123 },
  A3: { w: 1123, h: 1587 },
  Letter: { w: 816, h: 1056 },
};

const ZOOM_STEPS = [0.4, 0.5, 0.65, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];

export default function CanvasArea() {
  const { state, mutate, ui, toast } = useStore();
  const p = state.project;
  const { zoom, view, sel, selRect, selRegionId } = state.ui;
  const scrollRef = useRef<HTMLDivElement>(null);

  const pageBase = PAGE_PX[p.page.size] ?? PAGE_PX.A4;
  const pageW = p.page.orientation === 'portrait' ? pageBase.w : pageBase.h;
  const pageH = p.page.orientation === 'portrait' ? pageBase.h : pageBase.w;
  const marginPx = Math.round(p.page.margins * 3.78);
  const headerH = p.style.showHeader ? 130 : 24;

  const cellSize = useMemo(() => {
    const availW = pageW - marginPx * 2;
    const availH = pageH - marginPx * 2 - headerH;
    return Math.max(22, Math.min(54, Math.floor(Math.min(availW / p.cols, availH / p.rows))));
  }, [pageW, pageH, marginPx, headerH, p.cols, p.rows]);

  // Näppäimistö: kirjaimet, nuolet, poisto
  useEffect(() => {
    if (view !== 'editor') return;
    const onKey = (e: KeyboardEvent) => {
      if (state.ui.modal || state.ui.ctxMenu) return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      )
        return;
      if (!sel) return;
      const { r, c } = sel;

      const move = (dr: number, dc: number) => {
        const nr = Math.max(0, Math.min(p.rows - 1, r + dr));
        const nc = Math.max(0, Math.min(p.cols - 1, c + dc));
        ui({ sel: { r: nr, c: nc }, selRegionId: p.cells[nr][nc].regionId ?? null, selRect: null });
      };

      // Siirtotyökalulla nuolinäppäimet siirtävät valittua elementtiä ruudun kerrallaan
      const nudge = (dr: number, dc: number): boolean => {
        if (state.ui.tool !== 'move') return false;
        if (selRegionId) {
          const rg = p.regions.find((x) => x.id === selRegionId);
          if (!rg) return false;
          const res = moveRegion(p, selRegionId, rg.r + dr, rg.c + dc);
          if (res) {
            mutate(() => res);
            ui({ sel: { r: rg.r + dr, c: rg.c + dc } });
          } else toast('Alue ei mahdu siihen suuntaan');
          return true;
        }
        const pl = placementAt(p, r, c);
        if (pl) {
          const res = movePlacement(p, pl.id, pl.r + dr, pl.c + dc, pl.dir);
          if (res) {
            mutate(() => res);
            ui({ sel: { r: r + dr, c: c + dc } });
          } else toast('Sana ei sovi siihen suuntaan');
          return true;
        }
        return false;
      };

      if (e.key === 'ArrowRight') { e.preventDefault(); if (!nudge(0, 1)) move(0, 1); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); if (!nudge(0, -1)) move(0, -1); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!nudge(1, 0)) move(1, 0); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (!nudge(-1, 0)) move(-1, 0); return; }

      // R kääntää valitun alueen tai (siirtotyökalulla) sanan – ei varasteta
      // kirjainta, kun kirjainruutuun ollaan kirjoittamassa
      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (selRegionId) {
          e.preventDefault();
          const res = rotateRegion(p, selRegionId);
          if (res) mutate(() => res);
          else toast('Aluetta ei voi kääntää tässä – tilaa ei ole');
          return;
        }
        if (state.ui.tool === 'move') {
          const pl = placementAt(p, r, c);
          if (pl) {
            e.preventDefault();
            const res = rotatePlacement(p, pl.id);
            if (res) {
              mutate(() => res);
              ui({ dirPref: pl.dir === 'across' ? 'down' : 'across' });
              toast('Sanan suunta käännetty');
            } else toast('Sanaa ei voi kääntää tässä – risteykset eivät täsmää');
            return;
          }
        }
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        ui({ dirPref: state.ui.dirPref === 'across' ? 'down' : 'across' });
        return;
      }

      // Enter hyväksyy kirjoituksen ennakoivan sanaehdotuksen
      if (e.key === 'Enter' && state.ui.aiPreview?.apply) {
        e.preventDefault();
        const a = state.ui.aiPreview.apply;
        mutate((pr) =>
          placeWord(
            pr,
            {
              id: uid('e'),
              answer: a.word,
              clue: '',
              difficulty: 2,
              priority: 2,
              required: false,
              notes: 'Pikaehdotus',
            },
            a.r,
            a.c,
            a.dir
          )
        );
        ui({ aiPreview: null });
        toast(`${a.word} sijoitettu – kirjoita vihje Sanat ja vihjeet -paneelissa`);
        return;
      }

      if (/^[a-zåäö]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const letter = e.key.toUpperCase();
        mutate((pr) => {
          const n = cloneProject(pr);
          const cell = n.cells[r][c];
          if (cell.locked || cell.regionId) return pr;
          n.cells[r][c] = { ...cell, type: 'letter', letter, regionId: undefined };
          return n;
        });
        // Ennakoiva sanaehdotus: etsi kuvioon sopiva sana ja näytä se ghostina
        if (state.ui.autoSuggest) {
          const slot = findSlot(p, r, c, state.ui.dirPref);
          if (slot) {
            const idx = state.ui.dirPref === 'across' ? c - slot.c : r - slot.r;
            const pattern = slot.pattern.slice(0, idx) + letter + slot.pattern.slice(idx + 1);
            if (pattern.includes('_')) {
              const { suggestions } = suggestFitting(pattern, {
                theme: p.theme,
                exclude: p.entries.map((en) => en.answer),
                limit: 1,
              });
              const top = suggestions[0];
              if (top) {
                const cells = [...top.word]
                  .map((ch, i) => ({
                    r: slot.dir === 'down' ? slot.r + i : slot.r,
                    c: slot.dir === 'across' ? slot.c + i : slot.c,
                    letter: ch,
                    blank: pattern[i] === '_',
                  }))
                  .filter((x) => x.blank);
                ui({
                  aiPreview: {
                    cells,
                    label: top.word,
                    apply: { word: top.word, r: slot.r, c: slot.c, dir: slot.dir },
                  },
                });
              } else {
                ui({ aiPreview: null });
              }
            } else {
              ui({ aiPreview: null });
            }
          }
        }
        if (state.ui.dirPref === 'across') move(0, 1);
        else move(1, 0);
        return;
      }

      if (e.key === 'Backspace' && !selRect) {
        e.preventDefault();
        mutate((pr) => {
          const n = cloneProject(pr);
          const cell = n.cells[r][c];
          if (cell.type === 'letter' && !cell.locked) n.cells[r][c] = { ...cell, letter: '' };
          return n;
        });
        ui({ aiPreview: null });
        if (state.ui.dirPref === 'across') move(0, -1);
        else move(-1, 0);
        return;
      }

      // Delete ja Backspace tyhjentävät korostetun valinnan
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        ui({ aiPreview: null });
        if (selRegionId) {
          mutate((pr) => removeRegion(pr, selRegionId));
          ui({ selRegionId: null });
        } else if (selRect) {
          mutate((pr) => {
            const n = cloneProject(pr);
            for (let rr = selRect.r0; rr <= selRect.r1; rr++)
              for (let cc = selRect.c0; cc <= selRect.c1; cc++) {
                const cell = n.cells[rr][cc];
                if (cell.type === 'letter' && !cell.locked) n.cells[rr][cc] = { ...cell, letter: '' };
              }
            return n;
          });
        } else {
          mutate((pr) => {
            const n = cloneProject(pr);
            const cell = n.cells[r][c];
            if (cell.type === 'letter' && !cell.locked) n.cells[r][c] = { ...cell, letter: '' };
            return n;
          });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, sel, selRect, selRegionId, p, mutate, ui, toast, state.ui.dirPref, state.ui.modal, state.ui.ctxMenu, state.ui.tool, state.ui.autoSuggest, state.ui.aiPreview]);

  const setZoom = (z: number) => ui({ zoom: Math.max(0.3, Math.min(2.5, z)) });
  const zoomStep = (dir: 1 | -1) => {
    const idx = ZOOM_STEPS.findIndex((z) => z >= zoom - 0.001);
    const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, (idx === -1 ? 5 : idx) + dir))];
    setZoom(next);
  };
  const fitPage = () => {
    const el = scrollRef.current;
    if (!el) return;
    setZoom(Math.min((el.clientWidth - 80) / pageW, (el.clientHeight - 80) / pageH));
  };
  const fitWidth = () => {
    const el = scrollRef.current;
    if (!el) return;
    setZoom((el.clientWidth - 80) / pageW);
  };

  const fontFamily =
    p.style.font === 'serif'
      ? 'Georgia, serif'
      : p.style.font === 'cond'
        ? "'Archivo Black', 'Arial Black', sans-serif"
        : "'Archivo', 'Helvetica Neue', Arial, sans-serif";

  return (
    <main className={`canvas-area view-${view}`} aria-label="Ristikon työtila">
      {view !== 'editor' && (
        <div className="view-banner" role="status">
          {view === 'preview'
            ? 'Esikatselu – ratkojan näkymä ilman vastauksia'
            : 'Ratkaisunäkymä – kaikki vastaukset näkyvissä'}
          <button className="tb-btn" onClick={() => ui({ view: 'editor' })}>
            Takaisin rakennustilaan
          </button>
        </div>
      )}
      <div className="canvas-scroll" ref={scrollRef}>
        <div className="canvas-center" style={{ minWidth: pageW * zoom + 120, minHeight: pageH * zoom + 120 }}>
          <div
            className={`page ${view !== 'editor' ? 'page-clean' : ''}`}
            style={{ width: pageW, height: pageH, transform: `scale(${zoom})`, fontFamily }}
          >
            <div className="page-inner" style={{ padding: marginPx }}>
              {p.style.showHeader && (
                <header className="page-header">
                  <div className="page-title-row">
                    {p.style.logoDataUrl && <img className="page-logo" src={p.style.logoDataUrl} alt="Logo" />}
                    <h1 className="page-title" style={{ background: p.style.accent }}>
                      {p.style.title || 'NIMETÖN RISTIKKO'}
                    </h1>
                  </div>
                  {p.style.author && <div className="page-author">{p.style.author}</div>}
                  {p.style.intro && <p className="page-intro">{p.style.intro}</p>}
                </header>
              )}
              <div className="page-grid-holder">
                <GridView project={p} mode={view} cellSize={cellSize} interactive={view === 'editor'} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="zoom-bar" role="group" aria-label="Zoomaus">
        <button className="tb-btn icon" onClick={() => zoomStep(-1)} title="Loitonna" aria-label="Loitonna">
          −
        </button>
        <span className="zoom-value">{Math.round(zoom * 100)} %</span>
        <button className="tb-btn icon" onClick={() => zoomStep(1)} title="Lähennä" aria-label="Lähennä">
          +
        </button>
        <button className="tb-btn" onClick={fitPage} title="Sovita koko sivu näkyviin">
          Sovita sivu
        </button>
        <button className="tb-btn" onClick={fitWidth} title="Sovita sivun leveys">
          Sovita leveys
        </button>
      </div>
    </main>
  );
}
