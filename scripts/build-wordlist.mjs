// Generoi src/logic/words-fi.ts Kotuksen nykysuomen sanalistasta.
//
// LISENSSI: ainoa ulkoinen lähde on Kotuksen nykysuomen sanalista
// (CC BY 4.0, https://kaino.kotus.fi/sanat/nykysuomi/). Sanojen
// yleisyysarvio lasketaan alla olevalla omalla heuristiikalla, joten
// sanastoon ei liity share-alike-ehtoja.
//
// Lataa lähdetiedosto esim. peilistä
//   https://raw.githubusercontent.com/hugovk/everyfinnishword/master/kaikkisanat.txt
// ja aja:  node scripts/build-wordlist.mjs kaikkisanat.txt

import { readFileSync, writeFileSync } from 'node:fs';

const [, , kotusPath] = process.argv;
if (!kotusPath) {
  console.error('Käyttö: node scripts/build-wordlist.mjs kaikkisanat.txt');
  process.exit(1);
}

const MIN_LEN = 3;
const MAX_LEN = 11;
const VALID = /^[a-zåäö]+$/;

/**
 * Suomen kielen kirjainten suhteelliset esiintymistiheydet (%).
 * Yleistä kielitieteellistä perustietoa, ei kopioitu tietokannasta.
 */
const LETTER_FREQ = {
  a: 12.2, i: 10.8, t: 9.8, n: 8.8, e: 8.2, s: 7.9, l: 5.7, o: 5.6, k: 5.2,
  u: 5.0, ä: 3.6, m: 3.2, v: 2.2, r: 2.1, j: 2.0, h: 1.9, y: 1.7, p: 1.7,
  d: 1.0, ö: 0.5, g: 0.4, b: 0.3, f: 0.2, c: 0.1, w: 0.1, z: 0.05, x: 0.03,
  q: 0.01, å: 0.03,
};

/**
 * Käsin koottu arkisanasto, joka nostetaan ehdotusten kärkeen.
 * Oma kokoelma – ei peräisin ulkoisesta tietokannasta.
 */
const EVERYDAY = `
aamu aika aina aine ainoa ajatus alku alla anteeksi apu arki asia asua auto
avain elama elokuva eno erilainen esine essu etela halu hammas hana harmaa
hattu hauska heti hetki hiekka hiili hiiri hinta hissi historia huone huomen
hyva ihminen ikkuna ilma ilta into isa istua ita jalka jano jarvi joki joulu
juna juoda juusto jaa kahvi kakku kala kalja kana kangas kansa kartta kasi
katto katu kaupunki kausi kesa keskus kevat kieli kirja kirje kissa kivi koira
koti koulu kuppi kuu kuukausi kuva kylla kyla laiva lakki lammin lampi lapsi
lasi laulu lautanen leipa leiri lentaa levy liha liikenne lintu lippu luku
lumi luonto lyhyt maa maito maku mansikka marja matka meri metsa mieli mies
muna muoto museo musiikki mustikka mylly nainen nakki nauru nimi noja nukkua
numero nuori nurmi ohje oikea olut omena onni opettaja oppia osa paikka paita
paja pallo palvelu pankki pappi paras peili peli perhe peruna pesa piha piirto
pilvi pisara pituus pohja poika posti puhelin puisto pullo puna puoli puro
puu pyora raha rakas ranta rauha ravintola retki riisi rinta ruoho ruoka
ruotsi ruusu saari sade sana sanoma sata sauna savu seina sielu sika silla
silma sisar sisu sohva sokeri sota suku suola suomi suu syksy syy talo talvi
tanssi tarina tarkea tavara tee tehdas terve tie tieto tikka tori tuli tunti
tuoli tuomi tupa turku tuuli tyo tytto uni uusi vaate vahva vaimo valo vapaa
vasen vauva vene vesi vihanta viikko viini viisi vilja voima vuori vuosi
yliopisto ymparillä yo aani aiti
`
  .split(/\s+/)
  .filter(Boolean)
  .map((w) => w.toUpperCase());

const everydaySet = new Set(EVERYDAY);

/** Arvioi sanan tuttuuden 0–100 pelkän kirjainrakenteen perusteella. */
function commonness(word) {
  const lower = word.toLowerCase();
  let freqSum = 0;
  let rare = 0;
  for (const ch of lower) {
    const f = LETTER_FREQ[ch] ?? 0;
    freqSum += f;
    if (f < 0.6) rare++;
  }
  const meanFreq = freqSum / lower.length; // ~0–12
  // Ristikkoystävällinen pituus: 4–7 kirjainta parasta
  const len = lower.length;
  const lenScore = len <= 3 ? 0.75 : len <= 7 ? 1 : len <= 9 ? 0.8 : 0.55;
  // Yhdyssanamaiset pitkät sanat ovat harvinaisempia ratkojalle
  const base = (meanFreq / 8) * 100 * lenScore - rare * 12;
  return Math.max(5, Math.min(94, Math.round(base)));
}

const kotus = [
  ...new Set(
    readFileSync(kotusPath, 'utf8')
      .replace(/^﻿/, '')
      .split(/\r?\n/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => VALID.test(w) && w.length >= MIN_LEN && w.length <= MAX_LEN)
      .map((w) => w.toUpperCase())
  ),
];

const scored = kotus.map((word) => ({
  word,
  score: everydaySet.has(word) ? 97 : commonness(word),
}));

// COMMON = arkisanat ja heuristiikan kärki, yleisimmät ensin
const COMMON_CUTOFF = 62;
const common = scored.filter((s) => s.score >= COMMON_CUTOFF).sort((a, b) => b.score - a.score);
const rest = scored.filter((s) => s.score < COMMON_CUTOFF).sort((a, b) => a.word.localeCompare(b.word, 'fi'));

const bucket = (list) => {
  const byLen = {};
  for (const { word } of list) (byLen[word.length] ??= []).push(word);
  return byLen;
};

const serialize = (byLen) =>
  '{\n' +
  Object.entries(byLen)
    .map(([len, words]) => `  ${len}: '${words.join('')}',`)
    .join('\n') +
  '\n}';

const out = `// GENEROITU TIEDOSTO – älä muokkaa käsin. Katso scripts/build-wordlist.mjs
// Sanat pituuden mukaan yhteen liitettyinä merkkijonoina (pilkotaan ajossa).
// COMMON on tuttuusjärjestyksessä (tutuin ensin), REST aakkosjärjestyksessä.
//
// Lähde: Kotuksen nykysuomen sanalista, CC BY 4.0
// https://kaino.kotus.fi/sanat/nykysuomi/
// Tuttuusarviot on laskettu Ristikkostudion omalla heuristiikalla.

export const COMMON: Record<number, string> = ${serialize(bucket(common))};

export const REST: Record<number, string> = ${serialize(bucket(rest))};
`;

writeFileSync(new URL('../src/logic/words-fi.ts', import.meta.url), out);
console.log(`common: ${common.length}, rest: ${rest.length}, yhteensä ${scored.length}`);
