'use strict';

/* ───────── 리듬 정의 ─────────
 * 한 박 = 12틱 (16분음표 3틱, 셋잇단 8분 4틱을 모두 정수로 표현)
 * 각 리듬은 [길이(틱), 쉼표 여부] 목록
 */
const TPB = 12;
const R = true;
const RHYTHMS = [
  [[12]],                          // 1  4분음표
  [[3, R], [9]],                   // 2  16분쉼표 + 점8분
  [[6, R], [6]],                   // 3  8분쉼표 + 8분
  [[9, R], [3]],                   // 4  점8분쉼표 + 16분
  [[3], [9]],                      // 5  16분 + 점8분
  [[6], [6]],                      // 6  8분 2개
  [[9], [3]],                      // 7  점8분 + 16분
  [[3, R], [3], [6]],              // 8  16분쉼표 + 16분 + 8분
  [[3, R], [6], [3]],              // 9  16분쉼표 + 8분 + 16분
  [[6, R], [3], [3]],              // 10 8분쉼표 + 16분 2개
  [[3], [3], [6]],                 // 11 16분 2개 + 8분
  [[3], [6], [3]],                 // 12 16-8-16
  [[6], [3], [3]],                 // 13 8분 + 16분 2개
  [[4], [4], [4]],                 // 14 셋잇단
  [[3], [3], [3], [3]],            // 15 16분 4개
  [[3, R], [3], [3], [3]],         // 16 16분쉼표 + 16분 3개
].map(evs => {
  let tick = 0;
  const events = evs.map(([dur, rest]) => { const e = { tick, dur, rest: !!rest }; tick += dur; return e; });
  return { events, triplet: events.some(e => e.dur === 4) };
});

const CELLS = 8, BEATS_PER_BAR = 4;
const SYL = { 0: '#', 3: 'e', 6: '&', 9: 'a' };
const SYL_TRIP = { 0: '#', 4: 'la', 8: 'li' };

/* ───────── 설정 (브라우저에 저장) ───────── */
const STORE_KEY = 'random-rhythm:v1';
const DEFAULTS = {
  bpm: 80, instrument: 'woodblock', rhythmVol: 0.9, clickVol: 0.5,
  countIn: true, loop: true, autoDraw: false, showCount: false,
  pool: RHYTHMS.map((_, i) => i), seq: null,
};
const settings = Object.assign({}, DEFAULTS, (() => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; }
})());
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch { /* 저장 불가 환경은 무시 */ }
}

const $ = s => document.querySelector(s);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ───────── 악보 그리기 (SVG, 4:3) ───────── */
const LINES = [30, 44, 58, 72, 86];
const HEAD_Y = 72;

function restSVG(x, dur) {
  const hook = (cx, cy) =>
    `<circle class="fill" cx="${cx}" cy="${cy}" r="3.8"/>` +
    `<path class="stroke" stroke-width="2" d="M${cx} ${cy + 2.5} Q${cx + 5} ${cy + 5} ${cx + 9} ${cy - 2}"/>`;
  if (dur === 6) {
    return hook(x - 4, 51) + `<line stroke-width="2.2" x1="${x + 5}" y1="${49}" x2="${x - 2}" y2="${72}"/>`;
  }
  // 16분 쉼표 (3틱) / 점8분 쉼표 (9틱)
  if (dur === 3) {
    return hook(x - 2, 47) + hook(x - 5, 59) + `<line stroke-width="2.2" x1="${x + 7}" y1="${45}" x2="${x - 3}" y2="${80}"/>`;
  }
  return hook(x - 4, 51) + `<line stroke-width="2.2" x1="${x + 5}" y1="${49}" x2="${x - 2}" y2="${72}"/>` +
    `<circle class="fill" cx="${x + 11}" cy="${50}" r="2.6"/>`;
}

function rhythmSVG(idx, { showCount = false, beatNo = 1 } = {}) {
  const r = RHYTHMS[idx];
  const ev = r.events;
  const first = ev[0].tick, last = ev[ev.length - 1].tick;
  const step = ev.length === 1 ? 0 : 11;
  const X = tick => 78 + (tick - (first + last) / 2) * step;
  const top = r.triplet ? 22 : 12;

  let s = `<g class="staff">${LINES.map(y => `<line x1="0" y1="${y}" x2="160" y2="${y}" stroke-width="1.6"/>`).join('')}</g>`;
  s += '<g class="nt">';

  const notes = [];
  for (const e of ev) {
    const x = X(e.tick);
    if (e.rest) { s += restSVG(x, e.dur); continue; }
    notes.push({ x, sx: x + 7.6, dur: e.dur, tick: e.tick });
    s += `<ellipse class="fill" cx="${x}" cy="${HEAD_Y}" rx="8.6" ry="6.2" transform="rotate(-22 ${x} ${HEAD_Y})"/>`;
    s += `<line stroke-width="2" x1="${x + 7.6}" y1="${HEAD_Y - 2}" x2="${x + 7.6}" y2="${top}"/>`;
    if (e.dur === 9) s += `<circle class="fill" cx="${x + 15}" cy="${HEAD_Y - 6}" r="2.6"/>`;
    if (showCount) {
      const map = r.triplet ? SYL_TRIP : SYL;
      s += `<text class="syl" x="${x}" y="108">${(map[e.tick] || '').replace('#', beatNo)}</text>`;
    }
  }

  const beam = (a, b, y) => `<rect class="fill" x="${a - 1}" y="${y}" width="${b - a + 2}" height="6"/>`;
  const flag = (sx, y) => `<path class="stroke" stroke-width="2.6" d="M${sx} ${y} C${sx + 2} ${y + 11} ${sx + 14} ${y + 14} ${sx + 10} ${y + 30}"/>`;
  const n = notes.length;

  if (n === 1 && notes[0].dur < 12) {
    // 혼자 있는 8분/16분 → 꼬리
    const nt = notes[0];
    s += flag(nt.sx, top);
    if (nt.dur === 3) s += flag(nt.sx, top + 9);
  } else if (n > 1) {
    s += beam(notes[0].sx, notes[n - 1].sx, top);
    // 16분(3틱)은 두 번째 빔: 옆도 16분이면 연결, 아니면 짧은 꼬리
    for (let i = 0; i < n; i++) {
      if (notes[i].dur !== 3) continue;
      const y = top + 9;
      if (i < n - 1 && notes[i + 1].dur === 3) s += beam(notes[i].sx, notes[i + 1].sx, y);
      else if (i > 0 && notes[i - 1].dur === 3) continue;
      else if (i === n - 1) s += beam(notes[i].sx - 12, notes[i].sx, y);
      else s += beam(notes[i].sx, notes[i].sx + 12, y);
    }
    if (r.triplet) s += `<text class="tup" x="${(notes[0].sx + notes[n - 1].sx) / 2}" y="${top - 6}">3</text>`;
  }
  s += '</g>';
  return `<svg viewBox="0 -6 160 120" aria-hidden="true">${s}</svg>`;
}

/* ───────── 뽑기 ───────── */
let seq = [];

function drawRandom() {
  const pool = settings.pool.length ? settings.pool : RHYTHMS.map((_, i) => i);
  let picked;
  if (pool.length >= CELLS) {
    const a = [...pool];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    picked = a.slice(0, CELLS);
  } else {
    picked = Array.from({ length: CELLS }, () => pool[Math.floor(Math.random() * pool.length)]);
  }
  return picked;
}

function newDraw() {
  seq = drawRandom();
  settings.seq = seq;
  save();
  renderGrid(true);
}

let cellEls = [], progEls = [];
function renderGrid(animate) {
  const grid = $('#grid');
  grid.innerHTML = seq.map((idx, i) => `
    <div class="cell" data-i="${i}" title="${Math.floor(i / BEATS_PER_BAR) + 1}마디 ${(i % BEATS_PER_BAR) + 1}박 · 리듬 ${idx + 1}">
      <span class="beatno">${(i % BEATS_PER_BAR) + 1}</span>
      ${rhythmSVG(idx, { showCount: settings.showCount, beatNo: (i % BEATS_PER_BAR) + 1 })}
      <span class="prog"></span>
    </div>`).join('');
  cellEls = [...grid.querySelectorAll('.cell')];
  progEls = [...grid.querySelectorAll('.prog')];
  shownSeq = seq;
  shownCell = -1;
  if (animate) {
    grid.classList.remove('fresh');
    void grid.offsetWidth;
    grid.classList.add('fresh');
  }
}

/* ───────── 오디오 (사운드폰트 샘플) ───────── */
let ctx = null;
const buffers = {};      // instrument → AudioBuffer
const loading = {};      // instrument → Promise

function ensureCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  if (ctx.state === 'suspended') ctx.resume();
}

function loadInstrument(name) {
  if (name === 'synth' || buffers[name]) return Promise.resolve();
  if (loading[name]) return loading[name];
  setStatus('사운드폰트 불러오는 중…');
  loading[name] = fetch(`sounds/${name}.mp3`)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(ab => new Promise((ok, ng) => ctx.decodeAudioData(ab, ok, ng)))
    .then(buf => { buffers[name] = buf; setStatus(''); })
    .catch(() => {
      delete loading[name];
      setStatus('샘플을 불러오지 못해 합성음으로 재생합니다 (로컬 서버나 GitHub Pages에서 열어주세요)');
    });
  return loading[name];
}

function playRhythm(t) {
  const v = settings.rhythmVol;
  if (v <= 0) return;
  const buf = buffers[settings.instrument];
  if (buf) {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf;
    g.gain.value = v;
    src.connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + buf.duration);
    return;
  }
  // 합성음 대체 (우드블록 비슷한 톤)
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(600, t + 0.06);
  envelope(g, t, v * 0.9, 0.09);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + 0.1);
}

function envelope(g, t, peak, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
}

function playClick(t, accent) {
  const v = settings.clickVol;
  if (v <= 0) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = accent ? 1760 : 1175;
  envelope(g, t, v * (accent ? 0.7 : 0.4), 0.04);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + 0.05);
}

/* ───────── 스케줄러 ─────────
 * 25ms마다 120ms 앞까지 소리를 미리 예약 (Web Audio 시계 기준이라 박이 흔들리지 않음)
 */
const LOOKAHEAD = 0.12, TICK_MS = 25;
let running = false, starting = false, timer = null;
let nextBeatTime = 0, pos = 0;   // pos < 0 : 카운트인, 0..7 : 리듬 칸
let loopNo = 0;
let visQueue = [];                // { t, spb, cell, seq }
let endTime = null;

function scheduleBeat() {
  const spb = 60 / settings.bpm;
  const t = nextBeatTime;

  if (pos === 0 && loopNo > 0 && settings.autoDraw) {
    seq = drawRandom();
    settings.seq = seq;
    save();
  }

  playClick(t, pos < 0 ? pos === -BEATS_PER_BAR : pos % BEATS_PER_BAR === 0);
  if (pos >= 0) {
    for (const e of RHYTHMS[seq[pos]].events) {
      if (!e.rest) playRhythm(t + (e.tick / TPB) * spb);
    }
  }
  visQueue.push({ t, spb, cell: pos, seq });

  nextBeatTime += spb;
  pos++;
  if (pos === CELLS) {
    if (settings.loop) { pos = 0; loopNo++; }
    else { endTime = nextBeatTime; return false; }
  }
  return true;
}

function scheduler() {
  while (endTime === null && nextBeatTime < ctx.currentTime + LOOKAHEAD) {
    if (!scheduleBeat()) break;
  }
}

async function start() {
  ensureCtx();
  if (starting || running) return;
  starting = true;
  await loadInstrument(settings.instrument);
  starting = false;
  running = true;
  pos = settings.countIn ? -BEATS_PER_BAR : 0;
  loopNo = 0;
  endTime = null;
  visQueue = [];
  nextBeatTime = ctx.currentTime + 0.1;
  scheduler();
  timer = setInterval(scheduler, TICK_MS);
  $('#playBtn').textContent = '■ 정지';
  $('#playBtn').classList.add('running');
  requestAnimationFrame(frame);
}

function stop() {
  running = false;
  clearInterval(timer);
  $('#playBtn').textContent = '▶ 재생';
  $('#playBtn').classList.remove('running');
  highlight(-1, 0);
  setStatus('');
}

/* ───────── 화면 동기화 ───────── */
let shownSeq = null, shownCell = -1;

function frame() {
  if (!running) return;
  const now = ctx.currentTime - (ctx.outputLatency || 0);
  if (endTime !== null && now >= endTime) { stop(); return; }

  while (visQueue.length > 1 && visQueue[1].t <= now) visQueue.shift();
  const cur = visQueue[0];
  if (cur && cur.t <= now) {
    if (cur.seq !== shownSeq) renderGrid(true);
    if (cur.cell < 0) {
      highlight(-1, 0);
      setStatus(`카운트 ${cur.cell + BEATS_PER_BAR + 1}`);
    } else {
      if (shownCell < 0) setStatus('');
      highlight(cur.cell, clamp((now - cur.t) / cur.spb, 0, 1));
    }
  }
  requestAnimationFrame(frame);
}

function highlight(cell, frac) {
  if (cell !== shownCell) {
    cellEls.forEach((el, i) => el.classList.toggle('on', i === cell));
    progEls.forEach(p => { p.style.width = '0'; });
    shownCell = cell;
  }
  if (cell >= 0 && progEls[cell]) progEls[cell].style.width = `${frac * 100}%`;
}

let statusText = '';
function setStatus(msg) {
  if (msg === statusText) return;
  statusText = msg;
  $('#status').innerHTML = msg || '&nbsp;';
}

/* ───────── 뽑기 대상 선택 ───────── */
function renderPool() {
  $('#poolGrid').innerHTML = RHYTHMS.map((_, i) => `
    <button type="button" class="chip" data-i="${i}" aria-label="리듬 ${i + 1}">
      <span class="cno">${i + 1}</span>${rhythmSVG(i)}
    </button>`).join('');
  refreshPool();
}

function refreshPool() {
  const set = new Set(settings.pool);
  document.querySelectorAll('.chip').forEach(el => {
    const on = set.has(+el.dataset.i);
    el.classList.toggle('in', on);
    el.setAttribute('aria-pressed', on);
  });
  $('#poolCount').textContent = `(${settings.pool.length}/${RHYTHMS.length})`;
}

/* ───────── 컨트롤 ───────── */
function setBpm(v) {
  settings.bpm = clamp(Math.round(v) || DEFAULTS.bpm, 30, 240);
  $('#bpmNum').value = settings.bpm;
  $('#bpmRange').value = settings.bpm;
  save();
}

function bindControls() {
  $('#drawBtn').addEventListener('click', newDraw);
  $('#playBtn').addEventListener('click', () => (running ? stop() : start()));

  document.querySelectorAll('.step').forEach(b =>
    b.addEventListener('click', () => setBpm(settings.bpm + +b.dataset.bpm)));
  $('#bpmRange').addEventListener('input', e => setBpm(+e.target.value));
  $('#bpmNum').addEventListener('change', e => setBpm(+e.target.value));

  const inst = $('#instrument');
  inst.value = settings.instrument;
  inst.addEventListener('change', () => {
    settings.instrument = inst.value;
    save();
    ensureCtx();
    loadInstrument(inst.value).then(() => { if (!running) playRhythm(ctx.currentTime + 0.02); });
  });

  for (const key of ['rhythmVol', 'clickVol']) {
    const el = $(`#${key}`);
    el.value = settings[key];
    el.addEventListener('input', () => { settings[key] = +el.value; save(); });
  }
  for (const key of ['countIn', 'loop', 'autoDraw', 'showCount']) {
    const el = $(`#${key}`);
    el.checked = !!settings[key];
    el.addEventListener('change', () => {
      settings[key] = el.checked;
      save();
      if (key === 'showCount') { renderGrid(false); highlight(shownCell, 0); }
    });
  }

  $('#poolGrid').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const i = +chip.dataset.i;
    const set = new Set(settings.pool);
    set.has(i) ? set.delete(i) : set.add(i);
    settings.pool = [...set].sort((a, b) => a - b);
    save();
    refreshPool();
  });
  $('#poolAll').addEventListener('click', () => { settings.pool = RHYTHMS.map((_, i) => i); save(); refreshPool(); });
  $('#poolNone').addEventListener('click', () => { settings.pool = []; save(); refreshPool(); });

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const typing = e.target.matches('input[type="number"], select');
    if (e.code === 'Space' && !typing) {
      e.preventDefault();
      newDraw();
    } else if (e.code === 'Enter' && !typing && !e.target.matches('button, summary')) {
      e.preventDefault();
      running ? stop() : start();
    } else if (e.code === 'Escape' && running) {
      stop();
    } else if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && !typing) {
      e.preventDefault();
      setBpm(settings.bpm + (e.code === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 5 : 1));
    }
  });
  // 버튼에 포커스가 남아 있을 때 Space가 버튼을 한 번 더 누르지 않도록
  document.querySelectorAll('button').forEach(b => b.addEventListener('keyup', e => {
    if (e.code === 'Space') e.preventDefault();
  }));
}

/* ───────── 초기화 ───────── */
settings.pool = (settings.pool || []).filter(i => i >= 0 && i < RHYTHMS.length);
seq = Array.isArray(settings.seq) && settings.seq.length === CELLS && settings.seq.every(i => RHYTHMS[i])
  ? settings.seq
  : drawRandom();
settings.seq = seq;
renderGrid(false);
renderPool();
setBpm(settings.bpm);
bindControls();
