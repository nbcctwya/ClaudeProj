import * as THREE from 'three';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const UP = V(0, 1, 0);
export const X_AXIS = V(1, 0, 0);

/** 环形小路的半径（所有场景通用） */
export const PATH_RADIUS = 6;

export const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...opts });

const tmp = new THREE.Vector3();

/** 把一个高度为 1 的圆柱拉伸/旋转到 a→b 之间 */
export function setSegment(mesh, a, b) {
  tmp.subVectors(b, a);
  const len = tmp.length();
  mesh.position.copy(a).addScaledVector(tmp, 0.5);
  mesh.scale.set(1, Math.max(len, 1e-4), 1);
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(UP, tmp.normalize());
}

export function segment(a, b, radius, material, rBottom = radius, radial = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, rBottom, 1, radial), material);
  setSegment(m, a, b);
  return m;
}

/** 把一个单位球（主轴为 x）拉伸到 a→b 之间，保留 y/z 方向的缩放 */
export function setEllipsoid(mesh, a, b) {
  tmp.subVectors(b, a);
  const len = tmp.length();
  mesh.position.copy(a).addScaledVector(tmp, 0.5);
  mesh.scale.x = Math.max(len / 2, 1e-4);
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(X_AXIS, tmp.normalize());
}

export function ellipsoid(a, b, thickY, thickZ, material) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material);
  m.scale.set(1, thickY, thickZ);
  setEllipsoid(m, a, b);
  return m;
}

export function sphere(r, material, pos, scale) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), material);
  if (pos) m.position.copy(pos);
  if (scale) m.scale.set(...scale);
  return m;
}

export function box(w, h, d, material, pos) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  if (pos) m.position.copy(pos);
  return m;
}

/** 可复现的伪随机数 */
export function makeRand(seed = 1) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 释放一棵对象树占用的 GPU 资源 */
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const key of ['map', 'emissiveMap']) if (m[key]) m[key].dispose();
      m.dispose();
    }
  });
}

/** 给对象树里的网格开启阴影（userData.noCast 的只接收阴影） */
export function enableShadows(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.receiveShadow = true;
    o.castShadow = !o.userData.noCast && !(o.material && o.material.transparent && o.material.opacity < 0.5);
  });
}
