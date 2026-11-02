// =============================================================
//  game.js —— 奶龙·维京突击 主逻辑
// =============================================================
'use strict';

const W = 540, H = 960;
const FONT = '"ZCOOL KuaiLe","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
let scale = 1;

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function resize() {
  const r = cvs.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cvs.width = Math.max(1, Math.round(r.width * dpr));
  cvs.height = Math.max(1, Math.round(r.height * dpr));
  scale = cvs.width / W;
}
addEventListener('resize', resize);

// ---------- 本地存储（失败也不影响游戏） ----------
const HI_KEY = 'nailong_viking_hi';
function loadHi() { try { return +localStorage.getItem(HI_KEY) || 0; } catch (e) { return 0; } }
function saveHi(v) { try { localStorage.setItem(HI_KEY, String(v)); } catch (e) { /* ignore */ } }
let hiScore = loadHi();

// ---------- 关卡主题 ----------
const THEMES = [
  { name: '峡湾晨曦', top: '#55B8E6', bot: '#1E6AA8', glint: 'rgba(255,255,255,0.45)', isl: '#62B35A', isl2: '#3F8A3E', sand: '#EED9A0', shallow: 'rgba(160,240,255,0.35)', snow: true, tree: '#2F6B33' },
  { name: '冰川海域', top: '#8FD3EE', bot: '#2C7DB5', glint: 'rgba(255,255,255,0.6)', isl: '#F2FAFF', isl2: '#CFE8F7', sand: '#B6DDF2', shallow: 'rgba(220,250,255,0.4)', snow: false, tree: null, ice: true },
  { name: '橘子群岛', top: '#FFB070', bot: '#B0507A', glint: 'rgba(255,240,200,0.5)', isl: '#7FB069', isl2: '#5C8E4A', sand: '#F5D6A0', shallow: 'rgba(255,220,180,0.35)', snow: false, tree: '#FF9A1F' },
  { name: '极光之夜', top: '#10274A', bot: '#060F22', glint: 'rgba(160,220,255,0.35)', isl: '#2F5D4A', isl2: '#1F4334', sand: '#6C7A86', shallow: 'rgba(120,200,255,0.18)', snow: true, tree: '#173A2C', aurora: true },
];

// ---------- 全局状态 ----------
let state = 'title'; // title | play | pause | over
let gT = 0, last = 0;
let stage = 1, stageT = 0, waveT = 2, phase = 'waves', phaseT = 0;
const STAGE_LEN = 55;
let score = 0, kills = 0, saved = 0, maxCombo = 0;
let shake = 0, hurtFlash = 0, whiteFlash = 0;
let theme = THEMES[0];
let bombFx = null, bombId = 0;
let killsSinceDrop = 0;
let deadT = 0;

const P = {};
let pBullets = [], enemies = [], eBullets = [], pickups = [], chutes = [], parts = [], banners = [];
let boss = null;

function D() { return 1 + 0.14 * (stage - 1); }    // 射击频率系数
function DV() { return 1 + 0.06 * (stage - 1); }   // 子弹速度系数

function resetPlayer() {
  Object.assign(P, {
    x: W / 2, y: H - 170, tilt: 0, lives: 3, bombs: 3, power: 1,
    inv: 2, shield: 0, fireT: 0, axeT: 0, focus: false, dead: false,
    mood: 'happy', moodT: 0, combo: 0, comboT: 0, say: null, sayT: 0, trailT: 0,
  });
}
resetPlayer();

// =============================================================
//  背景：大海、岛屿、云朵、极光
// =============================================================
const bg = { glints: [], islands: [], clouds: [], stars: [], islandT: 1, cloudT: 0, scroll: 0 };
function initBg() {
  bg.glints = []; bg.islands = []; bg.clouds = [];
  for (let i = 0; i < 70; i++) bg.glints.push({ x: rand(0, W), y: rand(0, H), w: rand(6, 16), s: rand(0.8, 1.2), ph: rand(0, TAU) });
  for (let i = 0; i < 70; i++) bg.stars.push({ x: rand(0, W), y: rand(0, H * 0.6), r: rand(0.6, 1.8), ph: rand(0, TAU) });
  for (let i = 0; i < 3; i++) { const isl = makeIsland(); isl.y = rand(0, H); bg.islands.push(isl); }
  for (let i = 0; i < 3; i++) { const c = makeCloud(); c.y = rand(0, H); bg.clouds.push(c); }
}
function makeIsland() {
  const r = rand(45, 115), n = 14, pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, k = rand(0.72, 1.15);
    pts.push([Math.cos(a) * r * k, Math.sin(a) * r * 0.78 * k]);
  }
  const trees = [];
  const nt = Math.floor(r / 9);
  for (let i = 0; i < nt; i++) { const a = rand(0, TAU), d = rand(0, r * 0.6); trees.push([Math.cos(a) * d, Math.sin(a) * d * 0.7, rand(3, 6)]); }
  return { x: rand(-30, W + 30), y: -r * 1.4, r, pts, trees, th: theme, rot: rand(0, TAU) };
}
function makeCloud() {
  const parts = [], n = randi(4, 7), w = rand(60, 130);
  for (let i = 0; i < n; i++) parts.push([rand(-w, w), rand(-18, 18), rand(22, 42)]);
  return { x: rand(-40, W + 40), y: -120, parts, sp: rand(150, 210), a: rand(0.55, 0.85) };
}
function blobPath(g, pts, s) {
  const n = pts.length;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2 * s, my = (p[1] + q[1]) / 2 * s;
    if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(p[0] * s, p[1] * s, mx, my);
  }
  const p = pts[0], q = pts[1];
  g.quadraticCurveTo(p[0] * s, p[1] * s, (p[0] + q[0]) / 2 * s, (p[1] + q[1]) / 2 * s);
  g.closePath();
}
function updateBg(dt) {
  bg.scroll += dt;
  for (const g of bg.glints) { g.y += 70 * g.s * dt; if (g.y > H + 10) { g.y = -10; g.x = rand(0, W); } }
  bg.islandT -= dt;
  if (bg.islandT <= 0) { bg.islandT = rand(3.5, 7); bg.islands.push(makeIsland()); }
  for (const i of bg.islands) i.y += 55 * dt;
  bg.islands = bg.islands.filter(i => i.y < H + i.r * 1.5);
  bg.cloudT -= dt;
  if (bg.cloudT <= 0) { bg.cloudT = rand(2.5, 5); bg.clouds.push(makeCloud()); }
  for (const c of bg.clouds) c.y += c.sp * dt;
  bg.clouds = bg.clouds.filter(c => c.y < H + 160);
}
function drawBg() {
  const th = theme;
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, th.top); gr.addColorStop(1, th.bot);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);

  if (th.aurora) {
    for (const s of bg.stars) {
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(gT * 2 + s.ph);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cols = ['rgba(80,255,170,0.10)', 'rgba(140,110,255,0.09)', 'rgba(60,220,255,0.08)'];
    for (let b = 0; b < 3; b++) {
      ctx.strokeStyle = cols[b]; ctx.lineWidth = 50 - b * 10;
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 20) {
        const y = 140 + b * 70 + Math.sin(x * 0.012 + gT * 0.5 + b) * 40 + Math.sin(x * 0.03 + gT * 0.9) * 12;
        if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  // 海浪闪光
  ctx.strokeStyle = th.glint; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (const g of bg.glints) {
    const a = 0.5 + 0.5 * Math.sin(gT * 2 + g.ph);
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(g.x, g.y, g.w, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // 岛屿
  for (const isl of bg.islands) {
    const t = isl.th;
    ctx.save(); ctx.translate(isl.x, isl.y); ctx.rotate(isl.rot);
    blobPath(ctx, isl.pts, 1.35); ctx.fillStyle = t.shallow; ctx.fill();
    blobPath(ctx, isl.pts, 1.12); ctx.fillStyle = t.sand; ctx.fill();
    blobPath(ctx, isl.pts, 1); ctx.fillStyle = t.isl; ctx.fill();
    blobPath(ctx, isl.pts, 0.6); ctx.fillStyle = t.isl2; ctx.fill();
    if (t.snow) { blobPath(ctx, isl.pts, 0.28); ctx.fillStyle = '#F5FBFF'; ctx.fill(); }
    if (t.ice) {
      ctx.strokeStyle = 'rgba(120,180,220,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-isl.r * 0.4, -isl.r * 0.1); ctx.lineTo(0, isl.r * 0.1); ctx.lineTo(isl.r * 0.3, -isl.r * 0.2); ctx.stroke();
    }
    if (t.tree) {
      for (const [x, y, r] of isl.trees) {
        if (Math.hypot(x, y) < isl.r * 0.3 && t.snow) continue;
        ctx.fillStyle = t.tree; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  // 云的影子
  ctx.fillStyle = 'rgba(0,20,50,0.12)';
  for (const c of bg.clouds) {
    ctx.beginPath();
    for (const [dx, dy, r] of c.parts) { ctx.moveTo(c.x + dx + 40 + r, c.y + dy + 50); ctx.arc(c.x + dx + 40, c.y + dy + 50, r, 0, TAU); }
    ctx.fill();
  }
}
function drawClouds() {
  for (const c of bg.clouds) {
    ctx.globalAlpha = c.a * (theme.aurora ? 0.35 : 0.8);
    ctx.fillStyle = theme.aurora ? '#9fb3d6' : '#FFFFFF';
    ctx.beginPath();
    for (const [dx, dy, r] of c.parts) { ctx.moveTo(c.x + dx + r, c.y + dy); ctx.arc(c.x + dx, c.y + dy, r, 0, TAU); }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// =============================================================
//  粒子 / 文字
// =============================================================
function addPart(p) { if (parts.length < 700) parts.push(p); }
function spark(x, y, n, col, sp = 260, life = 0.45) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(sp * 0.3, sp);
    addPart({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(life * 0.5, life), max: life, col, w: rand(1.5, 3) });
  }
}
function floatText(x, y, str, col = '#FFF', size = 22, life = 1) {
  addPart({ k: 'text', x, y, vx: 0, vy: -50, life, max: life, str, col, size });
}
function sayBubble(x, y, str, life = 1.6, who = 'capy') {
  addPart({ k: 'bubble', x, y, vx: 0, vy: -12, life, max: life, str, who });
}
function explode(x, y, size = 1) {
  addPart({ k: 'flash', x, y, vx: 0, vy: 0, life: 0.15, max: 0.15, r: 50 * size });
  addPart({ k: 'ring', x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, r: 70 * size, col: 'rgba(255,230,150,' });
  spark(x, y, Math.floor(14 * size), '#FFE066', 320 * Math.sqrt(size), 0.5);
  spark(x, y, Math.floor(8 * size), '#FF8A00', 220 * Math.sqrt(size), 0.6);
  for (let i = 0; i < 6 * size; i++) {
    const a = rand(0, TAU), s = rand(20, 90) * size;
    addPart({ k: 'puff', x: x + rand(-10, 10) * size, y: y + rand(-10, 10) * size, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.5, 0.9), max: 0.9, r: rand(10, 20) * size, col: pick(['#FFB347', '#FF7F2A', '#FFD27A', '#9E9E9E']) });
  }
  for (let i = 0; i < 3 + 3 * size; i++) {
    const a = rand(0, TAU), s = rand(80, 260);
    addPart({ k: 'slice', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: rand(0.7, 1.2), max: 1.2, r: rand(5, 9), rot: rand(0, TAU), vr: rand(-10, 10) });
  }
  shake = Math.min(18, shake + 4 * size);
}
function updateParts(dt) {
  for (const p of parts) {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.k === 'spark') { p.vx *= 0.92; p.vy *= 0.92; }
    else if (p.k === 'puff') { p.vx *= 0.94; p.vy *= 0.94; p.r += 14 * dt; }
    else if (p.k === 'slice') { p.vy += 380 * dt; p.rot += p.vr * dt; }
    else if (p.k === 'steam') { p.r += 10 * dt; p.vx *= 0.98; }
  }
  parts = parts.filter(p => p.life > 0);
}
function drawParts(layer) {
  for (const p of parts) {
    const t = clamp(p.life / p.max, 0, 1);
    if (layer === 'top' && p.k !== 'text' && p.k !== 'bubble') continue;
    if (layer !== 'top' && (p.k === 'text' || p.k === 'bubble')) continue;
    switch (p.k) {
      case 'spark':
        ctx.globalAlpha = t; ctx.strokeStyle = p.col; ctx.lineWidth = p.w;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
        break;
      case 'puff': case 'steam':
        ctx.globalAlpha = t * (p.k === 'steam' ? 0.45 : 0.75); ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        break;
      case 'flash':
        ctx.globalAlpha = t; ctx.fillStyle = '#FFFBE6';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.2 - t * 0.2), 0, TAU); ctx.fill();
        break;
      case 'ring':
        ctx.globalAlpha = 1; ctx.strokeStyle = p.col + t + ')'; ctx.lineWidth = 6 * t + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - t) + 6, 0, TAU); ctx.stroke();
        break;
      case 'slice':
        ctx.globalAlpha = Math.min(1, t * 2);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = '#FF9A1F'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, p.r, 0, Math.PI * 0.55); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#FFD08A'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, p.r * 0.7, 0.1, Math.PI * 0.45); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      case 'text': {
        const sc = p.max - p.life < 0.12 ? 0.6 + (p.max - p.life) / 0.12 * 0.4 : 1;
        ctx.globalAlpha = Math.min(1, t * 2.5);
        text(p.str, p.x, p.y, p.size * sc, p.col, 'center');
        break;
      }
      case 'bubble': drawSpeech(p.x, p.y, p.str, Math.min(1, t * 3), p.who); break;
    }
  }
  ctx.globalAlpha = 1;
}
function drawSpeech(x, y, str, alpha, who) {
  ctx.globalAlpha = alpha;
  ctx.font = `17px ${FONT}`;
  const w = ctx.measureText(str).width + 20, h = 30;
  x = clamp(x, w / 2 + 6, W - w / 2 - 6);
  ctx.fillStyle = who === 'nl' ? '#FFF3B0' : '#FFFFFF';
  ctx.strokeStyle = who === 'nl' ? '#C98F00' : '#6B4224';
  ctx.lineWidth = 2;
  rrect(ctx, x - w / 2, y - h, w, h, 12);
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6, y - 1); ctx.lineTo(x, y + 8); ctx.lineTo(x + 6, y - 1); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = who === 'nl' ? '#5a3a00' : '#4a2a14';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y - h / 2 + 1);
  ctx.globalAlpha = 1;
}
function text(str, x, y, size, color = '#fff', align = 'left', stroke = 'rgba(30,15,0,0.75)') {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.2); ctx.strokeStyle = stroke;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function blit(sp, x, y, rot = 0, sc = 1, alpha = 1) {
  ctx.save(); ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sc !== 1) ctx.scale(sc, sc);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
  ctx.restore();
}
function nailongSay(str, t = 1.4) { P.say = str; P.sayT = t; }

// =============================================================
//  敌人
// =============================================================
const ET = {
  scout: { hp: 2, rx: 24, ry: 22, score: 100, boom: 0.7 },
  diver: { hp: 3, rx: 15, ry: 28, score: 150, boom: 0.7 },
  tub: { hp: 12, rx: 42, ry: 30, score: 350, boom: 1.1 },
  bomber: { hp: 34, rx: 66, ry: 34, score: 900, boom: 1.6 },
};
const CAPY_TALK = ['噜～', '嗯。', '佛系', '情绪稳定', '泡澡去了', '无所谓', '橘子掉了吗', '…'];

function spawnEnemy(type, x, y, beh, opt = {}) {
  const T = ET[type];
  const hp = Math.ceil(T.hp * (1 + 0.3 * (stage - 1)));
  const e = Object.assign({
    type, x, y, x0: x, y0: y, hp, maxhp: hp, rx: T.rx, ry: T.ry, hy: 0, t: 0, beh,
    flash: -1, fireT: rand(0.8, 2.2), wait: 0, vx: 0, vy: 0, entered: false, gone: false, prop: rand(0, TAU),
  }, opt);
  enemies.push(e);
  return e;
}

function spawnWave() {
  const pool = [];
  const add = (n, w) => { for (let i = 0; i < w; i++) pool.push(n); };
  add('snake', 3); add('vee', 3); add('swoopL', 2); add('swoopR', 2);
  if (stageT > 8 || stage > 1) add('tubs', 3);
  if (stageT > 16 || stage > 1) add('divers', 2);
  if (stageT > 24 || stage > 1) add('bomber', stage > 2 ? 2 : 1);
  const w = pick(pool);
  const shootChance = 0.25 + 0.15 * (stage - 1);
  switch (w) {
    case 'snake': {
      const x0 = rand(130, W - 130), n = 5 + Math.min(3, stage - 1);
      for (let i = 0; i < n; i++) spawnEnemy('scout', x0, -40, 'sine', { vy: 150, amp: 95, freq: 2.2, ph: 0, wait: i * 0.28, shooter: Math.random() < shootChance });
      break;
    }
    case 'vee': {
      const cx = rand(170, W - 170);
      for (let i = 0; i < 5; i++) spawnEnemy('scout', cx + (i - 2) * 62, -40, 'straight', { vy: 165, wait: Math.abs(i - 2) * 0.25, shooter: Math.random() < shootChance + 0.15 });
      break;
    }
    case 'swoopL': case 'swoopR': {
      const dir = w === 'swoopL' ? 1 : -1, y0 = rand(70, 220), depth = rand(140, 300);
      for (let i = 0; i < 6; i++) spawnEnemy('scout', dir > 0 ? -50 : W + 50, y0, 'swoop', { dir, depth, spd: 270, wait: i * 0.22, shooter: Math.random() < shootChance });
      break;
    }
    case 'tubs': {
      const n = stage >= 3 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const x = (W / (n + 1)) * (i + 1) + rand(-30, 30);
        spawnEnemy('tub', x, -70, 'hover', { ty: rand(130, 300), stay: rand(4.5, 6.5), ph: rand(0, TAU), wait: i * 0.4, talk: Math.random() < 0.5 });
      }
      break;
    }
    case 'divers': {
      const n = 3 + Math.min(2, stage - 1);
      for (let i = 0; i < n; i++) spawnEnemy('diver', rand(60, W - 60), -60, 'dive', { ty: rand(80, 200), wait: i * 0.45, ang: Math.PI / 2 });
      break;
    }
    case 'bomber': {
      const x = rand(150, W - 150);
      spawnEnemy('bomber', x, -90, 'bomber', { vy: 48, fireT: 1.2 });
      for (const d of [-1, 1]) spawnEnemy('scout', x + d * 110, -60, 'straight', { vy: 70, wait: 0.6, shooter: true });
      break;
    }
  }
}

function spawnBoss() {
  const hp = 520 + 300 * (stage - 1);
  boss = {
    type: 'boss', x: W / 2, y: -170, hp, maxhp: hp, rx: 140, ry: 92, hy: 10, t: 0, beh: 'boss',
    flash: -1, wait: 0, entered: true, gone: false, oranges: 5,
    aT: 1.5, sT: 0, spT: 0, spA: 0, spiralOn: false, rT: 1, sumT: 4, talkT: 2.5, dying: 0, boomT: 0, prop: 0, angry: false,
  };
  enemies.push(boss);
  AU.boss = true;
}

function eShoot(x, y, ang, spd, kind) {
  const r = { orange: 7, bubble: 8, seed: 5 }[kind];
  eBullets.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r, kind, t: 0 });
}
const aimAng = (x, y) => Math.atan2(P.y - y, P.x - x);

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.wait > 0) { e.wait -= dt; continue; }
    e.t += dt; e.flash -= dt; e.prop += dt * 30;
    switch (e.beh) {
      case 'sine': e.y += e.vy * dt; e.x = e.x0 + e.amp * Math.sin(e.t * e.freq + e.ph); break;
      case 'straight': e.x += e.vx * dt; e.y += e.vy * dt; break;
      case 'swoop': {
        const p = e.t * e.spd;
        e.x = e.x0 + e.dir * p;
        e.y = e.y0 + e.depth * Math.sin(clamp(p / (W + 100), 0, 1) * Math.PI);
        break;
      }
      case 'hover':
        if (e.t < e.stay) { e.y += (e.ty - e.y) * Math.min(1, 2.2 * dt); e.x = e.x0 + Math.sin(e.t * 0.9 + e.ph) * 40; }
        else { e.vy += 160 * dt; e.y += e.vy * dt; }
        if (e.talk && e.t > 1.5) { e.talk = false; sayBubble(e.x, e.y - 40, pick(CAPY_TALK)); }
        if (Math.random() < dt * 4) addPart({ k: 'steam', x: e.x + rand(-25, 25), y: e.y - 5, vx: rand(-8, 8), vy: -40, life: 1, max: 1, r: rand(5, 9), col: '#FFFFFF' });
        break;
      case 'dive':
        if (e.t < 1) { e.y += (e.ty - e.y) * Math.min(1, 3 * dt); e.x += Math.sin(e.t * 20) * 20 * dt; }
        else {
          if (!e.launched) { e.launched = true; e.ang = P.dead ? Math.PI / 2 : aimAng(e.x, e.y); e.spd = 60; sfx('whoosh'); }
          e.spd = Math.min(640 * DV(), e.spd + 900 * dt);
          e.x += Math.cos(e.ang) * e.spd * dt; e.y += Math.sin(e.ang) * e.spd * dt;
          if (Math.random() < dt * 30) addPart({ k: 'puff', x: e.x - Math.cos(e.ang) * 30, y: e.y - Math.sin(e.ang) * 30, vx: 0, vy: 0, life: 0.4, max: 0.4, r: 5, col: '#FFC870' });
        }
        break;
      case 'bomber':
        e.y += e.vy * dt; e.x = e.x0 + Math.sin(e.t * 0.6) * 60;
        break;
      case 'boss': updateBoss(e, dt); break;
    }
    if (e.type !== 'boss') {
      if (e.y > -30 && e.y < H + 30 && e.x > -30 && e.x < W + 30) e.entered = true;
      if (e.entered && (e.y > H + 120 || e.y < -160 || e.x < -170 || e.x > W + 170)) e.gone = true;
      if (!e.entered && e.t > 14) e.gone = true;
      enemyFire(e, dt);
    }
  }
  enemies = enemies.filter(e => !e.gone);
}

function enemyFire(e, dt) {
  if (P.dead || e.y < 20 || e.y > H * 0.66) return;
  e.fireT -= dt;
  if (e.fireT > 0) return;
  switch (e.type) {
    case 'scout':
      e.fireT = rand(2.2, 4) / D();
      if (e.shooter) { eShoot(e.x, e.y + 18, aimAng(e.x, e.y), 175 * DV(), 'orange'); sfx('eshot'); }
      break;
    case 'tub':
      e.fireT = 1.5 / D();
      if (e.t < e.stay) {
        const a = aimAng(e.x, e.y);
        for (let k = -1; k <= 1; k++) eShoot(e.x, e.y + 12, a + k * 0.24, 195 * DV(), 'bubble');
        sfx('bubble');
      }
      break;
    case 'bomber':
      e.fireT = 1.7 / D();
      e.pat = (e.pat || 0) + 1;
      if (e.pat % 2) { for (let k = -3; k <= 3; k++) eShoot(e.x, e.y + 34, Math.PI / 2 + k * 0.17, 205 * DV(), 'seed'); }
      else { const n = 14, o = rand(0, TAU); for (let k = 0; k < n; k++) eShoot(e.x, e.y, o + k * TAU / n, 150 * DV(), 'orange'); }
      sfx('eshot');
      break;
  }
}

const BOSS_TALK = ['泡澡中，勿扰', '噜～', '情绪很稳定', '橘子不会掉的', '朕不慌', '水温刚好'];
function updateBoss(e, dt) {
  if (e.dying > 0) {
    e.dying -= dt; e.boomT -= dt;
    e.x += rand(-1, 1) * 2; e.y += 15 * dt;
    if (e.boomT <= 0) { e.boomT = 0.12; explode(e.x + rand(-130, 130), e.y + rand(-80, 80), rand(0.6, 1.2)); sfx('boom'); }
    if (e.dying <= 0) bossDie(e);
    return;
  }
  if (e.t < 3) e.y += (245 - e.y) * Math.min(1, 1.4 * dt);
  else { e.x = W / 2 + Math.sin((e.t - 3) * 0.45) * 125; e.y = 245 + Math.sin((e.t - 3) * 0.9) * 20; }
  if (Math.random() < dt * 8) addPart({ k: 'steam', x: e.x + rand(-110, 110), y: e.y + rand(-15, 10), vx: rand(-10, 10), vy: -50, life: 1.4, max: 1.4, r: rand(8, 14), col: '#FFFFFF' });
  const f = e.hp / e.maxhp;
  const want = Math.ceil(f * 5);
  while (e.oranges > want) {
    e.oranges--;
    const oy = e.y - 124 - e.oranges * 20;
    pickups.push({ kind: 'O', x: e.x, y: oy, vy: -120, vx: rand(-90, 90), t: 0, fall: true });
    floatText(e.x, oy - 20, '橘子掉啦！', '#FFB74D', 22);
    sfx('pop');
  }
  if (!e.angry && f < 0.35) { e.angry = true; sayBubble(e.x - 120, e.y - 105, '朕…有点认真了', 2.2); }
  if (e.t < 3 || P.dead) return;
  e.aT -= dt;
  if (e.aT <= 0) {
    e.aT = (f < 0.35 ? 1.05 : 1.45) / D();
    for (const d of [-1, 1]) {
      const cx = e.x + d * 150, cy = e.y + 55, a = aimAng(cx, cy);
      for (let k = -2; k <= 2; k++) eShoot(cx, cy, a + k * 0.16, 215 * DV(), 'orange');
    }
    sfx('eshot');
  }
  if (f < 0.72) {
    e.sT -= dt;
    if (e.sT <= 0) { e.spiralOn = !e.spiralOn; e.sT = e.spiralOn ? 2.6 : 1.7; }
    if (e.spiralOn) {
      e.spT -= dt;
      if (e.spT <= 0) {
        e.spT = 0.075; e.spA += 0.38;
        eShoot(e.x, e.y - 10, e.spA, 165 * DV(), 'bubble');
        if (f < 0.35) eShoot(e.x, e.y - 10, e.spA + Math.PI, 165 * DV(), 'bubble');
        sfx('bubble');
      }
    }
  }
  if (f < 0.35) {
    e.rT -= dt;
    if (e.rT <= 0) { e.rT = 1.7 / D(); const n = 20, o = rand(0, TAU); for (let k = 0; k < n; k++) eShoot(e.x, e.y, o + k * TAU / n, 140 * DV(), 'seed'); }
    e.sumT -= dt;
    if (e.sumT <= 0) { e.sumT = 6; for (const d of [-1, 1]) spawnEnemy('scout', e.x + d * 150, e.y + 40, 'straight', { vy: 170, shooter: true }); }
  }
  e.talkT -= dt;
  if (e.talkT <= 0) { e.talkT = rand(5, 8); sayBubble(e.x - 120, e.y - 105, pick(BOSS_TALK), 1.8); }
}

function damageEnemy(e, d) {
  if (e.gone || e.dying > 0) return;
  e.hp -= d;
  if (e.flash < -0.07) e.flash = 0.05;
  if (e.type === 'boss') score += 10;
  if (e.hp <= 0) {
    if (e.type === 'boss') startBossDeath(e); else killEnemy(e);
  }
}

function addScore(base, x, y) {
  const mult = 1 + Math.min(P.combo, 60) * 0.05;
  const v = Math.round(base * mult / 10) * 10;
  score += v;
  if (x != null) floatText(x, y, '+' + v, '#FFF3B0', 18, 0.8);
  return v;
}

function killEnemy(e) {
  e.gone = true; kills++;
  P.combo++; P.comboT = 2.2; maxCombo = Math.max(maxCombo, P.combo);
  const T = ET[e.type];
  addScore(T.score, e.x, e.y);
  explode(e.x, e.y, T.boom);
  sfx('boom');
  // 掉落
  killsSinceDrop++;
  const r = Math.random();
  if (e.type === 'bomber') { dropPickup('P', e.x, e.y); if (r < 0.4) dropPickup('B', e.x + 30, e.y); }
  else if (e.type === 'tub' && r < 0.3) dropPickup(Math.random() < 0.65 ? 'P' : 'S', e.x, e.y);
  else if (killsSinceDrop >= 22) dropPickup(P.power < 5 ? 'P' : pick(['S', 'B']), e.x, e.y);
  else if (r < 0.025) dropPickup(pick(['P', 'S']), e.x, e.y);
  // 噜噜跳伞
  const cc = { scout: 0.35, diver: 0.3, tub: 0.7, bomber: 1 }[e.type];
  if (Math.random() < cc) chutes.push({ x: e.x, y: e.y, t: 0, sw: rand(0, TAU), open: 0 });
}
function dropPickup(kind, x, y) { pickups.push({ kind, x, y, vy: -60, vx: 0, t: 0 }); if (kind === 'P') killsSinceDrop = 0; }

function startBossDeath(e) {
  e.dying = 2.4; e.boomT = 0;
  for (const b of eBullets) spark(b.x, b.y, 2, '#FFE066', 80, 0.3);
  eBullets = [];
  sayBubble(e.x - 120, e.y - 105, '噜……泡不下去了', 2.2);
  enemies.forEach(o => { if (o !== e && o.type !== 'boss') damageEnemy(o, 999); });
}
function bossDie(e) {
  e.gone = true; boss = null; AU.boss = false; kills++;
  const v = 10000 + 6000 * (stage - 1);
  score += v;
  floatText(e.x, e.y - 40, '+' + v, '#FFE066', 40, 2);
  explode(e.x, e.y, 3.2); explode(e.x - 90, e.y + 20, 1.6); explode(e.x + 90, e.y + 20, 1.6);
  whiteFlash = 0.6; shake = 26;
  sfx('bigboom');
  dropPickup('P', e.x - 40, e.y); dropPickup('B', e.x + 40, e.y); dropPickup('L', e.x, e.y + 20);
  for (let i = 0; i < 4; i++) chutes.push({ x: e.x + rand(-100, 100), y: e.y + rand(-30, 30), t: 0, sw: rand(0, TAU), open: 0, king: i === 0 });
  phase = 'clear'; phaseT = 4.5;
  banners.push({ k: 'clear', t: 4.2, max: 4.2 });
  nailongSay('我是奶龙！', 2.2); P.mood = 'roar'; P.moodT = 1.5;
  setTimeout(() => sfx('clear'), 600);
}

// =============================================================
//  玩家
// =============================================================
const keys = {};
const ptr = { active: false, tx: null, ty: null, sx: 0, sy: 0, px: 0, py: 0 };
let lastTap = 0;

function updatePlayer(dt) {
  if (P.dead) {
    deadT -= dt;
    if (deadT <= 0 && state === 'play') gameOver();
    return;
  }
  let mx = 0, my = 0;
  if (keys.ArrowLeft || keys.KeyA) mx--;
  if (keys.ArrowRight || keys.KeyD) mx++;
  if (keys.ArrowUp || keys.KeyW) my--;
  if (keys.ArrowDown || keys.KeyS) my++;
  P.focus = !!(keys.ShiftLeft || keys.ShiftRight);
  let tiltT = 0;
  if (mx || my) {
    ptr.tx = null;
    const sp = P.focus ? 210 : 440, l = Math.hypot(mx, my);
    P.x += mx / l * sp * dt; P.y += my / l * sp * dt;
    tiltT = mx;
  } else if (ptr.tx != null) {
    const dx = ptr.tx - P.x, dy = ptr.ty - P.y, d = Math.hypot(dx, dy);
    const maxd = (P.focus ? 500 : 1500) * dt;
    if (d > maxd) { P.x += dx / d * maxd; P.y += dy / d * maxd; } else { P.x = ptr.tx; P.y = ptr.ty; }
    tiltT = clamp(dx / 30, -1, 1);
  }
  P.x = clamp(P.x, 34, W - 34);
  P.y = clamp(P.y, 80, H - 60);
  P.tilt = lerp(P.tilt, tiltT, Math.min(1, dt * 10));

  P.inv = Math.max(0, P.inv - dt);
  P.shield = Math.max(0, P.shield - dt);
  if (P.moodT > 0) { P.moodT -= dt; if (P.moodT <= 0) P.mood = 'happy'; }
  if (P.sayT > 0) P.sayT -= dt;
  if (P.comboT > 0) { P.comboT -= dt; if (P.comboT <= 0) P.combo = 0; }

  // 发动机尾焰粒子
  P.trailT -= dt;
  if (P.trailT <= 0) {
    P.trailT = 0.03;
    for (const d of [-1, 1]) addPart({ k: 'puff', x: P.x + d * 15 + rand(-2, 2), y: P.y + 64, vx: rand(-10, 10), vy: rand(160, 220), life: 0.25, max: 0.35, r: rand(2.5, 4), col: '#9EE8FF' });
  }
  // 射击
  P.fireT -= dt;
  if (P.fireT <= 0) { P.fireT = 0.085; fire(); }
  if (P.power >= 3) {
    P.axeT -= dt;
    if (P.axeT <= 0) {
      P.axeT = P.power >= 5 ? 0.42 : 0.65;
      for (const d of [-1, 1]) pBullets.push({ k: 'axe', x: P.x + d * 50, y: P.y + 15, vx: d * 160, vy: -260, dmg: 3, life: 2.4, rot: 0 });
    }
  }
}

const SHOTS = [
  null,
  [[-9, 0], [9, 0]],
  [[-12, 0], [0, 0], [12, 0]],
  [[-12, 0], [0, 0], [12, 0], [-20, -0.12], [20, 0.12]],
  [[-12, 0], [0, 0], [12, 0], [-20, -0.12], [20, 0.12], [-26, -0.25], [26, 0.25]],
  [[-12, 0], [12, 0], [-20, -0.1], [20, 0.1], [-26, -0.22], [26, 0.22], [-30, -0.34], [30, 0.34]],
];
function fire() {
  const f = P.focus ? 0.3 : 1;
  for (const [ox, a] of SHOTS[P.power]) {
    const ang = a * f;
    pBullets.push({ k: 'milk', x: P.x + ox, y: P.y - 58, vx: Math.sin(ang) * 950, vy: -Math.cos(ang) * 950, dmg: 1, rot: ang });
  }
  if (P.power >= 5) pBullets.push({ k: 'fire', x: P.x, y: P.y - 66, vx: 0, vy: -1000, dmg: 3, rot: 0 });
  sfx('shoot');
}

function updatePBullets(dt) {
  for (const b of pBullets) {
    if (b.k === 'axe') {
      b.life -= dt; b.rot += dt * 16;
      let best = null, bd = 1e9;
      for (const e of enemies) {
        if (e.wait > 0 || e.dying > 0 || e.y < -20) continue;
        const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      const sp = 640;
      if (best) {
        const a = Math.atan2(best.y - b.y, best.x - b.x);
        b.vx = lerp(b.vx, Math.cos(a) * sp, Math.min(1, dt * 5));
        b.vy = lerp(b.vy, Math.sin(a) * sp, Math.min(1, dt * 5));
      } else { b.vy = lerp(b.vy, -sp, dt * 3); }
      if (b.life <= 0) b.dead = true;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < -40 || b.y > H + 40 || b.x < -40 || b.x > W + 40) b.dead = true;
    if (b.dead) continue;
    for (const e of enemies) {
      if (e.wait > 0 || e.gone || e.dying > 0) continue;
      const dx = (b.x - e.x) / (e.rx + 4), dy = (b.y - e.y - e.hy) / (e.ry + 4);
      if (dx * dx + dy * dy < 1) {
        damageEnemy(e, b.dmg);
        b.dead = true;
        spark(b.x, b.y, 2, '#FFF6C8', 140, 0.2);
        sfx('hit');
        break;
      }
    }
  }
  pBullets = pBullets.filter(b => !b.dead);
}

function updateEBullets(dt) {
  for (const b of eBullets) {
    b.t += dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < -40 || b.y > H + 40 || b.x < -40 || b.x > W + 40) { b.dead = true; continue; }
    if (P.dead) continue;
    const dx = b.x - P.x, dy = b.y - (P.y + 4);
    const d2 = dx * dx + dy * dy;
    if (P.shield > 0 && d2 < (50 + b.r) ** 2) { b.dead = true; spark(b.x, b.y, 4, '#9FD8FF', 150, 0.3); sfx('pop'); continue; }
    if (d2 < (b.r + 5) ** 2) { b.dead = true; hurtPlayer(); }
  }
  eBullets = eBullets.filter(b => !b.dead);
  // 机体碰撞
  if (!P.dead) {
    for (const e of enemies) {
      if (e.wait > 0 || e.gone || e.dying > 0) continue;
      const dx = (P.x - e.x) / (e.rx + 14), dy = (P.y - e.y - e.hy) / (e.ry + 14);
      if (dx * dx + dy * dy < 1) {
        if (P.shield > 0) { damageEnemy(e, 6); continue; }
        if (P.inv <= 0) { hurtPlayer(); if (e.type !== 'boss') damageEnemy(e, 10); }
      }
    }
  }
}

function hurtPlayer() {
  if (P.inv > 0 || P.shield > 0 || P.dead) return;
  P.lives--;
  sfx('hurt');
  explode(P.x, P.y, 1.2);
  hurtFlash = 0.5; shake = 16;
  if (P.lives < 0) {
    P.lives = 0; P.dead = true; deadT = 2;
    explode(P.x, P.y, 2.4); sfx('bigboom');
    return;
  }
  P.power = Math.max(1, P.power - 1);
  P.inv = 2.6; P.mood = 'hurt'; P.moodT = 1.2; P.combo = 0;
  nailongSay(pick(['呜…', '好痛！', '我的奶！']), 1.2);
  // 受伤时清掉身边子弹，避免连续中弹
  for (const b of eBullets) if ((b.x - P.x) ** 2 + (b.y - P.y) ** 2 < 160 * 160) { b.dead = true; spark(b.x, b.y, 2, '#fff', 80, 0.3); }
}

function useBomb() {
  if (state !== 'play' || P.dead || P.bombs <= 0 || bombFx) return;
  P.bombs--;
  bombId++;
  bombFx = { x: P.x, y: P.y, t: 0, id: bombId };
  P.inv = Math.max(P.inv, 1.6);
  P.mood = 'roar'; P.moodT = 1.2;
  nailongSay('奶龙吼——！', 1.3);
  shake = 20; whiteFlash = 0.25;
  sfx('bomb');
  updateBombBtn();
}
function updateBomb(dt) {
  if (!bombFx) return;
  bombFx.t += dt;
  const r = bombFx.t * 1300;
  for (const b of eBullets) {
    if ((b.x - bombFx.x) ** 2 + (b.y - bombFx.y) ** 2 < r * r) {
      b.dead = true; score += 10;
      spark(b.x, b.y, 2, '#FFE066', 120, 0.4);
    }
  }
  for (const e of enemies) {
    if (e.wait > 0 || e.bombHit === bombFx.id || e.y < -40) continue;
    if ((e.x - bombFx.x) ** 2 + (e.y - bombFx.y) ** 2 < (r + e.rx) ** 2) {
      e.bombHit = bombFx.id;
      damageEnemy(e, e.type === 'boss' ? Math.ceil(e.maxhp * 0.08) : 60);
    }
  }
  if (bombFx.t > 1) bombFx = null;
}

// =============================================================
//  道具 / 跳伞噜噜
// =============================================================
function updatePickups(dt) {
  for (const p of pickups) {
    p.t += dt;
    if (p.fall) { p.vy += 420 * dt; p.vx *= 0.98; if (p.vy > 110) p.fall = false; }
    else { p.vy = lerp(p.vy, 95, dt * 2); p.vx = Math.sin(p.t * 3) * 30; }
    const dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy);
    if (!P.dead && d < 130 && d > 1 && !p.fall) { p.x += dx / d * 520 * dt; p.y += dy / d * 520 * dt; }
    else { p.x += p.vx * dt; p.y += p.vy * dt; }
    p.x = clamp(p.x, 18, W - 18);
    if (!P.dead && d < 38) { p.dead = true; collect(p); }
    if (p.y > H + 40) p.dead = true;
  }
  pickups = pickups.filter(p => !p.dead);
}
function collect(p) {
  switch (p.kind) {
    case 'P':
      if (P.power < 5) { P.power++; floatText(P.x, P.y - 70, P.power === 5 ? '奶力 MAX！' : '奶力 UP！', '#FFFFFF', 26); nailongSay(P.power === 5 ? '奶力满满！' : '好喝！', 1); sfx('power'); }
      else { addScore(1000, P.x, P.y - 70); sfx('pickup'); }
      break;
    case 'B': P.bombs = Math.min(5, P.bombs + 1); floatText(P.x, P.y - 70, '龙吼 +1', '#FFB38A', 24); sfx('pickup'); updateBombBtn(); break;
    case 'S': P.shield = 10; floatText(P.x, P.y - 70, '维京盾阵！', '#9FD8FF', 26); sfx('power'); break;
    case 'L': P.lives = Math.min(6, P.lives + 1); floatText(P.x, P.y - 70, '1UP！', '#FF9EC0', 30); sfx('power'); break;
    case 'O': addScore(500 * stage, p.x, p.y); floatText(P.x, P.y - 90, '大帝的橘子！', '#FFB74D', 20); sfx('pickup'); break;
  }
}
function updateChutes(dt) {
  for (const c of chutes) {
    c.t += dt;
    c.open = Math.min(1, c.t * 2.5);
    if (c.t < 0.4) c.y -= 120 * dt * (1 - c.t / 0.4);
    else c.y += 70 * dt;
    c.x += Math.sin(c.t * 1.6 + c.sw) * 30 * dt;
    if (!P.dead && Math.abs(c.x - P.x) < 40 && Math.abs(c.y - P.y) < 46) {
      c.dead = true; saved++;
      addScore(c.king ? 3000 : 300, c.x, c.y);
      sayBubble(c.x, c.y - 30, c.king ? '朕投降了噜' : pick(['噜～谢谢', '投降噜', '嗯，好的', '佛系被俘']), 1.2);
      sfx('rescue');
    }
    if (c.y > H + 60) c.dead = true;
  }
  chutes = chutes.filter(c => !c.dead);
}

// =============================================================
//  流程控制
// =============================================================
function updateDirector(dt) {
  if (phase === 'waves') {
    stageT += dt;
    waveT -= dt;
    if (waveT <= 0 && stageT < STAGE_LEN) {
      spawnWave();
      if (stage >= 3 && Math.random() < 0.25) spawnWave();
      waveT = rand(2.1, 3.3) * Math.max(0.55, 1 - 0.09 * (stage - 1));
    }
    if (stageT >= STAGE_LEN && enemies.length === 0) {
      phase = 'warning'; phaseT = 3.2;
      banners.push({ k: 'warning', t: 3.2, max: 3.2 });
      sfx('warning');
    }
  } else if (phase === 'warning') {
    phaseT -= dt;
    if (phaseT <= 0) { phase = 'boss'; spawnBoss(); }
  } else if (phase === 'clear') {
    phaseT -= dt;
    if (phaseT <= 0) {
      stage++;
      theme = THEMES[(stage - 1) % THEMES.length];
      stageT = 0; waveT = 2; phase = 'waves';
      whiteFlash = 0.8;
      banners.push({ k: 'stage', t: 2.6, max: 2.6 });
    }
  }
}

function update(dt) {
  gT += dt;
  updateBg(dt);
  updateDirector(dt);
  updatePlayer(dt);
  updatePBullets(dt);
  updateEnemies(dt);
  updateEBullets(dt);
  updateBomb(dt);
  updatePickups(dt);
  updateChutes(dt);
  updateParts(dt);
  for (const b of banners) b.t -= dt;
  banners = banners.filter(b => b.t > 0);
  shake = Math.max(0, shake - dt * 35);
  hurtFlash = Math.max(0, hurtFlash - dt);
  whiteFlash = Math.max(0, whiteFlash - dt);
  if (score > hiScore) hiScore = score;
}

// =============================================================
//  绘制
// =============================================================
function drawPlayer() {
  if (P.dead) return;
  if (P.inv > 0 && P.shield <= 0 && Math.floor(gT * 14) % 2 === 0) return;
  const x = P.x, y = P.y;
  // 尾焰
  for (const d of [-1, 1]) {
    const fl = 14 + Math.sin(gT * 50 + d) * 4 + (P.focus ? 0 : 6);
    const gr = ctx.createLinearGradient(0, y + 56, 0, y + 56 + fl * 1.6);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.3, 'rgba(120,220,255,0.9)'); gr.addColorStop(1, 'rgba(60,140,255,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(x + d * 15 - 5, y + 56); ctx.quadraticCurveTo(x + d * 15, y + 56 + fl * 2, x + d * 15 + 5, y + 56); ctx.fill();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(P.tilt * 0.12);
  ctx.scale(1 - Math.abs(P.tilt) * 0.08, 1);
  ctx.drawImage(SPR.plane.c, -75, -75, 150, 150);
  const head = P.mood === 'hurt' ? SPR.nlHurt : P.mood === 'roar' ? SPR.nlRoar : SPR.nlHappy;
  const bob = Math.sin(gT * 5) * 1.2;
  ctx.drawImage(head.c, -30, -28 + bob, 60, 60);
  ctx.restore();
  // 护盾：一圈旋转的维京盾
  if (P.shield > 0) {
    const a = P.shield < 2 ? (Math.floor(gT * 10) % 2 ? 0.4 : 1) : 1;
    ctx.globalAlpha = 0.18 * a; ctx.fillStyle = '#9FD8FF';
    ctx.beginPath(); ctx.arc(x, y + 4, 52, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = '#CFEFFF'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + 4, 52, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const an = gT * 2.4 + i * TAU / 6;
      blit(SPR.shieldMini, x + Math.cos(an) * 52, y + 4 + Math.sin(an) * 52, an, 1, a);
    }
  }
  // 精准模式显示判定点
  if (P.focus) {
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#FF3D7F'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + 4, 5, 0, TAU); ctx.fill(); ctx.stroke();
  }
}

function drawEnemy(e) {
  if (e.wait > 0) return;
  const fl = e.flash > 0;
  switch (e.type) {
    case 'scout': {
      blit(fl ? SPR.scoutF : SPR.scout, e.x, e.y);
      ctx.fillStyle = 'rgba(230,230,230,0.6)';
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 27, 16 * Math.abs(Math.sin(e.prop)) + 3, 2.5, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'diver': {
      const rot = (e.ang || Math.PI / 2) - Math.PI / 2;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(rot);
      if (e.launched) {
        const fl2 = 18 + Math.sin(gT * 60) * 5;
        const gr = ctx.createLinearGradient(0, -34, 0, -34 - fl2);
        gr.addColorStop(0, '#FFF'); gr.addColorStop(0.4, '#FFB300'); gr.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-7, -32); ctx.quadraticCurveTo(0, -34 - fl2 * 1.6, 7, -32); ctx.fill();
      }
      ctx.restore();
      blit(fl ? SPR.diverF : SPR.diver, e.x, e.y, rot);
      break;
    }
    case 'tub': {
      blit(fl ? SPR.tubF : SPR.tub, e.x, e.y);
      ctx.fillStyle = 'rgba(230,230,230,0.6)';
      for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(e.x + d * 48, e.y + 32, 11 * Math.abs(Math.sin(e.prop + d)) + 2, 2, 0, 0, TAU); ctx.fill(); }
      break;
    }
    case 'bomber': {
      blit(fl ? SPR.bomberF : SPR.bomber, e.x, e.y);
      ctx.fillStyle = 'rgba(230,230,230,0.6)';
      for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(e.x + d * 42, e.y + 36, 18 * Math.abs(Math.sin(e.prop + d)) + 3, 2.6, 0, 0, TAU); ctx.fill(); }
      break;
    }
    case 'boss': {
      const sp = e.angry ? (fl ? SPR.bossAngryF : SPR.bossAngry) : (fl ? SPR.bossF : SPR.boss);
      // 侧桨
      ctx.fillStyle = 'rgba(230,230,230,0.55)';
      for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(e.x + d * 165, e.y - 30, 38, 38 * Math.abs(Math.sin(e.t * 25 + d)) + 4, 0, 0, TAU); ctx.fill(); }
      blit(sp, e.x, e.y);
      // 头上一摞橘子（随血量减少）
      for (let i = 0; i < e.oranges; i++) {
        const sway = Math.sin(e.t * 2 + i * 0.6) * i * 1.6;
        blit(SPR.orangeBig, e.x + sway, e.y - 124 - i * 20, sway * 0.02);
      }
      break;
    }
  }
  if ((e.type === 'tub' || e.type === 'bomber') && e.hp < e.maxhp) {
    const w = e.rx * 1.2;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(e.x - w / 2, e.y - e.ry - 18, w, 5);
    ctx.fillStyle = '#7CFC8A'; ctx.fillRect(e.x - w / 2, e.y - e.ry - 18, w * clamp(e.hp / e.maxhp, 0, 1), 5);
  }
}

function drawChute(c) {
  const o = c.open;
  ctx.save(); ctx.translate(c.x, c.y);
  ctx.rotate(Math.sin(c.t * 1.6 + c.sw) * 0.18);
  if (o > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of [-1, -0.35, 0.35, 1]) { ctx.moveTo(d * 24 * o, -38); ctx.lineTo(d * 6, -8); }
    ctx.stroke();
    ctx.save(); ctx.scale(o, o);
    ctx.beginPath(); ctx.moveTo(-28, -38); ctx.quadraticCurveTo(-28, -68, 0, -68); ctx.quadraticCurveTo(28, -68, 28, -38);
    ctx.quadraticCurveTo(21, -44, 14, -38); ctx.quadraticCurveTo(7, -44, 0, -38); ctx.quadraticCurveTo(-7, -44, -14, -38); ctx.quadraticCurveTo(-21, -44, -28, -38);
    ctx.closePath();
    ctx.fillStyle = c.king ? '#FFD54F' : '#FF9A1F'; ctx.fill();
    ctx.strokeStyle = '#B85A00'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.moveTo(-7, -41); ctx.quadraticCurveTo(-8, -64, 0, -68); ctx.quadraticCurveTo(8, -64, 7, -41); ctx.quadraticCurveTo(0, -44, -7, -41); ctx.fill();
    ctx.restore();
  }
  ctx.drawImage(SPR.capySmall.c, -20, -22, 40, 44);
  ctx.restore();
}

function drawEBullet(b) {
  const sp = b.kind === 'orange' ? SPR.bOrange : b.kind === 'bubble' ? SPR.bBubble : SPR.bSeed;
  const s = b.kind === 'bubble' ? 1 + Math.sin(b.t * 10) * 0.06 : 1;
  blit(sp, b.x, b.y, b.kind === 'orange' ? b.t * 4 : 0, s);
}

function drawHUD() {
  // 顶部渐变条
  const gr = ctx.createLinearGradient(0, 0, 0, 90);
  gr.addColorStop(0, 'rgba(8,18,34,0.55)'); gr.addColorStop(1, 'rgba(8,18,34,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 90);
  text('SCORE', 18, 20, 14, '#FFD23F');
  text(score.toLocaleString(), 18, 46, 30, '#FFFFFF');
  text('HI ' + hiScore.toLocaleString(), W - 18, 20, 14, '#FFD23F', 'right');
  text(`STAGE ${stage} · ${theme.name}`, W - 18, 46, 18, '#FFFFFF', 'right');
  // 底部：生命、龙吼、火力
  const by = H - 32;
  for (let i = 0; i < P.lives; i++) ctx.drawImage(SPR.nlIcon.c, 12 + i * 30, by - 22, 34, 34);
  for (let i = 0; i < P.bombs; i++) ctx.drawImage(SPR.horn.c, 14 + i * 26, by - 52, 26, 26);
  text('奶力', 16, by - 70, 15, '#FFF3B0');
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < P.power ? '#FFD23F' : 'rgba(255,255,255,0.2)';
    rrect(ctx, 54 + i * 15, by - 76, 12, 12, 3); ctx.fill();
  }
  if (P.shield > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(16, by - 96, 80, 6);
    ctx.fillStyle = '#9FD8FF'; ctx.fillRect(16, by - 96, 80 * P.shield / 10, 6);
  }
  // 连击
  if (P.combo >= 3) {
    const pul = 1 + Math.max(0, P.comboT - 1.9) * 1.5;
    ctx.globalAlpha = clamp(P.comboT, 0, 1);
    text(P.combo + ' 连击', 18, boss ? 128 : 92, 28 * pul, '#FFB347', 'left');
    text('x' + (1 + Math.min(P.combo, 60) * 0.05).toFixed(2), 20, boss ? 156 : 120, 16, '#FFF3B0', 'left');
    ctx.globalAlpha = 1;
  }
  // Boss 血条
  if (boss && boss.t > 0.5) {
    const f = clamp(boss.hp / boss.maxhp, 0, 1), w = W - 120;
    text('噜噜大帝 · 温泉堡垒', W / 2, 76, 16, '#FFE0B0', 'center');
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; rrect(ctx, 60, 88, w, 12, 6); ctx.fill();
    const bgr = ctx.createLinearGradient(60, 0, 60 + w, 0);
    bgr.addColorStop(0, '#FF5E3A'); bgr.addColorStop(1, '#FFB347');
    ctx.fillStyle = bgr; rrect(ctx, 60, 88, Math.max(12, w * f), 12, 6); ctx.fill();
  }
}

function drawBanners() {
  for (const b of banners) {
    const t = b.max - b.t; // 已经过的时间
    const a = Math.min(1, t * 4, b.t * 3);
    ctx.globalAlpha = a;
    if (b.k === 'warning') {
      ctx.fillStyle = 'rgba(180,0,20,0.35)'; ctx.fillRect(0, H * 0.4 - 60, W, 120);
      ctx.save(); ctx.beginPath(); ctx.rect(0, H * 0.4 - 60, W, 120); ctx.clip();
      ctx.fillStyle = 'rgba(255,210,63,0.85)';
      for (const yy of [H * 0.4 - 60, H * 0.4 + 48]) {
        for (let x = -40 + (gT * 120) % 40; x < W + 40; x += 40) {
          ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + 20, yy); ctx.lineTo(x + 32, yy + 12); ctx.lineTo(x + 12, yy + 12); ctx.fill();
        }
      }
      ctx.restore();
      if (Math.floor(gT * 4) % 2 === 0) text('WARNING', W / 2, H * 0.4 - 14, 48, '#FF4D4D', 'center', 'rgba(60,0,0,0.9)');
      text('噜噜大帝 驾驶温泉堡垒来袭！', W / 2, H * 0.4 + 26, 22, '#FFFFFF', 'center');
    } else if (b.k === 'clear') {
      const sc = 1 + Math.max(0, 0.3 - t) * 2;
      text('STAGE CLEAR', W / 2, H * 0.36, 52 * sc, '#FFD23F', 'center', 'rgba(90,50,0,0.9)');
      text('噜噜大帝泡澡失败！', W / 2, H * 0.36 + 48, 24, '#FFFFFF', 'center');
    } else if (b.k === 'stage') {
      text('STAGE ' + stage, W / 2, H * 0.36, 50, '#FFFFFF', 'center');
      text(theme.name, W / 2, H * 0.36 + 46, 28, '#FFD23F', 'center');
    }
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cvs.width, cvs.height);
  const sx = shake > 0 ? rand(-shake, shake) * 0.5 : 0, sy = shake > 0 ? rand(-shake, shake) * 0.5 : 0;
  ctx.setTransform(scale, 0, 0, scale, sx * scale, sy * scale);
  drawBg();
  for (const p of pickups) {
    const s = 1 + Math.sin(p.t * 6) * 0.06;
    blit(SPR['pk' + p.kind], p.x, p.y, 0, s);
  }
  for (const c of chutes) drawChute(c);
  for (const e of enemies) if (e.type === 'boss') drawEnemy(e);
  for (const e of enemies) if (e.type !== 'boss') drawEnemy(e);
  for (const b of pBullets) {
    if (b.k === 'milk') blit(SPR.milk, b.x, b.y, b.rot);
    else if (b.k === 'fire') blit(SPR.fire, b.x, b.y);
    else blit(SPR.axe, b.x, b.y, b.rot);
  }
  if (state !== 'title') drawPlayer(); else drawTitlePlane();
  drawParts('mid');
  drawClouds();
  if (bombFx) {
    const r = bombFx.t * 1300, a = 1 - bombFx.t;
    ctx.globalAlpha = a * 0.25; ctx.fillStyle = '#FFE680';
    ctx.beginPath(); ctx.arc(bombFx.x, bombFx.y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = a; ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 18 * a + 2;
    ctx.beginPath(); ctx.arc(bombFx.x, bombFx.y, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 6 * a + 1; ctx.strokeStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(bombFx.x, bombFx.y, r * 0.8, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const b of eBullets) drawEBullet(b);
  drawParts('top');
  if (state !== 'title' && !P.dead && P.sayT > 0) drawSpeech(P.x, P.y - 66, P.say, Math.min(1, P.sayT * 3), 'nl');
  if (state !== 'title') { drawHUD(); drawBanners(); }

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (hurtFlash > 0) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, 'rgba(255,0,40,0)'); vg.addColorStop(1, `rgba(255,0,40,${hurtFlash * 0.8})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  if (whiteFlash > 0) { ctx.fillStyle = `rgba(255,255,240,${Math.min(0.8, whiteFlash)})`; ctx.fillRect(0, 0, W, H); }
}

// 标题画面里悬停的奶龙
function drawTitlePlane() {
  const x = W / 2 + Math.sin(gT * 0.8) * 40, y = H * 0.2 + Math.sin(gT * 1.6) * 10;
  P.x = x; P.y = y; P.tilt = Math.cos(gT * 0.8) * 0.5; P.mood = 'happy';
  P.dead = false; P.inv = 0; P.shield = 0; P.focus = false;
  drawPlayer();
  // 后面追着的噜噜
  for (let i = 0; i < 3; i++) {
    const ex = W / 2 + (i - 1) * 150 + Math.sin(gT + i) * 20, ey = H * 0.06 + Math.sin(gT * 2 + i) * 8 - 20 + (i === 1 ? -30 : 0);
    blit(SPR.scout, ex, ey, 0, 0.8);
  }
  if (Math.random() < 0.3) addPart({ k: 'puff', x: x + pick([-15, 15]), y: y + 64, vx: rand(-10, 10), vy: rand(160, 220), life: 0.3, max: 0.35, r: rand(2.5, 4), col: '#9EE8FF' });
}

// =============================================================
//  游戏状态切换 / UI
// =============================================================
function showOverlay(id) { for (const o of ['title', 'over', 'pause']) $(o).classList.toggle('show', o === id); }
function updateBombBtn() { $('bombBtn').classList.toggle('empty', P.bombs <= 0); }

function startGame() {
  AU.init(); AU.boss = false; AU.startMusic();
  resetPlayer();
  pBullets = []; enemies = []; eBullets = []; pickups = []; chutes = []; parts = []; banners = [];
  boss = null; bombFx = null;
  stage = 1; stageT = 0; waveT = 1.5; phase = 'waves';
  if (/[?&]boss/.test(location.search)) stageT = STAGE_LEN;
  const m = location.search.match(/[?&]stage=(\d+)/);
  if (m) stage = Math.max(1, +m[1]);
  theme = THEMES[(stage - 1) % THEMES.length];
  score = 0; kills = 0; saved = 0; maxCombo = 0; killsSinceDrop = 0;
  shake = 0; hurtFlash = 0; whiteFlash = 0;
  initBg();
  banners.push({ k: 'stage', t: 2.6, max: 2.6 });
  nailongSay('出发咯！', 1.5);
  state = 'play';
  document.body.classList.add('playing');
  showOverlay(null);
  updateBombBtn();
}
const QUIPS = [
  '噜噜们表示：情绪稳定，下次再来。',
  '奶龙：我的奶……被喝光了。',
  '水豚泡澡去了，你也休息一下吧。',
  '多接几个跳伞的噜噜，分数涨得飞快哦。',
  '试试按住 Shift 精准躲子弹！',
  '橘子掉了三个，大帝还是很淡定。',
];
function gameOver() {
  state = 'over';
  document.body.classList.remove('playing');
  AU.stopMusic(); sfx('over');
  const isNew = score > loadHi();
  if (isNew) saveHi(score);
  hiScore = Math.max(hiScore, score);
  $('overTitle').textContent = isNew && score > 0 ? '新纪录！奶龙超厉害！' : '奶龙坠机了…';
  $('oScore').textContent = score.toLocaleString();
  $('oHi').textContent = hiScore.toLocaleString();
  $('oKills').textContent = kills;
  $('oSaved').textContent = saved;
  $('oStage').textContent = stage;
  $('oCombo').textContent = maxCombo;
  $('oQuip').textContent = pick(QUIPS);
  showOverlay('over');
}
function togglePause() {
  if (state === 'play') {
    state = 'pause'; showOverlay('pause'); AU.stopMusic();
  } else if (state === 'pause') {
    state = 'play'; showOverlay(null); AU.startMusic(); last = performance.now();
  }
}
function toTitle() {
  state = 'title';
  document.body.classList.remove('playing');
  AU.stopMusic();
  if (score > loadHi()) saveHi(score);
  $('hiTitle').textContent = hiScore.toLocaleString();
  enemies = []; eBullets = []; pBullets = []; pickups = []; chutes = []; boss = null; banners = [];
  stage = 1; theme = THEMES[0];
  showOverlay('title');
}
function toggleMute() {
  AU.init();
  AU.setMuted(!AU.muted);
  $('muteBtn').classList.toggle('off', AU.muted);
}

// ---------- 输入 ----------
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'KeyX' || e.code === 'KeyB') useBomb();
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Enter' && (state === 'title' || state === 'over')) startGame();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });

function toLogical(e) {
  const r = cvs.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
cvs.addEventListener('pointerdown', e => {
  AU.init();
  const p = toLogical(e);
  ptr.active = true; ptr.sx = p.x; ptr.sy = p.y; ptr.px = P.x; ptr.py = P.y;
  if (e.pointerType === 'mouse') { ptr.tx = p.x; ptr.ty = p.y; }
  try { cvs.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  const now = performance.now();
  if (e.pointerType !== 'mouse' && now - lastTap < 280) useBomb();
  lastTap = now;
});
cvs.addEventListener('pointermove', e => {
  const p = toLogical(e);
  if (e.pointerType === 'mouse') { ptr.tx = p.x; ptr.ty = p.y; }
  else if (ptr.active) { ptr.tx = ptr.px + (p.x - ptr.sx) * 1.25; ptr.ty = ptr.py + (p.y - ptr.sy) * 1.25; }
});
const endPtr = e => { ptr.active = false; if (e.pointerType !== 'mouse') ptr.tx = null; };
cvs.addEventListener('pointerup', endPtr);
cvs.addEventListener('pointercancel', endPtr);
cvs.addEventListener('contextmenu', e => e.preventDefault());

$('startBtn').addEventListener('click', startGame);
$('againBtn').addEventListener('click', startGame);
$('resumeBtn').addEventListener('click', togglePause);
$('quitBtn').addEventListener('click', toTitle);
$('pauseBtn').addEventListener('click', togglePause);
$('muteBtn').addEventListener('click', toggleMute);
$('bombBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); useBomb(); });

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
  last = now;
  if (state === 'play' || state === 'over') update(dt);
  else if (state !== 'pause') { gT += dt; updateBg(dt); updateParts(dt); shake = 0; }
  render();
  requestAnimationFrame(frame);
}

function boot() {
  resize();
  buildSprites();
  initBg();
  $('hiTitle').textContent = hiScore.toLocaleString();
  last = performance.now();
  requestAnimationFrame(frame);
}
boot();
if (document.fonts && document.fonts.load) document.fonts.load(`20px "ZCOOL KuaiLe"`).catch(() => {});
