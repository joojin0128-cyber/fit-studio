/* 인바디 결과지 읽기 — 휴대폰 안에서만(사진은 저장하지 않고 숫자만). 글자 읽기는 Tesseract.js(앱에 동봉), 여기는 전처리 · 숫자 고르기 규칙. */
'use strict';
(function (root) {
  // ① 전처리: 대비 늘이기 → 막대 · 표 선(긴 가로/세로 검은 줄) 지우기 — 막대 끝에 붙은 숫자(59.1 · 19.5)가 살아난다
  function prep(g, w, h) {
    const hist = new Uint32Array(256); for (let i = 0; i < g.length; i++) hist[g[i]]++;
    let lo = 0, hi = 255, acc = 0; const cut = g.length * 0.01;
    while (lo < 255 && (acc += hist[lo]) < cut) lo++; acc = 0; while (hi > 0 && (acc += hist[hi]) < cut) hi--;
    const sc = 255 / Math.max(1, hi - lo);
    for (let i = 0; i < g.length; i++) g[i] = Math.max(0, Math.min(255, (g[i] - lo) * sc));
    const L = Math.max(30, Math.round(w * 0.035)), dark = (v) => v < 150, kill = new Uint8Array(g.length);
    for (let y = 0; y < h; y++) { let s = -1; for (let x = 0; x <= w; x++) { const d = x < w && dark(g[y * w + x]); if (d && s < 0) s = x; if (!d && s >= 0) { if (x - s >= L) for (let k = s; k < x; k++) kill[y * w + k] = 1; s = -1; } } }
    for (let x = 0; x < w; x++) { let s = -1; for (let y = 0; y <= h; y++) { const d = y < h && dark(g[y * w + x]); if (d && s < 0) s = y; if (!d && s >= 0) { if (y - s >= L) for (let k = s; k < y; k++) kill[k * w + x] = 1; s = -1; } } }
    const R = 3, k2 = new Uint8Array(g.length);   // 막대 끝 눈금 찌꺼기('1'로 읽힘)까지 지우게 조금 넓힌다
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (kill[y * w + x]) for (let dy = -R; dy <= R; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -R; dx <= R; dx++) { const xx = x + dx; if (xx >= 0 && xx < w) k2[yy * w + xx] = 1; } }
    for (let i = 0; i < g.length; i++) if (k2[i]) g[i] = 255;
    return g;
  }
  // ①-2 크기 맞추기(Lanczos3) — 브라우저 캔버스의 단순 보간으로 키우면 작은 숫자가 뭉개져 정확도가 크게 떨어졌다(370S 15→5칸)
  function resize(g, w, h, W, H) {
    const L = (x) => { if (x === 0) return 1; if (x <= -3 || x >= 3) return 0; const p = Math.PI * x; return 3 * Math.sin(p) * Math.sin(p / 3) / (p * p); };
    const pass = (src, sw, sh, dw, horiz) => {   // 한 방향만
      const n = horiz ? sw : sh, m = horiz ? sh : sw, scale = dw / n, sup = scale < 1 ? 3 / scale : 3, fs = scale < 1 ? scale : 1;
      const out = new Float32Array(horiz ? dw * sh : sw * dw), idx = [], wts = [];
      for (let i = 0; i < dw; i++) { const c = (i + 0.5) / scale - 0.5, a = Math.ceil(c - sup), b = Math.floor(c + sup); const ii = [], ww = []; let sum = 0;
        for (let j = a; j <= b; j++) { const wv = L((j - c) * fs); if (!wv) continue; ii.push(Math.min(n - 1, Math.max(0, j))); ww.push(wv); sum += wv; } idx.push(ii); wts.push(ww.map((x) => x / sum)); }
      for (let r = 0; r < m; r++) for (let i = 0; i < dw; i++) { const ii = idx[i], ww = wts[i]; let v = 0;
        if (horiz) { const o = r * sw; for (let k = 0; k < ii.length; k++) v += src[o + ii[k]] * ww[k]; out[r * dw + i] = v; }
        else { for (let k = 0; k < ii.length; k++) v += src[ii[k] * sw + r] * ww[k]; out[i * sw + r] = v; } }
      return out;
    };
    const t = pass(g, w, h, W, true), u = pass(t, W, h, H, false), o = new Uint8Array(W * H);
    for (let i = 0; i < o.length; i++) o[i] = u[i] < 0 ? 0 : u[i] > 255 ? 255 : u[i];
    return o;
  }
  // ② 칸 정의 — 라벨(한·영) · 그럴듯한 범위 · 소수 여부
  const F = {
    weight: { kw: ['체중', 'Weight'], rng: [25, 250], dec: 1, name: '체중', unit: 'kg' },
    smm: { kw: ['골격근량', 'SkeletalMuscleMass'], rng: [8, 70], dec: 1, name: '골격근량', unit: 'kg' },
    bfm: { kw: ['체지방량', '체지방', 'BodyFatMass'], rng: [1, 120], dec: 1, name: '체지방량', unit: 'kg' },
    pbf: { kw: ['체지방률', '체지방를', '체지방룡', '체지방율', 'PercentBodyFat'], rng: [3, 70], dec: 1, name: '체지방률', unit: '%' },
    bmi: { kw: ['BMI', 'BodyMassIndex'], rng: [12, 60], dec: 1, name: 'BMI', unit: '' },
    bmr: { kw: ['기초대사량', 'BMR', 'BasalMetabolicRate'], rng: [800, 3500], dec: 0, name: '기초대사량', unit: 'kcal' },
    ffm: { kw: ['제지방량', 'FatFreeMass', 'FFM'], rng: [20, 130], dec: 1, name: '제지방량', unit: 'kg' },
    score: { kw: ['인바디점수', 'InBodyScore', '신체발달점수'], rng: [30, 110], dec: 0, name: '인바디 점수', unit: '점' },
    ra: { kw: ['오른팔', 'RightArm'], rng: [0.5, 8], dec: 1, name: '오른팔', unit: 'kg', seg: 1 },
    la: { kw: ['왼팔', 'LeftArm'], rng: [0.5, 8], dec: 1, name: '왼팔', unit: 'kg', seg: 1 },
    tr: { kw: ['몸통', 'Trunk'], rng: [5, 60], dec: 1, name: '몸통', unit: 'kg', seg: 1 },
    rl: { kw: ['오른다리', 'RightLeg'], rng: [1.5, 20], dec: 1, name: '오른다리', unit: 'kg', seg: 1 },
    ll: { kw: ['왼다리', 'LeftLeg'], rng: [1.5, 20], dec: 1, name: '왼다리', unit: 'kg', seg: 1 },
    raP: { kw: ['오른팔', 'RightArm'], rng: [40, 200], dec: 1, name: '오른팔', unit: '%', seg: 1, pct: 1 },
    laP: { kw: ['왼팔', 'LeftArm'], rng: [40, 200], dec: 1, name: '왼팔', unit: '%', seg: 1, pct: 1 },
    trP: { kw: ['몸통', 'Trunk'], rng: [40, 200], dec: 1, name: '몸통', unit: '%', seg: 1, pct: 1 },
    rlP: { kw: ['오른다리', 'RightLeg'], rng: [40, 200], dec: 1, name: '오른다리', unit: '%', seg: 1, pct: 1 },
    llP: { kw: ['왼다리', 'LeftLeg'], rng: [40, 200], dec: 1, name: '왼다리', unit: '%', seg: 1, pct: 1 },
    height: { kw: ['신장', 'Height'], rng: [120, 220], dec: 1, name: '키', unit: 'cm', person: 1 },
    age: { kw: ['연령', '나이', 'Age'], rng: [10, 99], dec: 0, name: '나이', unit: '세', person: 1 },
  };
  const isH = (c) => c >= '가' && c <= '힣';
  const norm = (t) => String(t).replace(/[\s|「」'"`·.,:;!_\-]/g, '');
  // 한 줄의 낱말을 이어 붙여(띄어 쓴 '체 중' · 'B M I' 도) 라벨을 찾는다 — 앞뒤에 한글이 붙어 있으면(적정체중 · 체중조절) 다른 말
  const SEC = { segsec: { kw: ['부위별근육분석', '부위별근육', 'SegmentalLean'] } }, FAT = { fatsec: { kw: ['부위별체지방', 'SegmentalFat'] } };
  function anchors(lines, D = F) {
    const out = [];
    for (const L of lines) {
      const ws = L.words.filter((w) => norm(w.t)); if (!ws.length) continue;
      const h = Math.max(8, ...ws.map((w) => w.b.y1 - w.b.y0).sort((a, b) => a - b).slice(0, Math.ceil(ws.length / 2)));
      // 이어 붙일 묶음: 한 글자 낱말끼리는 넓게(4h), 나머지는 붙어 있을 때만
      const runs = []; let cur = null;
      for (const w of ws) { const t = norm(w.t); const prev = cur && cur.ws[cur.ws.length - 1]; const gap = prev ? w.b.x0 - prev.b.x1 : 1e9;
        const pl = prev ? norm(prev.t).length : 0;
        const lat = /^[A-Za-z]+$/.test(t) && /^[A-Za-z]+$/.test(norm(prev ? prev.t : ''));
        const join = prev && ((t.length === 1 && pl === 1 && gap < 4 * h) || ((t.length === 1 || pl === 1) && gap < 1.5 * h) || gap < (lat ? 0.9 : 0.35) * h);
        if (!join) { cur = { ws: [], s: '', map: [] }; runs.push(cur); }
        cur.ws.push(w); for (const c of t) { cur.s += c; cur.map.push(cur.ws.length - 1); } }
      for (const r of runs) for (const [k, f] of Object.entries(D)) for (const kw of f.kw) {
        let i = r.s.indexOf(kw); const lk = kw.toLowerCase();
        if (i < 0 && !isH(kw[0])) i = r.s.toLowerCase().indexOf(lk);
        while (i >= 0) { const bef = r.s[i - 1], aft = r.s[i + kw.length];
          const ok = D !== F || (!(bef && isH(bef)) && !(aft && isH(aft)));
          if (ok) { const sel = r.ws.slice(r.map[i], r.map[i + kw.length - 1] + 1);
            out.push({ k, kw, b: { x0: Math.min(...sel.map((w) => w.b.x0)), y0: Math.min(...sel.map((w) => w.b.y0)), x1: Math.max(...sel.map((w) => w.b.x1)), y1: Math.max(...sel.map((w) => w.b.y1)) }, h }); }
          i = r.s.indexOf(kw, i + 1); }
      }
    }
    // '체지방' 은 '체지방량' 과 같은 자리면 한 번만
    return out.filter((a, i) => !out.some((o, j) => j !== i && o.k === a.k && o.kw.length > a.kw.length && Math.abs(o.b.x0 - a.b.x0) < a.h && Math.abs(o.b.y0 - a.b.y0) < a.h));
  }
  // 낱말 → 숫자 후보(범위 '(a~b)' 는 표준 범위로 따로)
  function nums(t) {
    t = String(t).trim(); const out = [];
    const rg = t.match(/\(?\s*(\d+(?:\.\d+)?)\s*~\s*(\d+(?:\.\d+)?)\s*\)?/); if (rg) return [{ range: [+rg[1], +rg[2]] }];
    if (/\)$/.test(t) && !/\d\s*\/\s*1?00/.test(t)) return [];   // '(1.5)' 처럼 양쪽 괄호면 표준 범위 · 부위 체지방 — 한쪽 찌꺼기 '(19.5-' 는 값
    const sc = t.match(/(\d{2,3})\s*\/\s*1?0?0/); if (sc) return [{ v: +sc[1], s: sc[1], slash: 1 }];
    if ((t.match(/\./g) || []).length >= 2) { const e = t.match(/(\d{1,3}\.\d)$/); return e ? [{ v: +e[1], s: e[1], alt: 1, tail: 1 }] : []; }
    const m = t.match(/\d+(?:\.\d+)?/); if (!m) return [];
    if (/\.\d{3,}/.test(m[0]) && +m[0] >= 2) return [{ v: +m[0].replace(/(\.\d).*/, '$1'), s: m[0].replace(/(\.\d).*/, '$1'), alt: 1 }];   // '39.4386' — 두 값이 붙음
    out.push({ v: +m[0], s: m[0] });
    if (/^(1\d+|\d{3,})\.\d/.test(m[0])) out.push({ v: +m[0].slice(1), s: m[0].slice(1), alt: 1 });   // 막대 끝 눈금이 숫자로 붙은 경우(122.1 → 22.1 · 559.1 → 59.1)
    return out;
  }
  const lineGroups = (ws) => { const g = []; for (const w of [...ws].sort((a, b) => (a.b.y0 + a.b.y1) - (b.b.y0 + b.b.y1))) { const cy = (w.b.y0 + w.b.y1) / 2, hh = w.b.y1 - w.b.y0; const last = g[g.length - 1]; if (last && Math.abs(cy - last.cy) < Math.max(hh, last.h) * 0.6) last.ws.push(w); else g.push({ cy, h: hh, ws: [w] }); } return g; };
  const clampR = (r, W, H) => ({ x0: Math.max(0, Math.round(r.x0)), y0: Math.max(0, Math.round(r.y0)), x1: Math.min(W, Math.round(r.x1)), y1: Math.min(H, Math.round(r.y1)) });
  // 한 영역에서 그 칸에 맞는 숫자 후보 — 눈금 줄(숫자 4개 이상 한 줄)은 버리고, 3개 이상 남으면(신체변화 그래프) 맨 오른쪽(최근)만
  function pick(f, ws, wt, from) {
    const pure = (g) => g.ws.filter((w, i) => /^[-+]?\d+(\.\d+)?$/.test(w.t) && !g.ws.slice(0, i).some((o) => Math.abs(o.b.x0 - w.b.x0) < 10)).length;
    const keep = lineGroups(ws).filter((g) => pure(g) < 4).flatMap((g) => g.ws);
    let c = []; let range = null;
    const inParen = (w) => keep.some((o) => /\($/.test(o.t) && Math.abs((o.b.y0 + o.b.y1) - (w.b.y0 + w.b.y1)) < (w.b.y1 - w.b.y0) && w.b.x0 - o.b.x1 >= -2 && w.b.x0 - o.b.x1 < 2 * (w.b.y1 - w.b.y0));
    const withDot = (t) => { const ns = nums(t); if (f.dec) for (const n of [...ns]) if (n.s && /^\d{2,4}$/.test(n.s)) { const s2 = n.s.slice(0, -1) + '.' + n.s.slice(-1); ns.push({ v: +s2, s: s2, alt: 1, nodot: 1 }); } return ns; };   // '195' — 점이 빠진 19.5
    for (const w of keep) if (!inParen(w)) for (const n of withDot(w.t)) { if (n.range) { range = range || n.range; continue; }
      if (n.v < f.rng[0] || n.v > f.rng[1]) continue;
      if (f.dec && !/\.\d/.test(n.s)) continue;   // 결과지의 kg · % 는 늘 소수 한 자리 — 정수는 눈금 · 번호
      const hasDec = /\./.test(n.s); const dist = from ? Math.hypot(Math.max(0, w.b.x0 - from.x), Math.max(0, w.b.y0 - from.y)) / from.h : 0;
      let sc = wt / (1 + dist * 0.08) * (n.nodot ? 0.4 : n.tail ? 0.7 : n.alt ? 0.5 : 1) * (n.slash ? 3 : 1) * (f.dec ? (hasDec ? 1 : 0.2) : (hasDec ? 0.3 : 1));
      c.push({ v: n.v, sc, b: w.b }); }
    if (c.length >= 3) { const d = f.dec && c.some((x) => x.sc >= 0.5) ? c.filter((x) => x.sc >= 0.5) : c; d.sort((a, b) => b.b.x0 - a.b.x0); c = [{ ...d[0], sc: d[0].sc * 0.6, hist: 1 }]; }
    return { c, range };
  }
  // ③ 읽기: env.lines(라벨 읽기 결과) · env.num(rect) → 숫자 낱말(전체 좌표) · tpl(이 폰이 기억한 칸 위치, 0~1 비율)
  async function read(env, tpl = {}) {
    const { W, H } = env, C = {}, seen = {}, ranges = {};
    const add = (k, arr) => { for (const x of arr) { const key = k + ':' + x.v; if (seen[key]) { seen[key].sc += x.sc; seen[key].hist = seen[key].hist && x.hist; continue; } seen[key] = { ...x, hist: !!x.hist }; (C[k] = C[k] || []).push(seen[key]); } };
    // 이 폰이 기억한 칸 위치(사용자가 고친 값 · 누른 자리) — 가운데에 가까운 숫자일수록 높게
    const tplRead = async () => { for (const [k, r] of Object.entries(tpl)) { if (!F[k]) continue;
      const cx = (r.x0 + r.x1) / 2 * W, cy = (r.y0 + r.y1) / 2 * H, rh = Math.max(12, (r.y1 - r.y0) * H);
      const tight = clampR({ x0: (r.x0 - 0.02) * W, y0: (r.y0 - 0.004) * H, x1: (r.x1 + 0.02) * W, y1: (r.y1 + 0.004) * H }, W, H);
      const wide = clampR({ x0: (r.x0 - 0.04) * W, y0: (r.y0 - 0.012) * H, x1: (r.x1 + 0.04) * W, y1: (r.y1 + 0.012) * H }, W, H);
      const ws = [...await env.num(tight, 'line'), ...await env.num(wide), ...inR(wide)]; seenW.push(...ws);
      const { c } = pick(F[k], ws, 1); add(k, c.map((x) => ({ ...x, sc: x.sc * 4 / (1 + Math.hypot((x.b.x0 + x.b.x1) / 2 - cx, (x.b.y0 + x.b.y1) / 2 - cy) / rh) }))); } };
    const axisOf = (ws) => lineGroups(ws.filter((w) => /^\d+(\.\d+)?$/.test(w.t))).filter((g) => { const v = g.ws.sort((p, q) => p.b.x0 - q.b.x0).map((w) => +w.t); let up = 0; for (let i = 1; i < v.length; i++) if (v[i] > v[i - 1]) up++; return v.length >= 4 && up >= v.length - 2; });
    const maskAxis = async (axis) => { const ax = new Set(), boxes = [];
      for (const g of axis) { const hs = g.ws.map((w) => w.b.y1 - w.b.y0).sort((p, q) => p - q), m = hs[hs.length >> 1];
        for (const w of g.ws) if (w.b.y1 - w.b.y0 <= m * 1.25) { ax.add(w); boxes.push({ x0: w.b.x0 - 2, y0: w.b.y0 - 1, x1: w.b.x1 + 2, y1: w.b.y1 + 1 }); } }
      if (boxes.length) await env.mask(boxes); return ax; };
    // 눈금 줄(오름차순 숫자 4개 이상) 지우기 — 막대 칸 값(2.00 · 19.8)이 눈금과 섞여 안 읽히던 것(970S)
    if (env.mask) { const ax = await maskAxis(axisOf(env.all || [])); env.all = (env.all || []).filter((w) => !ax.has(w)); }
    if (!env.lines) env.lines = await env.kor();
    const fs = anchors(env.lines, FAT);   // 부위별 체지방 칸의 '오른팔 (1.5kg)' 은 근육이 아니다
    const A0 = anchors(env.lines), segX = Math.min(W, ...A0.filter((a) => F[a.k].seg).map((a) => a.b.x0));
    const A = A0.filter((a) => !(F[a.k].seg && a.b.x0 > segX + 0.2 * W)).filter((a) => !(F[a.k].seg && fs.some((x) => a.b.y0 > x.b.y0 - x.h && a.b.y0 < x.b.y0 + 0.25 * H && a.b.x0 > x.b.x0 - 3 * x.h && a.b.x0 < x.b.x0 + 0.4 * W)));
    const inR = (R) => (env.all || []).filter((w) => { const cx = (w.b.x0 + w.b.x1) / 2, cy = (w.b.y0 + w.b.y1) / 2; return cx >= R.x0 && cx <= R.x1 && cy >= R.y0 && cy <= R.y1; });
    const seenW = [...(env.all || [])];
    const both = async (R) => { let ws = await env.num(R); seenW.push(...ws); const ax = env.mask ? axisOf(ws) : [];   // 전체 읽기에서 놓친 눈금이 영역 안에 남아 있으면 지우고 한 번 더
      if (ax.length) { await maskAxis(ax); ws = await env.num(R); } return [...inR(R), ...ws]; };
    await tplRead();
    for (const a of A) { const f = F[a.k], h = a.h;
      const up = f.seg && /^[A-Za-z]/.test(a.kw) ? 2 : 0.6;   // 970S 영문 부위 라벨은 값보다 한 줄 아래 — 한글 라벨은 같은 줄(윗줄 값을 집으면 한 칸씩 밀린다)
      const right = clampR({ x0: a.b.x1 + 0.2 * h, y0: a.b.y0 - Math.max(up * h, 0.012 * H), x1: a.b.x1 + (f.seg ? 0.45 : 0.6) * W, y1: a.b.y1 + 1.0 * h }, W, H);
      const below = clampR({ x0: a.b.x0 - 1.5 * h, y0: a.b.y1, x1: a.b.x1 + (f.person ? 1.5 : a.k === 'score' ? 9 : 4) * h, y1: a.b.y1 + (f.person ? 2 : a.k === 'score' ? 4.5 : 3) * h }, W, H);
      let r1 = { c: [] };
      if (!f.person) { const wr = await both(right); r1 = pick(f, wr, 1.2, { x: a.b.x1, y: a.b.y0, h }); if (!r1.c.length && !f.person) { for (let y = right.y0; y < right.y1 - 0.8 * h; y += 0.9 * h) { const st = clampR({ x0: right.x0, y0: y, x1: right.x1, y1: y + 1.7 * h }, W, H); const rs = pick(f, await env.num(st, 'line'), 1, { x: a.b.x1, y: a.b.y0, h }); if (rs.c.length) { r1 = rs; break; } } }
      if (env.trace && env.trace.includes(a.k)) console.log(a.k, h, JSON.stringify(right), wr.map((w) => w.t + '@' + w.b.y0).join(' '), '→', r1.c.map((c) => c.v)); add(a.k, r1.c); if (r1.range && !ranges[a.k]) ranges[a.k] = r1.range; }
      if (f.person || a.k === 'score' || (!r1.c.length && (a.k === 'ffm' || a.k === 'weight'))) { const r2 = pick(f, await both(below), f.person || a.k === 'score' ? 1.2 : 0.7, { x: a.b.x0, y: a.b.y1, h }); if (env.trace && env.trace.includes(a.k)) console.log('below', a.k, JSON.stringify(below), r2.c.map((c) => c.v)); add(a.k, r2.c); } }
    // 몸 그림형(370S) — 부위 라벨이 없으면 '부위별근육분석' 아래 칸에서 5개(몸통=가장 큰 값 · 위 2개 팔 · 아래 2개 다리)
    if (['ra', 'la', 'tr', 'rl', 'll'].filter((k) => C[k]).length < 5) {
      const sa = anchors(env.lines, SEC)[0], sec = sa && { b: sa.b };
      const fx = fs.filter((x) => sa && x.b.x0 > sa.b.x1 && Math.abs(x.b.y0 - sa.b.y0) < 3 * sa.h).map((x) => x.b.x0 - sa.h);   // 옆 '부위별체지방분석' 그림은 빼고
      if (sec) { const h = sa.h, R = clampR({ x0: sec.b.x0 - 0.15 * W, y0: sec.b.y1, x1: Math.min(sec.b.x0 + 0.36 * W, ...fx), y1: sec.b.y1 + 0.2 * H }, W, H);
        const ws = (await both(R)).flatMap((w) => nums(w.t).filter((n) => !n.alt && n.v >= 0.5 && n.v <= 60 && /\./.test(n.s)).map((n) => ({ v: n.v, b: w.b })));
        const uq = ws.filter((w, i) => !ws.slice(0, i).some((o) => o.v === w.v && Math.abs(o.b.x0 - w.b.x0) < 3 * h && Math.abs(o.b.y0 - w.b.y0) < 2 * h)); ws.length = 0; ws.push(...uq);
        const cyy = (w) => (w.b.y0 + w.b.y1) / 2, rows = lineGroups(ws.map((w) => ({ t: String(w.v), b: w.b, v: w.v })));
        const PUT = (k, w, sc) => w && add(k, [{ v: w.v, sc, b: w.b }]);
        if (rows.length >= 5 && rows.every((g) => g.ws.length === 1)) {   // 줄형: 위에서부터 오른팔 · 왼팔 · 몸통 · 오른다리 · 왼다리
          const o = rows.map((g) => g.ws[0]); if (o.length === 5) ['ra', 'la', 'tr', 'rl', 'll'].forEach((k, i) => PUT(k, o[i], 0.9));
        } else if (ws.length >= 5) { const t = ws.reduce((a, b) => (b.v > a.v ? b : a)); const cy = (w) => (w.b.y0 + w.b.y1) / 2;
          const up = ws.filter((w) => cy(w) < cy(t) - h).sort((a, b) => cy(a) - cy(b)).slice(0, 2).sort((a, b) => a.b.x0 - b.b.x0);
          const dn = ws.filter((w) => cy(w) > cy(t) + h).sort((a, b) => cy(a) - cy(b)).slice(0, 2).sort((a, b) => a.b.x0 - b.b.x0);
          const sw = env.lines.flatMap((L) => L.words).filter((w) => w.b.y0 > R.y0 && w.b.y1 < R.y1 && w.b.x0 >= R.x0 && w.b.x1 <= R.x1);
          const wl = sw.find((w) => /^왼/.test(norm(w.t))), wr = sw.find((w) => /오른/.test(norm(w.t)));
          const leftIsLeft = !(wl && wr && wl.b.x0 > wr.b.x0);   // 결과지에 찍힌 '왼 · 오른' 을 따른다
          const put = (k, w) => w && add(k, [{ v: w.v, sc: 1, b: w.b }]);
          put('tr', t); if (up.length === 2) { put(leftIsLeft ? 'la' : 'ra', up[0]); put(leftIsLeft ? 'ra' : 'la', up[1]); }
          if (dn.length === 2) { put(leftIsLeft ? 'll' : 'rl', dn[0]); put(leftIsLeft ? 'rl' : 'll', dn[1]); } } }
    }
    const text = env.lines.map((L) => L.words.map((w) => w.t).join(' ')).join('\n');
    const sex = /여성|Female/i.test(text) ? 'f' : /남성|Male/i.test(text) ? 'm' : null;
    const model = (text.match(/InBody\s*-?\s*(\d{3}[A-Z]?)/i) || [])[1] || null;
    const res = solve(C, { sex, model, ranges }); res.words = seenW; res.dbg = { A: A.map((a) => a.k + ":" + a.kw + "@" + a.b.x0 + "," + a.b.y0), C: Object.fromEntries(Object.entries(C).map(([k, v]) => [k, v.map((x) => x.v + "(" + x.sc.toFixed(1) + ")")])) }; return res;
  }
  // ④ 서로 맞춰 보기: 제지방 = 체중 − 체지방 · 체지방률 = 체지방 ÷ 체중 · BMI = 체중 ÷ 키² · 기초대사 ≈ 370 + 21.6×제지방
  function solve(C, meta) {
    const top = (k, n = 4) => [null, ...(C[k] || []).sort((a, b) => b.sc - a.sc).slice(0, n)];
    let best = null;
    for (const w of top('weight')) for (const f of top('bfm')) for (const m of top('ffm')) for (const p of top('pbf')) for (const h of top('height', 2)) for (const b of top('bmi', 3)) for (const sm of top('smm', 3)) {
      let s = [w, f, m, p, h, b, sm].reduce((a, x) => a + (x ? x.sc : 0), 0);
      if (sm && (m || (w && f))) { const ff = m ? m.v : w.v - f.v; s += Math.abs(sm.v / ff - 0.55) < 0.09 ? 2 : -2; }   // 골격근량은 제지방량의 약 절반
      if (w) s += 2;   // 체중은 꼭 있어야 하는 칸 — 체중을 버리고 다른 칸을 살리지 않게
      if (w && ((m && m.v >= w.v) || (f && f.v >= w.v) || (sm && sm.v >= w.v * 0.7))) s -= 6;   // 제지방 · 체지방 · 골격근은 체중보다 작다
      if (w && f && m) s += Math.abs(w.v - f.v - m.v) <= 0.25 ? 3 : -2;
      if (w && f && p) s += Math.abs(f.v / w.v * 100 - p.v) <= 0.4 ? 3 : -2;
      if (w && h && b) s += Math.abs(w.v / (h.v / 100) ** 2 - b.v) <= 0.25 ? 2 : -1;
      if (!best || s > best.s) best = { s, weight: w, bfm: f, ffm: m, pbf: p, height: h, bmi: b, smm: sm };
    }
    // 좌우 짝(팔 · 다리)이 30% 넘게 차이 나면 점수 낮은 쪽을 비운다 — 한쪽이 다른 칸 숫자를 집은 경우(970S 오른다리 9.9) · 노란 칸으로 보여 고치게
    for (const [a, b2] of [['ra', 'la'], ['rl', 'll']]) { const x = top(a, 1)[1], y = top(b2, 1)[1];
      if (x && y && Math.abs(x.v - y.v) / Math.max(x.v, y.v) > 0.3) { best[x.sc < y.sc ? a : b2] = null; } }
    const out = {}, how = {}, box = {};
    for (const k of Object.keys(F)) { const x = best && k in best ? best[k] : top(k, 1)[1]; if (x) { out[k] = x.v; how[k] = '읽음'; box[k] = x.b; } }
    const r1 = (v) => Math.round(v * 10) / 10, okR = (k, v) => v >= F[k].rng[0] && v <= F[k].rng[1];
    if (out.weight != null && out.bfm != null && out.ffm == null) { if (okR('ffm', r1(out.weight - out.bfm))) { out.ffm = r1(out.weight - out.bfm); how.ffm = '계산'; } }
    if (out.weight != null && out.ffm != null && out.bfm == null) { if (okR('bfm', r1(out.weight - out.ffm))) { out.bfm = r1(out.weight - out.ffm); how.bfm = '계산'; } }
    if (out.weight != null && out.bfm != null && out.pbf == null) { if (okR('pbf', r1(out.bfm / out.weight * 100))) { out.pbf = r1(out.bfm / out.weight * 100); how.pbf = '계산'; } }
    if (out.weight != null && out.height != null && out.bmi == null) { if (okR('bmi', r1(out.weight / (out.height / 100) ** 2))) { out.bmi = r1(out.weight / (out.height / 100) ** 2); how.bmi = '계산'; } }
    if (out.ffm != null && out.bmr == null) { out.bmr = Math.round(370 + 21.6 * out.ffm); how.bmr = '계산'; }
    // 의심 표시: 서로 안 맞거나 못 읽은 칸 → 확인 화면에서 노랗게
    const doubt = {};
    for (const k of Object.keys(F)) if (out[k] == null) doubt[k] = '못 읽음';
    if (out.weight != null && out.bfm != null && out.ffm != null && Math.abs(out.weight - out.bfm - out.ffm) > 0.3) doubt.ffm = doubt.bfm = '체중−체지방≠제지방';
    if (out.bmr != null && out.ffm != null && Math.abs(out.bmr - (370 + 21.6 * out.ffm)) > 60 && how.bmr === '읽음') doubt.bmr = '제지방량과 안 맞음';
    if (out.smm != null && out.weight != null && out.smm > out.weight * 0.65) doubt.smm = '너무 큼';
    // QA 261030 반려: 틀린 숫자가 '보통'으로 계산에 들어가지 않게 — 서로 안 맞으면 노랗게
    if (out.bmi != null && out.weight != null && out.height != null && Math.abs(out.weight / (out.height / 100) ** 2 - out.bmi) > 0.3) doubt.bmi = '체중 ÷ 키² 와 안 맞음';   // (가)
    if (out.bmr != null && out.ffm != null && Math.abs(out.bmr - (370 + 21.6 * out.ffm)) > 60) { doubt.bmr = doubt.bmr || '제지방량과 안 맞음'; doubt.ffm = doubt.ffm || '기초대사량과 안 맞음'; }   // (나)
    if (out.pbf != null && out.pbf < 5) doubt.pbf = '너무 낮음';   // (다)
    if (out.ffm != null && out.weight != null && out.ffm / out.weight > 0.92) doubt.ffm = '체중에 비해 너무 큼';
    { const arm = [out.ra, out.la].filter((x) => x != null), leg = [out.rl, out.ll].filter((x) => x != null), tr = out.tr;   // (라) 몸통 > 다리 > 팔
      const bad = (tr != null && leg.some((x) => x * 1.4 > tr)) || (tr != null && arm.some((x) => x * 2.5 > tr)) || arm.some((a) => leg.some((l) => a > l * 0.7));
      if (bad) for (const k of ['ra', 'la', 'tr', 'rl', 'll']) if (out[k] != null) doubt[k] = '몸통 > 다리 > 팔 이 아님'; }
    for (const k of ['weight', 'smm', 'bfm', 'pbf', 'ffm', 'bmr']) if (out[k] != null && how[k] === '읽음') {   // (마) 같은 칸에 다른 숫자 후보가 비슷하게 있으면(막대 옆 값 ≠ 이력 끝 값)
      const cs = (C[k] || []).slice().sort((a, b) => b.sc - a.sc), me = cs.find((x) => x.v === out[k]);
      const other = cs.find((x) => x.v !== out[k] && Math.abs(x.v - out[k]) > 0.05 && me && x.sc >= me.sc * 0.5 && !x.alt);
      if (other && !doubt[k]) doubt[k] = `다른 후보 ${other.v}`; }
    const okWFM = out.weight != null && out.bfm != null && out.ffm != null && Math.abs(out.weight - out.bfm - out.ffm) <= 0.3;
    const verified = { weight: okWFM, bfm: okWFM, ffm: okWFM, pbf: out.pbf != null && out.bfm != null && out.weight != null && Math.abs(out.bfm / out.weight * 100 - out.pbf) <= 0.4, smm: false };   // 검산되면 이력 값이어도 믿는다
    for (const k of ['weight', 'smm', 'bfm', 'pbf', 'ffm']) { const x = best && best[k]; if (x && x.hist && !verified[k] && !doubt[k]) doubt[k] = '신체변화 그래프 값 — 결과지와 확인'; }
    if (out.bmi != null && out.weight != null && out.height == null) { const ih = Math.sqrt(out.weight / out.bmi) * 100; if (ih < 140 || ih > 210) doubt.bmi = doubt.bmi || `키 ${Math.round(ih)}cm 가 되는 값 — 확인`; }   // 키를 못 읽어도   // (마) 막대 옆 값을 못 읽고 이력 끝 값만 읽었을 때
    if (how.bmr === '계산' && !doubt.bmr) doubt.bmr = '계산값 — 결과지에 있으면 확인';
    if (['weight', 'bfm', 'ffm'].some((k) => doubt[k] && out[k] != null)) for (const k of Object.keys(how)) if (how[k] === '계산' && !doubt[k]) doubt[k] = '의심 칸으로 계산함';   // (나) 그 값으로 계산한 칸도
    return { v: out, how, box, doubt, sex: meta.sex, model: meta.model, ranges: meta.ranges };
  }
  function locate(words, v, dec) {   // 고친 값이 읽은 낱말 가운데 있으면 그 자리
    const want = dec ? Number(v).toFixed(String(v).split('.')[1]?.length || 1) : String(Math.round(v));
    const hit = words.filter((w) => nums(w.t).some((n) => n.s === want || (+n.s === +v && !n.alt)));
    return hit.length === 1 ? hit[0].b : hit.length > 1 ? null : null;
  }
  root.INB = { prep, resize, read, anchors, nums, locate, F };
  if (typeof module !== 'undefined') module.exports = root.INB;
})(typeof self !== 'undefined' ? self : globalThis);
