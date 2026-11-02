import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

window.__pelicanStarted = true;

// ---------------------------------------------------------------------------
// 基础场景
// ---------------------------------------------------------------------------
const container = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd3f2);
scene.fog = new THREE.Fog(0x9fd3f2, 30, 90);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(4.5, 3.2, 7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 2.5;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI / 2 - 0.05;

// 灯光
scene.add(new THREE.HemisphereLight(0xdff2ff, 0x5d8a3a, 1.1));

const sun = new THREE.DirectionalLight(0xfff4dd, 2.2);
sun.position.set(8, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -12;
sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -12;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0005;
scene.add(sun);

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...opts });

// 单位高度圆柱：之后通过 setSegment 拉伸到任意两点之间
const unitCylinder = (rTop, rBottom = rTop, radial = 12) => {
  const g = new THREE.CylinderGeometry(rTop, rBottom, 1, radial);
  return g;
};

const tmpDir = new THREE.Vector3();
function setSegment(mesh, a, b) {
  tmpDir.subVectors(b, a);
  const len = tmpDir.length();
  mesh.position.copy(a).addScaledVector(tmpDir, 0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(UP, tmpDir.normalize());
}

function segment(a, b, radius, material, rBottom) {
  const m = new THREE.Mesh(unitCylinder(radius, rBottom ?? radius), material);
  setSegment(m, a, b);
  return m;
}

// 沿方向放置的椭球（主轴为 x）
function ellipsoidBetween(a, b, thickY, thickZ, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
  m.scale.set(len / 2, thickY, thickZ);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(V(1, 0, 0), dir.normalize());
  return m;
}

// 可复现的伪随机数
let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

// ---------------------------------------------------------------------------
// 地面、小路、树、云
// ---------------------------------------------------------------------------
const PATH_RADIUS = 6;

const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 64), mat(0x8fcf6b, { roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const path = new THREE.Mesh(
  new THREE.RingGeometry(PATH_RADIUS - 0.8, PATH_RADIUS + 0.8, 128),
  mat(0xdcc38e, { roughness: 1 })
);
path.rotation.x = -Math.PI / 2;
path.position.y = 0.01;
path.receiveShadow = true;
scene.add(path);

// 小路中间的虚线
const dashMat = mat(0xffffff, { roughness: 1 });
for (let i = 0; i < 48; i += 2) {
  const a0 = (i / 48) * Math.PI * 2;
  const a1 = ((i + 1) / 48) * Math.PI * 2;
  const dash = new THREE.Mesh(
    new THREE.RingGeometry(PATH_RADIUS - 0.04, PATH_RADIUS + 0.04, 8, 1, a0, a1 - a0),
    dashMat
  );
  dash.rotation.x = -Math.PI / 2;
  dash.position.y = 0.02;
  scene.add(dash);
}

function makeTree(x, z, s) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 8), mat(0x8a5a32));
  trunk.position.y = 0.6;
  tree.add(trunk);
  const leafMat = mat([0x3f9b3a, 0x4caf50, 0x2e8b57][Math.floor(rand() * 3)]);
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9 - i * 0.2, 1.2, 10), leafMat);
    cone.position.y = 1.4 + i * 0.55;
    tree.add(cone);
  }
  tree.position.set(x, 0, z);
  tree.scale.setScalar(s);
  tree.rotation.y = rand() * Math.PI;
  scene.add(tree);
}

for (let i = 0; i < 70; i++) {
  const angle = rand() * Math.PI * 2;
  const r = rand() < 0.15 ? rand() * 3.2 : 9 + rand() * 30;
  makeTree(Math.cos(angle) * r, Math.sin(angle) * r, 0.7 + rand() * 0.8);
}

// 小花
const flowerColors = [0xff6b6b, 0xffd93d, 0xffffff, 0xc77dff];
const flowerGeo = new THREE.SphereGeometry(0.07, 8, 6);
for (let i = 0; i < 160; i++) {
  const angle = rand() * Math.PI * 2;
  const r = rand() < 0.5 ? 7.2 + rand() * 4 : 1 + rand() * 4;
  const f = new THREE.Mesh(flowerGeo, mat(flowerColors[i % flowerColors.length]));
  f.position.set(Math.cos(angle) * r, 0.07, Math.sin(angle) * r);
  scene.add(f);
}

// 云
const clouds = [];
const cloudMat = mat(0xffffff, { roughness: 1 });
for (let i = 0; i < 9; i++) {
  const cloud = new THREE.Group();
  const puffs = 4 + Math.floor(rand() * 3);
  for (let j = 0; j < puffs; j++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(1 + rand() * 0.8, 16, 12), cloudMat);
    p.position.set(j * 1.3 - puffs * 0.6, rand() * 0.6, rand() * 0.8);
    cloud.add(p);
  }
  const angle = rand() * Math.PI * 2;
  const r = 20 + rand() * 30;
  cloud.position.set(Math.cos(angle) * r, 14 + rand() * 8, Math.sin(angle) * r);
  cloud.userData.speed = 0.3 + rand() * 0.4;
  scene.add(cloud);
  clouds.push(cloud);
}

// ---------------------------------------------------------------------------
// 自行车（局部坐标：前进方向为 +x，向上为 +y）
// ---------------------------------------------------------------------------
const WHEEL_R = 0.6;
const CRANK_R = 0.28;

const rider = new THREE.Group(); // 负责在路上移动 + 转向
const lean = new THREE.Group(); // 负责过弯时的倾斜
rider.add(lean);
scene.add(rider);

const bike = new THREE.Group();
lean.add(bike);

const frameMat = mat(0x2a7de1, { metalness: 0.4, roughness: 0.35 });
const chromeMat = mat(0xd9dde2, { metalness: 0.9, roughness: 0.25 });
const tireMat = mat(0x222222, { roughness: 0.9 });
const darkMat = mat(0x333333, { roughness: 0.6 });

const P = {
  rearHub: V(-0.95, WHEEL_R, 0),
  frontHub: V(0.95, WHEEL_R, 0),
  bb: V(0, 0.5, 0),
  seatTop: V(-0.3, 1.32, 0),
  headTop: V(0.72, 1.32, 0),
  headBottom: V(0.8, 1.05, 0),
};

function makeWheel(center) {
  const wheel = new THREE.Group();
  wheel.position.copy(center);

  const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R, 0.045, 12, 48), tireMat);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.045, 0.018, 8, 48), chromeMat);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 12), chromeMat);
  hub.rotation.x = Math.PI / 2;
  wheel.add(tire, rim, hub);

  const spokeGeo = new THREE.CylinderGeometry(0.006, 0.006, WHEEL_R - 0.05, 4);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const spoke = new THREE.Mesh(spokeGeo, chromeMat);
    const side = i % 2 ? 0.04 : -0.04;
    spoke.position.set(Math.cos(a) * (WHEEL_R - 0.05) * 0.5, Math.sin(a) * (WHEEL_R - 0.05) * 0.5, side);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);
  }

  // 一个彩色反光片，方便看出轮子在转
  const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.02), mat(0xff8c00, { emissive: 0x552200 }));
  reflector.position.set(0, WHEEL_R * 0.55, 0.05);
  wheel.add(reflector);

  bike.add(wheel);
  return wheel;
}

const rearWheel = makeWheel(P.rearHub);
const frontWheel = makeWheel(P.frontHub);

// 车架
const tubeR = 0.035;
for (const z of [-0.06, 0.06]) {
  bike.add(segment(V(P.rearHub.x, P.rearHub.y, z), V(P.bb.x, P.bb.y, z * 0.5), 0.022, frameMat)); // 后下叉
  bike.add(segment(V(P.rearHub.x, P.rearHub.y, z), V(P.seatTop.x + 0.03, P.seatTop.y - 0.12, z * 0.3), 0.02, frameMat)); // 后上叉
  bike.add(segment(V(P.headBottom.x, P.headBottom.y, z * 0.6), V(P.frontHub.x, P.frontHub.y, z), 0.025, chromeMat)); // 前叉
}
bike.add(segment(P.bb, P.seatTop, tubeR, frameMat)); // 立管
bike.add(segment(P.seatTop, P.headTop, tubeR, frameMat)); // 上管
bike.add(segment(P.bb, P.headBottom, tubeR * 1.2, frameMat)); // 下管
bike.add(segment(P.headBottom, P.headTop, tubeR * 1.3, frameMat)); // 头管

// 座管 + 车座
const saddleBase = V(-0.34, 1.5, 0);
bike.add(segment(P.seatTop, saddleBase, 0.02, chromeMat));
const saddle = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), darkMat);
saddle.scale.set(0.2, 0.045, 0.1);
saddle.position.copy(saddleBase).add(V(0.02, 0.03, 0));
bike.add(saddle);

// 车把
const stemTop = V(0.66, 1.55, 0);
bike.add(segment(P.headTop, stemTop, 0.022, chromeMat));
const barL = V(0.6, 1.57, 0.34);
const barR = V(0.6, 1.57, -0.34);
bike.add(segment(V(stemTop.x, stemTop.y, 0.0), V(barL.x + 0.03, barL.y, 0.2), 0.018, chromeMat));
bike.add(segment(V(stemTop.x, stemTop.y, 0.0), V(barR.x + 0.03, barR.y, -0.2), 0.018, chromeMat));
bike.add(segment(V(barL.x + 0.03, barL.y, 0.2), barL, 0.018, chromeMat));
bike.add(segment(V(barR.x + 0.03, barR.y, -0.2), barR, 0.018, chromeMat));
for (const g of [barL, barR]) {
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), mat(0xe2463b));
  grip.rotation.x = Math.PI / 2;
  grip.position.copy(g).add(V(0, 0, Math.sign(g.z) * 0.05));
  bike.add(grip);
}

// 车铃
const bellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), chromeMat);
bellMesh.position.set(0.63, 1.6, 0.16);
bike.add(bellMesh);

// 车筐（小细节）
const basket = new THREE.Mesh(
  new THREE.CylinderGeometry(0.2, 0.16, 0.2, 12, 1, true),
  mat(0xb98a4b, { side: THREE.DoubleSide, roughness: 0.9 })
);
basket.position.set(0.98, 1.3, 0);
bike.add(basket);
bike.add(segment(V(0.8, 1.22, 0), V(0.9, 1.26, 0), 0.015, chromeMat));
// 车筐里有条鱼 🐟
const fish = new THREE.Group();
const fishBody = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mat(0x8fb8d8, { metalness: 0.3, roughness: 0.3 }));
fishBody.scale.set(0.15, 0.06, 0.04);
const fishTail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 3), mat(0x7aa3c4));
fishTail.rotation.z = Math.PI / 2;
fishTail.position.x = -0.18;
fish.add(fishBody, fishTail);
fish.position.set(0.98, 1.42, 0);
fish.rotation.z = 0.6;
bike.add(fish);

// 链轮 + 链条
const chainring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 8, 32), chromeMat);
chainring.position.copy(P.bb).add(V(0, 0, 0.09));
bike.add(chainring);
const cog = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 24), chromeMat);
cog.position.copy(P.rearHub).add(V(0, 0, 0.09));
bike.add(cog);
bike.add(segment(V(P.bb.x, P.bb.y + 0.16, 0.09), V(P.rearHub.x, P.rearHub.y + 0.07, 0.09), 0.008, darkMat));
bike.add(segment(V(P.bb.x, P.bb.y - 0.16, 0.09), V(P.rearHub.x, P.rearHub.y - 0.07, 0.09), 0.008, darkMat));

// 曲柄（会转动）
const crank = new THREE.Group();
crank.position.copy(P.bb);
bike.add(crank);
crank.add(segment(V(0, 0, 0.13), V(CRANK_R, 0, 0.13), 0.02, chromeMat));
crank.add(segment(V(0, 0, -0.13), V(-CRANK_R, 0, -0.13), 0.02, chromeMat));
crank.add(segment(V(0, 0, -0.14), V(0, 0, 0.14), 0.025, chromeMat));

// 脚踏（保持水平，每帧更新位置）
const pedalGeo = new THREE.BoxGeometry(0.16, 0.025, 0.1);
const pedals = [new THREE.Mesh(pedalGeo, darkMat), new THREE.Mesh(pedalGeo, darkMat)];
pedals.forEach((p) => bike.add(p));

// ---------------------------------------------------------------------------
// 鹈鹕
// ---------------------------------------------------------------------------
const pelican = new THREE.Group();
bike.add(pelican);

const featherMat = mat(0xf6f3ec, { roughness: 0.85 });
const wingMat = mat(0xe9e6df, { roughness: 0.85 });
const tipMat = mat(0x2b2b2b, { roughness: 0.8 });
const billMat = mat(0xf2a33a, { roughness: 0.45 });
const pouchMat = mat(0xf08a5d, { roughness: 0.5 });
const legMat = mat(0xf3962f, { roughness: 0.55 });
const crestMat = mat(0xf3e2a0, { roughness: 0.9 });

// 身体
const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), featherMat);
body.scale.set(0.4, 0.55, 0.36);
body.position.set(-0.17, 1.95, 0);
body.rotation.z = -0.55;
pelican.add(body);

// 尾巴
const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 10), featherMat);
tail.position.set(-0.6, 1.62, 0);
tail.rotation.z = Math.PI / 2 + 0.45;
tail.scale.z = 0.5;
pelican.add(tail);

// 脖子（S 形曲线）
const neckCurve = new THREE.CatmullRomCurve3([
  V(0.0, 2.25, 0),
  V(0.06, 2.48, 0),
  V(0.0, 2.68, 0),
  V(0.14, 2.86, 0),
  V(0.32, 2.92, 0),
]);
const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 32, 0.095, 12, false), featherMat);
pelican.add(neck);

// 头部（单独一组，方便做点头动画）
const head = new THREE.Group();
head.position.set(0.36, 2.94, 0);
pelican.add(head);

const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), featherMat);
skull.scale.set(1.15, 1, 0.95);
head.add(skull);

const crest = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), crestMat);
crest.scale.set(1.6, 0.6, 0.7);
crest.position.set(-0.1, 0.11, 0);
crest.rotation.z = 0.4;
head.add(crest);

// 眼睛
for (const z of [0.12, -0.12]) {
  const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), mat(0xffffff, { roughness: 0.3 }));
  eyeWhite.position.set(0.07, 0.04, z);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), mat(0x111111, { roughness: 0.2 }));
  pupil.position.set(0.095, 0.045, z * 1.2);
  head.add(eyeWhite, pupil);
}

// 长长的喙（上喙 + 喉囊）
const billStart = V(0.12, -0.02, 0);
const billTip = V(0.98, -0.16, 0);
const upperBill = ellipsoidBetween(billStart, billTip, 0.035, 0.07, billMat);
head.add(upperBill);
const hook = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(0xe0602a));
hook.position.copy(billTip).add(V(0.0, -0.025, 0));
head.add(hook);

const pouch = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), pouchMat);
pouch.scale.set(0.4, 0.11, 0.065);
pouch.position.set(0.54, -0.15, 0);
pouch.rotation.z = -0.12;
head.add(pouch);

// 翅膀：从肩膀伸到车把上，像手一样握着车把
const shoulders = [V(0.02, 2.15, 0.3), V(0.02, 2.15, -0.3)];
const grips = [barL.clone().add(V(0.02, 0.04, 0.03)), barR.clone().add(V(0.02, 0.04, -0.03))];
shoulders.forEach((s, i) => {
  const side = i === 0 ? 1 : -1;

  // 贴在身体两侧的翅膀主体
  const folded = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), wingMat);
  folded.scale.set(0.42, 0.2, 0.08);
  folded.position.set(-0.22, 1.98, side * 0.33);
  folded.rotation.z = -0.25;
  pelican.add(folded);

  // 黑色飞羽
  for (let k = 0; k < 3; k++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), tipMat);
    f.scale.set(0.2, 0.05, 0.03);
    f.position.set(-0.58 - k * 0.04, 1.86 - k * 0.06, side * (0.34 - k * 0.02));
    f.rotation.z = 0.35 + k * 0.12;
    pelican.add(f);
  }

  // 前伸的"手臂"
  const elbow = V(0.38, 1.88, side * 0.42);
  pelican.add(ellipsoidBetween(s, elbow, 0.09, 0.06, wingMat));
  pelican.add(ellipsoidBetween(elbow, grips[i], 0.07, 0.05, wingMat));
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), tipMat);
  hand.position.copy(grips[i]);
  pelican.add(hand);
});

// 腿（两段 IK，每帧根据脚踏位置更新）
const THIGH = 0.66;
const SHIN = 0.7;
const hips = [V(-0.18, 1.62, 0.17), V(-0.18, 1.62, -0.17)];
const legs = hips.map(() => {
  const thigh = new THREE.Mesh(unitCylinder(0.085, 0.06), featherMat); // 毛茸茸的大腿
  const shin = new THREE.Mesh(unitCylinder(0.035, 0.03), legMat);
  const knee = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), legMat);

  // 带蹼的脚
  const footShape = new THREE.Shape();
  footShape.moveTo(-0.04, 0);
  footShape.lineTo(0.16, 0.09);
  footShape.quadraticCurveTo(0.19, 0, 0.16, -0.09);
  footShape.lineTo(-0.04, 0);
  const footGeo = new THREE.ExtrudeGeometry(footShape, { depth: 0.02, bevelEnabled: false });
  footGeo.rotateX(Math.PI / 2);
  const foot = new THREE.Mesh(footGeo, legMat);

  pelican.add(thigh, shin, knee, foot);
  return { thigh, shin, knee, foot };
});

const tmpA = new THREE.Vector3();
const tmpKnee = new THREE.Vector3();
function solveLeg(hip, target, out) {
  // 在 xy 平面内求解两段骨骼的膝盖位置（膝盖朝前）
  tmpA.subVectors(target, hip);
  const d = Math.min(Math.hypot(tmpA.x, tmpA.y), THIGH + SHIN - 0.001);
  const base = Math.atan2(tmpA.y, tmpA.x);
  const cosA = (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d);
  const a = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1));
  const ang = base + a; // 逆时针旋转 => 膝盖向前
  out.set(hip.x + Math.cos(ang) * THIGH, hip.y + Math.sin(ang) * THIGH, (hip.z + target.z) / 2);
  return out;
}

// 阴影
scene.traverse((o) => {
  if (o.isMesh && o !== ground && o !== path) {
    o.castShadow = true;
    o.receiveShadow = true;
  }
});

// ---------------------------------------------------------------------------
// 交互
// ---------------------------------------------------------------------------
const state = {
  speed: 1,
  paused: false,
  follow: true,
  angle: 0, // 在圆形路线上的角度
  distance: 0, // 已行驶的距离
  bellTime: -10,
};

const speedInput = document.getElementById('speed');
const speedValue = document.getElementById('speedValue');
const pauseBtn = document.getElementById('pause');
const followBtn = document.getElementById('follow');
const bellBtn = document.getElementById('bell');

speedInput.addEventListener('input', () => {
  state.speed = parseFloat(speedInput.value);
  speedValue.textContent = `${state.speed.toFixed(2)}×`;
});

function togglePause() {
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? '继续' : '暂停';
}
pauseBtn.addEventListener('click', togglePause);

followBtn.addEventListener('click', () => {
  state.follow = !state.follow;
  followBtn.classList.toggle('active', state.follow);
});

let audioCtx;
function ringBell() {
  state.bellTime = clock.elapsedTime;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    for (const [delay, freq] of [[0, 2100], [0.16, 2100]]) {
      for (const mult of [1, 2.76]) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq * mult;
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(mult === 1 ? 0.25 : 0.08, now + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.6);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.65);
      }
    }
  } catch {
    // 浏览器不支持 Web Audio 时静默忽略
  }
}
bellBtn.addEventListener('click', ringBell);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    togglePause();
  } else if (e.code === 'KeyB') {
    ringBell();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// 动画
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const BASE_SPEED = 2.2; // 米/秒
const GEAR = 0.45; // 曲柄转速 / 车轮转速
const prevRiderPos = new THREE.Vector3();
const pedalPos = [new THREE.Vector3(), new THREE.Vector3()];
const ankle = new THREE.Vector3();
const ANKLE_OFFSET = V(-0.02, 0.06, 0);

function placeRider() {
  const x = Math.cos(state.angle) * PATH_RADIUS;
  const z = Math.sin(state.angle) * PATH_RADIUS;
  rider.position.set(x, 0, z);
  // 让局部 +x 指向切线方向；局部 +z 正好指向圆心
  rider.rotation.y = -state.angle - Math.PI / 2;
}

placeRider();
prevRiderPos.copy(rider.position);
controls.target.copy(rider.position).add(V(0, 1.3, 0));
camera.position.copy(rider.position).add(V(3.5, 2.4, 5.5));

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (!state.paused) {
    const v = BASE_SPEED * state.speed;
    state.distance += v * dt;
    state.angle += (v * dt) / PATH_RADIUS;
  }

  placeRider();

  // 过弯倾斜（向圆心，即局部 +z）
  const targetLean = state.paused ? 0 : Math.min(0.18, 0.06 * state.speed + 0.02);
  lean.rotation.x += (targetLean - lean.rotation.x) * Math.min(1, dt * 3);

  // 车轮和曲柄
  const wheelAngle = -state.distance / WHEEL_R;
  rearWheel.rotation.z = wheelAngle;
  frontWheel.rotation.z = wheelAngle;
  const c = wheelAngle * GEAR + Math.PI / 2;
  crank.rotation.z = c;

  pedalPos[0].set(P.bb.x + Math.cos(c) * CRANK_R, P.bb.y + Math.sin(c) * CRANK_R, 0.2);
  pedalPos[1].set(P.bb.x - Math.cos(c) * CRANK_R, P.bb.y - Math.sin(c) * CRANK_R, -0.2);
  pedals.forEach((p, i) => p.position.copy(pedalPos[i]));

  // 鹈鹕：随踩踏轻微起伏、左右摇摆
  const pedalPhase = c * 2;
  pelican.position.y = Math.sin(pedalPhase) * 0.015;
  pelican.rotation.x = Math.sin(c) * 0.03;

  // 腿部 IK
  legs.forEach((leg, i) => {
    // 脚踏位置换算到鹈鹕的局部坐标
    ankle.copy(pedalPos[i]).add(ANKLE_OFFSET).sub(pelican.position);
    solveLeg(hips[i], ankle, tmpKnee);
    setSegment(leg.thigh, hips[i], tmpKnee);
    setSegment(leg.shin, tmpKnee, ankle);
    leg.knee.position.copy(tmpKnee);
    leg.foot.position.set(ankle.x - 0.04, ankle.y - 0.045, ankle.z);
  });

  // 头部：点头 + 按铃时开心地抬头
  const sinceBell = t - state.bellTime;
  const joy = sinceBell < 1.2 ? Math.sin((sinceBell / 1.2) * Math.PI) : 0;
  head.rotation.z = Math.sin(pedalPhase) * 0.04 + joy * 0.35;
  head.rotation.y = Math.sin(t * 0.7) * 0.12;
  pouch.scale.y = 0.11 + Math.sin(t * 6) * 0.006 + joy * 0.04;
  bellMesh.rotation.y = joy * Math.sin(sinceBell * 40) * 0.5;

  // 云朵慢慢飘
  clouds.forEach((cl) => {
    cl.position.x += cl.userData.speed * dt;
    if (cl.position.x > 60) cl.position.x = -60;
  });

  // 跟随镜头：相机与目标一起平移，用户仍可旋转/缩放
  if (state.follow) {
    const delta = rider.position.clone().sub(prevRiderPos);
    camera.position.add(delta);
    controls.target.add(delta);
  }
  prevRiderPos.copy(rider.position);

  // 阳光跟着骑手，保证阴影清晰
  sun.position.copy(rider.position).add(V(8, 14, 6));
  sun.target.position.copy(rider.position);
  sun.target.updateMatrixWorld();

  controls.update();
  renderer.render(scene, camera);
}

animate();
