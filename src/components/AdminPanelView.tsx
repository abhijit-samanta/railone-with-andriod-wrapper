import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Cloud,
  CloudOff,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Smartphone,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { apiUrl } from '../lib/apiClient';
import {
  auth,
  firebaseConfig,
  formatFirebaseAuthError,
  getFirestoreConnectionStatus,
  signInWithGoogle,
  signOutFirebase,
  subscribeFirestoreStatus,
  type FirestoreConnectionStatus,
} from '../lib/firebase';
import {
  adminClearMpinsInFirestore,
  adminFetchDashboardFromFirestore,
  adminFetchUsersFromFirestore,
  adminGenerateMpinsInFirestore,
  adminSyncServerMpinsToFirestore,
  adminToggleDeviceLockInFirestore,
  adminUpdateMpinActionInFirestore,
  checkIsFirestoreAdmin,
  getFirebaseConsoleDatabaseUrl,
  type FirestoreAdminUserSummary,
} from '../lib/railFirestore';

export type AdminMpinStatus = 'Active' | 'Used' | 'Blocked' | 'Expired';

export interface AdminMpinRecord {
  id: number;
  mpin: string;
  batchId: string;
  generatedAt: string;
  expiresAt: string | null;
  firstLoginAt: string | null;
  lastLoginAt: string | null;
  totalLoginCount: number;
  deviceId: string | null;
  deviceType: 'Android' | 'iOS' | null;
  loginIp: string | null;
  status: AdminMpinStatus;
  failedAttempts: number;
  deviceLocked: boolean;
  boundUserName: string | null;
  boundUserMobile: string | null;
  boundUserKey: string | null;
}

export interface AdminAuditLog {
  id: number;
  mpin: string;
  outcome: 'Success' | 'Failed';
  reason: string;
  deviceId: string | null;
  deviceType: 'Android' | 'iOS' | null;
  loginIp: string | null;
  attemptedAt: string;
}

export interface AdminStats {
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

type AdminTabId = 'overview' | 'serial' | 'registry' | 'logs' | 'firebase' | 'security';
type AdminAuthMode = 'setup-required' | 'claimed' | 'env';

interface AdminPanelViewProps {
  onBackToApp: () => void;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatIndianNumber(n: number): string {
  return n.toLocaleString('en-IN');
}

function StatusLabel({ status }: { status: AdminMpinStatus }) {
  switch (status) {
    case 'Active':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Active
        </span>
      );
    case 'Used':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0066FF] whitespace-nowrap">
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          Used
        </span>
      );
    case 'Blocked':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 whitespace-nowrap">
          <Ban className="h-3.5 w-3.5 shrink-0" />
          Blocked
        </span>
      );
    case 'Expired':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Expired
        </span>
      );
  }
}

export function AdminPanelView({ onBackToApp }: AdminPanelViewProps) {
  // Admin PIN Auth State (token strictly in React memory — never localStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AdminAuthMode>('claimed');
  const [authChecking, setAuthChecking] = useState(true);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminConfirmInput, setAdminConfirmInput] = useState('');
  const [showAuthPin, setShowAuthPin] = useState(false);
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Dashboard State
  const [activeTab, setActiveTab] = useState<AdminTabId>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelNotice, setPanelNotice] = useState<string | null>(null);

  // Batch Generation State
  const [batchCount, setBatchCount] = useState<number>(100);
  const [expiryDays, setExpiryDays] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [lastBatchResult, setLastBatchResult] = useState<{
    batchId: string;
    generatedCount: number;
    durationMs: number;
    sampleMpins: string[];
  } | null>(null);
  const [copiedMpin, setCopiedMpin] = useState<string | null>(null);
  const [pendingClearScope, setPendingClearScope] = useState<
    null | 'all' | 'used-blocked-expired'
  >(null);
  const [clearingScope, setClearingScope] = useState<
    null | 'all' | 'used-blocked-expired'
  >(null);

  // Serial-Wise List State
  const [serialItems, setSerialItems] = useState<AdminMpinRecord[]>([]);
  const [serialTotal, setSerialTotal] = useState(0);
  const [serialPage, setSerialPage] = useState(1);
  const [serialTotalPages, setSerialTotalPages] = useState(1);
  const [serialLimit, setSerialLimit] = useState(100);
  const [serialStatusFilter, setSerialStatusFilter] = useState('');
  const [serialJumpInput, setSerialJumpInput] = useState('');
  const [highlightedSerial, setHighlightedSerial] = useState<number | null>(null);
  const [loadingSerial, setLoadingSerial] = useState(false);

  // Registry State
  const [registryItems, setRegistryItems] = useState<AdminMpinRecord[]>([]);
  const [registryTotal, setRegistryTotal] = useState(0);
  const [registryPage, setRegistryPage] = useState(1);
  const [registryTotalPages, setRegistryTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [loadingRegistry, setLoadingRegistry] = useState(false);

  // Detail Modal
  const [selectedDetail, setSelectedDetail] = useState<{
    record: AdminMpinRecord;
    logs: AdminAuditLog[];
  } | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditQuery, setAuditQuery] = useState('');
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Security Tab Change PIN State
  const [currentAdminMpin, setCurrentAdminMpin] = useState('');
  const [newAdminMpin, setNewAdminMpin] = useState('');
  const [changingAdminPin, setChangingAdminPin] = useState(false);

  // Firebase Firestore Cloud Sync & Standalone Cloud Admin State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [isFirebaseAdmin, setIsFirebaseAdmin] = useState(false);
  const [firebaseCloudUnlocked, setFirebaseCloudUnlocked] = useState(false);
  const [serverReachable, setServerReachable] = useState<boolean | null>(null);
  const [firestoreStatus, setFirestoreStatus] = useState<FirestoreConnectionStatus>(() =>
    getFirestoreConnectionStatus()
  );
  const [connectingFirebase, setConnectingFirebase] = useState(false);
  const [syncingFirebase, setSyncingFirebase] = useState(false);
  const [firebaseSyncError, setFirebaseSyncError] = useState<string | null>(null);
  const [firebaseLastSyncNote, setFirebaseLastSyncNote] = useState<string | null>(null);
  const [cloudUsers, setCloudUsers] = useState<FirestoreAdminUserSummary[]>([]);
  const [cloudItemsCache, setCloudItemsCache] = useState<AdminMpinRecord[]>([]);
  const [cloudLogsCache, setCloudLogsCache] = useState<AdminAuditLog[]>([]);
  const [loadingCloudAccount, setLoadingCloudAccount] = useState(false);
  const autoSyncedUidRef = useRef<string | null>(null);

  const isFirebaseCloudOnly =
    !adminToken &&
    firebaseCloudUnlocked &&
    Boolean(firebaseUser?.emailVerified && isFirebaseAdmin);
  const isUnlocked = Boolean(adminToken || isFirebaseCloudOnly);

  useEffect(() => {
    const unsubStatus = subscribeFirestoreStatus(setFirestoreStatus);
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setFirebaseSyncError(null);
      if (!user) {
        setIsFirebaseAdmin(false);
        setFirebaseCloudUnlocked(false);
        return;
      }
      void checkIsFirestoreAdmin(user).then((allowed) => {
        setIsFirebaseAdmin(allowed);
      });
    });
    return () => {
      unsubStatus();
      unsubAuth();
    };
  }, []);

  const checkAuthStatus = useCallback(async () => {
    setAuthChecking(true);
    try {
      const res = await fetch(apiUrl('/api/admin/auth/status'));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as { mode?: AdminAuthMode };
        if (data.mode === 'setup-required' || data.mode === 'claimed' || data.mode === 'env') {
          setAuthMode(data.mode);
        }
        setServerReachable(true);
      } else {
        setServerReachable(false);
      }
    } catch {
      setServerReachable(false);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkAuthStatus();
  }, [checkAuthStatus]);

  const adminFetch = useCallback(
    async (url: string, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers ?? {});
      if (adminToken) {
        headers.set('Authorization', `Bearer ${adminToken}`);
      }
      if (init?.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const res = await fetch(apiUrl(url), { ...init, headers });
      if (res.status === 401) {
        setAdminToken(null);
        setAuthError('Admin session expired or invalid. Please unlock with your Admin PIN.');
      }
      return res;
    },
    [adminToken]
  );

  const handleAdminSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const cleanPin = adminPinInput.trim();
    const cleanConfirm = adminConfirmInput.trim();
    if (!/^(?=.*\d)(?=.*[A-Z])(?=.*[a-z])[A-Za-z0-9]{6}$/.test(cleanPin)) {
      setAuthError(
        'Admin PIN must be 6 characters combining digits, uppercase, and lowercase letters.'
      );
      return;
    }
    if (cleanPin !== cleanConfirm) {
      setAuthError('Admin PIN and confirmation PIN do not match.');
      return;
    }

    setSubmittingAuth(true);
    try {
      const res = await fetch(apiUrl('/api/admin/auth/setup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mpin: cleanPin, confirmMpin: cleanConfirm }),
      });
      const data = (await res.json()) as { ok?: boolean; token?: string; mode?: AdminAuthMode; error?: string };
      if (!res.ok || !data.ok || !data.token) {
        setAuthError(data.error || 'Unable to save Admin PIN.');
        return;
      }
      setAuthMode(data.mode || 'claimed');
      setAdminToken(data.token);
      setAdminPinInput('');
      setAdminConfirmInput('');
    } catch {
      setAuthError('Unable to reach server to configure Admin PIN.');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const cleanPin = adminPinInput.trim();
    if (!cleanPin) {
      setAuthError('Please enter your 6-character Admin PIN.');
      return;
    }
    setSubmittingAuth(true);
    try {
      const res = await fetch(apiUrl('/api/admin/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mpin: cleanPin }),
      });
      const data = (await res.json()) as { ok?: boolean; token?: string; mode?: AdminAuthMode; error?: string };
      if (!res.ok || !data.ok || !data.token) {
        setAuthError(data.error || 'Incorrect Admin PIN.');
        return;
      }
      if (data.mode) setAuthMode(data.mode);
      setAdminToken(data.token);
      setAdminPinInput('');
    } catch {
      setAuthError('Unable to reach server for Admin PIN verification.');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const loadFirebaseAccountData = useCallback(
    async (alsoPopulateDashboard = false) => {
      if (!firebaseUser?.emailVerified || !isFirebaseAdmin) return null;
      setLoadingCloudAccount(true);
      setFirebaseSyncError(null);
      try {
        const [dashboard, users] = await Promise.all([
          adminFetchDashboardFromFirestore(),
          adminFetchUsersFromFirestore(),
        ]);
        setCloudItemsCache(dashboard.items);
        setCloudLogsCache(dashboard.logs);
        setCloudUsers(users);
        if (alsoPopulateDashboard) {
          setStats(dashboard.stats);
        }
        return { dashboard, users };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Unable to load live Firebase Firestore account data.';
        setFirebaseSyncError(msg);
        if (alsoPopulateDashboard) {
          setPanelError(msg);
        }
        return null;
      } finally {
        setLoadingCloudAccount(false);
      }
    },
    [firebaseUser, isFirebaseAdmin]
  );

  const loadStats = useCallback(async () => {
    if (!adminToken) {
      if (isFirebaseCloudOnly) {
        setLoadingStats(true);
        try {
          await loadFirebaseAccountData(true);
        } finally {
          setLoadingStats(false);
        }
      }
      return;
    }
    setLoadingStats(true);
    try {
      const res = await adminFetch('/api/admin/stats');
      const data = (await res.json()) as {
        ok?: boolean;
        adminAuthMode?: AdminAuthMode;
        stats?: AdminStats;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.stats) {
        setPanelError(data.error || 'Unable to load Admin statistics.');
        return;
      }
      if (data.adminAuthMode) setAuthMode(data.adminAuthMode);
      setStats(data.stats);
    } catch {
      setPanelError('Unable to load Admin statistics.');
    } finally {
      setLoadingStats(false);
    }
  }, [adminToken, isFirebaseCloudOnly, adminFetch, loadFirebaseAccountData]);

  const loadSerialList = useCallback(
    async (
      targetPage = 1,
      overrideLimit = serialLimit,
      overrideStatus = serialStatusFilter
    ) => {
      if (!adminToken) {
        if (isFirebaseCloudOnly) {
          setLoadingSerial(true);
          try {
            const payload =
              cloudItemsCache.length > 0
                ? { dashboard: { items: cloudItemsCache } }
                : await loadFirebaseAccountData(true);
            const allItems = payload?.dashboard.items ?? cloudItemsCache;
            const filtered = overrideStatus
              ? allItems.filter((item) => item.status === overrideStatus)
              : allItems;
            const ordered = [...filtered].sort((a, b) => a.id - b.id);
            const totalPages = Math.max(1, Math.ceil(ordered.length / overrideLimit));
            const safePage = Math.min(totalPages, Math.max(1, targetPage));
            const start = (safePage - 1) * overrideLimit;
            setSerialItems(ordered.slice(start, start + overrideLimit));
            setSerialTotal(ordered.length);
            setSerialPage(safePage);
            setSerialTotalPages(totalPages);
          } finally {
            setLoadingSerial(false);
          }
        }
        return;
      }
      setLoadingSerial(true);
      try {
        const qs = new URLSearchParams({
          sortBy: 'id',
          sortDir: 'asc',
          page: String(targetPage),
          limit: String(overrideLimit),
        });
        if (overrideStatus) qs.set('status', overrideStatus);

        const res = await adminFetch(`/api/admin/mpins?${qs.toString()}`);
        const data = (await res.json()) as {
          ok?: boolean;
          items?: AdminMpinRecord[];
          total?: number;
          page?: number;
          totalPages?: number;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          setPanelError(data.error || 'Unable to load serial-wise MPIN list.');
          return;
        }
        setSerialItems(data.items ?? []);
        setSerialTotal(data.total ?? 0);
        setSerialPage(data.page ?? targetPage);
        setSerialTotalPages(data.totalPages ?? 1);
      } catch {
        setPanelError('Unable to load serial-wise MPIN list.');
      } finally {
        setLoadingSerial(false);
      }
    },
    [
      adminToken,
      isFirebaseCloudOnly,
      cloudItemsCache,
      loadFirebaseAccountData,
      adminFetch,
      serialLimit,
      serialStatusFilter,
    ]
  );

  const loadRegistry = useCallback(
    async (targetPage = 1) => {
      if (!adminToken) {
        if (isFirebaseCloudOnly) {
          setLoadingRegistry(true);
          try {
            const payload =
              cloudItemsCache.length > 0
                ? { dashboard: { items: cloudItemsCache } }
                : await loadFirebaseAccountData(true);
            const allItems = payload?.dashboard.items ?? cloudItemsCache;
            const q = searchQuery.trim().toLowerCase();
            const filtered = allItems.filter((item) => {
              if (statusFilter && item.status !== statusFilter) return false;
              if (deviceFilter && item.deviceType !== deviceFilter) return false;
              if (q) {
                const hay = [
                  String(item.id),
                  item.mpin,
                  item.boundUserName || '',
                  item.boundUserMobile || '',
                  item.batchId || '',
                ]
                  .join(' ')
                  .toLowerCase();
                if (!hay.includes(q)) return false;
              }
              return true;
            });
            const sorted = [...filtered].sort((a, b) => {
              switch (sortBy) {
                case 'serialAsc':
                  return a.id - b.id;
                case 'lastLoginAt':
                  return (b.lastLoginAt || '').localeCompare(a.lastLoginAt || '');
                case 'totalLoginCount':
                  return b.totalLoginCount - a.totalLoginCount;
                case 'failedAttempts':
                  return b.failedAttempts - a.failedAttempts;
                case 'mpin':
                  return a.mpin.localeCompare(b.mpin);
                default:
                  return b.id - a.id;
              }
            });
            const pageSize = 50;
            const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
            const safePage = Math.min(totalPages, Math.max(1, targetPage));
            const start = (safePage - 1) * pageSize;
            setRegistryItems(sorted.slice(start, start + pageSize));
            setRegistryTotal(sorted.length);
            setRegistryPage(safePage);
            setRegistryTotalPages(totalPages);
          } finally {
            setLoadingRegistry(false);
          }
        }
        return;
      }
      setLoadingRegistry(true);
      try {
        const apiSortBy = sortBy === 'serialAsc' ? 'id' : sortBy;
        const apiSortDir = sortBy === 'serialAsc' || sortBy === 'mpin' ? 'asc' : 'desc';
        const qs = new URLSearchParams({
          sortBy: apiSortBy,
          sortDir: apiSortDir,
          page: String(targetPage),
          limit: '50',
        });
        if (searchQuery.trim()) qs.set('q', searchQuery.trim());
        if (statusFilter) qs.set('status', statusFilter);
        if (deviceFilter) qs.set('deviceType', deviceFilter);

        const res = await adminFetch(`/api/admin/mpins?${qs.toString()}`);
        const data = (await res.json()) as {
          ok?: boolean;
          items?: AdminMpinRecord[];
          total?: number;
          page?: number;
          totalPages?: number;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          setPanelError(data.error || 'Unable to load MPIN registry.');
          return;
        }
        setRegistryItems(data.items ?? []);
        setRegistryTotal(data.total ?? 0);
        setRegistryPage(data.page ?? targetPage);
        setRegistryTotalPages(data.totalPages ?? 1);
      } catch {
        setPanelError('Unable to load MPIN registry.');
      } finally {
        setLoadingRegistry(false);
      }
    },
    [
      adminToken,
      isFirebaseCloudOnly,
      cloudItemsCache,
      loadFirebaseAccountData,
      adminFetch,
      sortBy,
      searchQuery,
      statusFilter,
      deviceFilter,
    ]
  );

  const loadAuditLogs = useCallback(
    async (targetPage = 1) => {
      if (!adminToken) {
        if (isFirebaseCloudOnly) {
          setLoadingLogs(true);
          try {
            const payload =
              cloudLogsCache.length > 0
                ? { dashboard: { logs: cloudLogsCache } }
                : await loadFirebaseAccountData(true);
            const allLogs = payload?.dashboard.logs ?? cloudLogsCache;
            const q = auditQuery.trim().toLowerCase();
            const filtered = allLogs.filter((log) => {
              if (auditOutcomeFilter && log.outcome !== auditOutcomeFilter) return false;
              if (q) {
                const hay = [log.mpin, log.reason, log.deviceId || '', log.loginIp || '']
                  .join(' ')
                  .toLowerCase();
                if (!hay.includes(q)) return false;
              }
              return true;
            });
            const pageSize = 50;
            const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
            const safePage = Math.min(totalPages, Math.max(1, targetPage));
            const start = (safePage - 1) * pageSize;
            setAuditLogs(filtered.slice(start, start + pageSize));
            setAuditTotal(filtered.length);
            setAuditPage(safePage);
            setAuditTotalPages(totalPages);
          } finally {
            setLoadingLogs(false);
          }
        }
        return;
      }
      setLoadingLogs(true);
      try {
        const qs = new URLSearchParams({
          page: String(targetPage),
          limit: '50',
        });
        if (auditQuery.trim()) qs.set('q', auditQuery.trim());
        if (auditOutcomeFilter) qs.set('outcome', auditOutcomeFilter);

        const res = await adminFetch(`/api/admin/logs?${qs.toString()}`);
        const data = (await res.json()) as {
          ok?: boolean;
          items?: AdminAuditLog[];
          total?: number;
          page?: number;
          totalPages?: number;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          setPanelError(data.error || 'Unable to load audit logs.');
          return;
        }
        setAuditLogs(data.items ?? []);
        setAuditTotal(data.total ?? 0);
        setAuditPage(data.page ?? targetPage);
        setAuditTotalPages(data.totalPages ?? 1);
      } catch {
        setPanelError('Unable to load audit logs.');
      } finally {
        setLoadingLogs(false);
      }
    },
    [
      adminToken,
      isFirebaseCloudOnly,
      cloudLogsCache,
      loadFirebaseAccountData,
      adminFetch,
      auditQuery,
      auditOutcomeFilter,
    ]
  );

  useEffect(() => {
    if (isUnlocked) {
      void loadStats();
    }
  }, [isUnlocked, loadStats]);

  useEffect(() => {
    if (isUnlocked) {
      void loadRegistry(1);
    }
  }, [isUnlocked, loadRegistry]);

  useEffect(() => {
    if (isUnlocked && activeTab === 'serial') {
      void loadSerialList(1, serialLimit, serialStatusFilter);
    }
  }, [isUnlocked, activeTab, loadSerialList, serialLimit, serialStatusFilter]);

  useEffect(() => {
    if (activeTab === 'serial' && highlightedSerial !== null) {
      const targetRow = document.querySelector(`[data-serial-id="${highlightedSerial}"]`);
      if (targetRow instanceof HTMLElement) {
        targetRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [activeTab, highlightedSerial, serialItems]);

  useEffect(() => {
    if (isUnlocked && activeTab === 'logs') {
      void loadAuditLogs(1);
    }
  }, [isUnlocked, activeTab, loadAuditLogs]);

  useEffect(() => {
    if (isUnlocked && activeTab === 'firebase' && firebaseUser?.emailVerified && isFirebaseAdmin) {
      void loadFirebaseAccountData(isFirebaseCloudOnly);
    }
  }, [
    isUnlocked,
    activeTab,
    firebaseUser,
    isFirebaseAdmin,
    isFirebaseCloudOnly,
    loadFirebaseAccountData,
  ]);

  const fetchServerMpinsForSync = useCallback(
    async (maxRecords: number, sortDir: 'asc' | 'desc' = 'desc'): Promise<AdminMpinRecord[]> => {
      const collected: AdminMpinRecord[] = [];
      let page = 1;
      while (collected.length < maxRecords) {
        const pageSize = Math.min(200, maxRecords - collected.length);
        const qs = new URLSearchParams({
          sortBy: 'id',
          sortDir,
          page: String(page),
          limit: String(pageSize),
        });
        const res = await adminFetch(`/api/admin/mpins?${qs.toString()}`);
        if (!res.ok) break;
        const data = (await res.json()) as {
          ok?: boolean;
          items?: AdminMpinRecord[];
          totalPages?: number;
        };
        const items = data.items ?? [];
        if (items.length === 0) break;
        collected.push(...items);
        if (page >= (data.totalPages ?? 1)) break;
        page += 1;
      }
      return collected.slice(0, maxRecords);
    },
    [adminFetch]
  );

  const syncBidirectionalWithFirebase = useCallback(
    async (announce = true) => {
      if (!adminToken || !firebaseUser?.emailVerified || !isFirebaseAdmin) return;
      setFirebaseSyncError(null);
      setSyncingFirebase(true);
      try {
        // 1. Pull MPINs & user login claims stored in Firebase Firestore into server SQLite
        const cloud = await adminFetchDashboardFromFirestore();
        let importedCount = 0;
        let updatedLocalCount = 0;
        if (cloud.items.length > 0) {
          for (let i = 0; i < cloud.items.length; i += 2000) {
            const slice = cloud.items.slice(i, i + 2000);
            const impRes = await adminFetch('/api/admin/mpins/import', {
              method: 'POST',
              body: JSON.stringify({ items: slice }),
            });
            if (impRes.ok) {
              const impData = (await impRes.json()) as {
                importedCount?: number;
                updatedCount?: number;
                stats?: AdminStats;
              };
              importedCount += impData.importedCount ?? 0;
              updatedLocalCount += impData.updatedCount ?? 0;
              if (impData.stats) setStats(impData.stats);
            }
          }
        }

        // 2. Push any unclaimed server MPINs / status updates to Firebase Firestore
        const targetLimit = Math.min(
          5000,
          Math.max(1, (stats?.totalGenerated ?? 0) + importedCount || 5000)
        );
        const records = await fetchServerMpinsForSync(targetLimit, 'asc');
        const result = await adminSyncServerMpinsToFirestore({
          records,
          enforceDeviceLock: stats?.enforceDeviceLock ?? cloud.stats.enforceDeviceLock,
          lastBatchId: stats?.lastBatchId ?? cloud.stats.lastBatchId ?? '',
          lastSerialNumber: Math.max(stats?.totalGenerated ?? 0, records.length),
          lastGeneratedAt: stats?.lastGeneratedAt ?? new Date().toISOString(),
        });

        await Promise.all([
          loadStats(),
          loadRegistry(1),
          activeTab === 'serial'
            ? loadSerialList(1, serialLimit, serialStatusFilter)
            : Promise.resolve(),
        ]);

        const msg = `Firebase synced: ${formatIndianNumber(importedCount + updatedLocalCount)} restored from cloud, ${formatIndianNumber(result.createdCount)} added & ${formatIndianNumber(result.updatedCount)} updated in Firestore${result.skippedCount > 0 ? ` (${formatIndianNumber(result.skippedCount)} local-bound skipped)` : ''}.`;
        setFirebaseLastSyncNote(msg);
        if (announce) setPanelNotice(msg);
      } catch (err) {
        setFirebaseSyncError(
          err instanceof Error ? err.message : 'Unable to sync MPINs with Firebase.'
        );
      } finally {
        setSyncingFirebase(false);
      }
    },
    [
      adminToken,
      firebaseUser,
      isFirebaseAdmin,
      adminFetch,
      fetchServerMpinsForSync,
      stats?.totalGenerated,
      stats?.enforceDeviceLock,
      stats?.lastBatchId,
      stats?.lastGeneratedAt,
      loadStats,
      loadRegistry,
      activeTab,
      loadSerialList,
      serialLimit,
      serialStatusFilter,
    ]
  );

  useEffect(() => {
    if (!adminToken || !firebaseUser?.emailVerified || !isFirebaseAdmin) {
      if (!firebaseUser) autoSyncedUidRef.current = null;
      return;
    }
    if (autoSyncedUidRef.current === firebaseUser.uid) return;
    autoSyncedUidRef.current = firebaseUser.uid;
    void syncBidirectionalWithFirebase(false);
  }, [adminToken, firebaseUser, isFirebaseAdmin, syncBidirectionalWithFirebase]);

  const handleConnectFirebase = async (unlockCloudMode = false) => {
    setFirebaseSyncError(null);
    if (unlockCloudMode) setAuthError(null);
    setConnectingFirebase(true);
    try {
      const activeUser =
        firebaseUser?.emailVerified ? firebaseUser : await signInWithGoogle();
      setFirebaseUser(activeUser);
      const allowed = await checkIsFirestoreAdmin(activeUser);
      setIsFirebaseAdmin(allowed);
      if (!allowed) {
        const msg = `Signed in as ${activeUser.email || 'user'}, which does not have Firebase Admin access. Sign in with the admin Google account (${ 'indsamantaabhijit3691@gmail.com' }).`;
        setFirebaseSyncError(msg);
        if (unlockCloudMode) setAuthError(msg);
      } else {
        if (unlockCloudMode) {
          setFirebaseCloudUnlocked(true);
        }
        setFirebaseLastSyncNote('Firebase Firestore connected — syncing MPINs & user claims...');
      }
    } catch (err) {
      const msg = formatFirebaseAuthError(err);
      setFirebaseSyncError(msg);
      if (unlockCloudMode) setAuthError(msg);
    } finally {
      setConnectingFirebase(false);
    }
  };

  const handleDisconnectFirebase = async () => {
    setFirebaseSyncError(null);
    try {
      await signOutFirebase();
      autoSyncedUidRef.current = null;
      setFirebaseUser(null);
      setIsFirebaseAdmin(false);
      setFirebaseCloudUnlocked(false);
      setFirebaseLastSyncNote(null);
      setCloudUsers([]);
      setCloudItemsCache([]);
      setCloudLogsCache([]);
    } catch (err) {
      setFirebaseSyncError(formatFirebaseAuthError(err));
    }
  };

  const handleSyncAllToFirebase = async () => {
    await syncBidirectionalWithFirebase(true);
  };

  const handleGenerateBatch = async () => {
    if (!isUnlocked) return;
    setPanelError(null);
    setPanelNotice(null);
    setGenerating(true);
    try {
      if (isFirebaseCloudOnly) {
        const cloudCount = Math.min(5000, Math.max(1, batchCount));
        const res = await adminGenerateMpinsInFirestore(
          cloudCount,
          expiryDays ? Number(expiryDays) : null
        );
        setLastBatchResult(res);
        await loadFirebaseAccountData(true);
        await loadRegistry(1);
        if (activeTab === 'serial') {
          await loadSerialList(1, serialLimit, serialStatusFilter);
        }
        setPanelNotice(
          `Generated ${formatIndianNumber(res.generatedCount)} unique MPINs directly in Firebase Firestore (${res.durationMs}ms)${batchCount > 5000 ? ' (Firestore batch limit: 5,000 per click)' : ''}.`
        );
        return;
      }

      const res = await adminFetch('/api/admin/mpins/generate', {
        method: 'POST',
        body: JSON.stringify({
          count: batchCount,
          expiryDays: expiryDays ? Number(expiryDays) : null,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        batchId?: string;
        generatedCount?: number;
        durationMs?: number;
        sampleMpins?: string[];
        stats?: AdminStats;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setPanelError(data.error || 'Failed to generate MPIN batch.');
        return;
      }
      if (data.stats) setStats(data.stats);
      const generatedTotal = data.generatedCount ?? batchCount;
      setLastBatchResult({
        batchId: data.batchId || 'BATCH',
        generatedCount: generatedTotal,
        durationMs: data.durationMs ?? 0,
        sampleMpins: data.sampleMpins ?? [],
      });

      let notice = `Generated ${formatIndianNumber(generatedTotal)} unique MPINs in ${data.durationMs ?? 0}ms.`;
      if (firebaseUser?.emailVerified && isFirebaseAdmin) {
        if (generatedTotal <= 2000) {
          try {
            const newest = await fetchServerMpinsForSync(generatedTotal, 'desc');
            const synced = await adminSyncServerMpinsToFirestore({
              records: newest,
              enforceDeviceLock: data.stats?.enforceDeviceLock ?? stats?.enforceDeviceLock ?? true,
              lastBatchId: data.batchId || '',
              lastSerialNumber: data.stats?.totalGenerated ?? generatedTotal,
              lastGeneratedAt: data.stats?.lastGeneratedAt ?? new Date().toISOString(),
            });
            notice += ` Synced ${formatIndianNumber(synced.createdCount)} MPINs to Firebase Firestore.`;
            setFirebaseLastSyncNote(`Last batch ${data.batchId || ''} synced to Firebase Firestore.`);
          } catch (err) {
            setFirebaseSyncError(
              err instanceof Error ? err.message : 'Server saved MPINs, but Firebase sync failed.'
            );
          }
        } else {
          setFirebaseLastSyncNote(
            'Batch exceeds 2,000 MPINs — saved on server. Click "Sync MPINs to Firebase" to push up to 5,000 at a time.'
          );
        }
      }

      setPanelNotice(notice);
      await loadRegistry(1);
      if (activeTab === 'serial') {
        await loadSerialList(1, serialLimit, serialStatusFilter);
      }
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Failed to generate MPINs.');
    } finally {
      setGenerating(false);
    }
  };

  const handleClearMpins = async (scope: 'all' | 'used-blocked-expired') => {
    if (!isUnlocked) return;
    setPanelError(null);
    setPanelNotice(null);
    setClearingScope(scope);
    try {
      if (isFirebaseCloudOnly) {
        const cloudRes = await adminClearMpinsInFirestore(scope);
        if (scope === 'all') setLastBatchResult(null);
        setSelectedDetail(null);
        setPendingClearScope(null);
        await loadFirebaseAccountData(true);
        await loadRegistry(1);
        if (activeTab === 'serial') {
          await loadSerialList(1, serialLimit, serialStatusFilter);
        }
        setPanelNotice(
          `Deleted ${formatIndianNumber(cloudRes.deletedCount)} MPINs from Firebase Firestore.`
        );
        return;
      }

      const res = await adminFetch('/api/admin/mpins/clear', {
        method: 'POST',
        body: JSON.stringify({ scope }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        deletedMpins?: number;
        stats?: AdminStats;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setPanelError(data.error || 'Failed to clear MPINs.');
        return;
      }
      if (scope === 'all') {
        setLastBatchResult(null);
      }
      setSelectedDetail(null);
      setPendingClearScope(null);
      if (data.stats) setStats(data.stats);
      const deletedCount = data.deletedMpins ?? 0;

      if (firebaseUser?.emailVerified && isFirebaseAdmin) {
        try {
          const cloudRes = await adminClearMpinsInFirestore(scope);
          setFirebaseLastSyncNote(
            `Cleared ${formatIndianNumber(cloudRes.deletedCount)} matching MPINs from Firebase Firestore.`
          );
        } catch (err) {
          setFirebaseSyncError(
            err instanceof Error ? err.message : 'Server cleared MPINs, but Firebase clear failed.'
          );
        }
      }

      setPanelNotice(
        scope === 'all'
          ? `Deleted all ${formatIndianNumber(deletedCount)} MPINs. Ready for fresh MPIN generation.`
          : `Deleted ${formatIndianNumber(deletedCount)} Used / Blocked / Expired MPINs.`
      );
      await loadRegistry(1);
      if (activeTab === 'serial') {
        await loadSerialList(1, serialLimit, serialStatusFilter);
      }
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Failed to delete MPINs.');
    } finally {
      setClearingScope(null);
    }
  };

  const handleJumpToSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number.parseInt(serialJumpInput.trim(), 10);
    if (!Number.isInteger(target) || target < 1) {
      setPanelError('Enter a valid Serial No. starting from 1.');
      return;
    }
    setPanelError(null);
    setHighlightedSerial(target);
    if (serialStatusFilter) {
      setSerialStatusFilter('');
    }
    const maxPages = Math.max(1, Math.ceil((stats?.totalGenerated ?? serialTotal) / serialLimit));
    const targetPage = Math.min(maxPages, Math.max(1, Math.ceil(target / serialLimit)));
    await loadSerialList(targetPage, serialLimit, '');
  };

  const handleMpinAction = async (
    mpin: string,
    action: 'block' | 'activate' | 'expire' | 'reset-failures' | 'toggle-device-lock'
  ) => {
    if (!isUnlocked) return;
    setPanelError(null);
    try {
      if (isFirebaseCloudOnly) {
        await adminUpdateMpinActionInFirestore(mpin, action);
        const refreshed = await loadFirebaseAccountData(true);
        const updatedRecord =
          refreshed?.dashboard.items.find((item) => item.mpin === mpin) ?? null;
        if (selectedDetail && updatedRecord && selectedDetail.record.mpin === mpin) {
          setSelectedDetail({
            record: updatedRecord,
            logs: (refreshed?.dashboard.logs ?? []).filter((l) => l.mpin === mpin),
          });
        }
        await loadRegistry(registryPage);
        if (activeTab === 'serial') {
          await loadSerialList(serialPage, serialLimit, serialStatusFilter);
        }
        return;
      }

      const res = await adminFetch(`/api/admin/mpins/${encodeURIComponent(mpin)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        record?: AdminMpinRecord;
        stats?: AdminStats;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setPanelError(data.error || 'Action failed.');
        return;
      }
      if (data.stats) setStats(data.stats);
      if (selectedDetail && data.record && selectedDetail.record.mpin === mpin) {
        setSelectedDetail({ ...selectedDetail, record: data.record });
      }
      if (firebaseUser?.emailVerified && isFirebaseAdmin) {
        try {
          await adminUpdateMpinActionInFirestore(mpin, action);
        } catch (err) {
          setFirebaseSyncError(
            err instanceof Error ? err.message : 'Unable to mirror MPIN update to Firebase.'
          );
        }
      }
      await loadRegistry(registryPage);
      if (activeTab === 'serial') {
        await loadSerialList(serialPage, serialLimit, serialStatusFilter);
      }
    } catch {
      setPanelError('Action failed.');
    }
  };

  const handleOpenDetail = async (mpin: string) => {
    if (!isUnlocked) return;
    if (isFirebaseCloudOnly) {
      const found = cloudItemsCache.find((item) => item.mpin === mpin);
      if (found) {
        setSelectedDetail({
          record: found,
          logs: cloudLogsCache.filter((l) => l.mpin === mpin),
        });
      } else {
        setPanelError('MPIN not found in Firestore cache. Click Refresh.');
      }
      return;
    }
    try {
      const res = await adminFetch(`/api/admin/mpins/${encodeURIComponent(mpin)}`);
      const data = (await res.json()) as {
        ok?: boolean;
        record?: AdminMpinRecord;
        logs?: AdminAuditLog[];
        error?: string;
      };
      if (res.ok && data.ok && data.record) {
        setSelectedDetail({
          record: data.record,
          logs: data.logs ?? [],
        });
      } else {
        setPanelError(data.error || 'Unable to load MPIN details.');
      }
    } catch {
      setPanelError('Unable to load MPIN details.');
    }
  };

  const handleExportCsv = async () => {
    if (!isUnlocked) return;
    try {
      let csvText = '';
      if (isFirebaseCloudOnly) {
        const rows = statusFilter
          ? cloudItemsCache.filter((r) => r.status === statusFilter)
          : cloudItemsCache;
        const header = [
          'Serial',
          'MPIN',
          'Status',
          'Linked User',
          'Mobile',
          'Batch',
          'Generated At',
          'First Login',
          'Last Login',
          'Logins',
          'Failed Attempts',
        ].join(',');
        const lines = rows.map((r) =>
          [
            r.id,
            r.mpin,
            r.status,
            JSON.stringify(r.boundUserName || ''),
            JSON.stringify(r.boundUserMobile || ''),
            JSON.stringify(r.batchId || ''),
            JSON.stringify(r.generatedAt || ''),
            JSON.stringify(r.firstLoginAt || ''),
            JSON.stringify(r.lastLoginAt || ''),
            r.totalLoginCount,
            r.failedAttempts,
          ].join(',')
        );
        csvText = [header, ...lines].join('\n');
      } else {
        const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
        const res = await adminFetch(`/api/admin/mpins/export${qs}`);
        if (!res.ok) {
          setPanelError('Failed to export MPIN CSV.');
          return;
        }
        csvText = await res.text();
      }
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'railone-mpins-export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setPanelError('Failed to export MPIN CSV.');
    }
  };

  const handleToggleDeviceLock = async () => {
    if (!stats || !isUnlocked) return;
    setPanelError(null);
    const nextLock = !stats.enforceDeviceLock;
    try {
      if (isFirebaseCloudOnly) {
        await adminToggleDeviceLockInFirestore(nextLock);
        setStats({ ...stats, enforceDeviceLock: nextLock });
        return;
      }
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ enforceDeviceLock: nextLock }),
      });
      const data = (await res.json()) as { ok?: boolean; stats?: AdminStats; error?: string };
      if (!res.ok || !data.ok) {
        setPanelError(data.error || 'Unable to update device lock policy.');
        return;
      }
      if (data.stats) setStats(data.stats);
      if (firebaseUser?.emailVerified && isFirebaseAdmin) {
        try {
          await adminToggleDeviceLockInFirestore(nextLock);
        } catch (err) {
          setFirebaseSyncError(
            err instanceof Error ? err.message : 'Unable to sync device lock policy to Firebase.'
          );
        }
      }
    } catch {
      setPanelError('Unable to update device lock policy.');
    }
  };

  const handleChangeAdminMpin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setPanelError(null);
    setPanelNotice(null);
    if (!currentAdminMpin.trim() || !newAdminMpin.trim()) {
      setPanelError('Enter both your current Admin PIN and new 6-character Admin PIN.');
      return;
    }
    setChangingAdminPin(true);
    try {
      const res = await adminFetch('/api/admin/auth/change', {
        method: 'POST',
        body: JSON.stringify({
          currentMpin: currentAdminMpin.trim(),
          newMpin: newAdminMpin.trim(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setPanelError(data.error || 'Unable to update Admin PIN.');
        return;
      }
      setCurrentAdminMpin('');
      setNewAdminMpin('');
      setPanelNotice('Admin PIN updated successfully.');
    } catch {
      setPanelError('Unable to update Admin PIN.');
    } finally {
      setChangingAdminPin(false);
    }
  };

  const copyPin = (pin: string) => {
    void navigator.clipboard?.writeText(pin);
    setCopiedMpin(pin);
    setTimeout(() => setCopiedMpin((prev) => (prev === pin ? null : prev)), 1500);
  };

  // =========================================================================
  // Admin PIN Authentication Gate (with Firebase Cloud Direct Unlock fallback)
  // =========================================================================
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-8">
            <span className="font-display text-lg font-bold tracking-tight text-[#0E1E5B] whitespace-nowrap shrink-0">
              RailOne Admin Console
            </span>
            <button
              type="button"
              onClick={onBackToApp}
              className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 whitespace-nowrap shrink-0 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to App
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-[#EAF4FF] text-[#0066FF] flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900">
                  {authMode === 'setup-required' ? 'Set First-Run Admin PIN' : 'Admin Panel Login'}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  {authMode === 'setup-required'
                    ? 'Create a 6-character Admin PIN (digits, uppercase & lowercase letters) to lock and manage RailOne MPINs.'
                    : 'Enter your 6-character Admin PIN to access MPIN generation, serial registry, and security controls.'}
                </p>
              </div>
            </div>

            {authChecking ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Checking Admin PIN status...
              </div>
            ) : authMode === 'setup-required' ? (
              <form onSubmit={handleAdminSetupSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="admin-setup-pin"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    New 6-Character Admin PIN
                  </label>
                  <div className="relative">
                    <input
                      id="admin-setup-pin"
                      type={showAuthPin ? 'text' : 'password'}
                      maxLength={6}
                      value={adminPinInput}
                      onChange={(e) => setAdminPinInput(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                      placeholder="e.g. Ad9Km2"
                      autoComplete="new-password"
                      autoFocus
                      className="w-full min-h-[46px] rounded-xl border border-slate-300 pl-3.5 pr-10 font-mono-num text-base font-bold tracking-widest text-[#0E1E5B] focus:outline-none focus:border-[#0066FF]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthPin((v) => !v)}
                      aria-label={showAuthPin ? 'Hide Admin PIN' : 'Show Admin PIN'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700"
                    >
                      {showAuthPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="admin-confirm-pin"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Confirm 6-Character Admin PIN
                  </label>
                  <input
                    id="admin-confirm-pin"
                    type={showAuthPin ? 'text' : 'password'}
                    maxLength={6}
                    value={adminConfirmInput}
                    onChange={(e) =>
                      setAdminConfirmInput(e.target.value.replace(/[^A-Za-z0-9]/g, ''))
                    }
                    placeholder="Re-enter Admin PIN"
                    autoComplete="new-password"
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 px-3.5 font-mono-num text-base font-bold tracking-widest text-[#0E1E5B] focus:outline-none focus:border-[#0066FF]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingAuth}
                  className="w-full min-h-[46px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <KeyRound className="h-4 w-4" />
                  {submittingAuth ? 'Saving Admin PIN...' : 'Set Admin PIN & Unlock'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="admin-login-pin"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Admin PIN
                  </label>
                  <div className="relative">
                    <input
                      id="admin-login-pin"
                      type={showAuthPin ? 'text' : 'password'}
                      maxLength={6}
                      value={adminPinInput}
                      onChange={(e) => setAdminPinInput(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                      placeholder="Enter 6-character PIN"
                      autoComplete="current-password"
                      autoFocus
                      className="w-full min-h-[46px] rounded-xl border border-slate-300 pl-3.5 pr-10 font-mono-num text-base font-bold tracking-widest text-[#0E1E5B] focus:outline-none focus:border-[#0066FF]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthPin((v) => !v)}
                      aria-label={showAuthPin ? 'Hide Admin PIN' : 'Show Admin PIN'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700"
                    >
                      {showAuthPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingAuth}
                  className="w-full min-h-[46px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Unlock className="h-4 w-4" />
                  {submittingAuth ? 'Verifying PIN...' : 'Unlock Admin Panel'}
                </button>
              </form>
            )}

            {authError && (
              <p
                role="alert"
                className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
              >
                {authError}
              </p>
            )}

            <div className="pt-4 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-700">Firebase Cloud Admin Access</span>
                <span className="font-mono-num text-[11px] text-slate-500">
                  {serverReachable === false ? 'Offline / APK Mode' : 'Cloud Ready'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {serverReachable === false
                  ? 'Local server is not running (e.g., standalone Android APK). Sign in with your Firebase Admin Google account to manage MPINs and users directly in Firebase.'
                  : 'Or unlock directly in Firebase Cloud Mode using your authorized Admin Google account.'}
              </p>
              <button
                type="button"
                onClick={() => void handleConnectFirebase(true)}
                disabled={connectingFirebase}
                className="w-full min-h-[42px] rounded-xl border border-[#84B8F6] bg-[#EAF4FF] hover:bg-[#DCEBFF] disabled:opacity-60 text-[#0052CC] text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Cloud className="h-4 w-4" />
                {connectingFirebase
                  ? 'Connecting Firebase Admin...'
                  : firebaseUser?.emailVerified && isFirebaseAdmin
                    ? `Open Cloud Admin (${firebaseUser.email})`
                    : 'Sign in with Firebase Admin Account'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // Authenticated Admin Console
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 sm:gap-8">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="font-display text-lg font-bold tracking-tight text-[#0E1E5B] whitespace-nowrap">
              RailOne Admin Console
            </span>
            {isFirebaseCloudOnly && (
              <span className="text-[11px] font-semibold text-[#0066FF] bg-[#EAF4FF] px-2 py-0.5 rounded-md whitespace-nowrap">
                Firebase Cloud Mode
              </span>
            )}
          </div>

          <nav aria-label="Admin Navigation" className="flex items-center gap-5 overflow-x-auto">
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'serial', label: 'Serial-Wise MPINs' },
                { id: 'registry', label: 'MPIN Registry' },
                { id: 'logs', label: 'Audit Logs' },
                { id: 'firebase', label: 'Firebase Account' },
                { id: 'security', label: 'Admin Security' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#0066FF] text-[#0066FF]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onBackToApp}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 whitespace-nowrap shrink-0 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to App
            </button>
            <button
              type="button"
              onClick={() => {
                setAdminToken(null);
                setFirebaseCloudUnlocked(false);
                setAdminPinInput('');
                setAuthError(null);
                setPanelError(null);
                setPanelNotice(null);
                setSelectedDetail(null);
                setActiveTab('overview');
              }}
              aria-label="Lock Admin Panel"
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs sm:text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Lock Admin
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {panelError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-800"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{panelError}</span>
            </div>
            <button type="button" onClick={() => setPanelError(null)} aria-label="Dismiss error">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {panelNotice && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{panelNotice}</span>
            </div>
            <button type="button" onClick={() => setPanelNotice(null)} aria-label="Dismiss notice">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* KPI Summary Row */}
        <section aria-label="MPIN Database Summary" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Total MPINs</p>
            <p className="font-mono-num text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {stats ? formatIndianNumber(stats.totalGenerated) : '—'}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-emerald-700">Active (Unused)</p>
            <p className="font-mono-num text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
              {stats ? formatIndianNumber(stats.activeCount) : '—'}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-[#0066FF]">Used</p>
            <p className="font-mono-num text-2xl font-bold text-[#0066FF] mt-1 tabular-nums">
              {stats ? formatIndianNumber(stats.usedCount) : '—'}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-rose-700">Blocked</p>
            <p className="font-mono-num text-2xl font-bold text-rose-700 mt-1 tabular-nums">
              {stats ? formatIndianNumber(stats.blockedCount) : '—'}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-amber-700">Expired</p>
            <p className="font-mono-num text-2xl font-bold text-amber-700 mt-1 tabular-nums">
              {stats ? formatIndianNumber(stats.expiredCount) : '—'}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Total Logins / Fails</p>
            <p className="font-mono-num text-xl font-bold text-slate-900 mt-1 tabular-nums">
              {stats
                ? `${formatIndianNumber(stats.totalSuccessfulLogins)} / ${formatIndianNumber(
                    stats.totalAuditFailures
                  )}`
                : '—'}
            </p>
          </div>
        </section>

        {/* OVERVIEW & 1 LAKH GENERATOR TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Firebase Firestore Cloud Database Card */}
            <section
              aria-label="Firebase Firestore Cloud Sync"
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    firestoreStatus === 'offline'
                      ? 'bg-rose-50 text-rose-600'
                      : firebaseUser && isFirebaseAdmin
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-[#EAF4FF] text-[#0066FF]'
                  }`}
                >
                  {firestoreStatus === 'offline' ? (
                    <CloudOff className="h-5 w-5" />
                  ) : (
                    <Cloud className="h-5 w-5" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-sm font-bold text-slate-900">
                      Firebase Firestore Cloud Database
                    </h2>
                    <span
                      className={`text-xs font-semibold ${
                        firestoreStatus === 'connected'
                          ? 'text-emerald-700'
                          : firestoreStatus === 'offline'
                            ? 'text-rose-700'
                            : 'text-amber-700'
                      }`}
                    >
                      · {firestoreStatus === 'connected' ? 'Connected' : firestoreStatus === 'offline' ? 'Offline' : 'Checking...'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono-num break-all">
                    DB: {firebaseConfig.firestoreDatabaseId}
                  </p>
                  {firebaseUser && isFirebaseAdmin ? (
                    <p className="text-xs text-emerald-700 font-medium">
                      Signed in as {firebaseUser.email} · Auto-syncing new MPINs &amp; updates to Firestore
                    </p>
                  ) : (
                    <p className="text-xs text-slate-600">
                      Connect your Admin Google account to sync server MPINs and controls with Firebase Firestore.
                    </p>
                  )}
                  {firebaseLastSyncNote && (
                    <p className="text-xs text-[#0066FF] font-medium">{firebaseLastSyncNote}</p>
                  )}
                  {firebaseSyncError && (
                    <p className="text-xs text-rose-700 font-medium">{firebaseSyncError}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href={getFirebaseConsoleDatabaseUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Firebase Console
                </a>
                {firebaseUser && isFirebaseAdmin ? (
                  <>
                    {isFirebaseCloudOnly ? (
                      <button
                        type="button"
                        onClick={() => void loadFirebaseAccountData(true)}
                        disabled={loadingCloudAccount}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 text-white text-xs font-semibold whitespace-nowrap transition-colors"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${loadingCloudAccount ? 'animate-spin' : ''}`}
                        />
                        {loadingCloudAccount ? 'Refreshing...' : 'Refresh Cloud Data'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSyncAllToFirebase()}
                        disabled={syncingFirebase}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 text-white text-xs font-semibold whitespace-nowrap transition-colors"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncingFirebase ? 'animate-spin' : ''}`} />
                        {syncingFirebase ? 'Syncing to Firebase...' : 'Sync MPINs to Firebase'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDisconnectFirebase()}
                      className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors"
                    >
                      Disconnect Firebase
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleConnectFirebase()}
                    disabled={connectingFirebase}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 text-white text-xs font-semibold whitespace-nowrap transition-colors"
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    {connectingFirebase ? 'Connecting Firebase...' : 'Connect Firebase Sync'}
                  </button>
                )}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-900">
                    Bulk Unique MPIN Generator (Up to 1,00,000)
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Generate cryptographically unique 6-character mixed-case alphanumeric MPINs for RailOne user login &amp; binding.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadStats()}
                    disabled={loadingStats}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
                    Refresh Stats
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportCsv()}
                    disabled={!stats || stats.totalGenerated === 0}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingClearScope('used-blocked-expired')}
                    disabled={
                      !stats ||
                      stats.usedCount + stats.blockedCount + stats.expiredCount === 0 ||
                      clearingScope !== null
                    }
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 disabled:opacity-45 text-xs font-semibold text-amber-800 whitespace-nowrap"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Used &amp; Blocked
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingClearScope('all')}
                    disabled={!stats || stats.totalGenerated === 0 || clearingScope !== null}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-45 text-xs font-semibold text-rose-700 whitespace-nowrap"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear All MPINs
                  </button>
                </div>
              </div>

              {pendingClearScope && (
                <div
                  role="alertdialog"
                  aria-label="Confirm MPIN deletion"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900"
                >
                  <div>
                    <p className="font-semibold">
                      {pendingClearScope === 'all'
                        ? `Delete all ${formatIndianNumber(stats?.totalGenerated ?? 0)} MPINs (Active, Used, Blocked, Expired) & audit logs?`
                        : `Delete all ${formatIndianNumber(
                            (stats?.usedCount ?? 0) +
                              (stats?.blockedCount ?? 0) +
                              (stats?.expiredCount ?? 0)
                          )} Used, Blocked & Expired MPINs?`}
                    </p>
                    <p className="text-rose-700 mt-0.5">
                      This permanently removes the selected MPINs so you can generate fresh MPINs cleanly.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPendingClearScope(null)}
                      disabled={clearingScope !== null}
                      className="min-h-[36px] px-3.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-100/50 text-xs font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleClearMpins(pendingClearScope)}
                      disabled={clearingScope !== null}
                      className="min-h-[36px] px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-xs font-semibold text-white"
                    >
                      {clearingScope ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-2">
                    Batch Quantity
                  </span>
                  <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    {[
                      { value: 100, label: '100' },
                      { value: 1000, label: '1K' },
                      { value: 10000, label: '10K' },
                      { value: 100000, label: '1 Lakh' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBatchCount(opt.value)}
                        className={`min-h-[38px] rounded-lg text-xs font-semibold tabular-nums transition-colors ${
                          batchCount === opt.value
                            ? 'bg-white text-[#0066FF] shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="mpin-expiry-select"
                    className="block text-xs font-semibold text-slate-700 mb-2"
                  >
                    Validity Window
                  </label>
                  <select
                    id="mpin-expiry-select"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:border-[#0066FF]"
                  >
                    <option value="">No Expiry (Lifetime until blocked)</option>
                    <option value="30">Valid for 30 Days</option>
                    <option value="90">Valid for 90 Days</option>
                    <option value="365">Valid for 365 Days</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => void handleGenerateBatch()}
                    disabled={generating}
                    className="w-full min-h-[44px] px-5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 text-white text-sm font-semibold transition-colors whitespace-nowrap"
                  >
                    {generating
                      ? `Generating ${formatIndianNumber(batchCount)} MPINs...`
                      : `Generate ${formatIndianNumber(batchCount)} Unique MPINs`}
                  </button>
                </div>
              </div>

              {lastBatchResult && (
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <span>
                      Latest Batch:{' '}
                      <strong className="font-mono-num text-slate-900">{lastBatchResult.batchId}</strong> ·{' '}
                      <strong className="font-mono-num text-slate-900">
                        {formatIndianNumber(lastBatchResult.generatedCount)}
                      </strong>{' '}
                      MPINs in{' '}
                      <strong className="font-mono-num text-slate-900">
                        {lastBatchResult.durationMs}ms
                      </strong>
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('serial')}
                        className="text-[#0066FF] font-semibold hover:underline"
                      >
                        View Serial-Wise MPINs →
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('registry')}
                        className="text-slate-600 font-semibold hover:underline"
                      >
                        Open Registry →
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-2">
                      Sample Generated MPINs (click to copy for mobile login testing):
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {lastBatchResult.sampleMpins.map((pin) => (
                        <button
                          key={pin}
                          type="button"
                          onClick={() => copyPin(pin)}
                          className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-[#EAF4FF] hover:border-[#84B8F6] transition-colors"
                        >
                          <span className="font-mono-num text-sm font-bold text-[#0E1E5B] tabular-nums">
                            {pin}
                          </span>
                          {copiedMpin === pin ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Quick Registry Preview */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Recent MPIN Records
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Showing latest MPINs · {formatIndianNumber(registryTotal)} total stored
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('serial')}
                    className="min-h-[38px] px-4 rounded-xl bg-[#EAF4FF] hover:bg-[#DCEBFF] text-xs font-semibold text-[#0066FF]"
                  >
                    Serial-Wise All MPINs
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('registry')}
                    className="min-h-[38px] px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                  >
                    Open Full Registry
                  </button>
                </div>
              </div>

              {loadingRegistry && registryItems.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">Loading MPIN records...</div>
              ) : registryItems.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
                  No MPINs generated yet. Select a batch quantity above and click &ldquo;Generate&rdquo; to populate the database.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="py-2.5 pr-3 whitespace-nowrap">Sr. No.</th>
                        <th className="py-2.5 px-3">MPIN</th>
                        <th className="py-2.5 px-3">Linked User</th>
                        <th className="py-2.5 px-3">Generated Date</th>
                        <th className="py-2.5 px-3">First Login</th>
                        <th className="py-2.5 px-3">Last Login</th>
                        <th className="py-2.5 px-3 text-right">Logins</th>
                        <th className="py-2.5 px-3">Device ID</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Login IP</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 pl-3 text-right">Fails</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {registryItems.slice(0, 10).map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="py-2.5 pr-3 font-mono-num font-semibold text-slate-500 tabular-nums whitespace-nowrap">
                            #{formatIndianNumber(row.id)}
                          </td>
                          <td className="py-2.5 px-3 font-mono-num font-bold text-[#0E1E5B] tabular-nums">
                            <button
                              type="button"
                              onClick={() => void handleOpenDetail(row.mpin)}
                              className="hover:underline"
                            >
                              {row.mpin}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 whitespace-nowrap">
                            {row.boundUserName ? (
                              <div>
                                <span className="font-semibold text-slate-900">{row.boundUserName}</span>
                                {row.boundUserMobile && (
                                  <span className="block font-mono-num text-[11px] text-slate-500">
                                    {row.boundUserMobile}
                                  </span>
                                )}
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono-num text-slate-600 tabular-nums whitespace-nowrap">
                            {formatDateTime(row.generatedAt)}
                          </td>
                          <td className="py-2.5 px-3 font-mono-num text-slate-600 tabular-nums whitespace-nowrap">
                            {formatDateTime(row.firstLoginAt)}
                          </td>
                          <td className="py-2.5 px-3 font-mono-num text-slate-600 tabular-nums whitespace-nowrap">
                            {formatDateTime(row.lastLoginAt)}
                          </td>
                          <td className="py-2.5 px-3 font-mono-num font-semibold text-right tabular-nums">
                            {row.totalLoginCount}
                          </td>
                          <td className="py-2.5 px-3 font-mono-num text-slate-700 tabular-nums">
                            {row.deviceId ?? '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {row.deviceType ?? '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono-num text-slate-600 tabular-nums">
                            {row.loginIp ?? '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusLabel status={row.status} />
                          </td>
                          <td className="py-2.5 pl-3 font-mono-num font-semibold text-right tabular-nums text-rose-700">
                            {row.failedAttempts}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* SERIAL-WISE ALL MPINS TAB */}
        {activeTab === 'serial' && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-lg font-bold text-slate-900">
                  Serial-Wise All MPINs (1 → {formatIndianNumber(serialTotal || stats?.totalGenerated || 0)})
                </h1>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {serialItems.length > 0
                    ? `Showing Serial #${formatIndianNumber(serialItems[0].id)} – #${formatIndianNumber(
                        serialItems[serialItems.length - 1].id
                      )} of ${formatIndianNumber(serialTotal)} MPINs`
                    : `${formatIndianNumber(serialTotal)} MPINs in serial order`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <form onSubmit={handleJumpToSerial} className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={serialJumpInput}
                    onChange={(e) => setSerialJumpInput(e.target.value)}
                    placeholder="Jump to Sr. No."
                    aria-label="Jump to Serial Number"
                    className="w-40 min-h-[40px] rounded-xl border border-slate-300 px-3 font-mono-num text-xs text-slate-800 focus:outline-none focus:border-[#0066FF]"
                  />
                  <button
                    type="submit"
                    className="min-h-[40px] px-3.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold whitespace-nowrap"
                  >
                    Go
                  </button>
                </form>

                <select
                  aria-label="Filter serial list by status"
                  value={serialStatusFilter}
                  onChange={(e) => {
                    const nextStatus = e.target.value;
                    setSerialStatusFilter(nextStatus);
                    setHighlightedSerial(null);
                    void loadSerialList(1, serialLimit, nextStatus);
                  }}
                  className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-700"
                >
                  <option value="">All Statuses</option>
                  <option value="Active">Active Only</option>
                  <option value="Used">Used Only</option>
                  <option value="Blocked">Blocked Only</option>
                  <option value="Expired">Expired Only</option>
                </select>

                <select
                  aria-label="Serial list rows per page"
                  value={serialLimit}
                  onChange={(e) => {
                    const nextLimit = Number(e.target.value);
                    setSerialLimit(nextLimit);
                    void loadSerialList(1, nextLimit, serialStatusFilter);
                  }}
                  className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-700"
                >
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                  <option value={200}>200 / page</option>
                </select>

                <button
                  type="button"
                  onClick={() => void loadSerialList(serialPage, serialLimit, serialStatusFilter)}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingSerial ? 'animate-spin' : ''}`} />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={() => void handleExportCsv()}
                  disabled={!stats || stats.totalGenerated === 0}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </button>
              </div>
            </div>

            {loadingSerial ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Loading MPINs in serial order...
              </div>
            ) : serialItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
                No MPINs found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-3 pr-3 whitespace-nowrap">Sr. No.</th>
                      <th className="py-3 px-3">MPIN</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Linked User</th>
                      <th className="py-3 px-3">Generated Date</th>
                      <th className="py-3 px-3">Last Login</th>
                      <th className="py-3 px-3 text-right">Logins</th>
                      <th className="py-3 px-3">Batch ID</th>
                      <th className="py-3 pl-3 text-right">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {serialItems.map((row) => {
                      const isHighlighted = highlightedSerial === row.id;
                      return (
                        <tr
                          key={row.id}
                          data-serial-id={row.id}
                          className={
                            isHighlighted
                              ? 'bg-[#EAF4FF] ring-1 ring-inset ring-[#84B8F6]'
                              : 'hover:bg-slate-50'
                          }
                        >
                          <td className="py-2.5 pr-3 font-mono-num font-bold text-slate-700 tabular-nums whitespace-nowrap">
                            #{formatIndianNumber(row.id)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleOpenDetail(row.mpin)}
                                className="font-mono-num text-sm font-bold text-[#0E1E5B] hover:underline tabular-nums"
                              >
                                {row.mpin}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyPin(row.mpin)}
                                aria-label={`Copy MPIN ${row.mpin}`}
                                className="text-slate-400 hover:text-[#0066FF] p-1"
                              >
                                {copiedMpin === row.mpin ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusLabel status={row.status} />
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 whitespace-nowrap">
                            {row.boundUserName ? (
                              <div>
                                <span className="font-semibold text-slate-900">{row.boundUserName}</span>
                                {row.boundUserMobile && (
                                  <span className="block font-mono-num text-[11px] text-slate-500">
                                    {row.boundUserMobile}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">Available</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono-num text-slate-600 tabular-nums whitespace-nowrap">
                            {formatDateTime(row.generatedAt)}
                          </td>
                          <td className="py-2.5 px-3 font-mono-num text-slate-600 tabular-nums whitespace-nowrap">
                            {formatDateTime(row.lastLoginAt)}
                          </td>
                          <td className="py-2.5 px-3 font-mono-num font-semibold text-right tabular-nums">
                            {row.totalLoginCount}
                          </td>
                          <td className="py-2.5 px-3 font-mono-num text-slate-500 whitespace-nowrap">
                            {row.batchId}
                          </td>
                          <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {row.status === 'Blocked' || row.status === 'Expired' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleMpinAction(row.mpin, 'activate')}
                                  className="px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold"
                                >
                                  Activate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleMpinAction(row.mpin, 'block')}
                                  className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold"
                                >
                                  Block
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleOpenDetail(row.mpin)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold"
                              >
                                Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
              <span className="tabular-nums">
                Page {formatIndianNumber(serialPage)} of {formatIndianNumber(serialTotalPages)} ·{' '}
                {formatIndianNumber(serialTotal)} total MPINs
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={serialPage <= 1}
                  onClick={() => void loadSerialList(1, serialLimit, serialStatusFilter)}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-semibold"
                >
                  First
                </button>
                <button
                  type="button"
                  disabled={serialPage <= 1}
                  onClick={() => void loadSerialList(serialPage - 1, serialLimit, serialStatusFilter)}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-semibold"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={serialPage >= serialTotalPages}
                  onClick={() => void loadSerialList(serialPage + 1, serialLimit, serialStatusFilter)}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-semibold"
                >
                  Next
                </button>
                <button
                  type="button"
                  disabled={serialPage >= serialTotalPages}
                  onClick={() => void loadSerialList(serialTotalPages, serialLimit, serialStatusFilter)}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-semibold"
                >
                  Last
                </button>
              </div>
            </div>
          </section>
        )}

        {/* MPIN REGISTRY TAB */}
        {activeTab === 'registry' && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-lg font-bold text-slate-900">
                  MPIN Database Registry
                </h1>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {formatIndianNumber(registryTotal)} matching MPIN records
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void loadRegistry(1);
                    }}
                    placeholder="Search #Serial, MPIN, User, Mobile..."
                    aria-label="Search MPIN registry"
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 pl-9 pr-3 text-xs text-slate-800 focus:outline-none focus:border-[#0066FF]"
                  />
                </div>

                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-700"
                >
                  <option value="">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Used">Used</option>
                  <option value="Blocked">Blocked</option>
                  <option value="Expired">Expired</option>
                </select>

                <select
                  aria-label="Filter by device type"
                  value={deviceFilter}
                  onChange={(e) => setDeviceFilter(e.target.value)}
                  className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-700"
                >
                  <option value="">All Devices</option>
                  <option value="Android">Android</option>
                  <option value="iOS">iOS</option>
                </select>

                <select
                  aria-label="Sort MPIN records"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-700"
                >
                  <option value="serialAsc">Serial No. (1 → N)</option>
                  <option value="id">Newest Generated</option>
                  <option value="lastLoginAt">Last Login</option>
                  <option value="totalLoginCount">Highest Login Count</option>
                  <option value="failedAttempts">Most Failed Attempts</option>
                  <option value="mpin">MPIN Ascending</option>
                </select>

                <button
                  type="button"
                  onClick={() => void loadRegistry(1)}
                  className="min-h-[40px] px-4 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold"
                >
                  Apply
                </button>
              </div>
            </div>

            {loadingRegistry ? (
              <div className="py-12 text-center text-sm text-slate-500">Loading MPIN records...</div>
            ) : registryItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
                No MPIN records match the current filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-3 pr-3 whitespace-nowrap">Sr. No.</th>
                      <th className="py-3 px-3">MPIN</th>
                      <th className="py-3 px-3">Linked User</th>
                      <th className="py-3 px-3">Generated Date</th>
                      <th className="py-3 px-3">First Login</th>
                      <th className="py-3 px-3">Last Login</th>
                      <th className="py-3 px-3 text-right">Logins</th>
                      <th className="py-3 px-3">Device ID</th>
                      <th className="py-3 px-3">Device</th>
                      <th className="py-3 px-3">Login IP</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Failed</th>
                      <th className="py-3 pl-3 text-right">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registryItems.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-3 font-mono-num font-semibold text-slate-500 tabular-nums whitespace-nowrap">
                          #{formatIndianNumber(row.id)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleOpenDetail(row.mpin)}
                              className="font-mono-num font-bold text-[#0E1E5B] hover:underline tabular-nums"
                            >
                              {row.mpin}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyPin(row.mpin)}
                              aria-label={`Copy MPIN ${row.mpin}`}
                              className="text-slate-400 hover:text-[#0066FF] p-1"
                            >
                              {copiedMpin === row.mpin ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 whitespace-nowrap">
                          {row.boundUserName ? (
                            <div>
                              <span className="font-semibold text-slate-900">{row.boundUserName}</span>
                              {row.boundUserMobile && (
                                <span className="block font-mono-num text-[11px] text-slate-500">
                                  {row.boundUserMobile}
                                </span>
                              )}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-slate-600 tabular-nums whitespace-nowrap">
                          {formatDateTime(row.generatedAt)}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-slate-600 tabular-nums whitespace-nowrap">
                          {formatDateTime(row.firstLoginAt)}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-slate-600 tabular-nums whitespace-nowrap">
                          {formatDateTime(row.lastLoginAt)}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num font-semibold text-right tabular-nums">
                          {row.totalLoginCount}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-slate-700 tabular-nums">
                          {row.deviceId ?? '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {row.deviceType ?? '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-slate-600 tabular-nums">
                          {row.loginIp ?? '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusLabel status={row.status} />
                        </td>
                        <td className="py-2.5 px-3 font-mono-num font-semibold text-right tabular-nums text-rose-700">
                          {row.failedAttempts}
                        </td>
                        <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {row.status === 'Blocked' || row.status === 'Expired' ? (
                              <button
                                type="button"
                                onClick={() => void handleMpinAction(row.mpin, 'activate')}
                                className="px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold"
                              >
                                Activate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleMpinAction(row.mpin, 'block')}
                                className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold"
                              >
                                Block
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleOpenDetail(row.mpin)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-600">
              <span className="tabular-nums">
                Page {registryPage} of {formatIndianNumber(registryTotalPages)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={registryPage <= 1}
                  onClick={() => void loadRegistry(registryPage - 1)}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-semibold"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={registryPage >= registryTotalPages}
                  onClick={() => void loadRegistry(registryPage + 1)}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        )}

        {/* AUDIT LOGS TAB */}
        {activeTab === 'logs' && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-lg font-bold text-slate-900">
                  Login Verification Audit Logs
                </h1>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {formatIndianNumber(auditTotal)} verification events recorded
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={auditQuery}
                  onChange={(e) => setAuditQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void loadAuditLogs(1);
                  }}
                  placeholder="Filter MPIN, reason, IP..."
                  aria-label="Filter audit logs"
                  className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-xs text-slate-800"
                />
                <select
                  aria-label="Filter log outcome"
                  value={auditOutcomeFilter}
                  onChange={(e) => setAuditOutcomeFilter(e.target.value)}
                  className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-700"
                >
                  <option value="">All Outcomes</option>
                  <option value="Success">Success</option>
                  <option value="Failed">Failed</option>
                </select>
                <button
                  type="button"
                  onClick={() => void loadAuditLogs(1)}
                  className="min-h-[40px] px-4 rounded-xl bg-[#0066FF] text-white text-xs font-semibold"
                >
                  Refresh
                </button>
              </div>
            </div>

            {loadingLogs ? (
              <div className="py-10 text-center text-sm text-slate-500">Loading audit logs...</div>
            ) : auditLogs.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
                No login attempts logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2.5 pr-3">Attempted At</th>
                      <th className="py-2.5 px-3">MPIN</th>
                      <th className="py-2.5 px-3">Outcome</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-3">Device ID</th>
                      <th className="py-2.5 px-3">Device</th>
                      <th className="py-2.5 pl-3">Login IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-3 font-mono-num text-slate-600 tabular-nums whitespace-nowrap">
                          {formatDateTime(log.attemptedAt)}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num font-bold text-slate-900 tabular-nums">
                          {log.mpin}
                        </td>
                        <td className="py-2.5 px-3 font-semibold">
                          {log.outcome === 'Success' ? (
                            <span className="text-emerald-700">Success</span>
                          ) : (
                            <span className="text-rose-700">Failed</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{log.reason}</td>
                        <td className="py-2.5 px-3 font-mono-num text-slate-600 tabular-nums">
                          {log.deviceId ?? '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{log.deviceType ?? '—'}</td>
                        <td className="py-2.5 pl-3 font-mono-num text-slate-600 tabular-nums">
                          {log.loginIp ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-600">
              <span className="tabular-nums">
                Page {auditPage} of {auditTotalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={auditPage <= 1}
                  onClick={() => void loadAuditLogs(auditPage - 1)}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-200 disabled:opacity-40 font-semibold"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={auditPage >= auditTotalPages}
                  onClick={() => void loadAuditLogs(auditPage + 1)}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-200 disabled:opacity-40 font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        )}

        {/* FIREBASE ACCOUNT LIVE CONSOLE TAB */}
        {activeTab === 'firebase' && (
          <div className="space-y-6">
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-5 w-5 text-[#0066FF]" />
                    <h1 className="font-display text-lg font-bold text-slate-900">
                      Firebase Account &amp; Cloud Collections
                    </h1>
                  </div>
                  <p className="text-xs text-slate-500 font-mono-num break-all">
                    Project: {firebaseConfig.projectId} · Database: {firebaseConfig.firestoreDatabaseId}
                  </p>
                  <p className="text-xs text-slate-600">
                    {firebaseUser && isFirebaseAdmin
                      ? `Signed in as ${firebaseUser.email} — viewing live documents stored in your Firebase Firestore database.`
                      : 'Connect your Admin Google account to inspect all MPINs, user claims, wallets, and bookings stored in your Firebase account.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href={getFirebaseConsoleDatabaseUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 whitespace-nowrap"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Firebase Console
                  </a>
                  {firebaseUser && isFirebaseAdmin ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void loadFirebaseAccountData(isFirebaseCloudOnly)}
                        disabled={loadingCloudAccount}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 text-white text-xs font-semibold whitespace-nowrap"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${loadingCloudAccount ? 'animate-spin' : ''}`}
                        />
                        {loadingCloudAccount ? 'Loading Firebase...' : 'Refresh Firebase Data'}
                      </button>
                      {adminToken && (
                        <button
                          type="button"
                          onClick={() => void handleSyncAllToFirebase()}
                          disabled={syncingFirebase}
                          className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl border border-[#84B8F6] bg-[#EAF4FF] hover:bg-[#DCEBFF] disabled:opacity-60 text-[#0052CC] text-xs font-semibold whitespace-nowrap"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${syncingFirebase ? 'animate-spin' : ''}`}
                          />
                          Two-Way Sync
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleConnectFirebase(false)}
                      disabled={connectingFirebase}
                      className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 text-white text-xs font-semibold whitespace-nowrap"
                    >
                      <Cloud className="h-3.5 w-3.5" />
                      {connectingFirebase ? 'Connecting...' : 'Connect Firebase Admin'}
                    </button>
                  )}
                </div>
              </div>

              {firebaseUser && isFirebaseAdmin && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                  <div className="border border-slate-200 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-500 font-mono-num">mpinCodes</p>
                    <p className="font-mono-num text-xl font-bold text-slate-900 mt-1 tabular-nums">
                      {formatIndianNumber(cloudItemsCache.length)}
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-500 font-mono-num">mpinClaims</p>
                    <p className="font-mono-num text-xl font-bold text-[#0066FF] mt-1 tabular-nums">
                      {formatIndianNumber(
                        cloudItemsCache.filter((item) => Boolean(item.boundUserName || item.boundUserKey))
                          .length
                      )}
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-500 font-mono-num">
                      users / accounts
                    </p>
                    <p className="font-mono-num text-xl font-bold text-emerald-700 mt-1 tabular-nums">
                      {formatIndianNumber(cloudUsers.length)}
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-500 font-mono-num">loginLogs</p>
                    <p className="font-mono-num text-xl font-bold text-slate-900 mt-1 tabular-nums">
                      {formatIndianNumber(cloudLogsCache.length)}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {firebaseUser && isFirebaseAdmin && (
              <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#0066FF]" />
                    <h2 className="font-display text-base font-bold text-slate-900">
                      Registered Firebase Users &amp; RailOne Accounts
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {formatIndianNumber(cloudUsers.length)} accounts in Firestore
                  </span>
                </div>

                {loadingCloudAccount && cloudUsers.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    Loading users from Firebase Firestore...
                  </div>
                ) : cloudUsers.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
                    No user accounts stored in Firestore yet. Users appear here automatically once they connect Google Sign-In and log in with an MPIN.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                          <th className="py-2.5 pr-3">User Name</th>
                          <th className="py-2.5 px-3">Mobile</th>
                          <th className="py-2.5 px-3">Bound MPIN</th>
                          <th className="py-2.5 px-3 text-right">R-Wallet</th>
                          <th className="py-2.5 px-3 text-right">Bookings</th>
                          <th className="py-2.5 px-3">Google Email</th>
                          <th className="py-2.5 pl-3">Last Synced</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cloudUsers.map((u) => (
                          <tr key={`${u.uid}-${u.accountKey}`} className="hover:bg-slate-50">
                            <td className="py-2.5 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                              {u.userName}
                            </td>
                            <td className="py-2.5 px-3 font-mono-num text-slate-700 tabular-nums whitespace-nowrap">
                              {u.userMobile || '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono-num font-bold text-[#0E1E5B] tabular-nums whitespace-nowrap">
                              {u.mpin || '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono-num font-semibold text-right text-emerald-700 tabular-nums whitespace-nowrap">
                              ₹{u.rWalletBalance.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 font-mono-num font-semibold text-right tabular-nums">
                              {u.bookingsCount}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                              {u.email || '—'}
                            </td>
                            <td className="py-2.5 pl-3 font-mono-num text-slate-500 tabular-nums whitespace-nowrap">
                              {formatDateTime(u.updatedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* ADMIN SECURITY TAB */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <KeyRound className="h-5 w-5 text-[#0066FF]" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  Admin PIN Credentials
                </h2>
              </div>

              {isFirebaseCloudOnly ? (
                <p className="text-xs text-slate-600">
                  Unlocked in <strong>Firebase Cloud Mode</strong> as{' '}
                  <span className="font-mono-num">{firebaseUser?.email}</span>. Server Admin PIN rotation is available when connected to the Node/SQLite backend server.
                </p>
              ) : authMode === 'env' ? (
                <p className="text-xs text-slate-600">
                  Admin PIN is currently configured via the server <code>ADMIN_MPIN</code> environment setting. Remove or update it in server environment settings to switch back to database-stored PIN rotation.
                </p>
              ) : (
                <form onSubmit={handleChangeAdminMpin} className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Rotate your 6-character Admin PIN (requires digits, uppercase &amp; lowercase letters).
                  </p>
                  <div>
                    <label
                      htmlFor="current-admin-pin"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Current Admin PIN
                    </label>
                    <input
                      id="current-admin-pin"
                      type="password"
                      maxLength={6}
                      value={currentAdminMpin}
                      onChange={(e) =>
                        setCurrentAdminMpin(e.target.value.replace(/[^A-Za-z0-9]/g, ''))
                      }
                      placeholder="Current 6-char PIN"
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 font-mono-num text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="new-admin-pin"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      New 6-Character Admin PIN
                    </label>
                    <input
                      id="new-admin-pin"
                      type="password"
                      maxLength={6}
                      value={newAdminMpin}
                      onChange={(e) =>
                        setNewAdminMpin(e.target.value.replace(/[^A-Za-z0-9]/g, ''))
                      }
                      placeholder="New 6-char PIN"
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 font-mono-num text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={changingAdminPin}
                    className="min-h-[42px] px-5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                  >
                    {changingAdminPin ? 'Updating PIN...' : 'Update Admin PIN'}
                  </button>
                </form>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="h-5 w-5 text-[#0066FF]" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  Device Binding &amp; Auto-Block Policy
                </h2>
              </div>

              <p className="text-sm text-slate-600">
                When single-device lock is enabled, any <strong>Used</strong> MPIN attempted from a different Device ID is rejected, increments Failed Login Attempts, and automatically changes status to <strong>Blocked</strong> after 5 failed attempts.
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Enforce Global Single-Device Lock
                  </p>
                  <p className="text-xs text-slate-500">
                    Currently: {stats?.enforceDeviceLock ? 'Enabled' : 'Disabled (multi-device allowed)'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleDeviceLock()}
                  className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold border transition-colors ${
                    stats?.enforceDeviceLock
                      ? 'bg-[#0066FF] text-white border-[#0066FF]'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {stats?.enforceDeviceLock ? 'Disable Lock' : 'Enable Lock'}
                </button>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <Cloud className="h-5 w-5 text-[#0066FF]" />
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900">
                      Firebase Firestore Database Connection
                    </h2>
                    <p className="text-xs text-slate-500 font-mono-num">
                      Project: {firebaseConfig.projectId} · Database: {firebaseConfig.firestoreDatabaseId}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {firebaseUser && isFirebaseAdmin ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleSyncAllToFirebase()}
                        disabled={syncingFirebase}
                        className="min-h-[40px] px-4 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncingFirebase ? 'animate-spin' : ''}`} />
                        {syncingFirebase ? 'Syncing...' : 'Sync MPINs to Firebase'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDisconnectFirebase()}
                        className="min-h-[40px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                      >
                        Disconnect Firebase
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleConnectFirebase()}
                      disabled={connectingFirebase}
                      className="min-h-[40px] px-4 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Cloud className="h-3.5 w-3.5" />
                      {connectingFirebase ? 'Connecting...' : 'Connect Firebase Sync'}
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-600">
                {firebaseUser && isFirebaseAdmin
                  ? `Connected as ${firebaseUser.email}. New MPIN batches (up to 2,000 per batch), status changes, clears, and device lock updates automatically mirror to Firebase Firestore alongside the Admin PIN database.`
                  : 'Admin Panel login remains protected by your 6-character Admin PIN. Connect your authorized Google Admin account here to enable two-way Firebase Firestore backup & sync.'}
              </p>
              {firebaseSyncError && (
                <p className="text-xs font-medium text-rose-700">{firebaseSyncError}</p>
              )}
            </section>
          </div>
        )}
      </main>

      {/* MPIN Record Detail Modal */}
      {selectedDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`MPIN ${selectedDetail.record.mpin} Details`}
          onClick={() => setSelectedDetail(null)}
          className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-xs text-slate-500">
                  MPIN Record Telemetry · Serial #{formatIndianNumber(selectedDetail.record.id)}
                </p>
                <h3 className="font-mono-num text-2xl font-bold text-[#0E1E5B] tabular-nums">
                  {selectedDetail.record.mpin}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                aria-label="Close MPIN details"
                className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="border border-slate-200 rounded-xl p-3">
                <p className="text-slate-500">Current Status</p>
                <div className="mt-1">
                  <StatusLabel status={selectedDetail.record.status} />
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl p-3">
                <p className="text-slate-500">Total Login Count</p>
                <p className="font-mono-num text-base font-bold text-slate-900 mt-0.5 tabular-nums">
                  {selectedDetail.record.totalLoginCount}
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl p-3">
                <p className="text-slate-500">MPIN Generated Date</p>
                <p className="font-mono-num text-slate-800 mt-0.5 tabular-nums">
                  {formatDateTime(selectedDetail.record.generatedAt)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl p-3">
                <p className="text-slate-500">Failed Login Attempts</p>
                <p className="font-mono-num text-base font-bold text-rose-700 mt-0.5 tabular-nums">
                  {selectedDetail.record.failedAttempts}
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl p-3">
                <p className="text-slate-500">First Successful Login</p>
                <p className="font-mono-num text-slate-800 mt-0.5 tabular-nums">
                  {formatDateTime(selectedDetail.record.firstLoginAt)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl p-3">
                <p className="text-slate-500">Last Successful Login</p>
                <p className="font-mono-num text-slate-800 mt-0.5 tabular-nums">
                  {formatDateTime(selectedDetail.record.lastLoginAt)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl p-3">
                <p className="text-slate-500">Linked User Name</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {selectedDetail.record.boundUserName ?? 'Unclaimed'}
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl p-3">
                <p className="text-slate-500">Linked Mobile Number</p>
                <p className="font-mono-num text-slate-800 mt-0.5 tabular-nums">
                  {selectedDetail.record.boundUserMobile ?? '—'}
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl p-3">
                <p className="text-slate-500">Device ID</p>
                <p className="font-mono-num text-slate-800 mt-0.5 tabular-nums">
                  {selectedDetail.record.deviceId ?? '—'}
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl p-3">
                <p className="text-slate-500">Device Type &amp; IP</p>
                <p className="font-mono-num text-slate-800 mt-0.5 tabular-nums">
                  {selectedDetail.record.deviceType ?? '—'} · {selectedDetail.record.loginIp ?? '—'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleMpinAction(selectedDetail.record.mpin, 'activate')}
                className="min-h-[38px] px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold"
              >
                Activate
              </button>
              <button
                type="button"
                onClick={() => void handleMpinAction(selectedDetail.record.mpin, 'block')}
                className="min-h-[38px] px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold"
              >
                Block
              </button>
              <button
                type="button"
                onClick={() => void handleMpinAction(selectedDetail.record.mpin, 'expire')}
                className="min-h-[38px] px-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold"
              >
                Mark Expired
              </button>
              <button
                type="button"
                onClick={() => void handleMpinAction(selectedDetail.record.mpin, 'reset-failures')}
                className="min-h-[38px] px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold"
              >
                Reset Failed Count
              </button>
              <button
                type="button"
                onClick={() =>
                  void handleMpinAction(selectedDetail.record.mpin, 'toggle-device-lock')
                }
                className="min-h-[38px] px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold inline-flex items-center gap-1"
              >
                {selectedDetail.record.deviceLocked ? (
                  <>
                    <Unlock className="h-3.5 w-3.5" /> Device Lock: On
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" /> Device Lock: Off
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-700">Recent Verification History</h4>
              {selectedDetail.logs.length === 0 ? (
                <p className="text-xs text-slate-500">No verification attempts yet for this MPIN.</p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {selectedDetail.logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-2 text-[11px] border border-slate-100 rounded-lg px-2.5 py-2"
                    >
                      <div>
                        <span
                          className={`font-semibold ${
                            log.outcome === 'Success' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {log.outcome}
                        </span>{' '}
                        · <span className="text-slate-700">{log.reason}</span>
                      </div>
                      <span className="font-mono-num text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDateTime(log.attemptedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
