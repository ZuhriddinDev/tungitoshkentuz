// TrafficAudioManager mantiqiy testi (Node, soxta WebAudio bilan).
// Ishga tushirish: node scripts/test_traffic_audio.mjs
// Eslatma: bu test faqat tanlash/bo'shatish/RPM/fallback mantig'ini tekshiradi. Ovoz sifatini quloq bilan baholab bo'lmaydi.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// 'three' ni minimal stub bilan almashtirish (lokalda o'rnatilmagan)
const threeStub = `
export const MathUtils = { clamp: (v, a, b) => Math.max(a, Math.min(b, v)) };
export class Vector3 { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} }
`;
register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(threeStub)}), shortCircuit: true };
  return next(spec, ctx);
}`),
  pathToFileURL('./')
);

let failures = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log(`[PASS] ${name}`);
  else { failures++; console.log(`[FAIL] ${name} ${extra}`); }
};

// ---- Soxta WebAudio ----
const fetched = [];
const param = (v = 0) => ({
  value: v, target: v,
  setValueAtTime(x) { this.value = x; this.target = x; },
  setTargetAtTime(x) { this.target = x; },
  cancelScheduledValues() {},
  linearRampToValueAtTime(x) { this.target = x; },
  exponentialRampToValueAtTime(x) { this.target = x; },
});
const node = (extra = {}) => ({
  connect(dst) { return dst; },
  disconnect() {},
  start() { this.started = true; },
  stop() { this.stopped = true; },
  ...extra,
});
let nowT = 0;
class FakeCtx {
  constructor() {
    this.state = 'running';
    this.sampleRate = 8000;
    this.destination = node();
    this.listener = { positionX: param(), positionY: param(), positionZ: param(), forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param() };
  }
  get currentTime() { return (nowT += 0.016); }
  resume() { return Promise.resolve(); }
  createGain() { return node({ gain: param(1) }); }
  createBiquadFilter() { return node({ frequency: param(1000), Q: param(1), gain: param(0), type: '' }); }
  createWaveShaper() { return node({ curve: null, oversample: 'none' }); }
  createBufferSource() { return node({ playbackRate: param(1), buffer: null, loop: false }); }
  createOscillator() { return node({ frequency: param(440), type: '' }); }
  createDynamicsCompressor() { return node({ threshold: param(), ratio: param() }); }
  createPanner() {
    return node({ positionX: param(), positionY: param(), positionZ: param(), panningModel: '', distanceModel: '' });
  }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len), length: len }; }
  decodeAudioData() { return Promise.resolve({ fake: true }); }
}
globalThis.window = { AudioContext: FakeCtx };
globalThis.localStorage = undefined;
globalThis.fetch = async (url) => {
  fetched.push(String(url));
  return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
};
globalThis.document = { createElement: () => ({}) };

const audio = await import('../js/audio.js');
audio.initAudio(0.6);
const flush = () => new Promise((r) => setTimeout(r, 15));

const mkCar = (id, x, z, v, visible = true) => ({
  cfg: { id, maxSpeed: 200 }, x, z, v,
  model: { group: { visible } },
});
const listener = { x: 0, z: 0 };
const T = audio.trafficAudio;

// 1) 7 mashina: 4 yaqin, 1 uzoq (>75m), 1 ko'rinmas, 1 qo'shimcha yaqin
const cars = [
  mkCar('gentra', 10, 0, 12),
  mkCar('malibu', 20, 0, 0),         // to'xtab turgan (idle)
  mkCar('spark', 30, 0, 10),         // sintez profili (src: null)
  mkCar('e55', 40, 0, 15),
  mkCar('challenger', 50, 0, 9),     // 5-yaqin — ovoz olmasligi kerak
  mkCar('lambo', 300, 0, 20),        // uzoq
  mkCar('bmw', 5, 0, 10, false),     // ko'rinmas
];
T.update(cars, listener, 0.016, null);
await flush();
T.update(cars, listener, 0.016, null);
const owned = T.voices.filter((v) => v.owner);
check('ko\'pi bilan 4 ta ovoz ishlatiladi', owned.length === 4, `owned=${owned.length}`);
const ownerIds = owned.map((v) => v.owner.cfg.id).sort().join(',');
check('eng yaqin 4 mashina tanlangan', ownerIds === 'e55,gentra,malibu,spark', ownerIds);
check('uzoq mashina ovoz olmagan', !owned.some((v) => v.owner.cfg.id === 'lambo'));
check('ko\'rinmas mashina ovoz olmagan', !owned.some((v) => v.owner.cfg.id === 'bmw'));
check('5-yaqin mashina (challenger) ovoz olmagan', !owned.some((v) => v.owner.cfg.id === 'challenger'));

// 2) Manbalar yaratilgan va playbackRate o'rnatilgan
const withSrc = owned.filter((v) => v.source);
check('barcha 4 ovozda audio manba bor', withSrc.length === 4, `withSrc=${withSrc.length}`);

// 3) Spark (src: null) jim qolmasligi kerak — zaxira yozuv yuklangan
const sparkVoice = owned.find((v) => v.owner.cfg.id === 'spark');
check('Spark ovozi zaxira (gentra) yozuvi bilan ishlaydi', !!sparkVoice?.source);
check('zaxira yozuv so\'ralgan', fetched.some((u) => u.endsWith('audio/engines/gentra_i4.mp3')));

// 4) To'xtab turgan mashina ohangi harakatdagidan past
const idleV = owned.find((v) => v.owner.cfg.id === 'malibu');
const movingV = owned.find((v) => v.owner.cfg.id === 'e55');
for (let i = 0; i < 40; i++) T.update(cars, listener, 0.016, null);
const idleRate = idleV.source.playbackRate.target;
const movingRate = movingV.source.playbackRate.target;
check('idle ohang (playbackRate) harakatdagidan past', idleRate < movingRate, `idle=${idleRate.toFixed(3)} moving=${movingRate.toFixed(3)}`);
check('playbackRate oqilona oralig\'da (0.45..2.25)', [idleRate, movingRate].every((r) => r >= 0.45 && r <= 2.25));

// 5) Ovoz balandligi masofa bilan kamayadi
const nearGain = owned.find((v) => v.owner.cfg.id === 'gentra').gain.gain.target;
const farGain = owned.find((v) => v.owner.cfg.id === 'e55').gain.gain.target;
check('uzoqroq mashina sekinroq eshitiladi', farGain < nearGain, `near=${nearGain.toFixed(4)} far=${farGain.toFixed(4)}`);
check('ovoz balandligi 0.2 dan oshmaydi', nearGain <= 0.2 && farGain <= 0.2);

// 6) Mashina uzoqlashganda ovoz bo'shatiladi
cars[0].x = 500;
T.update(cars, listener, 0.016, null);
const stillGentra = T.voices.some((v) => v.owner && v.owner.cfg.id === 'gentra');
check('uzoqlashgan mashina ovozi bo\'shatildi', !stillGentra);
check('bo\'shagan ovoz 5-yaqin mashinaga berildi', T.voices.some((v) => v.owner && v.owner.cfg.id === 'challenger'));

// 7) EV to'xtab turganda jim
cars.push(mkCar('yangwang_u9', 2, 0, 0));
T.update(cars, listener, 0.016, null);
await flush();
for (let i = 0; i < 10; i++) T.update(cars, listener, 0.016, null);
const evVoice = T.voices.find((v) => v.owner && v.owner.cfg.id === 'yangwang_u9');
if (evVoice) check('EV to\'xtab turganda jim (gain=0)', evVoice.gain.gain.target === 0, `gain=${evVoice.gain.gain.target}`);
else check('EV mashina ovoz oldi', false, 'EV voice topilmadi');

// 8) update(null) hammasini bo'shatadi (klub ichida)
T.update(null);
check('update(null) barcha ovozlarni bo\'shatadi', T.voices.every((v) => !v.owner));

// 9) disposeAll
T.disposeAll();
check('disposeAll ovozlarni tozalaydi', T.voices.length === 0);

console.log(failures === 0 ? '\nALL TRAFFIC AUDIO TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
