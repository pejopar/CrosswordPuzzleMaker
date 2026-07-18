import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../state/store';
import GridView from './GridView';
import { cloneProject, removeRegion } from '../../logic/grid';

const PAGE_PX: Record<string, { w: number; h: number }> = {
  A4: { w: 794, h: 1123 },
  A3: { w: 1123, h: 1587 },
  Letter: { w: 816, h: 1056 },
};

const ZOOM_STEPS = [0.4, 0.5, 0.65, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];

export default function CanvasArea() {
  const { state, mutate, ui } = useStore();
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

      if (e.key === 'ArrowRight') { e.preventDefault(); move(0, 1); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(0, -1); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1, 0); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); move(-1, 0); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        ui({ dirPref: state.ui.dirPref === 'across' ? 'down' : 'across' });
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
        if (state.ui.dirPref === 'across') move(0, 1);
        else move(1, 0);
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        mutate((pr) => {
          const n = cloneProject(pr);
          const cell = n.cells[r][c];
          if (cell.type === 'letter' && !cell.locked) n.cells[r][c] = { ...cell, letter: '' };
          return n;
        });
        if (state.ui.dirPref === 'across') move(0, -1);
        else move(-1, 0);
        return;
      }

      if (e.key === 'Delete') {
        e.preventDefault();
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
  }, [view, sel, selRect, selRegionId, p, mutate, ui, state.ui.dirPref, state.ui.modal, state.ui.ctxMenu]);

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
