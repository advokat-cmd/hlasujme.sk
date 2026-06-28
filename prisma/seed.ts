import { PrismaClient, UnitType, CoMode, OwnerRole, PollStatus, MajorityType, VoteAnswer } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const FIRST = ['Milan','Anna','Jozef','Jana','Marek','Soňa','Vladimír','Beáta','Igor','Dana','Rastislav','Veronika','Boris','Gabriela','Patrik','Monika','Erik','Silvia','Norbert','Lenka','Dušan','Renáta','Karol','Adriana'];
const LAST  = ['Urban','Kollár','Šťastný','Bezák','Mráz','Lukáč','Holub','Fáber','Gajdoš','Kupec','Bartoš','Hlavatý','Žák','Macko','Ondruš','Petrík','Slávik','Búda','Repka','Híreš','Daňo','Vrabec','Kučera','Mihálik'];

const stripDia = (s: string) => s.toLowerCase()
  .replace(/á|ä/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó|ô/g,'o').replace(/ú/g,'u')
  .replace(/y/g,'y').replace(/č/g,'c').replace(/š/g,'s').replace(/ž/g,'z').replace(/ť/g,'t')
  .replace(/ľ/g,'l').replace(/ň/g,'n').replace(/ď/g,'d');

const mkEmail = (first: string, last: string) => `${stripDia(first)}.${stripDia(last)}@email.sk`;

async function main() {
  console.log("Starting database seeding...");

  // Delete all existing data
  await prisma.sealedResult.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.coownerSubvote.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.voteToken.deleteMany();
  await prisma.question.deleteMany();
  await prisma.poll.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.building.deleteMany();

  // 1. Create Building
  const building = await prisma.building.create({
    data: {
      name: 'Bytový dom Björnsonova 3',
      short: 'Björnsonova 3',
      address: 'Björnsonova 3, 811 05 Bratislava',
      entrance: 'Vchod A',
      unitsCount: 36,
      manager: 'Správa domov, s.r.o.',
      contact: 'Ing. Mária Kováčová',
      contactEmail: 'kovacova@spravadomov.sk',
    }
  });

  // Hash password for admins
  const hashedPw = await argon2.hash("demo1234", {
    type: argon2.argon2id
  });
  const milanHashedPw = await argon2.hash("admin123", {
    type: argon2.argon2id
  });

  // Admin credentials mapping for later link
  const adminSettings = [
    { email: 'milan@ficek.sk', name: 'Milan Ficek', unitNo: null, isMilan: true },
    { email: 'kovacova@spravadomov.sk', name: 'Ing. Mária Kováčová', unitNo: null, isMilan: false },
    { email: 'jan.novak@email.sk', name: 'Ján Novák', unitNo: '1', isMilan: false },
    { email: 'maria.tothova@email.sk', name: 'Mária Tóthová', unitNo: '7', isMilan: false },
  ];

  interface SeedOwner {
    first: string;
    last: string;
    share: number;
    role: OwnerRole;
    admin: boolean;
    email?: string;
  }

  interface SeedUnit {
    no: string;
    type: UnitType;
    floor: string;
    votes: number;
    coMode: CoMode;
    email: string;
    actingPerson?: string;
    owners: SeedOwner[];
  }

  // 2. Setup all units & owners data structure
  const unitsData: SeedUnit[] = [
    { no: '1', type: UnitType.byt, floor: 'príz.', votes: 1, coMode: CoMode.single, email: 'jan.novak@email.sk',
      owners: [{ first: 'Ján', last: 'Novák', share: 1.0, role: OwnerRole.owner, admin: true }] },
    
    { no: '2', type: UnitType.byt, floor: 'príz.', votes: 1, coMode: CoMode.bsm, email: 'horvathovci@email.sk',
      owners: [
        { first: 'Peter', last: 'Horváth', share: 0.5, role: OwnerRole.bsm, admin: false },
        { first: 'Eva', last: 'Horváthová', share: 0.5, role: OwnerRole.bsm, admin: false }
      ] },
    
    { no: '3', type: UnitType.byt, floor: '1.', votes: 1, coMode: CoMode.single, email: 'zuzana.kralova@email.sk',
      owners: [{ first: 'Zuzana', last: 'Kráľová', share: 1.0, role: OwnerRole.owner, admin: false }] },
    
    { no: '4', type: UnitType.byt, floor: '1.', votes: 1, coMode: CoMode.internal, email: 'martin.balaz@email.sk',
      owners: [
        { first: 'Martin', last: 'Baláž', share: 0.5, role: OwnerRole.coowner, admin: false },
        { first: 'Lucia', last: 'Balážová', share: 0.5, role: OwnerRole.coowner, admin: false }
      ] },
    
    { no: '5', type: UnitType.byt, floor: '1.', votes: 1, coMode: CoMode.rep, email: 'tomas.varga@email.sk',
      owners: [
        { first: 'Tomáš', last: 'Varga', share: 0.34, role: OwnerRole.coowner, admin: false }, // rep
        { first: 'Andrej', last: 'Varga', share: 0.33, role: OwnerRole.coowner, admin: false },
        { first: 'Daniel', last: 'Varga', share: 0.33, role: OwnerRole.coowner, admin: false }
      ] },
    
    { no: '6', type: UnitType.byt, floor: '2.', votes: 1, coMode: CoMode.majority, email: 'katarina.simkova@email.sk',
      owners: [
        { first: 'Katarína', last: 'Šimková', share: 0.7, role: OwnerRole.coowner, admin: false }, // maj
        { first: 'Róbert', last: 'Šimko', share: 0.3, role: OwnerRole.coowner, admin: false }
      ] },
    
    { no: '7', type: UnitType.byt, floor: '2.', votes: 1, coMode: CoMode.single, email: 'maria.tothova@email.sk',
      owners: [{ first: 'Mária', last: 'Tóthová', share: 1.0, role: OwnerRole.owner, admin: true }] },
    
    { no: '8', type: UnitType.byt, floor: '2.', votes: 1, coMode: CoMode.single, email: '', // missing email
      owners: [{ first: 'Pavol', last: 'Dvořák', share: 1.0, role: OwnerRole.owner, admin: false }] },
    
    { no: '9', type: UnitType.byt, floor: '3.', votes: 1, coMode: CoMode.single, email: 'helena.krajciova@email.sk',
      owners: [{ first: 'Helena', last: 'Krajčíová', share: 1.0, role: OwnerRole.owner, admin: false }] },
    
    { no: '10', type: UnitType.byt, floor: '3.', votes: 1, coMode: CoMode.legal, email: 'office@bytservis.sk', actingPerson: 'Ing. Jozef Malý (konateľ)',
      owners: [{ first: 'BYTSERVIS', last: 's.r.o.', share: 1.0, role: OwnerRole.legal, admin: false }] },
    
    { no: '11', type: UnitType.byt, floor: '3.', votes: 1, coMode: CoMode.single, email: 'stanislav.polak@email.sk',
      owners: [{ first: 'Stanislav', last: 'Polák', share: 1.0, role: OwnerRole.owner, admin: false }] },
    
    { no: '12', type: UnitType.byt, floor: '4.', votes: 1, coMode: CoMode.internal, email: 'ivan.sedlak@email.sk',
      owners: [
        { first: 'Ivan', last: 'Sedlák', share: 0.5, role: OwnerRole.coowner, admin: false },
        { first: 'Oľga', last: 'Sedláková', share: 0.5, role: OwnerRole.coowner, admin: false }
      ] },
  ];

  // Fill units 13 to 36
  for (let i = 13; i <= 36; i++) {
    const type = i >= 35 ? UnitType.nebyt : UnitType.byt;
    const f = FIRST[i - 13];
    const l = LAST[i - 13];
    const floorNo = type === UnitType.nebyt ? 'príz.' : `${Math.ceil(i / 4)}.`;
    
    // Unit 30 is owned by Stanislav Polák (same email/name as unit 11 owner)
    const ownerFirst = i === 30 ? 'Stanislav' : f;
    const ownerLast = i === 30 ? 'Polák' : l;
    const email = i === 30 ? 'stanislav.polak@email.sk' : mkEmail(ownerFirst, ownerLast);

    unitsData.push({
      no: String(i),
      type,
      floor: floorNo,
      votes: 1,
      coMode: CoMode.single,
      email,
      actingPerson: undefined,
      owners: [{ first: ownerFirst, last: ownerLast, share: 1.0, role: OwnerRole.owner, admin: false }]
    });
  }

  // Create units and owners in DB
  const createdUnitsMap = new Map<string, string>(); // no -> id
  const createdOwnersMap = new Map<string, string>(); // ownerKey -> id

  for (const ud of unitsData) {
    const unit = await prisma.unit.create({
      data: {
        no: ud.no,
        type: ud.type,
        floor: ud.floor,
        votes: ud.votes,
        coMode: ud.coMode,
        email: ud.email,
        actingPerson: ud.actingPerson,
        label: ud.type === UnitType.nebyt ? (ud.no === '35' ? 'Obchodný priestor' : 'Kancelária') : undefined,
        buildingId: building.id,
        owners: {
          create: ud.owners.map(o => ({
            first: o.first,
            last: o.last,
            name: `${o.first} ${o.last}`,
            email: o.email || (ud.coMode === CoMode.internal ? mkEmail(o.first, o.last) : ud.email),
            share: o.share,
            role: o.role,
          }))
        }
      },
      include: {
        owners: true
      }
    });

    createdUnitsMap.set(ud.no, unit.id);
    unit.owners.forEach(o => {
      createdOwnersMap.set(`${ud.no}_${o.first}_${o.last}`, o.id);
    });
  }

  // 3. Create Admins
  for (const adm of adminSettings) {
    let linkedUnitId = null;
    let linkedOwnerId = null;

    if (adm.unitNo) {
      linkedUnitId = createdUnitsMap.get(adm.unitNo) || null;
      if (linkedUnitId) {
        // find owner
        const unitDetails = await prisma.unit.findUnique({
          where: { id: linkedUnitId },
          include: { owners: true }
        });
        if (unitDetails && unitDetails.owners.length > 0) {
          linkedOwnerId = unitDetails.owners[0].id;
        }
      }
    }

    await prisma.admin.create({
      data: {
        email: adm.email,
        passwordHash: adm.isMilan ? milanHashedPw : hashedPw,
        name: adm.name,
        role: adm.isMilan ? "superadmin" : "admin",
        unitId: linkedUnitId,
        ownerId: linkedOwnerId
      }
    });
  }

  // 4. Create Active Poll
  const activePoll = await prisma.poll.create({
    data: {
      id: 'poll-2026-03',
      title: 'Hlasovanie vlastníkov – jar 2026',
      reason: 'Obnova vstupných priestorov a financovanie opráv',
      declarer: 'Ing. Mária Kováčová (administrátor)',
      announcedAt: new Date('2026-06-14T00:00:00Z'),
      startAt: new Date('2026-06-16T08:00:00Z'),
      endAt: new Date('2026-06-30T20:00:00Z'),
      status: PollStatus.active,
      buildingId: building.id,
      questions: {
        create: [
          {
            no: 1,
            kind: 'Fond opráv',
            title: 'Výmena vstupných dverí do bytového domu',
            text: 'Súhlasíte s výmenou vstupných dverí do bytového domu podľa cenovej ponuky spoločnosti Dvere SK, s.r.o. zo dňa 2. 6. 2026, v cene najviac 4 800 € s DPH, hradené z fondu prevádzky, údržby a opráv?',
            note: 'Výmena spoločného zariadenia domu hradená z fondu opráv.',
            majorityType: MajorityType.half_all,
            attachments: ['Cenova_ponuka_Dvere_SK.pdf', 'Fotodokumentacia.pdf']
          },
          {
            no: 2,
            kind: 'Voľba zástupcu',
            title: 'Voľba zástupcu vlastníkov',
            text: 'Súhlasíte so zvolením pána Jána Nováka (byt č. 1) za zástupcu vlastníkov bytov a nebytových priestorov na funkčné obdobie 3 rokov?',
            note: 'Voľba zástupcu vlastníkov.',
            majorityType: MajorityType.half_all,
            attachments: []
          },
          {
            no: 3,
            kind: 'Úver / zateplenie',
            title: 'Úver na zateplenie obvodového plášťa',
            text: 'Súhlasíte s prijatím úveru vo výške 180 000 € na zateplenie obvodového plášťa bytového domu so splatnosťou 15 rokov a s navýšením mesačného príspevku do fondu opráv o 0,25 €/m²?',
            note: 'Úver a zásah do spoločných častí — vyžaduje dvojtretinovú väčšinu všetkých vlastníkov.',
            majorityType: MajorityType.twothirds_all,
            attachments: ['Indikativna_ponuka_uver.pdf', 'Projekt_zateplenie.pdf', 'Rozpocet.pdf']
          }
        ]
      }
    }
  });

  // 5. Seed Recorded Votes
  const votesData: Record<string, { q1?: VoteAnswer, q2?: VoteAnswer, q3?: VoteAnswer, at: string, changed: boolean }> = {
    '1':  { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.agree,    at: '2026-06-16T09:12:00Z', changed: false },
    '2':  { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.disagree, at: '2026-06-16T18:40:00Z', changed: false },
    '3':  { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.abstain,  at: '2026-06-17T07:55:00Z', changed: true  },
    '5':  { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.agree,    at: '2026-06-18T11:20:00Z', changed: false },
    '6':  { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.disagree, at: '2026-06-18T16:33:00Z', changed: false },
    '7':  { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.agree,    at: '2026-06-16T08:30:00Z', changed: false },
    '9':  { q1: VoteAnswer.disagree, q2: VoteAnswer.agree,    q3: VoteAnswer.disagree, at: '2026-06-19T21:10:00Z', changed: false },
    '10': { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.agree,    at: '2026-06-20T10:05:00Z', changed: false },
    '11': { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.agree,    at: '2026-06-21T13:00:00Z', changed: false },
    '14': { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.agree,    at: '2026-06-22T09:00:00Z', changed: false },
    '15': { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.abstain,  at: '2026-06-22T12:00:00Z', changed: false },
    '16': { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.agree,    at: '2026-06-23T08:15:00Z', changed: false },
    '18': { q1: VoteAnswer.agree,    q2: VoteAnswer.disagree, q3: VoteAnswer.disagree, at: '2026-06-23T17:30:00Z', changed: false },
    '20': { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.agree,    at: '2026-06-24T11:11:00Z', changed: false },
    '22': { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.disagree, at: '2026-06-24T14:40:00Z', changed: false },
    '25': { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.agree,    at: '2026-06-25T09:50:00Z', changed: false },
    '28': { q1: VoteAnswer.disagree, q2: VoteAnswer.agree,    q3: VoteAnswer.disagree, at: '2026-06-25T18:20:00Z', changed: false },
    '30': { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.agree,    at: '2026-06-26T10:00:00Z', changed: false },
    '33': { q1: VoteAnswer.agree,    q2: VoteAnswer.agree,    q3: VoteAnswer.abstain,  at: '2026-06-26T16:00:00Z', changed: false },
  };

  // Seed normal votes
  for (const [unitNo, v] of Object.entries(votesData)) {
    const unitId = createdUnitsMap.get(unitNo)!;
    
    // Add votes for all questions
    const qAnswers = [
      { no: 1, ans: v.q1 },
      { no: 2, ans: v.q2 },
      { no: 3, ans: v.q3 },
    ];

    for (const qa of qAnswers) {
      if (qa.ans) {
        await prisma.vote.create({
          data: {
            pollId: activePoll.id,
            unitId,
            questionNo: qa.no,
            answer: qa.ans,
            version: 1,
            createdAt: new Date(v.at),
            sourceIp: '127.0.0.1'
          }
        });
      }
    }
  }

  // 6. Seed Internal Co-owner votes
  // Byt č. 4: Martin and Lucia agree on everything.
  // Byt č. 12: Ivan and Olga conflict on q2 and q3.
  const coownerVotes = [
    // Unit 4
    { unitNo: '4', first: 'Martin', last: 'Baláž', q1: VoteAnswer.agree, q2: VoteAnswer.disagree, q3: VoteAnswer.disagree, at: '2026-06-17T20:01:00Z' },
    { unitNo: '4', first: 'Lucia', last: 'Balážová', q1: VoteAnswer.agree, q2: VoteAnswer.disagree, q3: VoteAnswer.disagree, at: '2026-06-17T20:01:00Z' },
    
    // Unit 12
    { unitNo: '12', first: 'Ivan', last: 'Sedlák', q1: VoteAnswer.agree, q2: VoteAnswer.disagree, q3: VoteAnswer.disagree, at: '2026-06-21T19:45:00Z' },
    { unitNo: '12', first: 'Oľga', last: 'Sedláková', q1: VoteAnswer.agree, q2: VoteAnswer.agree, q3: VoteAnswer.agree, at: '2026-06-21T19:45:00Z' },
  ];

  for (const cv of coownerVotes) {
    const unitId = createdUnitsMap.get(cv.unitNo)!;
    const ownerId = createdOwnersMap.get(`${cv.unitNo}_${cv.first}_${cv.last}`)!;

    const qAnswers = [
      { no: 1, ans: cv.q1 },
      { no: 2, ans: cv.q2 },
      { no: 3, ans: cv.q3 },
    ];

    for (const qa of qAnswers) {
      await prisma.coownerSubvote.create({
        data: {
          pollId: activePoll.id,
          unitId,
          ownerId,
          questionNo: qa.no,
          answer: qa.ans,
          version: 1,
          createdAt: new Date(cv.at),
          sourceIp: '127.0.0.1'
        }
      });
    }
  }

  // 7. Seed Archived Polls
  const archiveData = [
    { id: 'poll-2025-11', title: 'Zmena domového poriadku', end: new Date('2025-11-30T20:00:00Z'), declarer: 'Zástupca vlastníkov', questions: 1, eligible: 36, voted: 31, result: 'schválené' },
    { id: 'poll-2025-06', title: 'Schválenie ročného vyúčtovania a rozpočtu', end: new Date('2025-06-24T20:00:00Z'), declarer: 'Administrátor', questions: 2, eligible: 36, voted: 28, result: 'schválené' },
    { id: 'poll-2025-02', title: 'Inštalácia kamerového systému vo vchode', end: new Date('2025-02-18T20:00:00Z'), declarer: 'Rada', questions: 1, eligible: 36, voted: 22, result: 'neschválené' },
    { id: 'poll-2024-09', title: 'Test aplikácie (bez právnych účinkov)', end: new Date('2024-09-10T20:00:00Z'), declarer: 'Administrátor', questions: 1, eligible: 36, voted: 19, result: 'schválené' },
  ];

  for (const arc of archiveData) {
    const closedPoll = await prisma.poll.create({
      data: {
        id: arc.id,
        title: arc.title,
        reason: 'Archivovaný záznam hlasovania',
        declarer: arc.declarer,
        announcedAt: new Date(arc.end.getTime() - 1000 * 60 * 60 * 24 * 7),
        startAt: new Date(arc.end.getTime() - 1000 * 60 * 60 * 24 * 5),
        endAt: arc.end,
        status: PollStatus.closed,
        buildingId: building.id,
        questions: {
          create: Array.from({ length: arc.questions }, (_, index) => ({
            no: index + 1,
            kind: 'Všeobecné',
            title: `Otázka ${index + 1}`,
            text: `Popis otázky ${index + 1} pre archivované hlasovanie.`,
            majorityType: MajorityType.half_all
          }))
        }
      }
    });

    // Create a mock SealedResult record
    const sealedResultObj = {
      summary: `Archivované výsledky pre: ${arc.title}`,
      turnout: `${arc.voted} z ${arc.eligible}`,
      status: arc.result
    };
    
    await prisma.sealedResult.create({
      data: {
        pollId: closedPoll.id,
        resultJson: JSON.stringify(sealedResultObj),
        sha256: 'mock-sha256-hash-value-for-archived-results',
        sealedAt: arc.end,
        pdfPath: `/storage/sealed/${closedPoll.id}_zapisnica.pdf`
      }
    });
  }

  // 8. Seed Audit Log genesis entry
  await prisma.auditLog.create({
    data: {
      action: 'GENESIS',
      actor: 'system',
      payload: JSON.stringify({ message: 'Database initialized and seeded.' }),
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
      entryHash: 'f4e0c4b22c7a10be14c5c24e6de8a846b7a2d33454790bdde566ee26871536b3'
    }
  });

  // 9. Seed Question Templates
  await prisma.questionTemplate.createMany({
    data: [
      {
        title: "Výmena stúpačiek (spoločných rozvodov plynu, vody a kanalizácie)",
        text: "Súhlasíte s výmenou spoločných rozvodov plynu, studenej vody, teplej vody, cirkulácie a kanalizácie (stúpačiek) v bytovom dome Björnsonova 3, podľa predloženej projektovej dokumentácie a cenovej ponuky spoločnosti REKOPLAST s.r.o. v sume najviac 38 500 € s DPH, hradenej z fondu prevádzky, údržby a opráv, s termínom realizácie najneskôr do 30. novembra 2026?",
        majorityType: "half-all",
        note: "Podľa § 14b ods. 1 písm. g) zákona č. 182/1993 Z.z. o vlastníctve bytov a nebytových priestorov sa vyžaduje súhlas nadpolovičnej väčšiny hlasov všetkých vlastníkov bytov a nebytových priestorov v dome."
      },
      {
        title: "Celková rekonštrukcia a zateplenie strešného plášťa",
        text: "Súhlasíte s realizáciou celkovej rekonštrukcie a zateplenia strešného plášťa bytového domu Björnsonova 3 podľa cenovej ponuky spoločnosti STRECHY-SK s.r.o. vo výške najviac 65 000 € s DPH, financovanej z fondu prevádzky, údržby a opráv a z prostriedkov úveru, a so splnomocnením zástupcu vlastníkov na podpis zmluvy o dielo s víťazným uchádzačom?",
        majorityType: "twothirds-all",
        note: "Hlasovanie o oprave spoločných častí domu financovanej z úveru vyžaduje súhlas dvojtretinovej väčšiny hlasov všetkých vlastníkov podľa § 14b ods. 2 písm. b) zákona č. 182/1993 Z.z."
      },
      {
        title: "Zateplenie a obnova obvodového plášťa bytového domu",
        text: "Súhlasíte so zateplením obvodového plášťa bytového domu Björnsonova 3, odstránením systémových porúch loggií a obnovou fasády podľa spracovanej projektovej dokumentácie, za celkovú cenu diela maximálne 145 000 € s DPH, s využitím finančného príspevku zo Štátneho fondu rozvoja bývania (ŠFRB) alebo bankového úveru so splatnosťou 20 rokov?",
        majorityType: "twothirds-all",
        note: "Rozhodovanie o zateplení, zásadných opravách obvodového plášťa a prijatí úveru vyžaduje dvojtretinovú väčšinu všetkých vlastníkov podľa § 14b ods. 2 písm. a) a b) zákona č. 182/1993 Z.z."
      }
    ]
  });

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seeding failed: ", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
