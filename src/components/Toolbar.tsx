import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { addCol, addRow, resizeGrid } from '../logic/grid';
import { validateProject } from '../logic/validate';
import { exportProjectFile } from '../logic/exporter';
import { DonateToolbarButton } from './Donate';

const SAVE_LABELS: Record<string, string> = {
  saving: 'Tallennetaan…',
  saved: 'Tallennettu paikallisesti',
  error: 'Tallennus epäonnistui',
  idle: '',
};

/** Pitkä ja lyhyt teksti: kapeilla näytöillä näytetään lyhyempi. */
function Label({ full, short }: { full: string; short: string }) {
  return (
    <>
      <span className="tb-full">{full}</span>
      <span className="tb-short">{short}</span>
    </>
  );
}

export default function Toolbar() {
  const { state, mutate, ui, undo, redo, toast } = useStore();
  const p = state.project;
  const [exportOpen, setExportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [nameEditing, setNameEditing] = useState(false);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const runValidation = () => {
    const issues = validateProject(p);
    ui({ issues, bottomOpen: true });
  };

  const openExport = (tab: 'pdf' | 'pdf-key' | 'png' | 'svg' | 'print') => {
    setExportOpen(false);
    ui({ modal: { kind: 'export' } });
    // Vientimodaali lukee halutun välilehden sessionStoragesta
    sessionStorage.setItem('ristikkostudio.exportTab', tab);
  };

  const openProjectFile = () => document.getElementById('open-project-input')?.click();
  const saveProjectFile = () => {
    exportProjectFile(p);
    toast('Projektitiedosto ladattu');
  };

  const setCols = (v: number) => {
    const cols = Math.max(2, Math.min(40, v || p.cols));
    mutate((pr) => resizeGrid(pr, pr.rows, cols));
  };
  const setRows = (v: number) => {
    const rows = Math.max(2, Math.min(40, v || p.rows));
    mutate((pr) => resizeGrid(pr, rows, pr.cols));
  };

  return (
    <header className="toolbar" role="banner">
      <div className="wordmark" title="Ristikkostudio">
        RISTIKKO<span>STUDIO</span>
      </div>

      <div className="toolbar-project">
        {nameEditing ? (
          <input
            className="project-name-input"
            autoFocus
            defaultValue={p.name}
            aria-label="Projektin nimi"
            onBlur={(e) => {
              const name = e.target.value.trim() || 'Nimetön ristikko';
              mutate((pr) => ({ ...pr, name }));
              setNameEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setNameEditing(false);
            }}
          />
        ) : (
          <button className="project-name" onClick={() => setNameEditing(true)} title="Nimeä projekti uudelleen">
            {p.name}
          </button>
        )}
        <span className={`save-status save-${state.ui.saveStatus}`} role="status">
          {SAVE_LABELS[state.ui.saveStatus]}
        </span>
      </div>

      <div className="toolbar-group tb-project-actions">
        <button className="tb-btn" onClick={() => ui({ modal: { kind: 'new' } })} title="Uusi ristikko">
          <Label full="Uusi ristikko" short="Uusi" />
        </button>
        <button className="tb-btn" title="Avaa projektitiedosto" onClick={openProjectFile}>
          Avaa
        </button>
        <button className="tb-btn" title="Tallenna projektitiedosto koneellesi" onClick={saveProjectFile}>
          Tallenna
        </button>
      </div>

      <div className="toolbar-group">
        <button className="tb-btn icon" onClick={undo} disabled={!state.past.length} title="Kumoa (Ctrl+Z)" aria-label="Kumoa">
          ↺
        </button>
        <button className="tb-btn icon" onClick={redo} disabled={!state.future.length} title="Tee uudelleen (Ctrl+Y)" aria-label="Tee uudelleen">
          ↻
        </button>
        <button
          className="tb-btn dir-toggle"
          onClick={() => ui({ dirPref: state.ui.dirPref === 'across' ? 'down' : 'across' })}
          title="Kirjoitussuunta – vaihda myös Tab-näppäimellä tai napsauttamalla valittua ruutua uudelleen"
          aria-label={`Kirjoitussuunta: ${state.ui.dirPref === 'across' ? 'vaakaan' : 'alas'}`}
        >
          {state.ui.dirPref === 'across' ? 'Suunta →' : 'Suunta ↓'}
        </button>
      </div>

      <div className="toolbar-group grid-size">
        <label>
          L
          <input
            type="number"
            min={2}
            max={40}
            value={p.cols}
            aria-label="Ruudukon leveys"
            onChange={(e) => setCols(Number(e.target.value))}
          />
        </label>
        <span className="dim-x">×</span>
        <label>
          K
          <input
            type="number"
            min={2}
            max={40}
            value={p.rows}
            aria-label="Ruudukon korkeus"
            onChange={(e) => setRows(Number(e.target.value))}
          />
        </label>
        <button className="tb-btn" onClick={() => mutate((pr) => addRow(pr, pr.rows))} title="Lisää rivi alas">
          + Rivi
        </button>
        <button className="tb-btn" onClick={() => mutate((pr) => addCol(pr, pr.cols))} title="Lisää sarake oikealle">
          + Sarake
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group view-switch" role="tablist" aria-label="Näkymä">
        {(
          [
            ['editor', 'Rakennus'],
            ['preview', 'Esikatselu'],
            ['answers', 'Ratkaisu'],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            role="tab"
            aria-selected={state.ui.view === mode}
            className={`tb-btn seg ${state.ui.view === mode ? 'active' : ''}`}
            onClick={() => ui({ view: mode })}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="toolbar-group">
        <button
          className="tb-btn accent-outline"
          onClick={() => ui({ modal: { kind: 'autofill' } })}
          title="Täytä automaattisesti"
        >
          <Label full="Täytä automaattisesti" short="Täytä" />
        </button>
        <button className="tb-btn" onClick={runValidation} title="Tarkista ristikko">
          <Label full="Tarkista ristikko" short="Tarkista" />
        </button>
      </div>

      {/* Kapeilla näytöillä piiloon menevät toiminnot löytyvät tästä valikosta */}
      <div className="toolbar-group tb-more-wrap" ref={moreRef}>
        <button
          className="tb-btn tb-more"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          title="Lisää toimintoja"
          onClick={() => setMoreOpen((v) => !v)}
        >
          ⋯
        </button>
        {moreOpen && (
          <div className="export-menu tb-more-menu" role="menu">
            <button role="menuitem" onClick={() => { setMoreOpen(false); ui({ modal: { kind: 'new' } }); }}>
              Uusi ristikko
            </button>
            <button role="menuitem" onClick={() => { setMoreOpen(false); openProjectFile(); }}>
              Avaa projekti
            </button>
            <button role="menuitem" onClick={() => { setMoreOpen(false); saveProjectFile(); }}>
              Tallenna projektitiedosto
            </button>
            <hr />
            <div className="tb-more-size">
              <label>
                Leveys
                <input
                  type="number"
                  min={2}
                  max={40}
                  value={p.cols}
                  aria-label="Ruudukon leveys"
                  onChange={(e) => setCols(Number(e.target.value))}
                />
              </label>
              <label>
                Korkeus
                <input
                  type="number"
                  min={2}
                  max={40}
                  value={p.rows}
                  aria-label="Ruudukon korkeus"
                  onChange={(e) => setRows(Number(e.target.value))}
                />
              </label>
            </div>
            <button role="menuitem" onClick={() => { setMoreOpen(false); mutate((pr) => addRow(pr, pr.rows)); }}>
              Lisää rivi
            </button>
            <button role="menuitem" onClick={() => { setMoreOpen(false); mutate((pr) => addCol(pr, pr.cols)); }}>
              Lisää sarake
            </button>
          </div>
        )}
      </div>

      <DonateToolbarButton />

      <div className="toolbar-group export-wrap" ref={exportRef}>
        <button
          className="tb-btn export-btn"
          aria-haspopup="menu"
          aria-expanded={exportOpen}
          onClick={() => setExportOpen((v) => !v)}
        >
          <Label full="Vie / tulosta ▾" short="Vie ▾" />
        </button>
        {exportOpen && (
          <div className="export-menu" role="menu">
            <button role="menuitem" onClick={() => openExport('pdf')}>Tulostettava PDF</button>
            <button role="menuitem" onClick={() => openExport('pdf-key')}>PDF ja ratkaisu</button>
            <button role="menuitem" onClick={() => openExport('png')}>PNG-kuva</button>
            <button role="menuitem" onClick={() => openExport('svg')}>SVG-kuva</button>
            <button role="menuitem" onClick={() => openExport('print')}>Tulosta</button>
            <hr />
            <button role="menuitem" onClick={() => { setExportOpen(false); saveProjectFile(); }}>
              Tallenna projektitiedosto
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
