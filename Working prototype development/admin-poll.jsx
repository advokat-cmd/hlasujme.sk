// admin-poll.jsx — active poll detail: legal voting engine, participation, e-mails, protocol.

function PollDetail({ go, onOpenVoter }) {
  const [tab, setTab] = React.useState('results');
  const [closing, setClosing] = React.useState(false);
  const tabs = [
    { id:'results', label:'Otázky a výsledky', icon:'scale' },
    { id:'units', label:'Účasť po jednotkách', icon:'building' },
    { id:'emails', label:'Pozvánky a e-maily', icon:'mail' },
    { id:'protocol', label:'Zápisnica', icon:'paper' },
  ];
  return (
    <div>
      <PageHead eyebrow={`${BUILDING.name} · prebieha do ${POLL.end}`} title={POLL.title}>
        <Btn kind="secondary" icon="eye" onClick={onOpenVoter}>Ukážka linku</Btn>
        <Btn kind="gold" icon="lock" onClick={()=>setClosing(true)}>Uzavrieť hlasovanie</Btn>
      </PageHead>

      {/* meta strip */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'10px 26px', marginBottom:24, fontSize:12.5 }}>
        <MetaInline icon="user" label="Vyhlásil">{POLL.declarer}</MetaInline>
        <MetaInline icon="bell" label="Oznámené">{POLL.announced}</MetaInline>
        <MetaInline icon="clock" label="Trvanie">{POLL.start} → {POLL.end}</MetaInline>
        <MetaInline icon="building" label="Oprávnené hlasy">{UNITS.length} jednotiek</MetaInline>
      </div>

      {/* tabs */}
      <div role="tablist" aria-label="Sekcie hlasovania" style={{ display:'flex', gap:2, borderBottom:'1px solid var(--line)', marginBottom:26, overflowX:'auto' }}>
        {tabs.map(t=>(
          <button key={t.id} role="tab" aria-selected={tab===t.id} onClick={()=>setTab(t.id)} style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0,
            whiteSpace:'nowrap', padding:'11px 16px', border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit',
            fontSize:13.5, fontWeight:600, color: tab===t.id?'var(--ink)':'var(--ink-soft)',
            borderBottom: tab===t.id?'2px solid var(--accent)':'2px solid transparent', marginBottom:-1 }}>
            <Ic name={t.icon} size={16} />{t.label}
          </button>
        ))}
      </div>

      {tab==='results' && <ResultsTab />}
      {tab==='units' && <UnitsTab onOpenVoter={onOpenVoter} />}
      {tab==='emails' && <EmailsTab />}
      {tab==='protocol' && <ProtocolTab go={go} setClosing={setClosing} />}

      {closing && <CloseModal onClose={()=>setClosing(false)} go={()=>{ setClosing(false); setTab('protocol'); }} />}
    </div>
  );
}
function MetaInline({ icon, label, children }) {
  return <span style={{ display:'inline-flex', alignItems:'center', gap:6, color:'var(--ink-soft)' }}>
    <Ic name={icon} size={14} style={{ color:'var(--ink-faint)' }} />
    <span style={{ color:'var(--ink-faint)', fontWeight:600 }}>{label}:</span>
    <span style={{ color:'var(--ink)', fontWeight:600 }}>{children}</span></span>;
}

// ── Results tab — the legal engine ───────────────────────────
function ResultsTab() {
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:10,
        background:'var(--primary-bg)', color:'var(--primary)', fontSize:13, marginBottom:22, lineHeight:1.5 }}>
        <Ic name="eyeOff" size={18} style={{ flexShrink:0 }} />
        Vlastníci počas hlasovania priebežné výsledky nevidia — túto obrazovku vidí iba administrátor.
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        {POLL.questions.map(q => <QuestionResult key={q.no} q={q} />)}
      </div>
    </div>
  );
}

function QuestionResult({ q }) {
  const r = questionResult(q);
  const m = RESULT_META[r.status];
  const rows = [
    { label:'Súhlasím', v:r.agree, c:'var(--agree)' },
    { label:'Nesúhlasím', v:r.disagree, c:'var(--disagree)' },
    { label:'Nechcem hlasovať', v:r.abstain, c:'var(--abstain)' },
    { label:'Nehlasovali', v:r.none, c:'var(--ink-faint)' },
    { label:'Sporné byty', v:r.disputed, c:'var(--accent-ink)' },
  ];
  return (
    <Card pad={0} style={{ overflow:'hidden' }}>
      <div style={{ padding:'20px 24px', display:'flex', gap:18, alignItems:'flex-start' }}>
        <div style={{ width:34, height:34, borderRadius:8, background:'var(--primary)', color:'#fff', flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--serif)', fontSize:17, fontWeight:600 }}>{q.no}</div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
            <Pill tone="neutral" size="sm">{q.kind}</Pill>
            <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, color:'var(--ink-soft)', fontWeight:600 }}>
              <Ic name="scale" size={13}/> {r.maj.label}</span>
          </div>
          <h3 style={{ fontFamily:'var(--serif)', fontSize:18, fontWeight:600, margin:'0 0 6px' }}>{q.title}</h3>
          <p style={{ fontSize:13, color:'var(--ink-soft)', margin:0, lineHeight:1.5, maxWidth:640 }}>{q.text}</p>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <Pill tone={m.tone} icon={m.icon}>{m.label}</Pill>
        </div>
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', borderTop:'1px solid var(--line)' }}>
        {/* threshold visual */}
        <div style={{ flex:'1 1 340px', padding:'20px 24px', borderRight:'1px solid var(--line)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
            <span style={{ fontSize:12.5, fontWeight:600, color:'var(--ink-soft)' }}>Hlasy „súhlasím" voči potrebnej väčšine</span>
            <span style={{ fontFamily:'var(--serif)', fontSize:15, fontWeight:600 }}>
              {r.agree} / <span style={{ color:'var(--ink-soft)' }}>{r.need}</span></span>
          </div>
          <Progress height={12} total={r.total} threshold={r.need}
            segments={[{value:r.agree,color:'var(--agree)'},{value:r.disagree,color:'var(--disagree)'}]} />
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:7, fontSize:11, color:'var(--ink-faint)' }}>
            <span>0</span>
            <span style={{ fontWeight:600, color:'var(--ink-soft)' }}>▲ potrebných {r.need} z {r.total} ({r.maj.frac})</span>
            <span>{r.total}</span>
          </div>
          {r.status==='short' && (
            <div style={{ marginTop:14, fontSize:12.5, color:'var(--accent-ink)', background:'var(--accent-bg)',
              padding:'9px 12px', borderRadius:8, lineHeight:1.45 }}>
              Chýba ešte {r.need-r.agree} {r.need-r.agree===1?'hlas':'hlasov'}. Väčšina sa počíta zo <b>všetkých</b> vlastníkov, nie len z hlasujúcich.
            </div>
          )}
        </div>
        {/* tally */}
        <div style={{ flex:'1 1 240px', padding:'16px 24px', display:'flex', flexDirection:'column', justifyContent:'center', gap:9 }}>
          {rows.map((row,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ width:9, height:9, borderRadius:3, background:row.c, flexShrink:0 }} />
              <span style={{ flex:1, fontSize:13, color:'var(--ink-soft)' }}>{row.label}</span>
              <span style={{ fontSize:14, fontWeight:700, fontVariantNumeric:'tabular-nums',
                color: row.v?'var(--ink)':'var(--ink-faint)' }}>{row.v}</span>
            </div>
          ))}
        </div>
      </div>

      {q.attachments.length>0 && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 24px', borderTop:'1px solid var(--line)',
          background:'var(--paper-2)', flexWrap:'wrap' }}>
          <span style={{ fontSize:11.5, fontWeight:600, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:0.4 }}>Prílohy</span>
          {q.attachments.map((a,i)=>(
            <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12.5, color:'var(--primary)',
              background:'var(--surface)', border:'1px solid var(--line)', borderRadius:7, padding:'5px 10px', cursor:'pointer' }}>
              <Ic name="doc" size={14}/> {a} <Ic name="download" size={13}/></span>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Units tab — participation grid ───────────────────────────
function UnitsTab({ onOpenVoter }) {
  const [filter, setFilter] = React.useState('all');
  const filters = [['all','Všetky'],['voted','Hlasovali'],['none','Nehlasovali'],['disputed','Sporné']];
  const rows = UNITS.map(u=>{
    const per = POLL.questions.map(q=>effectiveUnitVote(u,'q'+q.no));
    const voted = !!(window.VOTES[u.id]||window.COOWNER_SPLIT[u.id]);
    const disputed = per.some(p=>p.disputed);
    return { u, per, voted, disputed, at: (window.VOTES[u.id]||{}).at, changed:(window.VOTES[u.id]||{}).changed };
  }).filter(r=>{
    if(filter==='voted') return r.voted; if(filter==='none') return !r.voted;
    if(filter==='disputed') return r.disputed; return true;
  });
  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        {filters.map(([id,l])=>(
          <button key={id} onClick={()=>setFilter(id)} aria-pressed={filter===id} style={{ padding:'7px 13px', borderRadius:999, cursor:'pointer',
            fontFamily:'inherit', fontSize:12.5, fontWeight:600, border:'1px solid var(--line)',
            background: filter===id?'var(--ink)':'var(--surface)', color: filter===id?'#fff':'var(--ink-soft)' }}>{l}</button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:12.5, color:'var(--ink-soft)' }}>{rows.length} jednotiek</span>
      </div>
      <Card pad={0}>
        <TableScroll minWidth={640}>
        <div style={{ display:'grid', gridTemplateColumns:'72px 1fr repeat(3,84px) 120px', padding:'11px 18px',
          borderBottom:'1px solid var(--line)', background:'var(--paper-2)', fontSize:11, fontWeight:600,
          color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:0.4, alignItems:'center' }}>
          <div>Jedn.</div><div>Vlastník</div>
          {POLL.questions.map(q=><div key={q.no} style={{ textAlign:'center' }}>Ot. {q.no}</div>)}
          <div>Hlasoval</div>
        </div>
        {rows.map(({u,per,voted,at,changed,disputed})=>(
          <div key={u.id} style={{ display:'grid', gridTemplateColumns:'72px 1fr repeat(3,84px) 120px',
            padding:'10px 18px', borderBottom:'1px solid var(--line)', alignItems:'center', fontSize:13,
            background: disputed?'var(--accent-bg)':'transparent' }}>
            <div style={{ fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{u.no}{u.type==='nebyt'&&<span style={{ fontSize:10, color:'var(--accent-ink)' }}> NP</span>}</div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{u.owners[0].name}{u.owners.length>1?` +${u.owners.length-1}`:''}</div>
              {u.coMode!=='single' && <div style={{ fontSize:10.5, color:'var(--ink-soft)' }}>{CO_MODE_LABEL[u.coMode]}</div>}
            </div>
            {per.map((p,i)=>(
              <div key={i} style={{ display:'flex', justifyContent:'center' }}>
                <VoteDot r={p} />
              </div>
            ))}
            <div style={{ fontSize:11.5, color:'var(--ink-soft)' }}>
              {voted ? <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>{at}{changed && <Pill tone="neutral" size="sm">zmenené</Pill>}</span>
                     : <span style={{ color:'var(--ink-faint)' }}>—</span>}
            </div>
          </div>
        ))}
        </TableScroll>
      </Card>
    </div>
  );
}
function VoteDot({ r }) {
  if (r.disputed) return <span role="img" aria-label="Sporný hlas" title={r.note}><Ic name="alert" size={17} style={{ color:'var(--accent-ink)' }} /></span>;
  const map = { agree:{c:'var(--agree)',i:'check'}, disagree:{c:'var(--disagree)',i:'x'}, abstain:{c:'var(--abstain)',i:'minus'} };
  if (!r.answer) return <span role="img" aria-label="Nehlasoval" style={{ width:7, height:7, borderRadius:999, background:'var(--line)', display:'inline-block' }} />;
  const v = map[r.answer];
  return <span role="img" aria-label={(VOTE_STYLE[r.answer]||{}).label || r.answer} style={{ width:22, height:22, borderRadius:999, background:v.c+'22', display:'inline-flex',
    alignItems:'center', justifyContent:'center' }}><Ic name={v.i} size={14} sw={2.6} style={{ color:v.c }} /></span>;
}

// ── E-mails tab ──────────────────────────────────────────────
function EmailsTab() {
  const tmpl = [
    { t:'Pozvánka na hlasovanie', d:'Odoslané 16. 6. — osobný link každému vlastníkovi', n:36, s:'sent', icon:'send' },
    { t:'Pripomienka (48 h pred koncom)', d:'Naplánované 28. 6., 20:00 — iba nehlasujúcim', n:15, s:'scheduled', icon:'clock' },
    { t:'Potvrdenie prijatia hlasu', d:'Automaticky po každom hlase', n:21, s:'auto', icon:'checkCircle' },
    { t:'Výsledok hlasovania', d:'Po overení výsledkov administrátorom', n:0, s:'pending', icon:'paper' },
  ];
  const sTone = { sent:'success', scheduled:'primary', auto:'neutral', pending:'neutral' };
  const sLabel = { sent:'odoslané', scheduled:'naplánované', auto:'automatické', pending:'čaká' };
  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'14px 16px', borderRadius:10,
        background:'var(--paper-2)', border:'1px solid var(--line)', fontSize:12.5, marginBottom:22, lineHeight:1.5 }}>
        <Ic name="shield" size={18} style={{ color:'var(--primary)', flexShrink:0, marginTop:1 }} />
        <div>E-maily sa odosielajú jednotlivo cez <b>Gmail API (OAuth 2.0)</b> z účtu <code style={{ background:'var(--surface)', padding:'1px 6px', borderRadius:5, border:'1px solid var(--line)' }}>hlasovanie.bjornsonova3@gmail.com</code>. Žiadny príjemca nevidí e-mail iného vlastníka. Prílohy sú na prepojenom Google Drive.</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
        {tmpl.map((m,i)=>(
          <Card key={i} pad={0}>
            <div style={{ display:'flex', alignItems:'center', gap:14, padding:'15px 18px' }}>
              <div style={{ width:38, height:38, borderRadius:9, background:'var(--paper-2)', display:'flex',
                alignItems:'center', justifyContent:'center', flexShrink:0 }}><Ic name={m.icon} size={18} style={{ color:'var(--ink-soft)' }} /></div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{m.t}</div>
                <div style={{ fontSize:12, color:'var(--ink-soft)', marginTop:1 }}>{m.d}</div>
              </div>
              <span style={{ fontSize:12.5, color:'var(--ink-soft)', fontVariantNumeric:'tabular-nums' }}>{m.n} príjemcov</span>
              <Pill tone={sTone[m.s]} size="sm">{sLabel[m.s]}</Pill>
            </div>
          </Card>
        ))}
      </div>
      {/* delivery problems */}
      <SectionTitle>Chyby doručenia</SectionTitle>
      <Card>
        <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:13 }}>
          <div style={{ width:34, height:34, borderRadius:9, background:'var(--disagree-bg)', color:'var(--disagree)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Ic name="alert" size={17}/></div>
          <div style={{ flex:1 }}>
            <b>Byt č. 8</b> — vlastník nemá zadanú e-mailovú adresu. Pozvánka nebola odoslaná, je potrebné doplniť kontakt alebo zabezpečiť iné doručenie.
          </div>
          <Btn kind="secondary" size="sm">Doplniť e-mail</Btn>
        </div>
      </Card>
    </div>
  );
}

// ── Protocol tab ─────────────────────────────────────────────
function ProtocolTab({ setClosing }) {
  return (
    <div>
      <Card style={{ marginBottom:20 }}>
        <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'var(--accent-bg)', color:'var(--accent-ink)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Ic name="lock" size={20}/></div>
          <div style={{ flex:1 }}>
            <h3 style={{ fontFamily:'var(--serif)', fontSize:17, fontWeight:600, margin:'0 0 5px' }}>Hlasovanie ešte prebieha</h3>
            <p style={{ fontSize:13, color:'var(--ink-soft)', margin:0, lineHeight:1.5, maxWidth:560 }}>
              Zápisnicu je možné vygenerovať až po uplynutí termínu ({POLL.end}) a uzavretí hlasovania. Do termínu môžu vlastníci svoj hlas meniť — platí posledné elektronické hlasovanie.</p>
          </div>
          <Btn kind="gold" icon="lock" onClick={()=>setClosing(true)}>Uzavrieť teraz</Btn>
        </div>
      </Card>
      <SectionTitle sub="Vygeneruje sa automaticky po uzavretí a overení administrátorom">Čo bude obsahovať zápisnica (PDF)</SectionTitle>
      <Card>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 28px' }}>
          {['Identifikácia domu a vchodu','Dátum a čas hlasovania','Kto hlasovanie vyhlásil','Úplné znenie otázok',
            'Právny typ väčšiny pre každú otázku','Počet oprávnených hlasov','Hlasy za / proti / neplatné / nehlasujúci',
            'Výsledok každej otázky','Dátum zverejnenia','Menný zoznam elektronicky hlasujúcich (príloha)'].map((x,i)=>(
            <div key={i} style={{ display:'flex', gap:9, alignItems:'flex-start', fontSize:13 }}>
              <Ic name="check" size={16} sw={2.4} style={{ color:'var(--agree)', flexShrink:0, marginTop:2 }} />{x}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Close modal (pre-flight + double check) ──────────────────
function CloseModal({ onClose, go }) {
  const [step, setStep] = React.useState(0);
  const checks = [
    { ok:true, t:'Každá otázka má priradený typ väčšiny' },
    { ok:true, t:'Všetci vlastníci sú priradení k jednotkám' },
    { ok:true, t:'Žiadne duplicitné e-mailové adresy' },
    { ok:false, t:'Byt č. 12 — sporný hlas spoluvlastníkov (bez väčšiny podielov)' },
    { ok:false, t:'Byt č. 8 — chýbajúca e-mailová adresa' },
  ];
  return (
    <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(20,26,38,.5)', backdropFilter:'blur(2px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:24 }}>
      <div onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Uzavretie hlasovania"
        style={{ width:540, maxWidth:'100%', background:'var(--surface)',
        borderRadius:16, overflow:'hidden', boxShadow:'0 30px 80px -20px rgba(0,0,0,.5)' }}>
        <div style={{ padding:'22px 26px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:12 }}>
          <Ic name={step===0?'shield':'paper'} size={22} style={{ color:'var(--accent-ink)' }} />
          <div>
            <h3 style={{ fontFamily:'var(--serif)', fontSize:18, fontWeight:600, margin:0 }}>
              {step===0?'Kontrola pred uzavretím':'Dvojitá kontrola výsledkov'}</h3>
            <div style={{ fontSize:12.5, color:'var(--ink-soft)' }}>{step===0?'Pred uzamknutím hlasovania':'Pred odoslaním výsledkov vlastníkom'}</div>
          </div>
        </div>
        <div style={{ padding:'22px 26px' }}>
          {step===0 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
              {checks.map((c,i)=>(
                <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', fontSize:13.5 }}>
                  <Ic name={c.ok?'checkCircle':'alert'} size={18} style={{ color: c.ok?'var(--agree)':'var(--accent-ink)', flexShrink:0, marginTop:1 }} />
                  <span style={{ color: c.ok?'var(--ink)':'var(--accent-ink)' }}>{c.t}</span>
                </div>
              ))}
              <div style={{ fontSize:12.5, color:'var(--ink-soft)', marginTop:6, lineHeight:1.5, background:'var(--paper-2)', padding:'10px 12px', borderRadius:8 }}>
                Upozornenia nebránia uzavretiu, no sporné a nedoručené jednotky budú v zápisnici uvedené samostatne.
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {POLL.questions.map(q=>{ const r=questionResult(q); const m=RESULT_META[r.status];
                return <div key={q.no} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--ink-faint)' }}>{q.no}.</span>
                  <span style={{ flex:1, fontSize:13, fontWeight:600 }}>{q.title}</span>
                  <span style={{ fontSize:12, color:'var(--ink-soft)', fontVariantNumeric:'tabular-nums' }}>{r.agree}/{r.need}</span>
                  <Pill tone={m.tone} size="sm" icon={m.icon}>{m.label}</Pill></div>; })}
              <div style={{ fontSize:12.5, color:'var(--ink-soft)', lineHeight:1.5, background:'var(--paper-2)', padding:'10px 12px', borderRadius:8 }}>
                Po potvrdení sa vygeneruje finálna PDF zápisnica a výsledok sa odošle vlastníkom. Archív je nemenný — prípadná oprava sa rieši dodatkom.
              </div>
            </div>
          )}
        </div>
        <div style={{ padding:'16px 26px', borderTop:'1px solid var(--line)', display:'flex', justifyContent:'flex-end', gap:10 }}>
          <Btn kind="secondary" onClick={onClose}>Zrušiť</Btn>
          {step===0
            ? <Btn kind="gold" icon="lock" onClick={()=>setStep(1)}>Uzavrieť a vyhodnotiť</Btn>
            : <Btn kind="primary" icon="send" onClick={go}>Potvrdiť a odoslať výsledky</Btn>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PollDetail });
