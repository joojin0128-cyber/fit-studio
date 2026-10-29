/* 헬스 스튜디오 화면 — 기록은 이 폰 안(localStorage)에만. 서버 · 계정 · API 키 · 외부 전송 · 분석 스크립트 없음. 계산은 engine.js(규칙만). */
'use strict';
const KEY = 'fit_studio_v2';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const { ymd, addDays, mondayOf } = ENG;
const md = (s) => `${+s.slice(5, 7)}/${+s.slice(8)}`;
let D = null, S = null, tab = 'today';

function blank() {
  return { v: 2, profile: null, planStart: null, deloadEvery: 5, earlyDeloadWeek: null, done: 0, sessions: [], body: [], waist: [], prog: {}, swaps: {}, cur: null,
    diet: { mode: '기본', noIds: [], noTags: null, swap: {}, eaten: {}, have: [] }, keyEx: ['incline_db_press', 'lat_pulldown', 'db_lateral_raise'], theme: 'auto' };
}
function load() { try { S = JSON.parse(localStorage.getItem(KEY) || 'null') } catch (e) { S = null } if (!S || S.v !== 2) S = blank(); if (!S.diet.noTags) S.diet.noTags = [...D.meals.default_disliked_tags]; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) { alert('저장 공간이 모자랍니다 — 설정에서 JSON 으로 내보내 두세요') } }
function theme() { const t = S.theme || 'auto'; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
const N = () => ENG.numbers(D.rules, S.profile);
const exName = (id) => D.exById[id]?.name || id;
const repTxt = (r) => r.sec ? `${r.lo}초` : r.lo === r.hi ? `${r.lo}회` : `${r.lo}–${r.hi}회`;

function render() {
  theme();
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  $('#tabs').style.display = S.profile ? '' : 'none';
  if (!S.profile) return wizard($('#view'));
  ({ today, log, diet, settings }[tab] || today)($('#view'));
}

// ── ① 처음 설정 ──
function wizard(v, edit = false) {
  const p = S.profile || { height: '', weight: '', age: '', sex: 'm', exp: '처음', goal: '근육', freq: 3, minutes: 45, focus: '상체 실루엣', noWeigh: false };
  $('#sub').textContent = edit ? '정보 수정' : '처음 설정';
  const chip = (name, val, opts) => `<div class="chips" data-k="${name}">${opts.map(([k, t]) => `<button type="button" data-v="${k}" class="${String(val) === String(k) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  v.innerHTML = `<div class="card"><h2>${edit ? '내 정보 고치기' : '반가워요 — 30초만 알려 주세요'}</h2><p class="hint">숫자는 이 폰 안에만 저장돼요</p>
   <div class="grid2"><div><label>키(cm)</label><input id="wH" inputmode="decimal" value="${esc(p.height)}"></div><div><label>체중(kg)</label><input id="wW" inputmode="decimal" value="${esc(p.weight)}"></div></div>
   <div class="grid2"><div><label>나이</label><input id="wA" inputmode="numeric" value="${esc(p.age)}"></div><div><label>성별</label>${chip('sex', p.sex, [['m', '남'], ['f', '여']])}</div></div>
   <label>운동 경험</label>${chip('exp', p.exp, [['처음', '처음'], ['조금', '조금'], ['자세 앎', '자세 앎']])}
   <label>목표</label>${chip('goal', p.goal, [['근육', '근육'], ['탄탄(유지)', '탄탄(유지)'], ['체지방 감량', '체지방 감량']])}
   <label>일주일에 몇 번</label>${chip('freq', p.freq, [[2, '2번'], [3, '3번'], [4, '4번'], [5, '5번']])}
   <label>한 번에 몇 분</label>${chip('minutes', p.minutes, [[30, '30분'], [45, '45분'], [60, '60분']])}
   <label>집중 부위</label>${chip('focus', p.focus, [['상체 실루엣', '상체 실루엣'], ['균형', '균형'], ['복부·코어', '복부·코어']])}
   <label>체중 안 재기</label>${chip('noWeigh', p.noWeigh ? 1 : 0, [[0, '체중 잴게요'], [1, '안 잴래요(허리둘레만)']])}
   <p id="wBmi" class="muted"></p><p id="wWarn" class="hint"></p>
   <button class="primary big" id="wGo">${edit ? '저장하고 프로그램 다시 짜기' : '내 프로그램 만들기'}</button>
   ${edit ? '<button class="ghost big" id="wBack">취소</button>' : ''}<p class="hint">${esc(D.rules.disclaimer)}</p></div>`;
  const st = { ...p, noWeigh: p.noWeigh ? 1 : 0 };
  const warn = () => { $('#wWarn').textContent = st.exp === '처음' && +st.freq === 5 ? '처음이면 주 4회로 시작하는 걸 권해요' : ''; };
  v.querySelectorAll('.chips').forEach((c) => c.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st[c.dataset.k] = b.dataset.v; c.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); warn(); }));
  const show = () => { const h = parseFloat($('#wH').value), w = parseFloat($('#wW').value); if (!(h > 100 && w > 25)) { $('#wBmi').textContent = ''; return; } const b = ENG.bmi({ height: h, weight: w }); $('#wBmi').innerHTML = `BMI <b>${b.toFixed(1)}</b> · ${esc(D.rules.bmi.bands_kr.find((x) => b < x.max).label)} <span class="hint">(근육이 많으면 높게 나올 수 있어요)</span>`; };
  ['#wH', '#wW'].forEach((s) => $(s).addEventListener('input', show)); show(); warn();
  $('#wGo').onclick = () => {
    const h = parseFloat($('#wH').value), w = parseFloat($('#wW').value), a = parseInt($('#wA').value, 10);
    if (!(h > 100 && h < 230 && w > 25 && w < 250 && a >= 14 && a < 100)) { alert('키(cm) · 체중(kg) · 나이를 숫자로 넣어 주세요'); return; }
    const np = { height: h, weight: w, age: a, sex: st.sex, exp: st.exp, goal: st.goal, freq: +st.freq, minutes: +st.minutes, focus: st.focus, noWeigh: !!+st.noWeigh };
    const changed = !S.profile || ['exp', 'goal', 'freq', 'minutes', 'focus'].some((k) => S.profile[k] !== np[k]);
    S.profile = np; if (changed) { S.planStart = ymd(); S.done = 0; S.cur = null; S.swaps = {}; }
    if (!np.noWeigh && (!S.body.length || S.body[S.body.length - 1].w !== w)) { S.body = S.body.filter((b) => b.date !== ymd()); S.body.push({ date: ymd(), w }); }
    save(); tab = 'today'; render();
  };
  if (edit) $('#wBack').onclick = () => { tab = 'settings'; render(); };
}

// ── ② 오늘(첫 화면: 운동 1장 + 식단 1장) ──
function curDay(date) {
  const key = S.cur && S.cur.date === date ? S.cur.key : ENG.nextKey(D, S.profile, S.done);
  return ENG.buildDay(D, S.profile, key, { swaps: S.swaps[key], deload: ENG.deloadNow(S, date) });
}
function startCur(day, date) {
  const sets = {};
  for (const it of day.items) {
    const last = lastOf(it.id), pr = S.prog[it.id] || {};
    const w = pr.w ?? (last ? Math.max(...last.sets.map((x) => +x.w || 0)) : (D.exById[it.id].equipment === '맨몸' ? 0 : ''));
    const wd = day.deload && w ? Math.round(w * 0.9 * 2) / 2 : w;
    sets[it.id] = Array.from({ length: it.sets }, (_, k) => ({ w: wd, r: pr.r ?? last?.sets[k]?.r ?? it.reps.lo, done: false }));
  }
  S.cur = { date, key: day.key, sets, warm: [], cool: [], cardio: { sec: 0, done: false }, tired: false, finished: false };
  save();
}
function lastOf(id) { for (let i = S.sessions.length - 1; i >= 0; i--) { const s = S.sessions[i].ex[id]; if (s && s.length) return { date: S.sessions[i].date, sets: s }; } return null; }

function today(v) {
  const date = ymd(), p = S.profile, n = N(), train = ENG.isTrainDay(p, date);
  $('#sub').textContent = `${md(date)}(${DOW[new Date().getDay()]})`;
  if (S.cur && S.cur.date !== date && !S.cur.finished) S.cur = null;                     // 어제 못 끝낸 건 넘긴다(다음 순서부터)
  const day = curDay(date), started = S.cur && S.cur.date === date;
  let work;
  if (started && S.cur.finished) work = `<div class="card"><h2>오늘 운동 끝 👏</h2><p>${esc(day.name)} · 기록 저장됨</p><button id="reopen">기록 고치기</button></div>`;
  else if (!started && !train) work = `<div class="card"><h2>오늘은 쉬는 날</h2><p>${esc(D.rules.cardio[p.goal].rest_day)}</p><p class="hint">다음 순서: ${esc(day.name)}</p><button class="big" id="anyway">그래도 운동하기</button></div>`;
  else work = workoutCard(day, started);
  const meals = ENG.planWeekMeals(D, p, n, S.diet, date)[date], eaten = S.diet.eaten[date] || {};
  const got = Object.entries(meals).reduce((a, [sl, id]) => a + (eaten[sl] && D.mealById[id] ? D.mealById[id].protein_g : 0), 0);
  const kc = train ? n.kcal : n.restKcal;
  v.innerHTML = `${work}
   <div class="card" id="dietCard"><h2>오늘 식단 <span class="muted small">${train ? '운동일' : '쉬는 날'}</span></h2>
    <div class="row" style="justify-content:space-between;align-items:baseline"><b style="font-size:30px">${got}<span class="muted" style="font-size:18px"> / ${n.protein}g 단백질</span></b></div>
    <div class="prog" style="height:16px"><i style="width:${Math.min(100, Math.round(got / n.protein * 100))}%"></i></div>
    <p class="hint">칼로리 약 ${kc.toLocaleString()}kcal · 일주일의 80%만 맞추면 성공</p>
    ${Object.entries(meals).map(([sl, id]) => `<div class="check" data-sl="${sl}"><span class="box ${eaten[sl] ? 'done' : ''}">${eaten[sl] ? '✓' : ''}</span><span><b>${sl}</b> ${esc(D.mealById[id]?.name || '후보 없음')}</span></div>`).join('')}
    <button class="ghost" id="toDiet">식단 바꾸기 · 장보기 →</button></div>`;
  v.querySelectorAll('#dietCard .check').forEach((el) => el.onclick = () => { const sl = el.dataset.sl; S.diet.eaten[date] = { ...eaten, [sl]: !eaten[sl] }; save(); render(); });
  $('#toDiet').onclick = () => { tab = 'diet'; render(); };
  if ($('#anyway')) $('#anyway').onclick = () => { startCur(day, date); render(); };
  if ($('#reopen')) $('#reopen').onclick = () => { S.cur.finished = false; S.done = Math.max(0, S.done - 1); S.sessions = S.sessions.filter((s) => !(s.date === date && s.key === S.cur.key)); save(); render(); };
  if (started && !S.cur.finished || (!started && train)) bindWorkout(day, date);
}
function workoutCard(day, started) {
  const C = started ? S.cur : null;
  const list = (arr, key) => arr.map((t, i) => `<div class="check" data-l="${key}" data-i="${i}"><span class="box ${C && C[key].includes(i) ? 'done' : ''}">${C && C[key].includes(i) ? '✓' : ''}</span><span>${esc(t)}</span></div>`).join('');
  const exCard = (it) => {
    const ex = D.exById[it.id], last = lastOf(it.id), sets = C ? C.sets[it.id] : [], pr = S.prog[it.id] || {};
    const body = ex.equipment === '맨몸';
    return `<div class="card sub" data-ex="${it.id}" data-slot="${it.slot}"><h3>${esc(ex.name)} <span class="badge">${it.sets}×${repTxt(it.reps)}</span> <span class="hint">쉬기 ${it.rest}초</span></h3>
     <div class="hint">${last ? `지난번 ${md(last.date)} · ${last.sets.map((s) => (body ? '' : `${s.w}kg×`) + s.r).join(', ')}` : '첫 기록 — 편한 무게로 · 자세 먼저'}${pr.up ? ` · <span class="up">지난번 다 채움 → +${ENG.incFor(ex) || '2회'}${ENG.incFor(ex) ? 'kg' : ''}</span>` : ''}${pr.dropped ? ' · 3번 못 채워 −10%' : ''}</div>
     ${C ? sets.map((s, k) => `<div class="set"><span class="n">${k + 1}</span>
       ${body ? '<span class="muted small">맨몸</span>' : `<button class="val" data-f="w" data-k="${k}">${s.w === '' ? '무게' : s.w + 'kg'}</button>`}
       <button class="val" data-f="r" data-k="${k}">${s.r}${it.reps.sec ? '초' : '회'}</button>
       <button class="tick ${s.done ? 'done' : ''}" data-k="${k}" aria-label="${k + 1}세트 끝">${s.done ? '✓' : ''}</button></div>`).join('') : ''}
     <div class="row"><button class="small ghost" data-alt="1">대체 운동</button><a class="small" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.video_query)}" target="_blank" rel="noopener">자세 영상 검색</a></div></div>`;
  };
  const mm = C ? Math.floor(C.cardio.sec / 60) : 0, ss = C ? C.cardio.sec % 60 : 0;
  return `<div class="card"><h2>오늘 운동 · ${esc(day.name)}${day.deload ? ' <span class="badge">디로드 주</span>' : ''}</h2>
   ${C ? progressBar() : `<p class="hint">준비 5분 → 근력 ${day.items.length}개 → 유산소 ${day.cardio.minutes}분 → 정리</p><button class="primary big" id="start">시작</button>`}
   ${C ? `<h3>1. 준비운동</h3>${list(day.warmup, 'warm')}
   <h3>2. 근력</h3>${day.items.map(exCard).join('')}
   <h3>3. 유산소 · ${esc(day.cardio.type)} ${day.cardio.minutes}분${day.cardio.extra ? `(+${day.cardio.extra}분 가능하면)` : ''}</h3><p class="hint">${esc(day.cardio.detail)}</p>
   <div class="row"><b style="font-size:28px;font-variant-numeric:tabular-nums" id="cTime">${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}</b><button id="cGo" class="primary">${cardioRun ? '멈춤' : '시작'}</button><button id="cDone" class="${C.cardio.done ? 'primary' : ''}">${C.cardio.done ? '✓ 했어요' : '했어요'}</button></div>
   <h3>4. 정리 스트레칭</h3>${list(day.cooldown, 'cool')}
   <div class="check" id="tired"><span class="box ${C.tired ? 'done' : ''}">${C.tired ? '✓' : ''}</span><span>오늘 피곤했어요 <span class="hint">(한 주 3번이면 다음 주 디로드)</span></span></div>
   <button class="primary big" id="fin">운동 끝 — 기록 저장</button>` : `<p class="small muted">${day.items.map((it) => esc(exName(it.id))).join(' · ')}</p>`}</div>`;
}
function progressBar() { let t = 0, d = 0; for (const id in S.cur.sets) for (const s of S.cur.sets[id]) { t++; if (s.done) d++; } return `<div class="prog"><i style="width:${t ? Math.round(d / t * 100) : 0}%"></i></div><p class="hint">세트 ${d}/${t}</p>`; }
function bindWorkout(day, date) {
  if ($('#start')) { $('#start').onclick = () => { startCur(day, date); render(); }; return; }
  const C = S.cur;
  document.querySelectorAll('.check[data-l]').forEach((el) => el.onclick = () => { const a = C[el.dataset.l], i = +el.dataset.i; const k = a.indexOf(i); k < 0 ? a.push(i) : a.splice(k, 1); save(); render(); });
  document.querySelectorAll('[data-ex]').forEach((card) => {
    const id = card.dataset.ex, it = day.items.find((x) => x.id === id), ex = D.exById[id];
    card.querySelectorAll('button.val').forEach((b) => b.onclick = () => {
      const s = C.sets[id][+b.dataset.k], f = b.dataset.f;
      numpad(`${ex.name} ${+b.dataset.k + 1}세트 · ${f === 'w' ? '무게(kg)' : it.reps.sec ? '초' : '횟수'}`, s[f], f === 'w', (val) => {
        s[f] = val; if (f === 'w') C.sets[id].forEach((x, j) => { if (j > +b.dataset.k && !x.done) x.w = val; }); save(); render(); });
    });
    card.querySelectorAll('button.tick').forEach((b) => b.onclick = () => {
      const s = C.sets[id][+b.dataset.k];
      if (ex.equipment !== '맨몸' && (s.w === '' || isNaN(+s.w))) { alert('무게를 먼저 넣어 주세요'); return; }
      s.done = !s.done; save(); render(); if (s.done) restTimer(it.rest, `${ex.name} 쉬는 시간`);
    });
    card.querySelector('[data-alt]').onclick = () => {
      const alts = [ex.beginner_swap, ...(ex.alternatives || [])].filter((x, i, a) => x && a.indexOf(x) === i && x !== id);
      const base = D.exById[card.dataset.slot] ? card.dataset.slot : id;
      const pick = prompt(`바꿀 운동 번호를 고르세요\n${alts.map((a, i) => `${i + 1}. ${exName(a)}`).join('\n')}\n0. 원래 운동(${exName(base)})`, '1');
      if (pick == null) return; const k = parseInt(pick, 10); const to = k === 0 ? base : alts[k - 1]; if (!to) return;
      S.swaps[day.key] = { ...(S.swaps[day.key] || {}) }; if (to === base) delete S.swaps[day.key][card.dataset.slot]; else S.swaps[day.key][card.dataset.slot] = to;
      const nd = curDay(date); const old = C.sets; startCur(nd, date); for (const k2 in old) if (S.cur.sets[k2]) S.cur.sets[k2] = old[k2]; save(); render();
    };
  });
  $('#cGo').onclick = toggleCardio;
  $('#cDone').onclick = () => { C.cardio.done = !C.cardio.done; save(); render(); };
  $('#tired').onclick = () => { C.tired = !C.tired; save(); render(); };
  $('#fin').onclick = () => finish(day);
}
function finish(day) {
  const C = S.cur, ex = {};
  let fails = 0;
  for (const it of day.items) {
    const done = C.sets[it.id].filter((s) => s.done).map((s) => ({ w: +s.w || 0, r: +s.r || 0 }));
    if (done.length) { ex[it.id] = done; S.prog[it.id] = ENG.progress(D, S.prog, it, done); if (S.prog[it.id].fails) fails++; }
  }
  if (!Object.keys(ex).length && !C.cardio.done && !confirm('체크한 세트가 없어요. 그래도 끝낼까요?')) return;
  S.sessions = S.sessions.filter((s) => !(s.date === C.date && s.key === C.key));
  S.sessions.push({ date: C.date, key: C.key, name: day.name, ex, cardioMin: Math.round(C.cardio.sec / 60) || (C.cardio.done ? day.cardio.minutes : 0), tired: C.tired, deload: day.deload });
  S.done += 1; C.finished = true; stopCardio();
  const wk = mondayOf(C.date), wkS = S.sessions.filter((s) => s.date >= wk);                // 디로드 앞당김: 못 채움 2개 이상 · 피곤함 3번
  const failEx = Object.keys(S.prog).filter((id) => S.prog[id].fails && wkS.some((s) => s.ex[id])).length;
  if (failEx >= 2 || wkS.filter((s) => s.tired).length >= 3) S.earlyDeloadWeek = addDays(wk, 7);
  save(); render();
}

// ── 유산소 · 쉬는 시간 · 숫자 패드 ──
let cardioRun = null;
function toggleCardio() { if (cardioRun) stopCardio(); else { const st = Date.now() - S.cur.cardio.sec * 1000; cardioRun = setInterval(() => { S.cur.cardio.sec = Math.floor((Date.now() - st) / 1000); const t = $('#cTime'); if (t) t.textContent = `${String(Math.floor(S.cur.cardio.sec / 60)).padStart(2, '0')}:${String(S.cur.cardio.sec % 60).padStart(2, '0')}`; }, 500); } render(); }
function stopCardio() { if (cardioRun) clearInterval(cardioRun); cardioRun = null; if (S.cur) save(); }
let restT = null, AC = null;
function restTimer(sec, label) {
  const box = $('#timer'); let end = Date.now() + sec * 1000; box.hidden = false; $('#tLabel').textContent = label;
  const close = () => { clearInterval(restT); restT = null; box.hidden = true; };
  const tick = () => { const left = Math.max(0, Math.round((end - Date.now()) / 1000)); $('#tNum').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; if (left <= 0) { close(); buzz(); } };
  clearInterval(restT); restT = setInterval(tick, 250); tick();
  $('#tMinus').onclick = () => { end -= 15000; tick(); }; $('#tPlus').onclick = () => { end += 15000; tick(); }; $('#tSkip').onclick = close;
}
function buzz() {
  try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch (e) {}
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + 0.35); } catch (e) {}
}
function numpad(label, val, dec, cb) {
  const box = $('#pad'); let s = val === '' || val == null ? '' : String(val); box.hidden = false; $('#pLabel').textContent = label;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', dec ? '.' : '', '0', '⌫'];
  const grid = $('.pgrid', box); grid.innerHTML = keys.map((k) => `<button ${k ? '' : 'disabled style="visibility:hidden"'} data-k="${k}">${k}</button>`).join('') + '<button class="primary" data-k="ok">확인</button>';
  const show = () => { $('#pVal').textContent = s || '0'; }; show();
  grid.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k;
    if (k === 'ok') { box.hidden = true; if (s !== '') cb(dec ? Math.round(parseFloat(s) * 100) / 100 : parseInt(s, 10)); return; }
    if (k === '⌫') s = s.slice(0, -1); else if (k === '.') { if (!s.includes('.')) s = (s || '0') + '.'; } else if (s.length < 6) s = s === '0' ? k : s + k; show(); };
  box.onclick = (e) => { if (e.target === box) box.hidden = true; };
}

// ── ③ 기록: 한눈에 보기(체중 · BMI · 주간 횟수 · 주요 운동 · 볼륨 · 유산소 · 식단) ──
let period = '1m';
function log(v) {
  $('#sub').textContent = '기록';
  const now = ymd(), from = period === '1m' ? addDays(now, -30) : period === '3m' ? addDays(now, -91) : '0000';
  const sess = S.sessions.filter((s) => s.date >= from), p = S.profile;
  const weeks = []; { let m = mondayOf(from === '0000' ? (S.sessions[0]?.date || S.planStart || now) : from); while (m <= now) { weeks.push(m); m = addDays(m, 7); } }
  const wkOf = (d) => mondayOf(d);
  const span = sess.length ? (new Date(now) - new Date(sess[0].date)) / 864e5 : 0;
  const few = (pts) => pts.length < 2;
  // ① 체중 주간 평균 · 시작 대비
  const bodySrc = p.noWeigh ? S.waist : S.body, unit = p.noWeigh ? 'cm' : 'kg';
  const wb = weeks.map((w) => { const x = bodySrc.filter((b) => wkOf(b.date) === w && b.date >= from); return x.length ? { x: w, y: Math.round(x.reduce((a, b) => a + b.w, 0) / x.length * 10) / 10 } : null; }).filter(Boolean);
  const first = bodySrc[0]?.w, lastB = bodySrc[bodySrc.length - 1]?.w;
  // ② BMI
  const bmiPts = p.noWeigh ? [] : wb.map((pt) => ({ x: pt.x, y: Math.round(ENG.bmi({ height: p.height, weight: pt.y }) * 10) / 10 }));
  // ③ 주간 운동 횟수 · ⑤ 볼륨 · ⑥ 유산소 누적 · ⑦ 식단 달성
  const wkCount = weeks.map((w) => ({ x: w, y: S.sessions.filter((s) => wkOf(s.date) === w).length }));
  const vol = weeks.map((w) => ({ x: w, y: S.sessions.filter((s) => wkOf(s.date) === w).reduce((a, s) => a + Object.values(s.ex).flat().reduce((b, t) => b + (t.w || 0) * (t.r || 0), 0), 0) }));
  let cum = 0; const cardio = weeks.map((w) => { cum += S.sessions.filter((s) => wkOf(s.date) === w).reduce((a, s) => a + (s.cardioMin || 0), 0); return { x: w, y: cum }; });
  const dietPct = weeks.map((w) => { let plan = 0, ate = 0; for (let i = 0; i < 7; i++) { const d = addDays(w, i); if (d > now) break; const e = S.diet.eaten[d] || {}; const train = ENG.isTrainDay(p, d); plan += Object.keys(D.meals.slot_ratio[train ? '운동일' : '쉬는날']).length; ate += Object.values(e).filter(Boolean).length; } return { x: w, y: plan ? Math.round(ate / plan * 100) : 0 }; });
  const key = S.keyEx.map((id) => ({ id, pts: sess.filter((s) => s.ex[id]).map((s) => ({ x: s.date, y: Math.max(...s.ex[id].map((t) => t.w)) })) }));
  const need = '<p class="hint">2주 쌓이면 보여요</p>';
  const diffTxt = first != null && lastB != null ? `${lastB - first >= 0 ? '+' : ''}${Math.round((lastB - first) * 10) / 10}${unit} (시작 대비)` : '';
  v.innerHTML = `<div class="card"><h2>한눈에 보기</h2><div class="chips" id="per">${[['1m', '1개월'], ['3m', '3개월'], ['all', '전체']].map(([k, t]) => `<button data-v="${k}" class="${period === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
   <div class="card"><h2>${p.noWeigh ? '허리둘레' : '체중'} <span class="hint">주간 평균 · ${esc(diffTxt)}</span></h2>${few(wb) ? need : svgChart(wb, { unit })}
     <div class="row"><input id="bW" inputmode="decimal" placeholder="오늘 ${p.noWeigh ? '허리둘레(cm)' : '체중(kg)'}" style="flex:1"><button class="primary" id="bAdd">기록</button></div></div>
   ${p.noWeigh ? '' : `<div class="card"><h2>BMI</h2>${few(bmiPts) ? need : svgChart(bmiPts, { unit: '' })}</div>`}
   <div class="card"><h2>주간 운동 <span class="hint">목표 주 ${p.freq}회</span></h2>${weeks.length < 2 && span < 14 ? need : svgBars(wkCount, { goal: p.freq, unit: '회' })}</div>
   ${key.map((k) => `<div class="card"><h2>${esc(exName(k.id))} <span class="hint">최고 무게</span></h2>${few(k.pts) ? need : svgChart(k.pts, { unit: 'kg' })}</div>`).join('')}
   <div class="card"><h2>주간 총 볼륨 <span class="hint">세트×횟수×무게</span></h2>${vol.filter((x) => x.y).length < 2 ? need : svgBars(vol, { unit: 'kg' })}</div>
   <div class="card"><h2>유산소 누적</h2>${cum ? svgChart(cardio, { unit: '분' }) : need}</div>
   <div class="card"><h2>식단 달성률 <span class="hint">체크한 끼니 %</span></h2>${dietPct.filter((x) => x.y).length < 1 || weeks.length < 2 ? need : svgBars(dietPct, { unit: '%', goal: 80 })}</div>
   <div class="card"><h2>지난 운동</h2>${S.sessions.slice(-8).reverse().map((s) => `<p class="small">${md(s.date)} · ${esc(s.name)} · ${Object.keys(s.ex).length}종목${s.cardioMin ? ` · 유산소 ${s.cardioMin}분` : ''}${s.deload ? ' · 디로드' : ''}</p>`).join('') || '<p class="muted">아직 없어요</p>'}</div>`;
  $('#per').onclick = (e) => { const b = e.target.closest('button'); if (b) { period = b.dataset.v; render(); } };
  $('#bAdd').onclick = () => { const w = parseFloat($('#bW').value); if (!(w > 25 && w < 250)) return; const arr = p.noWeigh ? S.waist : S.body; const k = arr.findIndex((b) => b.date === ymd()); if (k >= 0) arr.splice(k, 1); arr.push({ date: ymd(), w }); if (!p.noWeigh) S.profile.weight = w; save(); render(); };
  bindCharts(v);
}
// 가벼운 SVG 그래프(외부 라이브러리 없음) — 점을 누르면 값이 뜬다
function svgChart(pts, o = {}) {
  const W = 320, H = 140, L = 34, Rr = 10, T = 12, B = 22, ys = pts.map((p) => p.y), lo = Math.min(...ys), hi = Math.max(...ys), pd = (hi - lo) * 0.15 || Math.max(1, Math.abs(hi) * 0.05);
  const y0 = lo - pd, y1 = hi + pd, X = (i) => L + (pts.length === 1 ? (W - L - Rr) / 2 : i * (W - L - Rr) / (pts.length - 1)), Y = (y) => H - B - (y - y0) / (y1 - y0) * (H - T - B);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"><line x1="${L}" y1="${Y(hi)}" x2="${W - Rr}" y2="${Y(hi)}" class="gl"/><line x1="${L}" y1="${Y(lo)}" x2="${W - Rr}" y2="${Y(lo)}" class="gl"/>
   <text x="2" y="${Y(hi) + 4}" class="ax">${hi}</text><text x="2" y="${Y(lo) + 4}" class="ax">${lo}</text><path d="${path}" class="ln"/>
   ${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.y)}" r="9" class="hit" data-t="${md(p.x)} · ${p.y}${o.unit || ''}"/><circle cx="${X(i)}" cy="${Y(p.y)}" r="3.5" class="dot"/>`).join('')}
   <text x="${L}" y="${H - 6}" class="ax">${md(pts[0].x)}</text><text x="${W - Rr}" y="${H - 6}" class="ax" text-anchor="end">${md(pts[pts.length - 1].x)}</text></svg><p class="tip hint">점을 누르면 값이 보여요</p>`;
}
function svgBars(pts, o = {}) {
  const W = 320, H = 140, L = 30, T = 12, B = 22, mx = Math.max(o.goal || 0, ...pts.map((p) => p.y)) || 1, bw = (W - L - 6) / pts.length;
  const Y = (y) => H - B - y / mx * (H - T - B);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${o.goal ? `<line x1="${L}" y1="${Y(o.goal)}" x2="${W - 4}" y2="${Y(o.goal)}" class="goal"/><text x="2" y="${Y(o.goal) + 4}" class="ax">${o.goal}</text>` : `<text x="2" y="${T + 4}" class="ax">${Math.round(mx)}</text>`}
   ${pts.map((p, i) => `<rect x="${L + i * bw + 2}" y="${Y(p.y)}" width="${Math.max(3, bw - 4)}" height="${H - B - Y(p.y)}" class="${o.goal && p.y >= o.goal ? 'bar ok' : 'bar'}"/><rect x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" class="hit" data-t="${md(p.x)}주 · ${Math.round(p.y).toLocaleString()}${o.unit || ''}"/>`).join('')}
   <text x="${L}" y="${H - 6}" class="ax">${md(pts[0].x)}</text><text x="${W - 4}" y="${H - 6}" class="ax" text-anchor="end">${md(pts[pts.length - 1].x)}</text></svg><p class="tip hint">막대를 누르면 값이 보여요</p>`;
}
function bindCharts(v) { v.querySelectorAll('svg.chart').forEach((svg) => svg.addEventListener('click', (e) => { const h = e.target.closest('.hit'); if (!h) return; const tip = svg.nextElementSibling; tip.textContent = h.dataset.t; tip.classList.add('on'); })); }

// ── ④ 식단 ──
function diet(v) {
  const date = ymd(), p = S.profile, n = N(), week = ENG.planWeekMeals(D, p, n, S.diet, date), eaten = S.diet.eaten[date] || {};
  $('#sub').textContent = '식단';
  const shop = ENG.shopping(D, week, S.diet.have);
  v.innerHTML = `<div class="card"><h2>오늘 <span class="hint">단백질 ${n.protein}g · ${ENG.isTrainDay(p, date) ? n.kcal : n.restKcal}kcal · 지방 ${n.fat}g · 탄수 ${n.carb}g</span></h2>
   <div class="chips" id="mode">${['기본', '집밥만', '외식만', '편의점 허용'].map((m) => `<button data-v="${m}" class="${S.diet.mode === m ? 'on' : ''}">${m}</button>`).join('')}</div>
   ${Object.entries(week[date]).map(([sl, id]) => { const m = D.mealById[id]; return `<div class="meal" data-s="${sl}" data-id="${id || ''}"><span class="box ${eaten[sl] ? 'done' : ''}" data-a="eat">${eaten[sl] ? '✓' : ''}</span>
     <div><b>${sl}</b> <span class="hint">${m ? `${m.protein_g}g · ${m.kcal}kcal · ${esc(m.kind)}` : ''}</span><div>${m ? esc(m.name) : '<span class="muted">후보가 없어요</span>'}</div></div>
     <div class="col"><button class="small" data-a="next">다른 것</button><button class="small danger" data-a="no">싫어요</button>${m && m.tags.length ? `<button class="small ghost" data-a="tag">재료 싫어요</button>` : ''}</div></div>`; }).join('')}</div>
   <div class="card"><h2>이번 주 장보기 <span class="hint">월~일 · 집밥 · 간편</span></h2>${shop.map((s) => `<div class="check" data-have="${esc(s.item)}"><span class="box"></span><span>${esc(s.item)} <span class="muted">${esc(s.txt)}</span></span></div>`).join('') || '<p class="muted">없음</p>'}
    ${S.diet.have.length ? `<p class="hint">집에 있음으로 숨김: ${S.diet.have.map(esc).join(', ')} <button class="small ghost" id="unhave">다시 보기</button></p>` : '<p class="hint">이미 집에 있는 건 눌러서 숨기세요</p>'}</div>`;
  $('#mode').onclick = (e) => { const b = e.target.closest('button'); if (b) { S.diet.mode = b.dataset.v; save(); render(); } };
  v.querySelectorAll('.meal').forEach((row) => row.onclick = (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; const sl = row.dataset.s, id = row.dataset.id, m = D.mealById[id];
    if (a === 'eat') S.diet.eaten[date] = { ...eaten, [sl]: !eaten[sl] };
    else if (a === 'tag' && m) { const t = prompt(`이 재료 전부 빼기: ${m.tags.join(', ')}\n뺄 재료 이름을 적어 주세요`, m.tags[0]); if (!t || !m.tags.includes(t.trim())) return; if (!S.diet.noTags.includes(t.trim())) S.diet.noTags.push(t.trim()); }
    else { if (a === 'no' && id && !S.diet.noIds.includes(id)) S.diet.noIds.push(id);
      const nx = ENG.nextCandidate(D, p, n, S.diet, date, sl, id); S.diet.swap[date] = { ...(S.diet.swap[date] || {}), [sl]: nx }; }
    save(); render();
  });
  v.querySelectorAll('[data-have]').forEach((el) => el.onclick = () => { S.diet.have.push(el.dataset.have); save(); render(); });
  if ($('#unhave')) $('#unhave').onclick = () => { S.diet.have = []; save(); render(); };
}

// ── ⑤ 설정 ──
function settings(v) {
  const p = S.profile, n = N();
  $('#sub').textContent = '설정';
  const seq = ENG.sequence(D, p);
  v.innerHTML = `<div class="card"><h2>내 숫자</h2><p>키 ${p.height}cm · 체중 ${p.weight}kg · ${p.age}세</p><p><span class="bmi">BMI ${n.bmi}</span> <span class="badge">${esc(n.band)}</span></p>
    <p class="small">기초대사 ${n.bmr.toLocaleString()} · 유지 ${n.keep.toLocaleString()} · 운동일 ${n.kcal.toLocaleString()}kcal · 쉬는 날 ${n.restKcal.toLocaleString()}kcal<br>단백질 ${n.protein}g · 지방 ${n.fat}g · 탄수 ${n.carb}g</p>
    <p class="muted small">${esc(p.goal)} · 주 ${p.freq}회 · ${p.minutes}분 · ${esc(p.exp)} · ${esc(p.focus)}</p><button class="big" id="sEdit">정보 고치고 다시 짜기</button></div>
   <div class="card"><h2>내 순서 <span class="hint">놓친 날은 메꾸지 않고 다음 순서부터</span></h2>${[...new Set(seq)].map((k) => { const d = ENG.buildDay(D, p, k, { swaps: S.swaps[k] }); return `<p class="small"><b>${esc(d.name)}</b> — ${d.items.map((it) => esc(exName(it.id))).join(' · ')}</p>`; }).join('')}
    <label>디로드 주기</label><div class="chips" id="sDel">${[4, 5, 6].map((w) => `<button data-v="${w}" class="${S.deloadEvery === w ? 'on' : ''}">${w}주마다</button>`).join('')}</div></div>
   <div class="card"><h2>한눈에 보기 운동 3개</h2>${[0, 1, 2].map((i) => `<select data-ke="${i}">${D.exercises.exercises.filter((e) => e.equipment !== '맨몸').map((e) => `<option value="${e.id}" ${S.keyEx[i] === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>`).join('')}</div>
   <div class="card"><h2>화면</h2><div class="chips" id="sTheme">${[['auto', '폰 설정 따라'], ['light', '밝게'], ['dark', '어둡게']].map(([k, t]) => `<button data-v="${k}" class="${(S.theme || 'auto') === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
   <div class="card"><h2>싫어요</h2>${S.diet.noIds.map((id) => `<div class="row" style="justify-content:space-between"><span class="small">${esc(D.mealById[id]?.name || id)}</span><button class="small" data-un="${esc(id)}">다시 보기</button></div>`).join('')}
    ${S.diet.noTags.map((t) => `<div class="row" style="justify-content:space-between"><span class="small">재료: ${esc(t)}</span><button class="small" data-ut="${esc(t)}">다시 보기</button></div>`).join('') || ''}${!S.diet.noIds.length && !S.diet.noTags.length ? '<p class="muted">없음</p>' : ''}</div>
   <div class="card"><h2>폰 바꿀 때</h2><p class="hint">기록은 이 폰 안에만 있어요(서버에 올라가지 않아요). 새 폰에서는 내보낸 파일을 불러오세요.</p>
    <div class="row"><button id="sOut">JSON 내보내기</button><button id="sIn">JSON 불러오기</button><input type="file" id="sFile" accept=".json,application/json" hidden></div></div>
   <div class="card"><p class="hint">${esc(D.rules.disclaimer)}</p><button class="big danger" id="sWipe">전부 지우기</button></div>`;
  $('#sEdit').onclick = () => wizard($('#view'), true);
  $('#sDel').onclick = (e) => { const b = e.target.closest('button'); if (b) { S.deloadEvery = +b.dataset.v; save(); render(); } };
  v.querySelectorAll('[data-ke]').forEach((s) => s.onchange = () => { S.keyEx[+s.dataset.ke] = s.value; save(); });
  $('#sTheme').onclick = (e) => { const b = e.target.closest('button'); if (b) { S.theme = b.dataset.v; save(); render(); } };
  v.querySelectorAll('[data-un]').forEach((b) => b.onclick = () => { S.diet.noIds = S.diet.noIds.filter((x) => x !== b.dataset.un); save(); render(); });
  v.querySelectorAll('[data-ut]').forEach((b) => b.onclick = () => { S.diet.noTags = S.diet.noTags.filter((x) => x !== b.dataset.ut); save(); render(); });
  $('#sOut').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' })); a.download = `헬스스튜디오_${ymd()}.json`; document.body.appendChild(a); a.click(); a.remove(); };
  $('#sIn').onclick = () => $('#sFile').click();
  $('#sFile').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const d = JSON.parse(await f.text()); if (d.v !== 2 || !Array.isArray(d.sessions)) throw 0; if (!confirm('지금 기록을 이 파일 내용으로 바꿀까요?')) return; S = { ...blank(), ...d }; save(); render(); } catch (err) { alert('이 앱에서 내보낸 파일이 아니에요'); } };
  $('#sWipe').onclick = () => { if (confirm('모든 기록과 설정을 지울까요? 되돌릴 수 없어요') && confirm('정말 지울까요?')) { localStorage.removeItem(KEY); S = blank(); S.diet.noTags = [...D.meals.default_disliked_tags]; tab = 'today'; render(); } };
}

// ── 시작 ──
document.getElementById('tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.tab; render(); window.scrollTo(0, 0); });
async function boot() {
  const get = (n) => fetch(`data/${n}.json`).then((r) => { if (!r.ok) throw new Error(n); return r.json(); });
  try { const [rules, exercises, programs, warmups, meals] = await Promise.all(['rules', 'exercises', 'programs', 'warmups', 'meals'].map(get)); D = { rules, exercises, programs, warmups, meals }; }
  catch (e) { $('#view').innerHTML = '<div class="card"><h2>처음 한 번은 인터넷이 필요해요</h2><p class="muted">연결된 뒤 다시 열면 그다음부터는 인터넷 없이도 열립니다.</p></div>'; return; }
  D.exById = Object.fromEntries(D.exercises.exercises.map((e) => [e.id, e])); D.mealById = Object.fromEntries(D.meals.meals.map((m) => [m.id, m]));
  load(); render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
