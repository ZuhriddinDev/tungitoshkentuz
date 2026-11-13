// TUNGI TOSHKENT — Real-Vaqt Multiplayer Xona Tizimi (WebSocket + HTTP Fallback + P2P):
// 1) Ommaviy Server (Public Server — 30 o'yinchigacha har bir zalda, avto-sharding)
// 2) Do'stlar Xonasi (Private Room — unikal 6 belgili kod bilan, 12 o'yinchigacha)
// 3) Jonli Server Statistikasi (Total Online, Public, Private Rooms, Ping ms, Auto-Reconnect)
export const MAX_PLAYERS = 30;
export const PRIVATE_MAX_PLAYERS = 12;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PREFIX = 'tt3d-';
const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    {
      urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443?transport=tcp'],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

let mode = 'unknown'; // 'unknown' | 'ws' | 'server' | 'p2p'
let ws = null;
let wsReconnectTimer = 0;
let pingTimer = 0;
let peer = null;
let myId = '';
let role = 'none';    // 'none' | 'host' | 'client' | 'room'
let status = 'off';   // 'off' | 'connecting' | 'ready' | 'joining' | 'connected'
let hostConn = null;
let hostId = 'PUBLIC';
let roomType = 'public'; // 'public' | 'private'
let roomMax = MAX_PLAYERS;
let joinReject = null;
let lastHostMsg = 0;
let acc = 0;
let syncBusy = false;

const conns = new Map();   // P2P host: id -> conn
const players = new Map(); // Xonadagi boshqa o'yinchilar: id -> state
const listeners = new Set();
const seenEventIds = new Set();
const pendingWsReq = new Map(); // reqId -> { resolve, reject, timer }
let reqSeq = 1;

export const chatHistory = []; // [{ fromName, text, ts }]

// Kirish sahifasi (Premium Lobby) uchun jonli server statistikasi
export const serverStats = {
  status: 'connecting', // 'online' | 'connecting' | 'offline'
  totalOnline: 1,
  publicPlayers: 1,
  publicMax: MAX_PLAYERS,
  privateRooms: 0,
  privateMax: PRIVATE_MAX_PLAYERS,
  pingMs: 18,
};

const emit = (ev = {}) => listeners.forEach((f) => f(ev));
export const onOnline = (f) => { listeners.add(f); return () => listeners.delete(f); };

function genId() {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return [...a].map((n) => ALPHABET[n % ALPHABET.length]).join('');
}

// Har bir foydalanuvchi uchun takrorlanmas 6 belgili playerId
export function playerId() {
  let id = localStorage.getItem('tt-pid') || localStorage.getItem('tt_online_pid_v1');
  if (!id || id.length !== 6) {
    id = genId();
  }
  localStorage.setItem('tt-pid', id);
  localStorage.setItem('tt_online_pid_v1', id);
  return id;
}

export const displayId = (id = myId || playerId()) => {
  if (!id || id === 'LOBBY' || id === 'PUBLIC') return 'OMMAVIY SERVER';
  if (String(id).startsWith('PUBLIC')) {
    const suf = String(id).slice(6);
    return suf ? `OMMAVIY ZAL ${suf}` : 'OMMAVIY SERVER';
  }
  if (String(id).startsWith('LOBBY')) return 'OMMAVIY ZAL #' + String(id).slice(5);
  return String(id).startsWith('TT-') ? String(id) : 'TT-' + id;
};

export const normalizeId = (s) =>
  String(s || '')
    .trim()
    .toUpperCase()
    .replace(/^TT-/, '')
    .replace(/[^A-Z0-9_]/g, '');

export const info = () => ({
  status,
  role,
  mode,
  id: myId || playerId(),
  host: hostId,
  roomType,
  count: players.size + 1,
  max: roomMax || (roomType === 'private' ? PRIVATE_MAX_PLAYERS : MAX_PLAYERS),
  pingMs: serverStats.pingMs,
  serverStats,
});

export const list = () => [...players.values()];

let lastStatsEmitTs = 0;
function updateServerStats(raw = {}, measuredPing = null) {
  const prevTotal = serverStats.totalOnline;
  const prevPub = serverStats.publicPlayers;
  const prevPriv = serverStats.privateRooms;
  const prevStatus = serverStats.status;
  serverStats.status = 'online';
  if (typeof raw.totalOnline === 'number') serverStats.totalOnline = Math.max(1, raw.totalOnline);
  if (typeof raw.publicPlayers === 'number') serverStats.publicPlayers = Math.max(roomType === 'public' ? 1 : 0, raw.publicPlayers);
  if (typeof raw.publicMax === 'number') serverStats.publicMax = raw.publicMax;
  if (typeof raw.privateRooms === 'number') serverStats.privateRooms = raw.privateRooms;
  if (typeof raw.privateMax === 'number') serverStats.privateMax = raw.privateMax;
  if (typeof measuredPing === 'number' && measuredPing >= 0) {
    serverStats.pingMs = Math.max(1, Math.round(measuredPing));
  }
  const now = performance.now();
  const countsChanged =
    prevTotal !== serverStats.totalOnline ||
    prevPub !== serverStats.publicPlayers ||
    prevPriv !== serverStats.privateRooms ||
    prevStatus !== serverStats.status;
  if (countsChanged || now - lastStatsEmitTs > 1500) {
    lastStatsEmitTs = now;
    emit({ statsUpdated: true });
  }
}

async function fetchStatsHttp() {
  const t0 = performance.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch('/api/online/stats', { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (r.ok) {
      const data = await r.json();
      if (data && data.ok) {
        updateServerStats(data, performance.now() - t0);
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

function startPingLoop() {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ t: 'ping', ts: performance.now() }));
      } catch { /* */ }
    } else if (mode === 'server') {
      fetchStatsHttp();
    }
  }, 2500);
}

function connectWebSocket() {
  return new Promise((resolve) => {
    if (ws && ws.readyState === WebSocket.OPEN) return resolve(true);
    try {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const sock = new WebSocket(`${proto}//${location.host}/ws`);
      let settled = false;
      const to = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { sock.close(); } catch { /* */ }
          resolve(false);
        }
      }, 2800);

      sock.onopen = () => {
        clearTimeout(to);
        ws = sock;
        mode = 'ws';
        serverStats.status = 'online';
        sock.send(JSON.stringify({ t: 'ping', ts: performance.now() }));
        startPingLoop();
        if (!settled) {
          settled = true;
          resolve(true);
        }
      };

      sock.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (!m || typeof m !== 'object') return;

        if (m.reqId && pendingWsReq.has(m.reqId)) {
          const req = pendingWsReq.get(m.reqId);
          pendingWsReq.delete(m.reqId);
          clearTimeout(req.timer);
          if (m.ok === false || m.error) req.reject(new Error(m.error || 'Server xatosi'));
          else req.resolve(m);
          return;
        }

        if (m.t === 'hello' || m.t === 'pong') {
          const tsVal = typeof m.ts === 'number' ? m.ts : m.clientTs;
          const rtt = typeof tsVal === 'number' ? performance.now() - tsVal : null;
          if (m.stats) updateServerStats(m.stats, rtt);
          return;
        }

        if (m.t === 'economy_update') {
          emit({ economyUpdate: m });
          return;
        }

        if (m.type === 'event' && m.event) {
          applyList([...players.values()], [m.event]);
          return;
        }

        if (m.type === 'player_joined' && m.playerId) {
          emit({ playerJoined: m });
          return;
        }

        if (m.type === 'player_left' && m.playerId) {
          players.delete(m.playerId);
          emit({ players: [...players.values()], playerLeft: m });
          return;
        }

        if (m.t === 'sync_ack' || m.t === 'state' || m.t === 'room_joined' || m.t === 'room_created') {
          if (status !== 'connected') status = 'connected';
          role = 'room';
          if (m.room) hostId = m.room;
          if (m.roomType) roomType = m.roomType;
          if (m.maxPlayers || m.max) roomMax = m.maxPlayers || m.max;
          if (m.stats) updateServerStats(m.stats);
          applyList(m.players || [], m.events || []);
          return;
        }
      };

      sock.onclose = () => {
        if (ws === sock) ws = null;
        if (!settled) {
          settled = true;
          resolve(false);
          return;
        }
        // WebSocket uzilsa HTTP fallback ga tushadi va 3 soniyadan so'ng qayta ulanadi (Reconnect)
        if (mode === 'ws') mode = 'server';
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = setTimeout(() => {
          connectWebSocket().catch(() => {});
        }, 3000);
      };

      sock.onerror = () => {
        if (!settled) {
          clearTimeout(to);
          settled = true;
          resolve(false);
        }
      };
    } catch {
      resolve(false);
    }
  });
}

function sendWsRequest(payload, timeoutMs = 4500) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return reject(new Error('WebSocket ulanmagan'));
    }
    const reqId = 'r' + (reqSeq++);
    const timer = setTimeout(() => {
      pendingWsReq.delete(reqId);
      reject(new Error('Server javob bermadi'));
    }, timeoutMs);
    pendingWsReq.set(reqId, { resolve, reject, timer });
    ws.send(JSON.stringify({ ...payload, reqId }));
  });
}

async function detectServerMode() {
  if (mode === 'ws' && ws && ws.readyState === WebSocket.OPEN) return 'ws';
  const wsOk = await connectWebSocket();
  if (wsOk) return 'ws';

  const httpOk = await fetchStatsHttp();
  if (httpOk) {
    mode = 'server';
    startPingLoop();
    return 'server';
  }
  mode = 'p2p';
  return 'p2p';
}

function loadPeerScript() {
  if (typeof window.Peer !== 'undefined') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('PeerJS kutubxonasi yuklanmadi. Internetni tekshiring.'));
    document.head.appendChild(s);
  });
}

export async function goOnline() {
  myId = playerId();
  if (status === 'ready' || status === 'connected') return myId;

  status = 'connecting';
  serverStats.status = 'connecting';
  emit();

  const m = await detectServerMode();
  if (m === 'ws' || m === 'server') {
    role = 'room';
    hostId = hostId || 'PUBLIC';
    roomType = hostId === 'PUBLIC' || String(hostId).startsWith('PUBLIC') ? 'public' : 'private';
    roomMax = roomType === 'private' ? PRIVATE_MAX_PLAYERS : MAX_PLAYERS;
    status = 'connected';
    serverStats.status = 'online';
    emit();
    return myId;
  }

  // P2P (WebRTC) rejimi — statik xosting (Netlify) uchun
  await loadPeerScript();
  return new Promise((resolve, reject) => {
    let attempt = 0;
    let done = false;
    const start = () => {
      myId = attempt < 3 ? playerId() : genId();
      peer = new window.Peer(PREFIX + myId, { config: ICE, debug: 0 });
      peer.on('open', () => {
        done = true;
        localStorage.setItem('tt-pid', myId);
        status = 'ready';
        serverStats.status = 'online';
        emit();
        resolve(myId);
      });
      peer.on('connection', onIncoming);
      peer.on('disconnected', () => {
        try { peer.reconnect(); } catch { /* */ }
      });
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          attempt++;
          try { peer.destroy(); } catch { /* */ }
          if (attempt > 6) {
            status = 'off';
            serverStats.status = 'offline';
            emit();
            return reject(new Error("ID band, keyinroq urinib ko'ring"));
          }
          return void setTimeout(start, 1000);
        }
        if (err.type === 'peer-unavailable' && joinReject) {
          const r = joinReject;
          joinReject = null;
          status = 'ready';
          emit();
          return r(new Error("Bunday xona kodi topilmadi yoki do'st online emas"));
        }
        if (!done) {
          status = 'off';
          serverStats.status = 'offline';
          emit();
          return reject(new Error("Online serverga ulanib bo'lmadi"));
        }
        emit({ error: err.type });
      });
    };
    start();
  });
}

// ---- Yangi: Do'stlar uchun maxsus Private Xona yaratish (6 belgili unikal kod) ----
export async function createPrivateRoom() {
  await goOnline();
  const statePayload = lastLocalState || { id: myId, name: 'Haydovchi' };

  if (mode === 'ws' && ws?.readyState === WebSocket.OPEN) {
    try {
      const res = await sendWsRequest({ t: 'create_room', id: myId, state: statePayload }, 2600);
      hostId = res.room;
      roomType = 'private';
      roomMax = res.maxPlayers || res.max || PRIVATE_MAX_PLAYERS;
      role = 'room';
      status = 'connected';
      players.clear();
      if (res.stats) updateServerStats(res.stats);
      emit({ roomChanged: hostId });
      return hostId;
    } catch (wsErr) {
      // Agar xato biznes mantiqdan bo'lmasa (timeout/socket), HTTP ga avtomatik o'tamiz
      if (wsErr && wsErr.message && !wsErr.message.includes('Server javob bermadi') && !wsErr.message.includes('WebSocket')) {
        throw wsErr;
      }
      mode = 'server';
    }
  }

  if (mode === 'server' || mode === 'ws') {
    const r = await fetch('/api/online/create-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: myId, state: statePayload }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || "Xona yaratib bo'lmadi");
    hostId = data.room;
    roomType = 'private';
    roomMax = data.maxPlayers || data.max || PRIVATE_MAX_PLAYERS;
    role = 'room';
    status = 'connected';
    players.clear();
    if (data.stats) updateServerStats(data.stats);
    emit({ roomChanged: hostId });
    return hostId;
  }

  // P2P rejimda o'z ID si private xona kodi hisoblanadi
  resetRoom();
  hostId = myId;
  roomType = 'private';
  roomMax = PRIVATE_MAX_PLAYERS;
  emit({ roomChanged: hostId });
  return hostId;
}

// ---- Yangi: Ommaviy Serverga (Public Server) kirish ----
export async function joinPublicServer() {
  return joinFriend('PUBLIC');
}

// ---- Yangi: 6 belgili kod orqali Xonaga kirish ----
export async function joinRoomByCode(code) {
  return joinFriend(code);
}

// ---- P2P Host tomoni ----
function onIncoming(conn) {
  conn.on('open', () => {
    if (role === 'client' || status === 'joining') {
      conn.send({ t: 'busy' });
      setTimeout(() => conn.close(), 400);
      return;
    }
    if (conns.size >= PRIVATE_MAX_PLAYERS - 1) {
      conn.send({ t: 'full' });
      setTimeout(() => conn.close(), 400);
      return;
    }
    const id = conn.peer.slice(PREFIX.length);
    conns.set(id, conn);
    role = 'host';
    status = 'connected';
    hostId = myId;
    roomType = 'private';
    conn.send({ t: 'welcome', host: myId });
    emit();
  });
  conn.on('data', (m) => {
    if (m.t !== 's') return;
    const id = conn.peer.slice(PREFIX.length);
    const isNew = !players.has(id);
    players.set(id, { ...m.s, id, t: performance.now() });
    if (isNew) emit({ join: m.s.name });
  });
  const gone = () => dropClient(conn.peer.slice(PREFIX.length));
  conn.on('close', gone);
  conn.on('error', gone);
}

function dropClient(id) {
  if (!conns.delete(id)) return;
  const p = players.get(id);
  players.delete(id);
  if (conns.size === 0) {
    role = 'none';
    status = 'ready';
    hostId = '';
  }
  emit({ leave: p?.name || id });
}

// ---- Do'st Xonasiga (unikal kod/ID/nom) yoki Ommaviy Serverga (PUBLIC/LOBBY) qo'shilish ----
export async function joinFriend(raw) {
  const clean = normalizeId(raw);
  const isPublic = clean === 'LOBBY' || clean === 'UMUMIY' || clean === 'PUBLIC' || clean === '';
  const id = isPublic ? 'PUBLIC' : clean;

  if (!isPublic && id.length < 2) {
    throw new Error("Xona kodi yoki do'st ID sini kiriting");
  }

  await goOnline();
  const statePayload = lastLocalState || { id: myId, name: 'Haydovchi' };

  if (mode === 'ws' && ws?.readyState === WebSocket.OPEN) {
    status = 'joining';
    emit();
    try {
      const res = await sendWsRequest({ t: 'join_room', id: myId, room: id, state: statePayload }, 2600);
      role = 'room';
      status = 'connected';
      hostId = res.room || id;
      roomType = res.roomType || (isPublic ? 'public' : 'private');
      roomMax = res.maxPlayers || res.max || (roomType === 'private' ? PRIVATE_MAX_PLAYERS : MAX_PLAYERS);
      players.clear();
      if (res.stats) updateServerStats(res.stats);
      applyList(res.players || [], res.events || []);
      emit({ roomChanged: hostId });
      return hostId;
    } catch (e) {
      if (e && e.message && !e.message.includes('Server javob bermadi') && !e.message.includes('WebSocket')) {
        status = 'connected';
        emit();
        throw e;
      }
      // WS javobi kechiksa HTTP orqali ulash
      mode = 'server';
    }
  }

  if (mode === 'server' || mode === 'ws') {
    status = 'joining';
    emit();
    try {
      const r = await fetch('/api/online/join-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: myId, room: id, state: statePayload }),
      });
      const data = await r.json();
      if (!r.ok || data.error) {
        status = 'connected';
        emit();
        throw new Error(data.error || "Xonaga ulanib bo'lmadi");
      }
      role = 'room';
      status = 'connected';
      hostId = data.room || id;
      roomType = data.roomType || (isPublic ? 'public' : 'private');
      roomMax = data.maxPlayers || data.max || (roomType === 'private' ? PRIVATE_MAX_PLAYERS : MAX_PLAYERS);
      players.clear();
      if (data.stats) updateServerStats(data.stats);
      applyList(data.players || [], data.events || []);
      emit({ roomChanged: hostId });
      return hostId;
    } catch (err) {
      status = 'connected';
      emit();
      throw err;
    }
  }

  // P2P rejimi
  if (isPublic) {
    resetRoom();
    return myId;
  }
  if (id === myId) {
    throw new Error("Bu sizning o'z xona kodingiz! Uni do'stingizga yuboring.");
  }
  if (role !== 'none') {
    resetRoom();
  }
  return new Promise((resolve, reject) => {
    status = 'joining';
    emit();
    joinReject = reject;
    const conn = peer.connect(PREFIX + id, { reliable: true, serialization: 'json' });
    const fail = (msg) => {
      clearTimeout(to);
      joinReject = null;
      try { conn.close(); } catch { /* */ }
      status = role === 'none' ? 'ready' : status;
      emit();
      reject(new Error(msg));
    };
    const to = setTimeout(() => fail("Ulanib bo'lmadi (do'st online emas yoki tarmoq to'sib turibdi)"), 15000);
    conn.on('data', (m) => {
      lastHostMsg = performance.now();
      if (m.t === 'welcome') {
        clearTimeout(to);
        joinReject = null;
        hostConn = conn;
        role = 'client';
        status = 'connected';
        hostId = id;
        roomType = 'private';
        roomMax = PRIVATE_MAX_PLAYERS;
        emit({ roomChanged: hostId });
        resolve(id);
      } else if (m.t === 'full') fail(`Xona to'lgan (${PRIVATE_MAX_PLAYERS}/${PRIVATE_MAX_PLAYERS})`);
      else if (m.t === 'busy') fail("Bu o'yinchi boshqa xonaga ulangan");
      else if (m.t === 'p') applyList(m.list);
    });
    conn.on('close', () => {
      if (hostConn === conn) {
        resetRoom();
        emit({ left: 'host' });
      }
    });
    conn.on('error', () => {
      if (status === 'joining') fail('Ulanishda xatolik');
    });
  });
}

function applyList(l, events = []) {
  const now = performance.now();
  const seen = new Set();
  let changed = false;

  // Xona voqealari (chat, online poyga chaqiruvi va h.k.)
  for (const ev of events) {
    if (!ev.eid || seenEventIds.has(ev.eid)) continue;
    seenEventIds.add(ev.eid);
    if (ev.type === 'chat') {
      chatHistory.push({ fromName: ev.fromName, text: ev.text, ts: ev.ts });
      if (chatHistory.length > 30) chatHistory.shift();
      if (ev.fromId !== (myId || playerId())) {
        emit({ chat: { name: ev.fromName || 'Haydovchi', text: ev.text } });
      } else {
        emit({ chatUpdated: true });
      }
    } else if (ev.type === 'race') {
      emit({ raceEvent: ev });
    } else if (ev.type === 'deposit_race') {
      emit({ depositRace: ev });
    } else if (ev.type === 'car_hit') {
      if (ev.toId === (myId || playerId())) {
        emit({ carHit: ev });
      }
    }
  }

  for (const p of l) {
    if (!p || !p.id || p.id === (myId || playerId())) continue;
    seen.add(p.id);
    const prev = players.get(p.id);
    if (!prev) {
      changed = true;
      emit({ join: p.name });
    } else {
      if (mode === 'p2p' && p.chat && p.chatTs && p.chatTs !== prev.chatTs) {
        chatHistory.push({ fromName: p.name || 'Haydovchi', text: p.chat, ts: Date.now() });
        if (chatHistory.length > 30) chatHistory.shift();
        emit({ chat: { name: p.name || 'Haydovchi', text: p.chat } });
      }
      if (p.ridingWith && p.ridingWith !== prev.ridingWith && p.ridingWith === (myId || playerId())) {
        emit({ passengerJoin: p.name || 'Haydovchi' });
      }
    }
    players.set(p.id, { ...p, t: now, missingCount: 0 });
  }
  for (const [id, p] of players) {
    if (!seen.has(id)) {
      p.missingCount = (p.missingCount || 0) + 1;
      if (p.missingCount > 8 && now - p.t > 4500) {
        players.delete(id);
        changed = true;
        emit({ leave: p.name });
      }
    }
  }
  if (changed) emit();
}

function resetRoom() {
  conns.forEach((c) => {
    try { c.close(); } catch { /* */ }
  });
  conns.clear();
  try { hostConn?.close(); } catch { /* */ }
  hostConn = null;
  players.clear();
  if (mode === 'ws' && ws?.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify({ t: 'leave', id: myId })); } catch { /* */ }
    role = 'room';
    hostId = 'PUBLIC';
    roomType = 'public';
    roomMax = MAX_PLAYERS;
    status = 'connected';
  } else if (mode === 'server') {
    fetch('/api/online/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: myId }),
    }).catch(() => {});
    role = 'room';
    hostId = 'PUBLIC';
    roomType = 'public';
    roomMax = MAX_PLAYERS;
    status = 'connected';
  } else {
    role = 'none';
    hostId = '';
    roomType = 'public';
    status = peer && !peer.destroyed ? 'ready' : 'off';
  }
}

export function leave() {
  resetRoom();
  emit({ roomChanged: hostId });
}

let lastLocalState = null;
let myChat = '';
let myChatTs = 0;
let pendingEvent = null;

export function sendChat(text, myName = 'Siz') {
  myChat = String(text || '').trim().slice(0, 64);
  if (!myChat) return;
  myChatTs = Date.now();
  acc = 999; // Darhol yuborish
  if (lastLocalState) {
    tick(0.1, { ...lastLocalState, name: myName });
  }
}

export function sendOnlineEvent(ev) {
  pendingEvent = ev;
  acc = 999;
  if (lastLocalState) {
    tick(0.1, lastLocalState);
  }
}

// Har kadrda chaqiriladi; harakat paytida ~12 Hz (80ms), to'xtab turganda ~3 Hz (350ms) da yuboriladi
export function tick(dt, local) {
  const activeChat = myChat && Date.now() - myChatTs < 8000 ? myChat : '';
  const payload = {
    ...local,
    x: Math.round((local.x || 0) * 10) / 10,
    y: Math.round((local.y || 0) * 10) / 10,
    z: Math.round((local.z || 0) * 10) / 10,
    h: Math.round((local.h || 0) * 1000) / 1000,
    v: Math.round((local.v || 0) * 10) / 10,
    steer: Math.round((local.steer || 0) * 100) / 100,
    chat: activeChat,
    chatTs: activeChat ? myChatTs : 0,
  };
  lastLocalState = payload;
  if (status === 'off' || status === 'connecting') return;

  const isStationary = Math.abs(local.v || 0) < 0.25 && !pendingEvent && !activeChat;
  const syncInterval = isStationary ? 0.35 : 0.08;
  acc += dt;
  if (acc < syncInterval) return;
  acc = 0;

  // 1. WebSocket rejimi (Eng tezkor va past kechikishli real-vaqt sinxronizatsiya)
  if (mode === 'ws' && ws && ws.readyState === WebSocket.OPEN) {
    const evToSend = pendingEvent;
    pendingEvent = null;
    try {
      ws.send(JSON.stringify({
        t: 'sync',
        id: myId || playerId(),
        room: hostId || 'PUBLIC',
        state: payload,
        event: evToSend,
      }));
    } catch { /* */ }
    return;
  }

  // 2. HTTP Server Fallback rejimi
  if (mode === 'server' || mode === 'ws') {
    if (syncBusy && !pendingEvent && acc < 500) return;
    syncBusy = true;
    const evToSend = pendingEvent;
    pendingEvent = null;
    fetch('/api/online/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: myId || playerId(),
        room: hostId || 'PUBLIC',
        state: payload,
        event: evToSend,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.ok) {
          hostId = data.room || hostId;
          if (data.roomType) roomType = data.roomType;
          if (data.maxPlayers) roomMax = data.maxPlayers;
          if (data.stats) updateServerStats(data.stats);
          applyList(data.players || [], data.events || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        syncBusy = false;
      });
    return;
  }

  // 3. P2P rejimi
  if (role === 'none') return;
  const now = performance.now();
  if (role === 'client') {
    if (hostConn?.open) hostConn.send({ t: 's', s: payload });
    if (now - lastHostMsg > 22000) {
      resetRoom();
      emit({ left: 'host' });
    }
    return;
  }
  for (const [id, p] of players) {
    if (now - p.t > 22000) {
      try { conns.get(id)?.close(); } catch { /* */ }
      dropClient(id);
    }
  }
  const all = [{ ...payload }, ...[...players.values()].map(({ t, missingCount, ...p }) => p)];
  for (const [id, c] of conns) {
    if (c.open) c.send({ t: 'p', list: all.filter((p) => p.id !== id) });
  }
}
