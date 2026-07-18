import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import {
  cloneProject,
  findSlot,
  placementAt,
  placeWord,
  removePlacement,
  removeRegion,
} from '../../logic/grid';
import { generateClue, rewriteClue, suggestWords, suggestsImageClue } from '../../logic/ai';
import { AiSuggestion, Dir, Region, uid, DIFFICULTY_LABELS } from '../../model/types';

export default function Inspector() {
  const { state } = useStore();
  const p = state.project;
  const { sel, selRegionId } = state.ui;

  const region = selRegionId ? p.regions.find((rg) => rg.id === selRegionId) : undefined;

  let body: React.ReactNode;
  if (region && region.kind === 'image') body = <ImageInspector region={region} />;
  else if (region) body = <ClueInspector region={region} />;
  else if (sel && p.cells[sel.r]?.[sel.c]?.type === 'letter') body = <SlotInspector />;
  else
    body = (
      <div className="empty-state">
        <p>Valitse ruutu tai vihjealue nähdäksesi sen asetukset.</p>
        <p className="subtle">
          Vihje: kaksoisklikkaa vihjealuetta muokataksesi tekstiä, tai paina Tab vaihtaaksesi
          kirjoitussuuntaa.
        </p>
      </div>
    );

  return (
    <aside className="inspector" aria-label="Valinnan asetukset">
      <h2 className="panel-title">Tarkastelu</h2>
      {body}
    </aside>
  );
}

/* ---------- Kirjainruutu / sana ---------- */

function SlotInspector() {
  const { state, mutate, ui, toast } = useStore();
  const p = state.project;
  const sel = state.ui.sel!;
  const dir = state.ui.dirPref;
  const [seed, setSeed] = useState(0);

  const slot = useMemo(
    () => findSlot(p, sel.r, sel.c, dir) ?? findSlot(p, sel.r, sel.c, dir === 'across' ? 'down' : 'across'),
    [p, sel, dir]
  );
  const effDir: Dir = slot?.dir ?? dir;

  const placement = slot ? placementAt(p, slot.r, slot.c, slot.dir) : undefined;
  const entry = placement ? p.entries.find((e) => e.id === placement.entryId) : undefined;

  const crossings = useMemo(() => {
    if (!slot) return 0;
    let n = 0;
    for (let i = 0; i < slot.length; i++) {
      const r = slot.dir === 'down' ? slot.r + i : slot.r;
      const c = slot.dir === 'across' ? slot.c + i : slot.c;
      if (findSlot(p, r, c, slot.dir === 'across' ? 'down' : 'across')) n++;
    }
    return n;
  }, [p, slot]);

  const suggestions = useMemo(() => {
    if (!slot) return [];
    return suggestWords(slot.pattern, {
      theme: p.theme,
      difficulty: p.difficulty,
      exclude: p.entries.map((e) => e.answer),
      seed,
    });
  }, [slot, p, seed]);

  if (!slot) {
    return (
      <div className="empty-state">
        <p>Tämä kirjainruutu ei ole osa vähintään kahden ruudun sanaa.</p>
      </div>
    );
  }

  const quality = Math.min(100, 40 + crossings * 18 + (slot.pattern.includes('_') ? 0 : 10));

  const previewSuggestion = (s: AiSuggestion) => {
    const cells = [...s.word].map((letter, i) => ({
      r: slot.dir === 'down' ? slot.r + i : slot.r,
      c: slot.dir === 'across' ? slot.c + i : slot.c,
      letter,
    }));
    ui({ aiPreview: { cells, label: s.word } });
  };

  const applySuggestion = (s: AiSuggestion) => {
    mutate((pr) => {
      const entryId = uid('e');
      return placeWord(
        pr,
        {
          id: entryId,
          answer: s.word,
          clue: generateClue(s.word),
          difficulty: s.difficulty,
          priority: 2,
          required: false,
          notes: 'Tekoälyehdotus',
        },
        slot.r,
        slot.c,
        slot.dir
      );
    });
    ui({ aiPreview: null });
    toast(`${s.word} sijoitettu – kumoa halutessasi (Ctrl+Z)`);
  };

  return (
    <div className="panel">
      <div className="insp-row">
        <span className="insp-label">Sana</span>
        <strong>{entry ? entry.answer : 'Ei linkitettyä sanaa'}</strong>
      </div>
      <div className="insp-row">
        <span className="insp-label">Kuvio</span>
        <code className="pattern">{[...slot.pattern].join(' ')}</code>
      </div>
      <div className="insp-row">
        <span className="insp-label">Pituus</span>
        <span>{slot.length} kirjainta</span>
      </div>
      <div className="insp-row">
        <span className="insp-label">Suunta</span>
        <button
          className="mini-btn wide"
          onClick={() => ui({ dirPref: effDir === 'across' ? 'down' : 'across' })}
          title="Vaihda suuntaa (Tab)"
        >
          {effDir === 'across' ? '→ Vaakasuunta' : '↓ Pystysuunta'}
        </button>
      </div>
      {entry && (
        <div className="insp-row">
          <span className="insp-label">Vihje</span>
          <span className="insp-clue">{entry.clue || 'Ei vihjettä'}</span>
        </div>
      )}
      <div className="insp-row">
        <span className="insp-label">Risteykset</span>
        <span>
          {crossings} / {slot.length}
        </span>
      </div>
      <div className="insp-row">
        <span className="insp-label">Sijoituksen laatu</span>
        <div className="quality-bar" role="img" aria-label={`Laatu ${quality} / 100`}>
          <div className="quality-fill" style={{ width: `${quality}%` }} />
        </div>
      </div>

      {placement && (
        <div className="btn-col">
          <button
            className="panel-btn"
            onClick={() => {
              mutate((pr) => {
                const n = cloneProject(pr);
                const pl = n.placements.find((x) => x.id === placement.id);
                if (pl) pl.locked = !pl.locked;
                for (let i = 0; i < placement.length; i++) {
                  const r = placement.dir === 'down' ? placement.r + i : placement.r;
                  const c = placement.dir === 'across' ? placement.c + i : placement.c;
                  if (n.cells[r]?.[c]) n.cells[r][c].locked = !placement.locked;
                }
                return n;
              });
            }}
          >
            {placement.locked ? 'Poista lukitus' : 'Lukitse sana'}
          </button>
          <button
            className="panel-btn danger"
            onClick={() => {
              mutate((pr) => removePlacement(pr, placement.id));
              toast('Sana poistettu ruudukosta – sanalistassa se säilyy');
            }}
          >
            Poista sana ruudukosta
          </button>
        </div>
      )}

      {entry && suggestsImageClue(entry.answer) && (
        <div className="panel-hint">
          💡 <strong>{entry.answer}</strong> toimisi hyvin myös kuvavihjeenä.
        </div>
      )}

      <h3 className="panel-sub">Tekoälyehdotukset</h3>
      {slot.pattern.includes('_') || !entry ? (
        <>
          {suggestions.length === 0 && (
            <div className="panel-hint subtle">Ei sopivia ehdotuksia tälle kuviolle. Kokeile muuttaa risteyskirjaimia.</div>
          )}
          <ul className="suggestion-list">
            {suggestions.map((s) => (
              <li key={s.id} className="suggestion-card">
                <div className="sug-head">
                  <strong className="sug-word">{s.word}</strong>
                  <span className="sug-fit" title="Sopivuus">
                    {s.fit} p
                  </span>
                </div>
                <div className="sug-meta">
                  <span title="Yleisyys">Yleisyys {s.common}</span>
                  <span title="Teemasopivuus">Teema {s.themeFit}</span>
                  <span>{DIFFICULTY_LABELS[s.difficulty]}</span>
                </div>
                <p className="sug-reason">{s.reason}</p>
                <div className="sug-actions">
                  <button className="mini-btn" onClick={() => previewSuggestion(s)}>
                    Esikatsele
                  </button>
                  <button className="mini-btn primary" onClick={() => applySuggestion(s)}>
                    Käytä
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="field-row">
            <button className="panel-btn" onClick={() => setSeed((x) => x + 1)}>
              Kokeile toista
            </button>
            {state.ui.aiPreview && (
              <button className="panel-btn" onClick={() => ui({ aiPreview: null })}>
                Hylkää esikatselu
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="panel-hint subtle">Sana on valmis. Poista sana tai tyhjennä kirjaimia saadaksesi ehdotuksia.</div>
      )}
    </div>
  );
}

/* ---------- Vihjealue ---------- */

function ClueInspector({ region }: { region: Region }) {
  const { state, mutate, ui, toast } = useStore();
  const p = state.project;
  const [proposal, setProposal] = useState<string | null>(null);
  const [seed, setSeed] = useState(0);

  const entry = region.entryId ? p.entries.find((e) => e.id === region.entryId) : undefined;

  const update = (patch: Partial<Region>) =>
    mutate((pr) => ({
      ...pr,
      regions: pr.regions.map((rg) => (rg.id === region.id ? { ...rg, ...patch } : rg)),
    }));

  const applyClue = (text: string) => {
    mutate((pr) => ({
      ...pr,
      regions: pr.regions.map((rg) => (rg.id === region.id ? { ...rg, text } : rg)),
      entries: region.entryId
        ? pr.entries.map((e) => (e.id === region.entryId ? { ...e, clue: text } : e))
        : pr.entries,
    }));
    setProposal(null);
    toast('Vihje päivitetty');
  };

  if (region.kind === 'decor') {
    return (
      <div className="panel">
        <h3 className="panel-sub">Koristealue</h3>
        <label className="field">
          <span>Teksti</span>
          <input value={region.text ?? ''} onChange={(e) => update({ text: e.target.value })} />
        </label>
        <label className="field">
          <span>Taustaväri</span>
          <input type="color" value={region.bg ?? p.style.accent} onChange={(e) => update({ bg: e.target.value })} />
        </label>
        <button className="panel-btn danger" onClick={() => { mutate((pr) => removeRegion(pr, region.id)); ui({ selRegionId: null }); }}>
          Poista alue
        </button>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="panel-sub">Vihjealue</h3>
      <label className="field">
        <span>Vihjeteksti</span>
        <textarea rows={3} value={region.text ?? ''} onChange={(e) => update({ text: e.target.value })} />
      </label>
      <label className="field">
        <span>Linkitetty vastaus</span>
        <select
          value={region.entryId ?? ''}
          onChange={(e) => update({ entryId: e.target.value || undefined })}
        >
          <option value="">– Ei linkitystä –</option>
          {p.entries.map((e) => (
            <option key={e.id} value={e.id}>
              {e.answer}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Nuolen suunta</span>
        <select
          value={region.arrow ? region.arrow.dir : ''}
          onChange={(e) => {
            const dir = e.target.value as '' | 'right' | 'down' | 'right-down' | 'down-right';
            update(
              dir
                ? { arrow: { edge: dir.startsWith('down') ? 'bottom' : 'right', dir } }
                : { arrow: undefined }
            );
          }}
        >
          <option value="">Ei nuolta</option>
          <option value="right">→ Oikealle</option>
          <option value="down">↓ Alas</option>
          <option value="right-down">↴ Oikealle, kääntyy alas</option>
          <option value="down-right">↳ Alas, kääntyy oikealle</option>
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>Fonttikoko</span>
          <input
            type="number"
            min={6}
            max={18}
            value={region.fontSize ?? 10}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Tasaus</span>
          <select value={region.align ?? 'center'} onChange={(e) => update({ align: e.target.value as 'left' | 'center' })}>
            <option value="center">Keskitetty</option>
            <option value="left">Vasen</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Taustaväri</span>
        <input type="color" value={region.bg ?? p.style.clueBg} onChange={(e) => update({ bg: e.target.value })} />
      </label>

      <h3 className="panel-sub">Tekoälyapu</h3>
      <div className="btn-col">
        <button
          className="panel-btn"
          onClick={() => {
            if (!entry) return toast('Linkitä ensin vastaus, jotta vihje voidaan luoda');
            setProposal(generateClue(entry.answer, 'normaali', seed));
            setSeed((x) => x + 1);
          }}
        >
          Luo vihje tekoälyllä
        </button>
        <div className="field-row">
          <button className="panel-btn" onClick={() => setProposal(rewriteClue(region.text ?? '', 'helpompi'))}>
            Helpompi
          </button>
          <button className="panel-btn" onClick={() => setProposal(rewriteClue(region.text ?? '', 'vaikeampi'))}>
            Vaikeampi
          </button>
        </div>
        <div className="field-row">
          <button className="panel-btn" onClick={() => setProposal(rewriteClue(region.text ?? '', 'lyhyempi'))}>
            Lyhyempi
          </button>
          <button className="panel-btn" onClick={() => setProposal(rewriteClue(region.text ?? '', 'hauskempi'))}>
            Hauskempi
          </button>
        </div>
      </div>
      {proposal && (
        <div className="ai-proposal" role="region" aria-label="Tekoälyn ehdotus">
          <p className="proposal-text">“{proposal}”</p>
          <div className="field-row">
            <button className="mini-btn primary" onClick={() => applyClue(proposal)}>
              Käytä
            </button>
            <button
              className="mini-btn"
              onClick={() => {
                if (entry) setProposal(generateClue(entry.answer, 'normaali', seed));
                setSeed((x) => x + 1);
              }}
            >
              Kokeile toista
            </button>
            <button className="mini-btn" onClick={() => setProposal(null)}>
              Hylkää
            </button>
          </div>
        </div>
      )}

      <button
        className="panel-btn danger"
        onClick={() => {
          mutate((pr) => removeRegion(pr, region.id));
          ui({ selRegionId: null });
        }}
      >
        Poista vihjealue
      </button>
    </div>
  );
}

/* ---------- Kuva-alue ---------- */

function ImageInspector({ region }: { region: Region }) {
  const { state, mutate, ui } = useStore();
  const p = state.project;
  const img = region.imageId ? p.images.find((i) => i.id === region.imageId) : undefined;

  const update = (patch: Partial<Region>) =>
    mutate((pr) => ({
      ...pr,
      regions: pr.regions.map((rg) => (rg.id === region.id ? { ...rg, ...patch } : rg)),
    }));

  return (
    <div className="panel">
      <h3 className="panel-sub">Kuvavihje</h3>
      {img ? (
        <img className="insp-image" src={img.dataUrl} alt={img.alt} />
      ) : (
        <div className="panel-hint">Ei kuvaa. Vedä kuva Kuvat-paneelista tai vaihda kuva alta.</div>
      )}
      <div className="btn-col">
        <button
          className="panel-btn"
          onClick={() => document.getElementById(`region-img-input-${region.id}`)?.click()}
        >
          {img ? 'Vaihda kuva' : 'Lisää kuva'}
        </button>
        <div className="field-row">
          <button
            className={`panel-btn ${region.fit === 'contain' ? 'primary' : ''}`}
            onClick={() => update({ fit: 'contain' })}
            title="Koko kuva näkyviin (rajaa tyhjää tilaa reunoille)"
          >
            Sovita
          </button>
          <button
            className={`panel-btn ${(region.fit ?? 'cover') === 'cover' ? 'primary' : ''}`}
            onClick={() => update({ fit: 'cover' })}
            title="Täytä alue (rajaa kuvaa tarvittaessa)"
          >
            Täytä / rajaa
          </button>
        </div>
      </div>
      <label className="field">
        <span>Zoomaus: {Math.round((region.imageZoom ?? 1) * 100)} %</span>
        <input
          type="range"
          min={1}
          max={2.5}
          step={0.05}
          value={region.imageZoom ?? 1}
          onChange={(e) => update({ imageZoom: Number(e.target.value) })}
        />
      </label>
      <label className="field">
        <span>Vaihtoehtoinen teksti (alt)</span>
        <input
          value={img?.alt ?? ''}
          disabled={!img}
          onChange={(e) =>
            mutate((pr) => ({
              ...pr,
              images: pr.images.map((i) => (i.id === img?.id ? { ...i, alt: e.target.value } : i)),
            }))
          }
        />
      </label>
      <label className="field">
        <span>Linkitetty vastaus</span>
        <select value={region.entryId ?? ''} onChange={(e) => update({ entryId: e.target.value || undefined })}>
          <option value="">– Ei linkitystä –</option>
          {p.entries.map((e) => (
            <option key={e.id} value={e.id}>
              {e.answer}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Nuolen suunta</span>
        <select
          value={region.arrow ? region.arrow.dir : ''}
          onChange={(e) => {
            const dir = e.target.value as '' | 'right' | 'down' | 'right-down' | 'down-right';
            update(
              dir
                ? { arrow: { edge: dir.startsWith('down') ? 'bottom' : 'right', dir } }
                : { arrow: undefined }
            );
          }}
        >
          <option value="">Ei nuolta</option>
          <option value="right">→ Oikealle</option>
          <option value="down">↓ Alas</option>
          <option value="right-down">↴ Oikealle, kääntyy alas</option>
          <option value="down-right">↳ Alas, kääntyy oikealle</option>
        </select>
      </label>
      <div className="btn-col">
        {img && (
          <button className="panel-btn" onClick={() => update({ imageId: undefined })}>
            Poista kuva alueesta
          </button>
        )}
        <button
          className="panel-btn danger"
          onClick={() => {
            mutate((pr) => removeRegion(pr, region.id));
            ui({ selRegionId: null });
          }}
        >
          Poista kuva-alue
        </button>
      </div>
    </div>
  );
}
