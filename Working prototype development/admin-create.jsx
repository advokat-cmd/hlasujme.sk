// admin-create.jsx — create poll wizard: basics → questions+majority → units → pre-flight.

// datetime-local value (YYYY-MM-DDTHH:mm) for tomorrow at a given time, optionally + days
function tomorrowAt(h, m = 0, addDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 1 + addDays);
  d.setHours(h, m, 0, 0);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
// Pretty Slovak date-time for display
function fmtDT(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return v;
  const p = n => String(n).padStart(2, '0');
  return `${d.getDate()}. ${d.getMonth()+1}. ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function CreatePoll({ go }) {
  const [step, setStep] = React.useState(0);
  const steps = ['Základné údaje','Otázky a väčšina','Oprávnené jednotky','Kontrola a spustenie'];
  const [basics, setBasics] = React.useState({ title:'', reason:'', start: tomorrowAt(8), end: tomorrowAt(20, 0, 14) });
  const [questions, setQuestions] = React.useState([
    { id:1, text:'', majority:'half-all', note:'' },
  ]);
  const addQ = () => setQuestions(qs=>[...qs,{ id:Date.now(), text:'', majority:'half-all', note:'' }]);
  const rmQ = (id) => setQuestions(qs=>qs.length>1?qs.filter(q=>q.id!==id):qs);
  const setQ = (id, patch) => setQuestions(qs=>qs.map(q=>q.id===id?{...q,...patch}:q));

  return (
    <div>
      <PageHead eyebrow="Nové elektronické hlasovanie" title="Vytvoriť hlasovanie">
        <Btn kind="ghost" onClick={()=>go('dashboard')}>Zrušiť</Btn>
      </PageHead>

      {/* Stepper */}
      <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:30 }}>
        {steps.map((s,i)=>(
          <React.Fragment key={i}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:28, height:28, borderRadius:999, flexShrink:0, display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:13, fontWeight:700, fontFamily:'var(--serif)',
                background: i<step?'var(--agree)':i===step?'var(--primary)':'var(--paper-2)',
                color: i<=step?'#fff':'var(--ink-faint)', border: i>step?'1px solid var(--line)':'none' }}>
                {i<step ? <Ic name="check" size={15} sw={3}/> : i+1}</div>
              <span style={{ fontSize:13, fontWeight:600, color: i<=step?'var(--ink)':'var(--ink-faint)' }}>{s}</span>
            </div>
            {i<steps.length-1 && <div style={{ flex:1, height:1.5, margin:'0 14px', background: i<step?'var(--agree)':'var(--line)' }} />}
          </React.Fragment>
        ))}
      </div>

      <Card style={{ marginBottom:22 }}>
        {step===0 && <StepBasics basics={basics} setBasics={setBasics} />}
        {step===1 && <StepQuestions questions={questions} addQ={addQ} rmQ={rmQ} setQ={setQ} />}
        {step===2 && <StepUnits />}
        {step===3 && <StepReview basics={basics} questions={questions} />}
      </Card>

      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <Btn kind="secondary" icon="chevL" onClick={()=>step>0?setStep(step-1):go('dashboard')}>
          {step>0?'Späť':'Zrušiť'}</Btn>
        {step<3
          ? <Btn kind="primary" iconR="chevR" onClick={()=>setStep(step+1)}>Pokračovať</Btn>
          : <Btn kind="gold" icon="send" onClick={()=>go('poll')}>Spustiť a odoslať pozvánky</Btn>}
      </div>
    </div>
  );
}

const fieldStyle = { width:'100%', boxSizing:'border-box', padding:'10px 13px', borderRadius:9,
  border:'1px solid var(--line)', fontFamily:'inherit', fontSize:14, background:'var(--paper)', color:'var(--ink)' };
function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom:18 }}>
      <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize:11.5, color:'var(--ink-soft)', marginTop:5 }}>{hint}</div>}
    </div>
  );
}

function StepBasics({ basics, setBasics }) {
  const set = (k,v)=>setBasics(b=>({...b,[k]:v}));
  return (
    <div>
      <SectionTitle sub="Tieto údaje sa objavia v pozvánke aj v zápisnici">Základné údaje hlasovania</SectionTitle>
      <Field label="Názov hlasovania">
        <input style={fieldStyle} placeholder="napr. Hlasovanie vlastníkov – jar 2026"
          value={basics.title} onChange={e=>set('title',e.target.value)} /></Field>
      <Field label="Dôvod hlasovania">
        <input style={fieldStyle} placeholder="napr. Obnova vstupných priestorov"
          value={basics.reason} onChange={e=>set('reason',e.target.value)} /></Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Field label="Začiatok hlasovania" hint="Predvolene zajtrajší deň — kliknutím zvolíte dátum a čas.">
          <input type="datetime-local" style={fieldStyle} value={basics.start} onChange={e=>set('start',e.target.value)} /></Field>
        <Field label="Koniec hlasovania" hint="Do tohto termínu môžu vlastníci hlas meniť.">
          <input type="datetime-local" style={fieldStyle} value={basics.end} onChange={e=>set('end',e.target.value)} /></Field>
      </div>
      <Field label="Prílohy hlasovania" hint="Nahrajú sa na prepojený Google Drive a pri hlasovaní budú dostupné na stiahnutie.">
        <div role="button" tabIndex={0} aria-label="Nahrať prílohy k hlasovaniu"
          style={{ border:'1.5px dashed var(--line)', borderRadius:10, padding:'18px', textAlign:'center',
          color:'var(--ink-soft)', fontSize:13, background:'var(--paper-2)', cursor:'pointer' }}>
          <Ic name="download" size={20} style={{ color:'var(--ink-faint)' }} /><div style={{ marginTop:5 }}>Pretiahnite súbory alebo kliknite — cenové ponuky, projekt, rozpočet…</div>
        </div></Field>
    </div>
  );
}

function StepQuestions({ questions, addQ, rmQ, setQ }) {
  const [tmplFor, setTmplFor] = React.useState(null);
  return (
    <div>
      <SectionTitle sub="Pri každej otázke nastavte požadovanú väčšinu podľa zákona č. 182/1993 Z. z."
        action={<Btn kind="secondary" size="sm" icon="plus" onClick={addQ}>Pridať otázku</Btn>}>Otázky</SectionTitle>
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {questions.map((q,idx)=>(
          <div key={q.id} style={{ border:'1px solid var(--line)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', background:'var(--paper-2)',
              borderBottom:'1px solid var(--line)' }}>
              <span style={{ width:24, height:24, borderRadius:7, background:'var(--primary)', color:'#fff', display:'flex',
                alignItems:'center', justifyContent:'center', fontSize:12.5, fontWeight:700 }}>{idx+1}</span>
              <span style={{ fontSize:13, fontWeight:600 }}>Otázka č. {idx+1}</span>
              <button onClick={()=>setTmplFor(tmplFor===q.id?null:q.id)} style={{ marginLeft:'auto', fontSize:12, fontWeight:600,
                color:'var(--primary)', background:'none', border:'none', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5 }}>
                <Ic name="doc" size={14}/> Šablóny</button>
              {questions.length>1 && <button onClick={()=>rmQ(q.id)} aria-label={`Odstrániť otázku č. ${idx+1}`} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', display:'flex' }}><Ic name="x" size={17}/></button>}
            </div>
            {tmplFor===q.id && (
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--line)', display:'flex', flexWrap:'wrap', gap:7 }}>
                {TEMPLATES.map(t=>(
                  <button key={t} onClick={()=>{ setQ(q.id,{text:'Súhlasíte s: '+t+'…'}); setTmplFor(null); }}
                    style={{ fontSize:12, padding:'5px 11px', borderRadius:999, border:'1px solid var(--line)',
                    background:'var(--surface)', cursor:'pointer', color:'var(--ink-soft)', fontFamily:'inherit' }}>{t}</button>
                ))}
              </div>
            )}
            <div style={{ padding:16 }}>
              <Field label="Úplné znenie návrhu">
                <textarea style={{ ...fieldStyle, minHeight:72, resize:'vertical', lineHeight:1.5 }}
                  placeholder="Súhlasíte s…?" value={q.text} onChange={e=>setQ(q.id,{text:e.target.value})} /></Field>
              <Field label="Požadovaná väčšina">
                <div role="radiogroup" aria-label="Požadovaná väčšina" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {Object.entries(MAJORITY).map(([k,m])=>(
                    <button key={k} role="radio" aria-checked={q.majority===k} onClick={()=>setQ(q.id,{majority:k})} style={{ textAlign:'left', padding:'10px 12px',
                      borderRadius:9, cursor:'pointer', fontFamily:'inherit', border:'1.5px solid',
                      borderColor: q.majority===k?'var(--primary)':'var(--line)',
                      background: q.majority===k?'var(--primary-bg)':'var(--surface)' }}>
                      <div style={{ fontSize:12.5, fontWeight:600, color: q.majority===k?'var(--primary)':'var(--ink)' }}>{m.label}</div>
                      <div style={{ fontSize:11, color:'var(--ink-soft)', marginTop:1 }}>{m.frac}</div>
                    </button>
                  ))}
                </div>
              </Field>
              <div style={{ display:'flex', alignItems:'center', gap:9, fontSize:12.5, color:'var(--ink-soft)' }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>Možnosti odpovede:</span>
                <Pill tone="agree" size="sm" icon="check">Súhlasím</Pill>
                <Pill tone="disagree" size="sm" icon="x">Nesúhlasím</Pill>
                <Pill tone="abstain" size="sm" icon="minus">Nechcem hlasovať</Pill>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepUnits() {
  const total = UNITS.length;
  const coowned = UNITS.filter(u=>u.owners.length>1).length;
  const noEmail = UNITS.filter(u=>!u.email);
  const plural = (n) => n===1 ? 'jednotka' : (n>=2 && n<=4 ? 'jednotky' : 'jednotiek');
  const groups = [
    ['Jediný vlastník / BSM', ['single','bsm','legal'], 'Link dostane určená osoba'],
    ['Určený zástupca bytu', ['rep'], 'Link iba zástupcovi, ostatní info kópiu'],
    ['Interné hlasovanie spoluvlastníkov', ['internal'], 'Link každému, hlas sa počíta podľa podielov'],
    ['Väčšinový spoluvlastník', ['majority'], 'Rozhoduje hlas väčšinového podielu'],
  ];
  return (
    <div>
      <SectionTitle sub="Predvolene sú zahrnuté všetky jednotky. Pri spoluvlastníctve sa postupuje podľa nastaveného režimu.">Oprávnené jednotky</SectionTitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:18 }}>
        <Card pad={16}><Stat label="Zahrnuté jednotky" value={`${total} / ${total}`} /></Card>
        <Card pad={16}><Stat label="So spoluvlastníkmi" value={coowned} sub="rieši sa podľa režimu" /></Card>
        <Card pad={16}><Stat label="Bez e-mailu" value={noEmail.length} tone={noEmail.length?'var(--disagree)':undefined}
          sub={noEmail.length ? noEmail.map(u=>'byt č. '+u.no).join(', ') : 'všetci majú e-mail'} /></Card>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {groups.map(([a,modes,c],i)=>{
          const n = UNITS.filter(u=>modes.includes(u.coMode)).length;
          return (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 16px', border:'1px solid var(--line)',
            borderRadius:10 }}>
            <Ic name="users" size={18} style={{ color:'var(--ink-soft)' }} />
            <div style={{ flex:1 }}><div style={{ fontSize:13.5, fontWeight:600 }}>{a}</div>
              <div style={{ fontSize:11.5, color:'var(--ink-soft)' }}>{c}</div></div>
            <span style={{ fontSize:12.5, fontWeight:600, color:'var(--ink-soft)' }}>{n} {plural(n)}</span>
          </div>);
        })}
      </div>
    </div>
  );
}

function StepReview({ basics, questions }) {
  const noEmail = UNITS.filter(u=>!u.email);
  const checks = [
    { ok:true, t:'Každá otázka má priradenú väčšinu' },
    { ok:true, t:'Všetci vlastníci sú priradení k jednotkám' },
    { ok:true, t:'Vyriešené režimy spoluvlastníctva' },
    { ok: noEmail.length===0,
      t: noEmail.length ? `Byt č. ${noEmail.map(u=>u.no).join(', ')} nemá nahlásenú e-mailovú adresu`
                        : 'Všetky jednotky majú e-mailovú adresu' },
  ];
  return (
    <div>
      <SectionTitle sub="Aplikácia pred spustením skontroluje úplnosť údajov">Kontrola pred spustením</SectionTitle>
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:22 }}>
        <div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {checks.map((c,i)=>(
              <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', fontSize:13.5 }}>
                <Ic name={c.ok?'checkCircle':'alert'} size={18} style={{ color:c.ok?'var(--agree)':'var(--accent-ink)', flexShrink:0, marginTop:1 }} />
                <span style={{ color:c.ok?'var(--ink)':'var(--accent-ink)' }}>{c.t}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:18, padding:'12px 14px', borderRadius:9, background:'var(--primary-bg)', fontSize:12.5,
            color:'var(--primary)', lineHeight:1.5, display:'flex', gap:9 }}>
            <Ic name="send" size={16} style={{ flexShrink:0, marginTop:1 }} />
            Po spustení sa každému oprávnenému hlasu vygeneruje jedinečný, kryptograficky náhodný link (magic link) a odošle sa samostatná pozvánka cez Gmail API.
          </div>
        </div>
        <div style={{ background:'var(--paper-2)', borderRadius:12, padding:18 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>Zhrnutie</div>
          <SummaryRow label="Názov">{basics.title || 'Hlasovanie vlastníkov – jar 2026'}</SummaryRow>
          <SummaryRow label="Trvanie">{fmtDT(basics.start)} → {fmtDT(basics.end)}</SummaryRow>
          <SummaryRow label="Počet otázok">{questions.length}</SummaryRow>
          <SummaryRow label="Oprávnené hlasy">{UNITS.length} jednotiek</SummaryRow>
          <SummaryRow label="Odosielateľ">Gmail API · OAuth 2.0</SummaryRow>
        </div>
      </div>
    </div>
  );
}
function SummaryRow({ label, children }) {
  return <div style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'7px 0', borderTop:'1px solid var(--line)', fontSize:13 }}>
    <span style={{ color:'var(--ink-soft)' }}>{label}</span><span style={{ fontWeight:600, textAlign:'right' }}>{children}</span></div>;
}

Object.assign(window, { CreatePoll });
