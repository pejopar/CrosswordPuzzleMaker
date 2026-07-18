import { useStore } from '../../state/store';
import { StyleSettings } from '../../model/types';

const ACCENTS = ['#FFD400', '#FF3E8A', '#FF7A00', '#9BE500', '#2151FF'];

export default function StylePanel() {
  const { state, mutate } = useStore();
  const p = state.project;
  const s = p.style;

  const set = (patch: Partial<StyleSettings>) =>
    mutate((pr) => ({ ...pr, style: { ...pr.style, ...patch } }));

  return (
    <div className="panel">
      <h2 className="panel-title">Tyyli</h2>

      <h3 className="panel-sub">Otsikkotiedot</h3>
      <label className="field">
        <span>Ristikon otsikko</span>
        <input value={s.title} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <label className="field">
        <span>Tekijä tai organisaatio</span>
        <input value={s.author} onChange={(e) => set({ author: e.target.value })} />
      </label>
      <label className="field">
        <span>Johdanto / ohjeet</span>
        <textarea rows={3} value={s.intro} onChange={(e) => set({ intro: e.target.value })} />
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
      <div className="field-row">
        <label className="field">
          <span>Ruudun tausta</span>
          <input type="color" value={s.cellBg} onChange={(e) => set({ cellBg: e.target.value })} />
        </label>
        <label className="field">
          <span>Vihjeruudun tausta</span>
          <input type="color" value={s.clueBg} onChange={(e) => set({ clueBg: e.target.value })} />
        </label>
      </div>

      <h3 className="panel-sub">Typografia ja nuolet</h3>
      <label className="field">
        <span>Kirjasintyyli</span>
        <select value={s.font} onChange={(e) => set({ font: e.target.value as StyleSettings['font'] })}>
          <option value="sans">Moderni sans-serif</option>
          <option value="cond">Paksu display</option>
          <option value="serif">Klassinen serif</option>
        </select>
      </label>
      <label className="field">
        <span>Nuolityyli</span>
        <select value={s.arrowStyle} onChange={(e) => set({ arrowStyle: e.target.value as StyleSettings['arrowStyle'] })}>
          <option value="solid">Täytetty</option>
          <option value="outline">Ääriviiva</option>
        </select>
      </label>
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
