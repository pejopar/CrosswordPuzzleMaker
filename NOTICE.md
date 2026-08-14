# Kolmansien osapuolten aineistot

Ristikkostudion lähdekoodi on MIT-lisensoitu (ks. `LICENSE`). Sovellus sisältää
lisäksi seuraavat kolmansien osapuolten aineistot omine lisensseineen.

## Sanasto

**Kotimaisten kielten keskuksen nykysuomen sanalista**
Lisenssi: Creative Commons Nimeä 4.0 (CC BY 4.0)
Lähde: https://kaino.kotus.fi/sanat/nykysuomi/

Tiedosto `src/logic/words-fi.ts` on johdettu tästä sanalistasta: sanat on
suodatettu pituuden (3–11 merkkiä) ja merkistön mukaan sekä järjestetty
Ristikkostudion omalla tuttuusheuristiikalla. Sanoja ei ole muutettu.
Generointiskripti: `scripts/build-wordlist.mjs`.

## Kirjasimet (`public/fonts/`)

SIL Open Font License 1.1 – https://scripts.sil.org/OFL
  - Archivo, Archivo Black, Playfair Display, Quicksand, Space Mono

Apache License 2.0 – https://www.apache.org/licenses/LICENSE-2.0
  - Roboto Slab

Kirjasintiedostoja ei ole muokattu. Ks. myös `public/fonts/LICENSES.txt`.

## Ohjelmistoriippuvuudet

React ja React DOM (MIT), Vite (MIT), TypeScript (Apache-2.0).
Täydellinen luettelo: `package.json` ja `package-lock.json`.
