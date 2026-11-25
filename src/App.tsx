import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import {
  Bell,
  Home,
  Menu as MenuIcon,
  Ticket,
  User,
  X,
} from 'lucide-react';
import {
  auth,
  getFirestoreConnectionStatus,
  signInWithGoogle,
  signOutFirebase,
  subscribeFirestoreStatus,
  type FirestoreConnectionStatus,
} from './lib/firebase';
import { apiUrl } from './lib/apiClient';
import {
  checkMpinStatusInFirestore,
  loadAllUserAccountsFromFirestore,
  saveUserAccountToFirestore,
  verifyAndClaimMpinInFirestore,
} from './lib/railFirestore';
import { AdminPanelView } from './components/AdminPanelView';
import { AuthSSOModal } from './components/AuthSSOModal';
import { BookingsView } from './components/BookingsView';
import { HomeView } from './components/HomeView';
import { MenuView } from './components/MenuView';
import { MpinLoginScreen } from './components/MpinLoginScreen';
import {
  CoachPositionView,
  FileRefundView,
  OrderFoodView,
  PnrStatusView,
  RailMadadView,
  TrackTrainView,
  TravelFeedbackView,
} from './components/RailServicesViews';
import { ReservedBookingView } from './components/ReservedBookingView';
import { StationSearchExplorer } from './components/StationSearchExplorer';
import { TrainSearchScheduleView } from './components/TrainSearchScheduleView';
import { UnreservedBookingView } from './components/UnreservedBookingView';
import { UpcomingBookingDetailsScreen } from './components/UpcomingBookingDetailsScreen';
import { YouView } from './components/YouView';
import {
  INITIAL_NEW_USER_WALLET_BALANCE,
  type MpinAuthSession,
  PENDING_USER_KEY,
  type UserDataSnapshot,
  createCleanNewUserData,
  deductWalletBalance,
  formatBookingKindLabel,
  formatTransactionTimeLabel,
  generateTransactionId,
  getUpcomingBookings,
  getUserDataStorageKey,
  hasRegisteredOneTimeMpin,
  isPendingUserOnboarding,
  isWalletExhausted,
  logoutToMpinScreen,
  normalizeAuthUserKey,
  normalizeExpiredBookings,
  resolveFreshInstallSession,
  resolveInitialMpinAuthSession,
  resolveInitialUserProfile,
  resolveUserDataSnapshot,
  submitMpinLogin,
  switchOrCreateAuthUser,
} from './utils/railLogic';
import {
  RAIL_STATIONS,
  SEED_BOOKINGS,
  SEED_COMPLAINTS,
  SEED_SAVED_PASSENGERS,
  SEED_USER_PROFILE,
  SEED_WALLET_TRANSACTIONS,
  UI_LABELS,
} from './data/railData';
import type {
  ActiveScreen,
  BookingRecord,
  FeedbackEntry,
  LanguageCode,
  MainTab,
  RailMadadComplaint,
  SavedPassenger,
  UserProfile,
  WalletTransaction,
} from './types/rail';
import type {
  EasternRailwaySuburbanFareDb,
  KolkataSuburbanDb,
} from './types/suburban';
import {
  buildSuburbanIndex,
  getOfficialEasternRailwayFareDb,
  mergeUnifiedStations,
  setOfficialEasternRailwayFareDb,
} from './utils/suburbanLogic';
import {
  detectClientDeviceType,
  getOrCreateClientDeviceId,
} from './utils/deviceMetadata';

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('home');
  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return window.location.pathname === '/admin' || params.get('admin') === '1';
    } catch {
      return false;
    }
  });
  const [language, setLanguage] = useState<LanguageCode>(() =>
    loadStored<LanguageCode>('railone_lang', 'en')
  );

  const [initialBoot] = useState<{
    authSession: MpinAuthSession;
    userData: UserDataSnapshot;
  }>(() => {
    let storedAuthRaw: string | null = null;
    let storedV2Raw: string | null = null;
    let legacyStoredRaw: string | null = null;
    try {
      storedAuthRaw = localStorage.getItem('railone_auth_v1');
      storedV2Raw = localStorage.getItem('railone_profile_v2');
      legacyStoredRaw = localStorage.getItem('railone_profile');
    } catch {
      storedAuthRaw = null;
    }

    if (!storedAuthRaw && !storedV2Raw && !legacyStoredRaw) {
      return {
        authSession: resolveFreshInstallSession(),
        userData: createCleanNewUserData({
          userKey: PENDING_USER_KEY,
          name: '',
          mobile: '',
          initialBalance: INITIAL_NEW_USER_WALLET_BALANCE,
          mpinSet: false,
          allowEmptyName: true,
        }),
      };
    }

    const legacyProfile = (() => {
      try {
        return resolveInitialUserProfile({
          seedProfile: SEED_USER_PROFILE,
          storedV2Raw,
          legacyStoredRaw,
        });
      } catch {
        return SEED_USER_PROFILE;
      }
    })();

    const initialAuth = (() => {
      try {
        return resolveInitialMpinAuthSession({
          storedRaw: storedAuthRaw,
          profile: legacyProfile,
        });
      } catch {
        return resolveInitialMpinAuthSession({ storedRaw: null, profile: SEED_USER_PROFILE });
      }
    })();

    const activeKey = normalizeAuthUserKey(initialAuth.activeUserKey);
    const activeSummary = initialAuth.usersByKey[activeKey];
    let scopedRaw: string | null = null;
    try {
      scopedRaw = localStorage.getItem(getUserDataStorageKey(activeKey));
    } catch {
      scopedRaw = null;
    }

    const seedData: UserDataSnapshot = {
      profile: SEED_USER_PROFILE,
      bookings: SEED_BOOKINGS,
      savedPassengers: SEED_SAVED_PASSENGERS,
      walletTransactions: SEED_WALLET_TRANSACTIONS,
      complaints: SEED_COMPLAINTS,
      feedbacks: [],
    };

    const userData = resolveUserDataSnapshot({
      userKey: activeKey,
      scopedRaw,
      seedData,
      legacyData: {
        profile: legacyProfile,
        bookings: loadStored<BookingRecord[]>('railone_bookings_v2', SEED_BOOKINGS),
        savedPassengers: loadStored<SavedPassenger[]>('railone_passengers', SEED_SAVED_PASSENGERS),
        walletTransactions: loadStored<WalletTransaction[]>(
          'railone_wallet_tx',
          SEED_WALLET_TRANSACTIONS
        ),
        complaints: loadStored<RailMadadComplaint[]>('railone_complaints', SEED_COMPLAINTS),
        feedbacks: loadStored<FeedbackEntry[]>('railone_feedbacks', []),
      },
      fallbackName: activeSummary?.name,
      fallbackMobile: activeSummary?.mobile,
    });

    return { authSession: initialAuth, userData };
  });

  const [authSession, setAuthSession] = useState<MpinAuthSession>(initialBoot.authSession);
  const [profile, setProfile] = useState<UserProfile>(initialBoot.userData.profile);
  const [bookings, setBookings] = useState<BookingRecord[]>(initialBoot.userData.bookings);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [savedPassengers, setSavedPassengers] = useState<SavedPassenger[]>(
    initialBoot.userData.savedPassengers
  );
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(
    initialBoot.userData.walletTransactions
  );
  const [complaints, setComplaints] = useState<RailMadadComplaint[]>(
    initialBoot.userData.complaints
  );
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>(
    initialBoot.userData.feedbacks
  );

  const [showNotifications, setShowNotifications] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showQuickTopup, setShowQuickTopup] = useState(false);
  const [quickTopupAmt, setQuickTopupAmt] = useState('500');
  const [returningMpinMode, setReturningMpinMode] = useState(false);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firestoreStatus, setFirestoreStatus] = useState<FirestoreConnectionStatus>(
    () => getFirestoreConnectionStatus()
  );
  const lastCloudSyncedJsonRef = useRef<string>('');
  const lastServerSyncedJsonRef = useRef<string>('');
  const latestAuthSnapshotRef = useRef<{
    activeKey: string;
    mpinSet: boolean;
    bookingsCount: number;
    passengersCount: number;
  }>({
    activeKey: PENDING_USER_KEY,
    mpinSet: false,
    bookingsCount: 0,
    passengersCount: 0,
  });

  // Kolkata Suburban Railway database & official fare table fetch state
  const [suburbanDb, setSuburbanDb] = useState<KolkataSuburbanDb | null>(null);
  const [fareDb, setFareDb] = useState<EasternRailwaySuburbanFareDb>(() =>
    getOfficialEasternRailwayFareDb()
  );
  const [suburbanLoading, setSuburbanLoading] = useState<boolean>(true);
  const [suburbanError, setSuburbanError] = useState<string | null>(null);
  const [stationSearchQuery, setStationSearchQuery] = useState<string>('');
  const [preselectedFrom, setPreselectedFrom] = useState<string | undefined>(undefined);
  const [preselectedTo, setPreselectedTo] = useState<string | undefined>(undefined);
  const [preselectedPlatform, setPreselectedPlatform] = useState<string | undefined>(undefined);
  const [homeUpcomingTicketId, setHomeUpcomingTicketId] = useState<string | null>(null);

  const fetchSuburbanDatabase = useCallback(async () => {
    setSuburbanLoading(true);
    setSuburbanError(null);
    try {
      const [stationRes, fareRes] = await Promise.all([
        fetch('/assets/aistudio/kolkata_suburban_railway_database_0a0fee1d.json'),
        fetch('/assets/aistudio/eastern_railway_suburban_second_class_fares_412194ad.json'),
      ]);
      if (!stationRes.ok) {
        throw new Error(`HTTP ${stationRes.status} while fetching station database`);
      }
      const data = (await stationRes.json()) as KolkataSuburbanDb;
      if (fareRes.ok) {
        const officialFareData = (await fareRes.json()) as EasternRailwaySuburbanFareDb;
        setOfficialEasternRailwayFareDb(officialFareData);
        setFareDb(officialFareData);
      }
      setSuburbanDb(data);
    } catch (err) {
      setSuburbanError(err instanceof Error ? err.message : 'Failed to load station database');
    } finally {
      setSuburbanLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSuburbanDatabase();
  }, [fetchSuburbanDatabase]);

  const suburbanIndex = useMemo(
    () => (suburbanDb ? buildSuburbanIndex(suburbanDb) : null),
    [suburbanDb]
  );

  const unifiedStations = useMemo(
    () => mergeUnifiedStations(RAIL_STATIONS, suburbanIndex),
    [suburbanIndex]
  );

  useEffect(() => {
    try {
      const currentKey = normalizeAuthUserKey(
        authSession.activeUserKey || profile.userId || profile.mobile || PENDING_USER_KEY
      );
      localStorage.setItem('railone_lang', JSON.stringify(language));
      if (currentKey === PENDING_USER_KEY) {
        return;
      }
      localStorage.setItem('railone_auth_v1', JSON.stringify(authSession));
      if (!authSession.isLifetimeLoggedIn && !profile.mpinSet) {
        return;
      }
      const snapshot: UserDataSnapshot = {
        profile,
        bookings,
        savedPassengers,
        walletTransactions,
        complaints,
        feedbacks,
      };
      localStorage.setItem(getUserDataStorageKey(currentKey), JSON.stringify(snapshot));
      if (currentKey === 'kailash_rail') {
        localStorage.setItem('railone_profile_v2', JSON.stringify(profile));
        localStorage.setItem('railone_bookings_v2', JSON.stringify(bookings));
        localStorage.setItem('railone_passengers', JSON.stringify(savedPassengers));
        localStorage.setItem('railone_wallet_tx', JSON.stringify(walletTransactions));
        localStorage.setItem('railone_complaints', JSON.stringify(complaints));
        localStorage.setItem('railone_feedbacks', JSON.stringify(feedbacks));
      }
    } catch {
      // ignore storage quota failures
    }
  }, [
    language,
    profile,
    authSession,
    bookings,
    savedPassengers,
    walletTransactions,
    complaints,
    feedbacks,
  ]);

  useEffect(() => {
    const syncExpiry = () => {
      const current = Date.now();
      setNowMs(current);
      setBookings((prev) => normalizeExpiredBookings(prev, current));
    };
    const intervalId = window.setInterval(syncExpiry, 30000);
    window.addEventListener('focus', syncExpiry);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncExpiry);
    };
  }, []);

  const t = UI_LABELS[language];

  const handleSelectTab = (tab: MainTab) => {
    setHomeUpcomingTicketId(null);
    setActiveTab(tab);
    setActiveScreen('home');
  };

  const handleNavigateScreen = (screen: ActiveScreen) => {
    setHomeUpcomingTicketId(null);
    setActiveTab('home');
    setActiveScreen(screen);
  };

  const upcomingBookings = useMemo(() => getUpcomingBookings(bookings, nowMs), [bookings, nowMs]);

  const homeUpcomingTicket = useMemo(
    () =>
      homeUpcomingTicketId
        ? bookings.find((b) => b.id === homeUpcomingTicketId) ?? null
        : null,
    [bookings, homeUpcomingTicketId]
  );

  const handleBookAgain = (bk: BookingRecord) => {
    setHomeUpcomingTicketId(null);
    if (bk.kind === 'unreserved') {
      setPreselectedFrom(bk.fromCode);
      setPreselectedTo(bk.toCode);
      handleNavigateScreen('unreserved');
    } else if (bk.kind === 'platform') {
      setPreselectedPlatform(bk.fromCode);
      handleNavigateScreen('platform');
    } else if (bk.kind === 'food') {
      handleNavigateScreen('order-food');
    } else {
      handleNavigateScreen('reserved');
    }
  };

  const handleBookConnecting = (bk: BookingRecord) => {
    setHomeUpcomingTicketId(null);
    setPreselectedFrom(bk.toCode);
    handleNavigateScreen('unreserved');
  };

  const handleCompleteBooking = (booking: BookingRecord, debitWallet: number) => {
    if (
      isWalletExhausted(profile.rWalletBalance) ||
      (debitWallet > 0 && profile.rWalletBalance < debitWallet)
    ) {
      return;
    }
    setBookings((prev) => [booking, ...prev]);
    if (debitWallet > 0) {
      setProfile((prev) => ({
        ...prev,
        rWalletBalance: deductWalletBalance(prev.rWalletBalance, debitWallet),
      }));
      const now = new Date();
      setWalletTransactions((prev) => [
        {
          id: `wt-${Date.now()}`,
          title: `${booking.title} · ${booking.fromCode} - ${booking.toCode}`,
          amount: debitWallet,
          type: 'debit',
          date: booking.bookingDateLabel ?? 'Today',
          refId: generateTransactionId(),
          category: formatBookingKindLabel(booking.kind),
          timeLabel: formatTransactionTimeLabel(now),
          remarks: 'Ticket Booked',
          isRefund: false,
        },
        ...prev,
      ]);
    }
  };

  const handleCancelBooking = (bookingId: string, refundAmount: number) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, status: 'Cancelled', refundAmount }
          : b
      )
    );
    if (refundAmount > 0) {
      setProfile((prev) => ({
        ...prev,
        rWalletBalance: Number((prev.rWalletBalance + refundAmount).toFixed(2)),
      }));
      const now = new Date();
      setWalletTransactions((prev) => [
        {
          id: `wt-ref-${Date.now()}`,
          title: 'Ticket Cancellation Refund',
          amount: refundAmount,
          type: 'credit',
          date: 'Today',
          refId: generateTransactionId(),
          category: 'Refund',
          timeLabel: formatTransactionTimeLabel(now),
          remarks: 'Refund Credited',
          isRefund: true,
        },
        ...prev,
      ]);
    }
  };

  const handleFileTdr = (bookingId: string, reason: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, status: 'Refunded', tdrReason: reason, refundAmount: b.fare }
          : b
      )
    );
  };

  const handleAddWalletMoney = (amount: number) => {
    setProfile((prev) => ({
      ...prev,
      rWalletBalance: Number((prev.rWalletBalance + amount).toFixed(2)),
    }));
    const now = new Date();
    setWalletTransactions((prev) => [
      {
        id: `wt-${Date.now()}`,
        title: 'R-Wallet Top-up via UPI',
        amount,
        type: 'credit',
        date: 'Today',
        refId: generateTransactionId(),
        category: 'R-Wallet Top-up',
        timeLabel: formatTransactionTimeLabel(now),
        remarks: 'Wallet Credited',
        isRefund: false,
      },
      ...prev,
    ]);
  };

  const handleSavePassenger = (pax: SavedPassenger) => {
    setSavedPassengers((prev) => {
      const exists = prev.some((p) => p.id === pax.id);
      return exists ? prev.map((p) => (p.id === pax.id ? pax : p)) : [...prev, pax];
    });
  };

  const handleDeletePassenger = (id: string) => {
    setSavedPassengers((prev) => prev.filter((p) => p.id !== id));
  };

  const cycleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'hi' : prev === 'hi' ? 'bn' : 'en'));
  };

  const navItems: Array<{ id: MainTab; label: string; Icon: typeof Home }> = [
    { id: 'home', label: t.home, Icon: Home },
    { id: 'bookings', label: t.myBookings, Icon: Ticket },
    { id: 'you', label: t.you, Icon: User },
    { id: 'menu', label: t.menu, Icon: MenuIcon },
  ];

  const renderMainContent = () => {
    // Home Tab Sub-screens (also stays visible underneath Menu drawer)
    switch (activeScreen) {
      case 'reserved':
        return (
          <ReservedBookingView
            stations={unifiedStations}
            profile={profile}
            savedPassengers={savedPassengers}
            onBack={() => setActiveScreen('home')}
            onCompleteBooking={handleCompleteBooking}
            onOpenBookings={() => handleSelectTab('bookings')}
          />
        );
      case 'unreserved':
        return (
          <UnreservedBookingView
            initialTab="unreserved"
            initialFromCode={preselectedFrom}
            initialToCode={preselectedTo}
            stations={unifiedStations}
            suburbanIndex={suburbanIndex}
            fareDb={fareDb}
            profile={profile}
            onBack={() => setActiveScreen('home')}
            onCompleteBooking={handleCompleteBooking}
            onOpenBookings={() => handleSelectTab('bookings')}
            onViewBookedTicketDetails={(bk) => {
              setHomeUpcomingTicketId(bk.id);
              setActiveTab('home');
              setActiveScreen('home');
            }}
          />
        );
      case 'platform':
        return (
          <UnreservedBookingView
            initialTab="platform"
            initialPlatformCode={preselectedPlatform}
            stations={unifiedStations}
            suburbanIndex={suburbanIndex}
            fareDb={fareDb}
            profile={profile}
            onBack={() => {
              setPreselectedPlatform(undefined);
              setActiveScreen('home');
            }}
            onCompleteBooking={handleCompleteBooking}
            onOpenBookings={() => handleSelectTab('bookings')}
            onViewBookedTicketDetails={(bk) => {
              setPreselectedPlatform(undefined);
              setHomeUpcomingTicketId(bk.id);
              setActiveTab('home');
              setActiveScreen('home');
            }}
          />
        );
      case 'search-trains':
        return (
          <TrainSearchScheduleView
            stations={unifiedStations}
            onBack={() => setActiveScreen('home')}
            onSelectTrainForBooking={() => setActiveScreen('reserved')}
          />
        );
      case 'station-search':
        return (
          <StationSearchExplorer
            suburbanIndex={suburbanIndex}
            fareDb={fareDb}
            loading={suburbanLoading}
            error={suburbanError}
            initialQuery={stationSearchQuery}
            onRetryFetch={fetchSuburbanDatabase}
            onBack={() => setActiveScreen('home')}
            onBookUnreservedPair={(fromCode, toCode) => {
              setPreselectedFrom(fromCode);
              setPreselectedTo(toCode);
              setActiveScreen('unreserved');
            }}
            onBookPlatformStation={(stationCode) => {
              setPreselectedPlatform(stationCode);
              setActiveScreen('platform');
            }}
          />
        );
      case 'pnr-status':
        return (
          <PnrStatusView
            bookings={bookings}
            onBack={() => setActiveScreen('home')}
            onOpenOrderFood={() => setActiveScreen('order-food')}
            onOpenTrackTrain={() => setActiveScreen('track-train')}
          />
        );
      case 'coach-position':
        return (
          <CoachPositionView
            stations={unifiedStations}
            onBack={() => setActiveScreen('home')}
          />
        );
      case 'track-train':
        return (
          <TrackTrainView
            stations={unifiedStations}
            onBack={() => setActiveScreen('home')}
          />
        );
      case 'order-food':
        return (
          <OrderFoodView
            profile={profile}
            bookings={bookings}
            onBack={() => setActiveScreen('home')}
            onPlaceFoodOrder={handleCompleteBooking}
          />
        );
      case 'file-refund':
        return (
          <FileRefundView
            bookings={bookings}
            onFileTdr={handleFileTdr}
            onBack={() => setActiveScreen('home')}
          />
        );
      case 'rail-madad':
        return (
          <RailMadadView
            stations={unifiedStations}
            complaints={complaints}
            onSubmitComplaint={(cmp) => setComplaints((prev) => [cmp, ...prev])}
            onOpenFeedback={() => setActiveScreen('travel-feedback')}
            onBack={() => setActiveScreen('home')}
          />
        );
      case 'travel-feedback':
        return (
          <TravelFeedbackView
            feedbacks={feedbacks}
            onSubmitFeedback={(fb) => setFeedbacks((prev) => [fb, ...prev])}
            onBack={() => setActiveScreen('home')}
          />
        );
      case 'performance-dashboard':
        return (
          <MenuView
            profile={profile}
            language={language}
            onChangeLanguage={setLanguage}
            onNavigate={handleNavigateScreen}
            onOpenAuthModal={() => setShowAuthModal(true)}
            showPerformanceOnly
            onBackFromPerf={() => {
              setActiveTab('menu');
              setActiveScreen('home');
            }}
          />
        );
      default:
        return (
          <HomeView
            profile={profile}
            language={language}
            upcomingBookings={upcomingBookings}
            suburbanStationCount={suburbanIndex?.stations.length ?? 396}
            suburbanRouteCount={suburbanIndex?.routes.length ?? 28}
            onNavigate={handleNavigateScreen}
            onSearchStationFromHome={(q) => {
              setStationSearchQuery(q);
              handleNavigateScreen('station-search');
            }}
            onOpenWalletTopup={() => setShowQuickTopup(true)}
            onBookAgain={handleBookAgain}
            onViewUpcomingDetails={(bk) => setHomeUpcomingTicketId(bk.id)}
          />
        );
    }
  };

  const isFullScreenOffering =
    activeTab === 'home' &&
    (activeScreen === 'unreserved' ||
      activeScreen === 'platform' ||
      activeScreen === 'search-trains' ||
      activeScreen === 'pnr-status' ||
      activeScreen === 'coach-position' ||
      activeScreen === 'track-train' ||
      activeScreen === 'order-food' ||
      activeScreen === 'file-refund' ||
      activeScreen === 'rail-madad');

  const activeAuthUserKey = normalizeAuthUserKey(
    authSession.activeUserKey || profile.userId || profile.mobile || PENDING_USER_KEY
  );
  const hasRegisteredMpin = hasRegisteredOneTimeMpin(authSession, activeAuthUserKey);
  const requiresUserSetup =
    isPendingUserOnboarding(profile, activeAuthUserKey) && !returningMpinMode;

  latestAuthSnapshotRef.current = {
    activeKey: activeAuthUserKey,
    mpinSet: profile.mpinSet,
    bookingsCount: bookings.length,
    passengersCount: savedPassengers.length,
  };

  // Subscribe to Firebase Auth & hydrate saved Cloud Firestore user account on fresh browser/URL
  useEffect(() => {
    const unsubStatus = subscribeFirestoreStatus(setFirestoreStatus);
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser || !fbUser.emailVerified) return;

      void (async () => {
        try {
          const accounts = await loadAllUserAccountsFromFirestore(fbUser);
          if (accounts.length === 0) return;

          const latest = latestAuthSnapshotRef.current;
          const currentKey = latest.activeKey;
          const matched =
            accounts.find((a) => a.accountKey === currentKey) ||
            (currentKey === PENDING_USER_KEY
              ? [...accounts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
              : undefined);

          if (!matched || !matched.snapshot?.profile) return;

          const shouldHydrate =
            currentKey === PENDING_USER_KEY ||
            !latest.mpinSet ||
            (latest.bookingsCount === 0 &&
              latest.passengersCount === 0 &&
              (matched.snapshot.bookings.length > 0 ||
                matched.snapshot.savedPassengers.length > 0));

          if (!shouldHydrate) return;

          const restoredProfile: UserProfile = {
            ...matched.snapshot.profile,
            userId: matched.accountKey,
            mpinSet: Boolean(matched.mpin || matched.snapshot.profile.mpinSet),
            isGuest: false,
          };
          const hydratedSnapshot: UserDataSnapshot = {
            profile: restoredProfile,
            bookings: matched.snapshot.bookings,
            savedPassengers: matched.snapshot.savedPassengers,
            walletTransactions: matched.snapshot.walletTransactions,
            complaints: matched.snapshot.complaints,
            feedbacks: matched.snapshot.feedbacks,
          };
          lastCloudSyncedJsonRef.current = JSON.stringify(hydratedSnapshot);

          setProfile(restoredProfile);
          setBookings(hydratedSnapshot.bookings);
          setSavedPassengers(hydratedSnapshot.savedPassengers);
          setWalletTransactions(hydratedSnapshot.walletTransactions);
          setComplaints(hydratedSnapshot.complaints);
          setFeedbacks(hydratedSnapshot.feedbacks);

          if (matched.mpin && /^[A-Za-z0-9]{6}$/.test(matched.mpin)) {
            setAuthSession((prev) => ({
              ...prev,
              activeUserKey: matched.accountKey,
              isLifetimeLoggedIn: prev.isLifetimeLoggedIn,
              usersByKey: {
                ...prev.usersByKey,
                [matched.accountKey]: {
                  userKey: matched.accountKey,
                  name: restoredProfile.name,
                  mobile: restoredProfile.mobile,
                  mpin: matched.mpin,
                  rWalletBalance: restoredProfile.rWalletBalance,
                },
              },
            }));
          }
        } catch {
          // non-fatal; falls back cleanly to local state
        }
      })();
    });
    return () => {
      unsubStatus();
      unsub();
    };
  }, []);

  // Resume server session token after reload if user already completed lifetime MPIN login
  useEffect(() => {
    if (showAdminPanel || userToken) return;
    if (!authSession.isLifetimeLoggedIn || activeAuthUserKey === PENDING_USER_KEY) return;
    const boundMpin = authSession.usersByKey[activeAuthUserKey]?.mpin;
    if (!boundMpin || !/^[A-Za-z0-9]{6}$/.test(boundMpin)) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(apiUrl('/api/user/session'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mpin: boundMpin,
            userKey: activeAuthUserKey,
            userName: profile.name,
            userMobile: profile.mobile,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          userToken?: string;
          serverSnapshot?: Partial<UserDataSnapshot> | null;
        };
        if (cancelled || !data.ok || !data.userToken) return;
        setUserToken(data.userToken);
        if (
          data.serverSnapshot &&
          data.serverSnapshot.profile &&
          bookings.length === 0 &&
          savedPassengers.length === 0 &&
          ((data.serverSnapshot.bookings?.length ?? 0) > 0 ||
            (data.serverSnapshot.savedPassengers?.length ?? 0) > 0)
        ) {
          const hydrated = resolveUserDataSnapshot({
            userKey: activeAuthUserKey,
            scopedRaw: JSON.stringify(data.serverSnapshot),
            seedData: {
              profile: SEED_USER_PROFILE,
              bookings: SEED_BOOKINGS,
              savedPassengers: SEED_SAVED_PASSENGERS,
              walletTransactions: SEED_WALLET_TRANSACTIONS,
              complaints: SEED_COMPLAINTS,
              feedbacks: [],
            },
            fallbackName: profile.name,
            fallbackMobile: profile.mobile,
          });
          lastServerSyncedJsonRef.current = JSON.stringify(hydrated);
          setProfile(hydrated.profile);
          setBookings(hydrated.bookings);
          setSavedPassengers(hydrated.savedPassengers);
          setWalletTransactions(hydrated.walletTransactions);
          setComplaints(hydrated.complaints);
          setFeedbacks(hydrated.feedbacks);
        }
      } catch {
        // non-fatal
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    showAdminPanel,
    userToken,
    authSession.isLifetimeLoggedIn,
    authSession.usersByKey,
    activeAuthUserKey,
    profile.name,
    profile.mobile,
    bookings.length,
    savedPassengers.length,
  ]);

  // Verify active user's MPIN is not missing/blocked/expired on server or Firebase Firestore
  useEffect(() => {
    if (showAdminPanel) return;
    const boundMpin = authSession.usersByKey[activeAuthUserKey]?.mpin;
    if (!boundMpin || !/^[A-Za-z0-9]{6}$/.test(boundMpin)) return;

    let cancelled = false;
    const verifyStatus = async () => {
      try {
        const res = await fetch(apiUrl('/api/mpin/check-status'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mpin: boundMpin }),
        });
        const data = (await res.json()) as {
          allowed?: boolean;
          status?: 'Active' | 'Used' | 'Blocked' | 'Expired' | 'Missing';
        };
        if (cancelled) return;

        let effectiveStatus: 'Allowed' | 'Blocked' | 'Expired' | 'Missing' = 'Allowed';
        if (data.allowed) {
          effectiveStatus = 'Allowed';
        } else if (data.status === 'Blocked' || data.status === 'Expired') {
          effectiveStatus = data.status;
        } else if (data.status === 'Missing') {
          if (firebaseUser && firebaseUser.emailVerified) {
            const cloudStatus = await checkMpinStatusInFirestore(boundMpin);
            if (cloudStatus === 'Blocked' || cloudStatus === 'Expired' || cloudStatus === 'Missing') {
              effectiveStatus = cloudStatus;
            }
          } else {
            effectiveStatus = 'Missing';
          }
        }

        if (
          !cancelled &&
          (effectiveStatus === 'Blocked' ||
            effectiveStatus === 'Expired' ||
            effectiveStatus === 'Missing')
        ) {
          setUserToken(null);
          setAuthSession((prev) => {
            const next = prev.isLifetimeLoggedIn
              ? logoutToMpinScreen(prev, profile.rWalletBalance)
              : prev;
            if (effectiveStatus === 'Missing' && next.usersByKey[activeAuthUserKey]) {
              return {
                ...next,
                usersByKey: {
                  ...next.usersByKey,
                  [activeAuthUserKey]: {
                    ...next.usersByKey[activeAuthUserKey],
                    mpin: '',
                  },
                },
              };
            }
            return next;
          });
          if (effectiveStatus === 'Missing') {
            setProfile((prev) => (prev.mpinSet ? { ...prev, mpinSet: false } : prev));
          }
        }
      } catch {
        // ignore transient network glitches
      }
    };

    void verifyStatus();
    const onFocus = () => {
      void verifyStatus();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [
    firebaseUser,
    authSession.isLifetimeLoggedIn,
    showAdminPanel,
    activeAuthUserKey,
    authSession.usersByKey,
    profile.rWalletBalance,
  ]);

  // Persist user profile, wallet balance, bookings & saved passengers to server DB and optional Firebase Firestore
  useEffect(() => {
    if (!authSession.isLifetimeLoggedIn) return;
    if (activeAuthUserKey === PENDING_USER_KEY) return;
    if (!profile.name.trim() || !/^\d{10}$/.test(profile.mobile.replace(/\D/g, ''))) return;

    const snapshot: UserDataSnapshot = {
      profile,
      bookings,
      savedPassengers,
      walletTransactions,
      complaints,
      feedbacks,
    };
    const serialized = JSON.stringify(snapshot);
    const boundMpin = authSession.usersByKey[activeAuthUserKey]?.mpin ?? '';

    const needsServerSync = Boolean(userToken) && serialized !== lastServerSyncedJsonRef.current;
    const needsCloudSync =
      Boolean(firebaseUser && firebaseUser.emailVerified) &&
      serialized !== lastCloudSyncedJsonRef.current;

    if (!needsServerSync && !needsCloudSync) return;

    const timer = window.setTimeout(() => {
      if (needsServerSync && userToken) {
        void (async () => {
          try {
            const res = await fetch(apiUrl('/api/user/snapshot'), {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${userToken}`,
              },
              body: JSON.stringify({ mpin: boundMpin, snapshot }),
            });
            if (res.ok) {
              lastServerSyncedJsonRef.current = serialized;
            }
          } catch {
            // local copy preserved
          }
        })();
      }
      if (needsCloudSync && firebaseUser && firebaseUser.emailVerified) {
        void (async () => {
          try {
            await saveUserAccountToFirestore(firebaseUser, activeAuthUserKey, boundMpin, snapshot);
            lastCloudSyncedJsonRef.current = serialized;
          } catch {
            // structured error logged by handleFirestoreError; local copy preserved
          }
        })();
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    userToken,
    firebaseUser,
    authSession.isLifetimeLoggedIn,
    authSession.usersByKey,
    activeAuthUserKey,
    profile,
    bookings,
    savedPassengers,
    walletTransactions,
    complaints,
    feedbacks,
  ]);

  if (showAdminPanel) {
    return (
      <AdminPanelView
        onBackToApp={() => {
          setShowAdminPanel(false);
          try {
            if (window.location.pathname === '/admin' || new URLSearchParams(window.location.search).get('admin') === '1') {
              window.history.replaceState({}, '', '/');
            }
          } catch {
            // ignore history errors
          }
        }}
      />
    );
  }

  if (!authSession.isLifetimeLoggedIn) {
    return (
      <MpinLoginScreen
        userName={profile.name}
        hasRegisteredMpin={hasRegisteredMpin}
        requiresUserSetup={requiresUserSetup}
        firebaseUser={firebaseUser}
        onGoogleSignIn={async () => {
          const user = await signInWithGoogle();
          setFirebaseUser(user);
        }}
        onGoogleSignOut={async () => {
          await signOutFirebase();
          setFirebaseUser(null);
        }}
        onUseExistingMpin={() => {
          setReturningMpinMode(true);
        }}
        onOpenAdminPanel={() => setShowAdminPanel(true)}
        onSubmitMpin={async (enteredMpin) => {
          const cleanMpin = enteredMpin.trim();
          const localCheck = submitMpinLogin({
            session: authSession,
            userKey: activeAuthUserKey,
            userName: profile.name,
            mobile: profile.mobile,
            currentBalance: profile.rWalletBalance,
            enteredMpin: cleanMpin,
          });
          if (!localCheck.ok) {
            return { ok: false, error: localCheck.error };
          }

          const effectiveUserKey = normalizeAuthUserKey(
            localCheck.nextSession.activeUserKey || activeAuthUserKey
          );
          const localMatchedUser =
            effectiveUserKey !== PENDING_USER_KEY
              ? localCheck.nextSession.usersByKey[effectiveUserKey]
              : undefined;
          const effectiveUserName = localMatchedUser?.name || profile.name;
          const effectiveUserMobile = localMatchedUser?.mobile || profile.mobile;
          const deviceId = getOrCreateClientDeviceId();
          const deviceType = detectClientDeviceType();

          let serverSnapshot: Partial<UserDataSnapshot> | null = null;
          let resolvedAccount: {
            userKey: string;
            userName: string;
            userMobile: string;
          } | null = null;
          let verifiedUserToken: string | null = null;
          let verifiedInCloud = false;

          if (firebaseUser && firebaseUser.emailVerified) {
            try {
              const cloudRes = await verifyAndClaimMpinInFirestore({
                user: firebaseUser,
                enteredMpin: cleanMpin,
                userName: effectiveUserName,
                userMobile: effectiveUserMobile,
                userKey: effectiveUserKey,
                deviceId,
                deviceType,
              });
              if (cloudRes.ok) {
                verifiedInCloud = true;
                serverSnapshot = cloudRes.serverSnapshot ?? null;
                resolvedAccount = cloudRes.resolvedAccount ?? null;
              } else if (
                cloudRes.error &&
                !cloudRes.error.toLowerCase().includes('invalid or unregistered mpin')
              ) {
                return {
                  ok: false,
                  error: cloudRes.error,
                };
              }
            } catch {
              // fall back cleanly to Admin server verification below
            }
          }

          if (!verifiedInCloud) {
            try {
              const res = await fetch(apiUrl('/api/mpin/verify'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  mpin: cleanMpin,
                  userName: effectiveUserName,
                  userMobile: effectiveUserMobile,
                  userKey: effectiveUserKey === PENDING_USER_KEY ? '' : effectiveUserKey,
                  deviceId,
                  deviceType,
                }),
              });
              const data = (await res.json()) as {
                ok?: boolean;
                error?: string | null;
                userToken?: string;
                userKey?: string;
                record?: {
                  boundUserName?: string | null;
                  boundUserMobile?: string | null;
                  boundUserKey?: string | null;
                } | null;
                serverSnapshot?: Partial<UserDataSnapshot> | null;
              };
              if (!res.ok || !data.ok) {
                return {
                  ok: false,
                  error: data.error || 'Invalid or unauthorized MPIN.',
                };
              }
              verifiedUserToken = data.userToken ?? null;
              serverSnapshot = data.serverSnapshot ?? null;
              if (data.userKey || data.record) {
                resolvedAccount = {
                  userKey: data.userKey || data.record?.boundUserKey || effectiveUserKey,
                  userName: data.record?.boundUserName || effectiveUserName,
                  userMobile: data.record?.boundUserMobile || effectiveUserMobile,
                };
              }
            } catch {
              return {
                ok: false,
                error: 'Unable to verify MPIN with server. Please try again.',
              };
            }
          }

          const finalUserKey = normalizeAuthUserKey(
            resolvedAccount?.userKey || effectiveUserKey
          );
          const finalUserName = (resolvedAccount?.userName || effectiveUserName || 'RailOne User').trim();
          const finalUserMobile = (resolvedAccount?.userMobile || effectiveUserMobile || '').replace(/\D/g, '');

          let nextProfile: UserProfile = {
            ...profile,
            name: finalUserName,
            userId: finalUserKey,
            mobile: finalUserMobile,
            mpinSet: true,
            isGuest: false,
          };
          let nextSessionToSave: MpinAuthSession = {
            ...localCheck.nextSession,
            isLifetimeLoggedIn: true,
            activeUserKey: finalUserKey,
            usersByKey: {
              ...localCheck.nextSession.usersByKey,
              [finalUserKey]: {
                userKey: finalUserKey,
                name: finalUserName,
                mobile: finalUserMobile,
                mpin: cleanMpin,
                rWalletBalance:
                  localCheck.nextSession.usersByKey[finalUserKey]?.rWalletBalance ??
                  nextProfile.rWalletBalance,
              },
            },
          };
          let nextBookings = bookings;
          let nextPassengers = savedPassengers;
          let nextWalletTx = walletTransactions;
          let nextComplaints = complaints;
          let nextFeedbacks = feedbacks;

          let localScopedRaw: string | null = null;
          try {
            localScopedRaw = localStorage.getItem(getUserDataStorageKey(finalUserKey));
          } catch {
            localScopedRaw = null;
          }
          const hasLocalScoped = Boolean(localScopedRaw);

          if (
            serverSnapshot &&
            serverSnapshot.profile &&
            (!hasLocalScoped ||
              !profile.mpinSet ||
              effectiveUserKey !== finalUserKey ||
              activeAuthUserKey === PENDING_USER_KEY ||
              (bookings.length === 0 &&
                savedPassengers.length === 0 &&
                ((serverSnapshot.bookings?.length ?? 0) > 0 ||
                  (serverSnapshot.savedPassengers?.length ?? 0) > 0)))
          ) {
            const hydrated = resolveUserDataSnapshot({
              userKey: finalUserKey,
              scopedRaw: JSON.stringify(serverSnapshot),
              seedData: {
                profile: SEED_USER_PROFILE,
                bookings: SEED_BOOKINGS,
                savedPassengers: SEED_SAVED_PASSENGERS,
                walletTransactions: SEED_WALLET_TRANSACTIONS,
                complaints: SEED_COMPLAINTS,
                feedbacks: [],
              },
              fallbackName: finalUserName,
              fallbackMobile: finalUserMobile,
            });
            nextProfile = {
              ...hydrated.profile,
              userId: finalUserKey,
              mpinSet: true,
              isGuest: false,
            };
            nextBookings = hydrated.bookings;
            nextPassengers = hydrated.savedPassengers;
            nextWalletTx = hydrated.walletTransactions;
            nextComplaints = hydrated.complaints;
            nextFeedbacks = hydrated.feedbacks;
            nextSessionToSave = {
              ...nextSessionToSave,
              usersByKey: {
                ...nextSessionToSave.usersByKey,
                [finalUserKey]: {
                  ...nextSessionToSave.usersByKey[finalUserKey],
                  rWalletBalance: nextProfile.rWalletBalance,
                },
              },
            };
          } else if (hasLocalScoped && activeAuthUserKey !== finalUserKey && localScopedRaw) {
            const hydratedLocal = resolveUserDataSnapshot({
              userKey: finalUserKey,
              scopedRaw: localScopedRaw,
              seedData: {
                profile: SEED_USER_PROFILE,
                bookings: SEED_BOOKINGS,
                savedPassengers: SEED_SAVED_PASSENGERS,
                walletTransactions: SEED_WALLET_TRANSACTIONS,
                complaints: SEED_COMPLAINTS,
                feedbacks: [],
              },
              fallbackName: finalUserName,
              fallbackMobile: finalUserMobile,
            });
            nextProfile = {
              ...hydratedLocal.profile,
              userId: finalUserKey,
              mpinSet: true,
              isGuest: false,
            };
            nextBookings = hydratedLocal.bookings;
            nextPassengers = hydratedLocal.savedPassengers;
            nextWalletTx = hydratedLocal.walletTransactions;
            nextComplaints = hydratedLocal.complaints;
            nextFeedbacks = hydratedLocal.feedbacks;
          }

          const finalSnapshot: UserDataSnapshot = {
            profile: nextProfile,
            bookings: nextBookings,
            savedPassengers: nextPassengers,
            walletTransactions: nextWalletTx,
            complaints: nextComplaints,
            feedbacks: nextFeedbacks,
          };

          if (verifiedUserToken) {
            try {
              const saveRes = await fetch(apiUrl('/api/user/snapshot'), {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${verifiedUserToken}`,
                },
                body: JSON.stringify({ mpin: cleanMpin, snapshot: finalSnapshot }),
              });
              if (saveRes.ok) {
                lastServerSyncedJsonRef.current = JSON.stringify(finalSnapshot);
              }
            } catch {
              // background sync effect will retry
            }
          }

          if (firebaseUser && firebaseUser.emailVerified) {
            try {
              await saveUserAccountToFirestore(
                firebaseUser,
                finalUserKey,
                cleanMpin,
                finalSnapshot
              );
              lastCloudSyncedJsonRef.current = JSON.stringify(finalSnapshot);
            } catch {
              // background sync effect will retry
            }
          }

          setUserToken(verifiedUserToken);
          setReturningMpinMode(false);
          setAuthSession(nextSessionToSave);
          setProfile(nextProfile);
          setBookings(nextBookings);
          setSavedPassengers(nextPassengers);
          setWalletTransactions(nextWalletTx);
          setComplaints(nextComplaints);
          setFeedbacks(nextFeedbacks);
          return { ok: true, error: null };
        }}
        onSwitchUser={(nextName, nextMobile) => {
          setReturningMpinMode(false);
          const switched = switchOrCreateAuthUser({
            session: authSession,
            name: nextName,
            mobile: nextMobile,
            initialBalance: INITIAL_NEW_USER_WALLET_BALANCE,
          });
          if (!switched.ok) {
            return { ok: false, error: switched.error };
          }

          // Save the outgoing registered user's complete snapshot before switching
          if (
            activeAuthUserKey !== PENDING_USER_KEY &&
            (authSession.isLifetimeLoggedIn || profile.mpinSet)
          ) {
            try {
              const currentSnapshot: UserDataSnapshot = {
                profile,
                bookings,
                savedPassengers,
                walletTransactions,
                complaints,
                feedbacks,
              };
              localStorage.setItem(
                getUserDataStorageKey(activeAuthUserKey),
                JSON.stringify(currentSnapshot)
              );
            } catch {
              // ignore storage errors
            }
          }

          // Load target user's isolated snapshot or initialize a clean empty user
          let targetRaw: string | null = null;
          try {
            targetRaw = localStorage.getItem(getUserDataStorageKey(switched.userKey));
          } catch {
            targetRaw = null;
          }

          const cleanMobile = nextMobile.replace(/\D/g, '');
          const nextData: UserDataSnapshot = switched.existingUser || targetRaw
            ? resolveUserDataSnapshot({
                userKey: switched.userKey,
                scopedRaw: targetRaw,
                seedData: {
                  profile: SEED_USER_PROFILE,
                  bookings: SEED_BOOKINGS,
                  savedPassengers: SEED_SAVED_PASSENGERS,
                  walletTransactions: SEED_WALLET_TRANSACTIONS,
                  complaints: SEED_COMPLAINTS,
                  feedbacks: [],
                },
                fallbackName: nextName.trim(),
                fallbackMobile: cleanMobile,
              })
            : createCleanNewUserData({
                userKey: switched.userKey,
                name: nextName.trim(),
                mobile: cleanMobile,
                initialBalance: INITIAL_NEW_USER_WALLET_BALANCE,
                mpinSet: false,
              });

          const syncedProfile: UserProfile = {
            ...nextData.profile,
            name: nextName.trim(),
            userId: switched.userKey,
            mobile: cleanMobile,
            isGuest: false,
            mpinSet: Boolean(switched.existingUser?.mpin && /^[A-Za-z0-9]{6}$/.test(switched.existingUser.mpin)),
            rWalletBalance: switched.existingUser
              ? switched.existingUser.rWalletBalance
              : nextData.profile.rWalletBalance,
          };

          lastCloudSyncedJsonRef.current = '';
          setAuthSession(switched.nextSession);
          setProfile(syncedProfile);
          setBookings(nextData.bookings);
          setSavedPassengers(nextData.savedPassengers);
          setWalletTransactions(nextData.walletTransactions);
          setComplaints(nextData.complaints);
          setFeedbacks(nextData.feedbacks);
          setHomeUpcomingTicketId(null);
          setPreselectedFrom(undefined);
          setPreselectedTo(undefined);
          setPreselectedPlatform(undefined);
          setActiveTab('home');
          setActiveScreen('home');

          return { ok: true, error: null };
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {activeTab === 'home' && activeScreen === 'home' && homeUpcomingTicket ? (
        <UpcomingBookingDetailsScreen
          booking={homeUpcomingTicket}
          profile={profile}
          onBack={() => setHomeUpcomingTicketId(null)}
          onBookConnecting={handleBookConnecting}
        />
      ) : isFullScreenOffering ? (
        renderMainContent()
      ) : activeTab === 'bookings' ? (
        <BookingsView
          bookings={bookings}
          profile={profile}
          onCancelBooking={handleCancelBooking}
          onNavigate={handleNavigateScreen}
          onBackToHome={() => handleSelectTab('home')}
          onBookAgain={handleBookAgain}
          onBookConnecting={handleBookConnecting}
        />
      ) : activeTab === 'you' ? (
        <>
          <YouView
            profile={profile}
            savedPassengers={savedPassengers}
            walletTransactions={walletTransactions}
            onUpdateProfile={setProfile}
            onAddWalletMoney={handleAddWalletMoney}
            onSavePassenger={handleSavePassenger}
            onDeletePassenger={handleDeletePassenger}
            onOpenAuthModal={() => setShowAuthModal(true)}
            onBackToHome={() => handleSelectTab('home')}
          />

          {/* Fixed Solid Blue 4-Tab Bottom Navigation Bar */}
          <nav
            aria-label="Bottom Navigation"
            className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#0066FF] text-white shadow-lg"
          >
            <div className="max-w-5xl mx-auto h-full grid grid-cols-4 items-center">
              {navItems.map(({ id, label, Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelectTab(id)}
                    className={`h-full flex flex-col items-center justify-center gap-1 transition-colors ${
                      active ? 'text-white' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.75} />
                    <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </>
      ) : (
        <>
          {/* Main Content Shell */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Bar: Circular A/अ button, centered RailOne wordmark, Circular Notification Bell */}
            <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 sm:px-6">
              <div className="max-w-5xl mx-auto h-full flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={cycleLanguage}
                    aria-label={`Switch language (current ${language.toUpperCase()})`}
                    className="h-10 w-10 rounded-full bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center text-[#0B63E5] hover:bg-slate-50 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                      <text
                        x="3"
                        y="14"
                        fill="#0B63E5"
                        fontSize="11.5"
                        fontWeight="700"
                        fontFamily="Plus Jakarta Sans, sans-serif"
                      >
                        A
                      </text>
                      <text
                        x="11.5"
                        y="20"
                        fill="#0B63E5"
                        fontSize="11.5"
                        fontWeight="700"
                        fontFamily="sans-serif"
                      >
                        अ
                      </text>
                    </svg>
                  </button>
                </div>

                <div className="flex items-center justify-center select-none">
                  <span className="font-display text-[22px] tracking-tight text-[#43464B]">
                    <span className="font-normal">Rail</span>
                    <span className="font-bold text-[#2D3138]">One</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleNavigateScreen('station-search')}
                    className="hidden md:inline-flex min-h-[36px] px-3 rounded-full bg-[#EAF4FF] text-[#0B63E5] text-xs font-semibold hover:bg-[#DCEBFF] transition-colors whitespace-nowrap shrink-0 items-center"
                  >
                    Station Search ({suburbanIndex?.stations.length ?? 396})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(true)}
                    aria-label="Open notifications"
                    className="h-10 w-10 rounded-full bg-white border border-slate-200/90 shadow-2xs hover:bg-slate-50 flex items-center justify-center text-slate-700 transition-colors"
                  >
                    <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </header>

            {/* Main View Area */}
            <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-24">
              {renderMainContent()}
            </main>
          </div>

          {/* Fixed Solid Blue 4-Tab Bottom Navigation Bar */}
          <nav
            aria-label="Bottom Navigation"
            className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#0066FF] text-white shadow-lg"
          >
            <div className="max-w-5xl mx-auto h-full grid grid-cols-4 items-center">
              {navItems.map(({ id, label, Icon }) => {
                const active = activeTab === id || (activeTab === 'menu' && id === 'home');
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelectTab(id)}
                    className={`h-full flex flex-col items-center justify-center gap-1 transition-colors ${
                      active ? 'text-white' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.75} />
                    <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Right-side Menu Drawer Overlay matching Image 2 */}
          {activeTab === 'menu' && (
            <MenuView
              profile={profile}
              language={language}
              firebaseUser={firebaseUser}
              firestoreStatus={firestoreStatus}
              onConnectFirebase={async () => {
                const user = await signInWithGoogle();
                setFirebaseUser(user);
              }}
              onDisconnectFirebase={async () => {
                await signOutFirebase();
                setFirebaseUser(null);
              }}
              onChangeLanguage={setLanguage}
              onNavigate={handleNavigateScreen}
              onOpenAuthModal={() => setShowAuthModal(true)}
              onOpenAdminPanel={() => setShowAdminPanel(true)}
              onLogout={() => {
                setShowNotifications(false);
                setShowQuickTopup(false);
                setShowAuthModal(false);
                setReturningMpinMode(false);
                setUserToken(null);
                setAuthSession((prev) => logoutToMpinScreen(prev, profile.rWalletBalance));
                setActiveTab('home');
                setActiveScreen('home');
              }}
              onAddWalletMoney={handleAddWalletMoney}
              onClose={() => handleSelectTab('home')}
            />
          )}
        </>
      )}

      {/* Notifications Drawer */}
      {showNotifications && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="RailOne Notifications"
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-start justify-end p-4"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl mt-12">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900">Notifications</h2>
              <button
                type="button"
                onClick={() => setShowNotifications(false)}
                aria-label="Close notifications"
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="rounded-xl bg-[#EAF4FF] p-3">
                <p className="font-bold text-slate-900">22416 Vande Bharat Express</p>
                <p className="text-slate-600 mt-0.5">
                  Expected departure from Platform 16 at 15:00. Coach position updated.
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="font-bold text-emerald-900">3% R-Wallet Bonus Active</p>
                <p className="text-emerald-800 mt-0.5">
                  Enjoy 3% instant savings on all UTS unreserved and platform tickets.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="font-bold text-slate-900">Rail Madad Ref RM202611140842</p>
                <p className="text-slate-600 mt-0.5">
                  Your cleanliness request was marked Resolved.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick R-Wallet Top-Up Modal */}
      {showQuickTopup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add Money to R-Wallet"
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                Add Money to R-Wallet
              </h2>
              <button
                type="button"
                onClick={() => setShowQuickTopup(false)}
                aria-label="Close wallet topup"
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Current Balance:{' '}
              <span className="font-mono-num font-bold text-slate-900">
                ₹ {profile.rWalletBalance.toFixed(2)}
              </span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {['200', '500', '1000'].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setQuickTopupAmt(amt)}
                  className={`min-h-[40px] rounded-xl border text-xs font-bold ${
                    quickTopupAmt === amt
                      ? 'border-[#0B63E5] bg-[#EAF4FF] text-[#0B63E5]'
                      : 'border-slate-200 text-slate-700'
                  }`}
                >
                  + ₹{amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={50}
              max={10000}
              value={quickTopupAmt}
              onChange={(e) => setQuickTopupAmt(e.target.value)}
              aria-label="R-Wallet top-up amount"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 font-mono-num text-sm font-bold"
            />
            <button
              type="button"
              onClick={() => {
                const v = Number(quickTopupAmt);
                if (!Number.isNaN(v) && v > 0) {
                  handleAddWalletMoney(v);
                  setShowQuickTopup(false);
                }
              }}
              className="w-full min-h-[46px] rounded-xl bg-[#0B63E5] text-white text-sm font-bold hover:bg-[#0952C2]"
            >
              Recharge ₹ {Number(quickTopupAmt) || 0}
            </button>
          </div>
        </div>
      )}

      {/* RailOne SSO Auth Modal */}
      {showAuthModal && (
        <AuthSSOModal
          currentName={profile.name}
          onLoginSuccess={(name, isGuest, meta) => {
            if (meta?.isNewRegistration && meta.mobile) {
              const newKey = normalizeAuthUserKey(`user_${meta.mobile.replace(/\D/g, '')}`);
              const cleanData = createCleanNewUserData({
                userKey: newKey,
                name,
                mobile: meta.mobile,
                initialBalance: INITIAL_NEW_USER_WALLET_BALANCE,
                mpinSet: false,
              });
              setAuthSession((prev) => ({
                ...prev,
                isLifetimeLoggedIn: true,
                activeUserKey: newKey,
              }));
              setProfile(cleanData.profile);
              setBookings(cleanData.bookings);
              setSavedPassengers(cleanData.savedPassengers);
              setWalletTransactions(cleanData.walletTransactions);
              setComplaints(cleanData.complaints);
              setFeedbacks(cleanData.feedbacks);
            } else {
              setProfile((prev) => ({
                ...prev,
                name,
                isGuest,
                ...(meta?.mobile ? { mobile: meta.mobile } : {}),
              }));
            }
            setShowAuthModal(false);
          }}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
