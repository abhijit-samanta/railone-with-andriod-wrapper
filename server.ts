import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  MpinDatabase,
  ONE_LAKH,
  isValidSixDigitMpin,
  normalizeDeviceId,
  normalizeDeviceType,
  signAuthToken,
  verifyAuthToken,
} from './server/mpinCore.ts';
import type { ClearMpinScope } from './server/mpinCore.ts';

const PORT = Number(process.env.PORT || 3000);
const SESSION_SIGNING_SECRET =
  process.env.SESSION_SIGNING_SECRET || crypto.randomBytes(32).toString('hex');

const dbPath = process.env.MPIN_DB_PATH
  ? path.resolve(process.env.MPIN_DB_PATH)
  : path.resolve(process.cwd(), '.data', 'railone_mpin.db');
const mpinDb = new MpinDatabase(dbPath);

function getEnvAdminMpin(): string {
  return (process.env.ADMIN_MPIN ?? '').trim();
}

function extractClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  let raw = '';
  if (typeof xff === 'string' && xff.trim()) {
    raw = xff.split(',')[0].trim();
  } else if (Array.isArray(xff) && xff.length > 0) {
    raw = String(xff[0]).split(',')[0].trim();
  } else {
    raw = req.ip || req.socket.remoteAddress || '127.0.0.1';
  }
  return raw.replace(/^::ffff:/, '').slice(0, 64) || '127.0.0.1';
}

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || typeof auth !== 'string') return null;
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: 'Admin authentication required.' });
    return;
  }
  const verified = verifyAuthToken(token, SESSION_SIGNING_SECRET, 'admin');
  if (!verified) {
    res.status(401).json({ ok: false, error: 'Admin session expired or invalid. Please sign in again.' });
    return;
  }
  next();
}

interface UserAuthRequest extends Request {
  authUserKey?: string;
}

function requireUserAuth(req: UserAuthRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: 'User authentication required.' });
    return;
  }
  const verified = verifyAuthToken(token, SESSION_SIGNING_SECRET, 'user');
  if (!verified || !verified.sub) {
    res.status(401).json({ ok: false, error: 'User session expired or invalid.' });
    return;
  }
  req.authUserKey = verified.sub;
  next();
}

function resolveCanonicalUserKey(userKey: string, userMobile: string, fallbackMpin: string): string {
  const cleanKey = userKey.trim().toLowerCase();
  if (cleanKey && cleanKey !== 'pending_user' && cleanKey !== 'default_user') {
    return cleanKey;
  }
  if (/^\d{10}$/.test(userMobile)) {
    return `user_${userMobile}`;
  }
  return `mpin_${fallbackMpin}`;
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (
      origin &&
      (origin === 'capacitor://localhost' ||
        origin === 'ionic://localhost' ||
        origin === 'https://localhost' ||
        origin === 'http://localhost' ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin))
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // =========================================================================
  // Public Mobile App MPIN Verification Endpoints
  // =========================================================================

  app.post('/api/mpin/verify', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const mpin = typeof body.mpin === 'string' ? body.mpin : '';
    const userName = typeof body.userName === 'string' ? body.userName.trim() : '';
    const userMobile = typeof body.userMobile === 'string' ? body.userMobile.replace(/\D/g, '') : '';
    const rawUserKey = typeof body.userKey === 'string' ? body.userKey.trim() : '';
    const userKey =
      rawUserKey.toLowerCase() === 'pending_user' || rawUserKey.toLowerCase() === 'default_user'
        ? ''
        : rawUserKey;
    const deviceId = normalizeDeviceId(body.deviceId);
    const deviceType = normalizeDeviceType(body.deviceType);
    const loginIp = extractClientIp(req);

    if (!userName) {
      const existingDetail = mpinDb.getMpinDetail(mpin);
      const rec = existingDetail.record;
      const isAlreadyBoundUser = Boolean(
        rec && (rec.boundUserKey || rec.boundUserName || rec.boundUserMobile)
      );
      if (!rec) {
        res.status(401).json({
          ok: false,
          error: 'Invalid or unregistered MPIN. Please enter an Admin-issued 6-character MPIN.',
        });
        return;
      }
      if (!isAlreadyBoundUser) {
        res.status(400).json({
          ok: false,
          error: 'New user MPIN requires your Full Name and 10-digit Mobile Number first. Click "Different User?" to enter them.',
        });
        return;
      }
    }

    const result = mpinDb.verifyUserMpin({
      mpin,
      deviceId,
      deviceType,
      loginIp,
      userName,
      userMobile,
      userKey,
    });

    if (!result.ok || !result.record) {
      res.status(result.statusCode).json({
        ok: false,
        error: result.error || 'MPIN verification failed.',
      });
      return;
    }

    const canonicalUserKey = resolveCanonicalUserKey(
      result.record.boundUserKey || userKey,
      result.record.boundUserMobile || userMobile,
      result.record.mpin
    );

    const userToken = signAuthToken(
      { sub: canonicalUserKey, role: 'user' },
      SESSION_SIGNING_SECRET,
      60 * 60 * 24 * 30
    );

    const storedAccount = mpinDb.getUserAccount(canonicalUserKey);

    res.json({
      ok: true,
      error: null,
      userToken,
      userKey: canonicalUserKey,
      record: result.record,
      serverSnapshot: storedAccount?.snapshot ?? null,
      serverUpdatedAt: storedAccount?.updatedAt ?? null,
    });
  });

  app.post('/api/user/session', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const mpin = typeof body.mpin === 'string' ? body.mpin : '';
    const userName = typeof body.userName === 'string' ? body.userName.trim() : '';
    const userMobile = typeof body.userMobile === 'string' ? body.userMobile.replace(/\D/g, '') : '';
    const userKey = typeof body.userKey === 'string' ? body.userKey.trim() : '';

    const canonicalUserKey = resolveCanonicalUserKey(userKey, userMobile, mpin.trim());
    const resumed = mpinDb.resumeVerifiedUserSession({
      mpin,
      userKey: canonicalUserKey,
      userName,
      userMobile,
    });

    if (!resumed.ok || !resumed.record) {
      res.status(resumed.statusCode).json({
        ok: false,
        error: resumed.error || 'Session verification failed.',
      });
      return;
    }

    const userToken = signAuthToken(
      { sub: canonicalUserKey, role: 'user' },
      SESSION_SIGNING_SECRET,
      60 * 60 * 24 * 30
    );
    const storedAccount = mpinDb.getUserAccount(canonicalUserKey);

    res.json({
      ok: true,
      userToken,
      userKey: canonicalUserKey,
      serverSnapshot: storedAccount?.snapshot ?? null,
      serverUpdatedAt: storedAccount?.updatedAt ?? null,
    });
  });

  app.get('/api/user/snapshot', requireUserAuth, (req: UserAuthRequest, res: Response) => {
    const account = mpinDb.getUserAccount(req.authUserKey ?? '');
    res.json({
      ok: true,
      account,
    });
  });

  app.put('/api/user/snapshot', requireUserAuth, (req: UserAuthRequest, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const snapshot = body.snapshot;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      res.status(400).json({ ok: false, error: 'Valid user snapshot object is required.' });
      return;
    }
    const snapObj = snapshot as Record<string, unknown>;
    const profileObj = snapObj.profile;
    if (!profileObj || typeof profileObj !== 'object' || Array.isArray(profileObj)) {
      res.status(400).json({ ok: false, error: 'Snapshot profile is required.' });
      return;
    }
    const p = profileObj as Record<string, unknown>;
    const userName = typeof p.name === 'string' ? p.name.trim() : '';
    const userMobile = typeof p.mobile === 'string' ? p.mobile.replace(/\D/g, '') : '';
    const mpin = typeof body.mpin === 'string' ? body.mpin.trim() : null;

    const saved = mpinDb.saveUserSnapshot({
      userKey: req.authUserKey ?? '',
      userName,
      userMobile,
      mpin,
      snapshot: snapObj,
    });

    res.json({
      ok: true,
      updatedAt: saved.updatedAt,
    });
  });

  app.post('/api/mpin/check-status', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const mpin = typeof body.mpin === 'string' ? body.mpin : '';
    const status = mpinDb.checkActiveMpinStatus(mpin);
    if (!status.allowed) {
      res.status(403).json({
        ok: false,
        allowed: false,
        status: status.status,
        error: status.reason || 'MPIN access disabled.',
      });
      return;
    }
    res.json({
      ok: true,
      allowed: true,
      status: status.status,
      error: null,
    });
  });

  // =========================================================================
  // Admin MPIN Authentication Routes
  // =========================================================================

  app.get('/api/admin/auth/status', (_req: Request, res: Response) => {
    const mode = mpinDb.getAdminAuthMode(getEnvAdminMpin());
    res.json({
      mode,
      configured: mode !== 'setup-required',
    });
  });

  app.post('/api/admin/auth/setup', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const mpin = typeof body.mpin === 'string' ? body.mpin : '';
    const confirmMpin = typeof body.confirmMpin === 'string' ? body.confirmMpin : '';

    if (!isValidSixDigitMpin(mpin)) {
      res.status(400).json({
        ok: false,
        error: 'Admin MPIN must be 6 characters (digits, uppercase & lowercase letters).',
      });
      return;
    }
    if (mpin.trim() !== confirmMpin.trim()) {
      res.status(400).json({ ok: false, error: 'Admin MPIN and confirmation do not match.' });
      return;
    }

    const claimed = mpinDb.claimFirstRunAdminMpin(mpin, getEnvAdminMpin());
    if (!claimed.ok) {
      res.status(409).json({ ok: false, error: claimed.error });
      return;
    }

    const token = signAuthToken({ sub: 'admin', role: 'admin' }, SESSION_SIGNING_SECRET);
    res.json({
      ok: true,
      mode: 'claimed',
      token,
    });
  });

  app.post('/api/admin/auth/login', (req: Request, res: Response) => {
    const envPin = getEnvAdminMpin();
    const mode = mpinDb.getAdminAuthMode(envPin);
    if (mode === 'setup-required') {
      res.status(400).json({
        ok: false,
        error: 'Admin MPIN has not been configured yet. Complete first-run setup first.',
      });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const mpin = typeof body.mpin === 'string' ? body.mpin : '';
    if (!mpinDb.verifyAdminPasscode(mpin, envPin)) {
      res.status(401).json({ ok: false, error: 'Incorrect Admin MPIN.' });
      return;
    }

    const token = signAuthToken({ sub: 'admin', role: 'admin' }, SESSION_SIGNING_SECRET);
    res.json({
      ok: true,
      mode,
      token,
    });
  });

  // =========================================================================
  // Protected Admin Panel Endpoints
  // =========================================================================

  app.get('/api/admin/stats', requireAdminAuth, (_req: Request, res: Response) => {
    const stats = mpinDb.getStats();
    const mode = mpinDb.getAdminAuthMode(getEnvAdminMpin());
    res.json({
      ok: true,
      adminAuthMode: mode,
      stats,
    });
  });

  app.post('/api/admin/mpins/generate', requireAdminAuth, (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawCount = body.count !== undefined ? Number(body.count) : ONE_LAKH;
    const count = Number.isInteger(rawCount) ? rawCount : ONE_LAKH;
    const expiryDays =
      body.expiryDays !== undefined && body.expiryDays !== null && body.expiryDays !== ''
        ? Number(body.expiryDays)
        : null;

    if (count < 1 || count > ONE_LAKH) {
      res.status(400).json({
        ok: false,
        error: `Generation batch size must be between 1 and ${ONE_LAKH}.`,
      });
      return;
    }

    try {
      const result = mpinDb.generateBatch(count, { expiryDays });
      const stats = mpinDb.getStats();
      res.json({
        ok: true,
        ...result,
        stats,
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to generate MPIN batch.',
      });
    }
  });

  app.post('/api/admin/mpins/clear', requireAdminAuth, (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawScope = typeof body.scope === 'string' ? body.scope.trim() : 'all';
    if (
      rawScope !== 'all' &&
      rawScope !== 'used-blocked-expired' &&
      rawScope !== 'blocked' &&
      rawScope !== 'used'
    ) {
      res.status(400).json({
        ok: false,
        error: 'Invalid clear scope. Must be all, used-blocked-expired, blocked, or used.',
      });
      return;
    }

    const scope: ClearMpinScope = rawScope;
    const cleared = mpinDb.clearMpins(scope);
    const stats = mpinDb.getStats();
    res.json({
      ok: true,
      scope,
      ...cleared,
      stats,
    });
  });

  app.post('/api/admin/mpins/import', requireAdminAuth, (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const items = body.items;
    if (!Array.isArray(items)) {
      res.status(400).json({ ok: false, error: 'items array is required.' });
      return;
    }
    if (items.length > 5000) {
      res.status(400).json({ ok: false, error: 'Import batch cannot exceed 5,000 MPINs per request.' });
      return;
    }
    const result = mpinDb.importCloudMpins(
      items as Parameters<typeof mpinDb.importCloudMpins>[0]
    );
    const stats = mpinDb.getStats();
    res.json({
      ok: true,
      ...result,
      stats,
    });
  });

  app.get('/api/admin/mpins', requireAdminAuth, (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const deviceType = typeof req.query.deviceType === 'string' ? req.query.deviceType : undefined;
    const rawSerialFrom = typeof req.query.serialFrom === 'string' ? Number(req.query.serialFrom) : undefined;
    const rawSerialTo = typeof req.query.serialTo === 'string' ? Number(req.query.serialTo) : undefined;
    const serialFrom = rawSerialFrom !== undefined && Number.isInteger(rawSerialFrom) && rawSerialFrom > 0 ? rawSerialFrom : undefined;
    const serialTo = rawSerialTo !== undefined && Number.isInteger(rawSerialTo) && rawSerialTo > 0 ? rawSerialTo : undefined;
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined;
    const sortDir = typeof req.query.sortDir === 'string' ? req.query.sortDir : undefined;
    const page = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50;

    const data = mpinDb.listMpins({
      q,
      status,
      deviceType,
      serialFrom,
      serialTo,
      sortBy,
      sortDir,
      page,
      limit,
    });
    res.json({ ok: true, ...data });
  });

  app.get('/api/admin/mpins/export', requireAdminAuth, (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const csv = mpinDb.exportCsv({ status });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="railone-mpins-export.csv"');
    res.send(csv);
  });

  app.get('/api/admin/mpins/:mpin', requireAdminAuth, (req: Request, res: Response) => {
    const detail = mpinDb.getMpinDetail(String(req.params.mpin ?? ''));
    if (!detail.record) {
      res.status(404).json({ ok: false, error: 'MPIN not found.' });
      return;
    }
    res.json({ ok: true, ...detail });
  });

  app.patch('/api/admin/mpins/:mpin', requireAdminAuth, (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = body.action;
    if (
      action !== 'block' &&
      action !== 'activate' &&
      action !== 'expire' &&
      action !== 'reset-failures' &&
      action !== 'toggle-device-lock'
    ) {
      res.status(400).json({ ok: false, error: 'Invalid control action.' });
      return;
    }

    const updated = mpinDb.updateMpinControl(String(req.params.mpin ?? ''), action);
    if (!updated) {
      res.status(404).json({ ok: false, error: 'MPIN not found.' });
      return;
    }

    res.json({
      ok: true,
      record: updated,
      stats: mpinDb.getStats(),
    });
  });

  app.get('/api/admin/logs', requireAdminAuth, (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const outcome = typeof req.query.outcome === 'string' ? req.query.outcome : undefined;
    const page = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50;

    const data = mpinDb.getAuditLogs({ q, outcome, page, limit });
    res.json({ ok: true, ...data });
  });

  app.post('/api/admin/settings', requireAdminAuth, (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.enforceDeviceLock === 'boolean') {
      mpinDb.setEnforceDeviceLock(body.enforceDeviceLock);
    }
    res.json({ ok: true, stats: mpinDb.getStats() });
  });

  app.post('/api/admin/auth/change', requireAdminAuth, (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const currentMpin = typeof body.currentMpin === 'string' ? body.currentMpin : '';
    const newMpin = typeof body.newMpin === 'string' ? body.newMpin : '';
    const result = mpinDb.changeClaimedAdminMpin(currentMpin, newMpin, getEnvAdminMpin());
    if (!result.ok) {
      res.status(400).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  // =========================================================================
  // Frontend Mounting (Vite Dev Middleware or Static Production Build)
  // =========================================================================

  const httpServer = http.createServer(app);
  const distDir = path.resolve(process.cwd(), 'dist');
  const hasDistBuild = fs.existsSync(path.join(distDir, 'index.html'));
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && hasDistBuild) {
    app.use(express.static(distDir));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: process.env.DISABLE_HMR === 'true' ? true : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const HOST = process.env.HOST || '0.0.0.0';
  httpServer.listen(PORT, HOST, () => {
    console.log(`RailOne server running at http://localhost:${PORT}`);
    console.log(`Network / LAN bind: http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`);
  });
}

void startServer();
