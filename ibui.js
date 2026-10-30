/* 인바디 사진 → 숫자 — 사진은 이 화면 안에서만 쓰고 버린다(저장하는 건 숫자 · 칸 위치뿐). 글자 읽기는 동봉한 Tesseract.js(기기 안). */
'use strict';
const IBF = ['weight', 'smm', 'bfm', 'pbf', 'bmi', 'bmr', 'ffm', 'ra', 'la', 'tr', 'rl', 'll', 'score'];
const IBP = ['raP', 'laP', 'trP', 'rlP', 'llP'];
const absUrl = (p) => new URL(p, location.href).href;
let IBX = null, wizManual = false;   // 지금 흐름의 임시 상태(사진 캔버스 · 읽은 낱말) — 저장 · 취소하면 비운다
const lastIb = () => (S.inbody && S.inbody.length ? S.inbody[S.inbody.length - 1] : null);

function loadTess() {
  if (self.Tesseract) return Promise.resolve(self.Tesseract);
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'vendor/tesseract/tesseract.min.js'; s.onload = () => ok(self.Tesseract); s.onerror = () => no(new Error('글자 읽기 도구를 못 받았어요 — 처음 한 번은 인터넷이 필요해요')); document.head.appendChild(s); });
}

// ① 사진 고르기
function ibStart(mode, v = $('#view')) {
  IBX = { mode };
  $('#sub').textContent = '인바디';
  v.innerHTML = `<div class="card"><h2>인바디 결과지 사진</h2>
   <p class="hint">결과지를 평평한 곳에 두고, 그늘 없이, 네 모서리가 다 보이게 위에서 찍어 주세요. 사진은 숫자를 읽은 뒤 버리고 숫자만 이 폰에 저장해요.</p>
   <input type="file" id="ibCam" accept="image/*" capture="environment" hidden><input type="file" id="ibPick" accept="image/*" hidden>
   <button class="primary big" id="ibCamB">사진 찍기</button><button class="big" id="ibPickB">앨범에서 고르기</button>
   <button class="ghost big" id="ibHand">숫자 직접 넣기</button><button class="ghost big" id="ibBack">${mode === 'wizard' ? '키·체중으로 시작' : '취소'}</button></div>`;
  $('#ibCamB').onclick = () => $('#ibCam').click(); $('#ibPickB').onclick = () => $('#ibPick').click();
  const got = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) ibCrop(f); };
  $('#ibCam').onchange = got; $('#ibPick').onchange = got;
  $('#ibHand').onclick = () => ibConfirm({ v: {}, how: {}, doubt: {}, box: {} });
  $('#ibBack').onclick = () => { IBX = null; if (mode === 'wizard') { wizManual = true; wizard($('#view')); } else { render(); } };
}

// ② 테두리 · 기울기 맞추기 — 모서리 4개를 끌고, 기울기 막대로 결과지 줄을 격자에 맞춘다
async function ibCrop(file) {
  const url = URL.createObjectURL(file), img = new Image();
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; }).catch(() => null);
  if (!img.naturalWidth) { alert('사진을 열 수 없어요'); return; }
  IBX.img = img; IBX.url = url; IBX.rot = 0; IBX.ang = 0;
  const v = $('#view');
  v.innerHTML = `<div class="card"><h2>테두리 · 기울기 맞추기</h2><p class="hint">네 모서리를 끌어 결과지 테두리에 맞추고, 아래 막대로 글줄이 격자와 나란하게 돌려 주세요</p>
   <div style="position:relative;touch-action:none"><canvas id="ibC" style="width:100%;height:auto;display:block;border-radius:10px;background:#000"></canvas></div>
   <label>기울기 <b id="ibAngT">0°</b></label><input type="range" id="ibAng" min="-15" max="15" step="0.5" value="0">
   <div class="row"><button id="ibRot">90° 돌리기</button><button id="ibReset">처음대로</button></div>
   <button class="primary big" id="ibGo">이대로 읽기</button><button class="ghost big" id="ibAgain">다른 사진</button></div>`;
  const c = $('#ibC'), ctx = c.getContext('2d');
  const geo = () => { const r = IBX.rot % 2, iw = r ? img.naturalHeight : img.naturalWidth, ih = r ? img.naturalWidth : img.naturalHeight; const sc = Math.min(1, 1100 / Math.max(iw, ih)); return { iw, ih, sc, cw: Math.round(iw * sc), ch: Math.round(ih * sc) }; };
  const reset = () => { const g = geo(); c.width = g.cw; c.height = g.ch; const m = 0.015; IBX.q = { x0: g.cw * m, y0: g.ch * m, x1: g.cw * (1 - m), y1: g.ch * (1 - m) }; draw(); };
  function paint(cx, W, H) {   // 돌린 원본을 W×H 캔버스에 그린다
    cx.save(); cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H); cx.translate(W / 2, H / 2); cx.rotate((IBX.rot * 90 + IBX.ang) * Math.PI / 180);
    const r = IBX.rot % 2, dw = r ? H : W, dh = r ? W : H; cx.drawImage(img, -dw / 2, -dh / 2, dw, dh); cx.restore();
  }
  function draw() {
    const q = IBX.q; paint(ctx, c.width, c.height);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, c.width, q.y0); ctx.fillRect(0, q.y1, c.width, c.height - q.y1); ctx.fillRect(0, q.y0, q.x0, q.y1 - q.y0); ctx.fillRect(q.x1, q.y0, c.width - q.x1, q.y1 - q.y0);
    ctx.strokeStyle = 'rgba(47,111,237,.9)'; ctx.lineWidth = 2; ctx.strokeRect(q.x0, q.y0, q.x1 - q.x0, q.y1 - q.y0);
    ctx.strokeStyle = 'rgba(47,111,237,.35)'; ctx.lineWidth = 1;
    for (let i = 1; i < 12; i++) { const y = q.y0 + (q.y1 - q.y0) * i / 12; ctx.beginPath(); ctx.moveTo(q.x0, y); ctx.lineTo(q.x1, y); ctx.stroke(); }
    for (let i = 1; i < 6; i++) { const x = q.x0 + (q.x1 - q.x0) * i / 6; ctx.beginPath(); ctx.moveTo(x, q.y0); ctx.lineTo(x, q.y1); ctx.stroke(); }
    ctx.fillStyle = '#2f6fed'; for (const [x, y] of [[q.x0, q.y0], [q.x1, q.y0], [q.x0, q.y1], [q.x1, q.y1]]) { ctx.beginPath(); ctx.arc(x, y, Math.max(10, c.width / 45), 0, 7); ctx.fill(); }
  }
  let drag = null;
  const pt = (e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; };
  c.addEventListener('pointerdown', (e) => { const p = pt(e), q = IBX.q, hit = Math.max(40, c.width / 10);
    const cs = [['x0', 'y0'], ['x1', 'y0'], ['x0', 'y1'], ['x1', 'y1']].map(([a, b]) => ({ a, b, d: Math.hypot(q[a] - p.x, q[b] - p.y) })).sort((m, n) => m.d - n.d);
    if (cs[0].d < hit) { drag = cs[0]; c.setPointerCapture(e.pointerId); e.preventDefault(); } });
  c.addEventListener('pointermove', (e) => { if (!drag) return; const p = pt(e), q = IBX.q, mn = c.width * 0.15;
    q[drag.a] = Math.max(0, Math.min(c.width, p.x)); q[drag.b] = Math.max(0, Math.min(c.height, p.y));
    if (q.x1 - q.x0 < mn) q[drag.a] = drag.a === 'x0' ? q.x1 - mn : q.x0 + mn; if (q.y1 - q.y0 < mn) q[drag.b] = drag.b === 'y0' ? q.y1 - mn : q.y0 + mn; draw(); });
  c.addEventListener('pointerup', () => { drag = null; });
  $('#ibAng').oninput = (e) => { IBX.ang = +e.target.value; $('#ibAngT').textContent = `${IBX.ang}°`; draw(); };
  $('#ibRot').onclick = () => { IBX.rot = (IBX.rot + 1) % 4; reset(); };
  $('#ibReset').onclick = () => { IBX.rot = 0; IBX.ang = 0; $('#ibAng').value = 0; $('#ibAngT').textContent = '0°'; reset(); };
  $('#ibAgain').onclick = () => { URL.revokeObjectURL(url); ibStart(IBX.mode); };
  $('#ibGo').onclick = () => {
    // 원본 해상도로 다시 그려 잘라 낸다 → 가로 2200px 로 맞춘다(작은 글자도 읽히게)
    const g = geo(), full = Math.min(1, 3200 / Math.max(g.iw, g.ih)), FW = Math.round(g.iw * full), FH = Math.round(g.ih * full);
    const big = document.createElement('canvas'); big.width = FW; big.height = FH; paint(big.getContext('2d'), FW, FH);
    const k = FW / c.width, q = IBX.q, sw = (q.x1 - q.x0) * k, sh = (q.y1 - q.y0) * k, W = 2200, H = Math.round(sh * W / sw);
    const pc = document.createElement('canvas'); pc.width = W; pc.height = H; const px = pc.getContext('2d'); px.imageSmoothingQuality = 'high';
    px.drawImage(big, q.x0 * k, q.y0 * k, sw, sh, 0, 0, W, H);
    URL.revokeObjectURL(url); IBX.img = null; ibRead(pc);
  };
  reset();
}

// ③ 읽기
async function ibRead(pc) {
  const v = $('#view');
  v.innerHTML = `<div class="card"><h2>숫자 읽는 중…</h2><p id="ibStep" class="muted">준비</p><div class="prog" style="height:12px"><i id="ibBar" style="width:3%"></i></div>
   <p class="hint">처음 한 번은 글자 자료(약 8MB)를 받아요. 그다음부터는 인터넷 없이 읽어요. 20~40초쯤 걸려요.</p><button class="ghost big" id="ibStop">그만두고 직접 넣기</button></div>`;
  let stop = false; $('#ibStop').onclick = () => { stop = true; ibConfirm({ v: {}, how: {}, doubt: {}, box: {} }); };
  const step = (t, pct) => { if ($('#ibStep')) $('#ibStep').textContent = t; if ($('#ibBar') && pct != null) $('#ibBar').style.width = `${pct}%`; };
  const W = pc.width, H = pc.height, ctx = pc.getContext('2d', { willReadFrequently: true });
  const id = ctx.getImageData(0, 0, W, H), d = id.data, g = new Uint8Array(W * H);
  for (let i = 0; i < g.length; i++) g[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
  // 그늘 고르게(큰 칸 밝기로 나눈다) → 대비 · 막대 지우기
  { const B = Math.round(W / 12), bw = Math.ceil(W / B), bh = Math.ceil(H / B), mx = new Float32Array(bw * bh);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = ((y / B) | 0) * bw + ((x / B) | 0); if (g[y * W + x] > mx[k]) mx[k] = g[y * W + x]; }
    const sm = Array.from(mx).sort((a, b) => a - b), uneven = sm[Math.floor(sm.length * 0.1)] < 200 && sm[Math.floor(sm.length * 0.9)] - sm[Math.floor(sm.length * 0.1)] > 25;
    if (uneven)   // 사진 그늘이 있을 때만(캡처 · 스캔처럼 고르면 그대로)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const fx = Math.min(bw - 1, Math.max(0, x / B - 0.5)), fy = Math.min(bh - 1, Math.max(0, y / B - 0.5)), x0 = fx | 0, y0 = fy | 0, x1 = Math.min(bw - 1, x0 + 1), y1 = Math.min(bh - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
      const bg = (mx[y0 * bw + x0] * (1 - ax) + mx[y0 * bw + x1] * ax) * (1 - ay) + (mx[y1 * bw + x0] * (1 - ax) + mx[y1 * bw + x1] * ax) * ay; g[y * W + x] = Math.min(255, g[y * W + x] / Math.max(40, bg) * 255); } }
  INB.prep(g, W, H);
  const put = () => { for (let i = 0; i < g.length; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g[i]; d[i * 4 + 3] = 255; } ctx.putImageData(id, 0, 0); };
  put();
  IBX.pc = pc;
  let T, N;
  try {
    step('글자 읽기 도구 준비', 5); T = await loadTess();
    const opt = (n) => ({ workerPath: absUrl('vendor/tesseract/worker.min.js'), corePath: absUrl('vendor/tesseract/'), langPath: absUrl('lang'), workerBlobURL: false, gzip: true,
      logger: (m) => { if (m.status && /loading|initializ/.test(m.status)) step(`글자 자료 받는 중 (${n})`, 5 + Math.round((m.progress || 0) * 15)); } });
    N = await T.createWorker('eng', 1, opt('숫자'));
    if (stop) return;
    await N.setParameters({ tessedit_char_whitelist: '0123456789.~()-+/', tessedit_pageseg_mode: '11' });
    const flat = (r) => { const L = []; for (const b of r.data.blocks || []) for (const p of b.paragraphs) for (const l of p.lines) L.push({ words: l.words.map((x) => ({ t: x.text, b: { x0: x.bbox.x0, y0: x.bbox.y0, x1: x.bbox.x1, y1: x.bbox.y1 } })) }); return L; };
    step('숫자 훑는 중', 22);
    const all = flat(await N.recognize(pc, {}, { blocks: true })).flatMap((l) => l.words);
    await N.setParameters({ tessedit_pageseg_mode: '6' });
    let calls = 0;
    const sub = document.createElement('canvas');
    const env = { W, H, all,
      mask: async (rs) => { for (const r of rs) for (let y = Math.max(0, r.y0); y < Math.min(H, r.y1); y++) g.fill(255, y * W + Math.max(0, r.x0), y * W + Math.min(W, r.x1)); put(); },
      kor: async () => { step('라벨 읽는 중(한글)', 35); const K = await T.createWorker(['kor', 'eng'], 1, opt('한글')); const r = flat(await K.recognize(pc, {}, { blocks: true })); await K.terminate(); return r; },
      num: async (r, mode) => { if (stop) return []; const w = r.x1 - r.x0, h = r.y1 - r.y0; if (w < 8 || h < 8) return [];
        calls++; step(`칸 맞추는 중 (${calls})`, Math.min(95, 50 + calls));
        const k = mode === 'line' ? 2 : 1;   // 한 줄 읽기(기억한 자리 · 📍)는 2배로 키워 읽는다 — 5↔8 헷갈림이 줄었다
        if (k === 1) { sub.width = w; sub.height = h; sub.getContext('2d').drawImage(pc, r.x0, r.y0, w, h, 0, 0, w, h); }
        else { const c = new Uint8Array(w * h); for (let y = 0; y < h; y++) c.set(g.subarray((r.y0 + y) * W + r.x0, (r.y0 + y) * W + r.x1), y * w);
          const o = INB.resize(c, w, h, w * k, h * k); sub.width = w * k; sub.height = h * k; const sc = sub.getContext('2d'), im = sc.createImageData(w * k, h * k);
          for (let i = 0; i < o.length; i++) { im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = o[i]; im.data[i * 4 + 3] = 255; } sc.putImageData(im, 0, 0); }
        if (mode === 'line') await N.setParameters({ tessedit_pageseg_mode: '7' });
        const res = await N.recognize(sub, {}, { blocks: true }); if (mode === 'line') await N.setParameters({ tessedit_pageseg_mode: '6' });
        return flat(res).flatMap((l) => l.words).map((x) => ({ t: x.t, b: { x0: x.b.x0 / k + r.x0, y0: x.b.y0 / k + r.y0, x1: x.b.x1 / k + r.x0, y1: x.b.y1 / k + r.y0 } })); } };
    // 이 폰이 기억한 칸 위치를 먼저 읽는다(기종 이름은 읽기 전엔 몰라 '기본' 에 모아 둔다)
    const res = await INB.read(env, S.ibTpl['기본'] || {}, { height: S.profile && S.profile.height });
    IBX.env = env; IBX.N = N; IBX.W = W; IBX.H = H;
    if (stop) return;
    step('끝', 100); ibConfirm(res);
  } catch (e) {
    if (N) try { await N.terminate(); } catch (x) {}
    if (stop) return;
    v.innerHTML = `<div class="card"><h2>읽지 못했어요</h2><p class="muted">${esc(e.message || e)}</p><button class="primary big" id="ibHand2">숫자 직접 넣기</button><button class="ghost big" id="ibRe">다시 찍기</button></div>`;
    $('#ibHand2').onclick = () => ibConfirm({ v: {}, how: {}, doubt: {}, box: {} }); $('#ibRe').onclick = () => ibStart(IBX ? IBX.mode : 'add');
  }
}
function ibDone() { if (IBX && IBX.N) IBX.N.terminate().catch(() => {}); IBX = null; }

// ④ 확인 · 고치기 — 못 읽었거나 서로 안 맞는 칸은 노랗게. 📍 로 사진에서 그 숫자를 누르면 그 자리를 다시 읽고 기억한다
function ibConfirm(res) {
  const v = $('#view'), F = INB.F, wiz = IBX && IBX.mode === 'wizard', p = S.profile || {};
  IBX = IBX || { mode: 'add' }; IBX.res = res; IBX.loc = IBX.loc || {};
  res.doubt = res.doubt || {};
  { const h = res.v.height ?? p.height, w = res.v.weight, b = res.v.bmi;   // (가) 결과지에서 키를 못 읽었으면 내 정보의 키로
    if (h && w != null && b != null && Math.abs(w / (h / 100) ** 2 - b) > 0.3 && !res.doubt.bmi) res.doubt.bmi = '체중 ÷ 키² 와 안 맞음'; }
  const val = (k) => res.v[k] ?? '';
  const row = (k) => { const f = F[k], dz = res.doubt && res.doubt[k], how = res.how && res.how[k];
    return `<div class="ibrow${dz ? ' doubt' : ''}" data-k="${k}"><label>${esc(f.name)}${f.unit ? ` <span class="hint">${esc(f.unit)}</span>` : ''}${how === '계산' ? ' <span class="badge">계산</span>' : ''}${dz ? ` <span class="hint">${esc(dz)}</span>` : ''}</label>
     <div class="row" style="flex-wrap:nowrap"><input inputmode="decimal" data-ib="${k}" value="${esc(val(k))}">${IBX.pc ? `<button class="small ghost" data-loc="${k}" aria-label="${esc(f.name)} 사진에서 찾기">📍</button>` : ''}</div></div>`; };
  const nRead = IBF.filter((k) => res.how && res.how[k] === '읽음').length;
  v.innerHTML = `<div class="card"><h2>숫자 확인</h2><p class="hint">${IBX.pc ? `${IBF.length}칸 중 ${nRead}칸을 읽었어요${res.model ? ` · InBody ${esc(res.model)}` : ''}. 노란 칸은 꼭 결과지와 맞춰 보세요. 틀린 칸은 고치거나 📍를 눌러 사진에서 그 숫자를 누르면 다음부터 그 자리를 먼저 읽어요.` : '결과지를 보고 숫자를 넣어 주세요. 모르는 칸은 비워 두세요.'}</p>
   ${res.weak ? `<div class="card sub ibweak"><b>사진 읽기가 약해요</b><p class="hint">기울었거나 흐린 것 같아요. 기울기 막대로 글줄을 격자에 맞춰 다시 읽으면 더 정확해요. 이대로 쓰려면 모든 칸을 결과지와 맞춰 주세요.</p>${IBX.pc ? '<button class="small primary" id="ibRetry">다시 찍기 · 맞추기</button>' : ''}</div>` : ''}
   <label>검사한 날</label><input type="date" id="ibDate" value="${ymd()}">
   ${wiz ? `<div class="grid2"><div><label>키(cm)</label><input id="ibH" inputmode="decimal" value="${esc(res.v.height ?? p.height ?? '')}"></div><div><label>나이</label><input id="ibA" inputmode="numeric" value="${esc(res.v.age ?? p.age ?? '')}"></div></div>
   <label>성별</label><div class="chips" id="ibSex">${[['m', '남'], ['f', '여']].map(([k, t]) => `<button type="button" data-v="${k}" class="${(res.sex || p.sex || 'm') === k ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''}
   <h3>체성분</h3>${['weight', 'smm', 'bfm', 'pbf', 'bmi', 'bmr', 'ffm', 'score'].map(row).join('')}
   <h3>부위별 근육(kg)</h3>${['ra', 'la', 'tr', 'rl', 'll'].map(row).join('')}
   <details><summary class="hint">부위별 표준 대비 %(결과지에 있으면)</summary>${IBP.map(row).join('')}</details>
   <p id="ibWarn" class="hint"></p>
   <button class="primary big" id="ibSave">저장하고 프로그램 · 식단 다시 짜기</button><button class="ghost big" id="ibCancel">취소</button></div>
   <div id="ibLocBox" hidden></div>`;
  let sex = res.sex || p.sex || 'm';
  if ($('#ibSex')) $('#ibSex').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; sex = b.dataset.v; $('#ibSex').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); check(); };
  const num = (k) => { const el = v.querySelector(`[data-ib="${k}"]`); const x = parseFloat(String(el ? el.value : '').replace(',', '.')); return Number.isFinite(x) ? x : null; };
  const prof = () => ({ ...p, height: wiz ? parseFloat($('#ibH').value) : p.height, age: wiz ? parseInt($('#ibA').value, 10) : p.age, sex: wiz ? sex : p.sex, weight: num('weight') || p.weight });
  // 기획 rules.inbody.calorie.sanity: 키·체중 계산(Mifflin)과 15% 넘게 다르면 다시 보게
  let pickMif = false;
  function check() {
    const q = prof(), w = $('#ibWarn'); if (!w) return;
    const ffm = num('ffm') ?? (num('weight') != null && num('bfm') != null ? num('weight') - num('bfm') : null), bmr = num('bmr') ?? (ffm ? 370 + 21.6 * ffm : null);
    const msg = [];
    if (num('weight') != null && num('bfm') != null && num('ffm') != null && Math.abs(num('weight') - num('bfm') - num('ffm')) > 0.4) msg.push('체중 − 체지방량 ≠ 제지방량이에요');
    if (bmr && q.height > 100 && q.weight > 25 && q.age > 10) { const mif = 10 * q.weight + 6.25 * q.height - 5 * q.age + (q.sex === 'f' ? -161 : 5);
      if (Math.abs(bmr - mif) / mif > 0.15) { w.innerHTML = `<b>숫자를 다시 확인해 주세요</b> — 결과지 기초대사량 ${Math.round(bmr)}kcal 가 키·체중 계산 ${Math.round(mif)}kcal 와 15% 넘게 달라요.
        <div class="chips" id="ibMif"><button data-v="0" class="${pickMif ? '' : 'on'}">결과지 값 쓰기</button><button data-v="1" class="${pickMif ? 'on' : ''}">키·체중 계산 쓰기</button></div>${msg.length ? '<br>' + msg.join(' · ') : ''}`;
        $('#ibMif').onclick = (e) => { const b = e.target.closest('button'); if (b) { pickMif = b.dataset.v === '1'; check(); } }; return; } }
    pickMif = false; w.textContent = msg.join(' · ');
  }
  function bmiCheck() {   // (가) 키를 넣거나 고칠 때마다 BMI 가 체중 ÷ 키² 와 맞는지
    const q = prof(), row = v.querySelector('.ibrow[data-k=bmi]'), b = num('bmi'), w = num('weight'); if (!row) return;
    const bad = q.height > 100 && w != null && b != null && Math.abs(w / (q.height / 100) ** 2 - b) > 0.3;
    row.classList.toggle('doubt', bad || (!!res.doubt.bmi && !row.dataset.touched));
    let t = row.querySelector('.bmiwarn'); if (!t) { t = document.createElement('span'); t.className = 'hint bmiwarn'; row.querySelector('label').appendChild(t); }
    t.textContent = bad ? ` 체중 ÷ 키² = ${(w / (q.height / 100) ** 2).toFixed(1)}` : '';
    const wr = v.querySelector('.ibrow[data-k=weight]');   // (가) BMI 가 안 맞거나 키에 비해 말이 안 되는 체중이면 체중도 노랗게 — 체중은 마법사 체중으로 들어간다
    if (wr && !wr.dataset.touched) { const bm = q.height > 100 && w != null ? w / (q.height / 100) ** 2 : null; wr.classList.toggle('doubt', !!res.doubt.weight || w == null || bad || (bm != null && (bm < 13 || bm > 50))); }
  }
  v.querySelectorAll('[data-ib]').forEach((el) => el.addEventListener('input', () => { const r = el.closest('.ibrow'); r.dataset.touched = 1; r.classList.remove('doubt'); check(); bmiCheck(); }));
  if (wiz) ['#ibH', '#ibA'].forEach((s) => $(s).addEventListener('input', () => { check(); bmiCheck(); }));
  check(); bmiCheck();
  v.querySelectorAll('[data-loc]').forEach((b) => b.onclick = () => ibLocate(b.dataset.loc));
  if ($('#ibRetry')) $('#ibRetry').onclick = () => { const m = IBX.mode; ibDone(); ibStart(m); };
  $('#ibCancel').onclick = () => { ibDone(); render(); };
  $('#ibSave').onclick = () => {
    const rec = { date: $('#ibDate').value || ymd(), model: res.model || null, v: {}, std: {} };
    for (const k of [...IBF, ...IBP]) { const x = num(k); if (x != null) rec.v[k] = x; }
    if (rec.v.weight == null || !(rec.v.weight > 25 && rec.v.weight < 250)) { alert('체중은 꼭 넣어 주세요'); return; }
    if (res.ranges && res.ranges.smm) rec.std.smm = res.ranges.smm;
    if (pickMif) rec.useMifflin = true;
    learn(res, rec);
    const q = prof();
    S.inbody = (S.inbody || []).filter((x) => x.date !== rec.date); S.inbody.push(rec); S.inbody.sort((a, b) => a.date.localeCompare(b.date));
    const latest = lastIb() === rec;
    if (wiz) { const m = IBX.mode; ibDone(); const fin = (x) => (Number.isFinite(x) ? x : ''); IBX = { mode: m, prefill: { height: fin(q.height), weight: rec.v.weight, age: fin(q.age), sex: q.sex } }; save(); wizard($('#view')); return; }
    if (latest && S.profile && !S.profile.noWeigh) { S.profile.weight = rec.v.weight; S.body = S.body.filter((b) => b.date !== rec.date); S.body.push({ date: rec.date, w: rec.v.weight }); S.body.sort((a, b) => a.date.localeCompare(b.date)); }
    save(); ibDone(); ibResult(rec);
  };
}
// 기억: 읽은 값을 그대로 둔 칸은 그 자리를, 고친 칸은 읽은 낱말 가운데 같은 숫자의 자리를(없으면 📍로 누른 자리)
function learn(res, rec) {
  if (!IBX || !IBX.pc) return;
  const W = IBX.W, H = IBX.H, key = res.model || '기본', t = S.ibTpl[key] = S.ibTpl[key] || {};
  const nb = (b) => ({ x0: +(b.x0 / W).toFixed(4), y0: +(b.y0 / H).toFixed(4), x1: +(b.x1 / W).toFixed(4), y1: +(b.y1 / H).toFixed(4) });
  for (const k of [...IBF, ...IBP]) { const x = rec.v[k]; if (x == null) continue;
    if (IBX.loc[k]) { t[k] = nb(IBX.loc[k]); continue; }
    if (res.how && res.how[k] === '읽음' && res.v[k] === x && res.box && res.box[k]) { t[k] = nb(res.box[k]); continue; }
    const b = INB.locate(res.words || [], x, INB.F[k].dec); if (b) t[k] = nb(b); }
  if (key !== '기본') S.ibTpl['기본'] = { ...(S.ibTpl['기본'] || {}), ...t };   // 다음 사진에서 기종 이름을 못 읽어도 쓰게
}
// 📍 사진에서 그 숫자 누르기 → 그 자리만 다시 읽어 칸을 채운다
function ibLocate(k) {
  const box = $('#ibLocBox'), pc = IBX.pc; if (!pc) return;
  box.hidden = false; box.className = 'locwrap';
  box.innerHTML = `<div class="locbox"><p><b>${esc(INB.F[k].name)}</b> 숫자를 사진에서 눌러 주세요 <span class="hint">두 손가락으로 키워서 볼 수 있어요</span></p><div class="locscroll"><canvas id="ibLocC"></canvas></div><button class="big" id="ibLocX">닫기</button></div>`;
  const c = $('#ibLocC'), sc = 1100 / pc.width; c.width = 1100; c.height = Math.round(pc.height * sc); c.getContext('2d').drawImage(pc, 0, 0, c.width, c.height);
  $('#ibLocX').onclick = () => { box.hidden = true; box.innerHTML = ''; };
  c.onclick = async (e) => {
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * IBX.W, y = (e.clientY - r.top) / r.height * IBX.H;
    const R = { x0: Math.max(0, Math.round(x - 0.045 * IBX.W)), y0: Math.max(0, Math.round(y - 0.013 * IBX.H)), x1: Math.min(IBX.W, Math.round(x + 0.045 * IBX.W)), y1: Math.min(IBX.H, Math.round(y + 0.013 * IBX.H)) };
    box.querySelector('p').innerHTML = '그 자리 읽는 중…';
    let got = null;
    try { const f = INB.F[k], cand = (ws) => ws.flatMap((w) => INB.nums(w.t).filter((n) => n.v != null && n.v >= f.rng[0] && n.v <= f.rng[1]).map((n) => ({ n, w, d: Math.hypot((w.b.x0 + w.b.x1) / 2 - x, (w.b.y0 + w.b.y1) / 2 - y) + (n.alt ? 40 : 0) + (f.dec && !/\./.test(n.s) ? 30 : 0) }))).sort((a, b) => a.d - b.d);
      let c2 = cand(await IBX.env.num(R, 'line')); if (!c2.length) c2 = cand(await IBX.env.num(R));   // 2배 한 줄 읽기를 먼저 믿는다
      if (c2.length) got = c2[0]; } catch (err) {}
    IBX.loc[k] = got ? got.w.b : R;
    const el = $(`[data-ib="${k}"]`); if (got && el) { el.value = got.n.v; el.closest('.ibrow').classList.remove('doubt'); el.dispatchEvent(new Event('input')); }
    box.hidden = true; box.innerHTML = '';
    if (!got) alert('그 자리에서 숫자를 못 읽었어요 — 칸에 직접 넣어 주세요. 자리는 기억해 둘게요');
  };
}
// ⑤ 저장 뒤: 바뀐 숫자 · 목표 제안(버튼을 눌러야 바뀜) · 부위 보강
function ibResult(rec) {
  const p = S.profile, n = N(), sug = ENG.suggestGoal(D.rules, p, rec), bo = ENG.boosts(D.rules, rec), v = $('#view');
  $('#sub').textContent = '인바디';
  v.innerHTML = `<div class="card"><h2>저장했어요 · ${md(rec.date)}</h2>
    <p class="small">골격근량 ${rec.v.smm ?? '–'}kg · 체지방률 ${rec.v.pbf ?? '–'}% · 제지방량 ${rec.v.ffm ?? '–'}kg</p>
    <p class="small">하루 ${n.kcal.toLocaleString()}kcal(쉬는 날 ${n.restKcal.toLocaleString()}) · 단백질 ${n.protein}g <span class="hint">${n.src === 'inbody' ? `기초대사 ${n.bmr.toLocaleString()}kcal(인바디) 기준` : '키·체중 계산 기준'}</span></p></div>
   ${!isFixed() && sug && sug.goal !== p.goal ? `<div class="card"><h2>목표 제안 · ${esc(sug.goal)}${sug.strong ? ' <span class="badge">강하게</span>' : ''}</h2><p class="small">${sug.why.map(esc).join(' · ')}</p>${sug.cardio ? `<p class="hint">유산소 +${sug.cardio}분을 권해요</p>` : ''}<p class="hint">지금 목표: ${esc(p.goal)}</p><button class="primary big" id="ibGoal">이 목표로 바꾸기</button></div>` : ''}
   ${bo.length ? `<div class="card"><h2>부위 보강</h2>${bo.map((b) => `<p class="small"><b>${esc(exName(b.ex))}</b> ${b.sets}×${esc(b.reps)} — ${esc(b.why)}${b.weak ? ` · 약한 쪽(${esc(b.weak)})부터` : ''}</p>`).join('')}<p class="hint">해당하는 날 운동 끝에 들어가요(시간이 모자라면 먼저 빠져요). 다음 인바디에서 풀리면 빠져요.</p></div>` : ''}
   <button class="big" id="ibOk">확인</button>`;
  if ($('#ibGoal')) $('#ibGoal').onclick = () => { S.profile.goal = sug.goal; S.planStart = ymd(); S.done = 0; S.cur = null; S.swaps = {}; save(); ibResult(rec); };
  $('#ibOk').onclick = () => { tab = 'today'; render(); };
}
