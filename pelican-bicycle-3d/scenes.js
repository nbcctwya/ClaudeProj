import * as THREE from 'three';
import { V, mat, segment, sphere, box, ellipsoid, makeRand, PATH_RADIUS } from './utils.js';

/*
 * 每个场景返回：
 *   group, update(dt, t)
 *   background, fog: [color, near, far] | null
 *   hemi: [sky, ground, intensity], sun: [color, intensity]
 *   night: 是否夜景（骑手身边会多一盏灯）
 *   lowGravity: 是否低重力（会一蹦一蹦）
 */

// ---------------------------------------------------------------------------
// 通用部件
// ---------------------------------------------------------------------------
function groundDisc(color) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(150, 64), mat(color, { roughness: 1 }));
  m.rotation.x = -Math.PI / 2;
  m.userData.noCast = true;
  return m;
}

function pathRing(color, opts = {}) {
  const m = new THREE.Mesh(new THREE.RingGeometry(PATH_RADIUS - 0.8, PATH_RADIUS + 0.8, 128), mat(color, { roughness: 1, ...opts }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.01;
  m.userData.noCast = true;
  return m;
}

function pathDashes(color, emissive = 0x000000) {
  const g = new THREE.Group();
  const m = mat(color, { roughness: 1, emissive });
  for (let i = 0; i < 48; i += 2) {
    const a0 = (i / 48) * Math.PI * 2;
    const d = new THREE.Mesh(new THREE.RingGeometry(PATH_RADIUS - 0.04, PATH_RADIUS + 0.04, 8, 1, a0, Math.PI / 24), m);
    d.rotation.x = -Math.PI / 2;
    d.position.y = 0.02;
    d.userData.noCast = true;
    g.add(d);
  }
  return g;
}

/** 随机取一个不在小路上的位置 */
function randomSpot(rand, rMin, rMax, accept = () => true) {
  for (let tries = 0; tries < 50; tries++) {
    const a = rand() * Math.PI * 2;
    const r = rMin + rand() * (rMax - rMin);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(r - PATH_RADIUS) > 1.7 && accept(x, z)) return { x, z };
  }
  return { x: rMax, z: 0 };
}

function makeClouds(group, rand, count, color = 0xffffff) {
  const clouds = [];
  const m = mat(color, { roughness: 1 });
  for (let i = 0; i < count; i++) {
    const c = new THREE.Group();
    const puffs = 4 + Math.floor(rand() * 3);
    for (let j = 0; j < puffs; j++) {
      c.add(sphere(1 + rand() * 0.8, m, V(j * 1.3 - puffs * 0.6, rand() * 0.6, rand() * 0.8)));
    }
    const a = rand() * Math.PI * 2;
    const r = 20 + rand() * 30;
    c.position.set(Math.cos(a) * r, 14 + rand() * 8, Math.sin(a) * r);
    c.userData.speed = 0.3 + rand() * 0.4;
    c.traverse((o) => (o.userData.noCast = true));
    group.add(c);
    clouds.push(c);
  }
  return (dt) => {
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 60) c.position.x = -60;
    }
  };
}

function makeStars(rand, count = 900) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rand() * Math.PI * 2;
    const v = Math.acos(rand() * 0.95);
    pos.set([Math.cos(u) * Math.sin(v) * 140, Math.cos(v) * 140 + 2, Math.sin(u) * Math.sin(v) * 140], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true });
  return new THREE.Points(geo, m);
}

function pineTree(rand, snowy = false) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 8), mat(0x8a5a32));
  trunk.position.y = 0.6;
  tree.add(trunk);
  const leaf = mat(snowy ? 0x2f6b4f : [0x3f9b3a, 0x4caf50, 0x2e8b57][Math.floor(rand() * 3)]);
  const snow = mat(0xffffff, { roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const r = 0.9 - i * 0.2;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 1.2, 10), leaf);
    cone.position.y = 1.4 + i * 0.55;
    tree.add(cone);
    if (snowy) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.62, 0.62, 10), snow);
      cap.position.y = 1.4 + i * 0.55 + 0.3;
      tree.add(cap);
    }
  }
  tree.rotation.y = rand() * Math.PI;
  return tree;
}

// ---------------------------------------------------------------------------
// 🌳 草地森林
// ---------------------------------------------------------------------------
function meadow() {
  const g = new THREE.Group();
  const rand = makeRand(7);
  g.add(groundDisc(0x8fcf6b), pathRing(0xdcc38e), pathDashes(0xffffff));

  for (let i = 0; i < 70; i++) {
    const { x, z } = rand() < 0.15 ? randomSpot(rand, 0, 3.2) : randomSpot(rand, 9, 40);
    const t = pineTree(rand);
    t.position.set(x, 0, z);
    t.scale.setScalar(0.7 + rand() * 0.8);
    g.add(t);
  }

  const flowerMats = [0xff6b6b, 0xffd93d, 0xffffff, 0xc77dff].map((c) => mat(c));
  const flowerGeo = new THREE.SphereGeometry(0.07, 8, 6);
  for (let i = 0; i < 160; i++) {
    const { x, z } = randomSpot(rand, 1, 11.5);
    const f = new THREE.Mesh(flowerGeo, flowerMats[i % 4]);
    f.position.set(x, 0.07, z);
    g.add(f);
  }

  // 几块石头和一座小风车
  const stone = mat(0x9a9a92, { roughness: 1 });
  for (let i = 0; i < 12; i++) {
    const { x, z } = randomSpot(rand, 8, 20);
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + rand() * 0.3, 0), stone);
    s.position.set(x, 0.1, z);
    s.rotation.set(rand(), rand(), rand());
    g.add(s);
  }
  const mill = new THREE.Group();
  mill.position.set(-14, 0, -10);
  mill.rotation.y = 0.6;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 5, 8), mat(0xf4ead5));
  tower.position.y = 2.5;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.4, 8), mat(0xb5462f));
  roof.position.y = 5.7;
  const blades = new THREE.Group();
  blades.position.set(1.0, 4.6, 0);
  for (let i = 0; i < 4; i++) {
    const b = box(0.06, 2.6, 0.5, mat(0xfaf6ee), V(0, 1.3, 0));
    const arm = new THREE.Group();
    arm.rotation.x = (i / 4) * Math.PI * 2;
    arm.add(b);
    blades.add(arm);
  }
  mill.add(tower, roof, blades);
  g.add(mill);

  const cloudUpdate = makeClouds(g, rand, 9);
  return {
    group: g,
    background: 0x9fd3f2,
    fog: [0x9fd3f2, 30, 90],
    hemi: [0xdff2ff, 0x5d8a3a, 1.1],
    sun: [0xfff4dd, 2.2],
    update(dt) {
      cloudUpdate(dt);
      blades.rotation.x += dt * 0.8;
    },
  };
}

// ---------------------------------------------------------------------------
// 🏖️ 海滩
// ---------------------------------------------------------------------------
const SHORE_X = 14;

function palmTree(rand) {
  const tree = new THREE.Group();
  const trunkMat = mat(0x9c7a4f, { roughness: 0.9 });
  const lean = rand() * Math.PI * 2;
  const pts = [];
  for (let k = 0; k <= 6; k++) {
    const f = (k / 6) ** 2 * 1.2;
    pts.push(V(Math.cos(lean) * f, k * 0.55, Math.sin(lean) * f));
  }
  for (let k = 0; k < 6; k++) tree.add(segment(pts[k], pts[k + 1], 0.09 + (6 - k) * 0.012, trunkMat, 0.1 + (6 - k) * 0.012, 8));
  const top = pts[6];
  const leafMat = mat(0x3c9a3c, { roughness: 0.8, side: THREE.DoubleSide });
  for (let j = 0; j < 7; j++) {
    const a = (j / 7) * Math.PI * 2 + rand();
    const d = V(Math.cos(a), 0, Math.sin(a));
    const mid = top.clone().addScaledVector(d, 0.7).add(V(0, 0.25, 0));
    const tip = top.clone().addScaledVector(d, 1.5).add(V(0, -0.45, 0));
    tree.add(ellipsoid(top, mid, 0.03, 0.2, leafMat), ellipsoid(mid, tip, 0.03, 0.16, leafMat));
  }
  const nut = mat(0x5a3d1e);
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * Math.PI * 2;
    tree.add(sphere(0.09, nut, top.clone().add(V(Math.cos(a) * 0.12, -0.12, Math.sin(a) * 0.12))));
  }
  return tree;
}

function seagull() {
  const g = new THREE.Group();
  const white = mat(0xffffff, { roughness: 0.8 });
  g.add(sphere(1, white, null, [0.22, 0.08, 0.08]));
  g.add(sphere(0.02, mat(0xf2a33a), V(0.24, 0.0, 0)));
  const wings = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    const w = sphere(1, white, V(0, 0, side * 0.3), [0.12, 0.02, 0.3]);
    pivot.add(w, sphere(1, mat(0x333333), V(0, 0, side * 0.58), [0.06, 0.015, 0.06]));
    g.add(pivot);
    wings.push({ pivot, side });
  }
  g.userData.wings = wings;
  return g;
}

function beach() {
  const g = new THREE.Group();
  const rand = makeRand(21);
  g.add(groundDisc(0xf0dca5));

  // 木栈道
  const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.06, 1.6), mat(0xa8784e, { roughness: 0.9 }), 110);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 110; i++) {
    const a = (i / 110) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * PATH_RADIUS, 0.03, Math.sin(a) * PATH_RADIUS);
    dummy.rotation.set(0, Math.PI / 2 - a, 0);
    dummy.updateMatrix();
    planks.setMatrixAt(i, dummy.matrix);
  }
  planks.userData.noCast = true;
  g.add(planks);

  // 大海（顶点波浪）
  const seaGeo = new THREE.PlaneGeometry(120, 260, 60, 100);
  const base = seaGeo.attributes.position.array.slice();
  const sea = new THREE.Mesh(seaGeo, mat(0x2a8fd6, { roughness: 0.15, metalness: 0.15, transparent: true, opacity: 0.92 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(SHORE_X + 60, 0.05, 0);
  sea.userData.noCast = true;
  g.add(sea);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 260), mat(0xffffff, { transparent: true, opacity: 0.8 }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(SHORE_X + 0.2, 0.09, 0);
  foam.userData.noCast = true;
  g.add(foam);

  for (let i = 0; i < 22; i++) {
    const { x, z } = rand() < 0.2 ? randomSpot(rand, 0, 3) : randomSpot(rand, 8.5, 30, (x) => x < SHORE_X - 2);
    const p = palmTree(rand);
    p.position.set(x, 0, z);
    p.scale.setScalar(0.8 + rand() * 0.5);
    g.add(p);
  }

  // 遮阳伞和毛巾
  const umbrellaColors = [0xff595e, 0xffca3a, 0x1982c4, 0x8ac926, 0x6a4c93];
  for (let i = 0; i < 6; i++) {
    const x = 9.5 + rand() * 2.5;
    const z = -12 + i * 4.5 + rand();
    const c = umbrellaColors[i % umbrellaColors.length];
    g.add(segment(V(x, 0, z), V(x, 2.2, z), 0.03, mat(0xffffff)));
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.45, 12), mat(c, { side: THREE.DoubleSide }));
    top.position.set(x, 2.3, z);
    g.add(top, sphere(0.06, mat(0xffffff), V(x, 2.55, z)));
    const towel = box(0.9, 0.02, 1.7, mat(umbrellaColors[(i + 2) % 5], { roughness: 1 }), V(x - 0.9, 0.02, z + 0.4));
    towel.rotation.y = 0.3;
    towel.userData.noCast = true;
    g.add(towel);
  }

  // 沙堡
  const sand = mat(0xe3c27f, { roughness: 1 });
  const castle = new THREE.Group();
  castle.position.set(1.5, 0, -1.5);
  castle.add(box(1.2, 0.4, 1.2, sand, V(0, 0.2, 0)));
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.7, 10), sand);
    t.position.set(x, 0.35, z);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.3, 10), sand);
    cone.position.set(x, 0.85, z);
    castle.add(t, cone);
  }
  castle.add(segment(V(0, 0.4, 0), V(0, 1.1, 0), 0.01, mat(0x6b4a2b)));
  castle.add(box(0.25, 0.15, 0.01, mat(0xff595e), V(0.13, 1.02, 0)));
  g.add(castle);

  // 帆船
  const boat = new THREE.Group();
  boat.position.set(30, 0, -12);
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.4, 3, 12, 1, false, 0, Math.PI), mat(0xffffff));
  hull.rotation.set(0, 0, Math.PI / 2);
  hull.position.y = 0.3;
  hull.scale.set(1, 1, 0.8);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0, 3);
  shape.lineTo(1.6, 0);
  shape.lineTo(0, 0);
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(0xff595e, { side: THREE.DoubleSide }));
  sail.position.set(-0.6, 0.6, 0);
  boat.add(hull, segment(V(-0.6, 0.3, 0), V(-0.6, 3.8, 0), 0.04, mat(0x6b4a2b)), sail);
  g.add(boat);

  const gulls = [];
  for (let i = 0; i < 5; i++) {
    const s = seagull();
    s.userData.orbit = { r: 8 + rand() * 8, h: 5 + rand() * 3, speed: 0.25 + rand() * 0.2, a: rand() * 6.28, cx: rand() * 6 - 3 };
    g.add(s);
    gulls.push(s);
  }

  const cloudUpdate = makeClouds(g, rand, 7);
  const pos = seaGeo.attributes.position;
  return {
    group: g,
    background: 0x8fd0ff,
    fog: [0x8fd0ff, 35, 110],
    hemi: [0xe8f6ff, 0xd8c08a, 1.15],
    sun: [0xfff1d6, 2.6],
    update(dt, t) {
      cloudUpdate(dt);
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const y = base[i * 3 + 1];
        pos.array[i * 3 + 2] = Math.sin(x * 0.35 + t * 1.6) * 0.12 + Math.sin(y * 0.22 + t * 1.1) * 0.08;
      }
      pos.needsUpdate = true;
      seaGeo.computeVertexNormals();
      foam.material.opacity = 0.55 + Math.sin(t * 1.6) * 0.3;
      foam.position.x = SHORE_X + 0.2 + Math.sin(t * 0.8) * 0.4;
      boat.position.y = Math.sin(t * 1.2) * 0.12;
      boat.rotation.x = Math.sin(t * 0.9) * 0.06;
      for (const s of gulls) {
        const o = s.userData.orbit;
        o.a += o.speed * dt;
        s.position.set(o.cx + Math.cos(o.a) * o.r, o.h + Math.sin(t + o.r) * 0.3, Math.sin(o.a) * o.r);
        s.rotation.y = -o.a - Math.PI / 2;
        for (const w of s.userData.wings) w.pivot.rotation.x = w.side * Math.sin(t * 7 + o.r) * 0.5;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// ❄️ 雪地
// ---------------------------------------------------------------------------
function snowland() {
  const g = new THREE.Group();
  const rand = makeRand(33);
  g.add(groundDisc(0xf2f6fa), pathRing(0xc9dbe8, { roughness: 0.4 }), pathDashes(0x8fb3cc));

  for (let i = 0; i < 70; i++) {
    const { x, z } = rand() < 0.12 ? randomSpot(rand, 0, 3) : randomSpot(rand, 8.5, 38);
    const t = pineTree(rand, true);
    t.position.set(x, 0, z);
    t.scale.setScalar(0.7 + rand() * 0.9);
    g.add(t);
  }
  const snowMat = mat(0xffffff, { roughness: 1 });
  for (let i = 0; i < 40; i++) {
    const { x, z } = randomSpot(rand, 1, 25);
    const pile = sphere(0.4 + rand() * 0.6, snowMat, V(x, 0, z), [1.4, 0.35, 1]);
    pile.userData.noCast = true;
    g.add(pile);
  }

  // 雪人
  const man = new THREE.Group();
  man.position.set(1.8, 0, 1.2);
  man.rotation.y = -0.8;
  man.add(sphere(0.6, snowMat, V(0, 0.55, 0)), sphere(0.45, snowMat, V(0, 1.38, 0)), sphere(0.32, snowMat, V(0, 1.98, 0)));
  const coal = mat(0x1a1a1a);
  for (const z of [0.11, -0.11]) man.add(sphere(0.04, coal, V(0.27, 2.06, z)));
  for (let i = 0; i < 3; i++) man.add(sphere(0.045, coal, V(0.44 - i * 0.02, 1.25 + i * 0.16, 0)));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 10), mat(0xff7f11));
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(0.42, 1.98, 0);
  man.add(nose);
  const stick = mat(0x6b4a2b);
  man.add(segment(V(0, 1.45, 0.4), V(0.1, 1.85, 0.95), 0.025, stick), segment(V(0, 1.45, -0.4), V(0.1, 1.7, -1.0), 0.025, stick));
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 16), coal);
  hat.position.set(0, 2.38, 0);
  man.add(hat, box(0.5, 0.03, 0.5, coal, V(0, 2.24, 0)));
  const sc = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 20), mat(0xd62828));
  sc.rotation.x = Math.PI / 2;
  sc.position.y = 1.72;
  man.add(sc);
  g.add(man);

  // 礼物盒
  const giftColors = [[0xd62828, 0xffd93d], [0x2a9d8f, 0xffffff], [0x6a4c93, 0xffca3a]];
  giftColors.forEach(([c, r], i) => {
    const s = 0.35 + i * 0.08;
    const gift = new THREE.Group();
    gift.position.set(-1.5 + i * 0.7, s / 2, -1.6 + i * 0.3);
    gift.rotation.y = i;
    gift.add(box(s, s, s, mat(c)), box(s + 0.01, s + 0.01, 0.06, mat(r)), box(0.06, s + 0.01, s + 0.01, mat(r)));
    g.add(gift);
  });

  // 下雪
  const N = 2500;
  const flakes = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) flakes.set([rand() * 80 - 40, rand() * 25, rand() * 80 - 40], i * 3);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(flakes, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.9, depthWrite: false }));
  g.add(snow);

  return {
    group: g,
    background: 0xc9d7e6,
    fog: [0xc9d7e6, 14, 60],
    hemi: [0xeef4ff, 0x9aa8b8, 1.0],
    sun: [0xffffff, 1.3],
    update(dt, t) {
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        flakes[k + 1] -= dt * (0.8 + (i % 7) * 0.12);
        flakes[k] += Math.sin(t * 0.8 + i) * dt * 0.25;
        if (flakes[k + 1] < 0) flakes[k + 1] += 25;
      }
      snowGeo.attributes.position.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------------------
// 🌃 城市夜景
// ---------------------------------------------------------------------------
function windowCanvas(rand) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1b2130';
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const lit = rand() < 0.45;
      ctx.fillStyle = lit ? (rand() < 0.7 ? '#ffd27a' : '#a8d8ff') : '#0e121a';
      ctx.fillRect(i * 16 + 3, j * 16 + 4, 10, 9);
    }
  }
  return c;
}

function nightCity() {
  const g = new THREE.Group();
  const rand = makeRand(55);
  g.add(groundDisc(0x2b3038), pathRing(0x1d2026, { roughness: 0.6 }), pathDashes(0xf5c542, 0x5a4300));

  // 广场和喷泉
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(4.6, 48), mat(0x56606c, { roughness: 0.9 }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.012;
  plaza.userData.noCast = true;
  g.add(plaza);
  const stoneMat = mat(0x9aa3ad);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.45, 32), stoneMat);
  basin.position.y = 0.22;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.38, 0.05, 32), mat(0x3d8bff, { emissive: 0x1450c0, emissiveIntensity: 0.8 }));
  water.position.y = 0.42;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 12), stoneMat);
  column.position.y = 0.9;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.3, 0.2, 24), stoneMat);
  bowl.position.y = 1.5;
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 12), mat(0x9fd0ff, { emissive: 0x4a90ff, transparent: true, opacity: 0.7 }));
  jet.position.y = 1.95;
  g.add(basin, water, column, bowl, jet);

  // 楼房
  const canvases = [0, 1, 2, 3].map(() => windowCanvas(rand));
  const roofMat = mat(0x262b36);
  const beacons = [];
  for (let i = 0; i < 46; i++) {
    const { x, z } = randomSpot(rand, 11, 38);
    const w = 2 + rand() * 3;
    const d = 2 + rand() * 3;
    const h = 3 + rand() * 12;
    const tex = new THREE.CanvasTexture(canvases[i % 4]);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2.4)));
    const side = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.85, roughness: 0.8 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roofMat, roofMat, side, side]);
    b.position.set(x, h / 2, z);
    b.rotation.y = Math.atan2(x, z);
    g.add(b);
    if (h > 10) {
      const beacon = sphere(0.15, mat(0xff2222, { emissive: 0xff0000, emissiveIntensity: 1 }), V(x, h + 0.15, z));
      beacon.userData.phase = rand() * 6;
      g.add(beacon);
      beacons.push(beacon);
    }
  }

  // 路灯
  const poleMat = mat(0x3a3f47, { metalness: 0.6, roughness: 0.4 });
  const bulbMat = mat(0xfff3d0, { emissive: 0xffd88a, emissiveIntensity: 2 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    const r = i % 2 ? PATH_RADIUS + 1.3 : PATH_RADIUS - 1.3;
    const inward = i % 2 ? -1 : 1;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const armEnd = V(x + Math.cos(a) * 0.6 * inward, 3.0, z + Math.sin(a) * 0.6 * inward);
    g.add(segment(V(x, 0, z), V(x, 3.1, z), 0.05, poleMat), segment(V(x, 3.1, z), armEnd, 0.03, poleMat));
    g.add(sphere(0.14, bulbMat, armEnd.clone().add(V(0, -0.1, 0))));
    if (i % 3 === 0) {
      const light = new THREE.PointLight(0xffd59a, 14, 0, 2);
      light.position.copy(armEnd).add(V(0, -0.25, 0));
      g.add(light);
    }
  }

  const stars = makeStars(rand);
  g.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 16), new THREE.MeshBasicMaterial({ color: 0xfff6dc, fog: false }));
  moon.position.set(-60, 50, -80);
  g.add(moon);

  return {
    group: g,
    background: 0x0b1430,
    fog: [0x0b1430, 25, 85],
    hemi: [0x4a5a8a, 0x1a1d24, 0.55],
    sun: [0x9fb4ff, 0.7],
    night: true,
    update(dt, t) {
      for (const b of beacons) b.material.emissiveIntensity = Math.sin(t * 3 + b.userData.phase) > 0.3 ? 2 : 0.1;
      stars.material.opacity = 0.75 + Math.sin(t * 2) * 0.2;
      jet.scale.y = 1 + Math.sin(t * 5) * 0.1;
    },
  };
}

// ---------------------------------------------------------------------------
// 🌕 月球
// ---------------------------------------------------------------------------
function earthTexture(rand) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2b6cd4';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#3aa655';
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.ellipse(rand() * 256, 20 + rand() * 88, 10 + rand() * 25, 6 + rand() * 18, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.ellipse(rand() * 256, rand() * 128, 8 + rand() * 20, 2 + rand() * 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function moonBase() {
  const g = new THREE.Group();
  const rand = makeRand(77);
  g.add(groundDisc(0x9a9a9a), pathRing(0x7c7c7c));

  // 环形山
  const rim = mat(0xa8a8a8, { roughness: 1 });
  const floor = mat(0x828282, { roughness: 1 });
  for (let i = 0; i < 34; i++) {
    const r = 0.5 + rand() * 2.2;
    const { x, z } = randomSpot(rand, 2, 45, (x, z) => Math.abs(Math.hypot(x, z) - PATH_RADIUS) > r + 1.6);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.18, 8, 32), rim);
    ring.rotation.x = Math.PI / 2;
    ring.scale.z = 0.45;
    ring.position.set(x, 0, z);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 32), floor);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, 0.015, z);
    disc.userData.noCast = true;
    g.add(ring, disc);
  }
  const rock = mat(0x8c8c8c, { roughness: 1 });
  for (let i = 0; i < 40; i++) {
    const { x, z } = randomSpot(rand, 1, 30);
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + rand() * 0.35, 0), rock);
    s.position.set(x, 0.05, z);
    s.rotation.set(rand(), rand(), rand());
    g.add(s);
  }

  // 登月舱
  const lander = new THREE.Group();
  lander.position.set(-1.6, 0, 1.4);
  const foil = mat(0xd4a72c, { metalness: 0.9, roughness: 0.35 });
  const silver = mat(0xcfd3d8, { metalness: 0.7, roughness: 0.3 });
  lander.add(box(1.0, 0.6, 1.0, foil, V(0, 1.0, 0)));
  const cabin = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.6, 8), silver);
  cabin.position.y = 1.6;
  lander.add(cabin, sphere(0.12, mat(0x222831, { metalness: 0.5, roughness: 0.1 }), V(0.45, 1.65, 0)));
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    lander.add(segment(V(x * 0.45, 0.85, z * 0.45), V(x * 0.85, 0.05, z * 0.85), 0.03, silver));
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 12), silver);
    pad.position.set(x * 0.85, 0.02, z * 0.85);
    lander.add(pad);
  }
  lander.add(segment(V(0, 1.9, 0), V(0, 2.5, 0), 0.015, silver), sphere(0.05, silver, V(0, 2.52, 0)));
  g.add(lander);

  // 插一面"鹈鹕旗"
  const fc = document.createElement('canvas');
  fc.width = 128;
  fc.height = 80;
  const ctx = fc.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 80);
  ctx.fillStyle = '#f2a33a';
  ctx.beginPath();
  ctx.moveTo(40, 34);
  ctx.lineTo(112, 44);
  ctx.lineTo(40, 50);
  ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(34, 40, 14, 0, Math.PI * 2);
  ctx.fill();
  const flagTex = new THREE.CanvasTexture(fc);
  flagTex.colorSpace = THREE.SRGBColorSpace;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.62), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.set(2.0, 1.85, -1.2);
  g.add(segment(V(1.5, 0, -1.2), V(1.5, 2.2, -1.2), 0.025, silver), flag);

  g.add(makeStars(rand, 1500));
  const earth = new THREE.Mesh(new THREE.SphereGeometry(7, 48, 24), new THREE.MeshBasicMaterial({ map: earthTexture(rand), fog: false }));
  earth.position.set(40, 38, -95);
  g.add(earth);

  return {
    group: g,
    background: 0x02030a,
    fog: null,
    hemi: [0x445566, 0x222222, 0.35],
    sun: [0xffffff, 3.0],
    lowGravity: true,
    update(dt) {
      earth.rotation.y += dt * 0.05;
    },
  };
}

export const SCENES = [
  { id: 'meadow', name: '🌳 草地森林', create: meadow },
  { id: 'beach', name: '🏖️ 海滩', create: beach },
  { id: 'snow', name: '❄️ 雪地', create: snowland },
  { id: 'city', name: '🌃 城市夜景', create: nightCity },
  { id: 'moon', name: '🌕 月球', create: moonBase },
];
