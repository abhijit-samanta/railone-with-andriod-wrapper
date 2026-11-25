import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type MpinStatus = 'Active' | 'Used' | 'Blocked' | 'Expired';
export type DeviceType = 'Android' | 'iOS';
export type AdminAuthMode = 'env' | 'claimed' | 'setup-required';
export type ClearMpinScope = 'all' | 'used-blocked-expired' | 'blocked' | 'used';

export interface MpinRecord {
  id: number;
  mpin: string;
  batchId: string;
  generatedAt: string;
  expiresAt: string | null;
  firstLoginAt: string | null;
  lastLoginAt: string | null;
  totalLoginCount: number;
  deviceId: string | null;
  deviceType: DeviceType | null;
  loginIp: string | null;
  status: MpinStatus;
  failedAttempts: number;
  deviceLocked: boolean;
  boundUserName: string | null;
  boundUserMobile: string | null;
  boundUserKey: string | null;
}

export interface LoginAuditLogRecord {
  id: number;
  mpin: string;
  outcome: 'Success' | 'Failed';
  reason: string;
  deviceId: string | null;
  deviceType: DeviceType | null;
  loginIp: string | null;
  attemptedAt: string;
}

export interface MpinDashboardStats {
  totalGenerated: number;
  activeCount: number;
  usedCount: number;
  blockedCount: number;
  expiredCount: number;
  totalSuccessfulLogins: number;
  totalFailedAttemptsOnMpins: number;
  totalAuditFailures: number;
  enforceDeviceLock: boolean;
  lastBatchId: string | null;
  lastGeneratedAt: string | null;
}

export interface VerifyUserMpinInput {
  mpin: string;
  deviceId: string;
  deviceType: string;
  loginIp: string;
  userName?: string;
  userMobile?: string;
  userKey?: string;
  nowIso?: string;
}

export interface VerifyUserMpinResult {
  ok: boolean;
  statusCode: number;
  error: string | null;
  record: MpinRecord | null;
}

export const ONE_LAKH = 100_000;
export const MAX_MPIN_POOL = 62 ** 6;
export const MAX_FAILED_ATTEMPTS_BEFORE_BLOCK = 5;

const MPIN_DIGITS = '0123456789';
const MPIN_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MPIN_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const MPIN_ALPHABET = `${MPIN_DIGITS}${MPIN_UPPER}${MPIN_LOWER}`;

export function isValidMpinFormat(value: unknown): boolean {
  return typeof value === 'string' && /^[A-Za-z0-9]{6}$/.test(value.trim());
}

export function isMixedCaseAlphanumericMpin(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /^(?=.*\d)(?=.*[A-Z])(?=.*[a-z])[A-Za-z0-9]{6}$/.test(value.trim())
  );
}

export function isValidSixDigitMpin(value: unknown): boolean {
  return isValidMpinFormat(value);
}

export function normalizeDeviceType(raw: unknown): DeviceType {
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'ios') {
    return 'iOS';
  }
  return 'Android';
}

export function normalizeDeviceId(raw: unknown): string {
  if (typeof raw === 'string') {
    const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (cleaned.length >= 4) {
      return cleaned;
    }
  }
  return 'DEV-UNKNOWN';
}

export function sanitizeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

class FastCryptoByteStream {
  private buf: Buffer;
  private idx = 0;

  constructor(initialSize = 16384) {
    this.buf = crypto.randomBytes(initialSize);
  }

  nextUnbiased(modulo: number): number {
    const limit = 256 - (256 % modulo);
    while (true) {
      if (this.idx >= this.buf.length) {
        this.buf = crypto.randomBytes(this.buf.length);
        this.idx = 0;
      }
      const b = this.buf[this.idx++];
      if (b < limit) {
        return b % modulo;
      }
    }
  }
}

export function generateUniqueMpins(
  count: number,
  existingSet: ReadonlySet<string>
): string[] {
  if (!Number.isInteger(count) || count < 1 || count > ONE_LAKH) {
    throw new Error(`Batch count must be an integer between 1 and ${ONE_LAKH}.`);
  }
  if (existingSet.size + count > MAX_MPIN_POOL) {
    throw new Error(`Cannot generate ${count} unique MPINs: pool capacity exceeded.`);
  }

  const rng = new FastCryptoByteStream(Math.min(1_024_000, Math.max(8192, count * 12)));
  const result: string[] = [];
  const seen = new Set<string>();
  const chars = new Array<string>(6);

  while (result.length < count) {
    // Guarantee combination of digit + uppercase + lowercase + 3 full-alphabet chars
    chars[0] = MPIN_DIGITS[rng.nextUnbiased(MPIN_DIGITS.length)];
    chars[1] = MPIN_UPPER[rng.nextUnbiased(MPIN_UPPER.length)];
    chars[2] = MPIN_LOWER[rng.nextUnbiased(MPIN_LOWER.length)];
    chars[3] = MPIN_ALPHABET[rng.nextUnbiased(MPIN_ALPHABET.length)];
    chars[4] = MPIN_ALPHABET[rng.nextUnbiased(MPIN_ALPHABET.length)];
    chars[5] = MPIN_ALPHABET[rng.nextUnbiased(MPIN_ALPHABET.length)];

    // Fisher-Yates shuffle across all 6 positions
    for (let i = 5; i > 0; i -= 1) {
      const j = rng.nextUnbiased(i + 1);
      const tmp = chars[i];
      chars[i] = chars[j];
      chars[j] = tmp;
    }

    const candidate = chars.join('');
    if (!existingSet.has(candidate) && !seen.has(candidate)) {
      seen.add(candidate);
      result.push(candidate);
    }
  }

  return result;
}

export function hashAdminMpin(mpin: string): string {
  const clean = mpin.trim();
  if (!isValidMpinFormat(clean)) {
    throw new Error('Admin MPIN must be 6 characters (digits, uppercase & lowercase letters).');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(clean, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyAdminMpinHash(mpin: string, storedHash: string): boolean {
  const clean = mpin.trim();
  if (!isValidMpinFormat(clean)) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hexDigest] = parts;
  if (!salt || !hexDigest) return false;
  try {
    const expected = Buffer.from(hexDigest, 'hex');
    const actual = crypto.scryptSync(clean, salt, 64);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface SignedTokenPayload {
  sub: string;
  role: 'admin' | 'user';
  iat: number;
  exp: number;
}

export function signAuthToken(
  payload: Omit<SignedTokenPayload, 'iat' | 'exp'>,
  secret: string,
  ttlSeconds = 60 * 60 * 12
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload: SignedTokenPayload = {
    ...payload,
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyAuthToken(
  token: string,
  secret: string,
  expectedRole?: 'admin' | 'user'
): SignedTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (!timingSafeEqualString(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SignedTokenPayload;
    if (!parsed || typeof parsed.exp !== 'number') return null;
    if (Math.floor(Date.now() / 1000) > parsed.exp) return null;
    if (expectedRole && parsed.role !== expectedRole) return null;
    return parsed;
  } catch {
    return null;
  }
}

interface SqliteMpinRow {
  id: number;
  mpin: string;
  batch_id: string;
  generated_at: string;
  expires_at: string | null;
  first_login_at: string | null;
  last_login_at: string | null;
  total_login_count: number;
  device_id: string | null;
  device_type: string | null;
  login_ip: string | null;
  status: string;
  failed_attempts: number;
  device_locked: number;
  bound_user_name: string | null;
  bound_user_mobile: string | null;
  bound_user_key: string | null;
}

interface SqliteAuditRow {
  id: number;
  mpin: string;
  outcome: string;
  reason: string;
  device_id: string | null;
  device_type: string | null;
  login_ip: string | null;
  attempted_at: string;
}

function mapMpinRow(row: SqliteMpinRow): MpinRecord {
  return {
    id: Number(row.id),
    mpin: String(row.mpin),
    batchId: String(row.batch_id),
    generatedAt: String(row.generated_at),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    firstLoginAt: row.first_login_at ? String(row.first_login_at) : null,
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
    totalLoginCount: Number(row.total_login_count ?? 0),
    deviceId: row.device_id ? String(row.device_id) : null,
    deviceType: row.device_type === 'iOS' || row.device_type === 'Android' ? row.device_type : null,
    loginIp: row.login_ip ? String(row.login_ip) : null,
    status: (row.status as MpinStatus) || 'Active',
    failedAttempts: Number(row.failed_attempts ?? 0),
    deviceLocked: Boolean(row.device_locked),
    boundUserName: row.bound_user_name ? String(row.bound_user_name) : null,
    boundUserMobile: row.bound_user_mobile ? String(row.bound_user_mobile) : null,
    boundUserKey: row.bound_user_key ? String(row.bound_user_key) : null,
  };
}

function mapAuditRow(row: SqliteAuditRow): LoginAuditLogRecord {
  return {
    id: Number(row.id),
    mpin: String(row.mpin),
    outcome: row.outcome === 'Success' ? 'Success' : 'Failed',
    reason: String(row.reason),
    deviceId: row.device_id ? String(row.device_id) : null,
    deviceType: row.device_type === 'iOS' || row.device_type === 'Android' ? row.device_type : null,
    loginIp: row.login_ip ? String(row.login_ip) : null,
    attemptedAt: String(row.attempted_at),
  };
}

export interface StoredUserAccountRecord {
  userKey: string;
  userName: string;
  userMobile: string;
  mpin: string | null;
  snapshot: Record<string, unknown> | null;
  updatedAt: string;
}

export class MpinDatabase {
  private readonly db: DatabaseSync;
  private readonly isMemoryDb: boolean;

  constructor(dbFilePath: string) {
    this.isMemoryDb = dbFilePath === ':memory:';
    if (!this.isMemoryDb) {
      const dir = path.dirname(dbFilePath);
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(dbFilePath);
    this.initSchema();
  }

  private checkpointWal(): void {
    if (this.isMemoryDb) return;
    try {
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {
      // ignore checkpoint errors during concurrent access
    }
  }

  private initSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS mpins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mpin TEXT NOT NULL UNIQUE,
        batch_id TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        expires_at TEXT,
        first_login_at TEXT,
        last_login_at TEXT,
        total_login_count INTEGER NOT NULL DEFAULT 0,
        device_id TEXT,
        device_type TEXT,
        login_ip TEXT,
        status TEXT NOT NULL DEFAULT 'Active',
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        device_locked INTEGER NOT NULL DEFAULT 0,
        bound_user_name TEXT,
        bound_user_mobile TEXT,
        bound_user_key TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_mpins_mpin ON mpins(mpin);
      CREATE INDEX IF NOT EXISTS idx_mpins_status ON mpins(status);
      CREATE INDEX IF NOT EXISTS idx_mpins_last_login ON mpins(last_login_at);
      CREATE INDEX IF NOT EXISTS idx_mpins_generated_at ON mpins(generated_at);

      CREATE TABLE IF NOT EXISTS login_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mpin TEXT NOT NULL,
        outcome TEXT NOT NULL,
        reason TEXT NOT NULL,
        device_id TEXT,
        device_type TEXT,
        login_ip TEXT,
        attempted_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_attempted_at ON login_audit_logs(attempted_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_mpin ON login_audit_logs(mpin);

      CREATE TABLE IF NOT EXISTS admin_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_accounts (
        user_key TEXT PRIMARY KEY,
        user_name TEXT NOT NULL,
        user_mobile TEXT NOT NULL,
        mpin TEXT,
        snapshot_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_user_accounts_mobile ON user_accounts(user_mobile);
    `);

    const cols = this.db.prepare('PRAGMA table_info(mpins)').all() as Array<{ name?: string }>;
    const colSet = new Set(cols.map((c) => String(c.name ?? '')));
    if (!colSet.has('bound_user_name')) {
      this.db.exec('ALTER TABLE mpins ADD COLUMN bound_user_name TEXT;');
    }
    if (!colSet.has('bound_user_mobile')) {
      this.db.exec('ALTER TABLE mpins ADD COLUMN bound_user_mobile TEXT;');
    }
    if (!colSet.has('bound_user_key')) {
      this.db.exec('ALTER TABLE mpins ADD COLUMN bound_user_key TEXT;');
    }
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_mpins_bound_user_key ON mpins(bound_user_key);');

    const legacyPurged = this.db
      .prepare("SELECT value FROM admin_config WHERE key = 'purged_legacy_mpins_v1'")
      .get() as { value?: string } | undefined;

    if (!legacyPurged) {
      const now = new Date().toISOString();
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.exec('DELETE FROM mpins; DELETE FROM login_audit_logs;');
        try {
          this.db.exec(
            "DELETE FROM sqlite_sequence WHERE name IN ('mpins', 'login_audit_logs');"
          );
        } catch {
          // sqlite_sequence may not exist on fresh DBs without autoincrement inserts yet
        }
        this.db
          .prepare(
            `INSERT INTO admin_config (key, value, updated_at)
             VALUES ('purged_legacy_mpins_v1', ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
          )
          .run(now, now);
        this.db.exec('COMMIT');
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw err;
      }
    }
  }

  close(): void {
    this.db.close();
  }

  private getConfig(key: string): string | null {
    const row = this.db
      .prepare('SELECT value FROM admin_config WHERE key = ?')
      .get(key) as { value?: string } | undefined;
    return row?.value ?? null;
  }

  private setConfig(key: string, value: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO admin_config (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(key, value, now);
  }

  getEnforceDeviceLock(): boolean {
    return this.getConfig('enforce_device_lock') === 'true';
  }

  setEnforceDeviceLock(enabled: boolean): void {
    this.setConfig('enforce_device_lock', enabled ? 'true' : 'false');
  }

  getAdminAuthMode(envAdminMpin?: string): AdminAuthMode {
    const envPin = (envAdminMpin ?? '').trim();
    if (isValidSixDigitMpin(envPin)) {
      return 'env';
    }
    const storedHash = this.getConfig('admin_mpin_hash');
    if (storedHash) {
      return 'claimed';
    }
    return 'setup-required';
  }

  claimFirstRunAdminMpin(
    mpin: string,
    envAdminMpin?: string
  ): { ok: boolean; error: string | null } {
    const clean = mpin.trim();
    if (!isValidMpinFormat(clean)) {
      return {
        ok: false,
        error: 'Admin MPIN must be 6 characters (digits, uppercase & lowercase letters).',
      };
    }
    if ((envAdminMpin ?? '').trim()) {
      return {
        ok: false,
        error: 'Admin MPIN is already managed by the server ADMIN_MPIN configuration.',
      };
    }

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.getConfig('admin_mpin_hash');
      if (existing) {
        this.db.exec('ROLLBACK');
        return {
          ok: false,
          error: 'Admin MPIN has already been claimed. Please sign in with it.',
        };
      }
      const hashed = hashAdminMpin(clean);
      const now = new Date().toISOString();
      this.db
        .prepare('INSERT INTO admin_config (key, value, updated_at) VALUES (?, ?, ?)')
        .run('admin_mpin_hash', hashed, now);
      this.db.exec('COMMIT');
      return { ok: true, error: null };
    } catch (err) {
      this.db.exec('ROLLBACK');
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to save Admin MPIN.',
      };
    }
  }

  verifyAdminPasscode(mpin: string, envAdminMpin?: string): boolean {
    const clean = mpin.trim();
    if (!isValidMpinFormat(clean)) return false;

    const envPin = (envAdminMpin ?? '').trim();
    if (envPin) {
      return timingSafeEqualString(clean, envPin);
    }

    const storedHash = this.getConfig('admin_mpin_hash');
    if (!storedHash) return false;
    return verifyAdminMpinHash(clean, storedHash);
  }

  changeClaimedAdminMpin(
    currentMpin: string,
    newMpin: string,
    envAdminMpin?: string
  ): { ok: boolean; error: string | null } {
    if ((envAdminMpin ?? '').trim()) {
      return {
        ok: false,
        error: 'Admin MPIN is controlled by ADMIN_MPIN environment secret and cannot be changed here.',
      };
    }
    if (!this.verifyAdminPasscode(currentMpin, envAdminMpin)) {
      return { ok: false, error: 'Current Admin MPIN is incorrect.' };
    }
    const cleanNew = newMpin.trim();
    if (!isValidMpinFormat(cleanNew)) {
      return {
        ok: false,
        error: 'New Admin MPIN must be 6 characters (digits, uppercase & lowercase letters).',
      };
    }
    this.setConfig('admin_mpin_hash', hashAdminMpin(cleanNew));
    return { ok: true, error: null };
  }

  generateBatch(
    count = ONE_LAKH,
    options?: { expiryDays?: number | null; nowIso?: string }
  ): {
    batchId: string;
    generatedCount: number;
    generatedAt: string;
    expiresAt: string | null;
    durationMs: number;
    sampleMpins: string[];
  } {
    const startMs = Date.now();
    const generatedAt = options?.nowIso ?? new Date().toISOString();
    const expiryDays = options?.expiryDays ?? null;
    const expiresAt =
      typeof expiryDays === 'number' && Number.isFinite(expiryDays) && expiryDays > 0
        ? new Date(Date.parse(generatedAt) + expiryDays * 86_400_000).toISOString()
        : null;

    const existingRows = this.db.prepare('SELECT mpin FROM mpins').all() as Array<{ mpin: string }>;
    const existingSet = new Set<string>(existingRows.map((r) => String(r.mpin)));

    const newMpins = generateUniqueMpins(count, existingSet);
    const batchId = `BATCH-${generatedAt.slice(0, 10).replace(/-/g, '')}-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    const insertStmt = this.db.prepare(`
      INSERT INTO mpins (
        mpin, batch_id, generated_at, expires_at, first_login_at, last_login_at,
        total_login_count, device_id, device_type, login_ip, status, failed_attempts, device_locked
      ) VALUES (?, ?, ?, ?, NULL, NULL, 0, NULL, NULL, NULL, 'Active', 0, 0)
    `);

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (let i = 0; i < newMpins.length; i += 1) {
        insertStmt.run(newMpins[i], batchId, generatedAt, expiresAt);
      }
      this.db.exec('COMMIT');
      this.checkpointWal();
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return {
      batchId,
      generatedCount: newMpins.length,
      generatedAt,
      expiresAt,
      durationMs: Date.now() - startMs,
      sampleMpins: newMpins.slice(0, 10),
    };
  }

  private logAttempt(params: {
    mpin: string;
    outcome: 'Success' | 'Failed';
    reason: string;
    deviceId: string | null;
    deviceType: DeviceType | null;
    loginIp: string | null;
    attemptedAt: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO login_audit_logs
         (mpin, outcome, reason, device_id, device_type, login_ip, attempted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        params.mpin,
        params.outcome,
        params.reason,
        params.deviceId,
        params.deviceType,
        params.loginIp,
        params.attemptedAt
      );
  }

  verifyUserMpin(input: VerifyUserMpinInput): VerifyUserMpinResult {
    const cleanMpin = String(input.mpin ?? '').trim();
    const deviceId = normalizeDeviceId(input.deviceId);
    const deviceType = normalizeDeviceType(input.deviceType);
    const loginIp = (input.loginIp || '127.0.0.1').trim().slice(0, 64);
    const nowIso = input.nowIso ?? new Date().toISOString();
    const incomingName =
      typeof input.userName === 'string' ? input.userName.trim().slice(0, 80) : '';
    const incomingMobile =
      typeof input.userMobile === 'string'
        ? input.userMobile.replace(/\D/g, '').slice(0, 15)
        : '';
    const rawIncomingKey =
      typeof input.userKey === 'string' ? input.userKey.trim().toLowerCase().slice(0, 80) : '';
    const cleanedIncomingKey =
      rawIncomingKey === 'pending_user' || rawIncomingKey === 'default_user' ? '' : rawIncomingKey;
    const incomingKey = cleanedIncomingKey
      ? cleanedIncomingKey
      : incomingMobile
        ? `user_${incomingMobile}`
        : incomingName
          ? `name_${incomingName.toLowerCase()}`
          : '';

    if (!isValidMpinFormat(cleanMpin)) {
      this.logAttempt({
        mpin: cleanMpin.slice(0, 12) || 'INVALID',
        outcome: 'Failed',
        reason: 'Malformed MPIN format',
        deviceId,
        deviceType,
        loginIp,
        attemptedAt: nowIso,
      });
      return {
        ok: false,
        statusCode: 400,
        error: 'Please enter a valid 6-character MPIN (digits, uppercase & lowercase letters).',
        record: null,
      };
    }

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db
        .prepare('SELECT * FROM mpins WHERE mpin = ?')
        .get(cleanMpin) as SqliteMpinRow | undefined;

      if (!row) {
        this.logAttempt({
          mpin: cleanMpin,
          outcome: 'Failed',
          reason: 'MPIN not found in database',
          deviceId,
          deviceType,
          loginIp,
          attemptedAt: nowIso,
        });
        this.db.exec('COMMIT');
        return {
          ok: false,
          statusCode: 401,
          error: 'Invalid MPIN. Please enter an Admin-issued 6-character MPIN.',
          record: null,
        };
      }

      // Automatic expiry check
      if (
        row.status !== 'Expired' &&
        row.status !== 'Blocked' &&
        row.expires_at &&
        Date.parse(row.expires_at) <= Date.parse(nowIso)
      ) {
        this.db
          .prepare("UPDATE mpins SET status = 'Expired', failed_attempts = failed_attempts + 1 WHERE mpin = ?")
          .run(cleanMpin);
        const updated = this.db.prepare('SELECT * FROM mpins WHERE mpin = ?').get(cleanMpin) as unknown as SqliteMpinRow;
        this.logAttempt({
          mpin: cleanMpin,
          outcome: 'Failed',
          reason: 'MPIN expired',
          deviceId,
          deviceType,
          loginIp,
          attemptedAt: nowIso,
        });
        this.db.exec('COMMIT');
        return {
          ok: false,
          statusCode: 403,
          error: 'This MPIN has expired. Please contact Admin for a new MPIN.',
          record: mapMpinRow(updated),
        };
      }

      if (row.status === 'Expired') {
        this.db
          .prepare('UPDATE mpins SET failed_attempts = failed_attempts + 1 WHERE mpin = ?')
          .run(cleanMpin);
        const updated = this.db.prepare('SELECT * FROM mpins WHERE mpin = ?').get(cleanMpin) as unknown as SqliteMpinRow;
        this.logAttempt({
          mpin: cleanMpin,
          outcome: 'Failed',
          reason: 'MPIN expired',
          deviceId,
          deviceType,
          loginIp,
          attemptedAt: nowIso,
        });
        this.db.exec('COMMIT');
        return {
          ok: false,
          statusCode: 403,
          error: 'This MPIN has expired. Please contact Admin.',
          record: mapMpinRow(updated),
        };
      }

      if (row.status === 'Blocked') {
        this.db
          .prepare('UPDATE mpins SET failed_attempts = failed_attempts + 1 WHERE mpin = ?')
          .run(cleanMpin);
        const updated = this.db.prepare('SELECT * FROM mpins WHERE mpin = ?').get(cleanMpin) as unknown as SqliteMpinRow;
        this.logAttempt({
          mpin: cleanMpin,
          outcome: 'Failed',
          reason: 'MPIN blocked by Admin',
          deviceId,
          deviceType,
          loginIp,
          attemptedAt: nowIso,
        });
        this.db.exec('COMMIT');
        return {
          ok: false,
          statusCode: 403,
          error: 'This MPIN is blocked by Admin. Access denied.',
          record: mapMpinRow(updated),
        };
      }

      // Enforce one-user-one-MPIN binding across all users & devices
      const hasBoundUser = Boolean(
        row.bound_user_key || row.bound_user_mobile || row.bound_user_name
      );
      if (hasBoundUser) {
        const hasIncomingIdentity = Boolean(incomingKey || incomingMobile || incomingName);
        const keyMismatch = Boolean(
          row.bound_user_key && incomingKey && row.bound_user_key !== incomingKey
        );
        const mobileMismatch = Boolean(
          row.bound_user_mobile && incomingMobile && row.bound_user_mobile !== incomingMobile
        );
        const normalizedBoundName = row.bound_user_name
          ? row.bound_user_name.trim().replace(/\s+/g, ' ').toLowerCase()
          : '';
        const normalizedIncomingName = incomingName
          ? incomingName.trim().replace(/\s+/g, ' ').toLowerCase()
          : '';
        const nameMismatch = Boolean(
          normalizedBoundName &&
            normalizedIncomingName &&
            normalizedBoundName !== normalizedIncomingName
        );

        const allowReturningMpinOnly = !hasIncomingIdentity && row.status === 'Used';
        if ((!hasIncomingIdentity && !allowReturningMpinOnly) || keyMismatch || mobileMismatch || nameMismatch) {
          this.db
            .prepare('UPDATE mpins SET failed_attempts = failed_attempts + 1 WHERE mpin = ?')
            .run(cleanMpin);
          const updated = this.db
            .prepare('SELECT * FROM mpins WHERE mpin = ?')
            .get(cleanMpin) as unknown as SqliteMpinRow;
          this.logAttempt({
            mpin: cleanMpin,
            outcome: 'Failed',
            reason: `MPIN already linked to user ${row.bound_user_name || row.bound_user_mobile || row.bound_user_key} (attempted by ${incomingName || incomingMobile || 'another user'})`,
            deviceId,
            deviceType,
            loginIp,
            attemptedAt: nowIso,
          });
          this.db.exec('COMMIT');
          return {
            ok: false,
            statusCode: 403,
            error: 'This MPIN is already used and linked to another user. Each user must use their own MPIN.',
            record: mapMpinRow(updated),
          };
        }
      }

      const strictDeviceLock = Boolean(row.device_locked) || this.getEnforceDeviceLock();
      if (strictDeviceLock && row.device_id && row.device_id !== deviceId) {
        const nextFailures = Number(row.failed_attempts ?? 0) + 1;
        const shouldBlock = nextFailures >= MAX_FAILED_ATTEMPTS_BEFORE_BLOCK;
        this.db
          .prepare(
            `UPDATE mpins
             SET failed_attempts = ?,
                 status = CASE WHEN ? = 1 THEN 'Blocked' ELSE status END
             WHERE mpin = ?`
          )
          .run(nextFailures, shouldBlock ? 1 : 0, cleanMpin);

        const updated = this.db.prepare('SELECT * FROM mpins WHERE mpin = ?').get(cleanMpin) as unknown as SqliteMpinRow;
        this.logAttempt({
          mpin: cleanMpin,
          outcome: 'Failed',
          reason: shouldBlock
            ? `Device mismatch (auto-blocked after ${nextFailures} failed attempts)`
            : 'Device mismatch under single-device lock',
          deviceId,
          deviceType,
          loginIp,
          attemptedAt: nowIso,
        });
        this.db.exec('COMMIT');
        return {
          ok: false,
          statusCode: 403,
          error: shouldBlock
            ? 'MPIN auto-blocked due to repeated unauthorized device attempts.'
            : 'This MPIN is bound to another device. Access denied.',
          record: mapMpinRow(updated),
        };
      }

      // Valid login! Record telemetry, bind MPIN permanently to user name/mobile/key, and transition Active -> Used
      this.db
        .prepare(
          `UPDATE mpins
           SET first_login_at = COALESCE(first_login_at, ?),
               last_login_at = ?,
               total_login_count = total_login_count + 1,
               device_id = ?,
               device_type = ?,
               login_ip = ?,
               bound_user_name = COALESCE(bound_user_name, ?),
               bound_user_mobile = COALESCE(bound_user_mobile, ?),
               bound_user_key = COALESCE(bound_user_key, ?),
               status = 'Used'
           WHERE mpin = ?`
        )
        .run(
          nowIso,
          nowIso,
          deviceId,
          deviceType,
          loginIp,
          incomingName || null,
          incomingMobile || null,
          incomingKey || null,
          cleanMpin
        );

      const updated = this.db.prepare('SELECT * FROM mpins WHERE mpin = ?').get(cleanMpin) as unknown as SqliteMpinRow;
      this.logAttempt({
        mpin: cleanMpin,
        outcome: 'Success',
        reason: row.first_login_at
          ? `Subsequent login verified${incomingName ? ` (${incomingName})` : ''}`
          : `First login verified & linked${incomingName ? ` to ${incomingName}` : ''}`,
        deviceId,
        deviceType,
        loginIp,
        attemptedAt: nowIso,
      });
      this.db.exec('COMMIT');
      this.checkpointWal();

      return {
        ok: true,
        statusCode: 200,
        error: null,
        record: mapMpinRow(updated),
      };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  checkActiveMpinStatus(mpin: string, nowIso = new Date().toISOString()): {
    allowed: boolean;
    status: MpinStatus | 'Missing';
    reason: string | null;
  } {
    const clean = mpin.trim();
    if (!isValidSixDigitMpin(clean)) {
      return { allowed: false, status: 'Missing', reason: 'Invalid MPIN.' };
    }
    const row = this.db.prepare('SELECT status, expires_at FROM mpins WHERE mpin = ?').get(clean) as
      | { status: string; expires_at: string | null }
      | undefined;

    if (!row) {
      return { allowed: false, status: 'Missing', reason: 'MPIN not found in database.' };
    }
    if (row.status === 'Blocked') {
      return { allowed: false, status: 'Blocked', reason: 'MPIN has been blocked by Admin.' };
    }
    if (
      row.status === 'Expired' ||
      (row.expires_at && Date.parse(row.expires_at) <= Date.parse(nowIso))
    ) {
      if (row.status !== 'Expired') {
        this.db.prepare("UPDATE mpins SET status = 'Expired' WHERE mpin = ?").run(clean);
      }
      return { allowed: false, status: 'Expired', reason: 'MPIN has expired.' };
    }
    return { allowed: true, status: row.status as MpinStatus, reason: null };
  }

  getStats(): MpinDashboardStats {
    const agg = this.db
      .prepare(
        `SELECT
           COUNT(*) AS totalGenerated,
           SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS activeCount,
           SUM(CASE WHEN status = 'Used' THEN 1 ELSE 0 END) AS usedCount,
           SUM(CASE WHEN status = 'Blocked' THEN 1 ELSE 0 END) AS blockedCount,
           SUM(CASE WHEN status = 'Expired' THEN 1 ELSE 0 END) AS expiredCount,
           COALESCE(SUM(total_login_count), 0) AS totalSuccessfulLogins,
           COALESCE(SUM(failed_attempts), 0) AS totalFailedAttemptsOnMpins,
           MAX(generated_at) AS lastGeneratedAt
         FROM mpins`
      )
      .get() as Record<string, unknown>;

    const lastBatch = this.db
      .prepare('SELECT batch_id FROM mpins ORDER BY id DESC LIMIT 1')
      .get() as { batch_id?: string } | undefined;

    const auditFail = this.db
      .prepare("SELECT COUNT(*) AS cnt FROM login_audit_logs WHERE outcome = 'Failed'")
      .get() as { cnt?: number } | undefined;

    return {
      totalGenerated: Number(agg?.totalGenerated ?? 0),
      activeCount: Number(agg?.activeCount ?? 0),
      usedCount: Number(agg?.usedCount ?? 0),
      blockedCount: Number(agg?.blockedCount ?? 0),
      expiredCount: Number(agg?.expiredCount ?? 0),
      totalSuccessfulLogins: Number(agg?.totalSuccessfulLogins ?? 0),
      totalFailedAttemptsOnMpins: Number(agg?.totalFailedAttemptsOnMpins ?? 0),
      totalAuditFailures: Number(auditFail?.cnt ?? 0),
      enforceDeviceLock: this.getEnforceDeviceLock(),
      lastBatchId: lastBatch?.batch_id ?? null,
      lastGeneratedAt: agg?.lastGeneratedAt ? String(agg.lastGeneratedAt) : null,
    };
  }

  listMpins(params?: {
    q?: string;
    status?: string;
    deviceType?: string;
    serialFrom?: number;
    serialTo?: number;
    sortBy?: string;
    sortDir?: string;
    page?: number;
    limit?: number;
  }): {
    items: MpinRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } {
    const page = Math.max(1, Math.floor(Number(params?.page ?? 1) || 1));
    const limit = Math.min(200, Math.max(1, Math.floor(Number(params?.limit ?? 50) || 50)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const args: Array<string | number> = [];

    const q = (params?.q ?? '').trim();
    if (q) {
      const hashSerialMatch = /^#(\d+)$/.exec(q);
      if (hashSerialMatch) {
        conditions.push('id = ?');
        args.push(Number(hashSerialMatch[1]));
      } else if (/^\d+$/.test(q)) {
        const like = `%${q}%`;
        conditions.push(
          '(id = ? OR mpin LIKE ? OR COALESCE(bound_user_name, \'\') LIKE ? OR COALESCE(bound_user_mobile, \'\') LIKE ? OR COALESCE(device_id, \'\') LIKE ? OR COALESCE(login_ip, \'\') LIKE ? OR batch_id LIKE ?)'
        );
        args.push(Number(q), like, like, like, like, like, like);
      } else {
        const like = `%${q}%`;
        conditions.push(
          '(mpin LIKE ? OR COALESCE(bound_user_name, \'\') LIKE ? OR COALESCE(bound_user_mobile, \'\') LIKE ? OR COALESCE(device_id, \'\') LIKE ? OR COALESCE(login_ip, \'\') LIKE ? OR batch_id LIKE ?)'
        );
        args.push(like, like, like, like, like, like);
      }
    }

    if (
      params?.serialFrom !== undefined &&
      Number.isInteger(params.serialFrom) &&
      params.serialFrom > 0
    ) {
      conditions.push('id >= ?');
      args.push(params.serialFrom);
    }

    if (
      params?.serialTo !== undefined &&
      Number.isInteger(params.serialTo) &&
      params.serialTo > 0
    ) {
      conditions.push('id <= ?');
      args.push(params.serialTo);
    }

    const status = (params?.status ?? '').trim();
    if (status && ['Active', 'Used', 'Blocked', 'Expired'].includes(status)) {
      conditions.push('status = ?');
      args.push(status);
    }

    const deviceType = (params?.deviceType ?? '').trim();
    if (deviceType && ['Android', 'iOS'].includes(deviceType)) {
      conditions.push('device_type = ?');
      args.push(deviceType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Strict allowlist for ORDER BY column & direction
    const sortColumnMap: Record<string, string> = {
      id: 'id',
      mpin: 'mpin',
      generatedAt: 'generated_at',
      firstLoginAt: 'COALESCE(first_login_at, \'\')',
      lastLoginAt: 'COALESCE(last_login_at, \'\')',
      totalLoginCount: 'total_login_count',
      failedAttempts: 'failed_attempts',
      status: 'status',
    };
    const sortCol = sortColumnMap[params?.sortBy ?? ''] ?? 'id';
    const sortDir = params?.sortDir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const countRow = this.db
      .prepare(`SELECT COUNT(*) AS cnt FROM mpins ${whereClause}`)
      .get(...args) as { cnt?: number } | undefined;
    const total = Number(countRow?.cnt ?? 0);

    const rows = this.db
      .prepare(
        `SELECT * FROM mpins ${whereClause}
         ORDER BY ${sortCol} ${sortDir}, id ${sortDir}
         LIMIT ? OFFSET ?`
      )
      .all(...args, limit, offset) as unknown as SqliteMpinRow[];

    return {
      items: rows.map(mapMpinRow),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  getMpinDetail(mpin: string): {
    record: MpinRecord | null;
    logs: LoginAuditLogRecord[];
  } {
    const clean = mpin.trim();
    const row = this.db.prepare('SELECT * FROM mpins WHERE mpin = ?').get(clean) as
      | SqliteMpinRow
      | undefined;
    if (!row) {
      return { record: null, logs: [] };
    }
    const logRows = this.db
      .prepare('SELECT * FROM login_audit_logs WHERE mpin = ? ORDER BY id DESC LIMIT 25')
      .all(clean) as unknown as SqliteAuditRow[];
    return {
      record: mapMpinRow(row),
      logs: logRows.map(mapAuditRow),
    };
  }

  updateMpinControl(
    mpin: string,
    action: 'block' | 'activate' | 'expire' | 'reset-failures' | 'toggle-device-lock'
  ): MpinRecord | null {
    const clean = mpin.trim();
    const existing = this.db.prepare('SELECT * FROM mpins WHERE mpin = ?').get(clean) as
      | SqliteMpinRow
      | undefined;
    if (!existing) return null;

    if (action === 'block') {
      this.db.prepare("UPDATE mpins SET status = 'Blocked' WHERE mpin = ?").run(clean);
    } else if (action === 'expire') {
      this.db.prepare("UPDATE mpins SET status = 'Expired' WHERE mpin = ?").run(clean);
    } else if (action === 'activate') {
      const nextStatus: MpinStatus = Number(existing.total_login_count ?? 0) > 0 ? 'Used' : 'Active';
      this.db
        .prepare('UPDATE mpins SET status = ?, failed_attempts = 0 WHERE mpin = ?')
        .run(nextStatus, clean);
    } else if (action === 'reset-failures') {
      this.db.prepare('UPDATE mpins SET failed_attempts = 0 WHERE mpin = ?').run(clean);
    } else if (action === 'toggle-device-lock') {
      const nextLocked = existing.device_locked ? 0 : 1;
      this.db.prepare('UPDATE mpins SET device_locked = ? WHERE mpin = ?').run(nextLocked, clean);
    }

    const updated = this.db.prepare('SELECT * FROM mpins WHERE mpin = ?').get(clean) as unknown as SqliteMpinRow;
    return mapMpinRow(updated);
  }

  getAuditLogs(params?: {
    q?: string;
    outcome?: string;
    page?: number;
    limit?: number;
  }): {
    items: LoginAuditLogRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } {
    const page = Math.max(1, Math.floor(Number(params?.page ?? 1) || 1));
    const limit = Math.min(200, Math.max(1, Math.floor(Number(params?.limit ?? 50) || 50)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const args: Array<string | number> = [];

    const q = (params?.q ?? '').trim();
    if (q) {
      const like = `%${q}%`;
      conditions.push('(mpin LIKE ? OR reason LIKE ? OR COALESCE(device_id, \'\') LIKE ? OR COALESCE(login_ip, \'\') LIKE ?)');
      args.push(like, like, like, like);
    }

    const outcome = (params?.outcome ?? '').trim();
    if (outcome === 'Success' || outcome === 'Failed') {
      conditions.push('outcome = ?');
      args.push(outcome);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRow = this.db
      .prepare(`SELECT COUNT(*) AS cnt FROM login_audit_logs ${whereClause}`)
      .get(...args) as { cnt?: number } | undefined;
    const total = Number(countRow?.cnt ?? 0);

    const rows = this.db
      .prepare(
        `SELECT * FROM login_audit_logs ${whereClause}
         ORDER BY id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...args, limit, offset) as unknown as SqliteAuditRow[];

    return {
      items: rows.map(mapAuditRow),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  exportCsv(params?: { status?: string }): string {
    const status = (params?.status ?? '').trim();
    const hasStatus = status && ['Active', 'Used', 'Blocked', 'Expired'].includes(status);
    const stmt = hasStatus
      ? this.db.prepare('SELECT * FROM mpins WHERE status = ? ORDER BY id ASC')
      : this.db.prepare('SELECT * FROM mpins ORDER BY id ASC');

    const rows = (hasStatus ? stmt.all(status) : stmt.all()) as unknown as SqliteMpinRow[];
    const lines: string[] = [
      [
        'Serial No.',
        'MPIN',
        'Linked User Name',
        'Linked Mobile',
        'Generated Date',
        'First Successful Login',
        'Last Successful Login',
        'Total Login Count',
        'Device ID',
        'Device Type',
        'Login IP Address',
        'Current Status',
        'Failed Login Attempts',
        'Batch ID',
      ].join(','),
    ];

    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      lines.push(
        [
          sanitizeCsvCell(r.id),
          sanitizeCsvCell(r.mpin),
          sanitizeCsvCell(r.bound_user_name ?? ''),
          sanitizeCsvCell(r.bound_user_mobile ?? ''),
          sanitizeCsvCell(r.generated_at),
          sanitizeCsvCell(r.first_login_at ?? ''),
          sanitizeCsvCell(r.last_login_at ?? ''),
          sanitizeCsvCell(r.total_login_count),
          sanitizeCsvCell(r.device_id ?? ''),
          sanitizeCsvCell(r.device_type ?? ''),
          sanitizeCsvCell(r.login_ip ?? ''),
          sanitizeCsvCell(r.status),
          sanitizeCsvCell(r.failed_attempts),
          sanitizeCsvCell(r.batch_id),
        ].join(',')
      );
    }

    return lines.join('\n');
  }

  clearMpins(scope: ClearMpinScope = 'all'): {
    deletedMpins: number;
    deletedLogs: number;
  } {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      let deletedMpins = 0;
      let deletedLogs = 0;

      if (scope === 'all') {
        const mpinCountRow = this.db
          .prepare('SELECT COUNT(*) AS cnt FROM mpins')
          .get() as { cnt?: number } | undefined;
        const logCountRow = this.db
          .prepare('SELECT COUNT(*) AS cnt FROM login_audit_logs')
          .get() as { cnt?: number } | undefined;
        deletedMpins = Number(mpinCountRow?.cnt ?? 0);
        deletedLogs = Number(logCountRow?.cnt ?? 0);

        this.db.exec('DELETE FROM mpins; DELETE FROM login_audit_logs;');
        try {
          this.db.exec(
            "DELETE FROM sqlite_sequence WHERE name IN ('mpins', 'login_audit_logs');"
          );
        } catch {
          // sqlite_sequence optional
        }
      } else {
        const statusList =
          scope === 'used-blocked-expired'
            ? ["'Used'", "'Blocked'", "'Expired'"]
            : scope === 'blocked'
              ? ["'Blocked'"]
              : ["'Used'"];
        const whereSql = `status IN (${statusList.join(', ')})`;

        const mpinCountRow = this.db
          .prepare(`SELECT COUNT(*) AS cnt FROM mpins WHERE ${whereSql}`)
          .get() as { cnt?: number } | undefined;
        deletedMpins = Number(mpinCountRow?.cnt ?? 0);

        const logCountRow = this.db
          .prepare(
            `SELECT COUNT(*) AS cnt FROM login_audit_logs WHERE mpin IN (SELECT mpin FROM mpins WHERE ${whereSql})`
          )
          .get() as { cnt?: number } | undefined;
        deletedLogs = Number(logCountRow?.cnt ?? 0);

        this.db.exec(
          `DELETE FROM login_audit_logs WHERE mpin IN (SELECT mpin FROM mpins WHERE ${whereSql});
           DELETE FROM mpins WHERE ${whereSql};`
        );
      }

      this.db.exec('COMMIT');
      this.checkpointWal();
      return { deletedMpins, deletedLogs };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  getUserAccount(userKey: string): StoredUserAccountRecord | null {
    const cleanKey = userKey.trim().toLowerCase();
    if (!cleanKey) return null;
    const row = this.db
      .prepare('SELECT * FROM user_accounts WHERE user_key = ?')
      .get(cleanKey) as
      | {
          user_key: string;
          user_name: string;
          user_mobile: string;
          mpin: string | null;
          snapshot_json: string;
          updated_at: string;
        }
      | undefined;
    if (!row) return null;
    let parsedSnapshot: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(row.snapshot_json) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        parsedSnapshot = parsed as Record<string, unknown>;
      }
    } catch {
      parsedSnapshot = null;
    }
    return {
      userKey: String(row.user_key),
      userName: String(row.user_name),
      userMobile: String(row.user_mobile),
      mpin: row.mpin ? String(row.mpin) : null,
      snapshot: parsedSnapshot,
      updatedAt: String(row.updated_at),
    };
  }

  saveUserSnapshot(params: {
    userKey: string;
    userName: string;
    userMobile: string;
    mpin?: string | null;
    snapshot: Record<string, unknown>;
    nowIso?: string;
  }): { updatedAt: string } {
    const cleanKey = params.userKey.trim().toLowerCase();
    if (!cleanKey) {
      throw new Error('User key is required.');
    }
    const cleanName = params.userName.trim() || 'RailOne User';
    const cleanMobile = params.userMobile.replace(/\D/g, '');
    const cleanMpin = params.mpin && isValidMpinFormat(params.mpin) ? params.mpin.trim() : null;
    const updatedAt = params.nowIso ?? new Date().toISOString();
    const snapshotJson = JSON.stringify(params.snapshot);

    this.db
      .prepare(
        `INSERT INTO user_accounts (user_key, user_name, user_mobile, mpin, snapshot_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_key) DO UPDATE SET
           user_name = excluded.user_name,
           user_mobile = excluded.user_mobile,
           mpin = COALESCE(excluded.mpin, user_accounts.mpin),
           snapshot_json = excluded.snapshot_json,
           updated_at = excluded.updated_at`
      )
      .run(cleanKey, cleanName, cleanMobile, cleanMpin, snapshotJson, updatedAt);

    this.checkpointWal();
    return { updatedAt };
  }

  resumeVerifiedUserSession(params: {
    mpin: string;
    userKey: string;
    userName?: string;
    userMobile?: string;
    nowIso?: string;
  }): VerifyUserMpinResult {
    const cleanMpin = params.mpin.trim();
    const cleanKey = params.userKey.trim().toLowerCase();
    const cleanName = (params.userName ?? '').trim();
    const cleanMobile = (params.userMobile ?? '').replace(/\D/g, '');
    const nowIso = params.nowIso ?? new Date().toISOString();

    if (!isValidMpinFormat(cleanMpin) || !cleanKey) {
      return { ok: false, statusCode: 400, error: 'Invalid session credentials.', record: null };
    }

    const row = this.db.prepare('SELECT * FROM mpins WHERE mpin = ?').get(cleanMpin) as
      | SqliteMpinRow
      | undefined;

    if (!row) {
      return { ok: false, statusCode: 403, error: 'MPIN not found in database.', record: null };
    }
    if (row.status === 'Blocked') {
      return { ok: false, statusCode: 403, error: 'MPIN has been blocked by Admin.', record: mapMpinRow(row) };
    }
    if (row.status === 'Expired' || (row.expires_at && Date.parse(row.expires_at) <= Date.parse(nowIso))) {
      return { ok: false, statusCode: 403, error: 'MPIN has expired.', record: mapMpinRow(row) };
    }

    const ownerKey = (row.bound_user_key ?? '').trim().toLowerCase();
    const ownerMobile = (row.bound_user_mobile ?? '').trim();
    const ownerName = (row.bound_user_name ?? '').trim().toLowerCase();
    const keyMismatch = Boolean(ownerKey && ownerKey !== cleanKey);
    const mobileMismatch = Boolean(ownerMobile && cleanMobile && ownerMobile !== cleanMobile);
    const nameMismatch = Boolean(ownerName && cleanName && ownerName !== cleanName.toLowerCase());

    if (keyMismatch || mobileMismatch || nameMismatch) {
      return {
        ok: false,
        statusCode: 403,
        error: 'MPIN belongs to another user.',
        record: mapMpinRow(row),
      };
    }

    return { ok: true, statusCode: 200, error: null, record: mapMpinRow(row) };
  }

  importCloudMpins(
    items: Array<{
      mpin: string;
      batchId?: string;
      generatedAt?: string;
      expiresAt?: string | null;
      firstLoginAt?: string | null;
      lastLoginAt?: string | null;
      totalLoginCount?: number;
      deviceId?: string | null;
      deviceType?: string | null;
      loginIp?: string | null;
      status?: string;
      failedAttempts?: number;
      deviceLocked?: boolean;
      boundUserName?: string | null;
      boundUserMobile?: string | null;
      boundUserKey?: string | null;
    }>
  ): { importedCount: number; updatedCount: number } {
    if (!Array.isArray(items) || items.length === 0) {
      return { importedCount: 0, updatedCount: 0 };
    }

    const nowIso = new Date().toISOString();
    const existingRows = this.db
      .prepare('SELECT mpin, status, bound_user_key, total_login_count FROM mpins')
      .all() as Array<{
      mpin: string;
      status: string;
      bound_user_key: string | null;
      total_login_count: number;
    }>;
    const existingMap = new Map(existingRows.map((r) => [r.mpin, r]));

    const upsertStmt = this.db.prepare(`
      INSERT INTO mpins (
        mpin, batch_id, generated_at, expires_at, first_login_at, last_login_at,
        total_login_count, device_id, device_type, login_ip, status, failed_attempts,
        device_locked, bound_user_name, bound_user_mobile, bound_user_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(mpin) DO UPDATE SET
        expires_at = COALESCE(excluded.expires_at, mpins.expires_at),
        first_login_at = COALESCE(mpins.first_login_at, excluded.first_login_at),
        last_login_at = COALESCE(excluded.last_login_at, mpins.last_login_at),
        total_login_count = MAX(mpins.total_login_count, excluded.total_login_count),
        device_id = COALESCE(mpins.device_id, excluded.device_id),
        device_type = COALESCE(mpins.device_type, excluded.device_type),
        status = CASE
          WHEN mpins.status = 'Used' AND excluded.status = 'Active' THEN mpins.status
          ELSE excluded.status
        END,
        failed_attempts = MAX(mpins.failed_attempts, excluded.failed_attempts),
        bound_user_name = COALESCE(mpins.bound_user_name, excluded.bound_user_name),
        bound_user_mobile = COALESCE(mpins.bound_user_mobile, excluded.bound_user_mobile),
        bound_user_key = COALESCE(mpins.bound_user_key, excluded.bound_user_key)
    `);

    let importedCount = 0;
    let updatedCount = 0;

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const raw of items) {
        const cleanMpin = typeof raw.mpin === 'string' ? raw.mpin.trim() : '';
        if (!isValidMpinFormat(cleanMpin)) continue;

        const cleanStatus: MpinStatus =
          raw.status === 'Used' ||
          raw.status === 'Blocked' ||
          raw.status === 'Expired' ||
          raw.status === 'Active'
            ? raw.status
            : 'Active';
        const batchId =
          typeof raw.batchId === 'string' && raw.batchId.trim()
            ? raw.batchId.trim().slice(0, 64)
            : 'CLOUD-SYNC';
        const generatedAt =
          typeof raw.generatedAt === 'string' && raw.generatedAt.trim()
            ? raw.generatedAt.trim().slice(0, 40)
            : nowIso;
        const expiresAt =
          typeof raw.expiresAt === 'string' && raw.expiresAt.trim()
            ? raw.expiresAt.trim().slice(0, 40)
            : null;
        const firstLoginAt =
          typeof raw.firstLoginAt === 'string' && raw.firstLoginAt.trim()
            ? raw.firstLoginAt.trim().slice(0, 40)
            : null;
        const lastLoginAt =
          typeof raw.lastLoginAt === 'string' && raw.lastLoginAt.trim()
            ? raw.lastLoginAt.trim().slice(0, 40)
            : null;
        const totalLoginCount = Math.max(0, Math.floor(Number(raw.totalLoginCount || 0) || 0));
        const deviceId =
          typeof raw.deviceId === 'string' && raw.deviceId.trim()
            ? raw.deviceId.trim().slice(0, 128)
            : null;
        const deviceType: DeviceType | null =
          raw.deviceType === 'iOS' || raw.deviceType === 'Android' ? raw.deviceType : null;
        const loginIp =
          typeof raw.loginIp === 'string' && raw.loginIp.trim()
            ? raw.loginIp.trim().slice(0, 64)
            : 'Firebase Firestore';
        const failedAttempts = Math.max(0, Math.floor(Number(raw.failedAttempts || 0) || 0));
        const deviceLocked = raw.deviceLocked ? 1 : 0;
        const boundUserName =
          typeof raw.boundUserName === 'string' && raw.boundUserName.trim()
            ? raw.boundUserName.trim().slice(0, 100)
            : null;
        const boundUserMobile =
          typeof raw.boundUserMobile === 'string' && raw.boundUserMobile.trim()
            ? raw.boundUserMobile.replace(/\D/g, '').slice(0, 15) || null
            : null;
        const boundUserKey =
          typeof raw.boundUserKey === 'string' && raw.boundUserKey.trim()
            ? raw.boundUserKey.trim().toLowerCase().slice(0, 80)
            : null;

        const prev = existingMap.get(cleanMpin);
        upsertStmt.run(
          cleanMpin,
          batchId,
          generatedAt,
          expiresAt,
          firstLoginAt,
          lastLoginAt,
          totalLoginCount,
          deviceId,
          deviceType,
          loginIp,
          cleanStatus,
          failedAttempts,
          deviceLocked,
          boundUserName,
          boundUserMobile,
          boundUserKey
        );

        if (!prev) {
          importedCount += 1;
        } else if (
          (!prev.bound_user_key && boundUserKey) ||
          prev.status !== cleanStatus ||
          totalLoginCount > prev.total_login_count
        ) {
          updatedCount += 1;
        }
      }
      this.db.exec('COMMIT');
      this.checkpointWal();
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return { importedCount, updatedCount };
  }
}
