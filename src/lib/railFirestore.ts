import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  db,
  firebaseConfig,
  handleFirestoreError,
  OperationType,
} from './firebase';
import type {
  BookingRecord,
  FeedbackEntry,
  RailMadadComplaint,
  SavedPassenger,
  UserProfile,
  WalletTransaction,
} from '../types/rail';
import type { UserDataSnapshot } from '../utils/railLogic';
import type {
  AdminAuditLog,
  AdminMpinRecord,
  AdminMpinStatus,
  AdminStats,
} from '../components/AdminPanelView';

const ADMIN_BOOTSTRAP_EMAIL = 'indsamantaabhijit3691@gmail.com';
const UPPER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER_CHARS = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT_CHARS = '23456789';
const ALL_MPIN_CHARS = UPPER_CHARS + LOWER_CHARS + DIGIT_CHARS;

export function sanitizeFirestoreId(raw: string, fallback = 'default_user'): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return cleaned || fallback;
}

export function sanitizeForFirestore<T>(input: T): T {
  if (input === null || input === undefined) {
    return null as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = sanitizeForFirestore(v);
      }
    }
    return out as T;
  }
  return input;
}

function timestampToIso(value: unknown, fallback = ''): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return fallback;
}

function formatFirestoreQuotaMessage(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Free daily read units per project")) {
    return `Quota exceeded for daily Firestore reads (resets tomorrow). Manage database: https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
  }
  if (msg.includes('Quota exceeded') || msg.includes('resource-exhausted')) {
    return 'Firestore daily quota exceeded on the free Spark tier. Quota resets automatically tomorrow.';
  }
  return null;
}

function isPermissionDeniedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes('permission-denied') || msg.includes('missing or insufficient permissions');
}

function randomFromAlphabet(alphabet: string): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return alphabet[buf[0] % alphabet.length];
}

function generateAlphanumericMpin(): string {
  const chars = [
    randomFromAlphabet(DIGIT_CHARS),
    randomFromAlphabet(UPPER_CHARS),
    randomFromAlphabet(LOWER_CHARS),
    randomFromAlphabet(ALL_MPIN_CHARS),
    randomFromAlphabet(ALL_MPIN_CHARS),
    randomFromAlphabet(ALL_MPIN_CHARS),
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function makeLogId(prefix = 'log'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.slice(0, 64);
}

// ============================================================================
// User Root & Account Snapshot Operations
// ============================================================================

export async function ensureUserRoot(user: User, activeAccountKey: string): Promise<void> {
  const userPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const safeKey = sanitizeFirestoreId(activeAccountKey);

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: (user.email || `${user.uid}@railone.user`).slice(0, 160),
        displayName: (user.displayName || 'RailOne User').slice(0, 100),
        activeAccountKey: safeKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        email: (user.email || existingSnap.data().email || `${user.uid}@railone.user`).slice(0, 160),
        displayName: (user.displayName || existingSnap.data().displayName || 'RailOne User').slice(0, 100),
        activeAccountKey: safeKey,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }
}

export interface FirestoreUserAccountRecord {
  accountKey: string;
  mpin: string;
  snapshot: UserDataSnapshot;
  updatedAt: string;
}

export async function loadAllUserAccountsFromFirestore(
  user: User
): Promise<FirestoreUserAccountRecord[]> {
  const path = `users/${user.uid}/accounts`;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'users', user.uid, 'accounts'),
        where('ownerUid', '==', user.uid)
      )
    );
    return snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        accountKey: String(data.accountKey || docSnap.id),
        mpin: typeof data.mpin === 'string' ? data.mpin : '',
        snapshot: {
          profile: data.profile as UserProfile,
          bookings: Array.isArray(data.bookings) ? (data.bookings as BookingRecord[]) : [],
          savedPassengers: Array.isArray(data.savedPassengers)
            ? (data.savedPassengers as SavedPassenger[])
            : [],
          walletTransactions: Array.isArray(data.walletTransactions)
            ? (data.walletTransactions as WalletTransaction[])
            : [],
          complaints: Array.isArray(data.complaints)
            ? (data.complaints as RailMadadComplaint[])
            : [],
          feedbacks: Array.isArray(data.feedbacks) ? (data.feedbacks as FeedbackEntry[]) : [],
        },
        updatedAt: timestampToIso(data.updatedAt),
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function loadUserAccountFromFirestore(
  user: User,
  accountKey: string
): Promise<FirestoreUserAccountRecord | null> {
  const safeKey = sanitizeFirestoreId(accountKey);
  const path = `users/${user.uid}/accounts/${safeKey}`;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid, 'accounts', safeKey));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      accountKey: safeKey,
      mpin: typeof data.mpin === 'string' ? data.mpin : '',
      snapshot: {
        profile: data.profile as UserProfile,
        bookings: Array.isArray(data.bookings) ? (data.bookings as BookingRecord[]) : [],
        savedPassengers: Array.isArray(data.savedPassengers)
          ? (data.savedPassengers as SavedPassenger[])
          : [],
        walletTransactions: Array.isArray(data.walletTransactions)
          ? (data.walletTransactions as WalletTransaction[])
          : [],
        complaints: Array.isArray(data.complaints)
          ? (data.complaints as RailMadadComplaint[])
          : [],
        feedbacks: Array.isArray(data.feedbacks) ? (data.feedbacks as FeedbackEntry[]) : [],
      },
      updatedAt: timestampToIso(data.updatedAt),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function saveUserAccountToFirestore(
  user: User,
  accountKey: string,
  mpin: string,
  snapshot: UserDataSnapshot
): Promise<void> {
  const safeKey = sanitizeFirestoreId(accountKey);
  await ensureUserRoot(user, safeKey);

  const accountPath = `users/${user.uid}/accounts/${safeKey}`;
  const ref = doc(db, 'users', user.uid, 'accounts', safeKey);
  const cleanBalance = Math.max(
    0,
    Math.min(1_000_000, Number(snapshot.profile.rWalletBalance) || 0)
  );
  const cleanProfile = sanitizeForFirestore({
    ...snapshot.profile,
    name: (snapshot.profile.name || '').slice(0, 100),
    userId: safeKey,
    mobile: (snapshot.profile.mobile || '').replace(/\D/g, '').slice(0, 15),
    rWalletBalance: cleanBalance,
    mpinSet: Boolean(snapshot.profile.mpinSet),
    isGuest: Boolean(snapshot.profile.isGuest),
  });

  const cleanBookings = sanitizeForFirestore(snapshot.bookings.slice(0, 200));
  const cleanPassengers = sanitizeForFirestore(snapshot.savedPassengers.slice(0, 100));
  const cleanWalletTx = sanitizeForFirestore(snapshot.walletTransactions.slice(0, 300));
  const cleanComplaints = sanitizeForFirestore(snapshot.complaints.slice(0, 100));
  const cleanFeedbacks = sanitizeForFirestore(snapshot.feedbacks.slice(0, 100));

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        ownerUid: user.uid,
        accountKey: safeKey,
        mpin: mpin && /^[A-Za-z0-9]{6}$/.test(mpin) ? mpin : '',
        profile: cleanProfile,
        bookings: cleanBookings,
        savedPassengers: cleanPassengers,
        walletTransactions: cleanWalletTx,
        complaints: cleanComplaints,
        feedbacks: cleanFeedbacks,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingMpin =
        typeof existingSnap.data().mpin === 'string' ? existingSnap.data().mpin : '';
      await updateDoc(ref, {
        mpin: existingMpin || (mpin && /^[A-Za-z0-9]{6}$/.test(mpin) ? mpin : ''),
        profile: cleanProfile,
        bookings: cleanBookings,
        savedPassengers: cleanPassengers,
        walletTransactions: cleanWalletTx,
        complaints: cleanComplaints,
        feedbacks: cleanFeedbacks,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, accountPath);
  }
}

// ============================================================================
// User MPIN Verification & Atomic Claim
// ============================================================================

async function recordFailedLoginLog(
  user: User,
  mpin: string,
  reason: string,
  deviceId: string,
  deviceType: 'Android' | 'iOS'
): Promise<void> {
  const safeMpin = (mpin.trim().replace(/[^A-Za-z0-9_-]/g, '') || 'INVALID').slice(0, 12);
  const logId = makeLogId('fail');
  try {
    await setDoc(doc(db, 'loginLogs', logId), {
      actorUid: user.uid,
      mpin: safeMpin,
      outcome: 'Failed',
      reason: reason.slice(0, 200),
      deviceId: deviceId.slice(0, 128),
      deviceType,
      attemptedAt: serverTimestamp(),
    });
  } catch {
    // non-fatal if audit log fails on unauthenticated/quota check
  }
}

export interface VerifyMpinFirestoreResult {
  ok: boolean;
  error?: string;
  serverSnapshot?: UserDataSnapshot | null;
  resolvedAccount?: {
    userKey: string;
    userName: string;
    userMobile: string;
  } | null;
}

export async function verifyAndClaimMpinInFirestore(params: {
  user: User;
  enteredMpin: string;
  userName: string;
  userMobile: string;
  userKey: string;
  deviceId: string;
  deviceType: 'Android' | 'iOS';
}): Promise<VerifyMpinFirestoreResult> {
  const { user, enteredMpin, userName, userMobile, userKey, deviceId, deviceType } = params;
  const cleanMpin = enteredMpin.trim();
  const cleanName = userName.trim().replace(/\s+/g, ' ');
  const cleanMobile = userMobile.replace(/\D/g, '').slice(0, 15);
  const safeKey = sanitizeFirestoreId(userKey);

  if (!/^[A-Za-z0-9]{6}$/.test(cleanMpin)) {
    return {
      ok: false,
      error: 'MPIN must be 6 characters (digits, uppercase and lowercase letters).',
    };
  }

  const codePath = `mpinCodes/${cleanMpin}`;
  const codeRef = doc(db, 'mpinCodes', cleanMpin);
  const claimRef = doc(db, 'mpinClaims', cleanMpin);

  let codeSnap;
  try {
    codeSnap = await getDoc(codeRef);
  } catch (err) {
    const quota = formatFirestoreQuotaMessage(err);
    if (quota) return { ok: false, error: quota };
    if (isPermissionDeniedError(err)) {
      await recordFailedLoginLog(
        user,
        cleanMpin,
        'MPIN already registered to another Google account',
        deviceId,
        deviceType
      );
      return {
        ok: false,
        error: 'This MPIN is already registered to another user.',
      };
    }
    handleFirestoreError(err, OperationType.GET, codePath);
  }

  if (!codeSnap.exists()) {
    await recordFailedLoginLog(user, cleanMpin, 'MPIN not found in database', deviceId, deviceType);
    return {
      ok: false,
      error: 'Invalid or unregistered MPIN. Contact admin for a valid MPIN.',
    };
  }

  const codeData = codeSnap.data();
  const status = codeData.status as AdminMpinStatus;
  if (status === 'Blocked') {
    await recordFailedLoginLog(user, cleanMpin, 'MPIN is Blocked by Admin', deviceId, deviceType);
    return { ok: false, error: 'This MPIN has been Blocked by the Admin.' };
  }
  if (
    status === 'Expired' ||
    (typeof codeData.expiresAt === 'string' &&
      codeData.expiresAt.length > 0 &&
      new Date(codeData.expiresAt).getTime() <= Date.now())
  ) {
    await recordFailedLoginLog(user, cleanMpin, 'MPIN has Expired', deviceId, deviceType);
    return { ok: false, error: 'This MPIN has Expired. Please request a fresh MPIN.' };
  }

  const nowIso = new Date().toISOString();
  const logId = makeLogId('ok');
  const logRef = doc(db, 'loginLogs', logId);
  let resolvedKey = safeKey;
  let resolvedAccount: { userKey: string; userName: string; userMobile: string } | null =
    cleanName && /^\d{10}$/.test(cleanMobile)
      ? { userKey: safeKey, userName: cleanName, userMobile: cleanMobile }
      : null;

  if (status === 'Active' && (!codeData.ownerUid || codeData.ownerUid === '')) {
    if (!cleanName || !/^\d{10}$/.test(cleanMobile)) {
      return {
        ok: false,
        error:
          'New user MPIN requires your Full Name and 10-digit Mobile Number first. Click "Different User?" to enter them.',
      };
    }
    try {
      const batch = writeBatch(db);
      batch.update(codeRef, {
        status: 'Used',
        ownerUid: user.uid,
        deviceId: deviceId.slice(0, 128),
        firstLoginAt: nowIso,
        lastLoginAt: nowIso,
        totalLoginCount: Number(codeData.totalLoginCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });
      batch.set(claimRef, {
        mpin: cleanMpin,
        serialNumber: Number(codeData.serialNumber || 1),
        ownerUid: user.uid,
        boundUserKey: safeKey,
        boundUserName: cleanName.slice(0, 100),
        boundUserMobile: cleanMobile,
        deviceId: deviceId.slice(0, 128),
        deviceType,
        firstLoginAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        totalLoginCount: 1,
        updatedAt: serverTimestamp(),
      });
      batch.set(logRef, {
        actorUid: user.uid,
        mpin: cleanMpin,
        outcome: 'Success',
        reason: 'First-time MPIN activation & login',
        deviceId: deviceId.slice(0, 128),
        deviceType,
        attemptedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      const quota = formatFirestoreQuotaMessage(err);
      if (quota) return { ok: false, error: quota };
      handleFirestoreError(err, OperationType.WRITE, codePath);
    }
  } else if (status === 'Used') {
    if (codeData.ownerUid !== user.uid) {
      await recordFailedLoginLog(
        user,
        cleanMpin,
        'MPIN belongs to another user',
        deviceId,
        deviceType
      );
      return { ok: false, error: 'This MPIN is already registered to another user.' };
    }

    let claimSnap;
    try {
      claimSnap = await getDoc(claimRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `mpinClaims/${cleanMpin}`);
    }
    if (claimSnap.exists()) {
      const claimData = claimSnap.data();
      const rawBoundName = String(claimData.boundUserName || '').trim().replace(/\s+/g, ' ');
      const existingName = rawBoundName.toLowerCase();
      const existingMobile = String(claimData.boundUserMobile || '').replace(/\D/g, '');
      const boundKey = String(claimData.boundUserKey || '').trim();

      if (
        (cleanName && existingName && existingName !== cleanName.toLowerCase()) ||
        (cleanMobile && existingMobile && existingMobile !== cleanMobile)
      ) {
        await recordFailedLoginLog(
          user,
          cleanMpin,
          `MPIN linked to ${rawBoundName || 'another user'}`,
          deviceId,
          deviceType
        );
        return {
          ok: false,
          error: `This MPIN is already registered to ${rawBoundName || 'another user'}.`,
        };
      }

      if (boundKey) {
        resolvedKey = sanitizeFirestoreId(boundKey);
      }
      resolvedAccount = {
        userKey: resolvedKey,
        userName: rawBoundName || cleanName || 'RailOne User',
        userMobile: existingMobile || cleanMobile,
      };
    } else if (!cleanName || !/^\d{10}$/.test(cleanMobile)) {
      return {
        ok: false,
        error: 'Please enter your Full Name and 10-digit Mobile Number via "Different User?".',
      };
    }

    try {
      const batch = writeBatch(db);
      batch.update(codeRef, {
        deviceId: deviceId.slice(0, 128),
        lastLoginAt: nowIso,
        totalLoginCount: Number(codeData.totalLoginCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });
      if (claimSnap.exists()) {
        batch.update(claimRef, {
          deviceId: deviceId.slice(0, 128),
          deviceType,
          lastLoginAt: serverTimestamp(),
          totalLoginCount: Number(claimSnap.data().totalLoginCount || 1) + 1,
          updatedAt: serverTimestamp(),
        });
      }
      batch.set(logRef, {
        actorUid: user.uid,
        mpin: cleanMpin,
        outcome: 'Success',
        reason: 'Verified MPIN login',
        deviceId: deviceId.slice(0, 128),
        deviceType,
        attemptedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      const quota = formatFirestoreQuotaMessage(err);
      if (quota) return { ok: false, error: quota };
      handleFirestoreError(err, OperationType.WRITE, codePath);
    }
  } else {
    return { ok: false, error: `MPIN cannot be used (status: ${status}).` };
  }

  const savedAccount = await loadUserAccountFromFirestore(user, resolvedKey);
  return {
    ok: true,
    serverSnapshot: savedAccount ? savedAccount.snapshot : null,
    resolvedAccount,
  };
}

export async function checkMpinStatusInFirestore(
  mpin: string
): Promise<'Active' | 'Used' | 'Blocked' | 'Expired' | 'Missing' | 'Skip'> {
  if (!/^[A-Za-z0-9]{6}$/.test(mpin)) return 'Skip';
  try {
    const snap = await getDoc(doc(db, 'mpinCodes', mpin));
    if (!snap.exists()) return 'Missing';
    const data = snap.data();
    const status = data.status as AdminMpinStatus;
    if (
      status !== 'Blocked' &&
      typeof data.expiresAt === 'string' &&
      data.expiresAt.length > 0 &&
      new Date(data.expiresAt).getTime() <= Date.now()
    ) {
      return 'Expired';
    }
    return status;
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      return 'Skip';
    }
    return 'Skip';
  }
}

// ============================================================================
// Admin Panel Firestore Operations
// ============================================================================

export async function checkIsFirestoreAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if ((user.email || '').toLowerCase() === ADMIN_BOOTSTRAP_EMAIL) return true;
  try {
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
    return adminDoc.exists();
  } catch {
    return false;
  }
}

export function getFirebaseConsoleDatabaseUrl(): string {
  return `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data`;
}

export interface FirestoreAdminUserSummary {
  uid: string;
  email: string;
  displayName: string;
  accountKey: string;
  mpin: string;
  userName: string;
  userMobile: string;
  rWalletBalance: number;
  bookingsCount: number;
  updatedAt: string;
}

export async function adminFetchUsersFromFirestore(): Promise<FirestoreAdminUserSummary[]> {
  let usersSnap;
  try {
    usersSnap = await getDocs(collection(db, 'users'));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }

  const summaries: FirestoreAdminUserSummary[] = [];
  for (const userDoc of usersSnap.docs) {
    const u = userDoc.data();
    const uid = String(u.uid || userDoc.id);
    const email = String(u.email || '');
    const displayName = String(u.displayName || 'RailOne User');
    const accountsPath = `users/${uid}/accounts`;
    let accSnap;
    try {
      accSnap = await getDocs(collection(db, 'users', uid, 'accounts'));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, accountsPath);
    }

    if (accSnap.docs.length === 0) {
      summaries.push({
        uid,
        email,
        displayName,
        accountKey: String(u.activeAccountKey || ''),
        mpin: '',
        userName: displayName,
        userMobile: '',
        rWalletBalance: 0,
        bookingsCount: 0,
        updatedAt: timestampToIso(u.updatedAt),
      });
      continue;
    }

    for (const accDoc of accSnap.docs) {
      const a = accDoc.data();
      const profile = (a.profile ?? {}) as Record<string, unknown>;
      summaries.push({
        uid,
        email,
        displayName,
        accountKey: String(a.accountKey || accDoc.id),
        mpin: typeof a.mpin === 'string' ? a.mpin : '',
        userName: String(profile.name || displayName),
        userMobile: String(profile.mobile || ''),
        rWalletBalance: Number(profile.rWalletBalance || 0),
        bookingsCount: Array.isArray(a.bookings) ? a.bookings.length : 0,
        updatedAt: timestampToIso(a.updatedAt) || timestampToIso(u.updatedAt),
      });
    }
  }

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export interface AdminDashboardPayload {
  stats: AdminStats;
  items: AdminMpinRecord[];
  logs: AdminAuditLog[];
}

export async function adminFetchDashboardFromFirestore(): Promise<AdminDashboardPayload> {
  let configData: Record<string, unknown> = {
    enforceDeviceLock: true,
    lastBatchId: null,
    lastGeneratedAt: null,
    lastSerialNumber: 0,
  };

  try {
    const configSnap = await getDoc(doc(db, 'adminConfig', 'global'));
    if (configSnap.exists()) {
      configData = configSnap.data();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'adminConfig/global');
  }

  let codesSnap;
  try {
    codesSnap = await getDocs(
      query(collection(db, 'mpinCodes'), orderBy('serialNumber', 'asc'))
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'mpinCodes');
  }

  let claimsSnap;
  try {
    claimsSnap = await getDocs(collection(db, 'mpinClaims'));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'mpinClaims');
  }

  let logsSnap;
  try {
    logsSnap = await getDocs(
      query(collection(db, 'loginLogs'), orderBy('attemptedAt', 'desc'), limit(200))
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'loginLogs');
  }

  const claimMap = new Map<string, Record<string, unknown>>();
  for (const cDoc of claimsSnap.docs) {
    claimMap.set(cDoc.id, cDoc.data());
  }

  let activeCount = 0;
  let usedCount = 0;
  let blockedCount = 0;
  let expiredCount = 0;
  let totalSuccessfulLogins = 0;
  let totalFailedAttemptsOnMpins = 0;

  const nowMs = Date.now();
  const items: AdminMpinRecord[] = codesSnap.docs.map((mDoc) => {
    const d = mDoc.data();
    const claim = claimMap.get(mDoc.id);
    const expiresAtStr = typeof d.expiresAt === 'string' && d.expiresAt ? d.expiresAt : null;
    let status = (d.status as AdminMpinStatus) || 'Active';
    if (
      (status === 'Active' || status === 'Used') &&
      expiresAtStr &&
      new Date(expiresAtStr).getTime() <= nowMs
    ) {
      status = 'Expired';
    }

    if (status === 'Active') activeCount++;
    else if (status === 'Used') usedCount++;
    else if (status === 'Blocked') blockedCount++;
    else if (status === 'Expired') expiredCount++;

    const loginCount = Number(d.totalLoginCount || 0);
    const failCount = Number(d.failedAttempts || 0);
    totalSuccessfulLogins += loginCount;
    totalFailedAttemptsOnMpins += failCount;

    return {
      id: Number(d.serialNumber || 1),
      mpin: String(d.mpin || mDoc.id),
      batchId: String(d.batchId || ''),
      generatedAt: timestampToIso(d.generatedAt),
      expiresAt: expiresAtStr,
      firstLoginAt: claim
        ? timestampToIso(claim.firstLoginAt)
        : typeof d.firstLoginAt === 'string' && d.firstLoginAt
          ? d.firstLoginAt
          : null,
      lastLoginAt: claim
        ? timestampToIso(claim.lastLoginAt)
        : typeof d.lastLoginAt === 'string' && d.lastLoginAt
          ? d.lastLoginAt
          : null,
      totalLoginCount: loginCount,
      deviceId: claim
        ? (claim.deviceId as string) || null
        : typeof d.deviceId === 'string' && d.deviceId
          ? d.deviceId
          : null,
      deviceType: claim
        ? ((claim.deviceType as 'Android' | 'iOS') || null)
        : null,
      loginIp: 'Firebase Firestore',
      status,
      failedAttempts: failCount,
      deviceLocked: Boolean(d.deviceLocked),
      boundUserName: claim ? String(claim.boundUserName || '') || null : null,
      boundUserMobile: claim ? String(claim.boundUserMobile || '') || null : null,
      boundUserKey: claim ? String(claim.boundUserKey || '') || null : null,
    };
  });

  const logs: AdminAuditLog[] = logsSnap.docs.map((lDoc, idx) => {
    const l = lDoc.data();
    return {
      id: idx + 1,
      mpin: String(l.mpin || ''),
      outcome: (l.outcome as 'Success' | 'Failed') || 'Failed',
      reason: String(l.reason || ''),
      deviceId: typeof l.deviceId === 'string' && l.deviceId ? l.deviceId : null,
      deviceType: (l.deviceType as 'Android' | 'iOS') || null,
      loginIp: 'Firebase Firestore',
      attemptedAt: timestampToIso(l.attemptedAt),
    };
  });

  const totalAuditFailures = logs.filter((l) => l.outcome === 'Failed').length;

  return {
    stats: {
      totalGenerated: items.length,
      activeCount,
      usedCount,
      blockedCount,
      expiredCount,
      totalSuccessfulLogins,
      totalFailedAttemptsOnMpins,
      totalAuditFailures,
      enforceDeviceLock:
        configData.enforceDeviceLock !== undefined ? Boolean(configData.enforceDeviceLock) : true,
      lastBatchId:
        typeof configData.lastBatchId === 'string' && configData.lastBatchId
          ? configData.lastBatchId
          : null,
      lastGeneratedAt:
        typeof configData.lastGeneratedAt === 'string' && configData.lastGeneratedAt
          ? configData.lastGeneratedAt
          : null,
    },
    items,
    logs,
  };
}

export async function adminGenerateMpinsInFirestore(
  count: number,
  expiryDays: number | null
): Promise<{
  batchId: string;
  generatedCount: number;
  durationMs: number;
  sampleMpins: string[];
}> {
  const startedAt = performance.now();
  const safeCount = Math.max(1, Math.min(5000, Math.floor(count)));

  let configSnap;
  try {
    configSnap = await getDoc(doc(db, 'adminConfig', 'global'));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'adminConfig/global');
  }

  let existingSnap;
  try {
    existingSnap = await getDocs(collection(db, 'mpinCodes'));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'mpinCodes');
  }

  const usedSet = new Set<string>(existingSnap.docs.map((d) => d.id));
  let maxSerial = Number(configSnap.exists() ? configSnap.data().lastSerialNumber || 0 : 0);
  for (const d of existingSnap.docs) {
    const s = Number(d.data().serialNumber || 0);
    if (s > maxSerial) maxSerial = s;
  }

  const batchId = `BATCH-${Date.now().toString(36).toUpperCase()}`;
  const nowIso = new Date().toISOString();
  const expiresAtIso =
    expiryDays && expiryDays > 0
      ? new Date(Date.now() + expiryDays * 86_400_000).toISOString()
      : '';
  const enforceLock = configSnap.exists() ? Boolean(configSnap.data().enforceDeviceLock) : true;

  const newCodes: { mpin: string; serialNumber: number }[] = [];
  while (newCodes.length < safeCount) {
    const code = generateAlphanumericMpin();
    if (!usedSet.has(code)) {
      usedSet.add(code);
      maxSerial += 1;
      newCodes.push({ mpin: code, serialNumber: maxSerial });
    }
  }

  const CHUNK = 400;
  try {
    for (let i = 0; i < newCodes.length; i += CHUNK) {
      const slice = newCodes.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      for (const item of slice) {
        batch.set(doc(db, 'mpinCodes', item.mpin), {
          mpin: item.mpin,
          serialNumber: item.serialNumber,
          batchId,
          status: 'Active',
          ownerUid: '',
          deviceId: '',
          deviceLocked: enforceLock,
          totalLoginCount: 0,
          failedAttempts: 0,
          generatedAt: serverTimestamp(),
          expiresAt: expiresAtIso,
          firstLoginAt: '',
          lastLoginAt: '',
          updatedAt: serverTimestamp(),
        });
      }
      if (i + CHUNK >= newCodes.length) {
        batch.set(doc(db, 'adminConfig', 'global'), {
          enforceDeviceLock: enforceLock,
          lastBatchId: batchId,
          lastSerialNumber: maxSerial,
          lastGeneratedAt: nowIso,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (err) {
    const quota = formatFirestoreQuotaMessage(err);
    if (quota) throw new Error(quota);
    handleFirestoreError(err, OperationType.WRITE, 'mpinCodes');
  }

  return {
    batchId,
    generatedCount: newCodes.length,
    durationMs: Math.round(performance.now() - startedAt),
    sampleMpins: newCodes.slice(0, 10).map((c) => c.mpin),
  };
}

export async function adminUpdateMpinActionInFirestore(
  mpin: string,
  action:
    | 'activate'
    | 'block'
    | 'unblock'
    | 'expire'
    | 'reset-device'
    | 'reset-failures'
    | 'toggle-device-lock'
): Promise<{ synced: boolean }> {
  const path = `mpinCodes/${mpin}`;
  const ref = doc(db, 'mpinCodes', mpin);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { synced: false };
    }
    const data = snap.data();
    const hasOwner = typeof data.ownerUid === 'string' && data.ownerUid.length > 0;
    if (action === 'block') {
      await updateDoc(ref, { status: 'Blocked', updatedAt: serverTimestamp() });
    } else if (action === 'unblock' || action === 'activate') {
      await updateDoc(ref, {
        status: hasOwner ? 'Used' : 'Active',
        updatedAt: serverTimestamp(),
      });
    } else if (action === 'expire') {
      await updateDoc(ref, { status: 'Expired', updatedAt: serverTimestamp() });
    } else if (action === 'reset-device') {
      await updateDoc(ref, { deviceId: '', updatedAt: serverTimestamp() });
    } else if (action === 'reset-failures') {
      await updateDoc(ref, { failedAttempts: 0, updatedAt: serverTimestamp() });
    } else if (action === 'toggle-device-lock') {
      await updateDoc(ref, {
        deviceLocked: !Boolean(data.deviceLocked),
        updatedAt: serverTimestamp(),
      });
    }
    return { synced: true };
  } catch (err) {
    const quota = formatFirestoreQuotaMessage(err);
    if (quota) throw new Error(quota);
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminSyncServerMpinsToFirestore(params: {
  records: AdminMpinRecord[];
  enforceDeviceLock: boolean;
  lastBatchId?: string | null;
  lastSerialNumber?: number;
  lastGeneratedAt?: string | null;
}): Promise<{ createdCount: number; updatedCount: number; skippedCount: number }> {
  const {
    records,
    enforceDeviceLock,
    lastBatchId = '',
    lastSerialNumber,
    lastGeneratedAt = '',
  } = params;

  let existingSnap;
  try {
    existingSnap = await getDocs(collection(db, 'mpinCodes'));
  } catch (err) {
    const quota = formatFirestoreQuotaMessage(err);
    if (quota) throw new Error(quota);
    handleFirestoreError(err, OperationType.LIST, 'mpinCodes');
  }

  const existingByMpin = new Map<string, Record<string, unknown>>();
  let maxSerial = Number(lastSerialNumber || 0);
  for (const d of existingSnap.docs) {
    const data = d.data();
    existingByMpin.set(d.id, data);
    const s = Number(data.serialNumber || 0);
    if (s > maxSerial) maxSerial = s;
  }

  type BatchOp =
    | { kind: 'set'; mpin: string; payload: Record<string, unknown> }
    | { kind: 'update'; mpin: string; payload: Record<string, unknown> };

  const ops: BatchOp[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const rec of records) {
    if (!/^[A-Za-z0-9]{6}$/.test(rec.mpin)) {
      skippedCount += 1;
      continue;
    }
    if (rec.id > maxSerial) maxSerial = rec.id;

    const existing = existingByMpin.get(rec.mpin);
    const expiresAtStr = (rec.expiresAt || '').slice(0, 40);

    if (!existing) {
      const canCreateUnclaimed =
        !rec.boundUserKey &&
        rec.status !== 'Used' &&
        rec.totalLoginCount === 0 &&
        rec.failedAttempts === 0;
      if (!canCreateUnclaimed) {
        skippedCount += 1;
        continue;
      }
      ops.push({
        kind: 'set',
        mpin: rec.mpin,
        payload: {
          mpin: rec.mpin,
          serialNumber: Math.max(1, Math.floor(rec.id)),
          batchId: (rec.batchId || 'SYNC-BATCH').slice(0, 64),
          status: rec.status,
          ownerUid: '',
          deviceId: '',
          deviceLocked: Boolean(rec.deviceLocked),
          totalLoginCount: 0,
          failedAttempts: 0,
          generatedAt: serverTimestamp(),
          expiresAt: expiresAtStr,
          firstLoginAt: '',
          lastLoginAt: '',
          updatedAt: serverTimestamp(),
        },
      });
      createdCount += 1;
    } else {
      const existingOwner = typeof existing.ownerUid === 'string' ? existing.ownerUid : '';
      const desiredStatus =
        rec.status === 'Active' && existingOwner ? 'Used' : rec.status;
      const changed =
        existing.status !== desiredStatus ||
        Boolean(existing.deviceLocked) !== Boolean(rec.deviceLocked) ||
        Number(existing.failedAttempts || 0) !== Number(rec.failedAttempts || 0) ||
        String(existing.expiresAt || '') !== expiresAtStr;

      if (changed) {
        ops.push({
          kind: 'update',
          mpin: rec.mpin,
          payload: {
            status: desiredStatus,
            deviceLocked: Boolean(rec.deviceLocked),
            failedAttempts: Math.max(0, Math.floor(rec.failedAttempts)),
            expiresAt: expiresAtStr,
            updatedAt: serverTimestamp(),
          },
        });
        updatedCount += 1;
      }
    }
  }

  const configPayload = {
    enforceDeviceLock: Boolean(enforceDeviceLock),
    lastBatchId: (lastBatchId || '').slice(0, 64),
    lastSerialNumber: Math.max(0, Math.floor(maxSerial)),
    lastGeneratedAt: (lastGeneratedAt || new Date().toISOString()).slice(0, 40),
    updatedAt: serverTimestamp(),
  };

  try {
    if (ops.length === 0) {
      await setDoc(doc(db, 'adminConfig', 'global'), configPayload);
    } else {
      const CHUNK = 400;
      for (let i = 0; i < ops.length; i += CHUNK) {
        const slice = ops.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        for (const op of slice) {
          const ref = doc(db, 'mpinCodes', op.mpin);
          if (op.kind === 'set') {
            batch.set(ref, op.payload);
          } else {
            batch.update(ref, op.payload);
          }
        }
        if (i + CHUNK >= ops.length) {
          batch.set(doc(db, 'adminConfig', 'global'), configPayload);
        }
        await batch.commit();
      }
    }
  } catch (err) {
    const quota = formatFirestoreQuotaMessage(err);
    if (quota) throw new Error(quota);
    handleFirestoreError(err, OperationType.WRITE, 'mpinCodes');
  }

  return { createdCount, updatedCount, skippedCount };
}

export async function adminClearMpinsInFirestore(
  scope: 'all' | 'used-blocked-expired'
): Promise<{ deletedCount: number }> {
  try {
    const codesSnap = await getDocs(collection(db, 'mpinCodes'));
    const targets = codesSnap.docs.filter((d) => {
      if (scope === 'all') return true;
      const st = d.data().status as AdminMpinStatus;
      return st !== 'Active';
    });

    if (targets.length === 0) {
      if (scope === 'all') {
        await setDoc(doc(db, 'adminConfig', 'global'), {
          enforceDeviceLock: true,
          lastBatchId: '',
          lastSerialNumber: 0,
          lastGeneratedAt: '',
          updatedAt: serverTimestamp(),
        });
      }
      return { deletedCount: 0 };
    }

    const CHUNK = 200;
    for (let i = 0; i < targets.length; i += CHUNK) {
      const slice = targets.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      for (const mDoc of slice) {
        batch.delete(mDoc.ref);
        batch.delete(doc(db, 'mpinClaims', mDoc.id));
      }
      if (scope === 'all' && i + CHUNK >= targets.length) {
        batch.set(doc(db, 'adminConfig', 'global'), {
          enforceDeviceLock: true,
          lastBatchId: '',
          lastSerialNumber: 0,
          lastGeneratedAt: '',
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    return { deletedCount: targets.length };
  } catch (err) {
    const quota = formatFirestoreQuotaMessage(err);
    if (quota) throw new Error(quota);
    handleFirestoreError(err, OperationType.DELETE, 'mpinCodes');
  }
}

export async function adminToggleDeviceLockInFirestore(
  enforceDeviceLock: boolean
): Promise<void> {
  const path = 'adminConfig/global';
  const ref = doc(db, 'adminConfig', 'global');
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        enforceDeviceLock,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        enforceDeviceLock,
        lastBatchId: '',
        lastSerialNumber: 0,
        lastGeneratedAt: '',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    const quota = formatFirestoreQuotaMessage(err);
    if (quota) throw new Error(quota);
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
