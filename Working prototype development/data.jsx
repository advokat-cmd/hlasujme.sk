// data.jsx — mock data for the owners' e-voting prototype
// Bytový dom Hlavná 12, Bratislava. All data is fictional.

const BUILDING = {
  name: 'Bytový dom Björnsonova 3',
  short: 'Björnsonova 3',
  address: 'Björnsonova 3, 811 05 Bratislava',
  entrance: 'Vchod A',
  units: 36,
  nonResidential: 2,
  manager: 'Správa domov, s.r.o.',
  contact: 'Ing. Mária Kováčová',
  contactEmail: 'kovacova@spravadomov.sk',
};

// ── People ───────────────────────────────────────────────────
// Diacritics-stripping helper so generated e-mails are consistent across all owners.
const stripDia = (s) => String(s).toLowerCase()
  .replace(/á|ä/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó|ô/g,'o').replace(/ú/g,'u')
  .replace(/ý/g,'y').replace(/č/g,'c').replace(/š/g,'s').replace(/ž/g,'z').replace(/ť/g,'t')
  .replace(/ľ/g,'l').replace(/ň/g,'n').replace(/ď/g,'d');
const mkEmail = (first, last) => `${stripDia(first)}.${stripDia(last)}@email.sk`;

const P = (id, first, last, opts = {}) => ({
  id, first, last, name: `${first} ${last}`,
  email: opts.email ?? mkEmail(first, last),
  share: opts.share ?? 1,
  role: opts.role ?? 'owner',     // owner | coowner | bsm | proxy | legal
  admin: opts.admin ?? false,
});

// ── Units ────────────────────────────────────────────────────
// coMode: 'single' (jediný vlastník), 'rep' (určený zástupca),
//         'internal' (interné hlasovanie spoluvlastníkov), 'majority' (väčšinový spoluvlastník)
const UNITS = [
  { id:'u1', no:'1', type:'byt', floor:'príz.', votes:1, status:'active', coMode:'single',
    owners:[P('p1','Ján','Novák',{admin:true})], email:'jan.novak@email.sk' },
  { id:'u2', no:'2', type:'byt', floor:'príz.', votes:1, status:'active', coMode:'bsm',
    owners:[P('p2','Peter','Horváth',{share:0.5,role:'bsm'}),P('p3','Eva','Horváthová',{share:0.5,role:'bsm'})],
    bsm:true, email:'horvathovci@email.sk' },
  { id:'u3', no:'3', type:'byt', floor:'1.', votes:1, status:'active', coMode:'single',
    owners:[P('p4','Zuzana','Kráľová')], email:'zuzana.kralova@email.sk' },
  { id:'u4', no:'4', type:'byt', floor:'1.', votes:1, status:'active', coMode:'internal',
    owners:[P('p5','Martin','Baláž',{share:0.5,role:'coowner'}),P('p6','Lucia','Balážová',{share:0.5,role:'coowner'})],
    email:'martin.balaz@email.sk' },
  { id:'u5', no:'5', type:'byt', floor:'1.', votes:1, status:'active', coMode:'rep',
    owners:[P('p7','Tomáš','Varga',{share:0.34,role:'coowner'}),P('p8','Andrej','Varga',{share:0.33,role:'coowner'}),P('p9','Daniel','Varga',{share:0.33,role:'coowner'})],
    repId:'p7', email:'tomas.varga@email.sk' },
  { id:'u6', no:'6', type:'byt', floor:'2.', votes:1, status:'active', coMode:'majority',
    owners:[P('p10','Katarína','Šimková',{share:0.7,role:'coowner'}),P('p11','Róbert','Šimko',{share:0.3,role:'coowner'})],
    majId:'p10', email:'katarina.simkova@email.sk' },
  { id:'u7', no:'7', type:'byt', floor:'2.', votes:1, status:'active', coMode:'single',
    owners:[P('p12','Mária','Tóthová',{admin:true})], email:'maria.tothova@email.sk' },
  { id:'u8', no:'8', type:'byt', floor:'2.', votes:1, status:'active', coMode:'single',
    owners:[P('p13','Pavol','Dvořák')], email:'' /* missing email — conflict */ },
  { id:'u9', no:'9', type:'byt', floor:'3.', votes:1, status:'active', coMode:'single',
    owners:[P('p14','Helena','Krajčíová')], email:'helena.krajciova@email.sk' },
  { id:'u10', no:'10', type:'byt', floor:'3.', votes:1, status:'active', coMode:'legal',
    owners:[P('p15','BYTSERVIS','s.r.o.',{role:'legal',email:'office@bytservis.sk'})],
    actingPerson:'Ing. Jozef Malý (konateľ)', email:'office@bytservis.sk' },
  { id:'u11', no:'11', type:'byt', floor:'3.', votes:1, status:'active', coMode:'single',
    owners:[P('p16','Stanislav','Polák')], email:'stanislav.polak@email.sk' },
  { id:'u12', no:'12', type:'byt', floor:'4.', votes:1, status:'active', coMode:'internal',
    owners:[P('p17','Ivan','Sedlák',{share:0.5,role:'coowner'}),P('p18','Oľga','Sedláková',{share:0.5,role:'coowner'})],
    email:'ivan.sedlak@email.sk' },
];

// Fill the rest up to 36 with simpler single-owner units
const FIRST = ['Milan','Anna','Jozef','Jana','Marek','Soňa','Vladimír','Beáta','Igor','Dana','Rastislav','Veronika','Boris','Gabriela','Patrik','Monika','Erik','Silvia','Norbert','Lenka','Dušan','Renáta','Karol','Adriana'];
const LAST  = ['Urban','Kollár','Šťastný','Bezák','Mráz','Lukáč','Holub','Fáber','Gajdoš','Kupec','Bartoš','Hlavatý','Žák','Macko','Ondruš','Petrík','Slávik','Búda','Repka','Híreš','Daňo','Vrabec','Kučera','Mihálik'];
for (let i = 13; i <= 36; i++) {
  const type = i >= 35 ? 'nebyt' : 'byt';
  const f = FIRST[i-13], l = LAST[i-13];
  UNITS.push({
    id:'u'+i, no:String(i), type, floor: type==='nebyt' ? 'príz.' : (Math.ceil((i)/4))+'.',
    votes:1, status:'active', coMode:'single',
    owners:[P('p'+(20+i), f, l)],
    email: mkEmail(f, l),
    label: type==='nebyt' ? (i===35?'Obchodný priestor':'Kancelária') : undefined,
  });
}
// Owner of unit 11 also owns unit 30 (two votes)
UNITS.find(u=>u.id==='u30').owners = [P('p16b','Stanislav','Polák',{email:'stanislav.polak@email.sk'})];
UNITS.find(u=>u.id==='u30').email = 'stanislav.polak@email.sk';

// ── Active poll ──────────────────────────────────────────────
const POLL = {
  id:'poll-2026-03',
  title:'Hlasovanie vlastníkov – jar 2026',
  reason:'Obnova vstupných priestorov a financovanie opráv',
  declarer:'Ing. Mária Kováčová (administrátor)',
  announced:'14. 6. 2026',
  start:'16. 6. 2026, 08:00',
  end:'30. 6. 2026, 20:00',
  status:'active',
  questions:[
    { no:1, kind:'Fond opráv',
      title:'Výmena vstupných dverí do bytového domu',
      text:'Súhlasíte s výmenou vstupných dverí do bytového domu podľa cenovej ponuky spoločnosti Dvere SK, s.r.o. zo dňa 2. 6. 2026, v cene najviac 4 800 € s DPH, hradené z fondu prevádzky, údržby a opráv?',
      note:'Výmena spoločného zariadenia domu hradená z fondu opráv.',
      majority:'half-all', attachments:['Cenova_ponuka_Dvere_SK.pdf','Fotodokumentacia.pdf'] },
    { no:2, kind:'Voľba zástupcu',
      title:'Voľba zástupcu vlastníkov',
      text:'Súhlasíte so zvolením pána Jána Nováka (byt č. 1) za zástupcu vlastníkov bytov a nebytových priestorov na funkčné obdobie 3 rokov?',
      note:'Voľba zástupcu vlastníkov.',
      majority:'half-all', attachments:[] },
    { no:3, kind:'Úver / zateplenie',
      title:'Úver na zateplenie obvodového plášťa',
      text:'Súhlasíte s prijatím úveru vo výške 180 000 € na zateplenie obvodového plášťa bytového domu so splatnosťou 15 rokov a s navýšením mesačného príspevku do fondu opráv o 0,25 €/m²?',
      note:'Úver a zásah do spoločných častí — vyžaduje dvojtretinovú väčšinu všetkých vlastníkov.',
      majority:'twothirds-all', attachments:['Indikativna_ponuka_uver.pdf','Projekt_zateplenie.pdf','Rozpocet.pdf'] },
  ],
};

// Majority definitions
const MAJORITY = {
  'half-all':      { label:'Nadpolovičná väčšina všetkých vlastníkov', frac:'> 1/2 všetkých', need:(t)=>Math.floor(t/2)+1 },
  'twothirds-all': { label:'Dvojtretinová väčšina všetkých vlastníkov', frac:'≥ 2/3 všetkých', need:(t)=>Math.ceil(t*2/3) },
  'all':           { label:'Súhlas všetkých vlastníkov', frac:'všetci', need:(t)=>t },
  'half-present':  { label:'Nadpolovičná väčšina zúčastnených', frac:'> 1/2 hlasujúcich', need:null },
};

// ── Recorded votes (unitId -> { q1,q2,q3, at, changed }) ─────
// answer: 'agree' | 'disagree' | 'abstain' | null
const VOTES = {
  u1:{q1:'agree',q2:'agree',q3:'agree', at:'16. 6. 09:12', changed:false},
  u2:{q1:'agree',q2:'agree',q3:'disagree', at:'16. 6. 18:40', changed:false},
  u3:{q1:'agree',q2:'agree',q3:'abstain', at:'17. 6. 07:55', changed:true},
  u4:{q1:'agree',q2:'disagree',q3:'disagree', at:'17. 6. 20:01', changed:false}, // internal coowners – will be split below
  u5:{q1:'agree',q2:'agree',q3:'agree', at:'18. 6. 11:20', changed:false},       // rep voted
  u6:{q1:'agree',q2:'agree',q3:'disagree', at:'18. 6. 16:33', changed:false},    // majority owner voted
  u7:{q1:'agree',q2:'agree',q3:'agree', at:'16. 6. 08:30', changed:false},
  u9:{q1:'disagree',q2:'agree',q3:'disagree', at:'19. 6. 21:10', changed:false},
  u10:{q1:'agree',q2:'agree',q3:'agree', at:'20. 6. 10:05', changed:false},
  u11:{q1:'agree',q2:'agree',q3:'agree', at:'21. 6. 13:00', changed:false},
  u12:{q1:'agree',q2:'disagree',q3:'disagree', at:'21. 6. 19:45', changed:false}, // internal coowners conflict
  u14:{q1:'agree',q2:'agree',q3:'agree', at:'22. 6. 09:00', changed:false},
  u15:{q1:'agree',q2:'agree',q3:'abstain', at:'22. 6. 12:00', changed:false},
  u16:{q1:'agree',q2:'agree',q3:'agree', at:'23. 6. 08:15', changed:false},
  u18:{q1:'agree',q2:'disagree',q3:'disagree', at:'23. 6. 17:30', changed:false},
  u20:{q1:'agree',q2:'agree',q3:'agree', at:'24. 6. 11:11', changed:false},
  u22:{q1:'agree',q2:'agree',q3:'disagree', at:'24. 6. 14:40', changed:false},
  u25:{q1:'agree',q2:'agree',q3:'agree', at:'25. 6. 09:50', changed:false},
  u28:{q1:'disagree',q2:'agree',q3:'disagree', at:'25. 6. 18:20', changed:false},
  u30:{q1:'agree',q2:'agree',q3:'agree', at:'26. 6. 10:00', changed:false},
  u33:{q1:'agree',q2:'agree',q3:'abstain', at:'26. 6. 16:00', changed:false},
};

// Per-co-owner sub-votes for 'internal' units. Each internal unit MUST appear here,
// otherwise the engine treats the unit position as undecided.
//  - u4: co-owners agree unanimously per question → valid unit vote (agree/disagree/disagree).
//  - u12: co-owners split 50/50 on q2/q3 → no share majority → sporný (disputed) hlas.
const COOWNER_SPLIT = {
  u4: [ {pid:'p5',name:'Martin Baláž',share:0.5,q1:'agree',q2:'disagree',q3:'disagree'},
        {pid:'p6',name:'Lucia Balážová',share:0.5,q1:'agree',q2:'disagree',q3:'disagree'} ],
  u12:[ {pid:'p17',name:'Ivan Sedlák',share:0.5,q1:'agree',q2:'disagree',q3:'disagree'},
        {pid:'p18',name:'Oľga Sedláková',share:0.5,q1:'agree',q2:'agree',q3:'agree'} ],
};

// ── Archived polls ───────────────────────────────────────────
const ARCHIVE = [
  { id:'poll-2025-11', title:'Zmena domového poriadku', end:'30. 11. 2025', declarer:'Zástupca vlastníkov',
    questions:1, eligible:36, voted:31, result:'schválené' },
  { id:'poll-2025-06', title:'Schválenie ročného vyúčtovania a rozpočtu', end:'24. 6. 2025', declarer:'Administrátor',
    questions:2, eligible:36, voted:28, result:'schválené' },
  { id:'poll-2025-02', title:'Inštalácia kamerového systému vo vchode', end:'18. 2. 2025', declarer:'Rada',
    questions:1, eligible:36, voted:22, result:'neschválené' },
  { id:'poll-2024-09', title:'Test aplikácie (bez právnych účinkov)', end:'10. 9. 2024', declarer:'Administrátor',
    questions:1, eligible:36, voted:19, result:'schválené', test:true },
];

// Question templates
const TEMPLATES = [
  'Schválenie použitia fondu opráv','Zvýšenie mesačného preddavku do fondu opráv','Výber dodávateľa',
  'Oprava strechy','Výmena stúpačiek','Kamerový systém','Zmena správcu','Voľba zástupcu vlastníkov',
  'Zmena domového poriadku','Úver','Zateplenie','Stavebná úprava spoločných častí','Prenájom spoločných priestorov',
];

// Administrator login credentials (created in-app by an administrator).
// Owners marked as administrators can sign in with these; owners vote via e-mail link only.
const ADMIN_CREDENTIALS = [
  { email:'kovacova@spravadomov.sk', password:'demo1234', name:'Ing. Mária Kováčová', unit:null },
  { email:'jan.novak@email.sk', password:'demo1234', name:'Ján Novák', unit:'1' },
  { email:'maria.tothova@email.sk', password:'demo1234', name:'Mária Tóthová', unit:'7' },
];

Object.assign(window, { BUILDING, UNITS, POLL, MAJORITY, VOTES, COOWNER_SPLIT, ARCHIVE, TEMPLATES, ADMIN_CREDENTIALS });
