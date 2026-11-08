// ============================================================================
// TUNGI TOSHKENT V10 — POSTGRESQL & PERSISTENT ECONOMY DATABASE
// DATABASE_URL mavjud bo'lsa PostgreSQL bilan ishlaydi, aks holda data/economy.json ga xavfsiz saqlaydi
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const DATA_DIR = path.join(ROOT, 'data');
const ECON_FILE = path.join(DATA_DIR, 'economy.json');
const BACKUP_FILE = path.join(DATA_DIR, 'economy.backup.json');

let pool = null;
let isPgReady = false;

// Mavjud faylni avtomatik zaxiralash (Backup)
export function createEconomyBackup() {
  try {
    if (fs.existsSync(ECON_FILE)) {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.copyFileSync(ECON_FILE, BACKUP_FILE);
      console.log('[DB BACKUP] data/economy.json zaxira nusxasi yaratildi:', BACKUP_FILE);
      return true;
    }
  } catch (err) {
    console.error('[DB BACKUP XATOSI]', err.message);
  }
  return false;
}

export async function initDatabase() {
  createEconomyBackup();
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.log('[DB] DATABASE_URL aniqlanmadi. Xavfsiz lokal data/economy.json ishlatilmoqda.');
    return { type: 'file' };
  }

  try {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({
      connectionString: dbUrl,
      ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    const client = await pool.connect();
    try {
      // 1. Jadvallarni yaratish
      await client.query(`
        CREATE TABLE IF NOT EXISTS accounts (
          id VARCHAR(32) PRIMARY KEY,
          name VARCHAR(64) NOT NULL,
          secret VARCHAR(64),
          money BIGINT NOT NULL DEFAULT 5000000000,
          econ_ver INT DEFAULT 10,
          cars JSONB,
          daily JSONB,
          used_promos JSONB,
          transfers JSONB,
          processed_ops JSONB,
          updated_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transactions (
          tx_id VARCHAR(64) PRIMARY KEY,
          from_id VARCHAR(32) NOT NULL,
          from_name VARCHAR(64),
          to_id VARCHAR(32) NOT NULL,
          to_name VARCHAR(64),
          amount BIGINT NOT NULL,
          note VARCHAR(128),
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS deposit_races (
          race_id VARCHAR(64) PRIMARY KEY,
          status VARCHAR(32) NOT NULL,
          p1_id VARCHAR(32) NOT NULL,
          p1_deposit BIGINT NOT NULL,
          p2_id VARCHAR(32),
          p2_deposit BIGINT,
          pool BIGINT NOT NULL,
          bonus BIGINT NOT NULL,
          total_prize BIGINT NOT NULL,
          winner_id VARCHAR(32),
          created_at BIGINT NOT NULL,
          finished_at BIGINT
        );
      `);

      isPgReady = true;
      console.log('✅ [PostgreSQL V10] PostgreSQL ma\'lumotlar bazasiga muvaffaqiyatli ulandi va jadvallar tekshirildi.');

      // 2. Agar PostgreSQL bo'sh bo'lsa, data/economy.json dagi barcha foydalanuvchilarni ko'chirish (Auto-Migration)
      const res = await client.query('SELECT COUNT(*) AS cnt FROM accounts');
      const count = parseInt(res.rows[0]?.cnt || '0', 10);

      if (count === 0 && (fs.existsSync(ECON_FILE) || fs.existsSync(BACKUP_FILE))) {
        console.log('[DB MIGRATSIYA] PostgreSQL bo\'sh. economy.json dan ma\'lumotlar ko\'chirilmoqda...');
        const sourcePath = fs.existsSync(ECON_FILE) ? ECON_FILE : BACKUP_FILE;
        try {
          const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
          const accs = Array.isArray(raw.accounts) ? raw.accounts : [];
          for (const a of accs) {
            if (!a || !a.id) continue;
            await client.query(`
              INSERT INTO accounts (id, name, secret, money, econ_ver, cars, daily, used_promos, transfers, processed_ops, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (id) DO UPDATE SET
                money = EXCLUDED.money,
                updated_at = EXCLUDED.updated_at
            `, [
              a.id,
              a.name || 'Haydovchi',
              a.secret || '',
              BigInt(Math.max(0, Math.floor(Number(a.money) || 5_000_000_000))),
              a.econVer || 10,
              JSON.stringify(a.cars || []),
              JSON.stringify(a.daily || {}),
              JSON.stringify(a.usedPromos || []),
              JSON.stringify(a.transfers || []),
              JSON.stringify(a.processedOps || []),
              BigInt(a.updatedAt || Date.now()),
            ]);
          }
          console.log(`✅ [DB MIGRATSIYA TUGADI] ${accs.length} ta o'yinchi hisobi PostgreSQL bazasiga ko'chirildi!`);
        } catch (migErr) {
          console.error('[DB MIGRATSIYA XATOSI]', migErr);
        }
      }
    } finally {
      client.release();
    }
    return { type: 'postgres' };
  } catch (err) {
    console.error('⚠️ [PostgreSQL Ulanish Xatosi] data/economy.json fallback rejimiga o\'tildi:', err.message);
    isPgReady = false;
    return { type: 'file' };
  }
}

export async function loadInitialAccounts() {
  const map = new Map();

  // 1. Agar PostgreSQL tayyor bo'lsa, undan o'qiymiz
  if (isPgReady && pool) {
    try {
      const res = await pool.query('SELECT * FROM accounts');
      for (const r of res.rows) {
        map.set(r.id, {
          id: r.id,
          name: r.name,
          secret: r.secret || '',
          money: Number(r.money),
          econVer: r.econ_ver || 10,
          cars: r.cars || [],
          daily: r.daily || { streak: 0, lastClaimDay: '', lastClaimTs: 0 },
          usedPromos: r.used_promos || [],
          transfers: r.transfers || [],
          processedOps: r.processed_ops || [],
          updatedAt: Number(r.updated_at),
        });
      }
      console.log(`[DB LOAD] PostgreSQL dan ${map.size} ta foydalanuvchi hisobi yuklandi.`);
      return map;
    } catch (err) {
      console.error('[DB LOAD XATOSI] Fayldan yuklashga o\'tildi:', err.message);
    }
  }

  // 2. Lokal fayldan o'qish (Fallback)
  try {
    const src = fs.existsSync(ECON_FILE) ? ECON_FILE : (fs.existsSync(BACKUP_FILE) ? BACKUP_FILE : null);
    if (src) {
      const raw = JSON.parse(fs.readFileSync(src, 'utf8'));
      if (Array.isArray(raw.accounts)) {
        for (const a of raw.accounts) {
          if (a && a.id) map.set(a.id, a);
        }
      }
      console.log(`[FILE LOAD] ${src} dan ${map.size} ta foydalanuvchi hisobi yuklandi.`);
    }
  } catch (err) {
    console.error('[FILE LOAD XATOSI]', err.message);
  }

  return map;
}

export async function persistAccount(acc) {
  if (!acc || !acc.id) return;

  // 1. PostgreSQL ga yozish (agar ulangan bo'lsa)
  if (isPgReady && pool) {
    try {
      await pool.query(`
        INSERT INTO accounts (id, name, secret, money, econ_ver, cars, daily, used_promos, transfers, processed_ops, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          secret = CASE WHEN EXCLUDED.secret <> '' THEN EXCLUDED.secret ELSE accounts.secret END,
          money = EXCLUDED.money,
          econ_ver = EXCLUDED.econ_ver,
          cars = EXCLUDED.cars,
          daily = EXCLUDED.daily,
          used_promos = EXCLUDED.used_promos,
          transfers = EXCLUDED.transfers,
          processed_ops = EXCLUDED.processed_ops,
          updated_at = EXCLUDED.updated_at
      `, [
        acc.id,
        acc.name || 'Haydovchi',
        acc.secret || '',
        BigInt(Math.max(0, Math.floor(Number(acc.money) || 0))),
        acc.econVer || 10,
        JSON.stringify(acc.cars || []),
        JSON.stringify(acc.daily || {}),
        JSON.stringify(acc.usedPromos || []),
        JSON.stringify((acc.transfers || []).slice(0, 30)),
        JSON.stringify((acc.processedOps || []).slice(0, 50)),
        BigInt(acc.updatedAt || Date.now()),
      ]);
    } catch (err) {
      console.error(`[DB PERSIST XATOSI ${acc.id}]`, err.message);
    }
  }
}

export async function persistTransaction(tx) {
  if (!tx || !tx.txId) return;
  if (isPgReady && pool) {
    try {
      await pool.query(`
        INSERT INTO transactions (tx_id, from_id, from_name, to_id, to_name, amount, note, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (tx_id) DO NOTHING
      `, [
        tx.txId,
        tx.fromId,
        tx.fromName || '',
        tx.toId,
        tx.toName || '',
        BigInt(tx.amount || 0),
        tx.note || '',
        BigInt(tx.ts || Date.now()),
      ]);
    } catch (err) {
      console.error('[DB TX PERSIST XATOSI]', err.message);
    }
  }
}

export function isDbPostgres() {
  return isPgReady && pool !== null;
}
