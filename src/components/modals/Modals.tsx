import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { createBlankProject, createSampleProject } from '../../model/sample';
import { parseWordList, rowsToEntries, ParsedRow } from '../../logic/importer';
import { generateLayout } from '../../logic/grid';
import { buildSvg, exportPng, exportProjectFile, exportSvg, parseProjectFile } from '../../logic/exporter';
import { requestPrint } from '../PrintSheet';
import { suggestWords } from '../../logic/ai';
import { findSlot } from '../../logic/grid';
import { placeWord } from '../../logic/grid';
import { generateClue } from '../../logic/ai';
import { uid } from '../../model/types';

/* ---------- Modaalikehys ---------- */

function ModalFrame({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="tb-btn icon" onClick={onClose} aria-label="Sulje">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export default function Modals() {
  const { state, dispatch, ui } = useStore();
  const modal = state.ui.modal;

  return (
    <>
      {/* Piilotettu projektitiedoston avaus (työkalupalkin Avaa-painike) */}
      <input
        id="open-project-input"
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const project = parseProjectFile(reader.result as string);
              dispatch({ type: 'load', project });
            } catch {
              ui({ saveStatus: 'error' });
              alert('Tiedoston avaaminen epäonnistui: se ei ole kelvollinen Ristikkostudio-projekti.');
            }
          };
          reader.readAsText(file);
          e.target.value = '';
        }}
      />
      {modal?.kind === 'new' && <NewProjectModal />}
      {modal?.kind === 'import' && <ImportModal />}
      {modal?.kind === 'autofill' && <AutofillModal />}
      {modal?.kind === 'export' && <ExportModal />}
      {modal?.kind === 'confirm' && <ConfirmModal />}
    </>
  );
}

/* ---------- Uusi ristikko ---------- */

function NewProjectModal() {
  const { dispatch, ui, toast } = useStore();
  const [name, setName] = useState('Uusi ristikko');
  const [size, setSize] = useState<'A4' | 'A3' | 'Letter'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [cols, setCols] = useState(12);
  const [rows, setRows] = useState(10);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(1);
  const [theme, setTheme] = useState('');
  const [start, setStart] = useState<'blank' | 'import' | 'sample'>('blank');

  const close = () => ui({ modal: null });

  return (
    <ModalFrame title="Uusi ristikko" onClose={close}>
      <label className="field">
        <span>Projektin nimi</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Paperikoko</span>
          <select value={size} onChange={(e) => setSize(e.target.value as typeof size)}>
            <option>A4</option>
            <option>A3</option>
            <option>Letter</option>
          </select>
        </label>
        <label className="field">
          <span>Suunta</span>
          <select value={orientation} onChange={(e) => setOrientation(e.target.value as typeof orientation)}>
            <option value="portrait">Pysty</option>
            <option value="landscape">Vaaka</option>
          </select>
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Leveys (ruutua)</span>
          <input type="number" min={4} max={40} value={cols} onChange={(e) => setCols(Number(e.target.value) || 12)} />
        </label>
        <label className="field">
          <span>Korkeus (ruutua)</span>
          <input type="number" min={4} max={40} value={rows} onChange={(e) => setRows(Number(e.target.value) || 10)} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Vaikeustaso</span>
          <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value) as 1 | 2 | 3)}>
            <option value={1}>Helppo</option>
            <option value={2}>Keskitaso</option>
            <option value={3}>Vaikea</option>
          </select>
        </label>
        <label className="field">
          <span>Teema</span>
          <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="esim. Kesä, musiikki…" />
        </label>
      </div>
      <fieldset className="field radio-group">
        <legend>Aloitustapa</legend>
        <label>
          <input type="radio" checked={start === 'blank'} onChange={() => setStart('blank')} /> Aloita tyhjästä
        </label>
        <label>
          <input type="radio" checked={start === 'import'} onChange={() => setStart('import')} /> Tuo sanat ja vihjeet
        </label>
        <label>
          <input type="radio" checked={start === 'sample'} onChange={() => setStart('sample')} /> Käytä esimerkkisisältöä
        </label>
      </fieldset>
      <div className="modal-actions">
        <button className="panel-btn" onClick={close}>
          Peruuta
        </button>
        <button
          className="panel-btn primary"
          onClick={() => {
            if (start === 'sample') {
              const p = createSampleProject();
              p.name = name || p.name;
              dispatch({ type: 'load', project: p });
            } else {
              const p = createBlankProject({ name, size, orientation, rows, cols, difficulty, theme });
              dispatch({ type: 'load', project: p });
              if (start === 'import') {
                ui({ modal: { kind: 'import' } });
                return;
              }
            }
            ui({ modal: null });
            toast('Uusi projekti luotu');
          }}
        >
          Luo projekti
        </button>
      </div>
    </ModalFrame>
  );
}

/* ---------- Sanojen tuonti ---------- */

function ImportModal() {
  const { state, mutate, ui, toast } = useStore();
  const p = state.project;
  const [text, setText] = useState('');
  const [colAnswer, setColAnswer] = useState(0);
  const [colClue, setColClue] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows: ParsedRow[] = useMemo(() => {
    // Sarakevalinta CSV:lle: järjestetään sarakkeet uudelleen ennen jäsennystä
    if (colAnswer !== 0 || colClue !== 1) {
      const remapped = text
        .split(/\r?\n/)
        .map((line) => {
          const parts = line.split(/;|\t|,/);
          if (parts.length < 2) return line;
          return `${parts[colAnswer] ?? ''}; ${parts[colClue] ?? ''}`;
        })
        .join('\n');
      return parseWordList(remapped, p.entries.map((e) => e.answer));
    }
    return parseWordList(text, p.entries.map((e) => e.answer));
  }, [text, colAnswer, colClue, p.entries]);

  const valid = rows.filter((r) => !r.duplicate);
  const close = () => ui({ modal: null });

  return (
    <ModalFrame title="Tuo sanat ja vihjeet" onClose={close} wide>
      <div className="import-grid">
        <div>
          <label className="field">
            <span>Liitä lista (VASTAUS; VIHJE – yksi rivillään)</span>
            <textarea
              rows={12}
              value={text}
              placeholder={'HELSINKI; Suomen pääkaupunki\nSAUNA; Suomalainen löylypaikka'}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="field-row">
            <button className="panel-btn" onClick={() => fileRef.current?.click()}>
              Lataa CSV / taulukko
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.tsv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setText(reader.result as string);
                reader.readAsText(file);
              }}
            />
            <button
              className="panel-btn"
              onClick={async () => {
                try {
                  setText(await navigator.clipboard.readText());
                } catch {
                  toast('Leikepöydän lukeminen estettiin – liitä teksti kenttään itse');
                }
              }}
            >
              Liitä leikepöydältä
            </button>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Vastaussarake</span>
              <select value={colAnswer} onChange={(e) => setColAnswer(Number(e.target.value))}>
                <option value={0}>1. sarake</option>
                <option value={1}>2. sarake</option>
                <option value={2}>3. sarake</option>
              </select>
            </label>
            <label className="field">
              <span>Vihjesarake</span>
              <select value={colClue} onChange={(e) => setColClue(Number(e.target.value))}>
                <option value={0}>1. sarake</option>
                <option value={1}>2. sarake</option>
                <option value={2}>3. sarake</option>
              </select>
            </label>
          </div>
        </div>
        <div>
          <h3 className="panel-sub">Esikatselu ({valid.length} uutta sanaa)</h3>
          <ul className="import-preview">
            {rows.length === 0 && <li className="subtle">Liitä tai lataa lista nähdäksesi esikatselun.</li>}
            {rows.map((r, i) => (
              <li key={i} className={r.duplicate ? 'row-dup' : r.missingClue ? 'row-warn' : ''}>
                <strong>{r.answer}</strong> <span>({r.answer.length})</span>
                <em>{r.clue || 'ei vihjettä'}</em>
                {r.duplicate && <span className="chip chip-virhe">Kaksoiskappale</span>}
                {!r.duplicate && r.missingClue && <span className="chip chip-varoitus">Vihje puuttuu</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="modal-actions">
        <button className="panel-btn" onClick={close}>
          Peruuta
        </button>
        <button
          className="panel-btn primary"
          disabled={!valid.length}
          onClick={() => {
            const entries = rowsToEntries(rows);
            mutate((pr) => ({ ...pr, entries: [...pr.entries, ...entries] }));
            ui({ modal: null, tab: 'sanat' });
            toast(`${entries.length} sanaa tuotu sanalistaan`);
          }}
        >
          Vahvista tuonti
        </button>
      </div>
    </ModalFrame>
  );
}

/* ---------- Automaattitäyttö ---------- */

function AutofillModal() {
  const { state, mutate, ui, toast } = useStore();
  const p = state.project;
  const [mode, setMode] = useState<'valittu' | 'nakyva' | 'rakenne' | 'ehdota'>('nakyva');
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(p.difficulty);
  const [themeAdherence, setThemeAdherence] = useState(70);
  const [onlySupplied, setOnlySupplied] = useState(false);
  const [preferCommon, setPreferCommon] = useState(true);
  const [allowNames, setAllowNames] = useState(false);
  const [maxChanges, setMaxChanges] = useState(5);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<string[] | null>(null);
  const [proposals, setProposals] = useState<{ word: string; r: number; c: number; dir: 'across' | 'down' }[] | null>(null);

  const close = () => ui({ modal: null, aiPreview: null });

  const run = () => {
    setRunning(true);
    setProgress(0);
    setSummary(null);
    // Simuloitu eteneminen – oikea AI-palvelu kytkettäisiin tähän
    let pct = 0;
    const timer = window.setInterval(() => {
      pct += 18 + Math.random() * 14;
      if (pct >= 100) {
        window.clearInterval(timer);
        setProgress(100);
        finish();
      } else {
        setProgress(Math.round(pct));
      }
    }, 260);
  };

  const finish = () => {
    if (mode === 'rakenne') {
      const res = generateLayout(p, p.entries.map((e) => e.id));
      setProposals(null);
      setSummary([
        `${res.placed} sanaa sijoitettu uuteen rakenteeseen vihjeruutuineen`,
        ...(res.failed.length ? [`${res.failed.length} sanaa ei mahtunut: ${res.failed.map((id) => p.entries.find((e) => e.id === id)?.answer).join(', ')}`] : []),
        'Hyväksy muutokset alta – mitään ei ole vielä muutettu.',
      ]);
      setRunning(false);
      return;
    }
    // Etsi vajaita kohtia ja ehdota sanoja
    const found: { word: string; r: number; c: number; dir: 'across' | 'down' }[] = [];
    const seen = new Set<string>();
    outer: for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        for (const dir of ['across', 'down'] as const) {
          if (found.length >= maxChanges) break outer;
          const slot = findSlot(p, r, c, dir);
          if (!slot || !slot.pattern.includes('_')) continue;
          const key = `${slot.r},${slot.c},${slot.dir}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (onlySupplied) continue;
          const sugs = suggestWords(slot.pattern, {
            theme: themeAdherence > 50 ? p.theme : '',
            difficulty,
            exclude: [...p.entries.map((e) => e.answer), ...found.map((f) => f.word)],
          });
          const pick = preferCommon ? [...sugs].sort((a, b) => b.common - a.common)[0] : sugs[0];
          if (pick) found.push({ word: pick.word, r: slot.r, c: slot.c, dir: slot.dir });
        }
      }
    }
    setProposals(found);
    setSummary(
      found.length
        ? [
            `${found.length} täydennysehdotusta löytyi:`,
            ...found.map((f) => `${f.word} (${f.dir === 'across' ? 'vaaka' : 'pysty'}, rivi ${f.r + 1}, sarake ${f.c + 1})`),
            mode === 'ehdota' ? 'Vain ehdotukset – ristikkoa ei muuteta.' : 'Hyväksy muutokset alta – mitään ei ole vielä muutettu.',
          ]
        : ['Täydennettäviä kohtia ei löytynyt valituilla asetuksilla.']
    );
    if (found.length && mode !== 'ehdota') {
      ui({
        aiPreview: {
          cells: found.flatMap((f) =>
            [...f.word].map((letter, i) => ({
              r: f.dir === 'down' ? f.r + i : f.r,
              c: f.dir === 'across' ? f.c + i : f.c,
              letter,
            }))
          ),
          label: 'Automaattitäyttö',
        },
      });
    }
    setRunning(false);
  };

  const apply = () => {
    if (mode === 'rakenne') {
      mutate((pr) => generateLayout(pr, pr.entries.map((e) => e.id)).project);
    } else if (proposals) {
      mutate((pr) => {
        let cur = pr;
        for (const f of proposals) {
          cur = placeWord(
            cur,
            {
              id: uid('e'),
              answer: f.word,
              clue: generateClue(f.word),
              difficulty,
              priority: 2,
              required: false,
              notes: 'Automaattitäyttö',
            },
            f.r,
            f.c,
            f.dir
          );
        }
        return cur;
      });
    }
    ui({ modal: null, aiPreview: null });
    toast('Automaattitäyttö otettu käyttöön – kumoa halutessasi (Ctrl+Z)');
  };

  return (
    <ModalFrame title="Täytä automaattisesti" onClose={close}>
      <fieldset className="field radio-group">
        <legend>Mitä täytetään?</legend>
        <label>
          <input type="radio" checked={mode === 'valittu'} onChange={() => setMode('valittu')} /> Täytä valittu kohta
        </label>
        <label>
          <input type="radio" checked={mode === 'nakyva'} onChange={() => setMode('nakyva')} /> Täytä näkyvä alue
        </label>
        <label>
          <input type="radio" checked={mode === 'rakenne'} onChange={() => setMode('rakenne')} /> Luo uusi rakenne sanalistasta
        </label>
        <label>
          <input type="radio" checked={mode === 'ehdota'} onChange={() => setMode('ehdota')} /> Ehdota vain, älä muuta ristikkoa
        </label>
      </fieldset>

      <div className="field-row">
        <label className="field">
          <span>Vaikeustaso</span>
          <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value) as 1 | 2 | 3)}>
            <option value={1}>Helppo</option>
            <option value={2}>Keskitaso</option>
            <option value={3}>Vaikea</option>
          </select>
        </label>
        <label className="field">
          <span>Teemauskollisuus: {themeAdherence} %</span>
          <input type="range" min={0} max={100} value={themeAdherence} onChange={(e) => setThemeAdherence(Number(e.target.value))} />
        </label>
      </div>
      <div className="check-col">
        <label className="field check">
          <input type="checkbox" checked={onlySupplied} onChange={(e) => setOnlySupplied(e.target.checked)} />
          <span>Käytä vain omia sanoja</span>
        </label>
        <label className="field check">
          <input type="checkbox" checked={!onlySupplied} onChange={(e) => setOnlySupplied(!e.target.checked)} />
          <span>Salli ehdotetut sanat</span>
        </label>
        <label className="field check">
          <input type="checkbox" checked={preferCommon} onChange={(e) => setPreferCommon(e.target.checked)} />
          <span>Suosi yleisiä suomen sanoja</span>
        </label>
        <label className="field check">
          <input type="checkbox" checked={allowNames} onChange={(e) => setAllowNames(e.target.checked)} />
          <span>Salli nimet (muuten vältetään)</span>
        </label>
      </div>
      <label className="field">
        <span>Muutettavia sanoja enintään: {maxChanges}</span>
        <input type="range" min={1} max={12} value={maxChanges} onChange={(e) => setMaxChanges(Number(e.target.value))} />
      </label>

      {running && (
        <div className="progress-wrap" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <span>Analysoidaan ristikkoa… {progress} %</span>
        </div>
      )}

      {summary && (
        <div className="ai-proposal">
          {summary.map((s, i) => (
            <p key={i} className="proposal-text">
              {s}
            </p>
          ))}
        </div>
      )}

      <div className="modal-actions">
        <button className="panel-btn" onClick={close}>
          Sulje
        </button>
        {!summary && (
          <button className="panel-btn primary" onClick={run} disabled={running}>
            {running ? 'Analysoidaan…' : 'Käynnistä'}
          </button>
        )}
        {summary && mode !== 'ehdota' && (proposals?.length || mode === 'rakenne') ? (
          <>
            <button className="panel-btn" onClick={() => { setSummary(null); setProposals(null); ui({ aiPreview: null }); }}>
              Kokeile toista
            </button>
            <button className="panel-btn primary" onClick={apply}>
              Hyväksy muutokset
            </button>
          </>
        ) : summary ? (
          <button className="panel-btn" onClick={() => { setSummary(null); setProposals(null); }}>
            Uusi analyysi
          </button>
        ) : null}
      </div>
    </ModalFrame>
  );
}

/* ---------- Vienti ---------- */

function ExportModal() {
  const { state, ui, toast } = useStore();
  const p = state.project;
  const initialTab = (sessionStorage.getItem('ristikkostudio.exportTab') as string) || 'pdf';
  const [format, setFormat] = useState<'pdf' | 'pdf-key' | 'png' | 'svg' | 'print'>(
    (['pdf', 'pdf-key', 'png', 'svg', 'print'].includes(initialTab) ? initialTab : 'pdf') as 'pdf'
  );
  const [grayscale, setGrayscale] = useState(false);
  const [includeTitle, setIncludeTitle] = useState(true);
  const [includeIntro, setIncludeIntro] = useState(true);
  const [includeAuthor, setIncludeAuthor] = useState(true);
  const [separateKeyPage, setSeparateKeyPage] = useState(true);
  const [showKeyPreview, setShowKeyPreview] = useState(false);
  const [bleed, setBleed] = useState(false);
  const [cropMarks, setCropMarks] = useState(false);
  const [pageNumber, setPageNumber] = useState(false);
  const [quality, setQuality] = useState<'normaali' | 'korkea'>('korkea');

  const includeKey = format === 'pdf-key';
  const previewSvg = useMemo(
    () =>
      buildSvg(p, {
        showSolution: showKeyPreview,
        grayscale,
        includeTitle,
        includeIntro,
        includeAuthor,
        bleed,
        cropMarks,
        pageNumber: pageNumber ? 1 : undefined,
      }),
    [p, showKeyPreview, grayscale, includeTitle, includeIntro, includeAuthor, bleed, cropMarks, pageNumber]
  );

  const close = () => ui({ modal: null });

  const doExport = async () => {
    const opts = {
      grayscale,
      includeTitle,
      includeIntro,
      includeAuthor,
      bleed,
      cropMarks,
      pageNumber: pageNumber ? 1 : undefined,
    };
    if (format === 'png') {
      await exportPng(p, { ...opts, showSolution: showKeyPreview }, quality === 'korkea' ? 3 : 2);
      toast('PNG-kuva ladattu');
    } else if (format === 'svg') {
      exportSvg(p, { ...opts, showSolution: showKeyPreview });
      toast('SVG-kuva ladattu');
    } else {
      requestPrint({
        includeAnswers: includeKey,
        answersOnSeparatePage: separateKeyPage,
        grayscale,
        includeTitle,
        includeIntro,
        includeAuthor,
        bleed,
        cropMarks,
        pageNumbers: pageNumber,
      });
      close();
      return;
    }
  };

  return (
    <ModalFrame title="Vie / tulosta" onClose={close} wide>
      <div className="export-grid">
        <div className="export-opts">
          <fieldset className="field radio-group">
            <legend>Muoto</legend>
            <label><input type="radio" checked={format === 'pdf'} onChange={() => setFormat('pdf')} /> Tulostettava PDF (vain ristikko)</label>
            <label><input type="radio" checked={format === 'pdf-key'} onChange={() => setFormat('pdf-key')} /> PDF ja ratkaisu</label>
            <label><input type="radio" checked={format === 'png'} onChange={() => setFormat('png')} /> PNG-kuva</label>
            <label><input type="radio" checked={format === 'svg'} onChange={() => setFormat('svg')} /> SVG-kuva</label>
            <label><input type="radio" checked={format === 'print'} onChange={() => setFormat('print')} /> Tulosta selaimesta</label>
          </fieldset>

          <div className="field-row">
            <label className="field">
              <span>Paperikoko</span>
              <select value={p.page.size} disabled title="Muuta Tyyli-paneelista">
                <option>{p.page.size}</option>
              </select>
            </label>
            <label className="field">
              <span>Suunta</span>
              <select value={p.page.orientation} disabled title="Muuta Tyyli-paneelista">
                <option value={p.page.orientation}>{p.page.orientation === 'portrait' ? 'Pysty' : 'Vaaka'}</option>
              </select>
            </label>
          </div>

          <div className="check-col">
            <label className="field check"><input type="checkbox" checked={includeTitle} onChange={(e) => setIncludeTitle(e.target.checked)} /><span>Sisällytä otsikko</span></label>
            <label className="field check"><input type="checkbox" checked={includeIntro} onChange={(e) => setIncludeIntro(e.target.checked)} /><span>Sisällytä ohjeteksti</span></label>
            <label className="field check"><input type="checkbox" checked={includeAuthor} onChange={(e) => setIncludeAuthor(e.target.checked)} /><span>Sisällytä tekijä</span></label>
            <label className="field check"><input type="checkbox" checked={grayscale} onChange={(e) => setGrayscale(e.target.checked)} /><span>Harmaasävy (muuten täysvärit)</span></label>
            {includeKey && (
              <label className="field check"><input type="checkbox" checked={separateKeyPage} onChange={(e) => setSeparateKeyPage(e.target.checked)} /><span>Ratkaisu omalle sivulleen</span></label>
            )}
            <label className="field check"><input type="checkbox" checked={bleed} onChange={(e) => setBleed(e.target.checked)} /><span>Leikkuuvara (bleed)</span></label>
            <label className="field check"><input type="checkbox" checked={cropMarks} onChange={(e) => setCropMarks(e.target.checked)} /><span>Leikkuumerkit</span></label>
            <label className="field check"><input type="checkbox" checked={pageNumber} onChange={(e) => setPageNumber(e.target.checked)} /><span>Näytä sivunumero</span></label>
          </div>

          {format === 'png' && (
            <label className="field">
              <span>Kuvanlaatu</span>
              <select value={quality} onChange={(e) => setQuality(e.target.value as 'normaali' | 'korkea')}>
                <option value="normaali">Normaali (2×)</option>
                <option value="korkea">Korkea (3×)</option>
              </select>
            </label>
          )}

          <label className="field check">
            <input type="checkbox" checked={showKeyPreview} onChange={(e) => setShowKeyPreview(e.target.checked)} />
            <span>Esikatsele ratkaisukirjaimet</span>
          </label>
          <p className="subtle">
            Tulostettava versio piilottaa ratkaisukirjaimet automaattisesti; ratkaisuversio näyttää ne.
            Sisältö pysyy tulostusmarginaalien sisällä.
          </p>
        </div>

        <div className="export-preview" aria-label="Viennin esikatselu">
          <div className="export-preview-page" dangerouslySetInnerHTML={{ __html: previewSvg }} />
          <div className="subtle center">{showKeyPreview ? 'Ratkaisunäkymä' : 'Ratkojan näkymä'}</div>
        </div>
      </div>
      <div className="modal-actions">
        <button className="panel-btn" onClick={close}>
          Peruuta
        </button>
        <button className="panel-btn primary" onClick={doExport}>
          {format === 'png' ? 'Lataa PNG' : format === 'svg' ? 'Lataa SVG' : 'Avaa tulostus / PDF'}
        </button>
      </div>
    </ModalFrame>
  );
}

/* ---------- Vahvistus ---------- */

function ConfirmModal() {
  const { state, ui } = useStore();
  const modal = state.ui.modal;
  if (modal?.kind !== 'confirm') return null;
  const close = () => ui({ modal: null });
  return (
    <ModalFrame title={modal.title} onClose={close}>
      <p>{modal.message}</p>
      <div className="modal-actions">
        <button className="panel-btn" onClick={close} autoFocus>
          Peruuta
        </button>
        <button
          className={`panel-btn ${modal.danger ? 'danger' : 'primary'}`}
          onClick={() => {
            close();
            modal.onConfirm();
          }}
        >
          {modal.confirmLabel ?? 'Vahvista'}
        </button>
      </div>
    </ModalFrame>
  );
}
