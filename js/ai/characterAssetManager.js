// GLB Character Asset Manager: discovers & caches actual Kokobango/*.glb rigs,
// inspects skeletons/animations, synthesizes Bip01 AnimationClips when missing,
// and clones skinned NPCs via SkeletonUtils.clone with shared geometries/materials.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const CHARACTER_GLB_CATALOG = [
  { id: 'female_04', url: './Kokobango/Female_Adult_04.glb', gender: 'f', style: 'casual', baseH: 1.71 },
  { id: 'female_08', url: './Kokobango/Female_Adult_08.glb', gender: 'f', style: 'casual', baseH: 1.69 },
  { id: 'female_13', url: './Kokobango/Female_Adult_13.glb', gender: 'f', style: 'business', baseH: 1.73 },
  { id: 'female_17', url: './Kokobango/Female_Adult_17.glb', gender: 'f', style: 'business', baseH: 1.74 },
  { id: 'female_p1', url: './Kokobango/Female_Party_01.glb', gender: 'f', style: 'nightlife', baseH: 1.72 },
  { id: 'female_p2', url: './Kokobango/Female_Party_02.glb', gender: 'f', style: 'nightlife', baseH: 1.73 },
  { id: 'male_09', url: './Kokobango/Male_Adult_09.glb', gender: 'm', style: 'casual', baseH: 1.81 },
];

const _euler = new THREE.Euler();
const _modelQ = new THREE.Quaternion();
const _targetQ = new THREE.Quaternion();

function computeBoneTargets(root) {
  root.updateMatrixWorld(true);
  const rootQuatInv = new THREE.Quaternion();
  root.getWorldQuaternion(rootQuatInv).invert();

  const byNorm = new Map();
  root.traverse((obj) => {
    if (obj.name) {
      const n = obj.name.replace(/\s+/g, '_');
      if (!byNorm.has(n)) byNorm.set(n, obj);
    }
    if (obj.isSkinnedMesh && obj.skeleton) {
      for (const b of obj.skeleton.bones) {
        if (b && b.name) {
          const n = b.name.replace(/\s+/g, '_');
          if (!byNorm.has(n)) byNorm.set(n, b);
        }
      }
    }
  });

  const find = (name) => byNorm.get(name.replace(/\s+/g, '_')) || root.getObjectByName(name) || null;
  const slots = {
    pelvis: find('Bip01 Pelvis'),
    spine: find('Bip01 Spine1') || find('Bip01 Spine'),
    head: find('Bip01 Head'),
    lArm: find('Bip01 L UpperArm'),
    lFore: find('Bip01 L Forearm'),
    rArm: find('Bip01 R UpperArm'),
    rFore: find('Bip01 R Forearm'),
    lThigh: find('Bip01 L Thigh'),
    lCalf: find('Bip01 L Calf'),
    rThigh: find('Bip01 R Thigh'),
    rCalf: find('Bip01 R Calf'),
  };

  const rig = {};
  for (const [slot, bone] of Object.entries(slots)) {
    if (!bone) continue;
    const parentWorld = new THREE.Quaternion();
    if (bone.parent) {
      bone.parent.getWorldQuaternion(parentWorld);
      parentWorld.premultiply(rootQuatInv);
    }
    rig[slot] = {
      name: bone.name,
      base: bone.quaternion.clone(),
      parentWorld,
      parentInv: parentWorld.clone().invert(),
    };
  }
  return rig;
}

function localQuatFor(entry, rx, ry, rz) {
  _euler.set(rx, ry, rz, 'XYZ');
  _modelQ.setFromEuler(_euler);
  _targetQ.copy(entry.parentInv).multiply(_modelQ).multiply(entry.parentWorld).multiply(entry.base);
  return _targetQ.toArray();
}

function buildTrack(entry, times, poses) {
  const values = [];
  for (let i = 0; i < poses.length; i++) {
    const [rx, ry, rz] = poses[i];
    const q = localQuatFor(entry, rx, ry, rz);
    values.push(q[0], q[1], q[2], q[3]);
  }
  return new THREE.QuaternionKeyframeTrack(`${entry.name}.quaternion`, times, values);
}

/**
 * Synthesizes AnimationClips in the exact local Bip01 coordinate frame of the GLB
 * when the source GLB carries no embedded animation tracks.
 */
function buildBip01Clips(rig) {
  const clips = {};
  const addClip = (name, duration, spec) => {
    const tracks = [];
    for (const [slot, data] of Object.entries(spec)) {
      if (!rig[slot]) continue;
      tracks.push(buildTrack(rig[slot], data.times, data.poses));
    }
    if (tracks.length > 0) clips[name] = new THREE.AnimationClip(name, duration, tracks);
  };

  // 1. IDLE (natural relaxed arms down, subtle breathing sway)
  addClip('idle', 2.4, {
    spine: { times: [0, 1.2, 2.4], poses: [[0.02, 0, 0], [0.05, 0.03, 0], [0.02, 0, 0]] },
    head: { times: [0, 1.2, 2.4], poses: [[0, -0.04, 0], [0.03, 0.05, 0], [0, -0.04, 0]] },
    lArm: { times: [0, 1.2, 2.4], poses: [[0.04, 0, -1.24], [0.07, 0, -1.20], [0.04, 0, -1.24]] },
    rArm: { times: [0, 1.2, 2.4], poses: [[0.04, 0, 1.24], [0.07, 0, 1.20], [0.04, 0, 1.24]] },
    lFore: { times: [0, 1.2, 2.4], poses: [[-0.20, 0, 0], [-0.26, 0, 0], [-0.20, 0, 0]] },
    rFore: { times: [0, 1.2, 2.4], poses: [[-0.20, 0, 0], [-0.26, 0, 0], [-0.20, 0, 0]] },
    lThigh: { times: [0, 2.4], poses: [[0, 0, 0], [0, 0, 0]] },
    rThigh: { times: [0, 2.4], poses: [[0, 0, 0], [0, 0, 0]] },
    lCalf: { times: [0, 2.4], poses: [[0.03, 0, 0], [0.03, 0, 0]] },
    rCalf: { times: [0, 2.4], poses: [[0.03, 0, 0], [0.03, 0, 0]] },
  });

  // 2. WALK (full 1.0s stride cycle, knee bend + opposite arm swing)
  const wt = [0, 0.25, 0.5, 0.75, 1.0];
  addClip('walk', 1.0, {
    pelvis: { times: wt, poses: [[0, 0.05, 0], [0, 0, 0.02], [0, -0.05, 0], [0, 0, -0.02], [0, 0.05, 0]] },
    spine: { times: wt, poses: [[0.04, -0.05, 0], [0.05, 0, 0], [0.04, 0.05, 0], [0.05, 0, 0], [0.04, -0.05, 0]] },
    lThigh: { times: wt, poses: [[-0.42, 0, 0], [0, 0, 0], [0.38, 0, 0], [0.05, 0, 0], [-0.42, 0, 0]] },
    rThigh: { times: wt, poses: [[0.38, 0, 0], [0.05, 0, 0], [-0.42, 0, 0], [0, 0, 0], [0.38, 0, 0]] },
    lCalf: { times: wt, poses: [[0.08, 0, 0], [0.18, 0, 0], [0.46, 0, 0], [0.62, 0, 0], [0.08, 0, 0]] },
    rCalf: { times: wt, poses: [[0.46, 0, 0], [0.62, 0, 0], [0.08, 0, 0], [0.18, 0, 0], [0.46, 0, 0]] },
    lArm: { times: wt, poses: [[0.30, 0, -1.24], [0, 0, -1.26], [-0.28, 0, -1.24], [0, 0, -1.26], [0.30, 0, -1.24]] },
    rArm: { times: wt, poses: [[-0.28, 0, 1.24], [0, 0, 1.26], [0.30, 0, 1.24], [0, 0, 1.26], [-0.28, 0, 1.24]] },
    lFore: { times: wt, poses: [[-0.25, 0, 0], [-0.30, 0, 0], [-0.42, 0, 0], [-0.30, 0, 0], [-0.25, 0, 0]] },
    rFore: { times: wt, poses: [[-0.42, 0, 0], [-0.30, 0, 0], [-0.25, 0, 0], [-0.30, 0, 0], [-0.42, 0, 0]] },
  });

  // 3. FAST WALK / RUN (larger stride & bent elbows)
  const rt = [0, 0.175, 0.35, 0.525, 0.7];
  addClip('run', 0.7, {
    pelvis: { times: rt, poses: [[0.06, 0.08, 0], [0.08, 0, 0.03], [0.06, -0.08, 0], [0.08, 0, -0.03], [0.06, 0.08, 0]] },
    spine: { times: rt, poses: [[0.14, -0.08, 0], [0.16, 0, 0], [0.14, 0.08, 0], [0.16, 0, 0], [0.14, -0.08, 0]] },
    lThigh: { times: rt, poses: [[-0.68, 0, 0], [0, 0, 0], [0.56, 0, 0], [-0.15, 0, 0], [-0.68, 0, 0]] },
    rThigh: { times: rt, poses: [[0.56, 0, 0], [-0.15, 0, 0], [-0.68, 0, 0], [0, 0, 0], [0.56, 0, 0]] },
    lCalf: { times: rt, poses: [[0.18, 0, 0], [0.42, 0, 0], [0.95, 0, 0], [0.85, 0, 0], [0.18, 0, 0]] },
    rCalf: { times: rt, poses: [[0.95, 0, 0], [0.85, 0, 0], [0.18, 0, 0], [0.42, 0, 0], [0.95, 0, 0]] },
    lArm: { times: rt, poses: [[0.58, 0, -1.16], [0, 0, -1.18], [-0.52, 0, -1.16], [0, 0, -1.18], [0.58, 0, -1.16]] },
    rArm: { times: rt, poses: [[-0.52, 0, 1.16], [0, 0, 1.18], [0.58, 0, 1.16], [0, 0, 1.18], [-0.52, 0, 1.16]] },
    lFore: { times: rt, poses: [[-1.05, 0, 0], [-1.15, 0, 0], [-1.05, 0, 0], [-1.15, 0, 0], [-1.05, 0, 0]] },
    rFore: { times: rt, poses: [[-1.05, 0, 0], [-1.15, 0, 0], [-1.05, 0, 0], [-1.15, 0, 0], [-1.05, 0, 0]] },
  });

  // 4. PHONE (looking down at phone held in right hand)
  addClip('phone', 2.2, {
    spine: { times: [0, 1.1, 2.2], poses: [[0.08, 0, 0], [0.10, 0.02, 0], [0.08, 0, 0]] },
    head: { times: [0, 1.1, 2.2], poses: [[0.34, 0.04, 0], [0.38, -0.02, 0], [0.34, 0.04, 0]] },
    lArm: { times: [0, 2.2], poses: [[0.04, 0, -1.24], [0.04, 0, -1.24]] },
    rArm: { times: [0, 1.1, 2.2], poses: [[-0.42, 0.18, 1.02], [-0.46, 0.16, 1.00], [-0.42, 0.18, 1.02]] },
    rFore: { times: [0, 1.1, 2.2], poses: [[-1.25, 0, 0], [-1.32, 0, 0], [-1.25, 0, 0]] },
  });

  // 5. TALK (expressive hand gestures + head nods)
  addClip('talk', 1.8, {
    spine: { times: [0, 0.9, 1.8], poses: [[0.02, -0.06, 0], [0.06, 0.06, 0], [0.02, -0.06, 0]] },
    head: { times: [0, 0.6, 1.2, 1.8], poses: [[0.05, 0.08, 0], [-0.04, -0.08, 0], [0.08, 0.04, 0], [0.05, 0.08, 0]] },
    lArm: { times: [0, 0.9, 1.8], poses: [[-0.22, -0.1, -1.08], [-0.38, -0.15, -0.98], [-0.22, -0.1, -1.08]] },
    rArm: { times: [0, 0.9, 1.8], poses: [[-0.36, 0.15, 0.98], [-0.18, 0.1, 1.12], [-0.36, 0.15, 0.98]] },
    lFore: { times: [0, 0.9, 1.8], poses: [[-0.75, 0, 0], [-1.05, 0, 0], [-0.75, 0, 0]] },
    rFore: { times: [0, 0.9, 1.8], poses: [[-1.08, 0, 0], [-0.68, 0, 0], [-1.08, 0, 0]] },
  });

  // 6. LOOK AROUND (checking left/right at crosswalk or waiting)
  addClip('look_around', 2.6, {
    head: { times: [0, 0.7, 1.4, 2.1, 2.6], poses: [[0, 0, 0], [0.04, 0.48, 0], [0.02, 0.0, 0], [0.04, -0.48, 0], [0, 0, 0]] },
    spine: { times: [0, 0.7, 1.4, 2.1, 2.6], poses: [[0, 0, 0], [0, 0.12, 0], [0, 0, 0], [0, -0.12, 0], [0, 0, 0]] },
    lArm: { times: [0, 2.6], poses: [[0.04, 0, -1.24], [0.04, 0, -1.24]] },
    rArm: { times: [0, 2.6], poses: [[0.04, 0, 1.24], [0.04, 0, 1.24]] },
  });

  return clips;
}

export class CharacterAssetManager {
  constructor() {
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/gltf/');
    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(draco);
    this.loader.setMeshoptDecoder(MeshoptDecoder);

    this.templates = new Map();
    this.loading = new Map();
    this.diagnostics = {
      loadedModels: [],
      missingModels: [],
      missingNativeAnims: [],
      synthesizedClips: [],
      activeClones: 0,
    };
  }

  async preloadAll() {
    await Promise.allSettled(CHARACTER_GLB_CATALOG.map((spec) => this.loadTemplate(spec)));
  }

  loadTemplate(spec) {
    if (this.templates.has(spec.id)) return Promise.resolve(this.templates.get(spec.id));
    if (this.loading.has(spec.id)) return this.loading.get(spec.id);

    const p = new Promise((resolve) => {
      this.loader.load(
        spec.url,
        (gltf) => {
          const root = gltf.scene;
          root.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = false;
              o.receiveShadow = false;
              o.frustumCulled = true;
            }
          });
          const box = new THREE.Box3().setFromObject(root);
          const size = new THREE.Vector3();
          box.getSize(size);
          const rawH = Math.max(0.5, size.y);
          const normScale = spec.baseH / rawH;
          const groundOffset = -box.min.y * normScale;

          const rig = computeBoneTargets(root);
          const nativeAnims = gltf.animations || [];
          let clips = {};
          if (nativeAnims.length > 0) {
            for (const clip of nativeAnims) {
              clips[clip.name.toLowerCase()] = clip;
            }
          } else {
            this.diagnostics.missingNativeAnims.push(spec.id);
            clips = buildBip01Clips(rig);
            if (this.diagnostics.synthesizedClips.length === 0) {
              this.diagnostics.synthesizedClips = Object.keys(clips);
            }
          }

          const tpl = { spec, root, normScale, groundOffset, clips };
          this.templates.set(spec.id, tpl);
          this.diagnostics.loadedModels.push(spec.id);
          resolve(tpl);
        },
        undefined,
        () => {
          this.diagnostics.missingModels.push(spec.url);
          resolve(null);
        }
      );
    });

    this.loading.set(spec.id, p);
    return p;
  }

  createInstance(specId, heightScale = 1.0) {
    const tpl = this.templates.get(specId);
    if (!tpl) return null;

    const clone = SkeletonUtils.clone(tpl.root);
    const s = tpl.normScale * heightScale;
    clone.scale.setScalar(s);
    clone.position.y = tpl.groundOffset * heightScale;

    const mixer = new THREE.AnimationMixer(clone);
    const actions = {};
    for (const [name, clip] of Object.entries(tpl.clips)) {
      const act = mixer.clipAction(clip);
      actions[name] = act;
    }

    let currentState = null;
    if (actions.idle) {
      actions.idle.play();
      currentState = 'idle';
    }

    this.diagnostics.activeClones++;
    return {
      spec: tpl.spec,
      root: clone,
      mixer,
      actions,
      get state() {
        return currentState;
      },
      setAnimation(name, timeScale = 1.0, fadeSec = 0.22) {
        const nextKey = actions[name] ? name : actions.walk && name === 'fast_walk' ? 'walk' : 'idle';
        const nextAct = actions[nextKey];
        if (!nextAct) return;
        nextAct.timeScale = timeScale;
        if (currentState === nextKey) return;
        const prevAct = currentState ? actions[currentState] : null;
        nextAct.reset().setEffectiveWeight(1).play();
        if (prevAct && prevAct !== nextAct) {
          prevAct.crossFadeTo(nextAct, fadeSec, true);
        }
        currentState = nextKey;
      },
      dispose() {
        mixer.stopAllAction();
        mixer.uncacheRoot(clone);
      },
    };
  }

  disposeAll() {
    for (const tpl of this.templates.values()) {
      tpl.root.traverse((o) => {
        if (o.isMesh) {
          o.geometry?.dispose?.();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m?.dispose?.();
        }
      });
    }
    this.templates.clear();
    this.loading.clear();
  }
}
