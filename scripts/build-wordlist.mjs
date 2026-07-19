// Generoi src/logic/words-fi.ts suomenkielisestä sanalistasta ja
// yleisyystilastosta. Lähteet (ladataan käsin, ei committoida):
//   kaikkisanat.txt – Kotuksen nykysuomen sanalista (CC BY 4.0)
//     https://raw.githubusercontent.com/hugovk/everyfinnishword/master/kaikkisanat.txt
//   fi_50k.txt – OpenSubtitles-pohjainen taajuuslista (CC BY-SA 4.0)
//     https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fi/fi_50k.txt
// Käyttö: node scripts/build-wordlist.mjs <kaikkisanat.txt> <fi_50k.txt>

import { readFileSync, writeFileSync } from 'node:fs';

const [, , kotusPath, freqPath] = process.argv;
if (!kotusPath || !freqPath) {
  console.error('Käyttö: node scripts/build-wordlist.mjs kaikkisanat.txt fi_50k.txt');
  process.exit(1);
}

const MIN_LEN = 3;
const MAX_LEN = 10;
const VALID = /^[a-zåäö]+$/;

const kotus = new Set(
  readFileSync(kotusPath, 'utf8')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => VALID.test(w) && w.length >= MIN_LEN && w.length <= MAX_LEN)
);

// Taajuusjärjestys: vain sanat jotka ovat myös Kotuksen listassa (aitoja perusmuotoja)
const commonOrdered = [];
const commonSet = new Set();
for (const line of readFileSync(freqPath, 'utf8').split(/\r?\n/)) {
  const word = line.split(' ')[0]?.toLowerCase();
  if (word && kotus.has(word) && !commonSet.has(word)) {
    commonSet.add(word);
    commonOrdered.push(word);
  }
}

// Loput Kotus-sanat aakkosjärjestyksessä
const rest = [...kotus].filter((w) => !commonSet.has(w)).sort();

const bucket = (words) => {
  const byLen = {};
  for (const w of words) {
    (byLen[w.length] ??= []).push(w.toUpperCase());
  }
  return byLen;
};

const serialize = (byLen) =>
  '{\n' +
  Object.entries(byLen)
    .map(([len, words]) => `  ${len}: '${words.join('')}',`)
    .join('\n') +
  '\n}';

const commonByLen = bucket(commonOrdered);
const restByLen = bucket(rest);

const out = `// GENEROITU TIEDOSTO – älä muokkaa käsin. Katso scripts/build-wordlist.mjs
// Sanat pituuden mukaan yhteen liitettyinä merkkijonoina (pilkotaan ajossa).
// COMMON on yleisyysjärjestyksessä (yleisin ensin), REST aakkosjärjestyksessä.
// Lähteet: Kotuksen nykysuomen sanalista (CC BY 4.0) ja
// hermitdave/FrequencyWords fi_50k (CC BY-SA 4.0).

export const COMMON: Record<number, string> = ${serialize(commonByLen)};

export const REST: Record<number, string> = ${serialize(restByLen)};
`;

writeFileSync(new URL('../src/logic/words-fi.ts', import.meta.url), out);
console.log(
  `common: ${commonOrdered.length} sanaa, rest: ${rest.length} sanaa, ` +
    `yhteensä ${commonOrdered.length + rest.length}`
);
