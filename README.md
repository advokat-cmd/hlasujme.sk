# Hlasujme.sk

Aplikácia na elektronické hlasovanie vlastníkov bytov. Produkcia beží na trvalom serveri Hetzner, nie na platforme Vercel.

## Lokálny vývoj

```bash
npm install
npx prisma generate
npm run dev
```

Pred odovzdaním zmien spustite `npm run check` a `npm run build`.

## Produkcia na Hetzneri

Povinné premenné prostredia:

- `DATABASE_URL` smeruje do spoločnej PostgreSQL databázy `lemon` a musí obsahovať `?schema=hlasujme`.
- `SESSION_SECRET` má aspoň 32 náhodných znakov.
- `STORAGE_ROOT` je absolútna cesta k perzistentnému úložisku mimo repozitára.
- `TRUST_PROXY=1` nastavte iba vtedy, keď reverzný proxy server prepisuje hlavičky klientskych IP a aplikácia nie je dostupná priamo.

Nasadenie databázových zmien robte iba príkazom `npx prisma migrate deploy`. Pred migráciou vytvorte zálohu databázy `lemon`. Aplikácia smie meniť iba schému `hlasujme`; schémy a tabuľky aplikácie Lemon sú mimo jej rozsahu.

Destruktívny skript `scripts/clear-db.ts` zámerne odmietne produkčnú schému. Spustí sa iba s `ALLOW_DESTRUCTIVE_TEST_DB=1` a URL schémy v tvare `hlasujme_test_*`.
