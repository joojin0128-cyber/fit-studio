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
  // 인바디(30일 안) — 기획 rules.inbody: 결과지 기초대사량(없으면 370 + 21.6 × 제지방량) · 단백질은 제지방량 기준
  const ibFresh = (ib, date) => ib && !ib.useMifflin && (new Date((date || ymd()) + 'T12:00') - new Date(ib.date + 'T12:00')) / 864e5 <= 30 ? ib : null;
  const ffmOf = (ib) => ib.v.ffm ?? (ib.v.weight != null && ib.v.bfm != null ? ib.v.weight - ib.v.bfm : null);
  function numbers(R, p, ibIn, date) {
    const b = bmi(p), ib = ibFresh(ibIn, date), IB = R.inbody;
    const mif = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5);
    const ffm = ib ? ffmOf(ib) : null;
    const bmr = ib && (ib.v.bmr || ffm) ? (ib.v.bmr || 370 + 21.6 * ffm) : mif;
    const keep = bmr * R.activity_factor_by_sessions[String(p.freq)];
    let kcal = p.goal === '근육' ? keep + (b >= 25 ? 0 : 250) : p.goal === '체지방 감량' ? Math.max(bmr, keep * 0.8) : keep;
    let protein;
    if (ib && ffm && IB) { const sug = suggestGoal(R, p, ib); const coef = p.goal === '탄탄(유지)' && sug && sug.both ? IB.protein.g_per_kg_ffm['근육'] : IB.protein.g_per_kg_ffm[p.goal];
      const [lo, hi] = IB.protein.clamp_g_per_kg_bodyweight; protein = Math.min(hi * p.weight, Math.max(lo * p.weight, ffm * coef)); }
    else { const basisW = b >= 30 ? 25 * (p.height / 100) ** 2 : p.weight; protein = basisW * R.protein_g_per_kg[p.goal]; }
    const fat = kcal * R.fat_ratio / 9, carb = (kcal - protein * 4 - kcal * R.fat_ratio) / 4;
    const r = Math.round;
    return { bmi: Math.round(b * 10) / 10, band: bmiBand(R, b), bmr: r(bmr), keep: r(keep), kcal: r(kcal), restKcal: r(kcal) - 150, protein: r(protein), fat: r(fat), carb: r(carb),
      src: ib && (ib.v.bmr || ffm) ? 'inbody' : 'mifflin', mifflin: r(mif) };
  }
  // 골격근량 표준: 결과지 범위 → 없으면 키² × 22 × (남 .45 · 여 .40)
  function smmStd(p, ib) { if (ib && ib.std && ib.std.smm) return ib.std.smm; const s = (p.height / 100) ** 2 * 22 * (p.sex === 'f' ? 0.40 : 0.45); return [Math.round(s * 0.9 * 10) / 10, Math.round(s * 1.1 * 10) / 10]; }
  // 목표 제안(제안만 — 버튼을 눌러야 바뀐다)
  function suggestGoal(R, p, ib) {
    const G = R.inbody && R.inbody.goal_suggest; if (!G || !ib) return null;
    const sx = p.sex === 'f' ? 'female' : 'male', pbf = ib.v.pbf, smm = ib.v.smm, why = [];
    const high = pbf != null && pbf >= G.pbf_high[sx], very = pbf != null && pbf >= G.pbf_very_high[sx];
    const lowS = smm != null && smm < smmStd(p, ib)[0];
    if (high) why.push(`체지방률 ${pbf}% (${p.sex === 'f' ? '여' : '남'} ${G.pbf_high[sx]}% 이상)`);
    if (lowS) why.push(`골격근량 ${smm}kg (표준 ${smmStd(p, ib)[0]}kg 미만)`);
    if (high && lowS) return { goal: '탄탄(유지)', both: true, strong: very, why };
    if (high) return { goal: '체지방 감량', strong: very, why, cardio: very ? 10 : 0 };
    if (lowS) return { goal: '근육', why };
    return null;
  }
  // 부위 보강: 표준 대비 90% 미만 또는 좌우 차 10% 이상 → 하루 최대 2개 · priority 3(시간 모자라면 먼저 빠짐)
  function boosts(R, ib) {
    const B = R.inbody && R.inbody.segment_boost; if (!B || !ib) return [];
    const v = ib.v, out = [], pct = (k) => v[k + 'P'];
    const low = { 팔: ['ra', 'la'], 몸통: ['tr'], 다리: ['rl', 'll'] };
    for (const [seg, ks] of Object.entries(low)) if (ks.some((k) => pct(k) != null && pct(k) < 90)) for (const t of B.low[seg] || []) out.push({ ...t, seg, why: `${seg} 근육 표준 대비 ${Math.min(...ks.map(pct).filter((x) => x != null))}%` });
    for (const [seg, [a, b]] of [['팔', ['ra', 'la']], ['다리', ['rl', 'll']]]) { if (v[a] == null || v[b] == null) continue;
      const big = Math.max(v[a], v[b]), gap = (big - Math.min(v[a], v[b])) / big; const t = B.imbalance[seg];
      if (gap >= 0.1 && t && typeof t === 'object') out.push({ ...t, seg, weak: v[a] < v[b] ? (seg === '팔' ? '오른팔' : '오른다리') : (seg === '팔' ? '왼팔' : '왼다리'), why: `좌우 차 ${Math.round(gap * 100)}%` }); }
    return out;
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
    for (const bo of (opts.boost || []).filter((x) => x.days.includes(key)).slice(0, 2)) if (!items.some((it) => it.ex === bo.ex) && exById[bo.ex])
      items.push({ ex: bo.ex, sets: bo.sets, reps: /최대/.test(bo.reps) ? '8-15' : bo.reps.replace(/\(.*\)/, ''), priority: 3, boost: `${bo.seg} 보강 · ${bo.why}${bo.weak ? ' · 약한 쪽(' + bo.weak + ')부터' : ''}${bo.how ? ' · ' + bo.how : ''}${/최대/.test(bo.reps) ? ' · 최대 횟수 −2' : ''}` });
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
      if (opts.easy) sets = Math.max(2, sets - 1);   // 술 다음 날 '가볍게' — 세트 −1 · RIR +1(rules.food_log.alcohol)
      const rest = restSec(R, ex, goal), t = sets * (40 + rest) + 60;
      if (out.length >= B.max_exercises || used + t > strengthMin * 60) continue;
      used += t;
      out.push({ slot: it.ex, id, sets, reps: it.boost ? parseReps(it.reps) : goalReps(R, ex, it, goal), rest, priority: it.priority, boost: it.boost });
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
  function planWeekMeals(D, p, N, diet, fromDate, extraTrain = []) {
    const mon = mondayOf(fromDate), out = {}, count = {};
    for (let i = 0; i < 7; i++) {
      const date = addDays(mon, i), train = isTrainDay(p, date) || extraTrain.includes(date), ratio = slotsFor(D, train), kcal = train ? N.kcal : N.restKcal;
      out[date] = {};
      for (const [slot, r] of Object.entries(ratio)) {
        const tp = N.protein * r, tk = kcal * r, kinds = kindsFor(diet.mode, slot, date);
        let cand = D.meals.meals.filter((m) => m.slots.includes(slot) && !diet.noIds.includes(m.id) && !m.tags.some((t) => diet.noTags.includes(t)) && kinds.includes(m.kind));
        if (!cand.length) cand = D.meals.meals.filter((m) => m.slots.includes(slot) && !diet.noIds.includes(m.id) && !m.tags.some((t) => diet.noTags.includes(t)));   // 그 모드 메뉴가 없는 끼니 — 화면이 '모드 메뉴 없음'을 안내
        const today = Object.values(out[date]);                                              // 같은 날 같은 메뉴 두 번은 뒤로
        cand.sort((a, b) => today.includes(a.id) - today.includes(b.id) || ((count[a.id] || 0) >= 2) - ((count[b.id] || 0) >= 2) || Math.abs(a.protein_g - tp) - Math.abs(b.protein_g - tp) || Math.abs(a.kcal - tk) - Math.abs(b.kcal - tk) || (count[a.id] || 0) - (count[b.id] || 0));
        const forced = diet.swap?.[date]?.[slot];
        const m = (forced && cand.find((x) => x.id === forced)) || cand[0] || null;
        out[date][slot] = m ? m.id : null; if (m) count[m.id] = (count[m.id] || 0) + 1;
      }
    }
    return out;
  }
  function nextCandidate(D, p, N, diet, date, slot, curId, extraTrain = []) {     // 싫어요 · 다른 것 — 단백질 차이가 가장 작은 다음 후보
    const train = isTrainDay(p, date) || extraTrain.includes(date), tp = N.protein * slotsFor(D, train)[slot], kinds = kindsFor(diet.mode, slot, date);
    const cur = D.mealById[curId];
    const ok = (m) => m.slots.includes(slot) && m.id !== curId && !diet.noIds.includes(m.id) && !m.tags.some((t) => diet.noTags.includes(t));
    let cand = D.meals.meals.filter((m) => ok(m) && kinds.includes(m.kind));
    if (!cand.length) cand = D.meals.meals.filter(ok);                                   // QA 참고 ①: 그 모드 메뉴가 없으면 전체에서
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
  // 먹은 것 기록 → 남은 하루(261030) — 기획 rules.food_log(261030c)
  const FOOD_SLOTS = ['아침', '점심', '간식', '저녁', '야식'];
  const DRINK = /술|소주|맥주|와인|막걸리|하이볼|위스키|칵테일|사케|보드카|소맥/;
  const SOJU_EQ = { soju: 1, soju_glass: 1 / 7, beer: 1 / 3, beer_can: 1 / 3, somaek: 1 / 3, makgeolli: 0.75, wine: 1 / 4, highball: 1 / 4 };   // 소주 1병 = 1 · 맥주 3잔 = 1
  const PLAN_END = { 아침: 10, 점심: 15, 운동전: 18, 간식: 18, 저녁: 22 };   // 그 시각이 지나면 지난 끼니
  const foodTotals = (log) => (log || []).reduce((a, e) => ({ kcal: a.kcal + (e.kcal || 0) * (e.qty || 1), protein: a.protein + (e.protein || 0) * (e.qty || 1), carb: a.carb + (e.carb || 0) * (e.qty || 1), fat: a.fat + (e.fat || 0) * (e.qty || 1) }), { kcal: 0, protein: 0, carb: 0, fat: 0 });
  const isDrink = (e) => !!e.alcohol || (e.tags || []).includes('술') || DRINK.test(e.name || '');
  const sojuEq = (log) => (log || []).filter(isDrink).reduce((a, e) => a + (SOJU_EQ[e.fid] ?? 1 / 3) * (e.qty || 1), 0);
  const riceIn = (m) => { const r = (m.shopping || []).find((x) => /밥/.test(x.item)); if (!r) return /밥|덮밥|비빔밥|공기/.test(m.name) ? 1 : 0; return /반/.test(r.qty) ? 0.5 : /2\/3/.test(r.qty) ? 0.67 : /1\/3/.test(r.qty) ? 0.33 : 1; };
  function restOfDay(D, p, N, diet, date, log, train, hour) {
    const eaten = foodTotals(log), kcal = train ? N.kcal : N.restKcal, ratio = slotsFor(D, train);
    const done = new Set((log || []).map((e) => (e.slot === '야식' ? '저녁' : e.slot === '간식' && ratio['운동전'] != null && hour < 18 ? '운동전' : e.slot)));
    const left = Object.keys(ratio).filter((s) => !done.has(s) && hour < (PLAN_END[s] ?? 24));
    const rk = kcal - eaten.kcal, rp = Math.max(0, N.protein - eaten.protein), over = eaten.kcal >= kcal * 1.1, drink = (log || []).some(isDrink);
    const wsum = left.reduce((a, s) => a + ratio[s], 0) || 1, picks = [], used = new Set();
    for (const s of left) {
      const tk = Math.max(0, rk) / left.length, tp = rp / left.length, kinds = kindsFor(diet.mode, s, date);   // 기획: 남은 단백질 ÷ 남은 끼니 수
      const ok = (m) => m.slots.includes(s) && !diet.noIds.includes(m.id) && !m.tags.some((t) => diet.noTags.includes(t)) && !used.has(m.id);
      let cand = D.meals.meals.filter((m) => ok(m) && kinds.includes(m.kind)); if (!cand.length) cand = D.meals.meals.filter(ok);
      const inK = (m) => Math.abs(m.kcal - tk) <= tk * 0.2;
      if (over) cand.sort((a, b) => (a.protein_g < tp * 0.7) - (b.protein_g < tp * 0.7) || a.kcal - b.kcal);   // 많이 먹은 날: 단백질 위주 가벼운 메뉴
      else cand.sort((a, b) => Math.abs(a.protein_g - tp) - Math.abs(b.protein_g - tp) || (!inK(a)) - (!inK(b)) || Math.abs(a.kcal - tk) - Math.abs(b.kcal - tk));
      const m = cand[0]; if (!m) continue; used.add(m.id);
      let rice = null; const base = riceIn(m);
      if (base) { const f = over ? 0.5 : [0.5, 0.67, 1].reduce((b, x) => (Math.abs(m.kcal + (x - base) * 315 - tk) < Math.abs(m.kcal + (b - base) * 315 - tk) ? x : b), 1); rice = `밥 ${f === 0.5 ? '반' : f === 0.67 ? '2/3' : '1'}공기`; }
      picks.push({ slot: s, id: m.id, tk: Math.round(tk), tp: Math.round(tp), rice });
    }
    // 끼니당 단백질이 40g 넘게 필요하면 단백질 간식 하나 더(rules.food_log.replan.protein_gap)
    let extra = null;
    if (left.length && rp / left.length > 40 && D.foods) { const fb = Object.fromEntries(D.foods.foods.map((f) => [f.id, f]));
      const f = ['protein_shake', 'meetree_ball', 'chicken_breast', 'egg'].map((id) => fb[id]).find((x) => x && !diet.noTags.some((t) => x.name.includes(t)));
      if (f) extra = { id: f.id, name: f.name, kcal: f.kcal, protein: f.protein_g, serving: f.serving }; }
    const under = hour >= 22 && eaten.kcal < kcal * 0.7;
    return { eaten: { kcal: Math.round(eaten.kcal), protein: Math.round(eaten.protein), carb: Math.round(eaten.carb), fat: Math.round(eaten.fat) }, target: { kcal, protein: N.protein },
      left: { kcal: Math.round(rk), protein: Math.round(rp) }, picks, extra, over, under, drink, soju: Math.round(sojuEq(log) * 100) / 100 };
  }
  return { FOOD_SLOTS, foodTotals, isDrink, sojuEq, restOfDay, kindsFor, ymd, addDays, mondayOf, GOALS, bmi, numbers, ibFresh, smmStd, suggestGoal, boosts, parseReps, buildDay, sequence, nextKey, isTrainDay, progress, incFor, deloadNow, planWeekMeals, nextCandidate, shopping, parseQty };
})();
if (typeof module !== 'undefined') module.exports = ENG;
