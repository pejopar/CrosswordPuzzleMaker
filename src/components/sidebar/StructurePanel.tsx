import { useStore } from '../../state/store';
import {
  addCol,
  addRow,
  autoPlaceEntries,
  clearGrid,
  colHasContent,
  deleteCol,
  deleteRow,
  resizeGrid,
  rowHasContent,
} from '../../logic/grid';

export default function StructurePanel() {
  const { state, mutate, ui, toast } = useStore();
  const p = state.project;
  const sel = state.ui.sel;

  const confirmed = (title: string, message: string, onConfirm: () => void) =>
    ui({ modal: { kind: 'confirm', title, message, danger: true, onConfirm } });

  const delRow = () => {
    if (!sel) return toast('Valitse ensin rivi napsauttamalla ruutua');
    const act = () => mutate((pr) => deleteRow(pr, sel.r));
    if (rowHasContent(p, sel.r)) {
      confirmed('Poista rivi', `Rivillä ${sel.r + 1} on sisältöä. Poistetaanko rivi silti? Voit kumota toiminnon.`, act);
    } else act();
  };

  const delCol = () => {
    if (!sel) return toast('Valitse ensin sarake napsauttamalla ruutua');
    const act = () => mutate((pr) => deleteCol(pr, sel.c));
    if (colHasContent(p, sel.c)) {
      confirmed('Poista sarake', `Sarakkeessa ${sel.c + 1} on sisältöä. Poistetaanko sarake silti? Voit kumota toiminnon.`, act);
    } else act();
  };

  return (
    <div className="panel">
      <h2 className="panel-title">Ruudukon rakenne</h2>

      <div className="field-row">
        <label className="field">
          <span>Leveys</span>
          <input
            type="number"
            min={2}
            max={40}
            value={p.cols}
            onChange={(e) => {
              const cols = Math.max(2, Math.min(40, Number(e.target.value) || p.cols));
              mutate((pr) => resizeGrid(pr, pr.rows, cols));
            }}
          />
        </label>
        <label className="field">
          <span>Korkeus</span>
          <input
            type="number"
            min={2}
            max={40}
            value={p.rows}
            onChange={(e) => {
              const rows = Math.max(2, Math.min(40, Number(e.target.value) || p.rows));
              mutate((pr) => resizeGrid(pr, rows, pr.cols));
            }}
          />
        </label>
      </div>

      <h3 className="panel-sub">Rivit ja sarakkeet</h3>
      <div className="btn-col">
        <button className="panel-btn" onClick={() => mutate((pr) => addRow(pr, sel ? sel.r : 0))}>
          Lisää rivi yläpuolelle
        </button>
        <button className="panel-btn" onClick={() => mutate((pr) => addRow(pr, sel ? sel.r + 1 : pr.rows))}>
          Lisää rivi alapuolelle
        </button>
        <button className="panel-btn" onClick={() => mutate((pr) => addCol(pr, sel ? sel.c : 0))}>
          Lisää sarake vasemmalle
        </button>
        <button className="panel-btn" onClick={() => mutate((pr) => addCol(pr, sel ? sel.c + 1 : pr.cols))}>
          Lisää sarake oikealle
        </button>
        <button className="panel-btn danger" onClick={delRow}>
          Poista valittu rivi
        </button>
        <button className="panel-btn danger" onClick={delCol}>
          Poista valittu sarake
        </button>
      </div>

      <h3 className="panel-sub">Koko ruudukko</h3>
      <div className="btn-col">
        <button
          className="panel-btn danger"
          onClick={() =>
            confirmed(
              'Tyhjennä ruudukko',
              'Kaikki ruudut, vihjealueet ja sijoitukset poistetaan. Sanalista säilyy. Voit kumota toiminnon.',
              () => mutate((pr) => clearGrid(pr))
            )
          }
        >
          Tyhjennä ruudukko
        </button>
        <button
          className="panel-btn"
          onClick={() =>
            confirmed(
              'Luo rakenne uudelleen',
              'Nykyinen ruudukko tyhjennetään ja sanat sijoitellaan uudelleen automaattisesti. Voit kumota toiminnon.',
              () => {
                mutate((pr) => {
                  const cleared = clearGrid(pr);
                  const res = autoPlaceEntries(cleared, cleared.entries.map((e) => e.id));
                  return res.project;
                });
                toast('Rakenne luotiin uudelleen sanalistasta');
              }
            )
          }
        >
          Luo rakenne uudelleen
        </button>
      </div>
      <div className="panel-hint subtle">
        Valittu ruutu: {sel ? `rivi ${sel.r + 1}, sarake ${sel.c + 1}` : 'ei valintaa'}
      </div>
    </div>
  );
}
