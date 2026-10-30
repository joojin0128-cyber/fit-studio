/* 먹은 것 기록 → 남은 하루 — 기록은 이 폰 안(S.food)에만. 음식 목록 data/foods.json(기획 150개) + 식단 라이브러리. 규칙은 rules.food_log(261030c) */
'use strict';
const FST = { slot: null, qty: 1, open: false };
const QTYS = () => (D.foods && D.foods.portion_scale) || [{ label: '반', x: 0.5 }, { label: '보통', x: 1 }, { label: '1.5배', x: 1.5 }, { label: '2배', x: 2 }];
const normQ = (t) => String(t || '').toLowerCase().replace(/\s+/g, '');
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const cho = (t) => [...String(t)].map((c) => { const k = c.charCodeAt(0) - 0xac00; return k >= 0 && k < 11172 ? CHO[Math.floor(k / 588)] : c; }).join('');   // 초성 검색(ㅈㅇ → 제육)
function foodsAll() {
  if (D.foodList) return D.foodList;
  const fs = (D.foods ? D.foods.foods : []).map((f) => ({ id: 'f:' + f.id, fid: f.id, name: f.name, alias: f.aliases || [], kcal: f.kcal, protein: f.protein_g, carb: f.carb_g, fat: f.fat_g, unit: f.serving, alcohol: !!f.alcohol, cat: f.category, generic: /^generic_/.test(f.id) }));
  const ms = D.meals.meals.map((m) => ({ id: 'm:' + m.id, mid: m.id, name: m.name, alias: m.tags || [], kcal: m.kcal, protein: m.protein_g, unit: '식단 메뉴', tags: m.tags }));
  D.foodList = [...fs, ...ms]; D.foodById = Object.fromEntries(D.foodList.map((f) => [f.id, f])); return D.foodList;
}
const recentCount = (key, days = 14) => { let n = 0; for (let i = 0; i < days; i++) for (const e of S.food.log[addDays(ymd(), -i)] || []) if (e.key === key) n++; return n; };
const slotCount = (key, slot) => Object.values(S.food.log).flat().filter((e) => e.key === key && e.slot === slot).length;
function foodSearch(q, slot) {
  const n = normQ(q); if (!n) return [];
  const isCho = /^[ㄱ-ㅎ]+$/.test(n);
  const sc = (f) => { const nm = normQ(f.name), al = (f.alias || []).map(normQ);
    if (isCho) return cho(nm).startsWith(n) || al.some((a) => cho(a).startsWith(n)) ? 1 : cho(nm).includes(n) ? 2 : 9;
    if (nm.startsWith(n) || al.some((a) => a.startsWith(n))) return 0; if (nm.includes(n) || al.some((a) => a.includes(n))) return 2; return 9; };
  return foodsAll().filter((f) => !f.generic).map((f) => [sc(f), f]).filter(([s]) => s < 9)
    .sort((a, b) => a[0] - b[0] || recentCount(b[1].id) - recentCount(a[1].id) || slotCount(b[1].id, slot) - slotCount(a[1].id, slot) || a[1].name.length - b[1].name.length).slice(0, 8).map(([, f]) => f);
}
const slotNow = () => { const h = new Date().getHours(); return h >= 5 && h < 10 ? '아침' : h >= 10 && h < 15 ? '점심' : h >= 15 && h < 18 ? '간식' : h >= 18 && h < 22 ? '저녁' : '야식'; };   // rules.food_log.input.slot
const foodLog = (date) => (S.food.log[date] = S.food.log[date] || []);
function addFood(date, f, qty, slot) {
  foodLog(date).push({ slot: slot || FST.slot || slotNow(), key: f.id || 'n:' + f.name, fid: f.fid || null, name: f.name, kcal: Math.round(f.kcal || 0), protein: Math.round((f.protein || 0) * 10) / 10, carb: f.carb || 0, fat: f.fat || 0, qty, alcohol: !!f.alcohol, tags: f.tags || [], at: Date.now() });
  if (!f.id) S.food.custom[f.name] = { name: f.name, kcal: f.kcal, protein: f.protein };
}
function freqFoods(slot) {
  foodsAll(); const keys = {};
  for (let i = 0; i < 14; i++) for (const e of S.food.log[addDays(ymd(), -i)] || []) keys[e.key] = (keys[e.key] || 0) + 1 + (e.slot === slot ? 0.5 : 0);
  return Object.entries(keys).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => (k.startsWith('n:') ? (S.food.custom[k.slice(2)] && { ...S.food.custom[k.slice(2)] }) : D.foodById[k])).filter(Boolean);
}
const isTrainOn = (date) => ENG.isTrainDay(S.profile, date) || extraTrain().includes(date);
const rodFor = (date) => { const h = new Date().getHours(), hr = date === ymd() ? h : date === addDays(ymd(), -1) && h < 5 ? 24 + h : date < ymd() ? 24 : 0;   // 새벽 5시 전 전날 화면이면 그날 끼니는 다 지난 것
  return ENG.restOfDay(D, S.profile, N(), S.diet, date, S.food.log[date] || [], isTrainOn(date), hr); };
const pColor = (v, t) => (v >= t * 0.9 ? 'var(--ok)' : v >= t * 0.6 ? '#e0a800' : 'var(--muted)');   // rules.food_log.summary.colors — 빨강 쓰지 않는다

function foodCards(date) {
  const log = foodLog(date), r = rodFor(date), slot = FST.slot || slotNow(), y = (S.food.log[addDays(date, -1)] || []).filter((e) => e.slot === slot);
  const bySlot = ENG.FOOD_SLOTS.map((s) => [s, log.map((e, i) => [e, i]).filter(([e]) => e.slot === s)]).filter(([, a]) => a.length);
  const gen = foodsAll().filter((f) => f.generic), fr = freqFoods(slot), sides = r.drink ? foodsAll().filter((f) => /닭꼬치|두부김치|마른안주|오징어|노가리|황태/.test(f.name)).slice(0, 3) : [];
  const pct = Math.min(100, Math.round(r.eaten.protein / r.target.protein * 100));
  return `<div class="card" id="foodCard"><h2>먹은 것 기록 <span class="hint">${md(date)}</span></h2>
   <div class="chips" id="fSlot">${ENG.FOOD_SLOTS.map((s) => `<button data-v="${s}" class="${slot === s ? 'on' : ''}">${s}</button>`).join('')}</div>
   ${y.length ? `<button class="small" id="fYday">어제 ${slot} 그대로: ${y.map((e) => esc(e.name)).join(' · ')}</button>` : ''}
   <div class="fsearch"><input id="fQ" placeholder="음식 이름 — 예: 제육, 닭가슴살, ㄱㅂ(김밥)" autocomplete="off"><div id="fList" class="flist"></div></div>
   ${fr.length ? `<p class="hint">자주 먹은 것</p><div class="chips" id="fFreq">${fr.map((f, i) => `<button data-i="${i}">${esc(f.name)}</button>`).join('')}</div>` : ''}
   <p class="hint">양</p><div class="chips" id="fQty">${QTYS().map((q) => `<button data-v="${q.x}" class="${FST.qty === q.x ? 'on' : ''}">${q.label}</button>`).join('')}</div>
   <details id="fHandBox" ${FST.open ? 'open' : ''}><summary class="hint">목록에 없으면 — 그 밖에</summary>
    <label>이름(선택)</label><input id="fN" placeholder="예: 회사 앞 국수">
    <div class="chips" id="fGen">${gen.map((f, i) => `<button data-i="${i}">${esc(f.name)} <span class="hint">${f.kcal}kcal</span></button>`).join('')}</div>
    <div class="grid2"><div><label>칼로리 알면</label><input id="fK" inputmode="numeric"></div><div><label>단백질 g</label><input id="fP" inputmode="decimal"></div></div><button id="fAdd">이 숫자로 추가</button></details>
   ${bySlot.length ? `<h3>오늘 먹은 것</h3>${bySlot.map(([s, a]) => `<div class="small"><b>${s}</b> ${a.map(([e, i]) => `<span class="badge fitem">${esc(e.name)}${e.qty !== 1 ? ` ×${e.qty}` : ''} · ${Math.round(e.protein * e.qty)}g <button class="small ghost fdel" data-i="${i}" aria-label="${esc(e.name)} 지우기">×</button></span>`).join(' ')}</div>`).join('')}` : '<p class="hint">아직 기록이 없어요 — 먹은 걸 검색하거나 자주 먹은 것을 눌러 주세요</p>'}
   <div style="margin-top:10px"><b style="font-size:30px">${r.eaten.protein}<span class="muted" style="font-size:17px"> / ${r.target.protein}g 단백질</span></b>
    <div class="prog" style="height:18px"><i style="width:${pct}%;background:${pColor(r.eaten.protein, r.target.protein)}"></i></div>
    <p class="hint">${r.left.kcal >= 0 ? `남은 약 ${r.left.kcal.toLocaleString()}kcal` : `오늘 목표보다 약 ${(-r.left.kcal).toLocaleString()}kcal 더 먹었어요`} · 먹은 ${r.eaten.kcal.toLocaleString()}kcal</p>
    <details><summary class="hint">탄수 · 지방</summary><p class="small">탄수 ${r.eaten.carb}g · 지방 ${r.eaten.fat}g <span class="hint">(목록 음식만 · 대략값)</span></p></details></div></div>
  <div class="card" id="restCard"><h2>남은 하루${r.over ? ' <span class="badge">많이 먹은 날</span>' : ''}</h2>
   ${r.picks.length ? `<p class="hint">남은 단백질 ${r.left.protein}g을 남은 ${r.picks.length}끼에 나눴어요${r.over ? ' — 단백질 위주 가벼운 메뉴로' : ''}</p>` : ''}
   ${r.picks.map((pk) => { const m = D.mealById[pk.id]; return m ? `<div class="meal"><span class="badge">${pk.slot}</span><div><div>${esc(m.name)}</div><span class="hint">${m.protein_g}g · ${m.kcal}kcal${pk.rice ? ` · <b>${esc(pk.rice)}</b>` : ''}</span></div><button class="small" data-ate="${pk.id}" data-slot="${pk.slot}">먹었어요</button></div>` : ''; }).join('')}
   ${r.extra ? `<div class="meal"><span class="badge">간식+</span><div><div>${esc(r.extra.name)}</div><span class="hint">${r.extra.protein}g · ${r.extra.kcal}kcal · 단백질이 끼니당 40g 넘게 남아 하나 더</span></div><button class="small" data-atef="${r.extra.id}">먹었어요</button></div>` : ''}
   ${!r.picks.length ? `<p class="hint">오늘 끼니는 끝났어요${r.left.protein >= 20 ? ` — 단백질이 ${r.left.protein}g 남았어요. 자기 전 단백질 음료 하나면 좋아요` : ''}</p>` : ''}
   ${r.under ? '<p class="small">오늘 덜 먹었어요 — 우유 · 바나나 · 견과 중 하나 어때요(선택)</p>' : ''}
   ${r.over && date === today0() ? `<p class="small">많이 먹은 날이에요. 굶거나 내일 줄이지 않아도 돼요 — 내일은 평소 계획 그대로.</p>${S.food.walk[date] ? `<p class="small">🚶 걷기 ${S.food.walk[date]}분을 오늘 운동에 붙였어요 <button class="small ghost" id="fWalkX">빼기</button></p>` : '<button class="small" id="fWalk">걷기 20분 붙이기(선택)</button>'}` : ''}
   ${r.drink ? `<p class="small">🍺 술 마신 날 — 물 많이 · 안주는 단백질 먼저${sides.length ? `: ${sides.map((f) => esc(f.name)).join(' · ')}` : ''}. 내일 운동 강도는 오늘 화면에서 고를 수 있어요</p>` : ''}</div>`;
}
function bindFood(v, date) {
  const done = () => { save(); render(); };
  $('#fSlot').onclick = (e) => { const b = e.target.closest('button'); if (b) { FST.slot = b.dataset.v; render(); } };
  $('#fQty').onclick = (e) => { const b = e.target.closest('button'); if (b) { FST.qty = +b.dataset.v; render(); } };
  const list = $('#fList'), q = $('#fQ'), slot = FST.slot || slotNow();
  const show = () => { const r = foodSearch(q.value, slot); list._r = r; list.innerHTML = r.map((f, i) => `<button type="button" data-i="${i}"><b>${esc(f.name)}</b> <span class="hint">${f.unit ? esc(f.unit) + ' · ' : ''}${f.kcal}kcal · ${f.protein}g</span></button>`).join('') || (q.value.trim() ? `<p class="hint">"${esc(q.value)}" 없음 — 아래 '그 밖에'</p>` : ''); };
  q.addEventListener('input', show);
  list.onclick = (e) => { const b = e.target.closest('button'); if (b) { addFood(date, list._r[+b.dataset.i], FST.qty); done(); } };
  if ($('#fFreq')) { const fr = freqFoods(slot); $('#fFreq').onclick = (e) => { const b = e.target.closest('button'); if (b) { addFood(date, fr[+b.dataset.i], FST.qty); done(); } }; }
  if ($('#fYday')) $('#fYday').onclick = () => { for (const e of (S.food.log[addDays(date, -1)] || []).filter((x) => x.slot === slot)) foodLog(date).push({ ...e, at: Date.now() }); done(); };
  $('#fHandBox').ontoggle = (e) => { FST.open = e.target.open; };
  const gen = foodsAll().filter((f) => f.generic);
  $('#fGen').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const g = gen[+b.dataset.i], n = $('#fN').value.trim(); addFood(date, n ? { ...g, id: null, fid: g.fid, name: `${n}(${g.name})` } : g, FST.qty); done(); };
  $('#fAdd').onclick = () => { const n = $('#fN').value.trim() || '직접 입력', k = parseFloat($('#fK').value), pr = parseFloat($('#fP').value);
    if (!Number.isFinite(k)) { alert('칼로리를 모르면 위의 보통 한 끼 같은 걸 눌러 주세요'); return; }
    if (k < 0 || k > 3000 || (Number.isFinite(pr) && (pr < 0 || pr > 200))) { alert('칼로리는 0~3,000, 단백질은 0~200g 사이로 넣어 주세요'); return; } addFood(date, { name: n, kcal: k, protein: Number.isFinite(pr) ? pr : 0 }, FST.qty); done(); };
  v.querySelectorAll('.fdel').forEach((b) => b.onclick = () => { foodLog(date).splice(+b.dataset.i, 1); done(); });
  v.querySelectorAll('[data-ate]').forEach((b) => b.onclick = () => { const m = D.mealById[b.dataset.ate]; addFood(date, D.foodById['m:' + m.id], 1, b.dataset.slot === '운동전' ? '간식' : b.dataset.slot); done(); });
  v.querySelectorAll('[data-atef]').forEach((b) => b.onclick = () => { addFood(date, D.foodById['f:' + b.dataset.atef], 1, '간식'); done(); });
  if ($('#fWalk')) $('#fWalk').onclick = () => { S.food.walk[date] = 20; done(); };
  if ($('#fWalkX')) $('#fWalkX').onclick = () => { delete S.food.walk[date]; done(); };
}
// 오늘 화면 연결 — 술 다음 날 강도 제안(고르기 전엔 계획 그대로) · 많이 먹은 날 걷기(눌렀을 때만)
function foodDayMods(date) {
  const yl = S.food.log[addDays(date, -1)] || [], drank = yl.some(ENG.isDrink), heavy = ENG.sojuEq(yl) > 1, ch = S.food.choice[date];
  return { drank, heavy, choice: ch, easy: drank && ch === 'easy', rest: drank && ch === 'rest', walk: S.food.walk[date] || 0 };
}
function drinkCard(date) {
  const m = foodDayMods(date); if (!m.drank || m.choice) return '';
  return `<div class="card" id="drinkCard"><h2>🍺 어제 술 마셨어요</h2><p class="small">오늘 근력은 세트 −1 · 1~2회 여유 남기고(RIR +1) · 유산소는 가볍게 어때요?</p>
   <div class="row"><button class="primary" data-dc="easy">가볍게 할게</button><button data-dc="keep">그대로 할게</button>${m.heavy ? '<button data-dc="rest">쉬는 날로 바꾸기</button>' : ''}</div></div>`;
}
function bindDrink(v, date) { v.querySelectorAll('[data-dc]').forEach((b) => b.onclick = () => { S.food.choice[date] = b.dataset.dc; save(); render(); }); }
