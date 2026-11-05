import http from 'node:http';
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
// Built-in Multiplayer Server (10 tagacha o'yinchi xonalari va ID bo'yicha ulanish)
// ============================================================================
const MAX_PLAYERS = 10;
const PLAYER_TTL_MS = 8000;
// rooms: Map<roomId, Map<playerId, playerState>>
const rooms = new Map();
// playerRoom: Map<playerId, roomId>
const playerRoom = new Map();

function cleanStalePlayers() {
  const now = Date.now();
  for (const [roomId, map] of rooms.entries()) {
    for (const [pid, p] of map.entries()) {
      if (now - p.updatedAt > PLAYER_TTL_MS) {
        map.delete(pid);
        if (playerRoom.get(pid) === roomId) playerRoom.delete(pid);
      }
    }
    if (map.size === 0) rooms.delete(roomId);
  }
}
setInterval(cleanStalePlayers, 3000).unref?.();

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

  if (urlPath === '/api/online/ping') {
    sendJson(res, 200, { ok: true, max: MAX_PLAYERS });
    return;
  }

  if (urlPath === '/api/online/sync' && req.method === 'POST') {
    cleanStalePlayers();
    const body = await parseBody(req);
    const id = String(body.id || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (!id) return sendJson(res, 400, { error: 'ID kerak' });

    // Qaysi xonaga ulanishi: targetRoom (do'st ID si yoki LOBBY) yoki o'zining ID si
    let targetRoom = String(body.room || id).toUpperCase().replace(/^TT-/, '').replace(/[^A-Z0-9]/g, '').slice(0, 12) || id;

    // Agar targetRoom boshqa o'yinchining ID si bo'lsa va u o'yinchi allaqachon biror xonada bo'lsa, o'sha xonaga yo'naltiramiz
    if (playerRoom.has(targetRoom)) {
      targetRoom = playerRoom.get(targetRoom);
    }

    let roomMap = rooms.get(targetRoom);
    if (!roomMap) {
      roomMap = new Map();
      rooms.set(targetRoom, roomMap);
    }

    if (!roomMap.has(id) && roomMap.size >= MAX_PLAYERS) {
      return sendJson(res, 409, { error: `Xona to'lgan (${MAX_PLAYERS}/${MAX_PLAYERS})` });
    }

    // Agar o'yinchi avval boshqa xonada bo'lsa, eski xonadan chiqaramiz
    const prevRoom = playerRoom.get(id);
    if (prevRoom && prevRoom !== targetRoom) {
      rooms.get(prevRoom)?.delete(id);
    }

    playerRoom.set(id, targetRoom);
    const state = body.state || {};
    const prevP = roomMap.get(id);
    const chat = state.chat ? String(state.chat).slice(0, 48) : (prevP && Date.now() - (prevP.chatTs || 0) < 7000 ? prevP.chat : '');
    const chatTs = state.chat ? Number(state.chatTs) || Date.now() : (prevP?.chatTs || 0);
    roomMap.set(id, {
      id,
      name: String(state.name || 'Haydovchi').slice(0, 18),
      car: String(state.car || 'gentra'),
      color: String(state.color || '#f5f5f5'),
      x: Number(state.x) || 0,
      y: Number(state.y) || 0,
      z: Number(state.z) || 0,
      h: Number(state.h) || 0,
      v: Number(state.v) || 0,
      steer: Number(state.steer) || 0,
      chat,
      chatTs,
      updatedAt: Date.now(),
    });

    const players = [];
    for (const [pid, p] of roomMap.entries()) {
      if (pid !== id) {
        players.push({
          id: p.id,
          name: p.name,
          car: p.car,
          color: p.color,
          x: p.x,
          y: p.y,
          z: p.z,
          h: p.h,
          v: p.v,
          steer: p.steer,
          chat: Date.now() - (p.chatTs || 0) < 7000 ? p.chat : '',
          chatTs: p.chatTs || 0,
        });
      }
    }

    sendJson(res, 200, {
      ok: true,
      room: targetRoom,
      count: roomMap.size,
      max: MAX_PLAYERS,
      players,
    });
    return;
  }

  if (urlPath === '/api/online/leave' && req.method === 'POST') {
    const body = await parseBody(req);
    const id = String(body.id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const r = playerRoom.get(id);
    if (r) {
      rooms.get(r)?.delete(id);
      playerRoom.delete(id);
    }
    sendJson(res, 200, { ok: true });
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

server.listen(PORT, () => {
  console.log(`Tungi Toshkent 3D server running at http://localhost:${PORT}`);
});
