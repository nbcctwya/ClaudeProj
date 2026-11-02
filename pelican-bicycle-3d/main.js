import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { V, PATH_RADIUS, disposeTree, enableShadows } from './utils.js';
import { createPelican } from './pelican.js';
import { SKINS } from './skins.js';
import { VEHICLES } from './vehicles.js';
import { SCENES } from './scenes.js';

window.__pelicanStarted = true;

// ---------------------------------------------------------------------------
// 渲染器 / 相机 / 灯光
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 2.5;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI / 2 - 0.05;

const hemi = new THREE.HemisphereLight();
scene.add(hemi);
const sun = new THREE.DirectionalLight();
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 45 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// ---------------------------------------------------------------------------
// 骑手：rider(沿路线移动) → lean(过弯倾斜) → vehicle.group → pelican.root
// ---------------------------------------------------------------------------
const rider = new THREE.Group();
const lean = new THREE.Group();
rider.add(lean);
scene.add(rider);

// 夜里跟着骑手的一盏灯
const lantern = new THREE.PointLight(0xfff0d0, 14, 0, 2);
lantern.position.set(0.8, 3.4, 1.2);
rider.add(lantern);

const pelican = createPelican();

// 排气管冒的烟
const puffs = [];
const puffGeo = new THREE.SphereGeometry(0.12, 10, 8);
for (let i = 0; i < 28; i++) {
  const p = new THREE.Mesh(puffGeo, new THREE.MeshStandardMaterial({ color: 0xdddddd, transparent: true, opacity: 0, depthWrite: false, roughness: 1 }));
  p.visible = false;
  p.userData.life = 0;
  scene.add(p);
  puffs.push(p);
}
let puffIndex = 0;
let puffTimer = 0;

// ---------------------------------------------------------------------------
// 状态与切换
// ---------------------------------------------------------------------------
const state = {
  speed: 1,
  paused: false,
  follow: true,
  angle: 0,
  distance: 0,
  hornTime: -10,
  sceneIdx: 0,
  skinIdx: 0,
  vehicleIdx: 0,
};

let world = null;
let vehicle = null;

function setScene(idx) {
  state.sceneIdx = idx;
  if (world) {
    scene.remove(world.group);
    disposeTree(world.group);
  }
  world = SCENES[idx].create();
  enableShadows(world.group);
  scene.add(world.group);

  scene.background = new THREE.Color(world.background);
  scene.fog = world.fog ? new THREE.Fog(...world.fog) : null;
  hemi.color.setHex(world.hemi[0]);
  hemi.groundColor.setHex(world.hemi[1]);
  hemi.intensity = world.hemi[2];
  sun.color.setHex(world.sun[0]);
  sun.intensity = world.sun[1];
  lantern.visible = !!world.night;
  document.body.style.background = `#${scene.background.getHexString()}`;
}

function setSkin(idx) {
  state.skinIdx = idx;
  pelican.applySkin(SKINS[idx]);
}

function setVehicle(idx) {
  state.vehicleIdx = idx;
  if (vehicle) {
    vehicle.group.remove(pelican.root);
    lean.remove(vehicle.group);
    disposeTree(vehicle.group);
  }
  vehicle = VEHICLES[idx].create();
  enableShadows(vehicle.group);
  vehicle.group.add(pelican.root);
  lean.add(vehicle.group);
  hornBtn.textContent = { bell: '🔔 按铃', horn: '📯 按喇叭', whistle: '🎵 吹口哨' }[vehicle.horn];
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const sceneSel = $('sceneSel');
const skinSel = $('skinSel');
const vehicleSel = $('vehicleSel');
const speedInput = $('speed');
const speedValue = $('speedValue');
const pauseBtn = $('pause');
const followBtn = $('follow');
const hornBtn = $('horn');
const toast = $('toast');

function fillSelect(sel, items) {
  for (const [i, item] of items.entries()) sel.add(new Option(item.name, String(i)));
}
fillSelect(sceneSel, SCENES);
fillSelect(skinSel, SKINS);
fillSelect(vehicleSel, VEHICLES);

let toastTimer;
function showToast() {
  toast.textContent = `${SCENES[state.sceneIdx].name} · ${SKINS[state.skinIdx].name} · ${VEHICLES[state.vehicleIdx].name}`;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function syncUI() {
  sceneSel.value = String(state.sceneIdx);
  skinSel.value = String(state.skinIdx);
  vehicleSel.value = String(state.vehicleIdx);
  try {
    const q = new URLSearchParams({
      scene: SCENES[state.sceneIdx].id,
      skin: SKINS[state.skinIdx].id,
      vehicle: VEHICLES[state.vehicleIdx].id,
    });
    history.replaceState(null, '', `?${q}`);
  } catch {
    // 某些环境（如 file://）不允许修改地址栏，忽略即可
  }
  showToast();
}

function choose(kind, idx) {
  if (kind === 'scene') setScene(idx);
  if (kind === 'skin') setSkin(idx);
  if (kind === 'vehicle') setVehicle(idx);
  syncUI();
}

sceneSel.addEventListener('change', () => choose('scene', +sceneSel.value));
skinSel.addEventListener('change', () => choose('skin', +skinSel.value));
vehicleSel.addEventListener('change', () => choose('vehicle', +vehicleSel.value));

const cycle = (kind, list, key) => choose(kind, (state[key] + 1) % list.length);
const pick = (list, current) => {
  if (list.length < 2) return 0;
  let i;
  do i = Math.floor(Math.random() * list.length);
  while (i === current);
  return i;
};
function randomize() {
  setScene(pick(SCENES, state.sceneIdx));
  setSkin(pick(SKINS, state.skinIdx));
  setVehicle(pick(VEHICLES, state.vehicleIdx));
  syncUI();
}
$('random').addEventListener('click', randomize);

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

$('collapse').addEventListener('click', () => {
  const collapsed = document.getElementById('panel').classList.toggle('collapsed');
  $('collapse').textContent = collapsed ? '+' : '−';
});

// 声音
let audioCtx;
function tone(type, freq, start, dur, peak, freqEnd) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}
function honk() {
  state.hornTime = clock.elapsedTime;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    if (vehicle.horn === 'bell') {
      for (const d of [0, 0.16]) {
        tone('sine', 2100, now + d, 0.6, 0.25);
        tone('sine', 2100 * 2.76, now + d, 0.6, 0.08);
      }
    } else if (vehicle.horn === 'horn') {
      for (const d of [0, 0.22]) {
        tone('square', 392, now + d, 0.18, 0.08);
        tone('square', 494, now + d, 0.18, 0.06);
      }
    } else {
      tone('sine', 1400, now, 0.18, 0.15, 2200);
      tone('sine', 1200, now + 0.25, 0.35, 0.15, 2400);
    }
  } catch {
    // 浏览器不支持 Web Audio 时静默忽略
  }
}
hornBtn.addEventListener('click', honk);

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLSelectElement) return;
  const actions = {
    Space: togglePause,
    KeyB: honk,
    KeyS: () => cycle('scene', SCENES, 'sceneIdx'),
    KeyD: () => cycle('skin', SKINS, 'skinIdx'),
    KeyV: () => cycle('vehicle', VEHICLES, 'vehicleIdx'),
    KeyR: randomize,
  };
  if (actions[e.code]) {
    e.preventDefault();
    actions[e.code]();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// 初始化（支持 ?scene=beach&skin=pirate&vehicle=car）
// ---------------------------------------------------------------------------
const params = new URLSearchParams(location.search);
const findIdx = (list, id) => Math.max(0, list.findIndex((x) => x.id === id));
setScene(findIdx(SCENES, params.get('scene')));
setSkin(findIdx(SKINS, params.get('skin')));
setVehicle(findIdx(VEHICLES, params.get('vehicle')));
syncUI();

function placeRider() {
  rider.position.set(Math.cos(state.angle) * PATH_RADIUS, 0, Math.sin(state.angle) * PATH_RADIUS);
  rider.rotation.y = -state.angle - Math.PI / 2; // 局部 +x 沿切线，+z 指向圆心
}
placeRider();
const prevRiderPos = rider.position.clone();
controls.target.copy(rider.position).add(V(0, 1.3, 0));
// 竖屏（手机）时把相机拉远一些，并默认收起面板
const portrait = window.innerWidth < window.innerHeight;
camera.position.copy(rider.position).add(V(3.5, 2.4, 5.5).multiplyScalar(portrait ? 1.8 : 1));
if (window.innerWidth < 520) {
  document.getElementById('panel').classList.add('collapsed');
  $('collapse').textContent = '+';
}

// ---------------------------------------------------------------------------
// 动画
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const BASE_SPEED = 2.2; // 米/秒
const tmp = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const v = state.paused ? 0 : BASE_SPEED * state.speed * vehicle.speed;

  state.distance += v * dt;
  state.angle += (v * dt) / PATH_RADIUS;
  placeRider();

  // 月球上低重力，一蹦一蹦的
  const hop = world.lowGravity && v > 0 ? Math.abs(Math.sin(state.distance * 0.6)) * 0.45 : 0;
  rider.position.y += (hop - rider.position.y) * Math.min(1, dt * 8);

  // 过弯时向圆心倾斜：tanθ = v²/(gR)
  const targetLean = Math.min(0.4, Math.atan((v * v) / (9.8 * PATH_RADIUS)) * vehicle.leanFactor + (v > 0 ? 0.02 : 0));
  lean.rotation.x += (targetLean - lean.rotation.x) * Math.min(1, dt * 3);

  const phase = vehicle.update(state.distance, t);
  const sinceHorn = t - state.hornTime;
  const joy = sinceHorn < 1.2 ? Math.sin((sinceHorn / 1.2) * Math.PI) : 0;

  pelican.root.position.copy(vehicle.seat);
  pelican.root.position.y += Math.sin(phase * 2) * vehicle.bobAmp;
  pelican.root.rotation.z = vehicle.pitch;
  pelican.update({ feet: vehicle.feet, grips: vehicle.grips, hideLegs: !vehicle.feet, phase, t, joy });

  world.update(dt, t);

  // 排气烟雾
  if (vehicle.exhaust && v > 0) {
    puffTimer -= dt;
    if (puffTimer <= 0) {
      puffTimer = 0.07;
      const p = puffs[puffIndex++ % puffs.length];
      vehicle.group.updateWorldMatrix(true, false);
      p.position.copy(vehicle.exhaust).applyMatrix4(vehicle.group.matrixWorld);
      p.userData.life = 1;
      p.visible = true;
    }
  }
  for (const p of puffs) {
    if (p.userData.life <= 0) continue;
    p.userData.life -= dt * 1.1;
    const life = Math.max(0, p.userData.life);
    p.scale.setScalar(0.5 + (1 - life) * 2.2);
    p.material.opacity = 0.45 * life;
    p.position.y += dt * 0.5;
    p.visible = life > 0;
  }

  // 跟随镜头：相机与目标一起平移，用户仍可旋转/缩放
  if (state.follow) {
    tmp.subVectors(rider.position, prevRiderPos);
    tmp.y = 0;
    camera.position.add(tmp);
    controls.target.add(tmp);
  }
  prevRiderPos.copy(rider.position);

  sun.position.copy(rider.position).add(V(8, 14, 6));
  sun.target.position.copy(rider.position);

  controls.update();
  renderer.render(scene, camera);
}

animate();
