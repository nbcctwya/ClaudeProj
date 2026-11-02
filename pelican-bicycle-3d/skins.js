import * as THREE from 'three';
import { V, mat, segment, sphere, box } from './utils.js';

const CLASSIC = {
  body: 0xf6f3ec,
  wing: 0xe9e6df,
  tip: 0x2b2b2b,
  head: 0xf6f3ec,
  neck: 0xf6f3ec,
  crest: 0xf3e2a0,
  bill: 0xf2a33a,
  pouch: 0xf08a5d,
  leg: 0xf3962f,
};

// ---------------------------------------------------------------------------
// 配饰（head 组的原点在头部中心，x 朝前；body 组使用鹈鹕建模坐标）
// ---------------------------------------------------------------------------
function topHat(head) {
  const g = new THREE.Group();
  g.position.set(-0.03, 0.14, 0);
  g.rotation.z = 0.12;
  const black = mat(0x1d1d22, { roughness: 0.5 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 28), black);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 28), black);
  crown.position.y = 0.13;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.123, 0.123, 0.05, 28), mat(0xb3202a));
  band.position.y = 0.04;
  g.add(brim, crown, band);
  head.add(g);
}

function bowTie(body, color = 0x1d1d22) {
  const g = new THREE.Group();
  g.position.set(0.13, 2.33, 0);
  const m = mat(color, { roughness: 0.5 });
  for (const side of [1, -1]) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.13, 4), m);
    c.rotation.x = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    c.position.z = side * 0.065;
    c.scale.x = 0.45;
    g.add(c);
  }
  g.add(sphere(0.03, m));
  body.add(g);
}

function monocle(head) {
  const gold = mat(0xd4a72c, { metalness: 0.9, roughness: 0.25 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 24), gold);
  ring.position.set(0.075, 0.04, 0.145);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(0.05, 20),
    mat(0xdff4ff, { transparent: true, opacity: 0.35, roughness: 0.05 })
  );
  glass.position.copy(ring.position);
  head.add(ring, glass, segment(V(0.075, -0.01, 0.15), V(0.0, -0.16, 0.13), 0.004, gold));
}

function sunglasses(head, color = 0x111418) {
  const lens = mat(color, { roughness: 0.1, metalness: 0.6 });
  for (const side of [1, -1]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.015, 20), lens);
    l.rotation.x = Math.PI / 2;
    l.position.set(0.075, 0.045, side * 0.152);
    head.add(l);
  }
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.007, 6, 40), mat(0x222222));
  strap.rotation.x = Math.PI / 2;
  strap.position.y = 0.045;
  strap.scale.set(1.12, 0.95, 1);
  head.add(strap);
}

function racingHelmet(head) {
  const red = mat(0xe63946, { roughness: 0.3, metalness: 0.2 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), red);
  shell.scale.set(1.2, 1, 1.05);
  shell.position.set(-0.02, 0.0, 0);
  const stripe = new THREE.Mesh(
    new THREE.SphereGeometry(0.203, 28, 14, -0.12, 0.24, 0, Math.PI * 0.52),
    mat(0xffffff, { roughness: 0.3 })
  );
  stripe.scale.copy(shell.scale);
  stripe.position.copy(shell.position);
  stripe.rotation.y = Math.PI / 2;
  const visor = box(0.12, 0.02, 0.3, mat(0x222222), V(0.21, 0.08, 0));
  visor.rotation.z = -0.25;
  head.add(shell, stripe, visor);
}

function pirateHat(head) {
  const g = new THREE.Group();
  g.position.set(-0.03, 0.13, 0);
  g.rotation.z = 0.08;
  const black = mat(0x18181c, { roughness: 0.7 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.025, 3), black);
  brim.rotation.y = Math.PI / 6;
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), black);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.01, 6, 32), mat(0xd4a72c, { metalness: 0.8, roughness: 0.3 }));
  trim.rotation.x = Math.PI / 2;
  const skullMat = mat(0xffffff, { roughness: 0.5 });
  const skull = sphere(0.035, skullMat, V(0.13, 0.07, 0));
  const bones = box(0.01, 0.08, 0.012, skullMat, V(0.135, 0.07, 0));
  bones.rotation.x = 0.8;
  const bones2 = bones.clone();
  bones2.rotation.x = -0.8;
  g.add(brim, crown, trim, skull, bones, bones2);
  head.add(g);
}

function eyePatch(head) {
  const black = mat(0x111111, { roughness: 0.7 });
  const patch = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 20), black);
  patch.rotation.x = Math.PI / 2;
  patch.position.set(0.07, 0.045, 0.152);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.006, 6, 40), black);
  strap.position.set(0, 0.04, 0);
  strap.rotation.set(Math.PI / 2, 0.55, 0);
  head.add(patch, strap);
}

function earring(head) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 8, 20), mat(0xd4a72c, { metalness: 0.9, roughness: 0.2 }));
  ring.position.set(-0.04, -0.08, -0.15);
  head.add(ring);
}

function santaHat(head) {
  const g = new THREE.Group();
  g.position.set(-0.03, 0.12, 0);
  g.rotation.z = 0.45;
  const white = mat(0xffffff, { roughness: 1 });
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 10, 28), white);
  brim.rotation.x = Math.PI / 2;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 20), mat(0xd62828, { roughness: 0.8 }));
  cone.position.y = 0.18;
  g.add(brim, cone, sphere(0.055, white, V(0, 0.37, 0)));
  head.add(g);
}

function scarf(body, color, stripe) {
  const m = mat(color, { roughness: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.045, 10, 24), m);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0.03, 2.36, 0);
  const tail = box(0.03, 0.32, 0.09, m, V(0.13, 2.2, 0.06));
  tail.rotation.z = 0.15;
  body.add(ring, tail);
  if (stripe) {
    const s = mat(stripe, { roughness: 0.9 });
    for (const y of [2.12, 2.24]) {
      const b = box(0.032, 0.03, 0.092, s, V(0.13 + (2.2 - y) * 0.15, y, 0.06));
      b.rotation.z = 0.15;
      body.add(b);
    }
  }
}

function spaceHelmet(head, body) {
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 32, 20),
    mat(0xe8f6ff, {
      transparent: true,
      opacity: 0.28,
      roughness: 0.05,
      metalness: 0.1,
      emissive: 0x6a8aa8,
      emissiveIntensity: 0.35,
      depthWrite: false,
    })
  );
  glass.position.set(0.02, 0, 0);
  glass.userData.noCast = true;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 10, 28), mat(0xb8bec7, { metalness: 0.6, roughness: 0.35 }));
  collar.rotation.x = Math.PI / 2;
  collar.rotation.y = -0.4;
  collar.position.set(-0.08, -0.26, 0);
  head.add(glass, collar);

  // 背后的氧气瓶
  const g = new THREE.Group();
  g.position.set(-0.52, 2.0, 0);
  g.rotation.z = -0.55;
  g.add(box(0.12, 0.5, 0.36, mat(0xdfe3e8, { roughness: 0.5 })));
  for (const z of [0.09, -0.09]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 16), mat(0xf2f2f2, { roughness: 0.35, metalness: 0.3 }));
    tank.position.set(-0.08, 0, z);
    g.add(tank, sphere(0.075, tank.material, V(-0.08, 0.25, z)));
  }
  const badge = sphere(0.05, mat(0x2a5bd7), V(0.17, 2.15, 0.27), [1, 1, 0.3]);
  body.add(g, badge);
}

function crown(head) {
  const gold = mat(0xffc93c, { metalness: 0.95, roughness: 0.2 });
  const g = new THREE.Group();
  g.position.set(-0.03, 0.15, 0);
  g.rotation.z = 0.1;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.08, 24, 1, true), gold);
  band.material.side = THREE.DoubleSide;
  g.add(band);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 8), gold);
    spike.position.set(Math.cos(a) * 0.12, 0.08, Math.sin(a) * 0.12);
    g.add(spike, sphere(0.014, gold, V(Math.cos(a) * 0.12, 0.13, Math.sin(a) * 0.12)));
  }
  const ruby = mat(0xd0103a, { roughness: 0.15, metalness: 0.2 });
  for (const a of [0, Math.PI / 2, -Math.PI / 2]) {
    g.add(sphere(0.022, ruby, V(Math.cos(a) * 0.13, 0.0, Math.sin(a) * 0.13)));
  }
  head.add(g);
}

function flower(head) {
  const g = new THREE.Group();
  g.position.set(-0.06, 0.13, 0.1);
  g.rotation.x = -0.6;
  const petal = mat(0xff4f8b, { roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(sphere(0.045, petal, V(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05), [1, 0.4, 1]));
  }
  g.add(sphere(0.03, mat(0xffd93d), V(0, 0.015, 0)));
  head.add(g);
}

function pearlNecklace(body) {
  const pearl = mat(0xfff8f0, { roughness: 0.2, metalness: 0.1 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    body.add(sphere(0.022, pearl, V(0.03 + Math.cos(a) * 0.12, 2.3 - Math.max(0, Math.cos(a)) * 0.05, Math.sin(a) * 0.12)));
  }
}

function cowboyHat(head) {
  const brown = mat(0x8b5a2b, { roughness: 0.85 });
  const g = new THREE.Group();
  g.position.set(-0.03, 0.13, 0);
  g.rotation.z = 0.1;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 32), brown);
  brim.scale.z = 0.85;
  // 两侧上翘的帽檐
  for (const side of [1, -1]) {
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), brown);
    lip.scale.x = 2.6;
    lip.position.set(0, 0.04, side * 0.22);
    lip.rotation.x = side * 0.7;
    g.add(lip);
  }
  const crownMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.18, 24), brown);
  crownMesh.position.y = 0.09;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.14, 0.035, 24), mat(0x3b2412));
  band.position.y = 0.03;
  g.add(brim, crownMesh, band);
  head.add(g);
}

function bandana(body) {
  const red = mat(0xc1272d, { roughness: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.035, 8, 24), red);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0.03, 2.36, 0);
  const tri = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 3), red);
  tri.position.set(0.13, 2.25, 0);
  tri.rotation.set(0, Math.PI / 2, Math.PI);
  tri.scale.z = 0.3;
  body.add(ring, tri);
}

// ---------------------------------------------------------------------------
export const SKINS = [
  { id: 'classic', name: '🤍 经典白鹈鹕', palette: CLASSIC },
  {
    id: 'brown',
    name: '🤎 褐鹈鹕',
    palette: {
      body: 0x6b5848,
      wing: 0x5b4a3c,
      tip: 0x2a2420,
      head: 0xf6f0d8,
      neck: 0x6e3524,
      crest: 0xf7e08a,
      bill: 0x9c8a6b,
      pouch: 0x3d3a35,
      leg: 0x3a3a3a,
    },
  },
  {
    id: 'pink',
    name: '🌸 粉红泡泡',
    palette: {
      body: 0xf8bbd0,
      wing: 0xf48fb1,
      tip: 0xad1457,
      head: 0xfcd4e2,
      neck: 0xf8bbd0,
      crest: 0xff80ab,
      bill: 0xffb74d,
      pouch: 0xff8a80,
      leg: 0xff7043,
    },
    accessories: ({ head, body }) => {
      flower(head);
      pearlNecklace(body);
    },
  },
  {
    id: 'gentleman',
    name: '🎩 绅士',
    palette: CLASSIC,
    accessories: ({ head, body }) => {
      topHat(head);
      monocle(head);
      bowTie(body);
    },
  },
  {
    id: 'racer',
    name: '🏁 赛车手',
    palette: CLASSIC,
    accessories: ({ head, body }) => {
      racingHelmet(head);
      sunglasses(head);
      scarf(body, 0x1d3557);
    },
  },
  {
    id: 'pirate',
    name: '🏴‍☠️ 海盗',
    palette: CLASSIC,
    accessories: ({ head, body }) => {
      pirateHat(head);
      eyePatch(head);
      earring(head);
      bandana(body);
    },
  },
  {
    id: 'cowboy',
    name: '🤠 牛仔',
    palette: { ...CLASSIC, body: 0xf1e7d4, wing: 0xe2d4b8 },
    accessories: ({ head, body }) => {
      cowboyHat(head);
      bandana(body);
    },
  },
  {
    id: 'santa',
    name: '🎅 圣诞老人',
    palette: CLASSIC,
    accessories: ({ head, body }) => {
      santaHat(head);
      scarf(body, 0xd62828, 0xffffff);
    },
  },
  {
    id: 'astronaut',
    name: '👨‍🚀 宇航员',
    palette: { ...CLASSIC, body: 0xe9edf2, wing: 0xdde2e8 },
    accessories: ({ head, body }) => spaceHelmet(head, body),
  },
  {
    id: 'golden',
    name: '👑 黄金国王',
    palette: {
      body: 0xffcf4a,
      wing: 0xf5bf3a,
      tip: 0xb8860b,
      head: 0xffd75e,
      neck: 0xffd75e,
      crest: 0xfff1a8,
      bill: 0xff9f1c,
      pouch: 0xe8a33d,
      leg: 0xd4a017,
    },
    finish: { parts: ['body', 'wing', 'tip', 'head', 'neck', 'leg'], metalness: 0.85, roughness: 0.28 },
    accessories: ({ head }) => crown(head),
  },
];
