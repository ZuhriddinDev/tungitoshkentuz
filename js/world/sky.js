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
  scene.fog = new THREE.Fog(0x000000, 750, 2600);

  // Yengil 1-draw-call yomg'ir tizimi (GPU-friendly THREE.Points, nol GC)
  const RAIN_N = 720;
  const rainPos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 90;
    rainPos[i * 3 + 1] = Math.random() * 42;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xaad4ff,
    size: 0.24,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const rainPts = new THREE.Points(rainGeo, rainMat);
  rainPts.frustumCulled = false;
  rainPts.visible = false;
  scene.add(rainPts);

  const dir = new THREE.Vector3();
  let weatherTimer = 0;
  let targetRain = 0;
  let rainStrength = 0;

  return {
    sun, hemi, night: 0, weather: 'clear', wetGrip: 1.0, wetness: 0,
    setWeather(w) {
      this.weather = w === 'rain' ? 'rain' : w === 'overcast' ? 'overcast' : 'clear';
      targetRain = this.weather === 'rain' ? 1.0 : 0.0;
    },
    update(hour, center, shadows, dt = 0.016) {
      const ang = ((hour - 6) / 24) * Math.PI * 2; // 6:00 da ufqda, 12:00 da zenitda
      dir.set(Math.cos(ang) * 0.8, Math.sin(ang), 0.45).normalize();
      const top = sample(hour, 1), bottom = sample(hour, 2), sc = sample(hour, 3), k = sample(hour, 4);

      // Tabiiy ob-havo sikli (har ~3.5 daqiqada sokin almashadi)
      weatherTimer += dt;
      if (weatherTimer > 210) {
        weatherTimer = 0;
        const r = Math.random();
        this.setWeather(r < 0.22 ? 'rain' : r < 0.45 ? 'overcast' : 'clear');
      }
      rainStrength += (targetRain - rainStrength) * Math.min(1, dt * 0.45);
      const overcast = this.weather === 'overcast' ? 0.45 : rainStrength * 0.75;
      this.wetness = THREE.MathUtils.clamp(this.wetness + ((rainStrength > 0.2 ? 1 : 0) - this.wetness) * Math.min(1, dt * 0.18), 0, 1);
      this.wetGrip = 1.0 - this.wetness * 0.16;

      uniforms.top.value.copy(top).lerp(new THREE.Color(0x1b2230), overcast * 0.55);
      uniforms.bottom.value.copy(bottom).lerp(new THREE.Color(0x283040), overcast * 0.55);
      dome.position.copy(center); stars.position.copy(center);
      sunSprite.position.copy(center).addScaledVector(dir, 3000); sunSprite.material.color.copy(sc);
      sunSprite.visible = dir.y > -0.1 && overcast < 0.6;
      moon.position.copy(center).addScaledVector(dir, -3000); moon.visible = dir.y < 0.1 && overcast < 0.6;
      this.night = THREE.MathUtils.clamp(1 - (k - 0.05) / 0.5, 0, 1);
      starMat.opacity = this.night * (1 - overcast);
      const lightDir = dir.y > 0 ? dir : dir.clone().negate(); // tunda oy yorug'ligi
      sun.position.copy(center).addScaledVector(lightDir, 300); sun.target.position.copy(center);
      sun.color.copy(dir.y > 0 ? sc : new THREE.Color(0x8fa6e0));
      sun.intensity = (dir.y > 0 ? 2.2 * k : 0.18) * (1 - overcast * 0.45);
      hemi.intensity = (0.1 + k * 0.7) * (1 - overcast * 0.2);
      hemi.color.copy(top).lerp(new THREE.Color(0xffffff), 0.5);
      scene.fog.color.copy(uniforms.bottom.value).lerp(uniforms.top.value, 0.3);
      scene.fog.near = 750 - overcast * 380;
      scene.fog.far = 2600 - overcast * 1150;
      sun.castShadow = shadows && dir.y > 0.05 && overcast < 0.7;

      // Yomg'ir tomchilari animatsiyasi
      if (rainStrength > 0.03) {
        rainPts.visible = true;
        rainPts.position.set(center.x, 0, center.z);
        rainMat.opacity = rainStrength * 0.48;
        const arr = rainGeo.attributes.position.array;
        const fall = 34 * dt;
        for (let i = 1; i < arr.length; i += 3) {
          arr[i] -= fall;
          if (arr[i] < 0) arr[i] = 42;
        }
        rainGeo.attributes.position.needsUpdate = true;
      } else {
        rainPts.visible = false;
      }
    },
  };
}

export function hourLabel(h) {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

