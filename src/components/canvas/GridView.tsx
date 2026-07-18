import React, { useEffect, useRef, useState } from 'react';
import { Project, Region } from '../../model/types';
import { useStore, Rect } from '../../state/store';
import { addCol, addRow, cloneProject, makeCell, regionAt, removeRegion, syncRegionCells } from '../../logic/grid';
import { uid } from '../../model/types';

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

export default function GridView({ project: p, mode, cellSize: S, interactive }: GridViewProps) {
  const { state, mutate, ui } = useStore();
  const { tool, sel, selRect, selRegionId, aiPreview } = state.ui;
  const lw = Math.max(1, p.style.gridLine);
  const [drag, setDrag] = useState<{ start: { r: number; c: number }; cur: { r: number; c: number } } | null>(null);
  const [editingRegion, setEditingRegion] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ regionId: string; startX: number; startY: number; w: number; h: number } | null>(null);
  const [hoverGrid, setHoverGrid] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  // Raahaus kuvapaneelista alueelle
  function onRegionDrop(e: React.DragEvent, rg: Region) {
    const assetId = e.dataTransfer.getData('ristikkostudio/image-id');
    if (!assetId) return;
    e.preventDefault();
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

  const dragRect = drag && tool !== 'select' ? normRect(drag.start, drag.cur) : null;
  const previewByCell = new Map<string, string>();
  if (aiPreview) for (const c of aiPreview.cells) previewByCell.set(`${c.r},${c.c}`, c.letter);

  const gridW = p.cols * S + lw;
  const gridH = p.rows * S + lw;
  const fontFamily =
    p.style.font === 'serif' ? 'Georgia, serif' : p.style.font === 'cond' ? "'Archivo Black', 'Arial Black', sans-serif" : "'Archivo', 'Helvetica Neue', Arial, sans-serif";

  return (
    <div
      ref={wrapRef}
      className={`grid-wrap ${isEditor ? 'editor' : 'static'}`}
      style={{ width: gridW, height: gridH, fontFamily }}
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
          if (mode !== 'editor' && cell.type === 'empty') cls.push('cell-invisible');
          const style: React.CSSProperties = {
            left: x,
            top: y,
            width: S + lw,
            height: S + lw,
            borderWidth: cell.type === 'empty' ? 1 : lw,
          };
          if (cell.type === 'letter') style.background = p.style.cellBg;
          return (
            <div
              key={key}
              className={cls.join(' ')}
              style={style}
              onMouseDown={(e) => onCellMouseDown(e, r, c)}
              onMouseEnter={() => onCellEnter(r, c)}
              onContextMenu={(e) => onCellContext(e, r, c)}
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
        const selected = selRegionId === rg.id && isEditor;
        const img = rg.imageId ? p.images.find((i) => i.id === rg.imageId) : undefined;
        const editing = editingRegion === rg.id;
        return (
          <div
            key={rg.id}
            className={`region region-${rg.kind} ${selected ? 'region-selected' : ''}`}
            style={{
              left: x,
              top: y,
              width: w,
              height: h,
              borderWidth: lw,
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
            {rg.arrow && <Arrow edge={rg.arrow.edge} dir={rg.arrow.dir} size={S} outline={p.style.arrowStyle === 'outline'} />}
            {/* Koonmuutoskahva */}
            {selected && (
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

      {/* Valitun ruudun korostus */}
      {sel && isEditor && !selRegionId && (
        <div
          className="sel-outline"
          style={{ left: sel.c * S, top: sel.r * S, width: S + lw, height: S + lw }}
          aria-hidden
        />
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

function Arrow({ edge, dir, size, outline }: { edge: 'right' | 'bottom'; dir: string; size: number; outline: boolean }) {
  const s = Math.max(10, size * 0.28);
  const fill = outline ? 'none' : '#111';
  const stroke = '#111';
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
