import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { WordEntry, uid, DIFFICULTY_LABELS } from '../../model/types';
import { autoPlaceEntries, cloneProject, generateLayout, placementCells, removePlacement } from '../../logic/grid';
import { startDrag, clearDrag } from '../../state/dnd';

type Filter = 'kaikki' | 'sijoitettu' | 'sijoittamatta' | 'ristiriita' | 'pakolliset';
type Sort = 'aakkoset' | 'pituus' | 'tila';

export default function WordsPanel() {
  const { state, mutate, ui, toast } = useStore();
  const p = state.project;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('kaikki');
  const [sort, setSort] = useState<Sort>('aakkoset');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const placedIds = useMemo(() => new Set(p.placements.map((pl) => pl.entryId)), [p.placements]);

  const conflictIds = useMemo(() => {
    const set = new Set<string>();
    for (const pl of p.placements) {
      const entry = p.entries.find((e) => e.id === pl.entryId);
      if (!entry) continue;
      const word = [...entry.answer.toUpperCase()];
      placementCells(pl).forEach((pc, i) => {
        const cell = p.cells[pc.r]?.[pc.c];
        if (!cell || cell.type !== 'letter' || (cell.letter && word[i] && cell.letter !== word[i])) {
          set.add(entry.id);
        }
      });
    }
    return set;
  }, [p]);

  const visible = useMemo(() => {
    let list = p.entries.filter(
      (e) =>
        e.answer.toLowerCase().includes(search.toLowerCase()) ||
        e.clue.toLowerCase().includes(search.toLowerCase())
    );
    if (filter === 'sijoitettu') list = list.filter((e) => placedIds.has(e.id));
    if (filter === 'sijoittamatta') list = list.filter((e) => !placedIds.has(e.id));
    if (filter === 'ristiriita') list = list.filter((e) => conflictIds.has(e.id));
    if (filter === 'pakolliset') list = list.filter((e) => e.required);
    const statusRank = (e: WordEntry) => (conflictIds.has(e.id) ? 0 : placedIds.has(e.id) ? 2 : 1);
    list = [...list];
    if (sort === 'aakkoset') list.sort((a, b) => a.answer.localeCompare(b.answer, 'fi'));
    if (sort === 'pituus') list.sort((a, b) => b.answer.length - a.answer.length);
    if (sort === 'tila') list.sort((a, b) => statusRank(a) - statusRank(b));
    return list;
  }, [p.entries, search, filter, sort, placedIds, conflictIds]);

  const selectOnGrid = (e: WordEntry) => {
    const pl = p.placements.find((x) => x.entryId === e.id);
    if (pl) ui({ sel: { r: pl.r, c: pl.c }, selRect: null, selRegionId: null, dirPref: pl.dir });
  };

  const saveEntry = (id: string | null, data: Partial<WordEntry>) => {
    if (id) {
      mutate((pr) => ({
        ...pr,
        entries: pr.entries.map((e) => (e.id === id ? { ...e, ...data } : e)),
      }));
    } else {
      const entry: WordEntry = {
        id: uid('e'),
        answer: (data.answer ?? '').toUpperCase(),
        clue: data.clue ?? '',
        difficulty: data.difficulty ?? 2,
        priority: 2,
        required: data.required ?? false,
        category: data.category,
        notes: data.notes,
      };
      if (!entry.answer) return;
      mutate((pr) => ({ ...pr, entries: [...pr.entries, entry] }));
    }
  };

  if (p.entries.length === 0 && !adding) {
    return (
      <div className="panel">
        <h2 className="panel-title">Sanat ja vihjeet</h2>
        <div className="empty-state">
          <p>Lisää ensimmäiset sanat ja vihjeet. Voit kirjoittaa ne yksitellen tai liittää kokonaisen listan.</p>
          <div className="btn-col">
            <button className="panel-btn primary" onClick={() => setAdding(true)}>
              Lisää sana
            </button>
            <button className="panel-btn" onClick={() => ui({ modal: { kind: 'import' } })}>
              Liitä lista
            </button>
            <button className="panel-btn" onClick={() => ui({ modal: { kind: 'import' } })}>
              Tuo CSV
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel words-panel">
      <h2 className="panel-title">Sanat ja vihjeet</h2>
      <input
        className="search-input"
        type="search"
        placeholder="Hae sanaa tai vihjettä…"
        value={search}
        aria-label="Hae sanalistasta"
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="field-row">
        <label className="field">
          <span>Suodata</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="kaikki">Kaikki</option>
            <option value="sijoitettu">Sijoitetut</option>
            <option value="sijoittamatta">Sijoittamattomat</option>
            <option value="ristiriita">Ristiriidat</option>
            <option value="pakolliset">Pakolliset</option>
          </select>
        </label>
        <label className="field">
          <span>Järjestä</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="aakkoset">Aakkosittain</option>
            <option value="pituus">Pituuden mukaan</option>
            <option value="tila">Tilan mukaan</option>
          </select>
        </label>
      </div>

      <div className="panel-hint subtle">
        Vedä sana listasta suoraan ruudukkoon: vihreä esikatselu tarkoittaa, että sana sopii.
        Pidä <strong>Shift</strong> pohjassa pudottaaksesi pystysuuntaan.
      </div>
      <ul className="word-list" aria-label="Sanalista">
        {visible.map((e) => {
          const placed = placedIds.has(e.id);
          const conflict = conflictIds.has(e.id);
          const status = conflict ? 'Ristiriita' : placed ? 'Sijoitettu' : 'Sijoittamatta';
          const statusCls = conflict ? 'st-conflict' : placed ? 'st-placed' : 'st-unplaced';
          const editing = editingId === e.id;
          return (
            <li
              key={e.id}
              className={`word-item ${statusCls}`}
              draggable
              onDragStart={(ev) => {
                ev.dataTransfer.setData('text/plain', e.answer);
                ev.dataTransfer.effectAllowed = 'copy';
                startDrag({ word: e });
              }}
              onDragEnd={clearDrag}
            >
              <button
                className="word-main"
                onClick={() => selectOnGrid(e)}
                title={
                  placed
                    ? 'Näytä ruudukossa – tai vedä ruudukkoon siirtääksesi'
                    : 'Vedä sana ruudukkoon sijoittaaksesi sen (Shift = pystysuunta)'
                }
              >
                <span className="word-answer">
                  {e.answer} <span className="word-len">({e.answer.length})</span>
                  {e.required && <span className="word-required" title="Pakollinen sana">★</span>}
                </span>
                <span className="word-clue">{e.clue || (e.imageId ? 'Kuvavihje' : 'Ei vihjettä')}</span>
                <span className={`word-status ${statusCls}`}>
                  <span className="status-dot" aria-hidden /> {status}
                </span>
              </button>
              <div className="word-actions">
                <button className="mini-btn" onClick={() => setEditingId(editing ? null : e.id)} title="Muokkaa">
                  ✎
                </button>
                <button
                  className="mini-btn"
                  title="Poista sana"
                  onClick={() =>
                    ui({
                      modal: {
                        kind: 'confirm',
                        title: 'Poista sana',
                        message: `Poistetaanko ${e.answer} sanalistasta? Mahdollinen sijoitus poistetaan myös.`,
                        danger: true,
                        onConfirm: () =>
                          mutate((pr) => {
                            let n = cloneProject(pr);
                            const pl = n.placements.find((x) => x.entryId === e.id);
                            if (pl) n = removePlacement(n, pl.id);
                            n.entries = n.entries.filter((x) => x.id !== e.id);
                            n.regions = n.regions.map((rg) => (rg.entryId === e.id ? { ...rg, entryId: undefined } : rg));
                            return n;
                          }),
                      },
                    })
                  }
                >
                  🗑
                </button>
              </div>
              {editing && (
                <EntryForm
                  initial={e}
                  onSave={(data) => {
                    saveEntry(e.id, data);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </li>
          );
        })}
        {visible.length === 0 && <li className="word-empty">Ei osumia.</li>}
      </ul>

      {adding && (
        <EntryForm
          onSave={(data) => {
            saveEntry(null, data);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      <div className="btn-col">
        <button className="panel-btn primary" onClick={() => setAdding(true)}>
          Lisää sana
        </button>
        <button className="panel-btn" onClick={() => ui({ modal: { kind: 'import' } })}>
          Liitä lista / Tuo CSV
        </button>
        <button
          className="panel-btn primary"
          title="Tyhjentää ruudukon ja rakentaa kokonaisen ristikon sanalistasta: sanat risteyksineen, vihjeruudut nuolineen ja estetyt ruudut"
          onClick={() => {
            if (!p.entries.length) return toast('Lisää ensin sanoja listaan');
            ui({
              modal: {
                kind: 'confirm',
                title: 'Luo ristikko sanalistasta',
                message:
                  'Nykyinen ruudukko korvataan: sanat sijoitellaan risteyksineen ja vihjeruudut luodaan automaattisesti. Vihjetekstit tulevat sanalistasta. Voit kumota toiminnon (Ctrl+Z).',
                confirmLabel: 'Luo ristikko',
                onConfirm: () => {
                  const res = generateLayout(p, p.entries.map((e) => e.id));
                  const placed = res.placed;
                  const failed = res.failed.map((id) => p.entries.find((e) => e.id === id)?.answer ?? '?');
                  mutate(() => res.project);
                  toast(
                    failed.length
                      ? `${placed} sanaa sijoitettu – eivät mahtuneet: ${failed.join(', ')}`
                      : `Valmis! ${placed} sanaa sijoitettu vihjeruutuineen`
                  );
                },
              },
            });
          }}
        >
          Luo ristikko sanalistasta
        </button>
        <button
          className="panel-btn"
          title="Sijoittaa vain vielä sijoittamattomat sanat nykyiseen ruudukkoon"
          onClick={() => {
            const unplaced = p.entries.filter((e) => !placedIds.has(e.id)).map((e) => e.id);
            if (!unplaced.length) return toast('Kaikki sanat on jo sijoitettu');
            mutate((pr) => autoPlaceEntries(pr, unplaced).project);
            toast('Sijoittamattomat sanat sijoiteltiin – tarkista tulos ja kumoa tarvittaessa');
          }}
        >
          Sijoita puuttuvat sanat
        </button>
      </div>
    </div>
  );
}

function EntryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: WordEntry;
  onSave: (data: Partial<WordEntry>) => void;
  onCancel: () => void;
}) {
  const [answer, setAnswer] = useState(initial?.answer ?? '');
  const [clue, setClue] = useState(initial?.clue ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? 2);
  const [required, setRequired] = useState(initial?.required ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  return (
    <form
      className="entry-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          answer: answer.toUpperCase().trim(),
          clue: clue.trim(),
          category: category.trim() || undefined,
          difficulty: difficulty as 1 | 2 | 3,
          required,
          notes: notes.trim() || undefined,
        });
      }}
    >
      <label className="field">
        <span>Vastaus</span>
        <input value={answer} onChange={(e) => setAnswer(e.target.value)} required autoFocus placeholder="esim. SAUNA" />
      </label>
      <label className="field">
        <span>Vihje</span>
        <input value={clue} onChange={(e) => setClue(e.target.value)} placeholder="esim. Suomalainen löylypaikka" />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Kategoria</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="esim. Musiikki" />
        </label>
        <label className="field">
          <span>Vaikeus</span>
          <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value) as 1 | 2 | 3)}>
            {[1, 2, 3].map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d as 1 | 2 | 3]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field check">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        <span>Pakollinen sana</span>
      </label>
      <label className="field">
        <span>Muistiinpanot</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="valinnainen" />
      </label>
      <div className="field-row">
        <button type="submit" className="panel-btn primary">
          Tallenna
        </button>
        <button type="button" className="panel-btn" onClick={onCancel}>
          Peruuta
        </button>
      </div>
    </form>
  );
}
