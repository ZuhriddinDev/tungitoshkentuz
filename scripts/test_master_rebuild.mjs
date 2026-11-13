import assert from 'node:assert/strict';
import net from 'node:net';
import crypto from 'node:crypto';
import { CARS, carById } from '../js/config.js';
import { TASHKENT_DISTRICTS_OSM, districtAt } from '../js/world/tashkentOsmData.js';
import { SPAWN, POIS, onRoad, addCollider, queryColliders } from '../js/world/layout.js';
import { Vehicle } from '../js/physics.js';

const BASE_HTTP = 'http://127.0.0.1:5173';

function testDistrictsAndWorld() {
  assert.equal(TASHKENT_DISTRICTS_OSM.length, 6, 'Must have 6 Tashkent OSM districts');
  const names = TASHKENT_DISTRICTS_OSM.map((d) => d.id);
  for (const req of ['yakkasaroy', 'chilonzor', 'mirzo_ulugbek', 'mirobod', 'yunusobod', 'shayxontohur']) {
    assert.ok(names.includes(req), `Missing district: ${req}`);
  }
  for (const d of TASHKENT_DISTRICTS_OSM) {
    const found = districtAt(d.cx, d.cz);
    assert.ok(found, `districtAt(${d.cx}, ${d.cz}) should return a district`);
  }
  assert.ok(onRoad(SPAWN.x, SPAWN.z), 'SPAWN must be on a drivable road');
  const gasStations = POIS.filter((p) => p.type === 'gas');
  assert.ok(gasStations.length >= 4, 'At least 4 gas stations should exist');

  addCollider(10, 10, 20, 20, 'test_building');
  const hits = queryColliders(15, 15, 2);
  assert.ok(hits.size > 0, 'Spatial collider grid query must return collider');
  console.log('[PASS] World & 6 Tashkent OSM Districts verified');
}

function testVehiclePhysics() {
  const malibu = carById('malibu');
  const inst = { id: 'malibu', fuelL: malibu.tank, fuelType: malibu.fuel, engine: 0, turbo: 0, accelTune: 0, brakeTune: 0, handlingTune: 0 };
  const v = new Vehicle(malibu, inst);
  v.place(SPAWN.x, SPAWN.z, SPAWN.heading);
  assert.equal(v.drive, 'FWD');

  // Accelerate for 3 seconds (180 frames @ 60Hz)
  for (let i = 0; i < 180; i++) {
    v.step(1 / 60, { throttle: 1, reverse: 0, steer: 0, boost: false, handbrake: false, drift: false }, [], 1.0);
  }
  assert.ok(v.kmh > 70, `Malibu should accelerate past 70 km/h in 3s, got ${v.kmh.toFixed(1)}`);
  assert.ok(inst.fuelL < malibu.tank, 'Fuel must be consumed when driving');
  assert.ok(v.wheelSusp.some((s) => Math.abs(s) > 0.0001), '4-wheel suspension travel must respond to acceleration');

  // Cornering + Wet grip test
  const vDry = new Vehicle(carById('bmw'), { id: 'bmw', fuelL: 68, fuelType: 'AI-100' });
  vDry.place(SPAWN.x, SPAWN.z, 0);
  vDry.v = 25;
  vDry.step(1 / 60, { throttle: 0.5, reverse: 0, steer: 0.8, boost: false, handbrake: false, drift: false }, [], 1.0);

  const vWet = new Vehicle(carById('bmw'), { id: 'bmw', fuelL: 68, fuelType: 'AI-100' });
  vWet.place(SPAWN.x, SPAWN.z, 0);
  vWet.v = 25;
  vWet.step(1 / 60, { throttle: 0.5, reverse: 0, steer: 0.8, boost: false, handbrake: false, drift: false }, [], 0.84);
  assert.ok(Math.abs(vWet.yawRate) <= Math.abs(vDry.yawRate) + 1e-6, 'Wet grip should reduce lateral cornering yaw limit');

  // Manual gear shifting (at 25 m/s = 90 km/h, auto gear is 3 -> shiftUp gives 4 -> shiftDown gives 3)
  const preGear = vDry.gear;
  vDry.shiftUp();
  assert.equal(vDry.manualMode, true);
  assert.equal(vDry.gear, Math.min(6, preGear + 1));
  vDry.shiftDown();
  assert.equal(vDry.gear, preGear);

  // Braking
  for (let i = 0; i < 180; i++) {
    v.step(1 / 60, { throttle: 0, reverse: 1, steer: 0, boost: false, handbrake: true, drift: false }, [], 1.0);
  }
  assert.ok(v.kmh < 5, `Braking should stop vehicle, got ${v.kmh.toFixed(1)} km/h`);
  console.log('[PASS] 4-Wheel Vehicle Physics, Wet Grip & Manual Shifting verified');
}

async function testHttpApis() {
  const h = await fetch(`${BASE_HTTP}/healthz`).then((r) => r.json());
  assert.equal(h.status, 'ok');

  // PC vs Mobile Kokobango Club access check
  const pcRes = await fetch(`${BASE_HTTP}/api/club/access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
    body: JSON.stringify({ isTouch: false, maxTouchPoints: 0, width: 1920, height: 1080 }),
  }).then((r) => r.json());
  assert.equal(pcRes.allowed, true, 'PC desktop should be allowed in Kokobango Club');

  const mobRes = await fetch(`${BASE_HTTP}/api/club/access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
    body: JSON.stringify({ isTouch: true, maxTouchPoints: 5, width: 390, height: 844 }),
  }).then((r) => r.json());
  assert.equal(mobRes.allowed, false, 'Mobile iPhone must be blocked from Kokobango Club');

  // Economy & Fuel purchase
  const pid = 'TST' + Math.random().toString(36).slice(2, 5).toUpperCase();
  const econ = await fetch(`${BASE_HTTP}/api/economy/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: pid, secret: 'sec123', name: 'TestDriver' }),
  }).then((r) => r.json());
  assert.equal(econ.ok, true);

  const refuel = await fetch(`${BASE_HTTP}/api/economy/refuel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: pid, secret: 'sec123', fuelType: 'AI-95', liters: 20 }),
  }).then((r) => r.json());
  assert.equal(refuel.ok, true);
  assert.equal(refuel.cost, 20 * 12_800);
  console.log('[PASS] Server HTTP APIs (Health, Club PC-Only, Economy, Refuel) verified');
}

function connectWsClient(pid, x, z) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: 5173 });
    const key = crypto.randomBytes(16).toString('base64');
    let upgraded = false;
    let buf = Buffer.alloc(0);
    const pending = new Map();
    let seqId = 1;

    const sendFrame = (obj) => {
      const payload = Buffer.from(JSON.stringify(obj), 'utf8');
      const mask = crypto.randomBytes(4);
      const len = payload.length;
      let header;
      if (len < 126) {
        header = Buffer.alloc(6);
        header[0] = 0x81;
        header[1] = 0x80 | len;
        mask.copy(header, 2);
      } else {
        header = Buffer.alloc(8);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(len, 2);
        mask.copy(header, 4);
      }
      const masked = Buffer.from(payload);
      for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i & 3];
      socket.write(Buffer.concat([header, masked]));
    };

    const req = (obj) => new Promise((resReq, rejReq) => {
      const reqId = `r${seqId++}`;
      const t0 = performance.now();
      const timer = setTimeout(() => { pending.delete(reqId); rejReq(new Error('WS timeout')); }, 4000);
      pending.set(reqId, { res: (d) => { clearTimeout(timer); resReq({ data: d, rtt: performance.now() - t0 }); } });
      sendFrame({ ...obj, reqId });
    });

    socket.on('connect', () => {
      socket.write(
        'GET /ws HTTP/1.1\r\n' +
        'Host: 127.0.0.1:5173\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Key: ${key}\r\n` +
        'Sec-WebSocket-Version: 13\r\n\r\n'
      );
    });

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!upgraded) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;
        upgraded = true;
        buf = buf.subarray(idx + 4);
        resolve({
          pid,
          sync: (nx = x, nz = z) => req({ t: 'sync', id: pid, room: 'PUBLIC', state: { name: `Bot_${pid}`, car: 'malibu', x: nx, y: 0, z: nz, h: 0, v: 20 } }),
          close: () => {
            try {
              const mask = crypto.randomBytes(4);
              socket.write(Buffer.concat([Buffer.from([0x88, 0x80]), mask]));
            } catch {}
            socket.end();
          },
        });
      }
      while (buf.length >= 2) {
        const op = buf[0] & 0x0f;
        let len = buf[1] & 0x7f;
        let off = 2;
        if (len === 126) {
          if (buf.length < 4) return;
          len = buf.readUInt16BE(2);
          off = 4;
        }
        if (buf.length < off + len) return;
        const payload = buf.subarray(off, off + len);
        buf = buf.subarray(off + len);
        if (op === 0x1) {
          try {
            const msg = JSON.parse(payload.toString('utf8'));
            if (msg.reqId && pending.has(msg.reqId)) {
              const p = pending.get(msg.reqId);
              pending.delete(msg.reqId);
              p.res(msg);
            }
          } catch {}
        }
      }
    });
    socket.on('error', reject);
  });
}

async function runWsLoadStage(count) {
  const clients = [];
  for (let i = 0; i < count; i++) {
    const pid = `B${String(count).padStart(2, '0')}${String(i).padStart(3, '0')}`;
    clients.push(await connectWsClient(pid, (i % 10) * 15, Math.floor(i / 10) * 15));
  }
  const rtts = [];
  let maxSeq = 0;
  for (let tick = 0; tick < 3; tick++) {
    const resList = await Promise.all(clients.map((c, idx) => c.sync(idx * 15 + tick * 2, 0)));
    for (const r of resList) {
      assert.equal(r.data.ok, true);
      assert.ok(r.data.seq > 0, 'Snapshot seq must be positive');
      assert.ok(r.data.serverTs > 0, 'Snapshot serverTs must be present');
      maxSeq = Math.max(maxSeq, r.data.seq);
      rtts.push(r.rtt);
    }
  }
  const health = await fetch(`${BASE_HTTP}/healthz`).then((r) => r.json());
  const avgRtt = rtts.reduce((a, b) => a + b, 0) / rtts.length;
  const maxRtt = Math.max(...rtts);

  for (const c of clients) c.close();
  await new Promise((r) => setTimeout(r, 150));

  const after = await fetch(`${BASE_HTTP}/api/online/stats`).then((r) => r.json());
  assert.equal(after.totalOnline, 0, `Ghost players remained after ${count}-player disconnect: ${after.totalOnline}`);
  console.log(`[PASS] WS Load Stage ${count} players | avgRTT=${avgRtt.toFixed(2)}ms | maxRTT=${maxRtt.toFixed(2)}ms | RSS=${health.memory.rssMB}MB | Heap=${health.memory.heapUsedMB}MB | Ghosts=0`);
}

async function main() {
  testDistrictsAndWorld();
  testVehiclePhysics();
  await testHttpApis();
  for (const n of [5, 10, 20, 30, 50]) {
    await runWsLoadStage(n);
  }
  console.log('\nALL MASTER REBUILD AUTOMATED TESTS PASSED!');
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
