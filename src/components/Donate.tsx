import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import {
  DONATE_TEXT,
  DONATE_TIERS,
  DONATE_URL,
  dismissDonatePrompt,
  openDonatePage,
  subscribeDonatePrompt,
} from '../config/donate';

/** Yhteinen painike, joka avaa lahjoitussivun tai kertoo paikanvarauksesta. */
function DonateAction({ className, label }: { className?: string; label?: string }) {
  const { toast } = useStore();
  return (
    <button
      className={className ?? 'panel-btn primary'}
      onClick={() => {
        if (!openDonatePage()) toast(DONATE_TEXT.placeholder);
      }}
    >
      ♥ {label ?? DONATE_TEXT.cta}
    </button>
  );
}

/** Hillitty kortti vientimodaaliin: näkyy juuri kun käyttäjä saa valmiin työn. */
export function DonateBlock() {
  return (
    <aside className="donate-block" aria-label={DONATE_TEXT.title}>
      <div className="donate-block-text">
        <strong>{DONATE_TEXT.title}</strong>
        <p>{DONATE_TEXT.short}</p>
      </div>
      <DonateAction className="panel-btn donate-btn" />
    </aside>
  );
}

/** Työkalupalkin sydänpainike – aina saatavilla, ei koskaan keskeytä työtä. */
export function DonateToolbarButton() {
  const { ui } = useStore();
  return (
    <button
      className="tb-btn donate-tb"
      title={DONATE_TEXT.title}
      aria-label={DONATE_TEXT.title}
      onClick={() => ui({ modal: { kind: 'donate' } })}
    >
      ♥
    </button>
  );
}

/** Lahjoitusmodaali, jossa esimerkkitasot. Maksu tapahtuu palveluntarjoajalla. */
export function DonateModal() {
  const { ui, toast } = useStore();
  const close = () => ui({ modal: null });
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={DONATE_TEXT.title}
        tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && close()}
      >
        <header className="modal-head">
          <h2>{DONATE_TEXT.title}</h2>
          <button className="tb-btn icon" onClick={close} aria-label="Sulje">
            ✕
          </button>
        </header>
        <div className="modal-body">
          <p>{DONATE_TEXT.long}</p>
          <div className="donate-tiers">
            {DONATE_TIERS.map((t) => (
              <button
                key={t.amount}
                className="donate-tier"
                onClick={() => {
                  if (!openDonatePage()) toast(DONATE_TEXT.placeholder);
                }}
              >
                <span className="donate-amount">{t.amount}</span>
                <span className="donate-label">{t.label}</span>
                <span className="donate-note">{t.note}</span>
              </button>
            ))}
          </div>
          {!DONATE_URL && <p className="subtle">{DONATE_TEXT.placeholder}</p>}
          <div className="modal-actions">
            <button className="panel-btn" onClick={close}>
              Ehkä myöhemmin
            </button>
            <DonateAction />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hienovarainen alapalkki, joka nousee näkyviin vasta muutaman viennin
 * jälkeen. Ei peitä kanvasta eikä estä työskentelyä, ja sen voi hiljentää
 * pysyvästi yhdellä klikkauksella.
 */
export function DonateBar() {
  const [open, setOpen] = useState(false);
  const { ui } = useStore();

  useEffect(() => subscribeDonatePrompt(() => setOpen(true)), []);

  if (!open) return null;
  return (
    <div className="donate-bar" role="status">
      <span className="donate-bar-text">
        <strong>{DONATE_TEXT.title}.</strong> {DONATE_TEXT.short}
      </span>
      <button
        className="tb-btn"
        onClick={() => {
          setOpen(false);
          ui({ modal: { kind: 'donate' } });
        }}
      >
        ♥ {DONATE_TEXT.cta}
      </button>
      <button className="tb-btn" onClick={() => setOpen(false)}>
        Ei nyt
      </button>
      <button
        className="tb-btn subtle-btn"
        onClick={() => {
          dismissDonatePrompt(true);
          setOpen(false);
        }}
      >
        Älä näytä uudelleen
      </button>
    </div>
  );
}
