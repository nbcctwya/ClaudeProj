import * as THREE from 'three';
import { V, mat, setSegment, setEllipsoid, ellipsoid, disposeTree, enableShadows } from './utils.js';

const THIGH = 0.66;
const SHIN = 0.7;
const ARM = 0.42;

/**
 * 创建鹈鹕。
 * root 的原点是两髋中点，交通工具只需要把 root 放到“座位”上。
 * 腿和翅膀每帧根据交通工具给出的脚/手目标点用 IK 摆好。
 */
export function createPelican() {
  const root = new THREE.Group();
  const rig = new THREE.Group(); // 建模坐标系：髋部中点在 (-0.18, 1.62, 0)
  rig.position.set(0.18, -1.62, 0);
  root.add(rig);

  const mats = {
    body: mat(0xffffff, { roughness: 0.85 }),
    wing: mat(0xffffff, { roughness: 0.85 }),
    tip: mat(0xffffff, { roughness: 0.8 }),
    head: mat(0xffffff, { roughness: 0.85 }),
    neck: mat(0xffffff, { roughness: 0.85 }),
    crest: mat(0xffffff, { roughness: 0.9 }),
    bill: mat(0xffffff, { roughness: 0.45 }),
    pouch: mat(0xffffff, { roughness: 0.5 }),
    leg: mat(0xffffff, { roughness: 0.55 }),
  };

  // 身体
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mats.body);
  body.scale.set(0.4, 0.55, 0.36);
  body.position.set(-0.17, 1.95, 0);
  body.rotation.z = -0.55;
  rig.add(body);

  // 尾巴
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 10), mats.body);
  tail.position.set(-0.6, 1.62, 0);
  tail.rotation.z = Math.PI / 2 + 0.45;
  tail.scale.z = 0.5;
  rig.add(tail);

  // S 形脖子
  const neckCurve = new THREE.CatmullRomCurve3([
    V(0.0, 2.25, 0),
    V(0.06, 2.48, 0),
    V(0.0, 2.68, 0),
    V(0.14, 2.86, 0),
    V(0.32, 2.92, 0),
  ]);
  rig.add(new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 32, 0.095, 12, false), mats.neck));

  // 头
  const head = new THREE.Group();
  head.position.set(0.36, 2.94, 0);
  rig.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), mats.head);
  skull.scale.set(1.15, 1, 0.95);
  head.add(skull);

  const crest = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), mats.crest);
  crest.scale.set(1.6, 0.6, 0.7);
  crest.position.set(-0.1, 0.11, 0);
  crest.rotation.z = 0.4;
  head.add(crest);

  for (const z of [0.12, -0.12]) {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), mat(0xffffff, { roughness: 0.3 }));
    eyeWhite.position.set(0.07, 0.04, z);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), mat(0x111111, { roughness: 0.2 }));
    pupil.position.set(0.095, 0.045, z * 1.2);
    head.add(eyeWhite, pupil);
  }

  // 长喙 + 喉囊
  const billTip = V(0.98, -0.16, 0);
  head.add(ellipsoid(V(0.12, -0.02, 0), billTip, 0.035, 0.07, mats.bill));
  const hook = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mats.bill);
  hook.position.copy(billTip).add(V(0, -0.025, 0));
  head.add(hook);

  const pouch = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mats.pouch);
  pouch.scale.set(0.4, 0.11, 0.065);
  pouch.position.set(0.54, -0.15, 0);
  pouch.rotation.z = -0.12;
  head.add(pouch);

  // 收在身体两侧的翅膀
  for (const side of [1, -1]) {
    const folded = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mats.wing);
    folded.scale.set(0.42, 0.2, 0.08);
    folded.position.set(-0.22, 1.98, side * 0.33);
    folded.rotation.z = -0.25;
    rig.add(folded);
    for (let k = 0; k < 3; k++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mats.tip);
      f.scale.set(0.2, 0.05, 0.03);
      f.position.set(-0.58 - k * 0.04, 1.86 - k * 0.06, side * (0.34 - k * 0.02));
      f.rotation.z = 0.35 + k * 0.12;
      rig.add(f);
    }
  }

  // 能动的"手臂"（翅膀前段）
  const shoulders = [V(0.02, 2.15, 0.3), V(0.02, 2.15, -0.3)];
  const arms = shoulders.map(() => {
    const upper = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mats.wing);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mats.wing);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mats.tip);
    rig.add(upper, lower, tip);
    return { upper, lower, tip };
  });

  // 腿：毛茸茸的大腿 + 橙色小腿 + 带蹼的脚
  const hips = [V(-0.18, 1.62, 0.17), V(-0.18, 1.62, -0.17)];
  const footShape = new THREE.Shape();
  footShape.moveTo(-0.04, 0);
  footShape.lineTo(0.16, 0.09);
  footShape.quadraticCurveTo(0.19, 0, 0.16, -0.09);
  footShape.lineTo(-0.04, 0);
  const legs = hips.map(() => {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.06, 1, 12), mats.body);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 1, 10), mats.leg);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mats.leg);
    const footGeo = new THREE.ExtrudeGeometry(footShape, { depth: 0.02, bevelEnabled: false });
    footGeo.rotateX(Math.PI / 2);
    const foot = new THREE.Mesh(footGeo, mats.leg);
    rig.add(thigh, shin, knee, foot);
    return [thigh, shin, knee, foot];
  });

  // 配饰挂点
  const headAcc = new THREE.Group();
  head.add(headAcc);
  const bodyAcc = new THREE.Group();
  rig.add(bodyAcc);

  // -------------------------------------------------------------------------
  function applySkin(skin) {
    const p = skin.palette;
    for (const key of Object.keys(mats)) {
      const m = mats[key];
      m.color.setHex(p[key]);
      const finish = skin.finish && skin.finish.parts.includes(key) ? skin.finish : null;
      m.metalness = finish ? finish.metalness : 0.05;
      m.roughness = finish ? finish.roughness : key === 'bill' ? 0.45 : key === 'pouch' ? 0.5 : 0.85;
    }
    for (const g of [headAcc, bodyAcc]) {
      for (const c of [...g.children]) {
        g.remove(c);
        disposeTree(c);
      }
    }
    if (skin.accessories) skin.accessories({ head: headAcc, body: bodyAcc });
    enableShadows(headAcc);
    enableShadows(bodyAcc);
  }

  // -------------------------------------------------------------------------
  const toRig = new THREE.Matrix4();
  const target = new THREE.Vector3();
  const knee = new THREE.Vector3();
  const elbow = new THREE.Vector3();
  const dir = new THREE.Vector3();

  function solveLeg(hip, ankle, out) {
    const dx = ankle.x - hip.x;
    const dy = ankle.y - hip.y;
    const d = Math.min(Math.hypot(dx, dy), THIGH + SHIN - 0.001);
    const cosA = (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d);
    const ang = Math.atan2(dy, dx) + Math.acos(THREE.MathUtils.clamp(cosA, -1, 1)); // 膝盖朝前
    return out.set(hip.x + Math.cos(ang) * THIGH, hip.y + Math.sin(ang) * THIGH, (hip.z + ankle.z) / 2);
  }

  /**
   * @param o.feet  交通工具坐标系下的两个脚踝目标点，或 null
   * @param o.grips 交通工具坐标系下的两个握把点，或 null（张开翅膀保持平衡）
   */
  function update({ feet, grips, hideLegs, phase, t, joy }) {
    root.updateMatrix();
    rig.updateMatrix();
    toRig.multiplyMatrices(root.matrix, rig.matrix).invert();

    legs.forEach(([thigh, shin, kneeMesh, foot], i) => {
      const visible = !hideLegs && !!feet;
      thigh.visible = shin.visible = kneeMesh.visible = foot.visible = visible;
      if (!visible) return;
      target.copy(feet[i]).applyMatrix4(toRig);
      solveLeg(hips[i], target, knee);
      setSegment(thigh, hips[i], knee);
      setSegment(shin, knee, target);
      kneeMesh.position.copy(knee);
      foot.position.set(target.x - 0.04, target.y - 0.045, target.z);
    });

    arms.forEach(({ upper, lower, tip }, i) => {
      const s = shoulders[i];
      const side = i === 0 ? 1 : -1;
      if (grips) {
        target.copy(grips[i]).applyMatrix4(toRig);
      } else {
        // 没有车把：张开翅膀保持平衡，还会轻轻扇动
        target.set(s.x + 0.1, s.y - 0.02 + Math.sin(t * 3 + i * 1.7) * 0.14, s.z + side * 0.72);
      }
      dir.subVectors(target, s);
      const len = dir.length();
      const bend = Math.sqrt(Math.max(0, ARM * ARM - (len / 2) ** 2));
      elbow.copy(s).add(target).multiplyScalar(0.5).add(V(0, -bend * 0.8, side * bend * 0.6));

      if (grips) {
        upper.scale.set(1, 0.09, 0.06);
        lower.scale.set(1, 0.07, 0.05);
        tip.scale.set(1, 0.06, 0.05);
      } else {
        upper.scale.set(1, 0.05, 0.16);
        lower.scale.set(1, 0.04, 0.14);
        tip.scale.set(1, 0.03, 0.11);
      }
      setEllipsoid(upper, s, elbow);
      setEllipsoid(lower, elbow, target);
      dir.subVectors(target, elbow).normalize();
      setEllipsoid(tip, target.clone().addScaledVector(dir, -0.05), target.clone().addScaledVector(dir, grips ? 0.07 : 0.3));
    });

    head.rotation.z = Math.sin(phase * 2) * 0.04 + joy * 0.35;
    head.rotation.y = Math.sin(t * 0.7) * 0.12;
    pouch.scale.y = 0.11 + Math.sin(t * 6) * 0.006 + joy * 0.04;
  }

  enableShadows(root);
  return { root, applySkin, update };
}
