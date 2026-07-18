import { useStore, Tool } from '../../state/store';

const TOOLS: { id: Tool; label: string; icon: string; hint: string }[] = [
  { id: 'select', label: 'Valinta', icon: '➤', hint: 'Valitse ruutuja ja alueita (vedä valitaksesi useita)' },
  { id: 'letter', label: 'Kirjainruudut', icon: 'A', hint: 'Maalaa kirjainruutuja vastauksille' },
  { id: 'textClue', label: 'Tekstivihje', icon: '❝', hint: 'Piirrä vihjealue – voi kattaa useita ruutuja' },
  { id: 'imageClue', label: 'Kuvavihje', icon: '▣', hint: 'Piirrä kuvavihjealue' },
  { id: 'arrow', label: 'Suuntanuoli', icon: '↳', hint: 'Napsauta vihjealuetta vaihtaaksesi nuolen suuntaa' },
  { id: 'blocked', label: 'Estetty alue', icon: '■', hint: 'Merkitse käyttämättömät ruudut' },
  { id: 'decor', label: 'Koristealue', icon: '✦', hint: 'Piirrä koriste- tai brändialue' },
  { id: 'eraser', label: 'Pyyhekumi', icon: '⌫', hint: 'Tyhjennä ruutu tai poista alue' },
];

export default function ContentTools() {
  const { state, ui } = useStore();
  return (
    <div className="panel">
      <h2 className="panel-title">Työkalut</h2>
      <div className="tool-grid" role="group" aria-label="Piirtotyökalut">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool-btn ${state.ui.tool === t.id ? 'active' : ''}`}
            onClick={() => ui({ tool: t.id })}
            title={t.hint}
            aria-pressed={state.ui.tool === t.id}
          >
            <span className="tool-icon" aria-hidden>
              {t.icon}
            </span>
            <span className="tool-label">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="panel-hint">
        <strong>Vinkki:</strong>{' '}
        {TOOLS.find((t) => t.id === state.ui.tool)?.hint}
      </div>
      <div className="panel-hint subtle">
        Vastaukset kulkevat aina oikealle tai alas – ristikkoon ei voi syntyä vinottaisia sanoja.
      </div>
    </div>
  );
}
