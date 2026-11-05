import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const PORT = process.env.PORT || 5173;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
};

// ============================================================================
// Multiplayer Xona va Real-Vaqt Server Tizimi (WebSocket + HTTP API)
// Render Free Tier (bitta instance) uchun optimallashtirilgan;
// Keyinchalik Redis / Render Key Value adapter ulash uchun tayyor arxitektura.
// ============================================================================
const PUBLIC_MAX_PLAYERS = 30;
const PRIVATE_MAX_PLAYERS = 12;
const MAX_ROOMS_LIMIT = 200;
const PLAYER_TTL_MS = 22_000;
const EMPTY_ROOM_TTL_MS = 120_000; // Bo'sh xonalar 2 daqiqadan keyin o'chiriladi
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// rooms: Map<roomId, { id, code, type: 'public'|'private', name, hostId, maxPlayers, players: Map<playerId, state>, events: Array, createdAt, emptySince }>
const rooms = new Map();
// codeToRoomId: Map<code, roomId>
const codeToRoomId = new Map();
// playerRoom: Map<playerId, roomId>
const playerRoom = new Map();
// wsClients: Map<playerId, Set<Socket>>
const wsClients = new Map();

function ensurePublicRoom(index = 1) {
  const id = index === 1 ? 'PUBLIC' : `PUBLIC_${index}`;
  if (!rooms.has(id)) {
    rooms.set(id, {
      id,
      code: id,
      type: 'public',
      name: index === 1 ? 'Ommaviy Toshkent #1' : `Ommaviy Toshkent #${index}`,
      hostId: 'SERVER',
      maxPlayers: PUBLIC_MAX_PLAYERS,
      players: new Map(),
      events: [],
      createdAt: Date.now(),
      emptySince: null,
    });
    codeToRoomId.set(id, id);
  }
  return rooms.get(id);
}
ensurePublicRoom(1);

function generateUniqueRoomCode() {
  for (let tries = 0; tries < 100; tries++) {
    const bytes = crypto.randomBytes(6);
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    }
    if (!codeToRoomId.has(code) && !rooms.has(code)) {
      return code;
    }
  }
  return 'RM' + Date.now().toString(36).toUpperCase().slice(-4);
}

function sanitizeId(raw) {
  return String(raw || '').toUpperCase().replace(/^TT-/, '').replace(/[^A-Z0-9_]/g, '').slice(0, 16);
}

function clampNum(v, min, max, def = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function sanitizePlayerState(id, raw = {}, prev = null) {
  const now = Date.now();
  const chat = raw.chat ? String(raw.chat).slice(0, 64) : (prev && now - (prev.chatTs || 0) < 8000 ? prev.chat : '');
  const chatTs = raw.chat ? Number(raw.chatTs) || now : (prev?.chatTs || 0);
  const validAnims = new Set(['idle', 'walk', 'run', 'jump', 'fall', 'enterCar', 'exitCar', 'wave', 'dance']);
  const animState = validAnims.has(raw.animState) ? raw.animState : (raw.onFoot ? 'idle' : 'driving');

  return {
    id,
    name: String(raw.name || prev?.name || 'Haydovchi').trim().slice(0, 18) || 'Haydovchi',
    car: String(raw.car || prev?.car || 'gentra').slice(0, 16),
    color: String(raw.color || prev?.color || '#f5f5f5').slice(0, 16),
    rims: String(raw.rims || prev?.rims || 'std').slice(0, 12),
    spoiler: String(raw.spoiler || prev?.spoiler || 'none').slice(0, 12),
    neon: String(raw.neon || prev?.neon || 'none').slice(0, 16),
    x: clampNum(raw.x, -2500, 2500, prev?.x || 0),
    y: clampNum(raw.y, -10, 200, prev?.y || 0),
    z: clampNum(raw.z, -2500, 2500, prev?.z || 0),
    h: clampNum(raw.h, -Math.PI * 4, Math.PI * 4, prev?.h || 0),
    v: clampNum(raw.v, -40, 140, 0),
    steer: clampNum(raw.steer, -1.2, 1.2, 0),
    yawRate: clampNum(raw.yawRate, -10, 10, 0),
    braking: !!raw.braking,
    lights: raw.lights !== undefined ? !!raw.lights : true,
    drifting: !!raw.drifting,
    onFoot: !!raw.onFoot,
    animState,
    px: clampNum(raw.px, -2500, 2500, raw.x || 0),
    py: clampNum(raw.py, -5, 100, 0),
    pz: clampNum(raw.pz, -2500, 2500, raw.z || 0),
    ph: clampNum(raw.ph, -Math.PI * 4, Math.PI * 4, raw.h || 0),
    pv: clampNum(raw.pv, -20, 25, 0),
    emote: String(raw.emote || '').slice(0, 12),
    ridingWith: sanitizeId(raw.ridingWith || ''),
    km: clampNum(raw.km, 0, 1_000_000, prev?.km || 0),
    chat,
    chatTs,
    updatedAt: now,
  };
}

function getServerStats() {
  let totalOnline = 0;
  let publicPlayers = 0;
  let publicMax = PUBLIC_MAX_PLAYERS;
  let privateRooms = 0;
  const roomList = [];

  for (const r of rooms.values()) {
    const count = r.players.size;
    totalOnline += count;
    if (r.type === 'public') {
      publicPlayers += count;
    } else if (r.type === 'private') {
      privateRooms++;
    }
    if (count > 0 || r.type === 'public') {
      roomList.push({
        id: r.id,
        code: r.code,
        type: r.type,
        name: r.name,
        count,
        max: r.maxPlayers,
      });
    }
  }

  return {
    ok: true,
    status: 'online',
    totalOnline,
    publicPlayers,
    publicMax,
    privateRooms,
    rooms: roomList.slice(0, 20),
    serverTime: Date.now(),
  };
}

function cleanRoomsAndPlayers() {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    for (const [pid, p] of room.players.entries()) {
      if (now - p.updatedAt > PLAYER_TTL_MS) {
        room.players.delete(pid);
        if (playerRoom.get(pid) === roomId) playerRoom.delete(pid);
        broadcastToRoom(room, {
          type: 'player_left',
          playerId: pid,
          name: p.name,
        });
      }
    }
    if (room.players.size === 0) {
      if (!room.emptySince) room.emptySince = now;
      // Bo'sh private xonalarni 2 daqiqadan keyin o'chiramiz
      if (room.type === 'private' && now - room.emptySince >= EMPTY_ROOM_TTL_MS) {
        codeToRoomId.delete(room.code);
        rooms.delete(roomId);
      } else if (room.type === 'public' && roomId !== 'PUBLIC' && now - room.emptySince >= EMPTY_ROOM_TTL_MS) {
        codeToRoomId.delete(room.code);
        rooms.delete(roomId);
      }
    } else {
      room.emptySince = null;
    }
  }
}
setInterval(cleanRoomsAndPlayers, 3000).unref?.();

function removePlayerFromCurrentRoom(pid) {
  const prevRoomId = playerRoom.get(pid);
  if (!prevRoomId) return;
  const prevRoom = rooms.get(prevRoomId);
  if (prevRoom) {
    const p = prevRoom.players.get(pid);
    prevRoom.players.delete(pid);
    if (prevRoom.players.size === 0) prevRoom.emptySince = Date.now();
    if (p) {
      broadcastToRoom(prevRoom, {
        type: 'player_left',
        playerId: pid,
        name: p.name,
      });
    }
  }
  playerRoom.delete(pid);
}

function findAvailablePublicRoom(pid) {
  const curId = playerRoom.get(pid);
  if (curId && rooms.get(curId)?.type === 'public') {
    return rooms.get(curId);
  }
  for (let idx = 1; idx <= 20; idx++) {
    const r = ensurePublicRoom(idx);
    if (r.players.has(pid) || r.players.size < r.maxPlayers) {
      return r;
    }
  }
  return ensurePublicRoom(1);
}

function createPrivateRoom(hostId, customMax) {
  cleanRoomsAndPlayers();
  if (rooms.size >= MAX_ROOMS_LIMIT) {
    return { error: 'Serverda xonalar limiti to\'lgan, birozdan so\'ng urinib ko\'ring' };
  }
  const code = generateUniqueRoomCode();
  const roomId = `PRIV_${code}`;
  const maxPlayers = clampNum(customMax, 2, 20, PRIVATE_MAX_PLAYERS);
  const room = {
    id: roomId,
    code,
    type: 'private',
    name: `Do'stlar xonasi (${code})`,
    hostId,
    maxPlayers,
    players: new Map(),
    events: [],
    createdAt: Date.now(),
    emptySince: null,
  };
  rooms.set(roomId, room);
  codeToRoomId.set(code, roomId);
  return { room };
}

function resolveTargetRoom(pid, requestedCodeOrType, createIfMissing = false) {
  const raw = sanitizeId(requestedCodeOrType || 'PUBLIC');
  if (!raw || raw === 'PUBLIC' || raw === 'LOBBY' || raw === 'OMMAVIY') {
    return { room: findAvailablePublicRoom(pid) };
  }

  // Maxsus xona kodi bo'yicha qidirish
  const mappedId = codeToRoomId.get(raw) || (rooms.has(raw) ? raw : null);
  if (mappedId && rooms.has(mappedId)) {
    return { room: rooms.get(mappedId) };
  }

  // Agar do'stning playerId si kiritilgan bo'lsa va u biror xonada bo'lsa
  if (playerRoom.has(raw)) {
    const friendRoomId = playerRoom.get(raw);
    if (rooms.has(friendRoomId)) {
      return { room: rooms.get(friendRoomId) };
    }
  }

  if (createIfMissing && raw.length === 6) {
    const roomId = `PRIV_${raw}`;
    const room = {
      id: roomId,
      code: raw,
      type: 'private',
      name: `Do'stlar xonasi (${raw})`,
      hostId: pid,
      maxPlayers: PRIVATE_MAX_PLAYERS,
      players: new Map(),
      events: [],
      createdAt: Date.now(),
      emptySince: null,
    };
    rooms.set(roomId, room);
    codeToRoomId.set(raw, roomId);
    return { room };
  }

  return { error: `«${raw}» kodli xona topilmadi!` };
}

function syncPlayerInRoom(pid, targetRoom, rawState = {}, rawEvent = null) {
  if (!targetRoom.players.has(pid) && targetRoom.players.size >= targetRoom.maxPlayers) {
    return { error: `Xona to'lgan (${targetRoom.maxPlayers}/${targetRoom.maxPlayers})` };
  }

  const prevRoomId = playerRoom.get(pid);
  if (prevRoomId && prevRoomId !== targetRoom.id) {
    removePlayerFromCurrentRoom(pid);
  }

  const isNew = !targetRoom.players.has(pid);
  const prevState = targetRoom.players.get(pid);
  const nextState = sanitizePlayerState(pid, rawState, prevState);

  targetRoom.players.set(pid, nextState);
  targetRoom.emptySince = null;
  playerRoom.set(pid, targetRoom.id);

  if (isNew) {
    broadcastToRoom(targetRoom, {
      type: 'player_joined',
      playerId: pid,
      name: nextState.name,
    }, pid);
  }

  // Chat yoki poyga voqealarini xona jurnaliga yozish
  if (rawState.chat && nextState.chatTs && nextState.chatTs !== prevState?.chatTs) {
    const ev = {
      eid: `${pid}_${nextState.chatTs}`,
      type: 'chat',
      fromId: pid,
      fromName: nextState.name,
      text: nextState.chat,
      ts: Date.now(),
    };
    targetRoom.events.push(ev);
    if (targetRoom.events.length > 25) targetRoom.events.shift();
    broadcastToRoom(targetRoom, { type: 'event', event: ev }, pid);
  }

  if (rawEvent && rawEvent.type) {
    const ev = {
      eid: `${pid}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: String(rawEvent.type).slice(0, 16),
      fromId: pid,
      fromName: nextState.name,
      text: String(rawEvent.text || '').slice(0, 80),
      target: rawEvent.target || null,
      ts: Date.now(),
    };
    targetRoom.events.push(ev);
    if (targetRoom.events.length > 25) targetRoom.events.shift();
    broadcastToRoom(targetRoom, { type: 'event', event: ev }, pid);
  }

  const players = [];
  for (const [otherId, p] of targetRoom.players.entries()) {
    if (otherId !== pid) {
      players.push({
        ...p,
        chat: Date.now() - (p.chatTs || 0) < 8000 ? p.chat : '',
      });
    }
  }

  const recentEvents = targetRoom.events.filter((e) => Date.now() - e.ts < 15000);
  const stats = getServerStats();

  return {
    ok: true,
    room: targetRoom.code,
    roomId: targetRoom.id,
    roomType: targetRoom.type,
    roomName: targetRoom.name,
    count: targetRoom.players.size,
    max: targetRoom.maxPlayers,
    players,
    events: recentEvents,
    stats: {
      totalOnline: stats.totalOnline,
      publicPlayers: stats.publicPlayers,
      publicMax: stats.publicMax,
      privateRooms: stats.privateRooms,
    },
  };
}

// ============================================================================
// RFC 6455 Native WebSocket Server (hech qanday tashqi npm paketsiz!)
// ============================================================================
function encodeWsFrame(obj) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text frame
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function sendWs(socket, obj) {
  if (!socket || socket.destroyed || !socket.writable) return;
  try {
    socket.write(encodeWsFrame(obj));
  } catch { /* */ }
}

function broadcastToRoom(room, msgObj, excludePid = null) {
  if (!room) return;
  const frame = encodeWsFrame(msgObj);
  for (const pid of room.players.keys()) {
    if (pid === excludePid) continue;
    const sockets = wsClients.get(pid);
    if (!sockets) continue;
    for (const s of sockets) {
      if (!s.destroyed && s.writable) {
        try { s.write(frame); } catch { /* */ }
      }
    }
  }
}

function setupWebSocket(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  socket.setNoDelay(true);

  let boundPid = null;
  let buffer = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const firstByte = buffer[0];
      const opcode = firstByte & 0x0f;
      const secondByte = buffer[1];
      const isMasked = (secondByte & 0x80) !== 0;
      let payloadLen = secondByte & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (buffer.length < 4) return;
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buffer.length < 10) return;
        payloadLen = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }

      const maskLen = isMasked ? 4 : 0;
      if (buffer.length < offset + maskLen + payloadLen) return;
      if (payloadLen > 65536) {
        socket.destroy();
        return;
      }

      const mask = isMasked ? buffer.subarray(offset, offset + 4) : null;
      offset += maskLen;
      const data = buffer.subarray(offset, offset + payloadLen);
      buffer = buffer.subarray(offset + payloadLen);

      if (opcode === 0x8) {
        // Close frame
        socket.end();
        return;
      }
      if (opcode === 0x9) {
        // Ping frame -> Pong
        const pong = Buffer.from([0x8a, 0x00]);
        try { socket.write(pong); } catch { /* */ }
        continue;
      }
      if (opcode !== 0x1) continue;

      if (mask) {
        for (let i = 0; i < data.length; i++) {
          data[i] ^= mask[i & 3];
        }
      }

      try {
        const msg = JSON.parse(data.toString('utf8'));
        handleWsMessage(socket, msg, (pid) => {
          if (pid && pid !== boundPid) {
            boundPid = pid;
            let set = wsClients.get(pid);
            if (!set) wsClients.set(pid, (set = new Set()));
            set.add(socket);
          }
        });
      } catch { /* Noto'g'ri JSON */ }
    }
  });

  const cleanup = () => {
    if (boundPid && wsClients.has(boundPid)) {
      const set = wsClients.get(boundPid);
      set.delete(socket);
      if (set.size === 0) wsClients.delete(boundPid);
    }
  };
  socket.on('close', cleanup);
  socket.on('error', cleanup);
}

function handleWsMessage(socket, msg, bindPid) {
  if (!msg || typeof msg !== 'object') return;

  if (msg.t === 'ping') {
    sendWs(socket, { t: 'pong', clientTs: msg.clientTs, stats: getServerStats() });
    return;
  }

  const pid = sanitizeId(msg.id);
  if (!pid) return;
  bindPid(pid);

  if (msg.t === 'create_room') {
    const res = createPrivateRoom(pid, msg.maxPlayers);
    if (res.error) {
      sendWs(socket, { t: 'error', error: res.error });
      return;
    }
    const syncRes = syncPlayerInRoom(pid, res.room, msg.state || {});
    sendWs(socket, { t: 'room_created', ...syncRes });
    return;
  }

  if (msg.t === 'join_room') {
    const resolved = resolveTargetRoom(pid, msg.room, false);
    if (resolved.error) {
      sendWs(socket, { t: 'error', error: resolved.error });
      return;
    }
    const syncRes = syncPlayerInRoom(pid, resolved.room, msg.state || {});
    if (syncRes.error) {
      sendWs(socket, { t: 'error', error: syncRes.error });
      return;
    }
    sendWs(socket, { t: 'room_joined', ...syncRes });
    return;
  }

  if (msg.t === 'leave_room') {
    removePlayerFromCurrentRoom(pid);
    const pubRoom = findAvailablePublicRoom(pid);
    const syncRes = syncPlayerInRoom(pid, pubRoom, msg.state || {});
    sendWs(socket, { t: 'room_joined', ...syncRes });
    return;
  }

  if (msg.t === 'sync') {
    const curRoomId = playerRoom.get(pid);
    let targetRoom = curRoomId ? rooms.get(curRoomId) : null;
    if (!targetRoom || (msg.room && sanitizeId(msg.room) !== targetRoom.code && sanitizeId(msg.room) !== targetRoom.id)) {
      const resolved = resolveTargetRoom(pid, msg.room || 'PUBLIC', true);
      targetRoom = resolved.room || findAvailablePublicRoom(pid);
    }
    const syncRes = syncPlayerInRoom(pid, targetRoom, msg.state || {}, msg.event || null);
    sendWs(socket, { t: 'state', ...syncRes });
  }
}

// ============================================================================
// HTTP REST Endpoints (/api/online/*)
// ============================================================================
function sendJson(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      if (raw.length < 32768) raw += chunk;
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

async function handleApi(req, res, urlPath) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (urlPath === '/api/online/ping' || urlPath === '/api/online/stats') {
    cleanRoomsAndPlayers();
    sendJson(res, 200, { ...getServerStats(), max: PUBLIC_MAX_PLAYERS, privateMax: PRIVATE_MAX_PLAYERS });
    return;
  }

  if (urlPath === '/api/online/create-room' && req.method === 'POST') {
    const body = await parseBody(req);
    const id = sanitizeId(body.id);
    if (!id) return sendJson(res, 400, { error: 'Player ID kerak' });
    const created = createPrivateRoom(id, body.maxPlayers);
    if (created.error) return sendJson(res, 429, { error: created.error });
    const syncRes = syncPlayerInRoom(id, created.room, body.state || {});
    sendJson(res, 200, syncRes);
    return;
  }

  if (urlPath === '/api/online/join-room' && req.method === 'POST') {
    cleanRoomsAndPlayers();
    const body = await parseBody(req);
    const id = sanitizeId(body.id);
    if (!id) return sendJson(res, 400, { error: 'Player ID kerak' });
    const resolved = resolveTargetRoom(id, body.room, false);
    if (resolved.error) return sendJson(res, 404, { error: resolved.error });
    const syncRes = syncPlayerInRoom(id, resolved.room, body.state || {});
    if (syncRes.error) return sendJson(res, 409, { error: syncRes.error });
    sendJson(res, 200, syncRes);
    return;
  }

  if (urlPath === '/api/online/sync' && req.method === 'POST') {
    cleanRoomsAndPlayers();
    const body = await parseBody(req);
    const id = sanitizeId(body.id);
    if (!id) return sendJson(res, 400, { error: 'ID kerak' });

    const curRoomId = playerRoom.get(id);
    let targetRoom = curRoomId ? rooms.get(curRoomId) : null;
    const reqRoom = sanitizeId(body.room || '');
    if (!targetRoom || (reqRoom && reqRoom !== targetRoom.code && reqRoom !== targetRoom.id)) {
      const resolved = resolveTargetRoom(id, reqRoom || 'PUBLIC', true);
      if (resolved.error) return sendJson(res, 404, { error: resolved.error });
      targetRoom = resolved.room;
    }

    const syncRes = syncPlayerInRoom(id, targetRoom, body.state || {}, body.event || null);
    if (syncRes.error) return sendJson(res, 409, { error: syncRes.error });
    sendJson(res, 200, syncRes);
    return;
  }

  if (urlPath === '/api/online/leave' && req.method === 'POST') {
    const body = await parseBody(req);
    const id = sanitizeId(body.id);
    if (id) removePlayerFromCurrentRoom(id);
    sendJson(res, 200, { ok: true, ...getServerStats() });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath.startsWith('/api/online/')) {
      handleApi(req, res, urlPath);
      return;
    }

    const safeRel = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
    let filePath = path.join(ROOT, safeRel === '/' || safeRel === '\\' ? 'index.html' : safeRel);

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      if (stats.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      const headers = {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      };

      if (ext === '.glb' || ext === '.png' || ext === '.jpg' || ext === '.webp') {
        headers['Cache-Control'] = 'public, max-age=86400';
        headers['Content-Length'] = stats.size;
      } else {
        headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      }

      res.writeHead(200, headers);
      const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
      stream.on('error', () => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      stream.pipe(res);
    });
  } catch (e) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.on('upgrade', (req, socket) => {
  const urlPath = (req.url || '/').split('?')[0];
  if (urlPath === '/ws' || urlPath === '/api/online/ws') {
    setupWebSocket(req, socket);
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`Tungi Toshkent 3D server (HTTP + WebSocket) running at http://localhost:${PORT}`);
});
