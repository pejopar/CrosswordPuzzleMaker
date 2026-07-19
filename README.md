# Ristikkostudio

**Ristikkostudio** on työpöytäselaimeen suunniteltu prototyyppi suomalaisten kuva- ja
vihjeristikoiden visuaaliseen rakentamiseen – rohkea, leikkisä ja toimituksellinen työkalu,
joka sopii sekä ensikertalaiselle että ammattilaiskonstruoijalle.

## Käynnistys

```bash
npm install
npm run dev        # kehityspalvelin osoitteessa http://localhost:5173
npm run build      # tuotantokäännös dist/-kansioon
npm run preview    # käännöksen esikatselu
```

Sovellus on optimoitu vähintään 1280 px leveille näytöille. Pienemmillä näytöillä näytetään
suositus käyttää tietokonetta.

## Ominaisuudet (prototyyppi)

- **Suomalainen ristikkomalli**: vihjeet ruutujen sisällä, kuvavihjealueet, suuntanuolet
  (oikealle, alas, kääntyvät nuolet) – vastaukset kulkevat aina vain oikealle tai alas,
  vinottaisia sanoja ei voi syntyä.
- **Työpöytäsovelluksen käyttöliittymä**: ylätyökalupalkki, vasen sivupaneeli
  (Sisältö / Rakenne / Sanat ja vihjeet / Kuvat / Tyyli), keskellä tulostussivua jäljittelevä
  kanvaasi ja oikealla valinnan mukaan vaihtuva tarkastelupaneeli sekä alhaalla
  tarkistuspaneeli.
- **Raahaa ja pudota**: vedä sanoja sanalistasta suoraan ruudukkoon (Shift = pystysuunta,
  vihreä/punainen esikatselu näyttää sopivuuden), vedä kuvia vapaisiin ruutuihin uusiksi
  kuvavihjealueiksi ja vedä vihje-, kuva-, este- ja koristetyökaluja ruudukkoon.
- **Siirrä ja käännä**: Siirrä/käännä-työkalulla sanoja ja alueita voi raahata uuteen
  paikkaan suoraan ruudukossa (vihreä/punainen esikatselu näyttää sopivuuden), R kääntää
  sanan vaaka ↔ pysty tai alueen 90°, ja nuolinäppäimet siirtävät valittua elementtiä
  ruudun kerrallaan. Käännöt ovat aina ruudukon suuntaisia – vinottaisia sanoja ei synny.
- **Ruudukon muokkaus**: ruutujen valinta, aluevalinta vetämällä ja Shift-klikkauksella,
  kirjainten kirjoitus näppäimistöltä (myös Ä, Ö, Å), nuolinäppäinnavigointi,
  hiiren oikean napin kontekstivalikko, rivien ja sarakkeiden lisäys/poisto
  (plus-painikkeet ruudukon reunoilla), alueiden koon muutos kahvasta, kumoa/tee uudelleen.
- **Sanat ja vihjeet**: haku, suodatus, järjestäminen, sijoitus- ja ristiriitatilat,
  pakolliset sanat, massaliittäminen muodossa `VASTAUS; VIHJE`, CSV-tuonti,
  sarakkeiden valinta ja tuonnin esikatselu kaksoiskappaleiden korostuksella.
- **Kuvat**: kuvien lataus (JPEG/PNG/WebP), raahaus vihjealueille, sovitus/rajaus,
  zoomaus, alt-tekstit, viimeksi käytetyt. Mallikuvat ovat alkuperäisiä piirroskuvituksia.
- **Tekoälyavustin (mock)**: sanaehdotukset risteyskirjainten ja pituuden perusteella,
  vihjeiden generointi ja muokkaus (helpompi/vaikeampi/lyhyempi/hauskempi),
  automaattitäyttö asetuksineen. Kaikki ehdotukset esikatsellaan – mitään ei muuteta
  ilman hyväksyntää, ja kaikki muutokset voi kumota.
- **Tarkistus**: ristiriitaiset risteykset, sijoittamattomat pakolliset sanat,
  kaksoisvastaukset, vihjeettömät sanat, linkittämättömät kuvat, virheelliset nuolet,
  eristyneet ruudut, puuttuva otsikko ym. – luokiteltuina virheiksi, varoituksiksi ja
  ehdotuksiksi.
- **Esikatselu ja vienti**: rakennusnäkymä, ratkojan esikatselu (kirjaimet piilotettu) ja
  ratkaisunäkymä; vienti PNG:nä, SVG:nä tai tulostettavana PDF:nä (selaimen tulostus),
  ratkaisu omalle sivulleen; projektin tallennus ja avaus JSON-tiedostona sekä
  automaattinen paikallinen tallennus (localStorage).

## Arkkitehtuuri

```
src/
  model/        Tietomalli (Project, Cell, Region, WordEntry, Placement, …) ja esimerkkiprojekti
  state/        Keskitetty tila: reducer + kumoa/tee uudelleen -historia + automaattitallennus
  logic/
    grid.ts     Ruudukko-operaatiot: rivit/sarakkeet, sijoitukset, automaattinen sijoittelija
    validate.ts Tarkistussäännöt
    ai.ts       Tekoälyavustimen mock-rajapinta (vaihdettavissa oikeaan palveluun)
    importer.ts Sanalistojen jäsennys (liitetty teksti, CSV)
    exporter.ts SVG/PNG/projektitiedoston vienti ja tulostusarkin rakentaminen
  components/   React-komponentit: työkalupalkki, sivupaneelit, kanvaasi, tarkastelu, modaalit
```

Tekoälylogiikka (`src/logic/ai.ts`) on eriytetty editorista ja viennistä, joten mock-funktiot
voi korvata oikeilla API-kutsuilla muuttamatta muuta sovellusta.

## Huomioita

- Prototyyppi ei vaadi käyttäjätiliä eikä pilvitallennusta.
- Esimerkkisisältö on kuvitteellinen "Viikon pop-ristikko" -projekti, jonka kaikki sanat,
  vihjeet ja kuvitukset ovat alkuperäisiä.
