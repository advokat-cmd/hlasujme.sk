# Hlasujme.sk: fungovanie aplikácie a používateľské roly

**Návod k implementácii po technickom audite z 13. septembra 2026.** Opisuje prácu v aplikácii, oprávnenia a výpočty. Nie je potvrdením nasadenia tejto verzie ani právnym posúdením konkrétneho hlasovania.

## 1. Dva odlišné spôsoby prístupu

**Používateľský účet** slúži na vstup do administrácie alebo klientskej zóny cez e-mail a heslo. Účet má rolu superadmin, admin alebo vlastník. Vlastník nepotrebuje účet na samotné odovzdanie hlasu; účet mu sprístupňuje informácie o hlasovaniach jeho domu a po uzavretí výsledky a zápisnice.

**Osobný hlasovací odkaz** príde v e-mailovej pozvánke. Obsahuje náhodný prístupový token a bez hesla otvorí konkrétne hlasovanie pre konkrétnu jednotku alebo spoluvlastníka. Odkaz preto neposielajte ďalším osobám: jeho držiteľ môže v povolenom čase hlasovať v rozsahu tohto odkazu. Pri viacerých jednotkách treba použiť príslušný odkaz za každú jednotku.

Prihlasovacie údaje do klientskej zóny a pozvánka na hlasovanie sú dva rôzne e-maily. Vygenerovanie účtu samo neznamená odoslanie hlasovacej pozvánky. Nové heslo musí mať aspoň 12 znakov. Po jeho zmene sa zrušia existujúce relácie a používateľ sa prihlási novým heslom.

## 2. Kto môže čo robiť

| Rola alebo prístup | Čo sprístupňuje | Podstatné obmedzenia |
|---|---|---|
| **Superadmin** | Správa domu, vlastníkov, účtov a šablón; príprava, spustenie a uzavretie hlasovaní; priebežné výsledky; rozosielanie; história prihlásení v prehľade. | Aj preňho platí uzamknutie zloženia hlasujúcich počas vyhláseného hlasovania a zákaz vymazania vyhláseného alebo uzavretého hlasovania. |
| **Admin** | Bežná správa registra, šablón a hlasovaní; priebežné výsledky; pozvánky; uzavretie a odoslanie zápisnice; správa bežných vlastníckych účtov. | Nemôže prideľovať administrátorské oprávnenia, meniť iného administrátora ani účet superadmina. Svoj existujúci účet môže upraviť pri zachovaní roly; nemôže ho týmto postupom odstrániť. Nevidí superadminovu históriu prihlásení. |
| **Vlastník s účtom** | Hlasovania vlastného domu, ich termíny, otázky a podklady; po uzavretí súhrnné výsledky a zápisnice. | Počas hlasovania nevidí priebežné výsledky ani súhrnnú účasť. Nespravuje register, otázky, kontakty ani rozosielanie. |
| **Osobný odkaz** | Odovzdanie a zmena hlasu v konkrétnom hlasovaní, súvisiace podklady a osobné potvrdenie. | Neudeľuje administrátorské práva ani voľný prístup k iným jednotkám či hlasovaniam. |

Administrátorské roly sú zatiaľ **globálne**: aplikácia nemá samostatné priradenie administrátora ku každému domu. Vlastnícky účet je viazaný na jednu jednotku/vlastníka a podľa nej sa určuje jeho dom. Účet bez platného priradenia nedostane náhradný prístup k prvému domu v databáze. Samostatná rola nezávislého overovateľa nie je implementovaná.

## 3. Register a šesť režimov vlastníctva

Register má navyše vlastné roly osôb: vlastník (`owner`), spoluvlastník (`coowner`), BSM (`bsm`), splnomocnenec (`proxy`) a právnická osoba (`legal`). Opisujú vzťah osoby k jednotke; samy neudeľujú administrátorské oprávnenia. Spôsob hlasovania a započítania riadi režim jednotky uvedený nižšie.

Pred hlasovaním administrátor v časti **Dom a vlastníci** skontroluje identifikáciu domu, jednotky, mená, kontaktné adresy, podiely a režimy. Jednotka môže byť byt alebo nebytový priestor. Má vlastnú váhu hlasu; bežne ide o jeden hlas, model však podporuje kladnú celočíselnú váhu.

| Režim | Ako sa hlasuje |
|---|---|
| **Jediný vlastník – single** | Jeden odkaz na e-mail jednotky; posledná odoslaná odpoveď je hlasom jednotky. |
| **BSM manželov – bsm** | Jeden spoločný odkaz na e-mail jednotky. Aplikácia nevyžaduje dve samostatné potvrdenia manželov. |
| **Určený zástupca – rep** | Jeden odkaz na e-mail jednotky pre určenú konajúcu osobu. Ostatným spoluvlastníkom sa automaticky neposielajú informačné kópie. |
| **Interné hlasovanie – internal** | Každý spoluvlastník dostane vlastný odkaz. Za každú otázku sa sčítajú podiely spoluvlastníkov, ktorí zvolili rovnakú odpoveď. |
| **Väčšinový spoluvlastník – majority** | Jeden odkaz na nastavený e-mail jednotky. Výber oprávnenej osoby je zodpovednosťou správcu registra. |
| **Právnická osoba – legal** | Jeden odkaz na e-mail jednotky pre nastavenú konajúcu osobu. Aplikácia sama neoveruje oprávnenie podpisovať za právnickú osobu. |

Pri internom režime musia podiely tvoriť 100 %. Odpoveď sa stane hlasom jednotky, ak za ňou stojí **viac ako 50 % podielov**. Presných 50 % nestačí. Ak nikto nehlasoval, jednotka je „nehlasoval“; ak už hlasy existujú, ale žiadna odpoveď nemá väčšinu podielov, výsledok je sporný. Napríklad dva podiely 50/50 s opačnými odpoveďami vytvoria sporný hlas.

Interný spoluvlastník používa osobný e-mail, prípadne náhradný e-mail jednotky. Do spoločnej schránky preto môže prísť viac samostatných odkazov. Register zobrazuje mená všetkých vlastníkov, nie iba prvého.

## 4. Vytvorenie hlasovania od otázky po pozvánku

Sprievodca **Vytvoriť hlasovanie** má štyri kroky:

1. **Základné údaje:** názov, dôvod, začiatok a koniec. Predvolený začiatok je aktuálny čas; koniec o 14 dní o 20:00. Vstupný čas sa zadáva podľa pásma zariadenia a na server sa odosiela ako jednoznačný čas. Koniec musí nasledovať po začiatku; návrh s uplynutým koncom nemožno spustiť.
2. **Otázky a väčšina:** aspoň jedna otázka s úplným znením a vlastným typom väčšiny. Otázky možno pridávať, odstrániť alebo prevziať zo šablón. Šablóna môže niesť poznámku. Ku konkrétnej otázke možno vybrať prílohu.
3. **Oprávnené jednotky:** súhrn všetkých aktívnych jednotiek domu a kontaktov. Nie je to výber jednotlivých pozvaných bytov pre dané hlasovanie.
4. **Kontrola a spustenie:** aplikácia uloží návrh, nahrá prílohy a až následne ho aktivuje a pokúsi sa odoslať pozvánky.

Ak nahratie prílohy zlyhá, hlasovanie zostane návrhom a pozvánky sa neposielajú. V detaile, v časti **Podklady a dokumenty**, možno dokument priradiť k otázke alebo ho pridať ako všeobecný podklad. Po kontrole sa návrh spustí tlačidlom **Spustiť a odoslať pozvánky**. Vyhlásené podklady už nemožno meniť. Vymazanie je dostupné iba pre návrh.

V jednom dome môže byť naraz iba jedno vyhlásené alebo práve uzatvárané hlasovanie. To zahŕňa aj už vyhlásené hlasovanie s budúcim začiatkom. Pred spustením ďalšieho treba predchádzajúce uzavrieť. Počas tohto obdobia sa blokujú zmeny zloženia vlastníkov a ich hlasovacích podielov; doplnenie kontaktov je odlišná operácia.

**Chýbajúci e-mail neznižuje počet oprávnených hlasov.** Aktívna jednotka zostáva vo výpočte aj vtedy, keď jej nemožno poslať pozvánku. Ak nemá doručovací kontakt žiadna jednotka, aktivácia sa odmietne. Chýbajúci kontakt preto treba riešiť pred spustením, nie ho považovať za vyradenie jednotky.

## 5. Pozvánky, opätovné odoslanie a pripomienky

Aktivácia vytvorí osobné odkazy a vyhodnotí pokusy o odoslanie. E-maily sa odosielajú v dávkach po najviac päť správ; ďalšia dávka začne najskôr päť sekúnd po predchádzajúcej. Pri 14 pozvánkach teda odídu dávky 5 + 5 + 4, približne v čase 0, 5 a 10 sekúnd. Toto obmedzenie zdieľajú aj ďalšie odosielania aplikácie, takže pri súbehu môže odoslanie trvať dlhšie. Po dočasnom obmedzení rýchlosti službou Resend aplikácia chvíľu počká a vykoná obmedzený počet opakovaní s ochranou proti duplicitám. Ak časť e-mailov zlyhá, hlasovanie už môže byť aktívne; administrátor skontroluje výsledok rozoslania a príslušnému registrovanému príjemcovi pozvánku odošle znova. Opakované stlačenie aktivácie už aktívneho hlasovania nespustí druhé hromadné rozoslanie.

Ručné opätovné odoslanie je dostupné počas aktívneho hlasovania pred koncom termínu. Pri internom režime sa identifikuje aj konkrétny spoluvlastník, aby sa nezamenili osoby so spoločným e-mailom. Vlastník má používať najnovšiu pozvánku.

**Automatická pripomienka 48 hodín pred koncom nie je implementovaná.** Šablóna pripomienky existuje, ale v aplikácii nie je plánovač jej automatického odosielania. Rozhranie preto uvádza ručný postup. Dátum vytvorenia odkazu zároveň nepreukazuje doručenie e-mailu; úspešné prijatie správy poskytovateľom ešte nepotvrdzuje doručenie do schránky ani jej prečítanie.

## 6. Odovzdanie a zmena hlasu

Pred začiatkom osobný odkaz zobrazí plánovaný termín a pokyn stránku neskôr obnoviť. Počas otvoreného hlasovania vlastník vidí úvod, otázky a podklady. Pri každej otázke vyberie **Súhlasím**, **Nesúhlasím** alebo **Nechcem hlasovať**. Posledná možnosť je výslovné zdržanie sa hlasovania, nie chýbajúca odpoveď.

Nasleduje rekapitulácia. Vlastník môže odpovede opraviť, ale pred odoslaním musí odpovedať na všetky otázky. **Hlasy sa započítajú až stlačením Odoslať hlas a úspešným prijatím serverom.** Klikanie na možnosti samo nič neodovzdáva. Rozpracované zmeny zostávajú v pamäti stránky; obnovenie stránky ich zahodí.

Po úspechu sa zobrazí prijatie, odpovede a skutočný čas potvrdený serverom. Vlastník si môže stiahnuť osobné PDF potvrdenie. Do konca termínu alebo skoršieho administrátorského uzavretia môže hlas zmeniť a znova odoslať kompletné odpovede. Počíta sa posledná platná verzia. Samotné otvorenie úpravy nemení predchádzajúce odovzdanie.

Počas otvoreného hlasovania **priebežné výsledky vidí iba administrátor**. Vlastník ich nevidí ani po prihlásení do klientskej zóny. Uplynutie termínu zastaví prijímanie hlasov; výsledky sa vlastníkom sprístupnia až po administrátorskom uzavretí. Zobrazované časy potvrdení a výsledkov používajú pásmo Europe/Bratislava.

## 7. Päť typov väčšiny a príklad 36 hlasov

Každá otázka sa vyhodnocuje samostatne. Označme **N** súčet váh všetkých aktívnych jednotiek a **V** súčet platných hlasov súhlasím + nesúhlasím + zdržal sa pri danej otázke. Nehlasujúce a sporné jednotky sú súčasťou N, ale nie V. Počet potrebných súhlasov je:

| Typ väčšiny | Vzorec | Príklad N = 36 |
|---|---|---|
| Nadpolovičná všetkých | `floor(N / 2) + 1` | 19 súhlasov |
| Dvojtretinová všetkých | `ceil(2 × N / 3)` | 24 súhlasov |
| Štvorpätinová všetkých | `ceil(4 × N / 5)` | 29 súhlasov |
| Súhlas všetkých | `N` | 36 súhlasov |
| Nadpolovičná zúčastnených | `floor(V / 2) + 1` | Pri V = 20 treba 11 súhlasov; samotné N nestačí. |

`floor` zaokrúhľuje nadol, `ceil` nahor. Pri 36 jednotkách s váhou jeden je N = 36 aj vtedy, keď štyri jednotky nemajú e-mail. Zdržanie sa nezvyšuje počet súhlasov; pri väčšine zo zúčastnených však zvyšuje V. Aplikácia osobitne vykazuje nesúhlas, zdržanie, nehlasovanie a spornosť.

Počas hlasovania je dosiahnutá väčšina iba aktuálnym stavom, pretože odpovede sa ešte môžu meniť. Nedosiahnutá väčšina je priebežná, nie konečné zamietnutie. Po uzavretí sa otázka definitívne označí ako schválená alebo neschválená. Prázdny okruh oprávnených hlasov sa nepovažuje za schválenie.

Tieto vzorce opisujú výpočet programu. **Výber právne správnej väčšiny pre konkrétnu otázku zostáva zodpovednosťou oprávnenej osoby.** Softvérové nastavenie ani tento návod nepotvrdzujú právnu platnosť postupu.

## 8. Uzavretie a nemenné výsledky

Administrátor otvorí **Uzavrieť hlasovanie**, skontroluje upozornenia a súhrn otázok a následne uzavretie potvrdí. Dva kroky v dialógu sú potvrdením toho istého používateľa, nie podpisom nezávislého overovateľa. Aplikácia umožňuje aj uzavretie pred pôvodným koncom; tým sa okamžite skončí prijímanie a zmena hlasov.

Server zosúladí uzavretie so súbežnými hlasmi, vytvorí konečný záznam údajov v JSON a PDF zápisnicu. Nový archív zachováva otázky, jednotky, vlastníkov, váhy a účinné hlasy v čase uzavretia. Neskoršia úprava registra jeho výsledky neprepočíta. JSON aj PDF majú vlastný kontrolný odtlačok SHA-256; čítanie overuje príslušnú integritu. Auditný záznam reťazí kontrolné odtlačky udalostí.

PDF obsahuje aj mennú prílohu jednotiek a ich výsledných hlasov. Pri internom režime príloha uvádza výsledný hlas jednotky, nie samostatné odpovede každého spoluvlastníka. **Hlasovanie nie je anonymné.** Prístup oprávneného vlastníka k zápisnici znamená aj prístup k tejto prílohe. Hash a serverový čas nie sú kvalifikovaným elektronickým podpisom ani nezávislou kvalifikovanou časovou pečiatkou.

## 9. Ručné odoslanie zápisnice

Uzavretie výsledky automaticky nerozosiela. Administrátor v záložke **Zápisnica** použije **Odoslať vlastníkom**. E-mail obsahuje podpísaný odkaz na PDF, platný 30 dní od vytvorenia, ktorý nevyžaduje prihlásenie. Jeho držiteľ môže počas platnosti zápisnicu otvoriť, preto je citlivý rovnako ako iný prístupový odkaz.

Adresy sa vyberajú z aktuálneho registra aktívnych jednotiek, pri internom režime z kontaktov spoluvlastníkov s prípadným náhradným e-mailom jednotky. Duplicitné adresy sa zjednotia a adresy už evidované ako úspešne odoslané sa pri bežnom opakovaní preskočia. Nejde o historicky zmrazený doručovací zoznam. História eviduje úspešné odoslania; nevypovedá o prečítaní správy.

## 10. Úložisko, staršie údaje a hranice funkcií

Produkčné prostredie používa trvalý server Hetzner a perzistentné úložisko podkladov a PDF mimo jednotlivých vydaní aplikácie. Databáza PostgreSQL je spoločná, ale Hlasujme používa iba svoju schému `hlasujme`. Nasadzovací postup pred migráciami vytvára zálohu tejto schémy na serveri. Pravidelné zálohovanie súborov, kópia mimo servera a skúška obnovy sú samostatné prevádzkové povinnosti; tento návod ich vykonanie nepotvrdzuje.

Staršie archívy môžu obsahovať len uložené súčty otázok bez úplného historického registra v JSON. Rozhranie to označuje; podrobný historický stav treba hľadať v pôvodnej PDF zápisnici. Neznámy alebo poškodený výsledok sa nemá zamieňať s neschváleným hlasovaním.

V staršej verzii sa priebežné kliknutia nesprávne ukladali ako hlasy ešte pred konečným potvrdením. Oprava tomu bráni do budúcnosti, ale zo samotných starých riadkov nemožno spoľahlivo zrekonštruovať úmysel používateľa. Audit preto automaticky nemaže ani neprepisuje historické hlasy.

Nie sú implementované automatické 48-hodinové pripomienky, TOTP dvojfaktorové overenie, kvalifikovaný elektronický podpis, samostatný overovateľ ani viacjednotkový vlastnícky účet. Reálne doručenie produkčných e-mailov nebolo v rámci tohto overovania skúšané.

## 11. Hlavné opravy technického auditu

- Oddelenie rozpracovanej voľby od konečne odovzdaného hlasu a použitie serverového času.
- Ochrana vlastníckych účtov podľa domu a skrytie všetkých priebežných výsledkov.
- Prílohy sa nahrajú pred pozvánkami; vyhlásené podklady a zloženie hlasujúcich sa uzamknú.
- Opravy oprávnení pri správe účtov, hlasovacích odkazoch a osobných dokumentoch.
- Konzistentné uzavretie, uloženie historického stavu a správne čítanie archívu.
- Odstránenie zavádzajúcich tvrdení o doručení, plánovaných pripomienkach a automatickom rozoslaní výsledkov.
