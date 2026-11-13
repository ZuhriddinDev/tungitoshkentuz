import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Bir xil materialga ega statik meshlarni bitta BufferGeometry ga birlashtiradi.
 * GLB mashina va binolardagi draw-call lar sonini 10-100x kamaytiradi.
 */
export function mergeStaticMeshesByMaterial(root) {
  if (!root) return;
  root.updateMatrixWorld(true);
  const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const relMat = new THREE.Matrix4();

  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.visible || o.isSkinnedMesh || o.isInstancedMesh) return;
    const g = o.geometry;
    const m = o.material;
    if (!g || !g.attributes?.position || !m || Array.isArray(m)) return;
    const key = `${m.uuid}|${o.castShadow ? 1 : 0}|${o.receiveShadow ? 1 : 0}`;
    let b = buckets.get(key);
    if (!b) { b = { mat: m, cast: o.castShadow, recv: o.receiveShadow, list: [] }; buckets.set(key, b); }
    b.list.push(o);
  });

  for (const b of buckets.values()) {
    if (b.list.length < 2) continue;

    // Barcha meshlarda mavjud umumiy atributlarni aniqlash
    const firstAttrs = Object.keys(b.list[0].geometry.attributes);
    const common = firstAttrs.filter((a) => (a === 'position' || a === 'normal' || a === 'uv') && b.list.every((o) => o.geometry.attributes[a]));
    if (!common.includes('position')) continue;

    const prepared = [];
    for (const o of b.list) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const attrName of Object.keys(g.attributes)) {
        if (!common.includes(attrName)) g.deleteAttribute(attrName);
      }
      relMat.multiplyMatrices(invRoot, o.matrixWorld);
      g.applyMatrix4(relMat);
      prepared.push(g);
    }

    const merged = mergeGeometries(prepared, false);
    for (const g of prepared) g.dispose();
    if (!merged) continue;

    merged.computeBoundingSphere();
    const mMesh = new THREE.Mesh(merged, b.mat);
    mMesh.castShadow = b.cast;
    mMesh.receiveShadow = b.recv;
    mMesh.frustumCulled = true;
    root.add(mMesh);

    for (const o of b.list) {
      o.parent?.remove(o);
    }
  }
}
