// voter.jsx — owner's mobile magic-link voting flow (rendered inside IOSDevice).

const VOTER_UNIT = '24';
const VOTER_KEY = 'hlasovanie_voter_v1';

function loadVoter() {
  try { return JSON.parse(localStorage.getItem(VOTER_KEY)) || null; } catch { return null; }
}
function saveVoter(state) {
  try { localStorage.setItem(VOTER_KEY, JSON.stringify(state)); } catch {}
}

function VoterApp() {
  // phase: 'intro' | 'vote' | 'recap' | 'done'
  const saved = loadVoter();
  const [phase, setPhase] = React.useState(saved?.submitted ? 'done' : 'intro');
  const [answers, setAnswers] = React.useState(saved?.answers || {});
  const [submittedAt, setSubmittedAt] = React.useState(saved?.at || null);
  const [qi, setQi] = React.useState(0);

  const set = (no, val) => setAnswers(a => ({ ...a, [no]: val }));
  const allAnswered = POLL.questions.every(q => answers[q.no]);

  const submit = () => {
    const at = '30. 6. 2026 o 18:42';
    setSubmittedAt(at);
    saveVoter({ submitted:true, answers, at });
    setPhase('done');
  };
  const changeVote = () => { setPhase('vote'); setQi(0); };

  return (
    <IOSDevice>
      <div style={{ minHeight:'100%', background:'var(--v-paper)', display:'flex', flexDirection:'column',
        fontFamily:'var(--sans)', color:'var(--ink)' }}>
        {phase==='intro' && <VIntro onStart={()=>{ setPhase('vote'); setQi(0); }} answers={answers} />}
        {phase==='vote'  && <VVote qi={qi} setQi={setQi} answers={answers} set={set} allAnswered={allAnswered}
                                   onRecap={()=>setPhase('recap')} />}
        {phase==='recap' && <VRecap answers={answers} onBack={()=>setPhase('vote')}
                                    onEdit={(idx)=>{ setQi(idx); setPhase('vote'); }} onSubmit={submit} edited={!!submittedAt} />}
        {phase==='done'  && <VDone at={submittedAt} answers={answers} onChange={changeVote} />}
      </div>
    </IOSDevice>
  );
}

// brand header
function VHead({ small }) {
  return (
    <div style={{ background:'var(--v-head)', color:'#fff', padding: small?'52px 22px 16px':'56px 22px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom: small?0:14 }}>
        <div style={{ width:30, height:30, borderRadius:8, background:'rgba(255,255,255,.15)', display:'flex',
          alignItems:'center', justifyContent:'center' }}><Ic name="scale" size={17} style={{ color:'#fff' }} /></div>
        <div style={{ fontSize:13, fontWeight:600, letterSpacing:0.2 }}>Hlasovanie vlastníkov</div>
      </div>
      {!small && (
        <>
          <div style={{ fontFamily:'var(--serif)', fontSize:21, fontWeight:600, lineHeight:1.2 }}>{BUILDING.name}</div>
          <div style={{ fontSize:12.5, color:'rgba(255,255,255,.7)', marginTop:3 }}>{BUILDING.address}</div>
        </>
      )}
    </div>
  );
}

function VIntro({ onStart, answers }) {
  const inProgress = Object.keys(answers).length>0;
  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <VHead />
      <div style={{ padding:'20px 22px', flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 15px', borderRadius:12,
          background:'var(--v-card)', border:'1px solid var(--v-line)', marginBottom:18 }}>
          <div style={{ width:42, height:42, borderRadius:10, background:'var(--primary-bg)', color:'var(--primary)',
            display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--serif)', fontWeight:700, fontSize:17 }}>{VOTER_UNIT}</div>
          <div>
            <div style={{ fontSize:12, color:'var(--ink-soft)' }}>Hlasujete za</div>
            <div style={{ fontSize:16, fontWeight:700 }}>Byt č. {VOTER_UNIT}</div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 14px', borderRadius:10,
          background:'var(--accent-bg)', color:'var(--accent-ink)', fontSize:12.5, fontWeight:600, marginBottom:22 }}>
          <Ic name="clock" size={16}/> Hlasovanie je otvorené do {POLL.end}
        </div>

        <div style={{ fontFamily:'var(--serif)', fontSize:17, fontWeight:600, marginBottom:4 }}>{POLL.title}</div>
        <p style={{ fontSize:13, color:'var(--ink-soft)', margin:'0 0 18px', lineHeight:1.5 }}>{POLL.reason}. Hlasuje sa o {POLL.questions.length} otázkach.</p>

        <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:20 }}>
          {POLL.questions.map(q=>(
            <div key={q.no} style={{ display:'flex', gap:11, padding:'13px 14px', borderRadius:11,
              background:'var(--v-card)', border:'1px solid var(--v-line)' }}>
              <span style={{ width:22, height:22, borderRadius:6, background:'var(--v-head)', color:'#fff', flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>{q.no}</span>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:13.5, fontWeight:600, lineHeight:1.3 }}>{q.title}</div>
                {q.attachments.length>0 && (
                  <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, color:'var(--primary)', marginTop:5 }}>
                    <Ic name="doc" size={13}/> {q.attachments.length} {q.attachments.length===1?'príloha':'prílohy'} na stiahnutie</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize:11.5, color:'var(--ink-faint)', lineHeight:1.5, margin:'0 0 4px' }}>
          Za byt sa počíta jeden hlas. Do skončenia hlasovania môžete svoj hlas zmeniť — platí posledné odoslané hlasovanie.</p>
      </div>

      <div style={{ padding:'14px 22px', borderTop:'1px solid var(--v-line)', background:'var(--v-paper)',
        position:'sticky', bottom:0 }}>
        <Btn kind="primary" full size="lg" iconR="chevR" onClick={onStart}>{inProgress?'Pokračovať v hlasovaní':'Začať hlasovať'}</Btn>
      </div>
    </div>
  );
}

function VVote({ qi, setQi, answers, set, allAnswered, onRecap }) {
  const q = POLL.questions[qi];
  const choice = answers[q.no];
  const last = qi === POLL.questions.length-1;
  const next = () => { if (last) onRecap(); else setQi(qi+1); };

  const opt = (val, label, tone, icon, big) => {
    const active = choice===val;
    const tones = { agree:'var(--agree)', disagree:'var(--disagree)', abstain:'var(--abstain)' };
    const c = tones[tone];
    return (
      <button onClick={()=>set(q.no,val)} aria-pressed={active} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10,
        width:'100%', padding: big?'18px':'13px', borderRadius:13, cursor:'pointer', fontFamily:'inherit',
        fontSize: big?17:14, fontWeight:700, letterSpacing:0.3, transition:'all .15s',
        border:'2px solid', borderColor: active?c:'var(--v-line)',
        background: active?c:'var(--v-card)', color: active?'#fff':(big?c:'var(--ink-soft)'),
        boxShadow: active?`0 6px 16px -6px ${c}`:'none' }}>
        <Ic name={icon} size={big?22:18} sw={2.6} />{label}
      </button>
    );
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <VHead small />
      {/* progress */}
      <div style={{ padding:'14px 22px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span style={{ fontSize:12, fontWeight:600, color:'var(--ink-soft)' }}>Otázka {qi+1} z {POLL.questions.length}</span>
          <span style={{ fontSize:12, color:'var(--ink-faint)' }}>Byt č. {VOTER_UNIT}</span>
        </div>
        <div aria-hidden="true" style={{ display:'flex', gap:5 }}>
          {POLL.questions.map((qq,i)=>(
            <div key={i} style={{ flex:1, height:4, borderRadius:999,
              background: answers[qq.no]?'var(--agree)':(i===qi?'var(--primary)':'var(--v-line)') }} />
          ))}
        </div>
      </div>

      <div style={{ padding:'20px 22px', flex:1 }}>
        <Pill tone="neutral" size="sm">{q.kind}</Pill>
        <h2 style={{ fontFamily:'var(--serif)', fontSize:18, fontWeight:600, margin:'12px 0 10px', lineHeight:1.3 }}>{q.title}</h2>
        <p style={{ fontSize:13.5, color:'var(--ink-soft)', lineHeight:1.55, margin:'0 0 16px' }}>{q.text}</p>

        {q.attachments.length>0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:18 }}>
            {q.attachments.map((a,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:9,
                background:'var(--v-card)', border:'1px solid var(--v-line)', fontSize:12.5 }}>
                <Ic name="doc" size={16} style={{ color:'var(--primary)' }} />
                <span style={{ flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a}</span>
                <Ic name="download" size={15} style={{ color:'var(--primary)' }} />
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {opt('agree','SÚHLASÍM','agree','check',true)}
          {opt('disagree','NESÚHLASÍM','disagree','x',true)}
          {opt('abstain','Nechcem hlasovať','abstain','minus',false)}
        </div>
      </div>

      <div style={{ padding:'14px 22px', borderTop:'1px solid var(--v-line)', display:'flex', gap:10,
        position:'sticky', bottom:0, background:'var(--v-paper)' }}>
        {qi>0 && <Btn kind="secondary" icon="chevL" ariaLabel="Predchádzajúca otázka" onClick={()=>setQi(qi-1)} />}
        <Btn kind="primary" full iconR={last?'check':'chevR'} disabled={!choice} onClick={next}>
          {last?'Skontrolovať a odoslať':'Ďalšia otázka'}</Btn>
      </div>
    </div>
  );
}

function VRecap({ answers, onBack, onEdit, onSubmit, edited }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <VHead small />
      <div style={{ padding:'20px 22px', flex:1 }}>
        <h2 style={{ fontFamily:'var(--serif)', fontSize:19, fontWeight:600, margin:'0 0 4px' }}>Rekapitulácia</h2>
        <p style={{ fontSize:12.5, color:'var(--ink-soft)', margin:'0 0 18px' }}>Skontrolujte svoje odpovede pred odoslaním. Byt č. {VOTER_UNIT}.</p>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {POLL.questions.map((q,idx)=>{
            const v = VOTE_STYLE[answers[q.no]||'none'];
            return (
              <div key={q.no} style={{ padding:'13px 14px', borderRadius:12, background:'var(--v-card)', border:'1px solid var(--v-line)' }}>
                <div style={{ display:'flex', gap:9, marginBottom:9 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--ink-faint)' }}>{q.no}.</span>
                  <span style={{ fontSize:13.5, fontWeight:600, lineHeight:1.3 }}>{q.title}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'6px 12px', borderRadius:999,
                    background:v.bg, color:v.fg, fontSize:13, fontWeight:700 }}><Ic name={v.icon} size={15} sw={2.6}/>{v.label}</span>
                  <button type="button" onClick={()=>onEdit(idx)} aria-label={`Zmeniť odpoveď na otázku ${q.no}`}
                    style={{ fontSize:12, color:'var(--primary)', fontWeight:600, background:'none', border:'none',
                    cursor:'pointer', padding:'4px 8px', borderRadius:6, textDecoration:'underline' }}>Zmeniť</button>
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize:11.5, color:'var(--ink-faint)', lineHeight:1.5, marginTop:18 }}>
          Po odoslaní vám zašleme potvrdenie e-mailom. Do {POLL.end} môžete hlas znova zmeniť.</p>
      </div>
      <div style={{ padding:'14px 22px', borderTop:'1px solid var(--v-line)', display:'flex', gap:10,
        position:'sticky', bottom:0, background:'var(--v-paper)' }}>
        <Btn kind="secondary" icon="chevL" ariaLabel="Späť na otázky" onClick={onBack} />
        <Btn kind="primary" full icon="send" onClick={onSubmit}>{edited?'Odoslať zmenený hlas':'Odoslať hlas'}</Btn>
      </div>
    </div>
  );
}

function VDone({ at, answers, onChange }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <VHead small />
      <div style={{ padding:'30px 22px 20px', flex:1, textAlign:'center' }}>
        <div style={{ width:74, height:74, borderRadius:999, background:'var(--agree-bg)', display:'flex',
          alignItems:'center', justifyContent:'center', margin:'4px auto 18px' }}>
          <Ic name="checkCircle" size={40} style={{ color:'var(--agree)' }} sw={2} />
        </div>
        <h2 style={{ fontFamily:'var(--serif)', fontSize:21, fontWeight:600, margin:'0 0 8px' }}>Váš hlas bol prijatý</h2>
        <p style={{ fontSize:13.5, color:'var(--ink-soft)', margin:'0 0 4px', lineHeight:1.5 }}>
          Byt č. {VOTER_UNIT} · {at}</p>
        <p style={{ fontSize:13, color:'var(--ink-soft)', margin:'0 auto', lineHeight:1.5, maxWidth:280 }}>
          Potvrdenie sme poslali na váš e-mail. Do skončenia hlasovania ({POLL.end}) môžete hlas zmeniť.</p>

        <div style={{ marginTop:22, textAlign:'left', display:'flex', flexDirection:'column', gap:8 }}>
          {POLL.questions.map(q=>{ const v=VOTE_STYLE[answers[q.no]||'none'];
            return <div key={q.no} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 13px', borderRadius:11,
              background:'var(--v-card)', border:'1px solid var(--v-line)' }}>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--ink-faint)' }}>{q.no}.</span>
              <span style={{ flex:1, fontSize:12.5, fontWeight:600, lineHeight:1.25 }}>{q.title}</span>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, color:v.fg, fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>
                <Ic name={v.icon} size={14} sw={2.6}/>{v.label}</span>
            </div>; })}
        </div>
      </div>
      <div style={{ padding:'14px 22px', borderTop:'1px solid var(--v-line)', display:'flex', flexDirection:'column', gap:9,
        position:'sticky', bottom:0, background:'var(--v-paper)' }}>
        <Btn kind="secondary" full icon="download">Stiahnuť potvrdenie (PDF)</Btn>
        <Btn kind="ghost" full icon="edit" onClick={onChange}>Zmeniť môj hlas</Btn>
      </div>
    </div>
  );
}

Object.assign(window, { VoterApp });
