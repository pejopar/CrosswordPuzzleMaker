import { useStore } from '../state/store';
import {
  addCol,
  addRow,
  cloneProject,
  colHasContent,
  deleteCol,
  deleteRow,
  makeCell,
  regionAt,
  removeRegion,
  rowHasContent,
  syncRegionCells,
} from '../logic/grid';
import { Region, uid } from '../model/types';

export default function ContextMenu() {
  const { state, mutate, ui } = useStore();
  const menu = state.ui.ctxMenu;
  if (!menu) return null;

  const p = state.project;
  const { r, c } = menu;
  const cell = p.cells[r]?.[c];
  const region = regionAt(p, r, c);
  const close = () => ui({ ctxMenu: null });

  const confirmed = (title: string, message: string, onConfirm: () => void) =>
    ui({ ctxMenu: null, modal: { kind: 'confirm', title, message, danger: true, onConfirm } });

  const item = (label: string, action: () => void, danger = false) => (
    <button
      key={label}
      role="menuitem"
      className={danger ? 'danger' : ''}
      onClick={(e) => {
        e.stopPropagation();
        close();
        action();
      }}
    >
      {label}
    </button>
  );

  const setType = (type: 'letter' | 'blocked' | 'empty') =>
    mutate((pr) => {
      const n = cloneProject(pr);
      if (n.cells[r][c].regionId) return pr;
      n.cells[r][c] = type === 'empty' ? makeCell() : { type, letter: type === 'letter' ? n.cells[r][c].letter : '' };
      return n;
    });

  const addRegion = (kind: Region['kind']) =>
    mutate((pr) => {
      if (pr.cells[r][c].regionId) return pr;
      const n = cloneProject(pr);
      n.regions.push({
        id: uid('reg'),
        kind,
        r,
        c,
        w: 1,
        h: 1,
        arrow: kind !== 'decor' ? { edge: 'right', dir: 'right' } : undefined,
        fit: kind === 'image' ? 'cover' : undefined,
      });
      syncRegionCells(n);
      return n;
    });

  const style: React.CSSProperties = {
    left: Math.min(menu.x, window.innerWidth - 260),
    top: Math.min(menu.y, window.innerHeight - 380),
  };

  return (
    <div className="ctx-menu" role="menu" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="ctx-title">
        Ruutu {r + 1}, {c + 1}
      </div>
      {!region && cell?.type !== 'letter' && item('Muuta kirjainruuduksi', () => setType('letter'))}
      {!region && cell?.type !== 'blocked' && item('Merkitse estetyksi', () => setType('blocked'))}
      {!region && item('Lisää tekstivihje tähän', () => addRegion('text'))}
      {!region && item('Lisää kuvavihje tähän', () => addRegion('image'))}
      {region &&
        item('Kierrä nuolen suuntaa', () =>
          mutate((pr) => {
            const n = cloneProject(pr);
            const rg = n.regions.find((x) => x.id === region.id)!;
            const order = ['right', 'down', 'right-down', 'down-right'] as const;
            const idx = rg.arrow ? order.indexOf(rg.arrow.dir) : -1;
            if (idx === order.length - 1) rg.arrow = undefined;
            else {
              const dir = order[idx + 1];
              rg.arrow = { edge: dir.startsWith('down') ? 'bottom' : 'right', dir };
            }
            return n;
          })
        )}
      {region && item('Poista alue', () => mutate((pr) => removeRegion(pr, region.id)), true)}
      {cell?.type === 'letter' &&
        item('Tyhjennä kirjain', () =>
          mutate((pr) => {
            const n = cloneProject(pr);
            n.cells[r][c] = { ...n.cells[r][c], letter: '' };
            return n;
          })
        )}
      {cell?.type === 'letter' &&
        item(cell.locked ? 'Poista lukitus' : 'Lukitse ruutu', () =>
          mutate((pr) => {
            const n = cloneProject(pr);
            n.cells[r][c] = { ...n.cells[r][c], locked: !n.cells[r][c].locked };
            return n;
          })
        )}
      <hr />
      {item('Lisää rivi yläpuolelle', () => mutate((pr) => addRow(pr, r)))}
      {item('Lisää rivi alapuolelle', () => mutate((pr) => addRow(pr, r + 1)))}
      {item('Lisää sarake vasemmalle', () => mutate((pr) => addCol(pr, c)))}
      {item('Lisää sarake oikealle', () => mutate((pr) => addCol(pr, c + 1)))}
      <hr />
      {item(
        'Poista rivi',
        () => {
          const act = () => mutate((pr) => deleteRow(pr, r));
          if (rowHasContent(p, r))
            confirmed('Poista rivi', `Rivillä ${r + 1} on sisältöä. Poistetaanko silti? Voit kumota toiminnon.`, act);
          else act();
        },
        true
      )}
      {item(
        'Poista sarake',
        () => {
          const act = () => mutate((pr) => deleteCol(pr, c));
          if (colHasContent(p, c))
            confirmed('Poista sarake', `Sarakkeessa ${c + 1} on sisältöä. Poistetaanko silti? Voit kumota toiminnon.`, act);
          else act();
        },
        true
      )}
    </div>
  );
}
