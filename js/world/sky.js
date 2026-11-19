// 24 soatlik kinematografik kun-tun sikli: Rayleigh/Mie osmon shaderi, harakatlanuvchi FBM bulutlar,
// rangli yulduzlar, qorli Chimyon tog'lari, tungi shahar ufq nuri va yomg'ir/ho'llik tizimi
import * as THREE from 'three';
import { GLOW_TEX } from '../carModel.js';

const KEYS = [ // soat: [zenit, ufq, quyosh rangi, yorug'lik kuchi]
  [0, '#020510', '#0c1633', '#7c96db', 0.05],
  [5, '#0b1236', '#422f5e', '#ff9a5a', 0.12],
  [6.5, '#2f5fa8', '#ff9b63', '#ffb470', 0.65],
  [9, '#2b70cc', '#9ecbf5', '#fff4e0', 1.0],
  [16, '#286ac4', '#afd4f5', '#fff0d0', 1.0],
  [18.5, '#34387a', '#ff7040', '#ff7438', 0.58],
  [19.7, '#12183f', '#4e274e', '#ff543c', 0.16],
  [21, '#04081c', '#111d3f', '#7c96db', 0.06],
  [24, '#020510', '#0c1633', '#7c96db', 0.05],
];
const cA = new THREE.Color(), cB = new THREE.Color();
function sample(h, idx) {
  let i = 0; while (KEYS[i + 1][0] < h) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = (h - a[0]) / (b[0] - a[0]);
  if (typeof a[idx] === 'number') return a[idx] + (b[idx] - a[idx]) * t;
  return cA.set(a[idx]).lerp(cB.set(b[idx]), t).clone();
}

export function createSky(scene) {
  const uniforms = {
    top: { value: new THREE.Color() },
    bottom: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color(0xfff0d0) },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    uTime: { value: 0 },
    uNight: { value: 0 },
    uOvercast: { value: 0 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(4000, 36, 20),
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vP;
        void main() {
          vP = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 bottom;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        uniform float uTime;
        uniform float uNight;
        uniform float uOvercast;
        varying vec3 vP;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = p * 2.04 + vec2(1.7, 9.2);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 d = normalize(vP);
          float h = clamp(d.y * 1.55 + 0.05, 0.0, 1.0);
          vec3 col = mix(bottom, top, pow(h, 0.68));

          // Mie quyosh halosi va shafaq nuri
          float sunAmt = max(dot(d, normalize(sunDir)), 0.0);
          float dayVis = (1.0 - uNight * 0.92) * (1.0 - uOvercast * 0.7);
          col += sunColor * (pow(sunAmt, 14.0) * 0.32 + pow(sunAmt, 120.0) * 0.75) * dayVis;

          // Tungi metropoliten ufq yorug'ligi (Toshkent shahar nuri)
          float cityGlow = smoothstep(0.28, -0.02, d.y) * uNight;
          col += vec3(0.16, 0.11, 0.24) * cityGlow * (0.75 + uOvercast * 0.6);

          // Procedural harakatlanuvchi bulutlar (faqat ufqdan yuqorida)
          if (d.y > 0.02) {
            vec2 uv = d.xz / (d.y + 0.22) * 1.35 + vec2(uTime * 0.008, uTime * 0.004);
            float n = fbm(uv);
            float cover = mix(0.56, 0.28, uOvercast);
            float cloud = smoothstep(cover, cover + 0.34, n) * smoothstep(0.02, 0.18, d.y);
            vec3 dayCloud = mix(vec3(0.95, 0.97, 1.0), sunColor, pow(sunAmt, 4.0) * 0.55);
            vec3 nightCloud = vec3(0.11, 0.14, 0.25);
            vec3 cCol = mix(dayCloud, nightCloud, uNight);
            cCol = mix(cCol, vec3(0.32, 0.36, 0.44), uOvercast * 0.55 * (1.0 - uNight));
            col = mix(col, cCol, cloud * (0.68 + uOvercast * 0.25));
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  dome.renderOrder = -10;
  scene.add(dome);

  // Rangli yulduzlar (2200 ta, issiq va sovuq yulduzlar)
  const n = 2200;
  const pos = new Float32Array(n * 3);
  const cols = new Float32Array(n * 3);
  const starPalette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0xcce4ff),
    new THREE.Color(0xffe7c2),
    new THREE.Color(0xaad0ff),
  ];
  for (let i = 0; i < n; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(Math.random() * 0.96);
    pos.set([Math.sin(v) * Math.cos(u) * 3500, Math.cos(v) * 3500, Math.sin(v) * Math.sin(u) * 3500], i * 3);
    const sc = starPalette[i % starPalette.length];
    const br = 0.55 + Math.random() * 0.45;
    cols.set([sc.r * br, sc.g * br, sc.b * br], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const starMat = new THREE.PointsMaterial({
    size: 2.3,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    fog: false,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xfff1c0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  sunSprite.scale.set(560, 560, 1);
  scene.add(sunSprite);
  const moon = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xd8e8ff, fog: false, depthWrite: false })
  );
  moon.scale.set(200, 200, 1);
  scene.add(moon);

  // Uzoqdagi Chimyon tog'lari (qorli cho'qqilar bilan)
  const mtnMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, flatShading: true });
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    const r = 2200 + Math.random() * 420;
    const h = 130 + Math.random() * (a > 0.3 && a < 1.65 ? 460 : 180);
    const g = new THREE.ConeGeometry(260 + Math.random() * 210, h, 6);
    const pAttr = g.attributes.position;
    const vCols = new Float32Array(pAttr.count * 3);
    const baseC = new THREE.Color(0x232c3d);
    const snowC = new THREE.Color(0xcbd9eb);
    const tmpC = new THREE.Color();
    for (let vi = 0; vi < pAttr.count; vi++) {
      const ny = (pAttr.getY(vi) + h / 2) / h;
      const snow = ny > 0.68 ? Math.min(1, (ny - 0.68) / 0.24) : 0;
      tmpC.copy(baseC).lerp(snowC, snow * (h > 280 ? 0.9 : 0.35));
      vCols[vi * 3] = tmpC.r;
      vCols[vi * 3 + 1] = tmpC.g;
      vCols[vi * 3 + 2] = tmpC.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(vCols, 3));
    const m = new THREE.Mesh(g, mtnMat);
    m.position.set(Math.cos(a) * r, h / 2 - 6, Math.sin(a) * r);
    scene.add(m);
  }

  const hemi = new THREE.HemisphereLight(0xc8e0ff, 0x262834, 0.72);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  scene.fog = new THREE.Fog(0x000000, 780, 2700);

  // Yengil 1-draw-call yomg'ir tizimi (GPU-friendly THREE.Points)
  const RAIN_N = 900;
  const rainPos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 95;
    rainPos[i * 3 + 1] = Math.random() * 44;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 95;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xbbe0ff,
    size: 0.26,
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
  const overcastTintTop = new THREE.Color(0x1b2230);
  const overcastTintBot = new THREE.Color(0x283040);
  const moonCol = new THREE.Color(0x95b2f0);
  const whiteCol = new THREE.Color(0xffffff);
  let weatherTimer = 0;
  let targetRain = 0;
  let rainStrength = 0;
  let skyTime = 0;

  return {
    sun,
    hemi,
    hour: 22,
    night: 0,
    weather: 'clear',
    wetGrip: 1.0,
    wetness: 0,
    setWeather(w) {
      this.weather = w === 'rain' ? 'rain' : w === 'overcast' ? 'overcast' : 'clear';
      targetRain = this.weather === 'rain' ? 1.0 : 0.0;
    },
    update(hour, center, shadows, dt = 0.016) {
      this.hour = hour;
      skyTime += dt;
      const ang = ((hour - 6) / 24) * Math.PI * 2;
      dir.set(Math.cos(ang) * 0.8, Math.sin(ang), 0.45).normalize();
      const top = sample(hour, 1);
      const bottom = sample(hour, 2);
      const sc = sample(hour, 3);
      const k = sample(hour, 4);

      weatherTimer += dt;
      if (weatherTimer > 210) {
        weatherTimer = 0;
        const r = Math.random();
        this.setWeather(r < 0.22 ? 'rain' : r < 0.45 ? 'overcast' : 'clear');
      }
      rainStrength += (targetRain - rainStrength) * Math.min(1, dt * 0.45);
      const overcast = this.weather === 'overcast' ? 0.45 : rainStrength * 0.75;
      this.wetness = THREE.MathUtils.clamp(
        this.wetness + ((rainStrength > 0.2 ? 1 : 0) - this.wetness) * Math.min(1, dt * 0.18),
        0,
        1
      );
      this.wetGrip = 1.0 - this.wetness * 0.16;

      this.night = THREE.MathUtils.clamp(1 - (k - 0.05) / 0.5, 0, 1);
      uniforms.top.value.copy(top).lerp(overcastTintTop, overcast * 0.55);
      uniforms.bottom.value.copy(bottom).lerp(overcastTintBot, overcast * 0.55);
      uniforms.sunColor.value.copy(sc);
      uniforms.sunDir.value.copy(dir);
      uniforms.uTime.value = skyTime;
      uniforms.uNight.value = this.night;
      uniforms.uOvercast.value = overcast;

      dome.position.copy(center);
      stars.position.copy(center);
      sunSprite.position.copy(center).addScaledVector(dir, 3000);
      sunSprite.material.color.copy(sc);
      sunSprite.visible = dir.y > -0.1 && overcast < 0.6;
      moon.position.copy(center).addScaledVector(dir, -3000);
      moon.visible = dir.y < 0.1 && overcast < 0.6;
      starMat.opacity = this.night * (1 - overcast * 0.85);

      const lightDir = dir.y > 0 ? dir : dir.clone().negate();
      sun.position.copy(center).addScaledVector(lightDir, 300);
      sun.target.position.copy(center);
      sun.color.copy(dir.y > 0 ? sc : moonCol);
      sun.intensity = (dir.y > 0 ? 2.45 * k : 0.28) * (1 - overcast * 0.42);
      hemi.intensity = (0.18 + k * 0.78) * (1 - overcast * 0.18);
      hemi.color.copy(top).lerp(whiteCol, 0.55);
      scene.fog.color.copy(uniforms.bottom.value).lerp(uniforms.top.value, 0.28);
      scene.fog.near = 780 - overcast * 380;
      scene.fog.far = 2700 - overcast * 1150;
      sun.castShadow = shadows && dir.y > 0.05 && overcast < 0.7;

      if (rainStrength > 0.03) {
        rainPts.visible = true;
        rainPts.position.set(center.x, 0, center.z);
        rainMat.opacity = rainStrength * 0.52;
        const arr = rainGeo.attributes.position.array;
        const fall = 38 * dt;
        for (let i = 1; i < arr.length; i += 3) {
          arr[i] -= fall;
          if (arr[i] < 0) arr[i] = 44;
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
