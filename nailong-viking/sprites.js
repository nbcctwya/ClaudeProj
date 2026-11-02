// =============================================================
//  sprites.js —— 所有角色/战机都用 Canvas 矢量手绘，不依赖任何图片
// =============================================================
'use strict';

const TAU = Math.PI * 2;
const SPRITE_RES = 3; // 预渲染倍率，保证高分屏清晰

// ---------- 基础绘图工具 ----------
function ell(g, x, y, rx, ry, fill, stroke, lw) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.lineWidth = lw || 2; g.strokeStyle = stroke; g.stroke(); }
}
function rrect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function fs(g, fill, stroke, lw) {
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 2; g.stroke(); }
}
function makeSprite(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SPRITE_RES); c.height = Math.ceil(h * SPRITE_RES);
  const g = c.getContext('2d');
  g.scale(SPRITE_RES, SPRITE_RES);
  g.translate(w / 2, h / 2);
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  return { c, w, h };
}
// 受击闪白版本
function flashOf(sp) {
  const c = document.createElement('canvas');
  c.width = sp.c.width; c.height = sp.c.height;
  const g = c.getContext('2d');
  g.drawImage(sp.c, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(255,255,255,0.78)';
  g.fillRect(0, 0, c.width, c.height);
  return { c, w: sp.w, h: sp.h };
}

// ---------- 橘子 ----------
function drawOrange(g, x, y, r, leaf = true) {
  ell(g, x, y, r, r * 0.93, '#FF9A1F', '#C9620A', r * 0.13);
  // 果皮小点
  g.fillStyle = 'rgba(200,90,0,0.35)';
  for (let i = 0; i < 6; i++) {
    const a = i * 1.7, rr = r * (0.3 + (i % 3) * 0.18);
    g.beginPath(); g.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9, r * 0.05, 0, TAU); g.fill();
  }
  ell(g, x - r * 0.36, y - r * 0.32, r * 0.26, r * 0.15, 'rgba(255,255,255,0.6)');
  if (leaf) {
    g.save(); g.translate(x + r * 0.28, y - r * 0.92); g.rotate(-0.5);
    ell(g, 0, 0, r * 0.42, r * 0.17, '#5DBB4A', '#2E7D32', r * 0.06);
    g.restore();
    ell(g, x, y - r * 0.88, r * 0.09, r * 0.07, '#6D4C2B');
  }
}

// ---------- 奶龙（戴维京头盔） ----------
// s = 头的半高；mood: happy | hurt | roar
function drawNailong(g, s, mood = 'happy') {
  // 头盔牛角（在脑袋后面）
  for (const d of [-1, 1]) {
    g.beginPath();
    g.moveTo(d * s * 0.8, -s * 0.48);
    g.bezierCurveTo(d * s * 1.6, -s * 0.5, d * s * 1.7, -s * 1.25, d * s * 1.28, -s * 1.62);
    g.bezierCurveTo(d * s * 1.3, -s * 1.12, d * s * 1.02, -s * 0.86, d * s * 0.52, -s * 0.84);
    g.closePath();
    const hg = g.createLinearGradient(d * s * 0.6, 0, d * s * 1.6, 0);
    hg.addColorStop(0, '#FFF7E0'); hg.addColorStop(1, '#EAD7A8');
    fs(g, hg, '#9E8452', s * 0.07);
    // 牛角纹
    g.strokeStyle = 'rgba(158,132,82,0.55)'; g.lineWidth = s * 0.05;
    for (let k = 0; k < 3; k++) {
      const t = 0.3 + k * 0.2;
      g.beginPath();
      g.moveTo(d * s * (0.75 + t * 0.7), -s * (0.5 + t * 0.3));
      g.lineTo(d * s * (0.7 + t * 0.55), -s * (0.85 + t * 0.15));
      g.stroke();
    }
  }
  // 小龙尾巴尖（露在旁边，可爱）
  // 脑袋
  const headG = g.createRadialGradient(-s * 0.3, -s * 0.35, s * 0.1, 0, 0, s * 1.2);
  headG.addColorStop(0, '#FFE680'); headG.addColorStop(1, '#FFC81E');
  ell(g, 0, 0, s * 1.16, s * 0.98, headG);
  // 头盔
  g.save();
  g.beginPath(); g.ellipse(0, 0, s * 1.16, s * 0.98, 0, 0, TAU); g.clip();
  const mg = g.createLinearGradient(0, -s, 0, -s * 0.4);
  mg.addColorStop(0, '#E6ECF2'); mg.addColorStop(1, '#8D99A8');
  g.fillStyle = mg; g.fillRect(-s * 1.3, -s * 1.2, s * 2.6, s * 0.78);
  g.fillStyle = '#D9A92B'; g.fillRect(-s * 1.3, -s * 0.5, s * 2.6, s * 0.15);
  g.fillRect(-s * 0.08, -s * 1.1, s * 0.16, s * 0.62);
  g.fillStyle = '#8A6A12';
  for (let i = -4; i <= 4; i++) { g.beginPath(); g.arc(i * s * 0.26, -s * 0.425, s * 0.035, 0, TAU); g.fill(); }
  g.restore();
  ell(g, 0, 0, s * 1.16, s * 0.98, null, '#D99400', s * 0.07);

  // 眼睛
  for (const d of [-1, 1]) {
    const ex = d * s * 0.43, ey = -s * 0.02;
    if (mood === 'hurt') {
      g.strokeStyle = '#1b1b1b'; g.lineWidth = s * 0.1;
      g.beginPath();
      g.moveTo(ex - d * s * 0.16, ey - s * 0.15); g.lineTo(ex + d * s * 0.1, ey); g.lineTo(ex - d * s * 0.16, ey + s * 0.15);
      g.stroke();
    } else if (mood === 'roar') {
      g.strokeStyle = '#1b1b1b'; g.lineWidth = s * 0.1;
      g.beginPath(); g.arc(ex, ey + s * 0.08, s * 0.16, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    } else {
      ell(g, ex, ey, s * 0.2, s * 0.26, '#161616');
      ell(g, ex - s * 0.06, ey - s * 0.09, s * 0.075, s * 0.085, '#fff');
      ell(g, ex + s * 0.07, ey + s * 0.1, s * 0.035, s * 0.035, '#fff');
    }
  }
  // 腮红
  for (const d of [-1, 1]) ell(g, d * s * 0.78, s * 0.3, s * 0.17, s * 0.09, 'rgba(255,110,130,0.55)');
  // 嘴巴
  const open = mood === 'roar' ? 1.45 : mood === 'hurt' ? 0.55 : 1;
  g.beginPath();
  g.moveTo(-s * 0.34, s * 0.3);
  g.quadraticCurveTo(0, s * (0.3 + 0.58 * open), s * 0.34, s * 0.3);
  g.quadraticCurveTo(0, s * 0.42, -s * 0.34, s * 0.3);
  g.closePath();
  fs(g, '#8E1F2F', '#5a1018', s * 0.04);
  g.save(); g.clip();
  ell(g, 0, s * (0.3 + 0.5 * open), s * 0.2, s * 0.14 * open, '#FF7A8A');
  g.restore();
}

// ---------- 水豚噜噜 ----------
// s = 头的半宽；o: {orange, goggles, angry, crown}
function drawCapy(g, s, o = {}) {
  const fur = '#B57B4A', dark = '#6B4224', light = '#D6A577';
  // 耳朵
  for (const d of [-1, 1]) {
    ell(g, d * s * 0.72, -s * 0.82, s * 0.21, s * 0.17, dark);
    ell(g, d * s * 0.72, -s * 0.8, s * 0.1, s * 0.07, '#3c2412');
  }
  // 方方的大脑袋
  rrect(g, -s, -s * 0.95, s * 2, s * 1.8, s * 0.72);
  const hg = g.createLinearGradient(0, -s, 0, s);
  hg.addColorStop(0, '#C38A57'); hg.addColorStop(1, '#A56C3E');
  fs(g, hg, dark, s * 0.08);
  // 鼻吻
  rrect(g, -s * 0.8, -s * 0.12, s * 1.6, s * 0.9, s * 0.42);
  fs(g, light, dark, s * 0.05);
  for (const d of [-1, 1]) ell(g, d * s * 0.3, s * 0.12, s * 0.1, s * 0.065, '#3c2412');
  // 嘴
  g.strokeStyle = dark; g.lineWidth = s * 0.06;
  g.beginPath();
  g.moveTo(0, s * 0.27); g.lineTo(0, s * 0.42);
  g.moveTo(-s * 0.2, s * 0.45); g.quadraticCurveTo(-s * 0.1, s * 0.56, 0, s * 0.43);
  g.quadraticCurveTo(s * 0.1, s * 0.56, s * 0.2, s * 0.45);
  g.stroke();
  // 腮红
  for (const d of [-1, 1]) ell(g, d * s * 0.78, -s * 0.08, s * 0.14, s * 0.07, 'rgba(255,140,110,0.35)');
  // 眼睛
  if (o.goggles) {
    g.fillStyle = '#4a2f1a'; g.fillRect(-s * 1.03, -s * 0.52, s * 2.06, s * 0.2);
    for (const d of [-1, 1]) {
      ell(g, d * s * 0.42, -s * 0.42, s * 0.28, s * 0.25, '#A8E6FF', '#444', s * 0.1);
      ell(g, d * s * 0.42 - s * 0.08, -s * 0.5, s * 0.08, s * 0.05, 'rgba(255,255,255,0.9)');
    }
  } else {
    for (const d of [-1, 1]) {
      const ex = d * s * 0.45, ey = -s * 0.4;
      if (o.angry) {
        ell(g, ex, ey, s * 0.13, s * 0.15, '#fff', dark, s * 0.04);
        ell(g, ex, ey + s * 0.02, s * 0.065, s * 0.07, '#1a1009');
        g.strokeStyle = '#3c2412'; g.lineWidth = s * 0.08;
        g.beginPath(); g.moveTo(ex - d * s * 0.2, ey - s * 0.3); g.lineTo(ex + d * s * 0.12, ey - s * 0.18); g.stroke();
      } else {
        // 半眯的佛系眼
        ell(g, ex, ey, s * 0.1, s * 0.11, '#1a1009');
        g.beginPath(); g.ellipse(ex, ey, s * 0.14, s * 0.14, 0, Math.PI, TAU); g.fillStyle = '#BC8452'; g.fill();
        g.strokeStyle = dark; g.lineWidth = s * 0.05;
        g.beginPath(); g.moveTo(ex - s * 0.13, ey); g.lineTo(ex + s * 0.13, ey); g.stroke();
      }
    }
  }
  if (o.crown) {
    const cy = -s * 0.95;
    g.beginPath();
    g.moveTo(-s * 0.55, cy + s * 0.05);
    g.lineTo(-s * 0.6, cy - s * 0.38); g.lineTo(-s * 0.3, cy - s * 0.15);
    g.lineTo(0, cy - s * 0.45); g.lineTo(s * 0.3, cy - s * 0.15);
    g.lineTo(s * 0.6, cy - s * 0.38); g.lineTo(s * 0.55, cy + s * 0.05);
    g.closePath();
    fs(g, '#FFD54F', '#B8860B', s * 0.05);
    ell(g, 0, cy - s * 0.1, s * 0.07, s * 0.07, '#E53935');
    ell(g, -s * 0.32, cy - s * 0.05, s * 0.05, s * 0.05, '#42A5F5');
    ell(g, s * 0.32, cy - s * 0.05, s * 0.05, s * 0.05, '#42A5F5');
  }
  if (o.orange) drawOrange(g, 0, -s * 1.15, s * 0.36);
}

// ---------- 维京盾牌 ----------
function drawShield(g, x, y, r, style) {
  const pal = [
    ['#C62828', '#FAFAFA'], ['#1565C0', '#FFD54F'], ['#2E7D32', '#FAFAFA'], ['#F9A825', '#6D4C41'],
  ][style % 4];
  g.save(); g.translate(x, y);
  ell(g, 0, 0, r, r, pal[0]);
  g.save(); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
  g.fillStyle = pal[1];
  if (style % 2 === 0) { g.fillRect(0, -r, r, r); g.fillRect(-r, 0, r, r); }
  else { g.fillRect(-r, -r * 0.18, r * 2, r * 0.36); g.fillRect(-r * 0.18, -r, r * 0.36, r * 2); }
  g.restore();
  ell(g, 0, 0, r, r, null, '#4E342E', r * 0.22);
  ell(g, 0, 0, r * 0.3, r * 0.3, '#B0BEC5', '#546E7A', r * 0.08);
  g.restore();
}

// ---------- 奶龙的维京战机（机头朝上） ----------
function drawVikingPlane(g) {
  const woodD = '#5A3412';
  const woodGrad = (x0, x1) => {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, '#7B4A22'); gr.addColorStop(0.5, '#B9773D'); gr.addColorStop(1, '#7B4A22');
    return gr;
  };
  // 尾舵——红白条纹的维京帆
  g.save();
  g.beginPath(); g.moveTo(-15, 40); g.lineTo(15, 40); g.lineTo(24, 66); g.lineTo(-24, 66); g.closePath();
  g.save(); g.clip();
  for (let i = -4; i < 4; i++) { g.fillStyle = i % 2 ? '#D32F2F' : '#FAFAFA'; g.fillRect(i * 7, 38, 7, 30); }
  g.restore();
  fs(g, null, woodD, 2.2);
  g.restore();
  // 尾翼
  for (const d of [-1, 1]) {
    g.beginPath(); g.moveTo(d * 8, 42); g.lineTo(d * 32, 54); g.lineTo(d * 31, 62); g.lineTo(d * 8, 58); g.closePath();
    fs(g, '#A66A35', woodD, 2);
  }
  // 发动机舱
  for (const d of [-1, 1]) {
    rrect(g, d * 15 - 6, 28, 12, 28, 5);
    const eg = g.createLinearGradient(d * 15 - 6, 0, d * 15 + 6, 0);
    eg.addColorStop(0, '#5f6b75'); eg.addColorStop(0.5, '#cfd8dc'); eg.addColorStop(1, '#5f6b75');
    fs(g, eg, '#37474F', 1.6);
    ell(g, d * 15, 56, 5, 2.5, '#263238');
  }
  // 主翼
  for (const d of [-1, 1]) {
    g.beginPath();
    g.moveTo(d * 10, -10); g.lineTo(d * 60, 12);
    g.quadraticCurveTo(d * 68, 22, d * 60, 31);
    g.lineTo(d * 10, 26); g.closePath();
    fs(g, woodGrad(d * 10, d * 62), woodD, 2.6);
    g.save(); g.clip();
    g.strokeStyle = 'rgba(70,35,10,0.45)'; g.lineWidth = 1.2;
    for (let k = 1; k <= 3; k++) {
      g.beginPath(); g.moveTo(d * 10, -10 + k * 9); g.lineTo(d * 64, 12 + k * 5); g.stroke();
    }
    g.restore();
    // 金色翼缘
    g.strokeStyle = '#F2C14E'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(d * 12, -9); g.lineTo(d * 59, 12); g.stroke();
  }
  // 机身（长船）
  const fg = g.createLinearGradient(-16, 0, 16, 0);
  fg.addColorStop(0, '#6E3F1B'); fg.addColorStop(0.5, '#C4874A'); fg.addColorStop(1, '#6E3F1B');
  ell(g, 0, 6, 16, 46, fg, woodD, 2.6);
  g.save(); g.beginPath(); g.ellipse(0, 6, 16, 46, 0, 0, TAU); g.clip();
  g.strokeStyle = 'rgba(60,30,8,0.5)'; g.lineWidth = 1.3;
  for (const x of [-9, -3, 3, 9]) { g.beginPath(); g.moveTo(x, -45); g.lineTo(x, 55); g.stroke(); }
  g.restore();
  // 机翼上的维京盾牌
  let st = 0;
  for (const d of [-1, 1]) {
    drawShield(g, d * 26, 13, 7.5, st++);
    drawShield(g, d * 40, 18, 7.5, st++);
    drawShield(g, d * 54, 24, 7, st++);
  }
  // 龙首船艏
  g.beginPath();
  g.moveTo(-7, -33); g.quadraticCurveTo(-11, -50, -2, -58);
  g.lineTo(3, -57); g.quadraticCurveTo(10, -48, 7, -33); g.closePath();
  fs(g, '#F2C14E', '#9C6F0F', 1.6);
  // 龙头
  for (const d of [-1, 1]) {
    g.beginPath(); g.moveTo(d * 3, -64); g.lineTo(d * 10, -72); g.lineTo(d * 6, -61); g.closePath();
    fs(g, '#E53935', '#8E1B1B', 1.2);
  }
  ell(g, 0, -63, 7, 8.5, '#3FA45F', '#1F5A33', 1.6);
  ell(g, 0, -69, 4.5, 3.5, '#5CC07A');
  for (const d of [-1, 1]) ell(g, d * 3, -64, 1.4, 1.6, '#FFEB3B');
  // 座舱
  ell(g, 0, 4, 19.5, 19.5, 'rgba(170,225,255,0.45)', '#F2C14E', 2.8);
}

// ---------- 敌机 ----------
function drawScout(g) {
  for (const d of [-1, 1]) {
    g.save(); g.translate(d * 25, 0); g.rotate(d * 0.35);
    ell(g, 0, 0, 16, 7, '#5DBB4A', '#2E7D32', 2);
    g.strokeStyle = '#2E7D32'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-13, 0); g.lineTo(13, 0); g.stroke();
    g.restore();
  }
  ell(g, 0, 4, 23, 22, '#FF9A1F', '#C9620A', 2.6);
  g.strokeStyle = 'rgba(255,220,160,0.55)'; g.lineWidth = 1.4;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    g.beginPath(); g.moveTo(Math.cos(a) * 6, 4 + Math.sin(a) * 6); g.lineTo(Math.cos(a) * 20, 4 + Math.sin(a) * 19); g.stroke();
  }
  ell(g, 0, -3, 15, 12, '#6A2E05');
  g.save(); g.translate(0, -5); drawCapy(g, 11, { orange: true }); g.restore();
  ell(g, 0, 23, 4, 4, '#555');
}

function drawDiver(g) {
  // 尾翼（在上方，火箭头朝下）
  for (const d of [-1, 1]) {
    g.beginPath(); g.moveTo(d * 10, -22); g.lineTo(d * 22, -36); g.lineTo(d * 16, -14); g.closePath();
    fs(g, '#E53935', '#8E1B1B', 1.6);
  }
  const bg = g.createLinearGradient(-16, 0, 16, 0);
  bg.addColorStop(0, '#9CB52A'); bg.addColorStop(0.5, '#E6F07A'); bg.addColorStop(1, '#9CB52A');
  ell(g, 0, 0, 16, 32, bg, '#6E8016', 2.2);
  g.fillStyle = 'rgba(110,128,22,0.35)';
  for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(Math.sin(i * 2.3) * 9, -24 + i * 5, 1.1, 0, TAU); g.fill(); }
  ell(g, 0, 26, 7, 6, '#E53935');
  ell(g, 0, 2, 13, 13, 'rgba(255,255,255,0.35)', '#6E8016', 1.6);
  g.save(); g.translate(0, 3); drawCapy(g, 9, { goggles: true }); g.restore();
}

function drawTub(g) {
  for (const d of [-1, 1]) {
    g.beginPath(); g.moveTo(d * 30, 0); g.lineTo(d * 52, 6); g.lineTo(d * 50, 16); g.lineTo(d * 30, 16); g.closePath();
    fs(g, '#B0BEC5', '#546E7A', 2);
    rrect(g, d * 48 - 4, 2, 8, 18, 3); fs(g, '#78909C', '#37474F', 1.4);
  }
  // 浴缸脚
  for (const d of [-1, 1]) for (const e of [-1, 1]) ell(g, d * 26, 26 + e * 2, 5, 4, '#F2C14E', '#9C6F0F', 1.2);
  ell(g, 0, 8, 41, 26, '#FFFFFF', '#90A4AE', 3);
  ell(g, 0, 10, 36, 20, '#E3EEF2');
  ell(g, 0, 4, 34, 18, '#4FC3F7', '#29B6F6', 1.5);
  g.save(); g.translate(0, -12); drawCapy(g, 15, { orange: true }); g.restore();
  // 水面挡住下巴
  g.beginPath(); g.ellipse(0, 4, 34, 18, 0, 0.05, Math.PI - 0.05); g.lineTo(-30, 6);
  g.quadraticCurveTo(0, 14, 30, 6); g.closePath();
  g.fillStyle = '#4FC3F7'; g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2;
  g.beginPath(); g.ellipse(0, 8, 20, 4, 0, 0, TAU); g.stroke();
  // 小黄鸭
  ell(g, 30, -2, 6, 5, '#FFEB3B', '#C8A400', 1);
  ell(g, 33, -7, 4, 4, '#FFEB3B', '#C8A400', 1);
  ell(g, 37, -7, 2.5, 1.4, '#FF7043');
  ell(g, 34, -8, 0.9, 0.9, '#000');
}

function drawBomber(g) {
  for (const d of [-1, 1]) {
    g.beginPath();
    g.moveTo(d * 14, -22);
    g.bezierCurveTo(d * 52, -46, d * 86, -18, d * 80, 6);
    g.bezierCurveTo(d * 82, 18, d * 70, 22, d * 62, 20);
    g.bezierCurveTo(d * 52, 28, d * 40, 20, d * 30, 24);
    g.bezierCurveTo(d * 22, 26, d * 16, 22, d * 14, 20);
    g.closePath();
    const lg = g.createLinearGradient(d * 14, 0, d * 82, 0);
    lg.addColorStop(0, '#C5E1A5'); lg.addColorStop(1, '#7CB342');
    fs(g, lg, '#558B2F', 2.6);
    g.strokeStyle = 'rgba(85,139,47,0.8)'; g.lineWidth = 1.4;
    for (let k = 0; k < 5; k++) {
      g.beginPath(); g.moveTo(d * 16, 0); g.quadraticCurveTo(d * (36 + k * 6), -20 + k * 8, d * (60 + k * 3), -26 + k * 11); g.stroke();
    }
    rrect(g, d * 42 - 8, 4, 16, 30, 6);
    fs(g, '#90A4AE', '#37474F', 1.6);
  }
  rrect(g, -18, -48, 36, 96, 16);
  const fg = g.createLinearGradient(-18, 0, 18, 0);
  fg.addColorStop(0, '#6D4C41'); fg.addColorStop(0.5, '#A1887F'); fg.addColorStop(1, '#6D4C41');
  fs(g, fg, '#3E2723', 2.4);
  g.strokeStyle = 'rgba(62,39,35,0.5)'; g.lineWidth = 1.2;
  for (let y = -36; y < 44; y += 12) { g.beginPath(); g.moveTo(-15, y); g.quadraticCurveTo(0, y + 4, 15, y); g.stroke(); }
  // 机腹挂着的橘子炸弹
  for (const d of [-1, 1]) drawOrange(g, d * 24, 26, 6, false);
  g.save(); g.translate(0, -6); drawCapy(g, 18, { goggles: true, orange: true }); g.restore();
}

function drawBoss(g, angry) {
  // 侧面螺旋桨支架
  for (const d of [-1, 1]) {
    g.strokeStyle = '#5D4037'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(d * 120, -10); g.lineTo(d * 165, -30); g.stroke();
    ell(g, d * 165, -30, 12, 12, '#90A4AE', '#37474F', 2);
  }
  // 木桶温泉——桶身
  g.beginPath();
  g.moveTo(-140, 0); g.lineTo(-140, 56);
  g.ellipse(0, 56, 140, 50, 0, Math.PI, 0, true);
  g.lineTo(140, 0); g.closePath();
  const bg = g.createLinearGradient(-140, 0, 140, 0);
  bg.addColorStop(0, '#5D3A1A'); bg.addColorStop(0.5, '#B9773D'); bg.addColorStop(1, '#5D3A1A');
  fs(g, bg, '#3E2410', 4);
  g.save(); g.clip();
  g.strokeStyle = 'rgba(50,25,8,0.5)'; g.lineWidth = 2;
  for (let x = -126; x < 140; x += 18) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 110); g.stroke(); }
  g.strokeStyle = '#78909C'; g.lineWidth = 7;
  for (const y of [22, 58]) { g.beginPath(); g.ellipse(0, y, 141, 50, 0, 0.05, Math.PI - 0.05); g.stroke(); }
  g.restore();
  // 侧炮（橘子炮）
  for (const d of [-1, 1]) {
    rrect(g, d * 150 - 9, 30, 18, 34, 6); fs(g, '#546E7A', '#263238', 2);
    drawOrange(g, d * 150, 30, 15, true);
  }
  // 桶口
  ell(g, 0, 0, 140, 50, '#8B5A2B', '#3E2410', 4);
  const wg = g.createRadialGradient(0, 0, 10, 0, 0, 130);
  wg.addColorStop(0, '#9BE7F7'); wg.addColorStop(1, '#3CB4DA');
  ell(g, 0, 2, 126, 42, wg);
  // 漂浮的橘子
  drawOrange(g, -88, 10, 10, true); drawOrange(g, 92, 16, 9, true); drawOrange(g, 60, 26, 8, true);
  // 水豚大帝
  g.save(); g.translate(0, -40); drawCapy(g, 50, { crown: true, angry }); g.restore();
  // 前方水面
  g.save();
  g.beginPath(); g.ellipse(0, 2, 126, 42, 0, 0, TAU); g.clip();
  g.fillStyle = 'rgba(60,180,218,0.92)';
  g.beginPath(); g.moveTo(-130, 4);
  g.quadraticCurveTo(0, 24, 130, 4); g.lineTo(130, 60); g.lineTo(-130, 60); g.closePath(); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3;
  g.beginPath(); g.ellipse(0, 10, 58, 9, 0, 0.1, Math.PI - 0.1); g.stroke();
  // 小黄鸭们
  for (const [x, y] of [[-55, 26], [-20, 32], [100, -6]]) {
    ell(g, x, y, 7, 5.5, '#FFEB3B', '#C8A400', 1.2);
    ell(g, x + 4, y - 5, 4.5, 4.5, '#FFEB3B', '#C8A400', 1.2);
    ell(g, x + 9, y - 5, 3, 1.6, '#FF7043');
  }
}

// ---------- 子弹/道具 ----------
function drawMilkShot(g) {
  const gl = g.createRadialGradient(0, 2, 1, 0, 2, 9);
  gl.addColorStop(0, 'rgba(255,240,170,0.9)'); gl.addColorStop(1, 'rgba(255,220,90,0)');
  g.fillStyle = gl; g.fillRect(-10, -12, 20, 26);
  g.beginPath();
  g.moveTo(0, -10); g.quadraticCurveTo(5, 0, 4.5, 4); g.arc(0, 4, 4.5, 0, Math.PI); g.quadraticCurveTo(-5, 0, 0, -10);
  fs(g, '#FFFDF2', '#F2C14E', 1.2);
}
function drawFireShot(g) {
  const gl = g.createRadialGradient(0, 4, 1, 0, 2, 13);
  gl.addColorStop(0, '#FFFFFF'); gl.addColorStop(0.3, '#FFE066'); gl.addColorStop(0.7, 'rgba(255,140,0,0.7)'); gl.addColorStop(1, 'rgba(255,90,0,0)');
  g.fillStyle = gl;
  g.beginPath(); g.moveTo(0, -16); g.quadraticCurveTo(12, 2, 0, 15); g.quadraticCurveTo(-12, 2, 0, -16); g.fill();
}
function drawAxe(g) {
  g.strokeStyle = '#6D4C41'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 10); g.lineTo(0, -10); g.stroke();
  g.beginPath(); g.moveTo(0, -9); g.quadraticCurveTo(11, -12, 10, 0); g.quadraticCurveTo(6, -3, 0, -2); g.closePath();
  fs(g, '#E0E7EC', '#546E7A', 1.3);
}
function drawBulletOrange(g) {
  const gl = g.createRadialGradient(0, 0, 3, 0, 0, 12);
  gl.addColorStop(0, 'rgba(255,170,60,0.6)'); gl.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = gl; g.fillRect(-12, -12, 24, 24);
  drawOrange(g, 0, 0, 7.5, false);
}
function drawBulletBubble(g) {
  const gr = g.createRadialGradient(-2, -2, 1, 0, 0, 9);
  gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.35, '#BDF2FF'); gr.addColorStop(1, '#2E9BD6');
  ell(g, 0, 0, 9, 9, gr, '#0D5F8C', 1.6);
  ell(g, -3, -3.5, 2.6, 1.8, '#fff');
}
function drawBulletSeed(g) {
  const gl = g.createRadialGradient(0, 0, 1, 0, 0, 9);
  gl.addColorStop(0, '#FFFFFF'); gl.addColorStop(0.35, '#FF4FA0'); gl.addColorStop(1, 'rgba(255,40,140,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill();
  ell(g, 0, 0, 4.5, 4.5, '#FFE3F0', '#D81B60', 1.4);
}
function drawPickup(g, kind) {
  const ring = { P: '#FFFFFF', B: '#FF7043', S: '#42A5F5', L: '#FF6FA0', O: '#FFB74D' }[kind];
  const gl = g.createRadialGradient(0, 0, 4, 0, 0, 20);
  gl.addColorStop(0, ring); gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalAlpha = 0.55; g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.fill(); g.globalAlpha = 1;
  ell(g, 0, 0, 15, 15, 'rgba(20,40,70,0.55)', ring, 2.2);
  if (kind === 'P') { // 奶瓶
    rrect(g, -6, -6, 12, 16, 4); fs(g, '#FFFFFF', '#B0BEC5', 1.2);
    rrect(g, -4, -11, 8, 6, 2); fs(g, '#42A5F5', '#1565C0', 1);
    g.fillStyle = '#FFD23F'; g.fillRect(-6, 0, 12, 4);
  } else if (kind === 'B') { // 龙角号角
    g.beginPath(); g.moveTo(-9, 5); g.quadraticCurveTo(-4, -10, 9, -8); g.lineTo(8, -3); g.quadraticCurveTo(-1, -3, -5, 8); g.closePath();
    fs(g, '#FFF3D1', '#9E8452', 1.4);
    g.strokeStyle = '#D9A92B'; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, 0); g.lineTo(-2, 3); g.stroke();
  } else if (kind === 'S') {
    drawShield(g, 0, 0, 10, 1);
  } else if (kind === 'L') {
    drawNailong(g, 7.5, 'happy');
  } else if (kind === 'O') {
    drawOrange(g, 0, 1, 10, true);
  }
}

// ---------- 全部预渲染 ----------
const SPR = {};
function buildSprites() {
  SPR.plane = makeSprite(150, 150, drawVikingPlane);
  SPR.nlHappy = makeSprite(60, 60, g => drawNailong(g, 15, 'happy'));
  SPR.nlHurt = makeSprite(60, 60, g => drawNailong(g, 15, 'hurt'));
  SPR.nlRoar = makeSprite(60, 60, g => drawNailong(g, 15, 'roar'));
  SPR.nlIcon = makeSprite(40, 40, g => drawNailong(g, 9, 'happy'));
  SPR.scout = makeSprite(80, 70, drawScout);
  SPR.diver = makeSprite(60, 84, drawDiver);
  SPR.tub = makeSprite(116, 96, drawTub);
  SPR.bomber = makeSprite(180, 120, drawBomber);
  SPR.boss = makeSprite(380, 260, g => drawBoss(g, false));
  SPR.bossAngry = makeSprite(380, 260, g => drawBoss(g, true));
  for (const k of ['scout', 'diver', 'tub', 'bomber', 'boss', 'bossAngry']) SPR[k + 'F'] = flashOf(SPR[k]);
  SPR.capySmall = makeSprite(40, 44, g => { g.translate(0, 4); drawCapy(g, 10, { orange: true }); });
  SPR.orangeBig = makeSprite(34, 34, g => drawOrange(g, 0, 2, 13, true));
  SPR.milk = makeSprite(22, 28, drawMilkShot);
  SPR.fire = makeSprite(28, 34, drawFireShot);
  SPR.axe = makeSprite(26, 26, drawAxe);
  SPR.bOrange = makeSprite(26, 26, drawBulletOrange);
  SPR.bBubble = makeSprite(22, 22, drawBulletBubble);
  SPR.bSeed = makeSprite(20, 20, drawBulletSeed);
  for (const k of ['P', 'B', 'S', 'L', 'O']) SPR['pk' + k] = makeSprite(44, 44, g => drawPickup(g, k));
  SPR.shieldMini = makeSprite(20, 20, g => drawShield(g, 0, 0, 8, 1));
  SPR.horn = makeSprite(26, 26, g => drawPickup(g, 'B'));
}
