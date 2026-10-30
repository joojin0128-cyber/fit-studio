/* 고정표 화면(261031) — 요일마다 운동 순서 · 식단을 딱 정해 보여 준다. 추천 · 고르기 · 다시 짜기 화면은 숨김(코드는 남김).
   표는 data/fixed_week.json(기획) · 없으면 전신 밀기·당기기 + 식단 라이브러리로 한 번 정해 폰에 고정(S.fixedMeals) */
'use strict';
const isFixed = () => S.uiMode !== 'adaptive';
const FX_DEFAULT = { 1: { type: 'workout', program: 'P_PUSH' }, 2: { type: 'workout', program: 'P_PULL' }, 3: { type: 'walk', text: '걷기 30분 — 밖이든 러닝머신이든' },
  4: { type: 'workout', program: 'P_PUSH' }, 5: { type: 'workout', program: 'P_PULL' }, 6: { type: 'walk', text: '걷기 30분 — 밖이든 러닝머신이든' }, 0: { type: 'rest', text: '푹 쉬는 날' } };
let FXV = null;   // 보고 있는 날짜(요일 탭)
const dowOf = (date) => new Date(date + 'T12:00').getDay();
// 기획 fixed_week.json(261031b): 운동 요일 3개(설정) · 주마다 A/B 번갈아 · 운동 날 식단 3가지 · 안 하는 날 4가지(월요일부터 순서대로)
const FXS = () => { S.fx = S.fx || {}; if (!S.fx.keyEx) { if (S.keyEx.join() === 'incline_db_press,lat_pulldown,db_lateral_raise') S.keyEx = ['leg_press', 'lat_pulldown', 'machine_chest_press']; S.fx.keyEx = 1; }   // 그래프 운동 3개도 표에 있는 걸로(사용자가 바꾼 적 없을 때만)
  if (!S.fx.weekdays) S.fx.weekdays = ((D.fixed && D.fixed.settings && D.fixed.settings.workout_weekdays) || [1, 3, 5]).slice(); if (!S.fx.start) S.fx.start = today0(); return S.fx; };
const monFirst = (d) => (d + 6) % 7;   // 월=0 … 일=6
function fixDay(date) {
  if (!D.fixed) { const d = FX_DEFAULT[String(dowOf(date))]; return d; }
  const F = D.fixed, fx = FXS(), dow = dowOf(date), wds = fx.weekdays.slice().sort((a, b) => monFirst(a) - monFirst(b));
  const wk = Math.max(0, Math.round((new Date(mondayOf(date) + 'T12:00') - new Date(mondayOf(fx.start) + 'T12:00')) / 864e5 / 7)), rot = F.rotation[wk % 2 ? 'B' : 'A'];
  const idx = wds.indexOf(dow);
  if (idx >= 0) { const key = rot[idx % rot.length]; return { type: 'workout', key, idx, wk, W: F.workouts[key] }; }
  const offs = [0, 1, 2, 3, 4, 5, 6].map((i) => dowOf(addDays(mondayOf(date), i))).filter((d) => !wds.includes(d)), oi = offs.indexOf(dow);
  return { ...(dow === 0 ? F.off_days.rest : F.off_days.walk), oi, wk };
}
function fixBuild(date) {
  const d = fixDay(date); if (d.type !== 'workout') return null;
  if (!d.W) { const p = { ...S.profile, preset: 'ppl4' }; return ENG.buildDay(D, p, d.program, { swaps: S.swaps[d.program], week: planWeek(date) }); }   // 표가 없을 때
  const W = d.W, ex = (id) => D.exById[id];
  const mk = (it, core) => ({ slot: it.ex, id: it.ex, sets: it.sets, reps: ENG.parseReps(String(it.reps).replace(/\(.*\)/, '')), repsTxt: /\(/.test(it.reps) ? it.reps : null, rest: core ? 30 : ex(it.ex) && ex(it.ex).kind === 'compound' ? 90 : 60, priority: 1, core });
  return { key: 'FX_' + d.key, name: W.name, fixed: true, warmup: [W.warmup.text], cooldown: [W.cooldown.text], items: [...W.items.filter((it) => ex(it.ex)).map((it) => mk(it, false)), ...((W.core && W.core.items) || []).filter((it) => ex(it.ex)).map((it) => mk(it, true))],
    cardio: { type: W.cardio.type, detail: W.cardio.detail, minutes: W.cardio.minutes, extra: 0 }, deload: false };
}
function fixMeals(date) {
  const d = fixDay(date);
  if (D.fixed) { const M = D.fixed.meals, set = d.type === 'workout' ? M.workout[d.idx % M.workout.length] : M.off[(d.oi || 0) % M.off.length];
    return Object.entries(set || {}).map(([slot, v]) => ({ slot, id: null, name: v.name, kcal: v.kcal, protein: v.protein_g })); }
  const k = String(dowOf(date));
  if (!S.fixedMeals) {   // 표가 없을 때 — 한 번만 골라 고정
    const ref = '2026-11-02', wk = ENG.planWeekMeals(D, { ...S.profile }, N(), { mode: '기본', noIds: [], noTags: [...D.meals.default_disliked_tags], swap: {} }, ref, []);
    S.fixedMeals = {}; for (let i = 0; i < 7; i++) { const dd = addDays(ref, i); S.fixedMeals[dowOf(dd)] = wk[dd]; } save();
  }
  return Object.entries(S.fixedMeals[k] || {}).map(([slot, id]) => ({ slot, id, name: D.mealById[id] ? D.mealById[id].name : '—', kcal: D.mealById[id]?.kcal, protein: D.mealById[id]?.protein_g }));
}
const fixTarget = (date) => { const t = D.fixed && D.fixed.targets && D.fixed.targets[fixDay(date).type === 'workout' ? 'workout_day' : 'off_day']; return t ? { kcal: t.kcal, protein: parseInt(String(t.protein_g).match(/\d+/)[0], 10) } : { kcal: null, protein: N().protein }; };
function dayTabs(sel) {
  const mon = mondayOf(today0()), t0 = today0();
  return `<div class="chips daytabs" id="fxDays">${[0, 1, 2, 3, 4, 5, 6].map((i) => { const d = addDays(mon, i); const ty = fixDay(d).type;
    return `<button data-d="${d}" class="${d === sel ? 'on' : ''}${d === t0 ? ' today' : ''}">${DOW[dowOf(d)]}<small>${ty === 'workout' ? '💪' : ty === 'walk' ? '🚶' : '·'}</small></button>`; }).join('')}</div>`;
}
function previewCard(day) {
  return `<div class="card"><h2>${esc(day.name)}</h2><p class="hint">준비 5분 → 근력 → ${day.items.some((i) => i.core) ? '복근 10분 → ' : ''}${esc(day.cardio.type)} ${day.cardio.minutes}분 → 정리</p>
   ${day.items.map((it) => `<p class="small">${it.core ? '🔸 ' : ''}${esc(exName(it.id))} <span class="badge">${it.sets}×${repTxt(it.reps)}</span>${(() => { const l = lastOf(it.id); return l ? ` <span class="hint">지난번 ${l.sets.map((s) => (s.w ? s.w + 'kg×' : '') + s.r).join(', ')}</span>` : ''; })()}</p>`).join('')}</div>`;
}
function mealList(date, editable) {
  const ms = fixMeals(date), eaten = S.diet.eaten[date] || {}, flog = S.food.log[date] || [];
  const got = Math.round(ms.reduce((a, m) => a + (eaten[m.slot] ? m.protein || 0 : 0), 0) + ENG.foodTotals(flog).protein), tg = fixTarget(date), tp = tg.protein;
  return `<div class="card" id="fxMeals"><h2>식단 <span class="hint">${editable ? '먹으면 체크' : '미리 보기'}</span></h2>
   ${editable ? `<b style="font-size:26px">${got}<span class="muted" style="font-size:16px"> / ${tp}g 단백질</span></b><div class="prog" style="height:14px"><i style="width:${Math.min(100, Math.round(got / tp * 100))}%"></i></div>` : ''}
   ${ms.map((m) => `<div class="check" ${editable ? `data-sl="${esc(m.slot)}"` : ''}><span class="box ${eaten[m.slot] ? 'done' : ''}">${eaten[m.slot] ? '✓' : ''}</span><span><b>${esc(m.slot)}</b> ${esc(m.name)} <span class="hint">${m.protein != null ? m.protein + 'g' : ''}${m.kcal ? ' · ' + m.kcal + 'kcal' : ''}</span></span></div>`).join('')}
   ${flog.length ? `<p class="hint">다른 걸 먹음: ${flog.map((e) => esc(e.name)).join(' · ')}</p>` : ''}${tg.kcal ? `<p class="hint">목표 ${esc(tg.kcal)}kcal · 단백질 ${tp}g 안팎</p>` : ''}</div>`;
}
function todayFixed(v) {
  const t0 = carryOver(); if (!FXV) FXV = t0;
  const sel = FXV, isT = sel === t0, d = fixDay(sel), p = S.profile;
  $('#sub').textContent = `${md(sel)}(${DOW[dowOf(sel)]})${isT ? (t0 !== ymd() ? ' · 이어서' : ' · 오늘') : ''}`;
  let work = '';
  const started = isT && S.cur && S.cur.date === sel;
  if (d.type === 'workout') { const day = fixBuild(sel);
    if (!isT) work = previewCard(day);
    else if (started && S.cur.finished) work = `<div class="card"><h2>오늘 운동 끝 👏</h2><p>${esc(day.name)} · 기록 저장됨</p><button id="reopen">기록 고치기</button></div>`;
    else work = workoutCard(day, started); }
  else if (d.type === 'walk') { const done = (S.walkDone || {})[sel];
    work = `<div class="card"><h2>🚶 걷기 날</h2><p>${esc(d.text || '걷기 30분')}</p>${isT ? `<div class="check" id="fxWalk"><span class="box ${done ? 'done' : ''}">${done ? '✓' : ''}</span><span>했어요</span></div>` : ''}</div>`; }
  else work = `<div class="card"><h2>쉬는 날</h2><p>${esc(d.text || '푹 쉬는 날')}</p></div>`;
  const backup = S.sessions.length >= 3 && (!S.lastExport || (Date.now() - S.lastExport) > 14 * 864e5);
  v.innerHTML = `${dayTabs(sel)}${!isT ? `<p class="hint" style="margin:0 4px 8px">미리 보기 — 기록은 그날에 <button class="small ghost" id="fxBack">오늘로</button></p>` : ''}${isT && p.belly ? planCards(sel, { bellyOnly: true }) : ''}${isT && backup ? '<div class="card"><p class="small">기록은 이 폰 안에만 있어요 — 가끔 백업해 두세요</p><button id="bk">지금 백업</button></div>' : ''}${work}${mealList(sel, isT)}`;
  $('#fxDays').onclick = (e) => { const b = e.target.closest('button'); if (b) { FXV = b.dataset.d; render(); } };
  if ($('#fxBack')) $('#fxBack').onclick = () => { FXV = t0; render(); };
  if ($('#bk')) $('#bk').onclick = exportJson;
  if ($('#fxWalk')) $('#fxWalk').onclick = () => { S.walkDone = S.walkDone || {}; S.walkDone[sel] = !S.walkDone[sel]; save(); render(); };
  if (isT) { v.querySelectorAll('#fxMeals .check[data-sl]').forEach((el) => el.onclick = () => { const sl = el.dataset.sl, e = S.diet.eaten[sel] || {}; S.diet.eaten[sel] = { ...e, [sl]: !e[sl] }; save(); render(); });
    bindPlan(v, sel);
    if (d.type === 'workout') { const day = fixBuild(sel);
      if ($('#reopen')) $('#reopen').onclick = () => { S.cur.finished = false; S.done = Math.max(0, S.done - 1); S.sessions = S.sessions.filter((s) => !(s.date === sel && s.key === S.cur.key)); save(); render(); };
      if (!(started && S.cur.finished)) bindWorkout(day, sel); } }
}
function dietFixed(v) {
  const t0 = today0(); if (!FXV) FXV = t0; const sel = FXV;
  $('#sub').textContent = '식단';
  const mon = mondayOf(t0), week = {}; for (let i = 0; i < 7; i++) { const d = addDays(mon, i); week[d] = Object.fromEntries(fixMeals(d).filter((m) => m.id).map((m) => [m.slot, m.id])); }
  const shop = D.fixed && D.fixed.shopping_week ? D.fixed.shopping_week.filter((t) => !S.diet.have.includes(t)).map((t) => ({ item: t, txt: '' })) : ENG.shopping(D, week, S.diet.have);
  FST.simple = true;
  v.innerHTML = `${dayTabs(sel)}${mealList(sel, sel === t0)}
   ${D.fixed ? `<div class="card sub"><p class="hint">🍚 ${esc(D.fixed.eat_out_rule)}</p><p class="hint">🍠 ${esc(D.fixed.fiber)}</p></div>` : ''}<div class="card"><h2>이번 주 장보기 <span class="hint">매주 같음</span></h2>${shop.map((s) => `<div class="check" data-have="${esc(s.item)}"><span class="box"></span><span>${esc(s.item)} <span class="muted">${esc(s.txt)}</span></span></div>`).join('') || '<p class="muted">없음</p>'}
    ${S.diet.have.length ? `<p class="hint">집에 있음으로 숨김: ${S.diet.have.map(esc).join(', ')} <button class="small ghost" id="unhave">다시 보기</button></p>` : '<p class="hint">이미 집에 있는 건 눌러서 숨기세요</p>'}</div>
   ${sel === t0 ? `<details class="card" id="fxOther" ${FST.otherOpen ? 'open' : ''}><summary class="small">+ 다른 걸 먹었어요</summary>${foodCards(sel, true)}</details>` : ''}`;
  $('#fxDays').onclick = (e) => { const b = e.target.closest('button'); if (b) { FXV = b.dataset.d; render(); } };
  if (sel === t0) { v.querySelectorAll('#fxMeals .check[data-sl]').forEach((el) => el.onclick = () => { const sl = el.dataset.sl, e = S.diet.eaten[sel] || {}; S.diet.eaten[sel] = { ...e, [sl]: !e[sl] }; save(); render(); });
    $('#fxOther').ontoggle = (e) => { FST.otherOpen = e.target.open; }; if (FST.otherOpen) bindFood(v, sel); else $('#fxOther').addEventListener('toggle', () => { if ($('#fxOther').open) bindFood(v, sel); }, { once: true }); }
  v.querySelectorAll('[data-have]').forEach((el) => el.onclick = () => { S.diet.have.push(el.dataset.have); save(); render(); });
  if ($('#unhave')) $('#unhave').onclick = () => { S.diet.have = []; save(); render(); };
}
