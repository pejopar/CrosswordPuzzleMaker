import { Issue, Project } from '../model/types';
import { placementCells, inBounds } from './grid';

export function validateProject(p: Project): Issue[] {
  const issues: Issue[] = [];

  // Ristiriitaiset risteyskirjaimet ja ruudukon ulkopuolelle jatkuvat sanat
  for (const pl of p.placements) {
    const entry = p.entries.find((e) => e.id === pl.entryId);
    const word = entry ? [...entry.answer.toUpperCase()] : [];
    const cellsOfPl = placementCells(pl);
    cellsOfPl.forEach((pc, i) => {
      if (!inBounds(p, pc.r, pc.c)) {
        issues.push({
          severity: 'virhe',
          message: `Sana ${entry?.answer ?? '?'} jatkuu ruudukon ulkopuolelle`,
          target: { r: Math.min(pc.r, p.rows - 1), c: Math.min(pc.c, p.cols - 1) },
        });
        return;
      }
      const cell = p.cells[pc.r][pc.c];
      if (cell.type !== 'letter') {
        issues.push({
          severity: 'virhe',
          message: `Sanan ${entry?.answer ?? '?'} ruutu (${pc.r + 1}, ${pc.c + 1}) ei ole kirjainruutu`,
          target: pc,
        });
      } else if (word[i] && cell.letter && cell.letter !== word[i]) {
        issues.push({
          severity: 'virhe',
          message: `Ristiriita ruudussa (${pc.r + 1}, ${pc.c + 1}): ${cell.letter} ≠ ${word[i]} (${entry?.answer})`,
          target: pc,
        });
      }
    });
  }

  // Sijoittamattomat pakolliset sanat
  for (const e of p.entries) {
    const placed = p.placements.some((pl) => pl.entryId === e.id);
    if (!placed && e.required) {
      issues.push({ severity: 'virhe', message: `Pakollinen sana ${e.answer} on sijoittamatta` });
    } else if (!placed) {
      issues.push({ severity: 'ehdotus', message: `Sana ${e.answer} on vielä sijoittamatta` });
    }
  }

  // Kaksoisvastaukset
  const seen = new Map<string, number>();
  for (const e of p.entries) {
    const key = e.answer.toUpperCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [word, count] of seen) {
    if (count > 1) issues.push({ severity: 'varoitus', message: `Vastaus ${word} esiintyy ${count} kertaa` });
  }

  // Vastaukset ilman vihjettä
  for (const e of p.entries) {
    const hasImage = !!e.imageId || p.regions.some((rg) => rg.kind === 'image' && rg.entryId === e.id);
    if (!e.clue.trim() && !hasImage) {
      issues.push({ severity: 'varoitus', message: `Sanalla ${e.answer} ei ole vihjettä` });
    }
  }

  // Vihjeet ilman vastausta ja kuvat ilman linkitystä
  for (const rg of p.regions) {
    if (rg.kind === 'text' && !rg.entryId && !(rg.text ?? '').trim()) {
      issues.push({ severity: 'varoitus', message: `Tyhjä vihjealue kohdassa (${rg.r + 1}, ${rg.c + 1})`, target: { r: rg.r, c: rg.c } });
    }
    if (rg.kind === 'text' && rg.entryId && !p.entries.some((e) => e.id === rg.entryId)) {
      issues.push({ severity: 'virhe', message: `Vihjealue viittaa poistettuun sanaan (${rg.r + 1}, ${rg.c + 1})`, target: { r: rg.r, c: rg.c } });
    }
    if (rg.kind === 'image' && !rg.entryId) {
      issues.push({ severity: 'varoitus', message: `Kuvavihjettä (${rg.r + 1}, ${rg.c + 1}) ei ole linkitetty vastaukseen`, target: { r: rg.r, c: rg.c } });
    }
    if (rg.kind === 'image' && !rg.imageId) {
      issues.push({ severity: 'ehdotus', message: `Kuva-alueesta (${rg.r + 1}, ${rg.c + 1}) puuttuu kuva`, target: { r: rg.r, c: rg.c } });
    }
    // Nuolet epäkelpoihin ruutuihin
    if (rg.arrow) {
      const tr = rg.arrow.edge === 'bottom' ? rg.r + rg.h : rg.r;
      const tc = rg.arrow.edge === 'right' ? rg.c + rg.w : rg.c;
      const target =
        rg.arrow.edge === 'bottom'
          ? { r: tr, c: rg.c + Math.min(rg.w - 1, Math.max(0, rg.w - 1)) }
          : { r: rg.r, c: tc };
      const cell = inBounds(p, target.r, target.c) ? p.cells[target.r][target.c] : null;
      if (!cell || cell.type !== 'letter') {
        issues.push({
          severity: 'virhe',
          message: `Nuoli osoittaa epäkelpoon ruutuun kohdassa (${rg.r + 1}, ${rg.c + 1})`,
          target: { r: rg.r, c: rg.c },
        });
      }
    }
    if (rg.fontSize && rg.fontSize < 7) {
      issues.push({ severity: 'varoitus', message: `Vihjeteksti kohdassa (${rg.r + 1}, ${rg.c + 1}) voi olla liian pientä tulostukseen`, target: { r: rg.r, c: rg.c } });
    }
  }

  // Eristyneet kirjainruudut
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++) {
      const cell = p.cells[r][c];
      if (cell.type !== 'letter') continue;
      const nbLetter = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ].some(([rr, cc]) => inBounds(p, rr, cc) && p.cells[rr][cc].type === 'letter');
      if (!nbLetter) {
        issues.push({ severity: 'varoitus', message: `Eristynyt kirjainruutu kohdassa (${r + 1}, ${c + 1})`, target: { r, c } });
      }
    }

  // Tyhjät kirjainruudut (täyttämättömät alueet)
  let emptyLetters = 0;
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++)
      if (p.cells[r][c].type === 'letter' && !p.cells[r][c].letter) emptyLetters++;
  if (emptyLetters > 0) {
    issues.push({ severity: 'ehdotus', message: `${emptyLetters} kirjainruutua on vielä ilman ratkaisukirjainta` });
  }

  // Otsikko
  if (!p.style.title.trim()) {
    issues.push({ severity: 'varoitus', message: 'Ristikolta puuttuu otsikko' });
  }

  // Epätavalliset lyhenteet / harvinaiset sanat (mock-heuristiikka)
  for (const e of p.entries) {
    if (e.answer.length <= 2) {
      issues.push({ severity: 'ehdotus', message: `Hyvin lyhyt vastaus ${e.answer} – varmista että se on tunnettu` });
    }
    if (/^[BCDFGHJKLMNPQRSTVWXZ]+$/i.test(e.answer)) {
      issues.push({ severity: 'ehdotus', message: `${e.answer} näyttää lyhenteeltä – harkitse yleiskielistä sanaa` });
    }
  }

  return issues.sort((a, b) => {
    const order = { virhe: 0, varoitus: 1, ehdotus: 2 } as const;
    return order[a.severity] - order[b.severity];
  });
}
