// 24 soatlik kun-tun sikli: osmon gradienti, quyosh, oy, yulduzlar, tuman va yorug'lik
import * as THREE from 'three';
import { GLOW_TEX } from '../carModel.js';

const KEYS = [ // soat: [zenit, ufq, quyosh rangi, yorug'lik kuchi]
  [0, '#02040b', '#0b1530', '#6f86c8', 0.05],
  [5, '#0b1030', '#3a2c55', '#ff9a5a', 0.1],
  [6.5, '#3a5fa0', '#ff9e6a', '#ffb070', 0.6],
  [9, '#3f7fd0', '#a9cff0', '#fff2dc', 1.0],
  [16, '#3a78c8', '#b7d6f0', '#fff0d0', 1.0],
  [18.5, '#3b3d78', '#ff7a45', '#ff7840', 0.55],
  [19.7, '#141a40', '#4a2848', '#ff5a40', 0.15],
  [21, '#04071a', '#101a38', '#6f86c8', 0.05],
  [24, '#02040b', '#0b1530', '#6f86c8', 0.05],
];
const cA = new THREE.Color(), cB = new THREE.Color();
function sample(h, idx) {
  let i = 0; while (KEYS[i + 1][0] < h) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = (h - a[0]) / (b[0] - a[0]);
  if (typeof a[idx] === 'number') return a[idx] + (b[idx] - a[idx]) * t;
  return cA.set(a[idx]).lerp(cB.set(b[idx]), t).clone();
}

export function createSky(scene) {
  const uniforms = { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.05,0.,1.); gl_FragColor = vec4(mix(bottom, top, pow(h,0.7)),1.); }',
  }));
  dome.renderOrder = -10; scene.add(dome);

  // Yulduzlar
  const n = 1500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * Math.PI * 2, v = Math.acos(Math.random() * 0.95);
    pos.set([Math.sin(v) * Math.cos(u) * 3500, Math.cos(v) * 3500, Math.sin(v) * Math.sin(u) * 3500], i * 3);
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat); scene.add(stars);

  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xfff1c0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  sunSprite.scale.set(500, 500, 1); scene.add(sunSprite);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xcfe0ff, fog: false, depthWrite: false }));
  moon.scale.set(180, 180, 1); scene.add(moon);

  // Uzoqdagi tog'lar (Chimyon tomoni)
  const mtn = new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 1, flatShading: true });
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2, r = 2200 + Math.random() * 400, h = 120 + Math.random() * (a > 0.3 && a < 1.6 ? 420 : 160);
    const m = new THREE.Mesh(new THREE.ConeGeometry(250 + Math.random() * 200, h, 5), mtn);
    m.position.set(Math.cos(a) * r, h / 2 - 5, Math.sin(a) * r); scene.add(m);
  }

  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x2a2a20, 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); scene.add(sun, sun.target);
  scene.fog = new THREE.Fog(0x000000, 200, 1500);

  const dir = new THREE.Vector3();
  return {
    sun, hemi, night: 0,
    update(hour, center, shadows) {
      const ang = ((hour - 6) / 24) * Math.PI * 2; // 6:00 da ufqda, 12:00 da zenitda
      dir.set(Math.cos(ang) * 0.8, Math.sin(ang), 0.45).normalize();
      const top = sample(hour, 1), bottom = sample(hour, 2), sc = sample(hour, 3), k = sample(hour, 4);
      uniforms.top.value.copy(top); uniforms.bottom.value.copy(bottom);
      dome.position.copy(center); stars.position.copy(center);
      sunSprite.position.copy(center).addScaledVector(dir, 3000); sunSprite.material.color.copy(sc);
      sunSprite.visible = dir.y > -0.1;
      moon.position.copy(center).addScaledVector(dir, -3000); moon.visible = dir.y < 0.1;
      this.night = THREE.MathUtils.clamp(1 - (k - 0.05) / 0.5, 0, 1);
      starMat.opacity = this.night;
      const lightDir = dir.y > 0 ? dir : dir.clone().negate(); // tunda oy yorug'ligi
      sun.position.copy(center).addScaledVector(lightDir, 300); sun.target.position.copy(center);
      sun.color.copy(dir.y > 0 ? sc : new THREE.Color(0x8fa6e0));
      sun.intensity = dir.y > 0 ? 2.2 * k : 0.18;
      hemi.intensity = 0.1 + k * 0.7;
      hemi.color.copy(top).lerp(new THREE.Color(0xffffff), 0.5);
      scene.fog.color.copy(bottom).lerp(top, 0.3);
      sun.castShadow = shadows && dir.y > 0.05;
    },
  };
}

export function hourLabel(h) {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

