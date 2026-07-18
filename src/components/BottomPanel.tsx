import { useStore } from '../state/store';
import { validateProject } from '../logic/validate';

const SEV_LABEL = { virhe: 'Virhe', varoitus: 'Varoitus', ehdotus: 'Ehdotus' } as const;
const SEV_ICON = { virhe: '⛔', varoitus: '⚠️', ehdotus: '💡' } as const;

export default function BottomPanel() {
  const { state, ui } = useStore();
  const { bottomOpen, issues } = state.ui;

  if (!bottomOpen) {
    return (
      <button className="bottom-collapsed" onClick={() => ui({ bottomOpen: true, issues: issues ?? validateProject(state.project) })}>
        Tarkistukset {issues ? `(${issues.length})` : ''} ▴
      </button>
    );
  }

  const list = issues ?? [];
  const counts = {
    virhe: list.filter((i) => i.severity === 'virhe').length,
    varoitus: list.filter((i) => i.severity === 'varoitus').length,
    ehdotus: list.filter((i) => i.severity === 'ehdotus').length,
  };

  return (
    <section className="bottom-panel" aria-label="Tarkistustulokset">
      <header className="bottom-head">
        <strong>Tarkista ristikko</strong>
        <span className="bottom-counts">
          <span className="chip chip-virhe">{counts.virhe} virhettä</span>
          <span className="chip chip-varoitus">{counts.varoitus} varoitusta</span>
          <span className="chip chip-ehdotus">{counts.ehdotus} ehdotusta</span>
        </span>
        <button className="tb-btn" onClick={() => ui({ issues: validateProject(state.project) })}>
          Tarkista uudelleen
        </button>
        <button className="tb-btn icon" onClick={() => ui({ bottomOpen: false })} aria-label="Sulje paneeli">
          ▾
        </button>
      </header>
      <ul className="issue-list">
        {list.length === 0 && <li className="issue-ok">✔ Ei havaittuja ongelmia. Ristikko näyttää valmiilta!</li>}
        {list.map((iss, i) => (
          <li key={i} className={`issue issue-${iss.severity}`}>
            <span className="issue-icon" aria-hidden>{SEV_ICON[iss.severity]}</span>
            <span className={`issue-sev sev-${iss.severity}`}>{SEV_LABEL[iss.severity]}</span>
            <span className="issue-msg">{iss.message}</span>
            {iss.target && (
              <button
                className="mini-btn"
                onClick={() => ui({ sel: iss.target!, selRect: null, selRegionId: state.project.cells[iss.target!.r]?.[iss.target!.c]?.regionId ?? null })}
              >
                Näytä
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
