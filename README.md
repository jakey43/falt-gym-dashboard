# Fält – personlig gym- och kostdashboard

Fält samlar träning från **Hevy**, makron från **Lifesum** och näringsuppslag från **Livsmedelsverket** på ett ställe.
All data sparas lokalt i webbläsaren (IndexedDB) – ingen server, inget konto.

## Integrationer – vad som faktiskt går

| Källa | Status | Hur Fält använder den |
|---|---|---|
| Hevy | Officiellt API finns men kräver **Hevy Pro**. | **CSV-import** av Hevys egen export (Profil → Inställningar → Export & Import Data → Export Workouts). Hanterar kg och lbs samt båda datumformaten Hevy använt. |
| Lifesum | **Inget publikt API**, ingen CSV-export. | Dagens totalsumma (kcal, protein, kolhydrater, fett, ev. fiber) **skrivs in manuellt** under Kost. |
| Livsmedelsverket | Öppet API, CC BY 4.0. | Hela databasen (~2 600 livsmedel, 27 näringsämnen) paketeras i appen → snabba matfrågor, även offline. Uppdatera med `npm run data:slv`. |
| Open Food Facts | Öppet API. | Reserv för märkesvaror och streckkoder (mikronäringsämnen saknas ofta). |
| USDA FoodData Central | Öppet API, gratis nyckel. | Reserv (sök på engelska). Nyckeln läggs in under Data och sparas bara lokalt. |

## Funktioner

- **Översikt** – senaste pass, veckans pass, muskelgrupper (”fältkartan”), dagens kalorier/makron, mikronäringsämnen, rekord, vikt, trender.
- **Träning** – volym per vecka, set per muskelgrupp mot riktmärke, rekommendationer, progression per övning (uppskattat 1RM, Epley), passhistorik med alla set, personliga rekord.
- **Kost** – Lifesum-makron per dag, livsmedel från matfrågor, mål mot faktiskt, vitaminer & mineraler mot referensvärden (NNR 2023), 14-dagarsdiagram och veckosnitt.
- **Matfråga** – skriv t.ex. `333 g sötpotatis, rå` eller `4 ägg och 200 g ris`. Fält
  - skiljer på **rå och tillagad** vara och frågar när det är oklart,
  - räknar om styck (ägg, banan …) och volym (dl, msk) till gram och visar alltid uppskattningen,
  - visar källa och livsmedelsnummer för varje rad, och låter dig byta livsmedel eller söka i fler källor.
- **Progress** – vikt med trendlinje, träningsvolym över 6 månader, rekordlogg och nyckeltrender (vikt/vecka, protein per kg, energi mot mål).
- **Data** – CSV-import, mappning övning → muskelgrupp, mål, USDA-nyckel, backup/återställning (JSON) och exempeldata.

### Regler bakom rekommendationerna
- ~10 arbetsset/vecka per stor muskelgrupp, ~6 för core och vader (sekundära muskler räknas som ½ set).
- Muskelgrupp som inte tränats på >10 dagar flaggas.
- Övning körd ≥4 gånger senaste 8 veckorna: står uppskattat 1RM still på fyra pass → förslag; alla set på toppvikten ≥12 reps → öka vikten.

## Kom igång

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # enhetstester (parser, matchning, analys)
npm run build     # statiska filer i dist/
```

Bygget är helt statiskt (`base: './'`) och kan läggas på t.ex. GitHub Pages, Netlify eller Vercel, eller öppnas lokalt via `npm run preview`.
På iPhone: öppna sidan i Safari → Dela → Lägg till på hemskärmen.

## Kända begränsningar
- Hevy-CSV:n saknar muskelgrupper; de gissas från övningsnamn (engelska och vanliga svenska) och kan ändras under Data.
- Lifesum lämnar inte ut mikronäringsämnen – vitaminer och mineraler kommer bara från det du loggar via Matfråga.
- Styckvikter och volym→gram är uppskattningar (visas alltid).
- Data ligger per webbläsare/enhet. Använd backup för att flytta den.

## Källor och licenser
- Livsmedelsverkets livsmedelsdatabas, CC BY 4.0 – https://www.livsmedelsverket.se/om-oss/psidata/livsmedelsdatabasen
- Open Food Facts, ODbL – https://world.openfoodfacts.org
- USDA FoodData Central, public domain – https://fdc.nal.usda.gov
