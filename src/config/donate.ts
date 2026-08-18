// Lahjoitusasetukset.
//
// Lahjoitus tapahtuu QR-koodilla: käyttäjä lukee koodin puhelimellaan ja
// valitsee summan itse maksupalvelussa. Sovellus ei kerää maksutietoja.

/**
 * Lahjoitus-QR. Tiedosto on hakemistossa `public/`, joten polku alkaa
 * juuresta. Jos tiedostoa ei löydy, modaalissa näkyy paikanvarauslaatikko
 * rikkinäisen kuvan sijaan.
 */
export const DONATE_QR_IMAGE = '/lahjoita-qr.png';

/**
 * Valinnainen varalinkki työpöytäkäyttäjille, jotka eivät voi lukea koodia
 * ruudulta (esim. sama laite). Tyhjänä linkkiä ei näytetä lainkaan.
 */
export const DONATE_URL = '';

/**
 * Summat ovat pelkkiä ehdotuksia – QR-koodilla voi antaa minkä tahansa
 * summan. Nämä näytetään rohkaisuna, eivät valintoina.
 */
export const DONATE_TIERS = [
  { amount: '1 €', label: 'Kiitos', note: 'Pienikin summa lämmittää' },
  { amount: '5 €', label: 'Kahvi', note: 'Kiitos työkalusta' },
  { amount: '20 €', label: 'Tukija', note: 'Vie kehitystä eteenpäin' },
];

export const DONATE_TEXT = {
  title: 'Tue Ristikkostudiota',
  short: 'Ristikkostudio on ilmainen työkalu. Jos siitä on ollut hyötyä, voit tukea kehitystä.',
  long:
    'Ristikkostudio on ilmainen ja mainokseton. Lahjoitus auttaa pitämään sen sellaisena ' +
    'ja rahoittaa uusia ominaisuuksia, kuten laajempaa sanastoa ja parempaa tekoälyapua.',
  cta: 'Tue kehitystä',
  placeholder: 'Lahjoitus-QR lisätään ennen julkaisua (public/lahjoita-qr.png)',
  qrPlaceholder: 'QR-koodi tulee tähän',
  qrHelp: 'Lue koodi puhelimen kameralla.',
  qrLead: 'Lue QR-koodi puhelimellasi',
  amountsNote: 'Voit valita summan itse – mikä tahansa käy. Esimerkiksi:',
  desktopFallback: 'Etkö voi lukea koodia? Avaa maksusivu selaimessa',
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
