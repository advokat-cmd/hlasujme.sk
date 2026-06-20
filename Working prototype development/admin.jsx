// admin.jsx — admin console shell + Dashboard, Register, Archive screens.
// Exports AdminApp (and uses PollDetail / CreatePoll from sibling files).

const { useState } = React;

// ── Administrator login ──────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = (e) => {
    if (e) e.preventDefault();
    const cred = window.ADMIN_CREDENTIALS.find(c =>
      c.email.toLowerCase() === email.trim().toLowerCase() && c.password === password);
    if (cred) { setError(''); onLogin(cred); }
    else setError('Nesprávny e-mail alebo heslo.');
  };
  return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:24,
      background:'radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--primary) 9%, var(--paper-2)), var(--paper-2))' }}>
      <div style={{ width:420, maxWidth:'100%' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:22 }}>
          <div style={{ width:52, height:52, borderRadius:13, background:'var(--primary)', display:'flex',
            alignItems:'center', justifyContent:'center', marginBottom:14 }}>
            <Ic name="scale" size={28} sw={2} style={{ color:'#fff' }} /></div>
          <h1 style={{ fontFamily:'var(--serif)', fontSize:23, fontWeight:600, margin:0 }}>Prihlásenie administrátora</h1>
          <p style={{ fontSize:13, color:'var(--ink-soft)', margin:'6px 0 0', textAlign:'center' }}>{BUILDING.name}</p>
        </div>
        <Card>
          <form onSubmit={submit}>
            <FormRow label="E-mail"><Input type="email" value={email} autoFocus autoComplete="username"
              onChange={e=>{ setEmail(e.target.value); setError(''); }} placeholder="vas@email.sk" /></FormRow>
            <FormRow label="Heslo"><Input type="password" value={password} autoComplete="current-password"
              onChange={e=>{ setPassword(e.target.value); setError(''); }} placeholder="••••••••" /></FormRow>
            {error && <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12.5, color:'var(--disagree)',
              marginBottom:12 }}><Ic name="alert" size={15} />{error}</div>}
            <Btn kind="primary" full size="lg" icon="lock" onClick={submit}>Prihlásiť sa</Btn>
          </form>
        </Card>
        <div style={{ display:'flex', alignItems:'flex-start', gap:9, padding:'12px 14px', borderRadius:10, marginTop:14,
          background:'var(--accent-bg)', color:'var(--accent-ink)', fontSize:12, lineHeight:1.5 }}>
          <Ic name="eye" size={15} style={{ flexShrink:0, marginTop:1 }} />
          <div>Ukážkové údaje: <b>kovacova@spravadomov.sk</b> · heslo <b>demo1234</b>. Prihlásiť sa môžu len vlastníci s rolou administrátor — bežní vlastníci hlasujú cez odkaz v e-maile.</div>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar shell ────────────────────────────────────────────
function AdminApp({ onOpenVoter, user, onLogout }) {
  const [screen, setScreen] = useState({ name:'dashboard' });
  const go = (name, params) => setScreen({ name, ...params });

  const nav = [
    { id:'dashboard', label:'Prehľad', icon:'dashboard' },
    { id:'poll', label:'Aktívne hlasovanie', icon:'vote' },
    { id:'register', label:'Dom a vlastníci', icon:'building' },
    { id:'archive', label:'Archív', icon:'archive' },
  ];
  const active = screen.name === 'create' ? 'poll' : screen.name;
  const narrow = useNarrow(860);
  const u = user || { name:'Administrátor', unit:null };
  const initials = (u.name||'A').split(' ').filter(Boolean).map(x=>x[0]).slice(-2).join('').toUpperCase();
  const roleLabel = u.unit ? `Administrátor · byt č. ${u.unit}` : 'Administrátor';

  // Mobile: top nav bar instead of side rail, reduced padding.
  if (narrow) {
    return (
      <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--paper)', color:'var(--ink)' }}>
        <header style={{ flexShrink:0, background:'var(--sidebar)', color:'#E8ECF4', display:'flex', alignItems:'center',
          gap:6, padding:'8px 10px', overflowX:'auto' }}>
          {nav.map(n => (
            <button key={n.id} onClick={()=>go(n.id)} style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0,
              padding:'8px 12px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13,
              fontWeight:600, whiteSpace:'nowrap', background: active===n.id?'rgba(255,255,255,.12)':'transparent',
              color: active===n.id?'#fff':'rgba(232,236,244,.72)' }}>
              <Ic name={n.icon} size={17} />{n.label}
            </button>
          ))}
          <button onClick={onLogout} title="Odhlásiť sa" style={{ marginLeft:'auto', flexShrink:0, display:'flex',
            alignItems:'center', gap:6, padding:'8px 12px', borderRadius:8, border:'none', cursor:'pointer',
            fontFamily:'inherit', fontSize:13, fontWeight:600, whiteSpace:'nowrap', background:'transparent', color:'rgba(232,236,244,.72)' }}>
            <Ic name="lock" size={16} /> Odhlásiť
          </button>
        </header>
        <main style={{ flex:1, overflow:'auto', minHeight:0 }}>
          <div style={{ maxWidth:1080, margin:'0 auto', padding:'22px 14px 64px' }}>
            {screen.name==='dashboard' && <Dashboard go={go} />}
            {screen.name==='poll' && <PollDetail go={go} onOpenVoter={onOpenVoter} />}
            {screen.name==='create' && <CreatePoll go={go} />}
            {screen.name==='register' && <Register go={go} />}
            {screen.name==='archive' && <Archive go={go} />}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', height:'100%', background:'var(--paper)', color:'var(--ink)' }}>
      {/* Sidebar */}
      <aside style={{ width:248, flexShrink:0, background:'var(--sidebar)', color:'#E8ECF4',
        display:'flex', flexDirection:'column', padding:'22px 16px', boxSizing:'border-box' }}>
        <div style={{ display:'flex', alignItems:'center', gap:11, padding:'2px 8px 22px' }}>
          <div style={{ width:38, height:38, borderRadius:9, background:'var(--accent)', display:'flex',
            alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Ic name="scale" size={21} sw={2} style={{ color:'#fff' }} />
          </div>
          <div>
            <div style={{ fontFamily:'var(--serif)', fontSize:16, fontWeight:600, lineHeight:1.1 }}>{BUILDING.short || BUILDING.name}</div>
            <div style={{ fontSize:11, color:'rgba(232,236,244,.55)', letterSpacing:0.3 }}>elektronické hlasovanie</div>
          </div>
        </div>
        <nav style={{ display:'flex', flexDirection:'column', gap:3 }}>
          {nav.map(n => (
            <button key={n.id} onClick={()=>go(n.id)} aria-current={active===n.id?'page':undefined} style={{
              display:'flex', alignItems:'center', gap:11, padding:'10px 12px', borderRadius:9, border:'none',
              cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:active===n.id?600:500, textAlign:'left',
              background: active===n.id ? 'rgba(255,255,255,.10)' : 'transparent',
              color: active===n.id ? '#fff' : 'rgba(232,236,244,.72)', transition:'background .15s' }}
              onMouseEnter={e=>{ if(active!==n.id) e.currentTarget.style.background='rgba(255,255,255,.05)'; }}
              onMouseLeave={e=>{ if(active!==n.id) e.currentTarget.style.background='transparent'; }}>
              <Ic name={n.icon} size={18} />{n.label}
            </button>
          ))}
        </nav>
        <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', gap:10 }}>
          <button onClick={onOpenVoter} style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 12px',
            borderRadius:9, border:'1px solid rgba(255,255,255,.15)', background:'transparent', color:'#E8ECF4',
            cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
            <Ic name="eye" size={16} /> Ukážka hlasovacieho linku
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 8px', borderTop:'1px solid rgba(255,255,255,.08)' }}>
            <div style={{ width:34, height:34, borderRadius:999, background:'rgba(255,255,255,.12)', display:'flex',
              alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 }}>{initials}</div>
            <div style={{ lineHeight:1.25, flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{u.name}</div>
              <div style={{ fontSize:11, color:'rgba(232,236,244,.5)' }}>{roleLabel}</div>
            </div>
            <button onClick={onLogout} title="Odhlásiť sa" aria-label="Odhlásiť sa" style={{ background:'none', border:'none', cursor:'pointer',
              color:'rgba(232,236,244,.6)', display:'flex', padding:4 }}
              onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='rgba(232,236,244,.6)'}>
              <Ic name="lock" size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, overflow:'auto' }}>
        <div style={{ maxWidth:1080, margin:'0 auto', padding:'40px 48px 80px' }}>
          {screen.name==='dashboard' && <Dashboard go={go} />}
          {screen.name==='poll' && <PollDetail go={go} onOpenVoter={onOpenVoter} />}
          {screen.name==='create' && <CreatePoll go={go} />}
          {screen.name==='register' && <Register go={go} />}
          {screen.name==='archive' && <Archive go={go} />}
        </div>
      </main>
    </div>
  );
}

// ── Page header ──────────────────────────────────────────────
function PageHead({ eyebrow, title, children }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:30 }}>
      <div>
        {eyebrow && <div style={{ fontSize:12.5, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase',
          color:'var(--accent-ink)', marginBottom:7 }}>{eyebrow}</div>}
        <h1 style={{ fontFamily:'var(--serif)', fontSize:30, fontWeight:600, margin:0, letterSpacing:-0.3 }}>{title}</h1>
      </div>
      <div style={{ display:'flex', gap:10, flexShrink:0 }}>{children}</div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────
function Dashboard({ go }) {
  const totalEligible = UNITS.length;                                  // počet jednotiek
  const eligibleVotes = UNITS.reduce((a,u)=>a+(u.votes||1),0);          // oprávnené hlasy spolu
  const hasVoted = (u) => !!(window.VOTES[u.id] || window.COOWNER_SPLIT[u.id]);
  const votedUnits = UNITS.filter(hasVoted).length;
  const turnout = Math.round((votedUnits/totalEligible)*100);
  // Sporný je byt, ktorého spoluvlastníci nedosiahli väčšinu podielov na KTOREJKOĽVEK otázke.
  const disputedUnits = UNITS.filter(u => POLL.questions.some(q => effectiveUnitVote(u,'q'+q.no).disputed));
  const disputed = disputedUnits.length;
  const noEmailUnits = UNITS.filter(u => !u.email);
  const missingEmail = noEmailUnits.length;

  // Vlastníci (podľa e-mailu), ktorí vlastnia viac jednotiek a nehlasovali za všetky.
  const ownerUnits = {};
  UNITS.forEach(u => u.owners.forEach(o => {
    const key = (o.email || u.email || '').trim().toLowerCase();
    if (key) (ownerUnits[key] = ownerUnits[key] || { name:o.name, units:[] }).units.push(u);
  }));
  const partialOwners = Object.values(ownerUnits).filter(r =>
    r.units.length > 1 && r.units.some(u=>!hasVoted(u)) && r.units.some(hasVoted));

  // Upozornenia sú ODVODENÉ z dát/enginu (nie napevno) — nikdy neodporujú číslam vyššie.
  const alerts = [
    ...disputedUnits.map(u => ({ icon:'alert', tone:'accent',
      text:`Byt č. ${u.no} — spoluvlastníci hlasovali rozdielne a žiadny nemá väčšinu podielov. Hlas je sporný.`,
      cta:'Riešiť', go:()=>go('poll') })),
    ...noEmailUnits.map(u => ({ icon:'mail', tone:'danger',
      text:`Byt č. ${u.no} — vlastník nemá zadanú e-mailovú adresu, pozvánka nebola doručená.`,
      cta:'Doplniť', go:()=>go('register') })),
    ...partialOwners.map(r => ({ icon:'user', tone:'primary',
      text:`${r.name} vlastní viac jednotiek (${r.units.map(u=>'č. '+u.no).join(', ')}) a zatiaľ nehlasoval za všetky.`,
      cta:'Zobraziť', go:()=>go('poll') })),
  ];

  return (
    <div>
      <PageHead eyebrow={BUILDING.name} title="Prehľad">
        <Btn kind="secondary" icon="users" onClick={()=>go('register')}>Vlastníci</Btn>
        <Btn kind="primary" icon="plus" onClick={()=>go('create')}>Nové hlasovanie</Btn>
      </PageHead>

      {/* Active poll banner */}
      <Card pad={0} style={{ overflow:'hidden', marginBottom:28 }}>
        <div style={{ display:'flex', flexWrap:'wrap' }}>
          <div style={{ flex:'1 1 380px', padding:'26px 28px', borderRight:'1px solid var(--line)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <Pill tone="success" icon="vote" size="sm">Prebieha</Pill>
              <span style={{ fontSize:12.5, color:'var(--ink-soft)', display:'inline-flex', alignItems:'center', gap:5 }}>
                <Ic name="clock" size={14}/> do {POLL.end}</span>
            </div>
            <h2 style={{ fontFamily:'var(--serif)', fontSize:22, fontWeight:600, margin:'0 0 6px' }}>{POLL.title}</h2>
            <p style={{ fontSize:13.5, color:'var(--ink-soft)', margin:'0 0 18px', maxWidth:440, lineHeight:1.5 }}>
              {POLL.reason} · {POLL.questions.length} otázky · vyhlásil {POLL.declarer}</p>
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:7 }}>
              <span style={{ fontSize:13, fontWeight:600 }}>Účasť</span>
              <span style={{ fontSize:13, color:'var(--ink-soft)', fontVariantNumeric:'tabular-nums' }}>
                {votedUnits} / {totalEligible} jednotiek</span>
              <span style={{ marginLeft:'auto', fontFamily:'var(--serif)', fontSize:20, fontWeight:600, whiteSpace:'nowrap' }}>{turnout} %</span>
            </div>
            <Progress value={votedUnits} total={totalEligible} />
            <div style={{ marginTop:20 }}>
              <Btn kind="primary" iconR="chevR" onClick={()=>go('poll')}>Otvoriť hlasovanie</Btn>
            </div>
          </div>
          <div style={{ flex:'1 1 260px', padding:'26px 28px', background:'var(--paper-2)', display:'grid',
            gridTemplateColumns:'1fr 1fr', gap:'24px 18px', alignContent:'start' }}>
            <Stat label="Oprávnené hlasy" value={eligibleVotes} icon="building" />
            <Stat label="Prijaté hlasy" value={votedUnits} icon="checkCircle" tone="var(--agree)" />
            <Stat label="Sporné byty" value={disputed} icon="alert" tone={disputed?'var(--accent-ink)':undefined} />
            <Stat label="Chybné e-maily" value={missingEmail} icon="mail" tone={missingEmail?'var(--disagree)':undefined} />
          </div>
        </div>
      </Card>

      {/* Alerts */}
      <SectionTitle sub="Veci, ktoré si pred uzavretím vyžadujú vašu pozornosť">Kontrola konfliktov</SectionTitle>
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:30 }}>
        {alerts.map((a,i)=>(
          <Card key={i} pad={0} hover>
            <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px' }}>
              <div style={{ width:36, height:36, borderRadius:9, flexShrink:0, display:'flex', alignItems:'center',
                justifyContent:'center', background:`var(--${a.tone}-bg)`, color:`var(--${a.tone==='accent'?'accent-ink':a.tone})` }}>
                <Ic name={a.icon} size={18} />
              </div>
              <div style={{ flex:1, fontSize:13.5, color:'var(--ink)', lineHeight:1.45 }}>{a.text}</div>
              <Btn kind="secondary" size="sm" onClick={a.go}>{a.cta}</Btn>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick question status + recent */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:20 }}>
        <Card>
          <SectionTitle>Stav otázok</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {POLL.questions.map(q=>{
              const r = questionResult(q); const m = RESULT_META[r.status];
              return (
                <div key={q.no}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--ink-faint)' }}>{q.no}.</span>
                    <span style={{ fontSize:13, fontWeight:600, flex:1 }}>{q.title}</span>
                    <Pill tone={m.tone} size="sm" icon={m.icon}>{m.label}</Pill>
                  </div>
                  <Progress height={7} total={r.total} threshold={r.need}
                    segments={[{value:r.agree,color:'var(--agree)'},{value:r.disagree,color:'var(--disagree)'}]} />
                  <div style={{ fontSize:11.5, color:'var(--ink-soft)', marginTop:5, fontVariantNumeric:'tabular-nums' }}>
                    {r.agree} za · {r.disagree} proti · potrebných {r.need} z {r.total}</div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <SectionTitle action={<Btn kind="ghost" size="sm" onClick={()=>go('archive')} iconR="chevR">Archív</Btn>}>Posledné hlasovania</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column' }}>
            {ARCHIVE.slice(0,4).map((a,i)=>(
              <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0',
                borderTop: i? '1px solid var(--line)':'none' }}>
                <Ic name="paper" size={18} style={{ color:'var(--ink-faint)' }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.title}</div>
                  <div style={{ fontSize:11.5, color:'var(--ink-soft)' }}>{a.end} · účasť {a.voted}/{a.eligible}</div>
                </div>
                <Pill tone={a.result==='schválené'?'success':'danger'} size="sm">{a.result}</Pill>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Register (building + units + owners) ─────────────────────
const CO_MODE_LABEL = {
  single:'Jediný vlastník', rep:'Určený zástupca', internal:'Interné hlasovanie',
  majority:'Väčšinový spoluvlastník', bsm:'BSM manželov', legal:'Právnická osoba',
};
function Register({ go }) {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [editBuilding, setEditBuilding] = useState(false);
  const [editUnit, setEditUnit] = useState(null);
  const [creatingUnit, setCreatingUnit] = useState(false);
  const { refresh } = useStore();
  const list = UNITS.filter(u => {
    const s = (u.no+' '+u.owners.map(o=>o.name).join(' ')+' '+(CO_MODE_LABEL[u.coMode])).toLowerCase();
    return s.includes(q.toLowerCase());
  });
  return (
    <div>
      <PageHead eyebrow={`${BUILDING.name} · ${BUILDING.address}`} title="Dom a vlastníci">
        <Btn kind="secondary" icon="edit" onClick={()=>setEditBuilding(true)}>Upraviť dom</Btn>
        <Btn kind="primary" icon="plus" onClick={()=>setCreatingUnit(true)}>Pridať jednotku</Btn>
      </PageHead>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:14, marginBottom:24 }}>
        {[['Bytov', UNITS.filter(u=>u.type!=='nebyt').length],
          ['Nebytových priestorov', UNITS.filter(u=>u.type==='nebyt').length],
          ['Vlastníkov', UNITS.reduce((a,u)=>a+u.owners.length,0)],
          ['Oprávnených hlasov', UNITS.reduce((a,u)=>a+(u.votes||1),0)]].map(([l,v],i)=>(
          <Card key={i} pad={18}><Stat label={l} value={v} /></Card>
        ))}
      </div>

      <Card pad={0}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderBottom:'1px solid var(--line)' }}>
          <div style={{ position:'relative', flex:1, maxWidth:360 }}>
            <Ic name="search" size={16} style={{ position:'absolute', left:11, top:9, color:'var(--ink-faint)' }} />
            <input value={q} onChange={e=>setQ(e.target.value)} aria-label="Hľadať byt alebo vlastníka" placeholder="Hľadať byt alebo vlastníka…"
              style={{ width:'100%', boxSizing:'border-box', padding:'8px 12px 8px 34px', borderRadius:8,
              border:'1px solid var(--line)', fontFamily:'inherit', fontSize:13.5, background:'var(--paper)' }} />
          </div>
          <span style={{ fontSize:12.5, color:'var(--ink-soft)' }}>{list.length} jednotiek</span>
        </div>
        <TableScroll minWidth={600}>
        <div style={{ display:'grid', gridTemplateColumns:'64px 1fr 200px 150px 90px', gap:0, fontSize:12,
          fontWeight:600, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:0.4,
          padding:'10px 18px', borderBottom:'1px solid var(--line)', background:'var(--paper-2)' }}>
          <div>Jedn.</div><div>Vlastník</div><div>Režim hlasovania</div><div>E-mail</div><div>Stav</div>
        </div>
        {list.map(u=>{
          const open = openId===u.id; const noEmail = !u.email;
          return (
            <div key={u.id} style={{ borderBottom:'1px solid var(--line)' }}>
              <div role="button" tabIndex={0} aria-expanded={open}
                aria-label={`Byt č. ${u.no} — ${u.owners[0].name}, ${open?'zbaliť':'rozbaliť'} detail`}
                onClick={()=>setOpenId(open?null:u.id)}
                onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setOpenId(open?null:u.id); } }}
                style={{ display:'grid',
                gridTemplateColumns:'64px 1fr 200px 150px 90px', gap:0, alignItems:'center', padding:'12px 18px',
                cursor:'pointer', fontSize:13.5, background: open?'var(--paper-2)':'transparent' }}>
                <div style={{ fontWeight:700, fontVariantNumeric:'tabular-nums' }}>
                  {u.no}{u.type==='nebyt' && <div style={{ fontSize:10, fontWeight:600, color:'var(--accent-ink)' }}>NP</div>}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontWeight:600 }}>{u.owners[0].name}</span>
                  {u.owners.length>1 && <Pill tone="neutral" size="sm">+{u.owners.length-1}</Pill>}
                </div>
                <div><Pill tone={u.coMode==='single'?'neutral':'primary'} size="sm">{CO_MODE_LABEL[u.coMode]}</Pill></div>
                <div style={{ fontSize:12.5, color: noEmail?'var(--disagree)':'var(--ink-soft)', display:'flex', alignItems:'center', gap:5 }}>
                  {noEmail ? <><Ic name="alert" size={13}/> chýba</> : <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{u.email}</span>}
                </div>
                <div><Ic name="chevD" size={16} style={{ color:'var(--ink-faint)', transform:open?'rotate(180deg)':'none', transition:'transform .2s' }} /></div>
              </div>
              {open && (
                <div style={{ padding:'4px 18px 20px 82px', background:'var(--paper-2)' }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:24, fontSize:12.5 }}>
                    <Meta label="Typ">{u.type==='byt'?'Byt':(u.label||'Nebytový priestor')} · {u.floor} poschodie</Meta>
                    <Meta label="Počet hlasov">{u.votes}</Meta>
                    <Meta label="Režim spoluvlastníctva">{CO_MODE_LABEL[u.coMode]}</Meta>
                    {u.actingPerson && <Meta label="Koná za vlastníka">{u.actingPerson}</Meta>}
                  </div>
                  <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:8 }}>
                    {u.owners.map((o,i)=>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
                        background:'var(--surface)', border:'1px solid var(--line)', borderRadius:9 }}>
                        <div style={{ width:30, height:30, borderRadius:999, background:'var(--primary-bg)', color:'var(--primary)',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>
                          {o.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, display:'flex', alignItems:'center', gap:7 }}>
                            {o.name}
                            {(u.repId===o.id) && <Pill tone="accent" size="sm" icon="check">hlasuje za byt</Pill>}
                            {(u.majId===o.id) && <Pill tone="accent" size="sm">väčšinový podiel</Pill>}
                            {o.admin && <Pill tone="primary" size="sm" icon="shield">administrátor</Pill>}
                          </div>
                          <div style={{ fontSize:11.5, color:'var(--ink-soft)' }}>
                            {o.email||'bez e-mailu'} · podiel {Math.round(o.share*100)}%{o.role==='bsm'?' · BSM':''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:14 }}>
                    <Btn kind="secondary" size="sm" icon="edit" onClick={()=>setEditUnit(u.id)}>Upraviť jednotku a vlastníkov</Btn>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </TableScroll>
      </Card>
      {editBuilding && <BuildingForm onClose={()=>setEditBuilding(false)} onSaved={refresh} />}
      {editUnit && <UnitForm unitId={editUnit} onClose={()=>setEditUnit(null)} onSaved={refresh} />}
      {creatingUnit && <UnitForm onClose={()=>setCreatingUnit(false)} onSaved={refresh} />}
    </div>
  );
}
function Meta({ label, children }) {
  return <div><div style={{ color:'var(--ink-faint)', fontWeight:600, textTransform:'uppercase', letterSpacing:0.4,
    fontSize:10.5, marginBottom:2 }}>{label}</div><div style={{ fontSize:13, fontWeight:500 }}>{children}</div></div>;
}

// ── Edit forms ───────────────────────────────────────────────
function BuildingForm({ onClose, onSaved }) {
  const [f, setF] = useState({ ...window.BUILDING });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const save = () => { Object.assign(window.BUILDING, f); onSaved(); onClose(); };
  return (
    <Modal title="Upraviť bytový dom" subtitle="Zmeny sa prejavia v celej aplikácii — v menu, hlasovaní aj pozvánkach"
      icon="building" onClose={onClose}
      footer={<><Btn kind="secondary" onClick={onClose}>Zrušiť</Btn><Btn kind="primary" icon="check" onClick={save}>Uložiť zmeny</Btn></>}>
      <FormRow label="Názov domu"><Input value={f.name} onChange={e=>set('name', e.target.value)} /></FormRow>
      <FormRow label="Skrátený názov" hint="Zobrazuje sa v ľavom menu administrátora.">
        <Input value={f.short||''} onChange={e=>set('short', e.target.value)} /></FormRow>
      <FormRow label="Adresa"><Input value={f.address} onChange={e=>set('address', e.target.value)} /></FormRow>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <FormRow label="Vchod"><Input value={f.entrance} onChange={e=>set('entrance', e.target.value)} /></FormRow>
        <FormRow label="Správca"><Input value={f.manager} onChange={e=>set('manager', e.target.value)} /></FormRow>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <FormRow label="Kontaktná osoba"><Input value={f.contact} onChange={e=>set('contact', e.target.value)} /></FormRow>
        <FormRow label="Kontaktný e-mail"><Input value={f.contactEmail} onChange={e=>set('contactEmail', e.target.value)} /></FormRow>
      </div>
    </Modal>
  );
}

function blankOwner() {
  return { id:'p'+Math.random().toString(36).slice(2,8), first:'', last:'', email:'', share:1, admin:false, password:'' };
}
function genPassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:10}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

function UnitForm({ unitId, onClose, onSaved }) {
  const creating = !unitId;
  const unit = unitId ? window.UNITS.find(u => u.id === unitId) : null;
  const [no, setNo] = useState(unit?.no || '');
  const [type, setType] = useState(unit?.type || 'byt');
  const [floor, setFloor] = useState(unit?.floor || '');
  const [email, setEmail] = useState(unit?.email || '');
  const [coMode, setCoMode] = useState(unit?.coMode || 'single');
  const [owners, setOwners] = useState(unit ? unit.owners.map(o => ({ ...o })) : [blankOwner()]);
  const setOwner = (i, k, v) => setOwners(os => os.map((o, idx) => idx === i ? { ...o, [k]: v } : o));
  const addOwner = () => setOwners(os => [...os, blankOwner()]);
  const rmOwner = (i) => setOwners(os => os.length > 1 ? os.filter((_, idx) => idx !== i) : os);

  const multi = owners.length > 1;
  const save = () => {
    const built = owners.map(o => ({ ...o, name: `${(o.first||'').trim()} ${(o.last||'').trim()}`.trim() }));
    // create/update login credentials for owners marked as administrators
    built.forEach(o => {
      const loginEmail = (o.email || email).trim();
      if (o.admin && o.password && loginEmail) {
        const idx = window.ADMIN_CREDENTIALS.findIndex(c => c.email.toLowerCase() === loginEmail.toLowerCase());
        const entry = { email: loginEmail, password: o.password, name: o.name, unit: (no || '').trim() };
        if (idx >= 0) window.ADMIN_CREDENTIALS[idx] = entry; else window.ADMIN_CREDENTIALS.push(entry);
      }
    });
    if (creating) {
      const maxN = Math.max(0, ...window.UNITS.map(u => parseInt((u.id.match(/\d+/)||[0])[0], 10) || 0));
      window.UNITS.push({
        id: 'u' + (maxN + 1) + '_' + Date.now().toString().slice(-4),
        no: (no || '').trim() || String(window.UNITS.length + 1),
        type, floor: (floor || '').trim() || '—', votes: 1, status: 'active',
        coMode, owners: built, email: email.trim(),
        label: type === 'nebyt' ? 'Nebytový priestor' : undefined,
      });
    } else {
      unit.no = no.trim() || unit.no;
      unit.type = type;
      unit.floor = floor.trim() || unit.floor;
      unit.email = email.trim();
      unit.coMode = coMode;
      unit.owners = built;
      if (type === 'nebyt' && !unit.label) unit.label = 'Nebytový priestor';
    }
    onSaved(); onClose();
  };

  return (
    <Modal title={creating ? 'Pridať jednotku' : `Upraviť byt č. ${unit.no}`}
      subtitle="Údaje jednotky, režim hlasovania a vlastníci" icon={creating ? 'building' : 'user'} onClose={onClose} width={620}
      footer={<><Btn kind="secondary" onClick={onClose}>Zrušiť</Btn>
        <Btn kind="primary" icon={creating ? 'plus' : 'check'} onClick={save}>{creating ? 'Pridať jednotku' : 'Uložiť zmeny'}</Btn></>}>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
        <FormRow label="Číslo jednotky"><Input value={no} onChange={e=>setNo(e.target.value)} placeholder="napr. 12" /></FormRow>
        <FormRow label="Typ jednotky">
          <select value={type} onChange={e=>setType(e.target.value)} style={inputStyle}>
            <option value="byt">Byt</option>
            <option value="nebyt">Nebytový priestor</option>
          </select>
        </FormRow>
        <FormRow label="Poschodie"><Input value={floor} onChange={e=>setFloor(e.target.value)} placeholder="napr. 3." /></FormRow>
      </div>
      <FormRow label="Režim hlasovania" hint="Pri spoluvlastníctve určuje, ako sa započíta jeden hlas za jednotku.">
        <select value={coMode} onChange={e=>setCoMode(e.target.value)} style={inputStyle}>
          {Object.entries(CO_MODE_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </FormRow>
      <FormRow label="E-mail na hlasovanie (jednotka)" hint="Naň sa odošle osobný hlasovací link.">
        <Input value={email} onChange={e=>setEmail(e.target.value)} placeholder="napr. vlastnik@email.sk" /></FormRow>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'8px 0 10px' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:0.4 }}>Vlastníci</div>
        <Btn kind="secondary" size="sm" icon="plus" onClick={addOwner}>Pridať vlastníka</Btn>
      </div>
      {owners.map((o, i) => (
        <div key={o.id || i} style={{ border:'1px solid var(--line)', borderRadius:11, padding:'14px 14px 2px', marginBottom:10,
          background:'var(--paper-2)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--ink-soft)' }}>Vlastník {i+1}</div>
            {multi && <button type="button" onClick={()=>rmOwner(i)} title="Odobrať vlastníka" aria-label="Odobrať vlastníka"
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', display:'flex' }}><Ic name="x" size={17} /></button>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <FormRow label="Meno"><Input value={o.first||''} onChange={e=>setOwner(i,'first',e.target.value)} /></FormRow>
            <FormRow label="Priezvisko / názov"><Input value={o.last||''} onChange={e=>setOwner(i,'last',e.target.value)} /></FormRow>
          </div>
          <div style={{ display:'grid', gridTemplateColumns: multi ? '1fr 130px' : '1fr', gap:12 }}>
            <FormRow label="E-mail"><Input value={o.email||''} onChange={e=>setOwner(i,'email',e.target.value)} /></FormRow>
            {multi && (
              <FormRow label="Podiel (%)">
                <Input type="number" min="0" max="100" value={Math.round((o.share||0)*100)}
                  onChange={e=>setOwner(i,'share',(parseFloat(e.target.value)||0)/100)} /></FormRow>
            )}
          </div>
          <FormRow label="Rola" hint="Administrátor sa môže prihlásiť do aplikácie a spravovať dom, hlasovania a vlastníkov.">
            <div role="radiogroup" aria-label="Rola vlastníka" style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:9, padding:3, gap:3 }}>
              {[[false,'Vlastník','user'],[true,'Administrátor','shield']].map(([val,label,icon])=>(
                <button key={String(val)} type="button" role="radio" aria-checked={!!o.admin===val} onClick={()=>setOwner(i,'admin',val)} style={{ flex:1,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'8px 10px', borderRadius:7,
                  border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600,
                  background: (!!o.admin===val) ? 'var(--primary)' : 'transparent',
                  color: (!!o.admin===val) ? '#fff' : 'var(--ink-soft)' }}>
                  <Ic name={icon} size={15} />{label}
                </button>
              ))}
            </div>
          </FormRow>
          {o.admin && (
            <div style={{ border:'1px solid var(--line)', borderRadius:10, padding:'12px 12px 0', marginBottom:14,
              background:'var(--surface)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, fontWeight:600, color:'var(--primary)', marginBottom:10 }}>
                <Ic name="lock" size={14} /> Prihlasovacie údaje administrátora
              </div>
              <FormRow label="Prihlasovací e-mail" hint="Predvolene e-mail vlastníka.">
                <Input value={o.email || email} onChange={e=>setOwner(i,'email',e.target.value)} /></FormRow>
              <FormRow label="Heslo">
                <div style={{ display:'flex', gap:8 }}>
                  <Input value={o.password||''} onChange={e=>setOwner(i,'password',e.target.value)}
                    placeholder="zadajte alebo vygenerujte" style={{ flex:1 }} />
                  <Btn kind="secondary" size="sm" icon="refresh" onClick={()=>setOwner(i,'password',genPassword())}>Generovať</Btn>
                </div>
              </FormRow>
            </div>
          )}
        </div>
      ))}
    </Modal>
  );
}

// ── Archive ──────────────────────────────────────────────────
function Archive({ go }) {
  return (
    <div>
      <PageHead eyebrow="Nemenný archív · auditný log" title="Archív hlasovaní" />
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {ARCHIVE.map(a=>(
          <Card key={a.id} hover pad={0}>
            <div style={{ display:'flex', alignItems:'center', gap:18, padding:'18px 22px' }}>
              <div style={{ width:44, height:44, borderRadius:10, background:'var(--paper-2)', display:'flex',
                alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Ic name="paper" size={22} style={{ color:'var(--ink-soft)' }} /></div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                  <span style={{ fontFamily:'var(--serif)', fontSize:16.5, fontWeight:600 }}>{a.title}</span>
                  {a.test && <Pill tone="neutral" size="sm">test</Pill>}
                </div>
                <div style={{ fontSize:12.5, color:'var(--ink-soft)', marginTop:3 }}>
                  Ukončené {a.end} · vyhlásil {a.declarer} · {a.questions} {a.questions===1?'otázka':'otázky'} · účasť {a.voted}/{a.eligible}</div>
              </div>
              <Pill tone={a.result==='schválené'?'success':'danger'} icon={a.result==='schválené'?'checkCircle':'xCircle'}>{a.result}</Pill>
              <Btn kind="secondary" size="sm" icon="download">Zápisnica PDF</Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { AdminApp, PageHead, CO_MODE_LABEL });
