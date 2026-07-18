import { useStore, SidebarTab } from '../../state/store';
import ContentTools from './ContentTools';
import StructurePanel from './StructurePanel';
import WordsPanel from './WordsPanel';
import ImagesPanel from './ImagesPanel';
import StylePanel from './StylePanel';

const TABS: { id: SidebarTab; label: string }[] = [
  { id: 'sisalto', label: 'Sisältö' },
  { id: 'rakenne', label: 'Rakenne' },
  { id: 'sanat', label: 'Sanat ja vihjeet' },
  { id: 'kuvat', label: 'Kuvat' },
  { id: 'tyyli', label: 'Tyyli' },
];

export default function Sidebar() {
  const { state, ui } = useStore();
  const tab = state.ui.tab;
  return (
    <aside className="sidebar" aria-label="Työkalut ja sisältö">
      <nav className="sidebar-tabs" role="tablist" aria-label="Sivupaneelin osiot">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`sidebar-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => ui({ tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-body" role="tabpanel">
        {tab === 'sisalto' && <ContentTools />}
        {tab === 'rakenne' && <StructurePanel />}
        {tab === 'sanat' && <WordsPanel />}
        {tab === 'kuvat' && <ImagesPanel />}
        {tab === 'tyyli' && <StylePanel />}
      </div>
    </aside>
  );
}
