import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { LAST_FILE_SAVE_KEY, exportProjectFile } from '../logic/exporter';

/** Muistutus näytetään, kun projektia on muokattu tämän ajan jälkeen. */
const REMIND_AFTER_MS = 20 * 60 * 1000;
const SNOOZE_MS = 20 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;

function lastFileSave(): number {
  try {
    return Number(localStorage.getItem(LAST_FILE_SAVE_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
}

/**
 * Muistuttaa lataamaan projektitiedoston talteen. Selaimen paikallinen
 * tallennus voi kadota selaimen tietoja tyhjennettäessä, eikä se siirry
 * toiselle koneelle – tiedosto on ainoa varmuuskopio.
 */
export default function SaveReminder() {
  const { state, toast } = useStore();
  const p = state.project;
  const edits = state.past.length;
  const [open, setOpen] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [sessionStart] = useState(() => Date.now());

  useEffect(() => {
    const check = () => {
      if (open || Date.now() < snoozedUntil) return;
      if (edits < 5) return; // vasta kun projektia on oikeasti työstetty
      const since = Math.max(lastFileSave(), sessionStart);
      if (Date.now() - since > REMIND_AFTER_MS) setOpen(true);
    };
    const t = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [open, snoozedUntil, edits, sessionStart]);

  if (!open) return null;

  const snooze = () => {
    setOpen(false);
    setSnoozedUntil(Date.now() + SNOOZE_MS);
  };

  return (
    <div className="save-reminder" role="status">
      <span className="save-reminder-text">
        <strong>Muista tallentaa työsi.</strong> Ristikko säilyy vain tässä selaimessa – lataa
        projektitiedosto talteen, niin voit avata sen myöhemmin tai toisella koneella.
      </span>
      <button
        className="tb-btn"
        onClick={() => {
          exportProjectFile(p);
          toast('Projektitiedosto ladattu');
          setOpen(false);
        }}
      >
        Lataa projektitiedosto
      </button>
      <button className="tb-btn subtle-btn" onClick={snooze}>
        Myöhemmin
      </button>
    </div>
  );
}
