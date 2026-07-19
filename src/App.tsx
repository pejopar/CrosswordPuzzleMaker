import { useEffect, useState } from 'react';
import { useStore } from './state/store';
import Toolbar from './components/Toolbar';
import Sidebar from './components/sidebar/Sidebar';
import CanvasArea from './components/canvas/CanvasArea';
import Inspector from './components/inspector/Inspector';
import BottomPanel from './components/BottomPanel';
import Modals from './components/modals/Modals';
import ContextMenu from './components/ContextMenu';
import PrintSheet from './components/PrintSheet';
import { ensureWordlist } from './logic/ai';

function useIsDesktop(): boolean {
  const [ok, setOk] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const onResize = () => setOk(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return ok;
}

export default function App() {
  const { state, ui, undo, redo } = useStore();
  const isDesktop = useIsDesktop();

  // Lämmitetään sanasto taustalla, jotta ehdotukset ovat heti käytettävissä
  useEffect(() => {
    ensureWordlist();
  }, []);

  // Yleiset pikanäppäimet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') {
        if (state.ui.ctxMenu) ui({ ctxMenu: null });
        else if (state.ui.modal) ui({ modal: null });
        else ui({ sel: null, selRect: null, selRegionId: null, aiPreview: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.ui.ctxMenu, state.ui.modal, undo, redo, ui]);

  if (!isDesktop) {
    return (
      <div className="mobile-note" role="note">
        <div className="mobile-note-card">
          <div className="wordmark">
            RISTIKKO<span>STUDIO</span>
          </div>
          <h1>Suunniteltu työpöydälle</h1>
          <p>
            Ristikkostudio on ammattilaistason ristikkotyökalu, joka tarvitsee tilaa. Avaa sovellus
            tietokoneella, jonka näytön leveys on vähintään 1280&nbsp;pikseliä.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app" onClick={() => state.ui.ctxMenu && ui({ ctxMenu: null })}>
      <Toolbar />
      <div className="app-main">
        <Sidebar />
        <CanvasArea />
        <Inspector />
      </div>
      <BottomPanel />
      <Modals />
      <ContextMenu />
      {state.ui.toast && (
        <div className="toast" role="status">
          {state.ui.toast}
        </div>
      )}
      <PrintSheet />
    </div>
  );
}
