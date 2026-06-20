// engine.jsx — the "hlasovací právny engine": tallies votes per legal majority type.

function effectiveUnitVote(unit, qKey) {
  // Returns { answer, disputed, note } for a unit on a given question.
  const split = window.COOWNER_SPLIT[unit.id];
  if (split) {
    // internal co-owner voting: need > 1/2 of shares agreeing on the SAME answer
    const tally = {};
    split.forEach(s => { const a = s[qKey]; if (a) tally[a] = (tally[a]||0) + s.share; });
    let best = null, bestShare = 0;
    Object.entries(tally).forEach(([a,sh]) => { if (sh > bestShare) { best = a; bestShare = sh; } });
    if (bestShare > 0.5) return { answer: best, disputed:false, note:`Zhoda podielov (${Math.round(bestShare*100)} %)` };
    return { answer:null, disputed:true, note:'Spoluvlastníci sa nezhodli — bez väčšiny podielov' };
  }
  if (unit.coMode === 'internal') {
    // 'internal' unit must have per-co-owner sub-votes (COOWNER_SPLIT); without them
    // the unit position is undecided — never silently treat it as a single valid vote.
    return { answer:null, disputed:false, note:'Čaká na interné hlasovanie spoluvlastníkov' };
  }
  const v = window.VOTES[unit.id];
  if (!v || !v[qKey]) return { answer:null, disputed:false, note:null };
  return { answer: v[qKey], disputed:false, note:null };
}

function tallyQuestion(qKey) {
  // Each unit carries unit.votes hlasov (zákon 182/1993: spravidla 1 hlas na byt/NP,
  // ale rešpektujeme pole votes, aby sa prah aj súčty počítali správne aj pri výnimkách).
  let total=0, agree=0, disagree=0, abstain=0, none=0, disputed=0;
  window.UNITS.forEach(u => {
    const w = u.votes || 1;
    total += w;
    const r = effectiveUnitVote(u, qKey);
    if (r.disputed) { disputed += w; return; }
    if (r.answer === 'agree') agree += w;
    else if (r.answer === 'disagree') disagree += w;
    else if (r.answer === 'abstain') abstain += w;
    else none += w;
  });
  return { total, agree, disagree, abstain, none, disputed, voted: agree+disagree+abstain };
}

function questionResult(question) {
  const t = tallyQuestion('q'+question.no);
  const maj = window.MAJORITY[question.majority];
  const need = maj.need ? maj.need(t.total) : Math.floor(t.voted/2)+1;
  let status; // 'approved' | 'rejected' | 'short' | 'disputed-pending'
  if (t.agree >= need) status = 'approved';
  else {
    // can it still pass? remaining undecided (none + disputed) could swing it (active poll)
    const couldReach = t.agree + t.none + t.disputed >= need;
    status = couldReach ? 'short' : 'rejected';
  }
  return { ...t, need, maj, status };
}

const RESULT_META = {
  approved:{ label:'Schválené', tone:'success', icon:'checkCircle' },
  rejected:{ label:'Neschválené', tone:'danger', icon:'xCircle' },
  short:{ label:'Zatiaľ nedosiahnutá väčšina', tone:'accent', icon:'clock' },
};

Object.assign(window, { effectiveUnitVote, tallyQuestion, questionResult, RESULT_META });
