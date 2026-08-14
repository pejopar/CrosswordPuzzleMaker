// Lahjoitusasetukset.
//
// PAIKANVARAUS: lisää maksupalvelun osoite (esim. Stripe Payment Link,
// Buy Me a Coffee, Ko-fi tai MobilePay) DONATE_URL-vakioon ennen julkaisua.
// Sovellus ei kerää maksutietoja itse, vaan ohjaa käyttäjän palveluntarjoajalle.
// Kun osoite on tyhjä, painikkeet näyttävät paikanvarausviestin.

export const DONATE_URL = '';

/**
 * PAIKANVARAUS: QR-koodikuva (esim. MobilePay- tai Stripe-koodi).
 * Aseta polku julkiseen tiedostoon, esim. '/lahjoita-qr.png', tai jätä
 * tyhjäksi – silloin modaalissa näkyy paikanvarauslaatikko.
 */
export const DONATE_QR_IMAGE = '';

export const DONATE_TIERS = [
  { amount: '3 €', label: 'Kahvi', note: 'Pieni kiitos työkalusta' },
  { amount: '10 €', label: 'Tukija', note: 'Auttaa kehitystä eteenpäin' },
  { amount: '25 €', label: 'Kummi', note: 'Mahdollistaa uudet ominaisuudet' },
];

export const DONATE_TEXT = {
  title: 'Tue Ristikkostudiota',
  short: 'Ristikkostudio on ilmainen työkalu. Jos siitä on ollut hyötyä, voit tukea kehitystä.',
  long:
    'Ristikkostudio on ilmainen ja mainokseton. Lahjoitus auttaa pitämään sen sellaisena ' +
    'ja rahoittaa uusia ominaisuuksia, kuten laajempaa sanastoa ja parempaa tekoälyapua.',
  cta: 'Tue kehitystä',
  placeholder: 'Lahjoituslinkki lisätään ennen julkaisua (DONATE_URL, src/config/donate.ts)',
  qrPlaceholder: 'QR-koodi tulee tähän',
  qrHelp: 'Lue koodi puhelimella niin pääset maksusivulle.',
};

/**
 * Puhekuplan tekstit. Kupla ilmestyy sydänpainikkeesta harvakseltaan ja
 * vaihtaa tekstiä joka kerta – sävy on kevyt, ei vaativa.
 */
export const BUBBLE_TEXTS = [
  'Syntyykö ristikko mukavasti? ♥',
  'Ristikkostudio on ilmainen – kiitos että kokeilet!',
  'Pidätkö työkalusta? Kahvi kelpaisi ☕',
  'Tuella pysyy mainoksettomana.',
  'Uusia ominaisuuksia tulossa – tuki auttaa.',
  'Ei pakko, mutta ilahduttaisi ♥',
  'Kiva kun teet ristikoita täällä!',
];

/** Kuinka usein puhekupla voi ilmestyä. */
export const BUBBLE_INTERVAL_MS = 5 * 60 * 1000;
/** Kuinka kauan kupla näkyy ennen automaattista sulkeutumista. */
export const BUBBLE_VISIBLE_MS = 12 * 1000;

const COUNT_KEY = 'ristikkostudio.exportCount.v1';
const DISMISS_KEY = 'ristikkostudio.donateDismissed.v1';

/** Monennenko viennin jälkeen hienovarainen muistutus näytetään. */
const PROMPT_AFTER_EXPORTS = 3;
/** Kuinka monen viennin välein muistutus voi toistua, jos sitä ei ole hylätty pysyvästi. */
const PROMPT_INTERVAL = 10;

function readCount(): number {
  try {
    return Number(localStorage.getItem(COUNT_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
}

export function isDismissedForever(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === 'forever';
  } catch {
    return false;
  }
}

export function dismissDonatePrompt(forever: boolean) {
  if (!forever) return;
  try {
    localStorage.setItem(DISMISS_KEY, 'forever');
  } catch {
    // paikallinen tallennus ei käytettävissä – muistutus voi palata myöhemmin
  }
}

/** Avaa lahjoitussivun. Palauttaa false, jos osoitetta ei ole vielä asetettu. */
export function openDonatePage(): boolean {
  if (!DONATE_URL) return false;
  window.open(DONATE_URL, '_blank', 'noopener,noreferrer');
  return true;
}

type Listener = () => void;
let listener: Listener | null = null;

export function subscribeDonatePrompt(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

/**
 * Kirjaa onnistuneen viennin ja näyttää muistutuksen harvakseltaan:
 * ensimmäisen kerran kolmannen viennin jälkeen, sitten kymmenen välein.
 * Pysyvä hylkäys estää muistutuksen kokonaan.
 */
export function maybePromptAfterExport() {
  const count = readCount() + 1;
  try {
    localStorage.setItem(COUNT_KEY, String(count));
  } catch {
    // ei kriittinen
  }
  if (isDismissedForever()) return;
  const due = count === PROMPT_AFTER_EXPORTS || (count > PROMPT_AFTER_EXPORTS && (count - PROMPT_AFTER_EXPORTS) % PROMPT_INTERVAL === 0);
  if (due) listener?.();
}
