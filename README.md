# Hlasujme.sk

Aplikácia na elektronické hlasovanie vlastníkov bytov. Produkcia beží na trvalom serveri Hetzner, nie na platforme Vercel.

## Lokálny vývoj

```bash
npm install
npx prisma generate
npm run dev
```

Pred odovzdaním zmien spustite `npm run check` a `npm run build`.

## Integračné testy

`npm run test:integration` objaví všetky štyri súbory v `tests/integration/` a spúšťa ich postupne (`--test-concurrency=1`). Súbežný beh celých súborov nie je bezpečný: test životného cyklu používa prvý dom a test súbežnosti dočasne zamyká tabuľky. Jednotlivé testy si riadenú súbežnosť vytvárajú samy.

Použite izolovanú pracovnú kópiu bez produkčných `.env` súborov, prázdnu lokálnu testovaciu PostgreSQL databázu s aplikovanou schémou aplikácie a samostatné úložisko. Testy nikdy nespúšťajte proti produkcii. Vytvorte necommitovaný `.env.integration` napríklad s týmito výlučne testovacími hodnotami; adresu, heslo databázy a absolútnu cestu úložiska prispôsobte lokálnemu prostrediu:

```dotenv
DATABASE_URL="postgresql://test_user:test_password@127.0.0.1:55473/hlasujme_test_audit?schema=hlasujme_test_audit"
STORAGE_ROOT="C:/absolute/path/to/disposable-audit-storage"
SESSION_SECRET="local-integration-only-secret-at-least-32-characters"
EMAIL_PROVIDER="resend"
EMAIL_API_KEY="re_mock_local_integration_only"
NEXT_PUBLIC_BASE_URL="http://localhost:3217"
INTEGRATION_BASE_URL="http://localhost:3217"
ALLOW_DESTRUCTIVE_TEST_DB="1"
TRUST_PROXY="1"
```

Server aj testy musia dostať rovnakú konfiguráciu databázy a úložiska. V prvom termináli spustite lokálny vývojový server s testovacími e-mailami:

```bash
node --env-file=.env.integration node_modules/next/dist/bin/next dev --webpack -p 3217
```

V druhom termináli spustite všetky integračné testy:

```bash
node --env-file=.env.integration --import tsx --test --test-concurrency=1 tests/integration/*.test.ts
```

Samotné `npm run test:integration` súbor `.env.integration` automaticky nenačíta; používa už exportované premenné. Vyššie uvedený priamy príkaz načíta zvolený súbor explicitne. Bez `INTEGRATION_BASE_URL` sa štyri integračné sady preskočia, čo nie je overený integračný beh. Reálny beh navyše kontroluje lokálny host, schému `hlasujme_test_*`, explicitné povolenie testovacej databázy a pri testoch e-mailov testovací kľúč. Testy vytvárajú syntetické dáta a odstraňujú iba svoje záznamy; auditné udalosti zostávajú v jednorazovej databáze.

## Produkcia na Hetzneri

Povinné premenné prostredia:

- `DATABASE_URL` smeruje do spoločnej PostgreSQL databázy `lemon` a musí obsahovať `?schema=hlasujme`.
- `SESSION_SECRET` má aspoň 32 náhodných znakov.
- `STORAGE_ROOT` je absolútna cesta k perzistentnému úložisku mimo repozitára.
- `TRUST_PROXY=1` nastavte iba vtedy, keď reverzný proxy server prepisuje hlavičky klientskych IP a aplikácia nie je dostupná priamo.

Nasadenie databázových zmien robte iba príkazom `npx prisma migrate deploy`. Pred migráciou vytvorte zálohu databázy `lemon`. Aplikácia smie meniť iba schému `hlasujme`; schémy a tabuľky aplikácie Lemon sú mimo jej rozsahu.

Destruktívny skript `scripts/clear-db.ts` zámerne odmietne produkčnú schému. Spustí sa iba s `ALLOW_DESTRUCTIVE_TEST_DB=1` a URL schémy v tvare `hlasujme_test_*`.
