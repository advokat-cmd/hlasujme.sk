// ui.jsx — shared UI primitives + icons for the e-voting prototype
// Exports to window at the bottom.

// ── Icons (stroke, currentColor) ─────────────────────────────
const Icon = ({ d, size = 20, fill = false, sw = 1.7, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'}
       stroke={fill ? 'none' : 'currentColor'} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
       style={style} aria-hidden="true">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);
const ICONS = {
  dashboard: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z',
  vote: ['M9 12l2 2 4-4','M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  building: ['M3 21h18','M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16','M15 21V9h2a2 2 0 0 1 2 2v10','M8 7h2M8 11h2M8 15h2'],
  archive: ['M3 7h18v3H3z','M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9','M9 14h6'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9','M13.7 21a2 2 0 0 1-3.4 0'],
  alert: ['M12 9v4','M12 17h.01','M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z'],
  check: 'M20 6 9 17l-5-5',
  checkCircle: ['M22 11.1V12a10 10 0 1 1-5.9-9.1','M22 4 12 14.01l-3-3'],
  x: 'M18 6 6 18M6 6l12 12',
  xCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z','M15 9l-6 6M9 9l6 6'],
  minus: 'M5 12h14',
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z','M12 6v6l4 2'],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z','m22 7-10 6L2 7'],
  link: ['M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1','M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z','M22 21v-2a4 4 0 0 0-3-3.9','M16 3.1a4 4 0 0 1 0 7.8'],
  user: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2','M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  plus: 'M12 5v14M5 12h14',
  chevR: 'm9 18 6-6-6-6',
  chevL: 'm15 18-6-6 6-6',
  chevD: 'm6 9 6 6 6-6',
  doc: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z','M14 2v6h6','M9 13h6M9 17h6'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4','M7 10l5 5 5-5','M12 15V3'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z','m9 12 2 2 4-4'],
  scale: ['M12 3v18','M7 7l-4 7h8z','M17 7l4 7h-8z','M5 21h14','M7 7l5-2 5 2'],
  gavel: ['m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10','m16 16 6-6','m8 8 6-6','m9 7 8 8','m21 11-8-8'],
  paper: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z','M14 2v6h6'],
  send: ['m22 2-7 20-4-9-9-4Z','M22 2 11 13'],
  edit: ['M12 20h9','M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z','m21 21-4.3-4.3'],
  lock: ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z','M8 11V7a4 4 0 0 1 8 0v4'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z','M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  eyeOff: ['M9.9 5A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a13 13 0 0 1-2 2.7','M6 6a13 13 0 0 0-4 6s3.5 7 10 7a9.7 9.7 0 0 0 4-.9','M3 3l18 18'],
  refresh: ['M3 12a9 9 0 0 1 15-6.7L21 8','M21 3v5h-5','M21 12a9 9 0 0 1-15 6.7L3 16','M3 21v-5h5'],
};
function Ic({ name, size = 20, fill, sw, style }) {
  return <Icon d={ICONS[name]} size={size} fill={fill} sw={sw} style={style} />;
}

// ── Buttons ──────────────────────────────────────────────────
function Btn({ children, kind = 'primary', size = 'md', icon, iconR, onClick, disabled, full, style, ariaLabel, title, type }) {
  const sizes = { sm:{p:'7px 12px',fs:13,g:6}, md:{p:'10px 16px',fs:14,g:8}, lg:{p:'14px 22px',fs:16,g:9} };
  const s = sizes[size];
  const kinds = {
    primary:{ background:'var(--primary)', color:'#fff', border:'1px solid var(--primary)' },
    secondary:{ background:'var(--surface)', color:'var(--ink)', border:'1px solid var(--line)' },
    ghost:{ background:'transparent', color:'var(--ink-soft)', border:'1px solid transparent' },
    danger:{ background:'transparent', color:'var(--disagree)', border:'1px solid var(--line)' },
    gold:{ background:'var(--accent)', color:'#fff', border:'1px solid var(--accent)' },
  };
  return (
    <button onClick={onClick} disabled={disabled} aria-label={ariaLabel} title={title} type={type} style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:s.g,
      padding:s.p, fontSize:s.fs, fontWeight:600, fontFamily:'inherit', cursor:disabled?'not-allowed':'pointer',
      borderRadius:8, letterSpacing:0.1, width:full?'100%':undefined, opacity:disabled?0.5:1,
      transition:'filter .15s, background .15s', ...kinds[kind], ...style,
    }}
    onMouseEnter={e=>!disabled&&(e.currentTarget.style.filter='brightness(0.95)')}
    onMouseLeave={e=>e.currentTarget.style.filter='none'}>
      {icon && <Ic name={icon} size={s.fs+3} />}
      {children}
      {iconR && <Ic name={iconR} size={s.fs+3} />}
    </button>
  );
}

// ── Badge / status pills ─────────────────────────────────────
const VOTE_STYLE = {
  agree:    { bg:'var(--agree-bg)', fg:'var(--agree)', label:'Súhlasím', icon:'check' },
  disagree: { bg:'var(--disagree-bg)', fg:'var(--disagree)', label:'Nesúhlasím', icon:'x' },
  abstain:  { bg:'var(--abstain-bg)', fg:'var(--abstain)', label:'Nechcem hlasovať', icon:'minus' },
  none:     { bg:'var(--paper-2)', fg:'var(--ink-faint)', label:'Nehlasoval', icon:'clock' },
  disputed: { bg:'var(--accent-bg)', fg:'var(--accent-ink)', label:'Sporný byt', icon:'alert' },
};
function Pill({ tone = 'neutral', children, icon, size = 'md' }) {
  const tones = {
    neutral:{ bg:'var(--paper-2)', fg:'var(--ink-soft)' },
    agree:{ bg:'var(--agree-bg)', fg:'var(--agree)' },
    disagree:{ bg:'var(--disagree-bg)', fg:'var(--disagree)' },
    abstain:{ bg:'var(--abstain-bg)', fg:'var(--abstain)' },
    accent:{ bg:'var(--accent-bg)', fg:'var(--accent-ink)' },
    primary:{ bg:'var(--primary-bg)', fg:'var(--primary)' },
    success:{ bg:'var(--agree-bg)', fg:'var(--agree)' },
    danger:{ bg:'var(--disagree-bg)', fg:'var(--disagree)' },
  };
  const t = tones[tone] || tones.neutral;
  const fs = size==='sm'?11:12;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:size==='sm'?'2px 8px':'4px 10px',
      borderRadius:999, fontSize:fs, fontWeight:600, letterSpacing:0.2, background:t.bg, color:t.fg, whiteSpace:'nowrap' }}>
      {icon && <Ic name={icon} size={fs+2} sw={2.2} />}{children}
    </span>
  );
}

// ── Card ─────────────────────────────────────────────────────
function Card({ children, style, pad = 24, onClick, hover }) {
  const [h, setH] = React.useState(false);
  return (
    <div onClick={onClick}
      role={onClick?'button':undefined} tabIndex={onClick?0:undefined}
      onKeyDown={onClick?(e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); onClick(e); } }):undefined}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:14,
        padding:pad, cursor:onClick?'pointer':'default',
        boxShadow: hover&&h ? '0 8px 24px -10px rgba(28,36,51,.18)' : '0 1px 2px rgba(28,36,51,.04)',
        transition:'box-shadow .18s, transform .18s', transform: hover&&h?'translateY(-2px)':'none', ...style }}>
      {children}
    </div>
  );
}

// ── Progress bar ─────────────────────────────────────────────
function Progress({ value, total, threshold, height = 10, segments, label }) {
  // segments: [{value, color}] stacked. Or simple value/total.
  const pct = (v) => total ? Math.min(100, (v/total)*100) : 0;
  return (
    <div style={{ position:'relative', width:'100%' }}>
      <div role="progressbar" aria-label={label}
        aria-valuemin={0} aria-valuemax={total || 100}
        aria-valuenow={Math.round(segments ? segments.reduce((a,s)=>a+(s.value||0),0) : (value||0))}
        style={{ height, borderRadius:999, background:'var(--paper-2)', overflow:'hidden', display:'flex' }}>
        {segments
          ? segments.map((s,i)=>(<div key={i} style={{ width:pct(s.value)+'%', background:s.color, transition:'width .4s' }} />))
          : <div style={{ width:pct(value)+'%', background:'var(--primary)', transition:'width .4s' }} />}
      </div>
      {threshold != null && total ? (
        <div style={{ position:'absolute', top:-3, bottom:-3, left:`calc(${pct(threshold)}% - 1px)`, width:2,
          background:'var(--ink)', borderRadius:2 }} title="Potrebná väčšina" />
      ) : null}
    </div>
  );
}

// ── Stat ─────────────────────────────────────────────────────
function Stat({ label, value, sub, tone, icon }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, color:'var(--ink-faint)', fontSize:12.5,
        fontWeight:600, letterSpacing:0.3, textTransform:'uppercase' }}>
        {icon && <Ic name={icon} size={14} />}{label}
      </div>
      <div style={{ fontSize:30, fontWeight:700, color: tone || 'var(--ink)', fontVariantNumeric:'tabular-nums',
        fontFamily:'var(--serif)', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:12.5, color:'var(--ink-soft)' }}>{sub}</div>}
    </div>
  );
}

// ── Section header ───────────────────────────────────────────
function SectionTitle({ children, sub, action }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:16 }}>
      <div>
        <div style={{ fontFamily:'var(--serif)', fontSize:19, fontWeight:600, color:'var(--ink)' }}>{children}</div>
        {sub && <div style={{ fontSize:13, color:'var(--ink-soft)', marginTop:2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

// ── Responsive helpers ───────────────────────────────────────
function useNarrow(bp = 860) {
  const [n, setN] = React.useState(typeof window !== 'undefined' && window.innerWidth < bp);
  React.useEffect(() => {
    const f = () => setN(window.innerWidth < bp);
    f(); window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, [bp]);
  return n;
}
// Horizontal-scroll wrapper for wide tables so they never overflow their card.
function TableScroll({ minWidth = 640, children }) {
  return (
    <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

// ── Shared store (lets edits propagate across the whole app) ─
const StoreContext = React.createContext({ version: 0, refresh: () => {} });
function useStore() { return React.useContext(StoreContext); }

// ── Modal + form controls ────────────────────────────────────
function Modal({ title, subtitle, icon = 'edit', onClose, children, footer, width = 560 }) {
  const panelRef = React.useRef(null);
  const titleId = React.useRef('modal-title-' + Math.random().toString(36).slice(2,8)).current;
  React.useEffect(() => {
    const panel = panelRef.current;
    const prevFocus = document.activeElement;
    if (panel) panel.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key === 'Tab' && panel) {
        const f = panel.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
  }, []);
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(20,26,38,.5)', backdropFilter:'blur(2px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onClick={e=>e.stopPropagation()} style={{ width, maxWidth:'100%', maxHeight:'92vh', overflow:'auto',
        background:'var(--surface)', borderRadius:16, boxShadow:'0 30px 80px -20px rgba(0,0,0,.5)' }}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:12,
          position:'sticky', top:0, background:'var(--surface)', zIndex:2 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:'var(--primary-bg)', color:'var(--primary)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Ic name={icon} size={18} /></div>
          <div style={{ flex:1 }}>
            <h3 id={titleId} style={{ fontFamily:'var(--serif)', fontSize:18, fontWeight:600, margin:0 }}>{title}</h3>
            {subtitle && <div style={{ fontSize:12.5, color:'var(--ink-soft)' }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Zavrieť" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', display:'flex' }}><Ic name="x" size={20} /></button>
        </div>
        <div style={{ padding:'20px 22px' }}>{children}</div>
        {footer && <div style={{ padding:'14px 22px', borderTop:'1px solid var(--line)', display:'flex', justifyContent:'flex-end',
          gap:10, position:'sticky', bottom:0, background:'var(--surface)' }}>{footer}</div>}
      </div>
    </div>
  );
}
const inputStyle = { width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:9,
  border:'1px solid var(--line)', fontFamily:'inherit', fontSize:13.5, background:'var(--paper)', color:'var(--ink)' };
function FormRow({ label, children, hint }) {
  return (
    <label style={{ display:'block', marginBottom:14 }}>
      <div style={{ fontSize:12.5, fontWeight:600, marginBottom:5 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize:11, color:'var(--ink-soft)', marginTop:4 }}>{hint}</div>}
    </label>
  );
}
function Input(props) { return <input {...props} style={{ ...inputStyle, ...(props.style||{}) }} />; }

Object.assign(window, { Ic, Btn, Pill, Card, Progress, Stat, SectionTitle, VOTE_STYLE, useNarrow, TableScroll,
  StoreContext, useStore, Modal, FormRow, Input, inputStyle });
