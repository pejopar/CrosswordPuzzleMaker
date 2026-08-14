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

Sovellus on optimoitu työpöytäselaimille ja toimii aina 1024 px:n CSS-leveyteen asti.
Työkalupalkki tiivistyy portaittain, kun tilaa on vähemmän – esimerkiksi selaimen
125 %:n zoomauksella 1920×1080-näyttö vastaa 1536×864 px:ää – ja harvemmin käytetyt
toiminnot (uusi/avaa/tallenna, ruudukon koko) siirtyvät ⋯-valikkoon. Vientipainike
pysyy aina näkyvissä. Tätä kapeammilla näytöillä näytetään suositus käyttää
tietokonetta.

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
- **Ruudukon muokkaus**: kaksoisklikkaus valitsee koko sanan, Ctrl+klikkaus kerää useita
  alueita monivalintaan (ryhmäsiirto ja -poisto), Ctrl+rulla zoomaa kanvaasia,
  kirjainten kirjoitus näppäimistöltä (myös Ä, Ö, Å), nuolinäppäinnavigointi,
  hiiren oikean napin kontekstivalikko, rivien ja sarakkeiden lisäys/poisto
  (plus-painikkeet ruudukon reunoilla), alueiden koon muutos kahvasta, kumoa/tee uudelleen.
- **Sanat ja vihjeet**: haku, suodatus, järjestäminen, sijoitus- ja ristiriitatilat,
  pakolliset sanat, massaliittäminen muodossa `VASTAUS; VIHJE`, CSV-tuonti,
  sarakkeiden valinta ja tuonnin esikatselu kaksoiskappaleiden korostuksella.
- **Kuvat**: kuvien lataus (JPEG/PNG/WebP/SVG), raahaus vihjealueille, sovitus/rajaus,
  zoomaus, alt-tekstit, viimeksi käytetyt. Isot valokuvat pienennetään automaattisesti
  selaimessa tulostuskokoon (enintään 1400 px), joten kameran kuvatkin kelpaavat, ja
  paneeli näyttää kuinka paljon selaimen tallennustilaa kuvat vievät. Mallikuvat ovat
  alkuperäisiä piirroskuvituksia.
- **Sanaehdotukset oikeasta sanastosta**: sovelluksessa on ~56 700 suomen sanan sanasto
  (laiskasti ladattava), ja valitun kohdan risteyskirjaimet toimivat hakurajoitteina –
  jokainen ehdotus sopii ruudukkoon sellaisenaan. Ehdotukset järjestetään tuttuuden
  mukaan, ja paneeli näyttää myös kuvioon sopivien sanojen kokonaismäärän.
  Automaattitäyttö ja kirjoituksen ennakointi käyttävät samaa sanastoa.
- **Tekoälyavustin**: vihjeiden generointi ja muokkaus (helpompi/vaikeampi/lyhyempi/
  hauskempi) ovat vielä mock-toteutuksia, jotka on eriytetty rajapinnaksi
  (`src/logic/ai.ts`) oikean AI-palvelun kytkemistä varten. Kaikki ehdotukset
  esikatsellaan – mitään ei muuteta ilman hyväksyntää, ja kaikki muutokset voi kumota.
- **Tarkistus**: ristiriitaiset risteykset, sijoittamattomat pakolliset sanat,
  kaksoisvastaukset, vihjeettömät sanat, linkittämättömät kuvat, virheelliset nuolet,
  eristyneet ruudut, puuttuva otsikko ym. – luokiteltuina virheiksi, varoituksiksi ja
  ehdotuksiksi.
- **Esikatselu ja vienti**: rakennusnäkymä, ratkojan esikatselu (kirjaimet piilotettu) ja
  ratkaisunäkymä; vienti PNG:nä, SVG:nä tai tulostettavana PDF:nä (selaimen tulostus),
  ratkaisu omalle sivulleen. **Läpinäkyvä tausta** -valinta tuottaa PNG:n ja SVG:n ilman
  paperitaustaa, jolloin ristikon voi tiputtaa suoraan Canvaan, Wordiin tai
  PowerPointiin. Projekti tallentuu automaattisesti selaimeen ja sen voi ladata
  `.ristikko.json`-tiedostoksi, joka avautuu takaisin täsmälleen samanlaisena;
  sovellus myös muistuttaa lataamaan varmuuskopion työskentelyn lomassa.

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

## Julkaisu (Vercel)

Sovellus on staattinen Vite-sovellus, jonka Vercel tunnistaa automaattisesti:
build-komento `npm run build`, julkaisuhakemisto `dist`. Palvelinta, ympäristö-
muuttujia tai reitityssääntöjä ei tarvita.

Ennen julkaisua:

1. Lisää maksupalvelun osoite `DONATE_URL`-vakioon ja QR-koodikuva
   `DONATE_QR_IMAGE`-vakioon (`src/config/donate.ts`).
2. Vaihda `index.html`:n `canonical`- ja `og:*`-osoitteet oikeaan verkkotunnukseen
   (nyt `https://ristikkostudio.fi/`), samoin `public/sitemap.xml` ja
   `public/robots.txt`.

Sovellus ei tee yhtään ulkoista verkkopyyntöä: kirjasimet, kuvat ja sanasto
tulevat omalta palvelimelta, eikä evästeitä tai analytiikkaa käytetä.

## Lahjoituspainike (paikanvaraus)

Lahjoituskehotukset on koottu tiedostoon `src/config/donate.ts`. Lisää maksupalvelun
osoite (esim. Stripe Payment Link, Buy Me a Coffee, Ko-fi tai MobilePay)
`DONATE_URL`-vakioon ennen julkaisua – kun se on tyhjä, painikkeet näyttävät
paikanvarausviestin. Sovellus ei kerää maksutietoja itse, vaan avaa
palveluntarjoajan sivun uuteen välilehteen.

Kehotuksia on neljä, kaikki hillittyjä:

1. **Vientimodaali** – kortti juuri ennen vientipainikkeita, näkyy kun käyttäjä saa
   valmiin ristikon.
2. **Työkalupalkin sydänpainike** – aina saatavilla, ei koskaan keskeytä työtä.
3. **Puhekupla** – kurkistaa sydänpainikkeesta noin viiden minuutin välein, vaihtaa
   tekstiä joka kerta ja katoaa itsestään 12 sekunnissa. Ei ilmesty, kun modaali on
   auki tai välilehti on taustalla.
4. **Alapalkki** – nousee näkyviin vasta kolmannen viennin jälkeen ja sen jälkeen
   kymmenen viennin välein. Ei peitä kanvasta.

"Älä näytä uudelleen" hiljentää sekä alapalkin että puhekuplan pysyvästi
(localStorage). QR-koodille on paikanvaraus lahjoitusmodaalissa.

## Tyylit ja teemat

Tyyli-paneelissa on kuusi valmista teemaa (Pop, Klassikko, Retro, Neon, Luonto,
Mustavalko), jotka asettavat koko visuaalisen ilmeen yhdellä klikkauksella –
sisältö (otsikko, tekijä, johdanto, alatunniste, logo) säilyy teemaa vaihtaessa.
Kaikki asetukset ovat säädettävissä teeman päälle: korostusväri, viivan paksuus ja
väri, kulmien pyöristys, estettyjen ruutujen tyyli (täysi/tumma/vinoviivoitus/
korostusväri), otsikon tyyli (palkki/alleviivaus/kehys/pelkkä teksti), kuusi
kirjasintyyliä, nuolien koko ja tyyli sekä alatunniste. Oman tyylin voi tallentaa
uudelleenkäytettäväksi teemaksi (localStorage). Kaikki tyylit siirtyvät myös
SVG-, PNG- ja tulostusvientiin.

## Sanasto

Sanaehdotusten sanasto (`src/logic/words-fi.ts`, ~56 700 sanaa) on generoitu
[Kotuksen nykysuomen sanalistasta](https://kaino.kotus.fi/sanat/nykysuomi/)
(CC BY 4.0), joka on ladattu
[hugovk/everyfinnishword](https://github.com/hugovk/everyfinnishword)-peilistä.
Sanat suodatetaan pituuden (3–11) ja merkistön mukaan, ja niiden tuttuus
arvioidaan Ristikkostudion omalla heuristiikalla (kirjaintiheys, pituus ja käsin
koottu arkisanasto). Share-alike-ehtoisia aineistoja ei käytetä.

Uudelleengenerointi: `node scripts/build-wordlist.mjs kaikkisanat.txt`

Ks. myös `NOTICE.md`.

## Lisenssi

Lähdekoodi: MIT (`LICENSE`). Kolmansien osapuolten aineistot ja niiden lisenssit:
`NOTICE.md`.

## Huomioita

- Prototyyppi ei vaadi käyttäjätiliä eikä pilvitallennusta.
- Esimerkkisisältö on kuvitteellinen "Viikon pop-ristikko" -projekti, jonka kaikki sanat,
  vihjeet ja kuvitukset ovat alkuperäisiä.
