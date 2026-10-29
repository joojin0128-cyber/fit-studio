/* 헬스 스튜디오 계산 엔진 — 기획 규칙(data/*.json)만으로 계산한다(AI · API 없음). 화면(app.js)과 나눠 시험하기 쉽게. */
'use strict';
const ENG = (() => {
  const pad2 = (n) => String(n).padStart(2, '0');
  const ymd = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return ymd(d); };
  const mondayOf = (s) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ymd(d); };
  const GOALS = ['근육', '탄탄(유지)', '체지방 감량'];
  const TRAIN_DOWS = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] };   // 월=1 — 4회는 월 · 화 · 목 · 금

  // ① 숫자
  function bmi(p) { const m = p.height / 100; return p.weight / (m * m); }
  function bmiBand(R, b) { return R.bmi.bands_kr.find((x) => b < x.max).label; }
  function numbers(R, p) {
    const b = bmi(p);
    const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5);
    const keep = bmr * R.activity_factor_by_sessions[String(p.freq)];
    let kcal = p.goal === '근육' ? keep + (b >= 25 ? 0 : 250) : p.goal === '체지방 감량' ? Math.max(bmr, keep * 0.8) : keep;
    const basisW = b >= 30 ? 25 * (p.height / 100) ** 2 : p.weight;
    const protein = basisW * R.protein_g_per_kg[p.goal];
    const fat = kcal * R.fat_ratio / 9, carb = (kcal - protein * 4 - kcal * R.fat_ratio) / 4;
    const r = Math.round;
    return { bmi: Math.round(b * 10) / 10, band: bmiBand(R, b), bmr: r(bmr), keep: r(keep), kcal: r(kcal), restKcal: r(kcal) - 150, protein: r(protein), fat: r(fat), carb: r(carb) };
  }

  // ② 프로그램
  const parseReps = (s) => { const sec = /초/.test(s); const n = String(s).match(/\d+/g).map(Number); return { lo: n[0], hi: n[n.length - 1], sec }; };
  function goalReps(R, ex, item, goal) {
    const g = R.goal_mod[goal], base = parseReps(item.reps);
    if (base.sec || ex.kind === 'core') return base;
    if (goal === '근육') return base;
    const s = ex.kind === 'compound' ? g.compound_reps : g.isolation_reps;
    return parseReps(s);
  }
  function restSec(R, ex, goal) {
    if (goal === '탄탄(유지)') return ex.kind === 'compound' ? 90 : 60;
    if (goal === '체지방 감량') return ex.kind === 'compound' ? 90 : 45;
    return ex.rest_sec;
  }
  function splitWeeks(P, p) {
    const freq = String(Math.max(2, Math.min(5, +p.freq)));
    let weeks = P.split[freq].weeks.map((w) => w.slice());
    if (p.focus === '균형' && (freq === '4' || freq === '5')) weeks = weeks.map((w) => w.map((d) => (d === 'U_C' ? 'L_S' : d)));
    return weeks;
  }
  function buildDay(D, p, key, opts = {}) {
    const { rules: R, programs: P, exById } = D, T = P.days[key], goal = p.goal;
    let items = T.items.map((it) => ({ ...it }));
    if (p.focus === '복부·코어' && !items.some((it) => ['plank', 'cable_crunch'].includes(it.ex))) items.push({ ex: key === 'L_S' || key === 'B3' ? 'cable_crunch' : 'plank', sets: 2, reps: key === 'L_S' || key === 'B3' ? '12-15' : '30초', priority: 3 });
    const B = R.session_budget_min[String(p.minutes)] || R.session_budget_min['60'];
    let strengthMin = B.strength, cardioMin = B.cardio;
    if (+p.minutes === 30 && goal === '체지방 감량') { strengthMin = 15; cardioMin = 7; }
    const out = []; let used = 0;
    for (const it of items.sort((a, b) => a.priority - b.priority)) {
      let id = it.ex; if (p.exp === '처음' && exById[id].beginner_swap) id = exById[id].beginner_swap;
      if (opts.swaps && opts.swaps[it.ex]) id = opts.swaps[it.ex];                      // 사용자가 고른 대체
      const ex = exById[id];
      let sets = it.sets - (p.exp === '처음' ? 1 : 0); sets = Math.max(2, sets);
      if (opts.deload) sets = Math.max(2, Math.round(sets * 0.6));
      const rest = restSec(R, ex, goal), t = sets * (40 + rest) + 60;
      if (out.length >= B.max_exercises || used + t > strengthMin * 60) continue;
      used += t;
      out.push({ slot: it.ex, id, sets, reps: goalReps(R, ex, it, goal), rest, priority: it.priority });
    }
    const b = bmi(p), C = R.cardio[goal];
    let cType = C.type, cMin = cardioMin;
    if (goal === '근육' && (key === 'L_S' || key === 'B3')) cMin = Math.min(cMin, 5);
    if (b >= 30) { cType = '자전거 · 일립티컬'; cMin = Math.max(cMin, 5); }
    return { key, name: T.name, warmup: D.warmups.warmups[T.warmup], cooldown: D.warmups.cooldowns[T.cooldown], items: out,
             cardio: { type: cType, detail: C.detail, minutes: cMin, extra: goal === '체지방 감량' ? 10 : 0 }, deload: !!opts.deload };
  }
  // 놓친 날은 메꾸지 않고 '다음 순서부터' — 끝낸 횟수로 다음 날을 정한다
  function sequence(D, p) { return splitWeeks(D.programs, p).flat(); }
  function nextKey(D, p, doneCount) { const seq = sequence(D, p); return seq[doneCount % seq.length]; }
  function isTrainDay(p, date) { return (TRAIN_DOWS[Math.max(2, Math.min(5, +p.freq))] || []).includes(new Date(date + 'T12:00').getDay()); }

  // 더블 프로그레션 · 디로드
  function incFor(ex) { return ex.equipment === '맨몸' ? 0 : /덤벨/.test(ex.equipment) ? 1 : 2.5; }
  function progress(D, prog, item, doneSets) {   // 세션이 끝난 뒤 그 운동의 다음 값
    const ex = D.exById[item.id], st = { ...(prog[item.id] || { fails: 0 }) };
    if (!doneSets.length) return st;
    const top = doneSets.length >= item.sets && doneSets.every((s) => +s.r >= item.reps.hi);
    const miss = doneSets.some((s) => +s.r < item.reps.lo);
    const w = Math.max(...doneSets.map((s) => +s.w || 0));
    if (top) { if (incFor(ex)) st.w = Math.round((w + incFor(ex)) * 10) / 10; else st.r = item.reps.hi + 2; st.fails = 0; st.up = true; }
    else { st.w = w; st.up = false; st.fails = miss ? (st.fails || 0) + 1 : 0; if (st.fails >= 3 && w > 0) { st.w = Math.round(w * 0.9 * 2) / 2; st.fails = 0; st.dropped = true; } }
    return st;
  }
  function deloadNow(state, date) {
    const every = state.deloadEvery || 5, start = state.planStart || date;
    const wk = Math.floor((new Date(mondayOf(date) + 'T12:00') - new Date(mondayOf(start) + 'T12:00')) / (7 * 864e5));
    if (state.earlyDeloadWeek && state.earlyDeloadWeek === mondayOf(date)) return true;
    return wk > 0 && (wk + 1) % every === 0;
  }

  // ③ 식단
  function slotsFor(D, train) { return D.meals.slot_ratio[train ? '운동일' : '쉬는날']; }
  function kindsFor(mode, slot, date) {
    if (mode === '집밥만') return ['집', '간편'];
    if (mode === '외식만') return ['외식'];
    if (mode === '편의점 허용') return ['집', '간편', '외식', '편의점'];
    const wd = new Date(date + 'T12:00').getDay(); return slot === '점심' && wd >= 1 && wd <= 5 ? ['외식', '편의점'] : ['집', '간편'];
  }
  function planWeekMeals(D, p, N, diet, fromDate) {
    const mon = mondayOf(fromDate), out = {}, count = {};
    for (let i = 0; i < 7; i++) {
      const date = addDays(mon, i), train = isTrainDay(p, date), ratio = slotsFor(D, train), kcal = train ? N.kcal : N.restKcal;
      out[date] = {};
      for (const [slot, r] of Object.entries(ratio)) {
        const tp = N.protein * r, tk = kcal * r, kinds = kindsFor(diet.mode, slot, date);
        let cand = D.meals.meals.filter((m) => m.slots.includes(slot) && !diet.noIds.includes(m.id) && !m.tags.some((t) => diet.noTags.includes(t)) && kinds.includes(m.kind));
        if (!cand.length) cand = D.meals.meals.filter((m) => m.slots.includes(slot) && !diet.noIds.includes(m.id) && !m.tags.some((t) => diet.noTags.includes(t)));
        const today = Object.values(out[date]);                                              // 같은 날 같은 메뉴 두 번은 뒤로
        cand.sort((a, b) => today.includes(a.id) - today.includes(b.id) || ((count[a.id] || 0) >= 2) - ((count[b.id] || 0) >= 2) || Math.abs(a.protein_g - tp) - Math.abs(b.protein_g - tp) || Math.abs(a.kcal - tk) - Math.abs(b.kcal - tk) || (count[a.id] || 0) - (count[b.id] || 0));
        const forced = diet.swap?.[date]?.[slot];
        const m = (forced && cand.find((x) => x.id === forced)) || cand[0] || null;
        out[date][slot] = m ? m.id : null; if (m) count[m.id] = (count[m.id] || 0) + 1;
      }
    }
    return out;
  }
  function nextCandidate(D, p, N, diet, date, slot, curId) {     // 싫어요 · 다른 것 — 단백질 차이가 가장 작은 다음 후보
    const train = isTrainDay(p, date), tp = N.protein * slotsFor(D, train)[slot], kinds = kindsFor(diet.mode, slot, date);
    const cur = D.mealById[curId];
    const cand = D.meals.meals.filter((m) => m.slots.includes(slot) && m.id !== curId && !diet.noIds.includes(m.id) && !m.tags.some((t) => diet.noTags.includes(t)) && kinds.includes(m.kind));
    cand.sort((a, b) => Math.abs(a.protein_g - (cur ? cur.protein_g : tp)) - Math.abs(b.protein_g - (cur ? cur.protein_g : tp)));
    return cand[0] ? cand[0].id : null;
  }
  function parseQty(q) {
    const s = String(q).trim();
    if (/^반/.test(s)) return { n: 0.5, u: s.replace(/^반\s*/, '') };
    const m = s.match(/^(\d+)\/(\d+)\s*(.*)$/); if (m) return { n: +m[1] / +m[2], u: m[3] };
    const k = s.match(/^(\d+(?:\.\d+)?)\s*(.*)$/); if (k) return { n: +k[1], u: k[2] };
    return { n: null, u: s };
  }
  function shopping(D, week, have = []) {
    const acc = {};
    for (const d of Object.values(week)) for (const id of Object.values(d)) { const m = D.mealById[id]; if (!m || !m.shopping) continue;
      for (const it of m.shopping) { const q = parseQty(it.qty), key = it.item + '|' + q.u; const a = acc[key] || (acc[key] = { item: it.item, u: q.u, n: 0, loose: 0 }); if (q.n == null) a.loose++; else a.n += q.n; } }
    return Object.values(acc).filter((a) => !have.includes(a.item)).map((a) => {
      let txt = a.n ? `${Math.round(a.n * 10) / 10}${a.u}` : '조금';
      if (a.item === '계란' && a.u === '개') txt = `${a.n}개(${Math.ceil(a.n / 30)}판)`;
      return { item: a.item, txt };
    }).sort((x, y) => x.item.localeCompare(y.item, 'ko'));
  }
  return { ymd, addDays, mondayOf, GOALS, bmi, numbers, parseReps, buildDay, sequence, nextKey, isTrainDay, progress, incFor, deloadNow, planWeekMeals, nextCandidate, shopping, parseQty };
})();
if (typeof module !== 'undefined') module.exports = ENG;
