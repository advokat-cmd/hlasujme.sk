# Hlasovanie.sk — kompletné zadanie pre produkčnú implementáciu

> **Jeden súbor:** prompt pre AI · kontext · revízia prototypu · hlasovací engine · produkčná architektúra · akceptačné kritériá.
> Elektronické hlasovanie vlastníkov bytov a NP podľa **zákona č. 182/1993 Z. z.** Verzia 1 · 20. 6. 2026.

---

## 0. PROMPT PRE AI (Google Antigravity) — skopírujte ako zadanie

```text
Si senior full-stack inžinier. Postav PRODUKČNÚ verziu webovej aplikácie na
elektronické hlasovanie vlastníkov bytov a nebytových priestorov (Slovensko,
zákon č. 182/1993 Z. z.) podľa tohto zadania.

V repozitári máš:
- Hotový React prototyp v priečinku `Working prototype development/` — je to
  REFERENČNÉ UI a UX. Znovu ho použi: komponenty, dizajn, slovenské texty, ikony.
- Toto kompletné zadanie: súbor `HLASOVANIE-SK-SPEC.md`.

KROK 1 — prečítaj si celý prototyp aj toto zadanie (najmä sekciu 4 a 6).

KROK 2 — postav produkčnú aplikáciu:
- Stack: Next.js (App Router) + TypeScript, PostgreSQL + Prisma, transakčný e-mail
  (Postmark alebo Resend), EU hosting, len HTTPS. Žiadny Babel-standalone v produkcii.
- VŠETKU autoritatívnu logiku (hlasovací engine, prahy väčšín, overovanie tokenov a
  prihlásenia) implementuj na SERVERI. Vstupu z klienta never.
- Implementuj: admin prihlásenie (argon2id + server session), magic-link hlasovanie
  vlastníkov, transakčné e-maily, nemenný append-only audit log a zapečatenie výsledku
  po uzavretí (SHA-256 + serverová časová pečiatka).
- ZACHOVAJ PRESNE pravidlá hlasovacieho enginu zo sekcie 4 (právna korektnosť).
- Splň všetky akceptačné kritériá zo sekcie 6.
- Postupuj po fázach zo sekcie 7; po každej fáze spusti a over.

ZÁVÄZNÉ ROZHODNUTIA (neimprovizuj inak):
- Magic-link na zaevidovaný e-mail je dostatočná identifikácia vlastníka — žiadna
  silnejšia autentifikácia vlastníka.
- QES (kvalifikovaný elektronický podpis) sa NEROBÍ. Stačí hash + serverová pečiatka.
- GDPR compliance je MIMO ROZSAHU tohto buildu (neimplementuj súhlasy, retenčné
  politiky, právo na výmaz, DPA). E-maily ale drž len na serveri.
- Existujúci model typov väčšín je akceptovaný; administrátor volí typ pri každej otázke.

Začni fázou 1 (skeleton + port UI) a pokračuj. Pýtaj sa len ak je niečo v zadaní
v skutočnom rozpore.
```

---

## 1. Čo staviame

Webová aplikácia, kde **administrátor** (správca/zástupca vlastníkov) vyhlási hlasovanie a **vlastníci** hlasujú cez osobný odkaz v e-maile. Hlasovanie má **právne účinky** podľa zákona 182/1993, preto sú kľúčové: správnosť výpočtu väčšín, auditovateľnosť a nemennosť výsledku.

Dva režimy (oba sú v prototype hotové dizajnovo):
- **Admin konzola** (desktop): prehľad, dom a vlastníci, detail hlasovania s výsledkami, tvorba hlasovania, archív.
- **Vlastník · mobil**: magic-link tok — úvod → otázky → rekapitulácia → potvrdenie, so zmenou hlasu do uzávierky.

---

## 2. Východiskový prototyp (znovu použiť)

Priečinok `Working prototype development/` — React 18 + Babel-standalone (CDN). **UI/UX a texty sú referencia, prenes ich.** Súbory:

| Súbor | Obsah | Do produkcie |
|---|---|---|
| `data.jsx` | Mock dom, jednotky, vlastníci, hlasovanie, archív, prihlásenia | → DB + seed |
| `engine.jsx` | Hlasovací engine (tally, väčšiny, spoluvlastníctvo, sporné) | → **serverová služba** (sekcia 4) |
| `ui.jsx` | Zdieľané komponenty (ikony, tlačidlá, karty, modály, progress) | → React komponenty |
| `admin.jsx`, `admin-poll.jsx`, `admin-create.jsx` | Admin obrazovky | → stránky/komponenty |
| `voter.jsx`, `ios-frame.jsx` | Mobilný flow vlastníka | → stránky/komponenty |
| `tweaks-panel.jsx` | Dizajnový nástroj | **odstrániť** (len prototyp) |

Prototyp už prešiel revíziou a opravami (sekcia 3) — výsledné správanie zachovaj.

---

## 3. Čo už bolo zrevidované a opravené (zachovať správanie)

- **Sporné byty** sa počítajú cez **ktorúkoľvek otázku** (nie len prvú).
- **Upozornenia** v prehľade sú **odvodené z dát/enginu** (sporné byty, chýbajúce e-maily, vlastník viacerých jednotiek, čo nehlasoval za všetky) — nie napevno.
- Engine **rešpektuje `votes`** jednotky (váhovo) a režim **`internal` bez podielových hlasov** = nerozhodnuté (nie tichý jeden hlas).
- Štatistiky domu/tvorby sú **odvodené z dát**.
- **Prístupnosť (WCAG 2.2 AA):** dialógy `role="dialog"`+Esc+focus-trap, `aria-pressed` na hlasovaní, klávesovo dostupné riadky/karty, názvy ikonových tlačidiel, `role="progressbar"`, viditeľný `:focus-visible`, dostatočný kontrast. **Drž túto úroveň prístupnosti.**

---

## 4. Hlasovací engine — PRESNÉ pravidlá (právna korektnosť, implementuj 1:1 na serveri)

**Hlasy na jednotku:** každá jednotka má `votes` hlasov (default 1). `total = Σ votes` všetkých jednotiek. (Model „1 hlas/byt a NP" po novele 182/1993 účinnej od 1. 11. 2018.)

**Efektívny hlas jednotky** pre otázku:
1. Ak má jednotka **podielové hlasy spoluvlastníkov** (režim `internal`): pre každú odpoveď sčítaj podiely; ak jedna odpoveď má **> 0,5 podielov** → tá odpoveď; inak → **sporný (disputed)**.
2. Ak režim `internal` a podielové hlasy **chýbajú** → **nerozhodnuté** (počíta sa ako „nehlasoval").
3. Inak (`single`/`rep`/`majority`/`bsm`/`legal`): zaznamenaná jediná odpoveď jednotky.

**Sčítanie otázky** (váhované cez `votes`): počty `agree` / `disagree` / `abstain` / `none` (nehlasoval) / `disputed`. `voted = agree + disagree + abstain`.

**Typy väčšín** (`need` = potrebný počet hlasov „súhlasím"):

| Kľúč | Vzorec | Význam |
|---|---|---|
| `half-all` | `floor(total/2)+1` | > 1/2 všetkých vlastníkov |
| `twothirds-all` | `ceil(total*2/3)` | ≥ 2/3 všetkých vlastníkov |
| `all` | `total` | súhlas všetkých |
| `half-present` | `floor(voted/2)+1` | > 1/2 hlasujúcich |

**Výsledok otázky:**
- `agree ≥ need` → **schválené (approved)**.
- inak počas otvoreného hlasovania: ak `agree + none + disputed ≥ need` → **zatiaľ nedosiahnutá väčšina (short)**; inak **neschválené (rejected)**.
- **Po uzavretí** hlasovania sa `short` vyhodnotí ako **rejected** (už nie je čo doplniť).

**Ďalšie pravidlá:**
- „Nechcem hlasovať" (abstain) sa pri `*-all` typoch de facto ráta ako nesúhlas (prah je z počtu **všetkých**).
- Priebežné výsledky vidí **len administrátor**; vlastník ich počas hlasovania nevidí.
- Administrátor priraďuje typ väčšiny **ku každej otázke** podľa §14b (zodpovednosť používateľa).

---

## 5. Produkčná architektúra

### Stack
Next.js (App Router) + TypeScript · PostgreSQL + Prisma · server-side session auth · magic-link hlasovanie · transakčný e-mail (Postmark/Resend, doména hlasovanie.sk s DKIM/SPF/DMARC) · EU hosting · HTTPS. **Žiadny Babel-standalone, žiadne tajomstvá v bundle.**

### Dátový model (Prisma)
- **buildings** — dom, adresa, vchod, správca, kontakt.
- **units** — `no, type (byt/nebyt), floor, votes, coMode, buildingId`.
- **owners** — `meno, email, share, role, unitId`.
- **admins** — `email, passwordHash (argon2id), name, unitId?, totpSecret?`.
- **polls** — `title, reason, declarer, announcedAt, startAt, endAt, status (draft/active/closed)`.
- **questions** — `pollId, no, kind, text, majorityType, note`.
- **voteTokens** — `pollId, unitId, tokenHash, expiresAt, usedAt` (token len ako **hash**).
- **votes** *(append-only)* — `pollId, unitId, questionNo, answer, version, createdAt, sourceIp, tokenId`. Zmena = nová verzia; platí najvyššia.
- **coownerSubvotes** — podielové hlasy pre `internal`.
- **auditLog** *(append-only, hash-chain)* — `action, actor, payload, prevHash, entryHash, createdAt`.
- **sealedResults** — po uzavretí: JSON výsledkov + `sha256`, serverová časová pečiatka, cesta k PDF zápisnici.

### Magic-link tok
1. Spustenie hlasovania → pre každú jednotku **CSPRNG token ≥ 32 B**, ulož len `tokenHash`, viazaný na `(poll, unit)`, platný v okne hlasovania.
2. Transakčný e-mail **per-príjemca** s osobným linkom (žiadny príjemca nevidí cudziu adresu).
3. Otvorenie linku → server overí `tokenHash` + okno → zobrazí otázky pre danú jednotku.
4. Odoslanie hlasu (HTTPS POST) → server overí token + otvorenosť → zapíše `votes(version+1, serverový čas)` + `auditLog`.
5. **Zmena hlasu** do uzávierky = nová verzia. **Žiadne dvojhlasovanie** (DB constraint na `(pollId, unitId, questionNo, version)`).

### Audit a zapečatenie (bez QES)
`votes` a `auditLog` sú **append-only**; `auditLog` reťazí hashe (odhalí manipuláciu). Po uzavretí server prepočíta výsledky autoritatívnym enginom, vygeneruje **PDF zápisnicu**, spočíta **SHA-256** dát aj PDF a uloží so **serverovou časovou pečiatkou**. Archív je nemenný; oprava len dodatkom. *(QES sa nerobí — rozhodnutie zadávateľa.)*

### Bezpečnosť
HTTPS-only · CSP a bezpečnostné hlavičky · rate-limiting (prihlásenie aj hlasovanie) · argon2id · tajomstvá v env/vault · build pipeline · zálohy + skúšky obnovy · pred ostrým spustením penetračný test.

---

## 6. Akceptačné kritériá (musia prejsť)

**Engine na demo dátach (36 jednotiek):**
- Otázka 1 (`half-all`) → **schválené**, `agree 19 / need 19`.
- Otázka 2 (`half-all`) → **short**, `agree 18 / need 19`, `disputed 1`.
- Otázka 3 (`twothirds-all`) → **short**, `agree 10 / need 24`, `disputed 1`.
- Sporná jednotka = **byt č. 12** na otázkach 2 a 3 (spoluvlastníci 50/50 bez väčšiny podielov).
- „Sporné byty" v prehľade = **1** (počíta ktorúkoľvek otázku).

**Hlasovanie:**
- Token je CSPRNG, v DB len hash, viazaný na jednu jednotku a jedno hlasovanie, platný len v okne.
- Zmena hlasu pred uzávierkou → nová verzia; ráta sa najvyššia; dvojhlas nie je možný.
- Všetky časy sú serverové; klientske hodnoty sa neberú.
- Po uzavretí vznikne `sealedResult` (SHA-256 + serverová pečiatka); archív je nemenný.

**Auth:** heslá argon2id, server session, rate-limiting; vlastník nemá účet (len link).

**Prístupnosť:** zachovaná úroveň WCAG 2.2 AA zo sekcie 3.

---

## 7. Fázy realizácie

1. **Skeleton** — Next.js + TS, port React UI z prototypu, build pipeline.
2. **Dáta** — PostgreSQL + Prisma, migrácie, seed z `data.jsx`.
3. **Admin auth** — argon2id, session, rate-limit, (voliteľne TOTP 2FA).
4. **Engine na serveri** — prenos pravidiel zo sekcie 4 + testy (akceptačné kritériá).
5. **Magic-link hlasovanie** — tokeny, tok, verziovanie, audit log.
6. **E-maily** — provider, DKIM/SPF/DMARC, šablóny (pozvánka, pripomienka, potvrdenie, výsledok).
7. **Zápisnica + zapečatenie + hardening** — PDF, SHA-256, serverová pečiatka, CSP/hlavičky, zálohy, penetračný test.

---

## 8. Záväzné rozhodnutia zadávateľa

| Téma | Rozhodnutie |
|---|---|
| Identifikácia vlastníka | **Magic-link na e-mail stačí** (žiadna silnejšia autentifikácia). |
| Typy väčšín / mapovanie | **OK** — administrátor volí typ pri každej otázke podľa §14b. |
| QES (kvalif. el. podpis) | **Nerobí sa** (stačí hash + serverová časová pečiatka). |
| GDPR | **Mimo rozsahu tohto buildu** (e-maily však ostávajú len na serveri). |

*Stack a poskytovatelia (Next.js, Postmark/Resend, hosting) sú odporúčania — meniteľné podľa preferencií zadávateľa.*
