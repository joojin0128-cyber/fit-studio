/* 전신 밀기 · 당기기(PT 추천 · 4주) 안내 · 뱃살 목표(걷기 · 주 1회 허리둘레) · 내 기록 보내기 — 기록은 폰 안, 보내기는 사용자가 눌렀을 때만 */
'use strict';
const PRESET = 'ppl4';
const presetOf = () => (S.profile && S.profile.preset && D.programs.presets ? D.programs.presets[S.profile.preset] : null);
function usePreset(on, date) {
  S.profile.preset = on ? PRESET : null; S.planStart = date; S.done = 0; S.swaps = {};
  if (!S.cur || S.cur.finished || !hasData(S.cur)) S.cur = null;
  save(); render(); window.scrollTo(0, 0);
}
function planCards(date, o = {}) {
  const p = S.profile, PR = presetOf(), all = D.programs.presets && D.programs.presets[PRESET], out = [];
  if (!o.bellyOnly && !PR && all && !S.pplOffer) out.push(`<div class="card" id="pplOffer"><h2>PT 추천 프로그램</h2><p><b>${esc(all.name)}</b></p>
    <p class="small">전신 밀기 → 전신 당기기 번갈아 반복 · 한 번에 ${esc(all.session_min)}분(준비 5 → 근력 → 복근 10 → 경사 걷기 15~20 → 정리 5) · 빠진 날은 다음 차례부터</p>
    <div class="row"><button class="primary" id="pplOn">이걸로 바꾸기</button><button id="pplLater">나중에</button></div></div>`);
  if (!o.bellyOnly && PR) { const wk = planWeek(date);
    if (wk >= (PR.length_weeks || 4) && !(S.pplHold && date < S.pplHold)) out.push(`<div class="card" id="pplEnd"><h2>${PR.length_weeks || 4}주 끝났어요 👏</h2><p class="small">자세가 익었으면 원래 분할(주 ${p.freq}회)로 넘어가 볼까요? 더 하고 싶으면 2주 더 해도 돼요.</p>
      <div class="row"><button class="primary" id="pplOff">원래 분할로</button><button id="pplMore">2주 더</button></div></div>`); }
  if (p.belly) { const last = S.waist[S.waist.length - 1], due = !last || (new Date(date + 'T12:00') - new Date(last.date + 'T12:00')) / 864e5 >= 7;
    out.push(`<div class="card sub" id="bellyCard"><p class="small">🚶 오늘 걷기 <b>8,000보</b> · 배는 복근 운동만으로 안 빠지고 <b>전체 체지방이 빠져야</b> 줄어들어요</p>
     ${due ? `<div class="row"><input id="waistIn" inputmode="decimal" placeholder="이번 주 허리둘레(cm) — 배꼽 높이 · 아침" style="flex:1"><button class="primary" id="waistAdd">기록</button></div>` : `<p class="hint">허리둘레 ${last.w}cm(${md(last.date)}) · 다음 측정 ${md(addDays(last.date, 7))}</p>`}</div>`); }
  return out.join('');
}
function bindPlan(v, date) {
  if ($('#pplOn')) $('#pplOn').onclick = () => usePreset(true, date);
  if ($('#pplLater')) $('#pplLater').onclick = () => { S.pplOffer = 'later'; save(); render(); };
  if ($('#pplOff')) $('#pplOff').onclick = () => usePreset(false, date);
  if ($('#pplMore')) $('#pplMore').onclick = () => { S.pplHold = addDays(date, 14); save(); render(); };
  if ($('#waistAdd')) $('#waistAdd').onclick = () => { const w = parseFloat($('#waistIn').value); if (!(w > 40 && w < 200)) { alert('허리둘레를 cm 로 넣어 주세요(예: 92)'); return; }
    S.waist = S.waist.filter((x) => x.date !== date); S.waist.push({ date, w }); S.waist.sort((a, b) => a.date.localeCompare(b.date)); save(); render(); };
}
// 설정 — 프로그램 · 내 기록 보내기
function planSettings() {
  const PR = presetOf(), all = D.programs.presets && D.programs.presets[PRESET], wk = planWeek(today0());
  if (isFixed() && D.fixed) { const fx = FXS(); return `<div class="card"><h2>운동 요일 <span class="hint">3개 고르기</span></h2><div class="chips" id="sWd">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button data-v="${d}" class="${fx.weekdays.includes(d) ? 'on' : ''}">${DOW[d]}</button>`).join('')}</div><p class="hint">운동 안 하는 날은 걷기 30분(일요일은 쉼). 밀기 · 당기기는 주마다 번갈아요</p></div>${exportCard()}`; }
  return `${isFixed() ? '' : `<div class="card"><h2>프로그램</h2>${PR ? `<p><b>${esc(PR.name)}</b> <span class="badge">${wk + 1}주째</span></p><p class="hint">${esc(PR.note)}</p><button id="sPplOff">원래 분할(주 ${S.profile.freq}회)로</button>`
    : `<p class="small">지금: 기본 분할(주 ${S.profile.freq}회)</p>${all ? `<button id="sPplOn">${esc(all.name)}로 바꾸기</button>` : ''}`}</div>`}
   ${exportCard()}`;
}
function exportCard() {
  return `<div class="card"><h2>내 기록 보내기</h2><p class="hint">인바디 · 운동 · 식사 · 몸 기록을 파일(JSON)로 만들어요. 텔레그램이나 스튜디오에 붙여 넣으면 같이 봐 드릴 수 있어요. 누를 때만 만들어지고, 저절로 보내지 않아요.</p>
    <div class="row"><button class="primary" id="sShare">공유하기</button><button id="sCopy">복사하기</button></div><textarea id="sDump" hidden readonly style="width:100%;height:120px;font-size:12px"></textarea></div>`;
}
function exportData() {
  const since = addDays(today0(), -60), f30 = addDays(today0(), -30), p = S.profile, n = N();
  return { app: '헬스 스튜디오', made: new Date().toISOString(), profile: { height: p.height, weight: p.weight, age: p.age, sex: p.sex, exp: p.exp, goal: p.goal, belly: !!p.belly, freq: p.freq, minutes: p.minutes, preset: p.preset || null, planStart: S.planStart, week: planWeek(today0()) + 1 },
    numbers: { kcal: n.kcal, restKcal: n.restKcal, protein: n.protein, bmr: n.bmr, src: n.src },
    inbody: S.inbody, body: S.body.filter((b) => b.date >= since), waist: S.waist,
    sessions: S.sessions.filter((x) => x.date >= since).map((x) => ({ date: x.date, name: x.name, cardioMin: x.cardioMin, ex: Object.fromEntries(Object.entries(x.ex).map(([id, sets]) => [exName(id), sets.map((t) => `${t.w || 0}kg×${t.r}`).join(', ')])) })),
    food: Object.fromEntries(Object.entries(S.food.log).filter(([d]) => d >= f30).map(([d, l]) => [d, { total: (() => { const t = ENG.foodTotals(l); return { kcal: Math.round(t.kcal), protein: Math.round(t.protein) }; })(), items: l.map((e) => `${e.slot} ${e.name}${e.qty !== 1 ? '×' + e.qty : ''}`) }])),
    choices: S.food.choice };
}
function bindPlanSettings() {
  if ($('#sWd')) $('#sWd').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const fx = FXS(), d = +b.dataset.v;
    if (fx.weekdays.includes(d)) fx.weekdays = fx.weekdays.filter((x) => x !== d); else if (fx.weekdays.length < 3) fx.weekdays.push(d); else { alert('3개까지예요 — 하나를 먼저 끄세요'); return; }
    if (fx.weekdays.length === 3) save(); render(); };
  if ($('#sPplOn')) $('#sPplOn').onclick = () => { tab = 'today'; usePreset(true, today0()); };
  if ($('#sPplOff')) $('#sPplOff').onclick = () => { if (confirm('원래 분할로 바꿀까요? 순서가 처음부터 시작해요')) { tab = 'today'; usePreset(false, today0()); } };
  const txt = () => JSON.stringify(exportData(), null, 1), name = `헬스기록_${ymd().replace(/-/g, '').slice(2)}.json`;
  const showDump = (t) => { const a = $('#sDump'); a.hidden = false; a.value = t; a.focus(); a.select(); };
  $('#sCopy').onclick = async () => { const t = txt(); try { await navigator.clipboard.writeText(t); alert('복사했어요 — 텔레그램이나 스튜디오에 붙여 넣으세요'); } catch (e) { showDump(t); alert('아래 칸을 길게 눌러 전체 선택 → 복사해 주세요'); } };
  $('#sShare').onclick = async () => { const t = txt(), file = new File([t], name, { type: 'application/json' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: '헬스 기록' }); else if (navigator.share) await navigator.share({ title: '헬스 기록', text: t }); else { $('#sCopy').click(); } }
    catch (e) { if (e && e.name !== 'AbortError') showDump(t); } };
}
