// Online rejim (10 tagacha o'yinchi):
// 1) Render.com yoki Node.js serverda (/api/online/*) — to'g'ridan-to'g'ri tezkor HTTP sinxronizatsiya
// 2) Statik xostingda (Netlify va h.k.) — PeerJS (WebRTC) orqali P2P ulanish
export const MAX_PLAYERS = 10;
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

let mode = 'unknown'; // 'unknown' | 'server' | 'p2p'
let peer = null;
let myId = '';
let role = 'none';    // 'none' | 'host' | 'client' | 'room'
let status = 'off';   // 'off' | 'connecting' | 'ready' | 'joining' | 'connected'
let hostConn = null;
let hostId = '';
let joinReject = null;
let lastHostMsg = 0;
let acc = 0;
let syncBusy = false;

const conns = new Map();   // P2P host: id -> conn
const players = new Map(); // Boshqa o'yinchilar: id -> state
const listeners = new Set();
const seenEventIds = new Set();
export const chatHistory = []; // [{ fromName, text, ts }]

const emit = (ev = {}) => listeners.forEach((f) => f(ev));
export const onOnline = (f) => { listeners.add(f); return () => listeners.delete(f); };

function genId() {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return [...a].map((n) => ALPHABET[n % ALPHABET.length]).join('');
}

// Har bir foydalanuvchi uchun takrorlanmas 6 belgili ID (TT-XXXXXX)
export function playerId() {
  let id = localStorage.getItem('tt-pid');
  if (!id || id.length !== 6) {
    id = genId();
    localStorage.setItem('tt-pid', id);
  }
  return id;
}

export const displayId = (id = myId || playerId()) => {
  if (!id || id === 'LOBBY') return 'UMUMIY ZAL';
  if (String(id).startsWith('LOBBY')) return 'UMUMIY ZAL #' + String(id).slice(5);
  return 'TT-' + id;
};
export const normalizeId = (s) =>
  String(s || '')
    .trim()
    .toUpperCase()
    .replace(/^TT-/, '')
    .replace(/[^A-Z0-9]/g, '');

export const info = () => ({
  status,
  role,
  mode,
  id: myId || playerId(),
  host: hostId,
  count: players.size + 1,
  max: MAX_PLAYERS,
});

export const list = () => [...players.values()];

async function detectServerMode() {
  if (mode !== 'unknown') return mode;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch('/api/online/ping', { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (r.ok) {
      const data = await r.json();
      if (data && data.ok) {
        mode = 'server';
        return mode;
      }
    }
  } catch {
    // Server API mavjud emas — P2P rejimiga o'tamiz
  }
  mode = 'p2p';
  return mode;
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
  if (status === 'ready' || status === 'connected' || status === 'joining') return myId;

  status = 'connecting';
  emit();

  const m = await detectServerMode();
  if (m === 'server') {
    // Render.com / Node.js server rejimi: barcha o'yinchilar bir-birini darhol ko'rishi uchun UMUMIY ZAL (LOBBY) ga ulanadi
    role = 'room';
    hostId = 'LOBBY';
    status = 'connected';
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
          return r(new Error("Bunday ID topilmadi yoki do'st online emas"));
        }
        if (!done) {
          status = 'off';
          emit();
          return reject(new Error("Online serverga ulanib bo'lmadi"));
        }
        emit({ error: err.type });
      });
    };
    start();
  });
}

// ---- P2P Host tomoni ----
function onIncoming(conn) {
  conn.on('open', () => {
    if (role === 'client' || status === 'joining') {
      conn.send({ t: 'busy' });
      setTimeout(() => conn.close(), 400);
      return;
    }
    if (conns.size >= MAX_PLAYERS - 1) {
      conn.send({ t: 'full' });
      setTimeout(() => conn.close(), 400);
      return;
    }
    const id = conn.peer.slice(PREFIX.length);
    conns.set(id, conn);
    role = 'host';
    status = 'connected';
    hostId = myId;
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

// ---- Do'st ID siga yoki Umumiy zalga (LOBBY) qo'shilish ----
export async function joinFriend(raw) {
  const clean = normalizeId(raw);
  const isLobby = clean === 'LOBBY' || clean === 'UMUMIY';
  const id = isLobby ? 'LOBBY' : clean;

  if (!isLobby && id.length !== 6) {
    throw new Error("ID 6 ta belgidan iborat bo'lishi kerak (masalan: TT-7K2M9Q)");
  }
  if (id === myId) {
    throw new Error("Bu sizning o'z ID ingiz! Uni do'stingizga yuboring.");
  }

  await goOnline();

  if (mode === 'server') {
    status = 'joining';
    emit();
    const r = await fetch('/api/online/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: myId, room: id, state: lastLocalState || { name: 'Haydovchi' } }),
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
    applyList(data.players || []);
    emit();
    return hostId;
  }

  // P2P rejimi
  if (isLobby) {
    throw new Error("P2P rejimida do'stingizning 6 belgili ID sini kiriting (masalan: TT-7K2M9Q)");
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
        emit();
        resolve(id);
      } else if (m.t === 'full') fail(`Xona to'lgan (${MAX_PLAYERS}/${MAX_PLAYERS})`);
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
      if (chatHistory.length > 25) chatHistory.shift();
      if (ev.fromId !== (myId || playerId())) {
        emit({ chat: { name: ev.fromName || 'Haydovchi', text: ev.text } });
      } else {
        emit({ chatUpdated: true });
      }
    } else if (ev.type === 'race') {
      emit({ raceEvent: ev });
    }
  }

  for (const p of l) {
    seen.add(p.id);
    const prev = players.get(p.id);
    if (!prev) {
      changed = true;
      emit({ join: p.name });
    } else {
      // P2P rejimda events bo'lmagani uchun p.chatTs orqali tekshiramiz
      if (mode !== 'server' && p.chat && p.chatTs && p.chatTs !== prev.chatTs) {
        chatHistory.push({ fromName: p.name || 'Haydovchi', text: p.chat, ts: Date.now() });
        if (chatHistory.length > 25) chatHistory.shift();
        emit({ chat: { name: p.name || 'Haydovchi', text: p.chat } });
      }
      // Do'st bizning mashinamizga o'tirganini bildirish
      if (p.ridingWith && p.ridingWith !== prev.ridingWith && p.ridingWith === (myId || playerId())) {
        emit({ passengerJoin: p.name || 'Haydovchi' });
      }
    }
    players.set(p.id, { ...p, t: now, missingCount: 0 });
  }
  for (const [id, p] of players) {
    if (!seen.has(id)) {
      p.missingCount = (p.missingCount || 0) + 1;
      // Kamida 8 marta ketma-ket ko'rinmasa va 4 soniyadan oshsa o'chiramiz (yolg'on "o'yindan chiqdi" chiqmasligi uchun)
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
  if (mode === 'server') {
    fetch('/api/online/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: myId }),
    }).catch(() => {});
    role = 'room';
    hostId = myId;
    status = 'connected';
  } else {
    role = 'none';
    hostId = '';
    status = peer && !peer.destroyed ? 'ready' : 'off';
  }
}

export function leave() {
  resetRoom();
  emit();
}

let lastLocalState = null;
let myChat = '';
let myChatTs = 0;
let pendingEvent = null;

export function sendChat(text, myName = 'Siz') {
  myChat = String(text || '').trim().slice(0, 56);
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

// Har kadrda chaqiriladi; holat sekundiga ~16 marta (har 60 ms da) real vaqtda yuboriladi
export function tick(dt, local) {
  const activeChat = myChat && Date.now() - myChatTs < 8000 ? myChat : '';
  const payload = { ...local, chat: activeChat, chatTs: activeChat ? myChatTs : 0 };
  lastLocalState = payload;
  if (status === 'off' || status === 'connecting') return;
  acc += dt;
  if (acc < 0.06) return;
  acc = 0;

  if (mode === 'server') {
    if (syncBusy && !pendingEvent && acc < 500) return;
    syncBusy = true;
    const evToSend = pendingEvent;
    pendingEvent = null;
    fetch('/api/online/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: myId || playerId(),
        room: hostId || 'LOBBY',
        state: payload,
        event: evToSend,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.ok) {
          hostId = data.room || hostId;
          applyList(data.players || [], data.events || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        syncBusy = false;
      });
    return;
  }

  // P2P rejimi
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
