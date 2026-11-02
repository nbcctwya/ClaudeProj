import * as THREE from 'three';
import { V, mat, segment, sphere, box } from './utils.js';

/*
 * 每个交通工具返回：
 *   group      模型（原点在地面，+x 朝前）
 *   seat       鹈鹕髋部中点的位置
 *   pitch      鹈鹕身体前后倾角（正值更直立）
 *   grips      两个握把点，null 表示张开翅膀保持平衡
 *   feet       两个脚踝目标点（update 中每帧更新），null 表示不显示腿
 *   speed      相对速度
 *   leanFactor 过弯倾斜系数
 *   bobAmp     随 phase 上下颠簸的幅度
 *   horn       'bell' | 'horn' | 'whistle'
 *   exhaust    排气口位置（会冒烟），可选
 *   update(distance, t) => phase
 */

const chrome = () => mat(0xd9dde2, { metalness: 0.9, roughness: 0.25 });
const rubber = () => mat(0x222222, { roughness: 0.9 });

function spokedWheel(radius, tube, spokes, rimMat, tireMat) {
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 48), tireMat));
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(radius - tube, tube * 0.4, 8, 48), rimMat));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 12), rimMat);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  const len = radius - tube;
  const spokeGeo = new THREE.CylinderGeometry(0.006, 0.006, len, 4);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.position.set(Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.5, i % 2 ? 0.035 : -0.035);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);
  }
  const reflector = box(0.08, 0.03, 0.02, mat(0xff8c00, { emissive: 0x552200 }), V(0, len * 0.55, 0.05));
  wheel.add(reflector);
  return wheel;
}

function grip(pos, color = 0xe2463b, len = 0.12) {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 10), mat(color));
  g.rotation.x = Math.PI / 2;
  g.position.copy(pos).add(V(0, 0, Math.sign(pos.z) * len * 0.4));
  return g;
}

// ---------------------------------------------------------------------------
// 🚲 自行车
// ---------------------------------------------------------------------------
function bicycle() {
  const g = new THREE.Group();
  const R = 0.6;
  const CR = 0.28;
  const GEAR = 0.45;
  const frameMat = mat(0x2a7de1, { metalness: 0.4, roughness: 0.35 });
  const cm = chrome();
  const dark = mat(0x333333);

  const P = {
    rearHub: V(-0.95, R, 0),
    frontHub: V(0.95, R, 0),
    bb: V(0, 0.5, 0),
    seatTop: V(-0.3, 1.32, 0),
    headTop: V(0.72, 1.32, 0),
    headBottom: V(0.8, 1.05, 0),
  };

  const rear = spokedWheel(R, 0.045, 18, cm, rubber());
  rear.position.copy(P.rearHub);
  const front = spokedWheel(R, 0.045, 18, cm, rubber());
  front.position.copy(P.frontHub);
  g.add(rear, front);

  for (const z of [-0.06, 0.06]) {
    g.add(segment(V(P.rearHub.x, P.rearHub.y, z), V(P.bb.x, P.bb.y, z * 0.5), 0.022, frameMat));
    g.add(segment(V(P.rearHub.x, P.rearHub.y, z), V(P.seatTop.x + 0.03, P.seatTop.y - 0.12, z * 0.3), 0.02, frameMat));
    g.add(segment(V(P.headBottom.x, P.headBottom.y, z * 0.6), V(P.frontHub.x, P.frontHub.y, z), 0.025, cm));
  }
  g.add(segment(P.bb, P.seatTop, 0.035, frameMat));
  g.add(segment(P.seatTop, P.headTop, 0.035, frameMat));
  g.add(segment(P.bb, P.headBottom, 0.042, frameMat));
  g.add(segment(P.headBottom, P.headTop, 0.045, frameMat));

  const saddleBase = V(-0.34, 1.5, 0);
  g.add(segment(P.seatTop, saddleBase, 0.02, cm));
  g.add(sphere(1, dark, saddleBase.clone().add(V(0.02, 0.03, 0)), [0.2, 0.045, 0.1]));

  const stemTop = V(0.66, 1.55, 0);
  g.add(segment(P.headTop, stemTop, 0.022, cm));
  const barL = V(0.6, 1.57, 0.34);
  const barR = V(0.6, 1.57, -0.34);
  for (const b of [barL, barR]) {
    const mid = V(b.x + 0.03, b.y, Math.sign(b.z) * 0.2);
    g.add(segment(stemTop, mid, 0.018, cm), segment(mid, b, 0.018, cm), grip(b));
  }
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), cm);
  bell.position.set(0.63, 1.6, 0.16);
  g.add(bell);

  // 车筐和鱼
  const basket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.16, 0.2, 12, 1, true),
    mat(0xb98a4b, { side: THREE.DoubleSide, roughness: 0.9 })
  );
  basket.position.set(0.98, 1.3, 0);
  g.add(basket, segment(V(0.8, 1.22, 0), V(0.9, 1.26, 0), 0.015, cm));
  const fish = new THREE.Group();
  fish.add(sphere(1, mat(0x8fb8d8, { metalness: 0.3, roughness: 0.3 }), null, [0.15, 0.06, 0.04]));
  const fishTail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 3), mat(0x7aa3c4));
  fishTail.rotation.z = Math.PI / 2;
  fishTail.position.x = -0.18;
  fish.add(fishTail);
  fish.position.set(0.98, 1.42, 0);
  fish.rotation.z = 0.6;
  g.add(fish);

  // 链条
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 8, 32), cm);
  ring.position.copy(P.bb).add(V(0, 0, 0.09));
  const cog = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 24), cm);
  cog.position.copy(P.rearHub).add(V(0, 0, 0.09));
  g.add(ring, cog);
  g.add(segment(V(0, 0.66, 0.09), V(P.rearHub.x, P.rearHub.y + 0.07, 0.09), 0.008, dark));
  g.add(segment(V(0, 0.34, 0.09), V(P.rearHub.x, P.rearHub.y - 0.07, 0.09), 0.008, dark));

  const crank = new THREE.Group();
  crank.position.copy(P.bb);
  crank.add(segment(V(0, 0, 0.13), V(CR, 0, 0.13), 0.02, cm));
  crank.add(segment(V(0, 0, -0.13), V(-CR, 0, -0.13), 0.02, cm));
  crank.add(segment(V(0, 0, -0.14), V(0, 0, 0.14), 0.025, cm));
  g.add(crank);

  const pedals = [box(0.16, 0.025, 0.1, dark), box(0.16, 0.025, 0.1, dark)];
  g.add(...pedals);
  const feet = [V(), V()];

  return {
    group: g,
    seat: V(-0.18, 1.62, 0),
    pitch: 0,
    grips: [barL.clone().add(V(0.02, 0.04, 0.03)), barR.clone().add(V(0.02, 0.04, -0.03))],
    feet,
    speed: 1,
    leanFactor: 1,
    bobAmp: 0.015,
    horn: 'bell',
    update(distance) {
      const w = -distance / R;
      rear.rotation.z = front.rotation.z = w;
      const c = w * GEAR + Math.PI / 2;
      crank.rotation.z = c;
      pedals[0].position.set(Math.cos(c) * CR, P.bb.y + Math.sin(c) * CR, 0.2);
      pedals[1].position.set(-Math.cos(c) * CR, P.bb.y - Math.sin(c) * CR, -0.2);
      pedals.forEach((p, i) => feet[i].copy(p.position).add(V(-0.02, 0.06, 0)));
      return c;
    },
  };
}

// ---------------------------------------------------------------------------
// 🎪 独轮车
// ---------------------------------------------------------------------------
function unicycle() {
  const g = new THREE.Group();
  const body = new THREE.Group(); // 用来做左右摇晃
  g.add(body);
  const R = 0.5;
  const CR = 0.16;
  const cm = chrome();
  const frameMat = mat(0xe63946, { metalness: 0.4, roughness: 0.35 });

  const wheel = spokedWheel(R, 0.05, 20, cm, rubber());
  wheel.position.set(0, R, 0);
  body.add(wheel);
  for (const z of [0.08, -0.08]) body.add(segment(V(0, R, z), V(0, 1.02, z * 0.6), 0.025, frameMat));
  body.add(segment(V(0, 1.02, -0.06), V(0, 1.02, 0.06), 0.03, frameMat));
  body.add(segment(V(0, 1.02, 0), V(0, 1.5, 0), 0.022, cm));
  body.add(sphere(1, mat(0x222222), V(0.02, 1.53, 0), [0.17, 0.045, 0.1]));

  const crank = new THREE.Group();
  crank.position.set(0, R, 0);
  crank.add(segment(V(0, 0, 0.13), V(CR, 0, 0.13), 0.018, cm));
  crank.add(segment(V(0, 0, -0.13), V(-CR, 0, -0.13), 0.018, cm));
  body.add(crank);
  const dark = mat(0x333333);
  const pedals = [box(0.14, 0.025, 0.09, dark), box(0.14, 0.025, 0.09, dark)];
  body.add(...pedals);
  const feet = [V(), V()];

  return {
    group: g,
    seat: V(0, 1.64, 0),
    pitch: 0.18,
    grips: null,
    feet,
    speed: 0.7,
    leanFactor: 1,
    bobAmp: 0.02,
    horn: 'whistle',
    update(distance, t) {
      const w = -distance / R;
      wheel.rotation.z = w;
      const c = w + Math.PI / 2;
      crank.rotation.z = c;
      pedals[0].position.set(Math.cos(c) * CR, R + Math.sin(c) * CR, 0.2);
      pedals[1].position.set(-Math.cos(c) * CR, R - Math.sin(c) * CR, -0.2);
      pedals.forEach((p, i) => feet[i].copy(p.position).add(V(-0.02, 0.06, 0)));
      // 独轮车总是摇摇晃晃
      g.rotation.x = Math.sin(t * 2.3) * 0.06;
      g.rotation.z = Math.sin(t * 1.7) * 0.035;
      return c;
    },
  };
}

// ---------------------------------------------------------------------------
// 🏍️ 摩托车
// ---------------------------------------------------------------------------
function motorcycle() {
  const g = new THREE.Group();
  const R = 0.46;
  const cm = chrome();
  const red = mat(0xd62828, { metalness: 0.5, roughness: 0.25 });
  const dark = mat(0x1f1f24, { metalness: 0.4, roughness: 0.5 });

  function magWheel() {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.09, 0.09, 14, 40), rubber()));
    w.add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.18, 0.025, 8, 40), cm));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 14), cm);
    hub.rotation.x = Math.PI / 2;
    w.add(hub);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const s = box(0.04, R - 0.2, 0.03, dark, V(Math.cos(a) * (R - 0.2) * 0.5, Math.sin(a) * (R - 0.2) * 0.5, 0));
      s.rotation.z = a - Math.PI / 2;
      w.add(s);
    }
    return w;
  }
  const rear = magWheel();
  rear.position.set(-0.78, R, 0);
  const front = magWheel();
  front.position.set(0.8, R, 0);
  g.add(rear, front);

  // 发动机
  g.add(box(0.5, 0.36, 0.3, dark, V(0, 0.58, 0)));
  for (let i = 0; i < 4; i++) {
    const fin = box(0.4, 0.02, 0.34, cm, V(0.02, 0.48 + i * 0.07, 0));
    g.add(fin);
  }
  for (const z of [0.1, -0.1]) {
    g.add(segment(V(-0.78, R, z), V(-0.15, 0.72, z), 0.03, dark)); // 后摇臂
    g.add(segment(V(0.56, 1.18, z), V(0.8, R, z), 0.035, cm)); // 前叉
  }
  g.add(segment(V(-0.2, 0.75, 0), V(0.56, 1.1, 0), 0.05, dark)); // 主梁
  g.add(sphere(1, red, V(0.22, 1.0, 0), [0.38, 0.17, 0.22])); // 油箱
  g.add(sphere(1, mat(0x111111, { roughness: 0.7 }), V(-0.36, 0.97, 0), [0.42, 0.08, 0.2])); // 座椅
  const fender = new THREE.Mesh(new THREE.TorusGeometry(R + 0.03, 0.05, 8, 20, Math.PI * 0.6), red);
  fender.position.copy(rear.position);
  fender.rotation.z = Math.PI * 0.35;
  fender.scale.z = 2;
  g.add(fender);
  const ffender = new THREE.Mesh(new THREE.TorusGeometry(R + 0.03, 0.04, 8, 20, Math.PI * 0.5), red);
  ffender.position.copy(front.position);
  ffender.rotation.z = Math.PI * 0.25;
  ffender.scale.z = 2;
  g.add(ffender);
  g.add(box(0.05, 0.06, 0.14, mat(0xff2a2a, { emissive: 0xaa0000 }), V(-1.08, 0.98, 0)));

  // 车把与大灯
  const barTop = V(0.52, 1.26, 0);
  g.add(segment(V(0.56, 1.18, 0), barTop, 0.03, cm));
  const gl = V(0.44, 1.33, 0.36);
  const gr = V(0.44, 1.33, -0.36);
  for (const b of [gl, gr]) g.add(segment(barTop, b, 0.02, cm), grip(b, 0x222222, 0.14));
  g.add(sphere(0.11, mat(0xfff6d0, { emissive: 0xffe08a, emissiveIntensity: 1.2 }), V(0.7, 1.12, 0), [0.6, 1, 1]));
  const ringLight = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 8, 24), cm);
  ringLight.position.set(0.69, 1.12, 0);
  ringLight.rotation.y = Math.PI / 2;
  g.add(ringLight);

  // 排气管
  g.add(segment(V(-0.05, 0.42, 0.2), V(-0.82, 0.55, 0.22), 0.045, cm));
  g.add(segment(V(-0.82, 0.55, 0.22), V(-0.95, 0.57, 0.22), 0.06, cm));

  // 脚踏
  const pegs = [V(-0.02, 0.46, 0.24), V(-0.02, 0.46, -0.24)];
  for (const p of pegs) g.add(segment(V(p.x, p.y, Math.sign(p.z) * 0.12), p, 0.02, cm));
  const feet = pegs.map((p) => p.clone().add(V(0, 0.07, 0)));

  return {
    group: g,
    seat: V(-0.34, 1.12, 0),
    pitch: -0.12,
    grips: [gl.clone().add(V(0.0, 0.04, 0.04)), gr.clone().add(V(0.0, 0.04, -0.04))],
    feet,
    speed: 2.2,
    leanFactor: 1,
    bobAmp: 0.006,
    horn: 'horn',
    exhaust: V(-0.98, 0.57, 0.22),
    update(distance, t) {
      rear.rotation.z = front.rotation.z = -distance / R;
      return t * 18; // 发动机震动
    },
  };
}

// ---------------------------------------------------------------------------
// 🛴 滑板车
// ---------------------------------------------------------------------------
function scooter() {
  const g = new THREE.Group();
  const R = 0.13;
  const cm = chrome();
  const teal = mat(0x2ec4a6, { metalness: 0.3, roughness: 0.35 });

  function smallWheel() {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.035, 0.035, 10, 24), mat(0x8e44ad, { roughness: 0.6 })));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), cm);
    hub.rotation.x = Math.PI / 2;
    w.add(hub);
    w.add(box(0.1, 0.015, 0.052, mat(0xffffff)));
    return w;
  }
  const rear = smallWheel();
  rear.position.set(-0.46, R, 0);
  const front = smallWheel();
  front.position.set(0.44, R, 0);
  g.add(rear, front);

  g.add(box(0.82, 0.05, 0.18, teal, V(-0.02, 0.2, 0)));
  g.add(box(0.8, 0.008, 0.16, mat(0x222222, { roughness: 1 }), V(-0.02, 0.228, 0)));
  g.add(segment(V(-0.4, 0.2, 0), V(-0.47, 0.27, 0), 0.03, teal)); // 后挡泥板支架
  const fender = new THREE.Mesh(new THREE.TorusGeometry(R + 0.02, 0.02, 6, 16, Math.PI * 0.6), teal);
  fender.position.copy(rear.position);
  fender.rotation.z = Math.PI * 0.2;
  fender.scale.z = 2.5;
  g.add(fender);
  g.add(segment(V(0.38, 0.2, 0), V(0.44, R, 0), 0.03, teal));
  const barTop = V(0.36, 1.38, 0);
  g.add(segment(V(0.44, R, 0), barTop, 0.028, cm));
  const gl = V(0.36, 1.38, 0.26);
  const gr = V(0.36, 1.38, -0.26);
  g.add(segment(gl, gr, 0.02, cm), grip(gl, 0x2ec4a6), grip(gr, 0x2ec4a6));

  const feet = [V(0.02, 0.29, 0.06), V()];
  return {
    group: g,
    seat: V(-0.08, 1.48, 0),
    pitch: 0.25,
    grips: [gl.clone().add(V(0.02, 0.04, 0.04)), gr.clone().add(V(0.02, 0.04, -0.04))],
    feet,
    speed: 0.85,
    leanFactor: 1,
    bobAmp: 0.02,
    horn: 'bell',
    update(distance) {
      rear.rotation.z = front.rotation.z = -distance / R;
      // 一只脚站在踏板上，另一只脚一下一下蹬地
      const p = distance * 1.6;
      feet[1].set(-0.32 + 0.3 * Math.cos(p), 0.07 + 0.22 * Math.max(0, -Math.sin(p)), -0.12);
      return p;
    },
  };
}

// ---------------------------------------------------------------------------
// 🛹 滑板
// ---------------------------------------------------------------------------
function skateboard() {
  const g = new THREE.Group();
  const board = new THREE.Group();
  g.add(board);
  const R = 0.045;
  const wood = mat(0xd08a4a, { roughness: 0.7 });
  const grip = mat(0x1f1f1f, { roughness: 1 });
  const cm = chrome();

  board.add(box(0.8, 0.035, 0.26, wood, V(0, 0.14, 0)));
  board.add(box(0.8, 0.006, 0.25, grip, V(0, 0.16, 0)));
  for (const s of [1, -1]) {
    const kick = box(0.16, 0.035, 0.26, wood, V(s * 0.47, 0.165, 0));
    kick.rotation.z = s * 0.3;
    board.add(kick);
    // 底部图案：一条小鱼的颜色条
    board.add(box(0.12, 0.004, 0.2, mat(s > 0 ? 0xf2a33a : 0x2a7de1), V(s * 0.2, 0.121, 0)));
  }
  const wheels = [];
  for (const x of [0.3, -0.3]) {
    board.add(box(0.06, 0.05, 0.12, cm, V(x, 0.1, 0)));
    board.add(segment(V(x, R, -0.14), V(x, R, 0.14), 0.01, cm));
    for (const z of [0.12, -0.12]) {
      const w = new THREE.Group();
      w.position.set(x, R, z);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.04, 16), mat(0xffe14d, { roughness: 0.4 }));
      cyl.rotation.x = Math.PI / 2;
      w.add(cyl, box(0.06, 0.01, 0.042, mat(0xffffff)));
      board.add(w);
      wheels.push(w);
    }
  }

  const feet = [V(0.22, 0.23, 0.06), V(-0.2, 0.23, -0.06)];
  return {
    group: g,
    seat: V(0, 1.46, 0),
    pitch: 0.25,
    grips: null,
    feet,
    speed: 1.1,
    leanFactor: 1,
    bobAmp: 0.01,
    horn: 'whistle',
    update(distance, t) {
      wheels.forEach((w) => (w.rotation.z = -distance / R));
      g.rotation.x = Math.sin(t * 1.5) * 0.05;
      return t * 2;
    },
  };
}

// ---------------------------------------------------------------------------
// 🚗 小敞篷车
// ---------------------------------------------------------------------------
function car() {
  const g = new THREE.Group();
  const R = 0.34;
  const paint = mat(0xe23d3d, { metalness: 0.35, roughness: 0.28 });
  const cm = chrome();
  const dark = mat(0x2a2a2e, { roughness: 0.8 });

  g.add(box(2.3, 0.34, 1.2, paint, V(0, 0.52, 0))); // 车身下部
  g.add(box(0.85, 0.22, 1.12, paint, V(0.72, 0.8, 0))); // 引擎盖
  g.add(box(0.55, 0.26, 1.12, paint, V(-0.88, 0.81, 0))); // 后备箱
  for (const z of [0.56, -0.56]) g.add(box(0.9, 0.24, 0.08, paint, V(-0.18, 0.8, z))); // 车门
  g.add(box(0.06, 0.12, 1.24, cm, V(1.17, 0.42, 0)));
  g.add(box(0.06, 0.12, 1.24, cm, V(-1.17, 0.42, 0)));
  // 进气格栅
  g.add(box(0.02, 0.14, 0.5, dark, V(1.151, 0.56, 0)));

  // 座椅
  g.add(box(0.5, 0.1, 0.95, dark, V(-0.36, 0.74, 0)));
  const back = box(0.12, 0.45, 0.95, dark, V(-0.6, 0.98, 0));
  back.rotation.z = 0.15;
  g.add(back);

  // 挡风玻璃
  const glass = box(0.03, 0.34, 1.0, mat(0xbfe6ff, { transparent: true, opacity: 0.35, roughness: 0.05 }), V(0.34, 1.07, 0));
  glass.rotation.z = 0.4;
  glass.userData.noCast = true;
  g.add(glass);

  // 方向盘
  g.add(segment(V(0.38, 0.85, 0), V(0.16, 1.0, 0), 0.025, dark));
  const steer = new THREE.Group();
  steer.position.set(0.14, 1.02, 0);
  steer.rotation.z = 0.55;
  const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 28), dark);
  wheelRing.rotation.y = Math.PI / 2;
  steer.add(wheelRing);
  g.add(steer);

  // 车灯
  const head = mat(0xfff6d0, { emissive: 0xffe08a, emissiveIntensity: 1.2 });
  const tail = mat(0xff3030, { emissive: 0xaa0000 });
  for (const z of [0.4, -0.4]) {
    g.add(sphere(0.1, head, V(1.12, 0.62, z), [0.5, 1, 1]));
    g.add(box(0.04, 0.08, 0.16, tail, V(-1.16, 0.64, z)));
  }

  // 车轮（前轮略微转向圆心）
  const wheels = [];
  for (const x of [0.75, -0.75]) {
    for (const z of [0.6, -0.6]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, R, z);
      if (x > 0) pivot.rotation.y = -0.15;
      const w = new THREE.Group();
      w.add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.09, 0.09, 12, 32), rubber()));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.1, R - 0.1, 0.14, 20), cm);
      cap.rotation.x = Math.PI / 2;
      w.add(cap, box(0.04, (R - 0.1) * 1.9, 0.15, mat(0x888888)));
      pivot.add(w);
      g.add(pivot);
      wheels.push(w);
    }
  }
  g.add(segment(V(-1.15, 0.33, 0.3), V(-1.3, 0.33, 0.3), 0.035, cm)); // 排气管

  return {
    group: g,
    seat: V(-0.34, 0.86, 0),
    pitch: 0.22,
    grips: [V(0.1, 1.05, 0.15), V(0.1, 1.05, -0.15)],
    feet: null,
    speed: 2,
    leanFactor: 0.15,
    bobAmp: 0.006,
    horn: 'horn',
    exhaust: V(-1.32, 0.33, 0.3),
    update(distance, t) {
      wheels.forEach((w) => (w.rotation.z = -distance / R));
      return t * 14;
    },
  };
}

export const VEHICLES = [
  { id: 'bicycle', name: '🚲 自行车', create: bicycle },
  { id: 'unicycle', name: '🎪 独轮车', create: unicycle },
  { id: 'scooter', name: '🛴 滑板车', create: scooter },
  { id: 'skateboard', name: '🛹 滑板', create: skateboard },
  { id: 'motorcycle', name: '🏍️ 摩托车', create: motorcycle },
  { id: 'car', name: '🚗 敞篷车', create: car },
];
