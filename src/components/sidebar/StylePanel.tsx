import { useState } from 'react';
import { useStore } from '../../state/store';
import { StyleSettings } from '../../model/types';
import { FONTS } from '../../logic/fonts';
import {
  THEMES,
  ThemeDef,
  loadCustomThemes,
  saveCustomTheme,
  deleteCustomTheme,
} from '../../model/themes';

const ACCENTS = ['#FFD400', '#FF3E8A', '#FF7A00', '#9BE500', '#2151FF'];

export default function StylePanel() {
  const { state, mutate, ui, toast } = useStore();
  const p = state.project;
  const s = p.style;
  const [customThemes, setCustomThemes] = useState<ThemeDef[]>(() => loadCustomThemes());
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeName, setThemeName] = useState('');

  const set = (patch: Partial<StyleSettings>) =>
    mutate((pr) => ({ ...pr, style: { ...pr.style, ...patch } }));

  const applyTheme = (theme: ThemeDef) => {
    set({ ...theme.style });
    toast(`Teema ${theme.name} otettu käyttöön – kumoa halutessasi (Ctrl+Z)`);
  };

  return (
    <div className="panel">
      <h2 className="panel-title">Tyyli</h2>

      <h3 className="panel-sub">Valmiit teemat</h3>
      <div className="theme-grid">
        {[...THEMES, ...customThemes].map((t) => (
          <div key={t.id} className="theme-card-wrap">
            <button
              className="theme-card"
              title={t.description}
              onClick={() => applyTheme(t)}
              style={{ background: t.style.cellBg }}
            >
              <span
                className="theme-swatch-bar"
                style={{
                  background: t.style.accent,
                  borderRadius: t.style.cornerRadius > 0 ? 4 : 0,
                }}
              />
              <span className="theme-swatch-cells" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      border: `${Math.min(2, t.style.gridLine)}px solid ${t.style.gridLineColor}`,
                      background: i === 1 ? t.style.clueBg : i === 2 ? t.style.gridLineColor : '#fff',
                      borderRadius: t.style.cornerRadius > 0 ? 3 : 0,
                    }}
                  />
                ))}
              </span>
              <span className="theme-name">{t.name}</span>
            </button>
            {t.custom && (
              <button
                className="mini-btn theme-del"
                title="Poista oma teema"
                onClick={() => {
                  deleteCustomTheme(t.id);
                  setCustomThemes(loadCustomThemes());
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {savingTheme ? (
        <div className="field-row">
          <input
            autoFocus
            placeholder="Teeman nimi"
            value={themeName}
            aria-label="Oman teeman nimi"
            onChange={(e) => setThemeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveCustomTheme(themeName, s);
                setCustomThemes(loadCustomThemes());
                setSavingTheme(false);
                setThemeName('');
                toast('Oma teema tallennettu');
              }
              if (e.key === 'Escape') setSavingTheme(false);
            }}
          />
          <button
            className="panel-btn"
            onClick={() => {
              saveCustomTheme(themeName, s);
              setCustomThemes(loadCustomThemes());
              setSavingTheme(false);
              setThemeName('');
              toast('Oma teema tallennettu');
            }}
          >
            Tallenna
          </button>
        </div>
      ) : (
        <button className="panel-btn" onClick={() => setSavingTheme(true)}>
          Tallenna nykyinen tyyli teemaksi
        </button>
      )}

      <h3 className="panel-sub">Otsikkotiedot</h3>
      <label className="field">
        <span>Ristikon otsikko</span>
        <input value={s.title} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <label className="field">
        <span>Otsikon tyyli</span>
        <select value={s.titleStyle} onChange={(e) => set({ titleStyle: e.target.value as StyleSettings['titleStyle'] })}>
          <option value="bar">Väripalkki tekstin takana</option>
          <option value="underline">Alleviivaus korostusvärillä</option>
          <option value="boxed">Kehystetty laatikko</option>
          <option value="plain">Pelkkä teksti</option>
        </select>
      </label>
      <label className="field">
        <span>Tekijä tai organisaatio</span>
        <input value={s.author} onChange={(e) => set({ author: e.target.value })} />
      </label>
      <label className="field">
        <span>Johdanto / ohjeet</span>
        <textarea rows={3} value={s.intro} onChange={(e) => set({ intro: e.target.value })} />
      </label>
      <label className="field">
        <span>Alatunniste (esim. © tai lehden nimi)</span>
        <input value={s.footer} onChange={(e) => set({ footer: e.target.value })} placeholder="esim. © Ristikkostudio 2026" />
      </label>
      <label className="field check">
        <input type="checkbox" checked={s.showHeader} onChange={(e) => set({ showHeader: e.target.checked })} />
        <span>Näytä otsikkoalue sivulla</span>
      </label>
      <label className="field">
        <span>Logo (valinnainen)</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => set({ logoDataUrl: reader.result as string });
            reader.readAsDataURL(file);
          }}
        />
      </label>

      <h3 className="panel-sub">Korostusväri</h3>
      <div className="accent-row" role="radiogroup" aria-label="Korostusväri">
        {ACCENTS.map((a) => (
          <button
            key={a}
            className={`accent-swatch ${s.accent === a ? 'active' : ''}`}
            style={{ background: a }}
            aria-label={`Korostusväri ${a}`}
            aria-pressed={s.accent === a}
            onClick={() => set({ accent: a })}
          />
        ))}
        <input
          type="color"
          value={s.accent}
          aria-label="Oma korostusväri"
          onChange={(e) => set({ accent: e.target.value })}
        />
      </div>

      <h3 className="panel-sub">Ruudukko</h3>
      <label className="field">
        <span>Viivan paksuus: {s.gridLine} px</span>
        <input
          type="range"
          min={1}
          max={4}
          step={1}
          value={s.gridLine}
          onChange={(e) => set({ gridLine: Number(e.target.value) })}
        />
      </label>
      <label className="field">
        <span>Kulmien pyöristys: {s.cornerRadius} px</span>
        <input
          type="range"
          min={0}
          max={8}
          step={1}
          value={s.cornerRadius}
          onChange={(e) => set({ cornerRadius: Number(e.target.value) })}
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Viivan väri</span>
          <input type="color" value={s.gridLineColor} onChange={(e) => set({ gridLineColor: e.target.value })} />
        </label>
        <label className="field">
          <span>Ruudun tausta</span>
          <input type="color" value={s.cellBg} onChange={(e) => set({ cellBg: e.target.value })} />
        </label>
        <label className="field">
          <span>Vihjeruudun tausta</span>
          <input type="color" value={s.clueBg} onChange={(e) => set({ clueBg: e.target.value })} />
        </label>
      </div>
      <label className="field">
        <span>Estettyjen ruutujen tyyli</span>
        <select value={s.blockedStyle} onChange={(e) => set({ blockedStyle: e.target.value as StyleSettings['blockedStyle'] })}>
          <option value="solid">Täysi viivan väri</option>
          <option value="dark">Tumma harmaa</option>
          <option value="hatch">Vinoviivoitus</option>
          <option value="accent">Korostusväri</option>
        </select>
      </label>

      <h3 className="panel-sub">Typografia ja nuolet</h3>
      <label className="field">
        <span>Kirjasintyyli</span>
        <select value={s.font} onChange={(e) => set({ font: e.target.value as StyleSettings['font'] })}>
          {FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>Nuolityyli</span>
          <select value={s.arrowStyle} onChange={(e) => set({ arrowStyle: e.target.value as StyleSettings['arrowStyle'] })}>
            <option value="solid">Täytetty</option>
            <option value="outline">Ääriviiva</option>
          </select>
        </label>
        <label className="field">
          <span>Nuolen koko</span>
          <select value={s.arrowSize} onChange={(e) => set({ arrowSize: e.target.value as StyleSettings['arrowSize'] })}>
            <option value="S">Pieni</option>
            <option value="M">Keskikoko</option>
            <option value="L">Suuri</option>
          </select>
        </label>
      </div>
      <label className="field check">
        <input type="checkbox" checked={s.imageBorder} onChange={(e) => set({ imageBorder: e.target.checked })} />
        <span>Reunaviiva kuvien ympärille</span>
      </label>

      <h3 className="panel-sub">Sivu</h3>
      <label className="field">
        <span>Marginaalit: {p.page.margins} mm</span>
        <input
          type="range"
          min={5}
          max={30}
          value={p.page.margins}
          onChange={(e) => mutate((pr) => ({ ...pr, page: { ...pr.page, margins: Number(e.target.value) } }))}
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Paperikoko</span>
          <select
            value={p.page.size}
            onChange={(e) => mutate((pr) => ({ ...pr, page: { ...pr.page, size: e.target.value as 'A4' | 'A3' | 'Letter' } }))}
          >
            <option>A4</option>
            <option>A3</option>
            <option>Letter</option>
          </select>
        </label>
        <label className="field">
          <span>Suunta</span>
          <select
            value={p.page.orientation}
            onChange={(e) =>
              mutate((pr) => ({ ...pr, page: { ...pr.page, orientation: e.target.value as 'portrait' | 'landscape' } }))
            }
          >
            <option value="portrait">Pysty</option>
            <option value="landscape">Vaaka</option>
          </select>
        </label>
      </div>
    </div>
  );
}
