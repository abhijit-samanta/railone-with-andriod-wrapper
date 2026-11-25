import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  CheckCircle2,
  Info,
  QrCode,
  X,
} from 'lucide-react';
import { RAIL_STATIONS } from '../data/railData';
import {
  calculateBookingValidUntil,
  calculateUnreservedFare,
  canBookTicketWithWallet,
  formatBookingDateLabel,
  formatBookingTimestamp,
  formatSaturdayReturnValidityLabel,
  generateRandomIrCode,
  generateUtsNumber,
  getRecentUnreservedStorageKey,
  isDefaultSeedUserKey,
  isSaturdayReturnTicket,
  isWalletExhausted,
} from '../utils/railLogic';
import {
  calculateFare,
  calculateSuburbanFareBreakdown,
  findSuburbanPath,
  getOfficialEasternRailwayFareDb,
} from '../utils/suburbanLogic';
import type { BookingRecord, Station, UserProfile } from '../types/rail';
import type { EasternRailwaySuburbanFareDb, SuburbanIndex } from '../types/suburban';
import { PlatformBookingScreen } from './PlatformBookingScreen';
import { UnreservedJourneyScreen } from './UnreservedJourneyScreen';
import { UnreservedMakePaymentScreen } from './UnreservedMakePaymentScreen';
import { UnreservedStationPickerModal } from './UnreservedStationPickerModal';

interface UnreservedBookingViewProps {
  initialTab?: 'unreserved' | 'platform';
  initialFromCode?: string;
  initialToCode?: string;
  initialPlatformCode?: string;
  stations?: Station[];
  suburbanIndex?: SuburbanIndex | null;
  fareDb?: EasternRailwaySuburbanFareDb;
  profile: UserProfile;
  onBack: () => void;
  onCompleteBooking: (booking: BookingRecord, debitWallet: number) => void;
  onOpenBookings: () => void;
  onViewBookedTicketDetails?: (booking: BookingRecord) => void;
}

interface RecentUnreservedSearch {
  id: string;
  fromCode: string;
  fromLabel: string;
  toCode: string;
  toLabel: string;
}

const DEFAULT_RECENT_UNRESERVED: RecentUnreservedSearch[] = [
  {
    id: 'BP-PTF',
    fromCode: 'BP',
    fromLabel: 'BARRACKPORE, BP',
    toCode: 'PTF',
    toLabel: 'PALTA, PTF',
  },
  {
    id: 'PTF-BP',
    fromCode: 'PTF',
    fromLabel: 'PALTA, PTF',
    toCode: 'BP',
    toLabel: 'BARRACKPORE, BP',
  },
];

function loadRecentUnreserved(userKey: string): RecentUnreservedSearch[] {
  const scopedKey = getRecentUnreservedStorageKey(userKey);
  try {
    const raw = localStorage.getItem(scopedKey);
    if (raw) {
      const parsed = JSON.parse(raw) as RecentUnreservedSearch[];
      return Array.isArray(parsed) ? parsed : [];
    }
    if (isDefaultSeedUserKey(userKey)) {
      const legacyRaw = localStorage.getItem('railone_recent_unreserved');
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw) as RecentUnreservedSearch[];
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_RECENT_UNRESERVED;
      }
      return DEFAULT_RECENT_UNRESERVED;
    }
    return [];
  } catch {
    return isDefaultSeedUserKey(userKey) ? DEFAULT_RECENT_UNRESERVED : [];
  }
}

function TrainOutlineIcon({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 28 18"
      className={`h-[18px] w-[26px] shrink-0 text-[#6B7280] ${flip ? '-scale-x-100' : ''}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 4.5h13.5c3.5 0 6.5 1.8 8.8 4.8.7.9.1 2.2-1 2.2H2.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 6.3h3.2c1.4 0 2.7.7 3.7 1.9H15.5V6.3Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <rect x="4.5" y="6.3" width="2.8" height="2.4" rx="0.4" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8.8" y="6.3" width="2.8" height="2.4" rx="0.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 14h24" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="6" cy="12.5" r="1.1" fill="currentColor" />
      <circle cx="11.5" cy="12.5" r="1.1" fill="currentColor" />
      <circle cx="19" cy="12.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function CurvedRouteIcon() {
  return (
    <svg viewBox="0 0 32 16" className="h-4 w-8 mx-auto text-[#2B7DE9]" fill="none" aria-hidden="true">
      <circle cx="7" cy="11.5" r="2.1" fill="currentColor" />
      <path
        d="M9.5 10.5c2.2-2.2 1.2-6.5 5-6.5s2.5 8 6.5 8c1.6 0 2.5-1.2 3-2.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeDasharray="2.6 2.2"
      />
      <circle cx="25" cy="5.5" r="2.1" fill="currentColor" />
    </svg>
  );
}

const EXTRA_UNRESERVED_STATIONS: Record<string, Station> = {
  PGTN: { code: 'PGTN', name: 'PALGHAT TOWN', city: 'Palakkad', zone: 'SR' },
  KLYG: { code: 'KLYG', name: 'KALYANI GHOSHPARA', city: 'Kolkata', zone: 'ER' },
  LKPR: { code: 'LKPR', name: 'LAKSHMIKANTAPUR', city: 'Kolkata', zone: 'ER' },
  MCA: { code: 'MCA', name: 'MECHEDA', city: 'Mecheda', zone: 'SER' },
};

export function UnreservedBookingView({
  initialTab = 'unreserved',
  initialFromCode,
  initialToCode,
  initialPlatformCode,
  stations = RAIL_STATIONS,
  suburbanIndex = null,
  fareDb = getOfficialEasternRailwayFareDb(),
  profile,
  onBack,
  onCompleteBooking,
  onOpenBookings,
  onViewBookedTicketDetails,
}: UnreservedBookingViewProps) {
  const [ticketMode, setTicketMode] = useState<'unreserved' | 'platform'>(initialTab);
  const [utsSubMode, setUtsSubMode] = useState<'Normal' | 'Season'>('Normal');
  const [stationProximity] = useState<'Outside Station' | 'At Station'>('Outside Station');
  const [showOutsideInfo, setShowOutsideInfo] = useState(false);

  // Season-mode controls matching Reference Image 2
  const [seasonActionType, setSeasonActionType] = useState<'ISSUE' | 'RENEW'>('ISSUE');
  const [seasonBookingFor, setSeasonBookingFor] = useState<'Self' | 'Others'>('Self');
  const [seasonStartDateMode, setSeasonStartDateMode] = useState<'Next Date' | 'Current Date'>(
    'Next Date'
  );

  // Start empty unless preselected so initial screen displays "Source" / "Destination"
  const [fromCode, setFromCode] = useState(initialFromCode ?? '');
  const [toCode, setToCode] = useState(initialToCode ?? '');
  const [stationPickerTarget, setStationPickerTarget] = useState<'Source' | 'Destination' | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentUnreservedSearch[]>(() =>
    loadRecentUnreserved(profile.userId)
  );

  useEffect(() => {
    setRecentSearches(loadRecentUnreserved(profile.userId));
  }, [profile.userId]);

  const [trainType, setTrainType] = useState<'Ordinary' | 'Mail/Express' | 'Superfast'>('Ordinary');
  const [ticketType, setTicketType] = useState<'JOURNEY' | 'RETURN'>('JOURNEY');
  const [classCode] = useState<'II' | 'FC'>('II');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [availConcession, setAvailConcession] = useState(false);
  const [payWithRWallet, setPayWithRWallet] = useState(true);

  const [showJourneyScreen, setShowJourneyScreen] = useState(false);
  const [showPaymentScreen, setShowPaymentScreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [issuedTicket, setIssuedTicket] = useState<BookingRecord | null>(null);

  useEffect(() => {
    setTicketMode(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialFromCode) setFromCode(initialFromCode);
  }, [initialFromCode]);

  useEffect(() => {
    if (initialToCode) setToCode(initialToCode);
  }, [initialToCode]);

  const resolveStation = (codeOrId: string): Station | undefined => {
    if (!codeOrId.trim()) return undefined;
    const upper = codeOrId.trim().toUpperCase();
    return (
      stations.find(
        (s) =>
          s.code.toUpperCase() === upper ||
          s.stationId?.toLowerCase() === codeOrId.toLowerCase()
      ) ?? EXTRA_UNRESERVED_STATIONS[upper]
    );
  };

  const fromStation = resolveStation(fromCode);
  const toStation = resolveStation(toCode);

  const suburbanPath = useMemo(() => {
    if (!suburbanIndex || !fromStation || !toStation) return null;
    const fromSubKey = fromStation.stationId ?? fromStation.code;
    const toSubKey = toStation.stationId ?? toStation.code;
    const res = findSuburbanPath(suburbanIndex, fromSubKey, toSubKey);
    return res.fromStation && res.toStation ? res : null;
  }, [suburbanIndex, fromStation, toStation]);

  const estimatedDistanceKm = useMemo(() => {
    if (!fromStation || !toStation) return 5;
    if (fromStation.code === toStation.code) return 1;
    if (suburbanPath && suburbanPath.found && suburbanPath.totalProvisionalKm !== null) {
      return Math.max(1, suburbanPath.totalProvisionalKm);
    }
    const idxA = stations.findIndex((s) => s.code === fromStation.code);
    const idxB = stations.findIndex((s) => s.code === toStation.code);
    return Math.max(5, Math.abs(idxA - idxB) * 12 + 20);
  }, [fromStation, toStation, suburbanPath, stations]);

  const suburbanFareBreakdown = useMemo(() => {
    if (!suburbanPath || !suburbanPath.found || suburbanPath.totalProvisionalKm === null) {
      return null;
    }
    return calculateSuburbanFareBreakdown(suburbanPath.totalProvisionalKm, fareDb);
  }, [suburbanPath, fareDb]);

  const unreservedFare = useMemo(() => {
    if (
      suburbanFareBreakdown &&
      suburbanPath?.totalProvisionalKm !== null &&
      suburbanPath?.totalProvisionalKm !== undefined &&
      trainType === 'Ordinary' &&
      fromCode !== toCode
    ) {
      const distKm = suburbanPath.totalProvisionalKm;
      const safeAdults = Math.max(1, adults);
      const safeChildren = Math.max(0, children);
      const tripMultiplier = ticketType === 'RETURN' ? 2 : 1;
      const concessionMultiplier = availConcession ? 0.5 : 1;

      let baseFare = 0;
      if (utsSubMode === 'Normal' && classCode === 'II' && distKm > 0) {
        const adultUnit = calculateFare(distKm, 'adult', fareDb);
        const childUnit = calculateFare(distKm, 'child', fareDb);
        baseFare = Math.max(
          5,
          Math.round((adultUnit * safeAdults + childUnit * safeChildren) * tripMultiplier * concessionMultiplier)
        );
      } else {
        const paxUnits = safeAdults + safeChildren * 0.5;
        const singleUnit =
          utsSubMode === 'Season'
            ? classCode === 'FC'
              ? suburbanFareBreakdown.monthlySeasonII * 3
              : suburbanFareBreakdown.monthlySeasonII
            : suburbanFareBreakdown.fcSingle;
        baseFare = Math.max(
          5,
          Math.round(singleUnit * paxUnits * tripMultiplier * concessionMultiplier)
        );
      }

      const discountPercent = payWithRWallet ? 3 : 0;
      const discountAmount = payWithRWallet ? Number(((baseFare * 3) / 100).toFixed(2)) : 0;
      const finalFare = Number((baseFare - discountAmount).toFixed(2));
      return { baseFare, discountAmount, finalFare, discountPercent };
    }
    return calculateUnreservedFare({
      distanceKm: estimatedDistanceKm,
      trainType,
      classCode,
      adults,
      children,
      mode: utsSubMode,
      payWithRWallet,
      ticketType,
      availConcession,
    });
  }, [
    suburbanFareBreakdown,
    suburbanPath,
    fareDb,
    estimatedDistanceKm,
    trainType,
    ticketType,
    availConcession,
    classCode,
    adults,
    children,
    utsSubMode,
    payWithRWallet,
    fromCode,
    toCode,
  ]);

  const saveRecentSearch = (src: Station, dst: Station) => {
    const entry: RecentUnreservedSearch = {
      id: `${src.code}-${dst.code}`,
      fromCode: src.code,
      fromLabel: `${src.name}, ${src.code}`,
      toCode: dst.code,
      toLabel: `${dst.name}, ${dst.code}`,
    };
    setRecentSearches((prev) => {
      const next = [entry, ...prev.filter((item) => item.id !== entry.id)].slice(0, 4);
      try {
        localStorage.setItem(getRecentUnreservedStorageKey(profile.userId), JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  };

  const handleSwap = () => {
    setErrorMsg(null);
    setFromCode(toCode);
    setToCode(fromCode);
  };

  const handleOpenProceed = () => {
    if (isWalletExhausted(profile.rWalletBalance)) {
      setErrorMsg(
        canBookTicketWithWallet({
          rWalletBalance: profile.rWalletBalance,
          payableFare: unreservedFare.finalFare,
        }).reason
      );
      return;
    }
    if (!fromStation || !toStation) {
      setErrorMsg('Please select both Source and Destination stations.');
      return;
    }
    if (fromStation.code.toUpperCase() === toStation.code.toUpperCase()) {
      setErrorMsg('Source and Destination stations must be different.');
      return;
    }
    setErrorMsg(null);
    setShowJourneyScreen(true);
  };

  const handleBookUnreserved = () => {
    if (!fromStation || !toStation) {
      setErrorMsg('Please select both Source and Destination stations.');
      return;
    }
    if (fromStation.code.toUpperCase() === toStation.code.toUpperCase()) {
      setErrorMsg('From and To stations must be different.');
      return;
    }
    const walletCheck = canBookTicketWithWallet({
      rWalletBalance: profile.rWalletBalance,
      payableFare: unreservedFare.finalFare,
    });
    if (!walletCheck.allowed) {
      setErrorMsg(walletCheck.reason);
      return;
    }
    setErrorMsg(null);
    saveRecentSearch(fromStation, toStation);

    const utsNo = generateUtsNumber();
    const now = new Date();
    const validUntilDate = calculateBookingValidUntil({
      bookedAt: now,
      ticketType,
    });
    const isSatReturn = isSaturdayReturnTicket({
      bookedAt: now,
      ticketType,
    });
    const booking: BookingRecord = {
      id: `uts-${Date.now()}`,
      kind: 'unreserved',
      pnrOrTicketNo: utsNo,
      irCode: generateRandomIrCode(),
      title: `UTS Paperless Ticket · ${utsSubMode}`,
      subtitle:
        utsSubMode === 'Season'
          ? `${classCode === 'II' ? 'Second Class (II)' : 'First Class (FC)'} · ${seasonActionType} (${seasonBookingFor} · ${seasonStartDateMode})`
          : `${classCode === 'II' ? 'Second Class (II)' : 'First Class (FC)'} · ${stationProximity}${availConcession ? ' · Concession' : ''}`,
      ticketType,
      via: '-',
      adultsCount: adults,
      childrenCount: children,
      fromCode: fromStation.code,
      fromName: fromStation.name,
      toCode: toStation.code,
      toName: toStation.name,
      distanceKm: estimatedDistanceKm,
      journeyDate: now.toISOString().slice(0, 10),
      journeyDisplayDate:
        utsSubMode === 'Season'
          ? 'Valid 30 Days'
          : isSatReturn
          ? `Valid upto ${formatSaturdayReturnValidityLabel(validUntilDate)}`
          : 'Valid 24 hrs',
      bookingDateLabel: formatBookingDateLabel(now),
      bookedAtTimestamp: formatBookingTimestamp(now),
      departureTime: trainType,
      classOrMode: `${classCode} · ${trainType}`,
      fare: unreservedFare.finalFare,
      originalFare: unreservedFare.baseFare,
      discountSaved: unreservedFare.discountAmount,
      paymentMethod: 'R-Wallet',
      status: 'Active',
      passengers: [
        {
          name: `${adults} Adult${adults > 1 ? 's' : ''}${children > 0 ? `, ${children} Child` : ''}`,
          age: 30,
          gender: 'M',
          coach: 'GEN',
          berth: 'Unreserved',
          status: 'ACTIVE',
        },
      ],
      createdAt: now.toISOString(),
      validUntil: validUntilDate.toISOString(),
    };
    onCompleteBooking(booking, unreservedFare.finalFare);
    setShowPaymentScreen(false);
    setShowJourneyScreen(false);
    if (onViewBookedTicketDetails) {
      onViewBookedTicketDetails(booking);
    } else {
      setIssuedTicket(booking);
    }
  };

  const handleBookPlatformTicket = (params: {
    station: Station;
    persons: number;
    proximity: 'Outside Station' | 'At Station';
    baseFare: number;
    finalFare: number;
    discountSaved: number;
  }) => {
    const utsNo = generateUtsNumber();
    const now = new Date();
    const validUntilDate = calculateBookingValidUntil({
      bookedAt: now,
      ticketType: 'PLATFORM',
    });
    const booking: BookingRecord = {
      id: `plt-${Date.now()}`,
      kind: 'platform',
      pnrOrTicketNo: utsNo,
      irCode: generateRandomIrCode(),
      title: `Platform Ticket · ${params.station.name}`,
      subtitle: `${params.persons} Person${params.persons > 1 ? 's' : ''} · ${params.proximity} · Valid 2 Hours`,
      ticketType: 'PLATFORM',
      via: '-',
      adultsCount: params.persons,
      childrenCount: 0,
      fromCode: params.station.code,
      fromName: params.station.name,
      toCode: params.station.code,
      toName: params.station.name,
      distanceKm: 0,
      journeyDate: now.toISOString().slice(0, 10),
      journeyDisplayDate: 'Valid 24 hrs',
      bookingDateLabel: formatBookingDateLabel(now),
      bookedAtTimestamp: formatBookingTimestamp(now),
      departureTime: 'All Platforms',
      classOrMode: 'Platform Entry',
      fare: params.finalFare,
      originalFare: params.baseFare,
      discountSaved: params.discountSaved,
      paymentMethod: 'R-Wallet',
      status: 'Active',
      passengers: [
        {
          name: `${params.persons} Visitor${params.persons > 1 ? 's' : ''}`,
          age: 30,
          gender: 'M',
          coach: 'PF',
          berth: 'Entry Pass',
          status: 'ACTIVE',
        },
      ],
      createdAt: now.toISOString(),
      validUntil: validUntilDate.toISOString(),
    };
    onCompleteBooking(booking, params.finalFare);
    if (onViewBookedTicketDetails) {
      onViewBookedTicketDetails(booking);
    } else {
      setIssuedTicket(booking);
    }
  };

  if (issuedTicket) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 max-w-xl w-full shadow-xs space-y-5">
          <div className="flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="h-8 w-8 shrink-0" />
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Paperless QR Ticket Issued
              </h2>
              <p className="text-xs text-slate-500">
                UTS No:{' '}
                <span className="font-mono-num font-bold text-slate-900">
                  {issuedTicket.pnrOrTicketNo}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-[#F4F8FD] border border-slate-200 p-5 flex flex-col sm:flex-row items-center gap-5">
            <div className="h-28 w-28 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <QrCode className="h-20 w-20 text-slate-900" />
            </div>
            <div className="space-y-1.5 text-center sm:text-left">
              <p className="font-display font-bold text-slate-900">{issuedTicket.title}</p>
              <p className="text-sm font-semibold text-[#0B63E5]">
                {issuedTicket.fromCode}{' '}
                {issuedTicket.kind !== 'platform' ? `→ ${issuedTicket.toCode}` : ''}
              </p>
              <p className="text-xs text-slate-600">{issuedTicket.subtitle}</p>
              <p className="font-mono-num text-sm font-bold text-slate-900">
                Paid: ₹ {issuedTicket.fare.toFixed(2)}{' '}
                {issuedTicket.discountSaved ? (
                  <span className="text-emerald-700 text-xs">
                    (Saved ₹{issuedTicket.discountSaved.toFixed(2)} via R-Wallet)
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onOpenBookings}
              className="flex-1 min-h-[44px] rounded-xl bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0052CC]"
            >
              Show Ticket in My Bookings
            </button>
            <button
              type="button"
              onClick={() => setIssuedTicket(null)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full-screen Platform E-Ticket screen matching user reference design
  if (ticketMode === 'platform') {
    return (
      <PlatformBookingScreen
        userId={profile.userId}
        initialStationCode={initialPlatformCode}
        stations={stations}
        rWalletBalance={profile.rWalletBalance}
        onBack={onBack}
        onCompletePlatformBooking={handleBookPlatformTicket}
      />
    );
  }

  // Step-3 Make Payment Screen matching Reference Make Payment screenshot
  if (showPaymentScreen && fromStation && toStation) {
    return (
      <UnreservedMakePaymentScreen
        fromStation={fromStation}
        toStation={toStation}
        trainType={trainType}
        ticketType={ticketType}
        adults={adults}
        childrenCount={children}
        availConcession={availConcession}
        baseFare={unreservedFare.baseFare}
        finalFare={unreservedFare.finalFare}
        discountAmount={unreservedFare.discountAmount}
        rWalletBalance={profile.rWalletBalance}
        errorMsg={errorMsg}
        onBack={() => {
          setErrorMsg(null);
          setShowPaymentScreen(false);
        }}
        onPayUsingRWallet={handleBookUnreserved}
      />
    );
  }

  // Step-2 Unreserved Journey Screen matching Reference Screenshot 3
  if (showJourneyScreen && fromStation && toStation) {
    return (
      <UnreservedJourneyScreen
        fromStation={fromStation}
        toStation={toStation}
        trainType={trainType}
        onChangeTrainType={(val) => {
          setErrorMsg(null);
          setTrainType(val);
        }}
        ticketType={ticketType}
        onChangeTicketType={(val) => {
          setErrorMsg(null);
          setTicketType(val);
        }}
        adults={adults}
        onChangeAdults={(val) => {
          setErrorMsg(null);
          setAdults(val);
        }}
        childrenCount={children}
        onChangeChildren={(val) => {
          setErrorMsg(null);
          setChildren(val);
        }}
        availConcession={availConcession}
        onToggleConcession={() => {
          setErrorMsg(null);
          setAvailConcession((prev) => !prev);
        }}
        payWithRWallet={payWithRWallet}
        onChangePayWithRWallet={(val) => {
          setErrorMsg(null);
          setPayWithRWallet(val);
        }}
        baseFare={unreservedFare.baseFare}
        finalFare={unreservedFare.finalFare}
        discountAmount={unreservedFare.discountAmount}
        estimatedDistanceKm={estimatedDistanceKm}
        suburbanPath={suburbanPath}
        suburbanFareBreakdown={suburbanFareBreakdown}
        rWalletBalance={profile.rWalletBalance}
        errorMsg={errorMsg}
        onBack={() => {
          setErrorMsg(null);
          setShowJourneyScreen(false);
        }}
        onBookNow={() => {
          const walletCheck = canBookTicketWithWallet({
            rWalletBalance: profile.rWalletBalance,
            payableFare: unreservedFare.finalFare,
          });
          if (!walletCheck.allowed) {
            setErrorMsg(walletCheck.reason);
            return;
          }
          setErrorMsg(null);
          setPayWithRWallet(true);
          setShowPaymentScreen(true);
        }}
      />
    );
  }

  // Exact full-screen Unreserved E-Ticket view
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {/* Top White Header */}
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-100/80 shrink-0">
        <div className="w-9" aria-hidden="true" />
        <h1 className="font-display text-[18px] sm:text-[19px] font-bold text-[#111842] tracking-tight">
          Unreserved E-Ticket
        </h1>
        <button
          type="button"
          onClick={onBack}
          aria-label="Close Unreserved E-Ticket"
          className="h-9 w-9 rounded-full border border-[#BBD4EC] text-[#111842] hover:bg-slate-50 flex items-center justify-center transition-colors"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-3.5 pt-3 pb-8 space-y-5">
        {/* Main White Booking Card */}
        <section className="rounded-[24px] border border-[#E5E9F0] bg-white px-4 py-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)] space-y-4">
          {/* Segmented Normal | Season Switch */}
          <div role="tablist" className="grid grid-cols-2 rounded-xl bg-[#EEF0F4] p-1">
            {(['Normal', 'Season'] as const).map((m) => {
              const active = utsSubMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setErrorMsg(null);
                    setUtsSubMode(m);
                  }}
                  className={`min-h-[40px] rounded-lg text-[14.5px] transition-all ${
                    active
                      ? 'bg-white text-[#0066FF] font-semibold shadow-2xs'
                      : 'text-[#111827] font-medium hover:text-[#0066FF]'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>

          {utsSubMode === 'Normal' ? (
            <>
              {/* Outside Station | At Station Pills (At Station: hover-only, click disabled) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowOutsideInfo((prev) => !prev)}
                    className="w-full min-h-[42px] pl-4 pr-10 rounded-full border bg-[#0066FF] border-[#0066FF] text-white flex items-center text-[13.5px] font-medium hover:bg-[#0052CC] transition-colors text-left"
                  >
                    <span>Outside Station</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Info about Outside Station"
                    onClick={() => setShowOutsideInfo((prev) => !prev)}
                    className="absolute right-3.5 h-6 w-6 rounded-full inline-flex items-center justify-center text-white/90 hover:text-white"
                  >
                    <Info className="h-[17px] w-[17px]" strokeWidth={1.8} />
                  </button>
                </div>

                {/* At Station: Click event disabled, hover effect only */}
                <button
                  type="button"
                  className="min-h-[42px] px-4 rounded-full border bg-white border-[#D1D5DB] text-[#374151] flex items-center justify-between text-[13.5px] font-medium hover:bg-slate-50 hover:border-[#9CA3AF] transition-colors"
                >
                  <span>At Station</span>
                  <Info className="h-[17px] w-[17px] text-[#D1D5DB]" strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>

              {showOutsideInfo && (
                <p className="rounded-xl bg-[#EEF5FF] px-3 py-2 text-[12px] text-[#1E3A8A]">
                  Book paperless UTS tickets via GPS geofence when outside railway station premises (up to 5 km).
                </p>
              )}

              {/* From / To Station Stack with Swap Button */}
              <div className="relative pt-1">
                <div>
                  <span className="block text-[13px] font-medium text-[#1F759E] mb-1.5">
                    From
                  </span>
                  <button
                    id="uts-from"
                    type="button"
                    onClick={() => setStationPickerTarget('Source')}
                    aria-haspopup="dialog"
                    aria-label="From Source Station"
                    className="w-full flex items-center gap-3 pb-3 border-b border-[#E5E7EB] pr-12 text-left focus:outline-none group"
                  >
                    <TrainOutlineIcon />
                    {fromStation ? (
                      <span className="text-[15px] font-medium text-[#111827] truncate">
                        {fromStation.name} - {fromStation.code}
                      </span>
                    ) : (
                      <span className="text-[15px] text-[#9CA3AF] group-hover:text-[#6B7280]">
                        Source
                      </span>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSwap}
                  aria-label="Swap From and To stations"
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-[#DCEAFF] text-[#0066FF] hover:bg-[#0066FF] hover:text-white flex items-center justify-center transition-colors"
                >
                  <ArrowUpDown className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>

                <div className="mt-3">
                  <span className="block text-[13px] font-medium text-[#1F759E] mb-1.5">To</span>
                  <button
                    id="uts-to"
                    type="button"
                    onClick={() => setStationPickerTarget('Destination')}
                    aria-haspopup="dialog"
                    aria-label="To Destination Station"
                    className="w-full flex items-center gap-3 pb-2 pr-12 text-left focus:outline-none group"
                  >
                    <TrainOutlineIcon flip />
                    {toStation ? (
                      <span className="text-[15px] font-medium text-[#111827] truncate">
                        {toStation.name} - {toStation.code}
                      </span>
                    ) : (
                      <span className="text-[15px] text-[#9CA3AF] group-hover:text-[#6B7280]">
                        Destination
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <p
                  role="alert"
                  className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
                >
                  {errorMsg}
                </p>
              )}

              {/* Primary & Secondary Action Pills */}
              <div className="pt-1 space-y-3">
                <button
                  type="button"
                  onClick={handleOpenProceed}
                  className="w-full min-h-[48px] rounded-full bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15.5px] font-medium transition-colors"
                >
                  Proceed To Book
                </button>
                {/* Check Upcoming Trains: Click event disabled, hover effect only */}
                <button
                  type="button"
                  className="w-full min-h-[48px] rounded-full bg-white border border-[#0066FF] text-[#0066FF] hover:bg-[#F0F6FF] text-[15.5px] font-medium transition-colors"
                >
                  Check Upcoming Trains
                </button>
              </div>
            </>
          ) : (
            /* Season Tab */
            <>
              {/* Type: ISSUE | RENEW */}
              <div className="rounded-xl bg-[#F3F4F6] px-4 py-2.5 flex items-center justify-between gap-2">
                <span className="text-[14px] text-[#4B5563]">Type</span>
                <div className="flex items-center gap-2.5">
                  {(['ISSUE', 'RENEW'] as const).map((t) => {
                    const active = seasonActionType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSeasonActionType(t)}
                        className={`min-h-[32px] px-5 rounded-full text-[13px] font-medium transition-colors ${
                          active
                            ? 'bg-[#0066FF] text-white'
                            : 'bg-white border border-[#9CA3AF] text-[#374151] hover:bg-slate-50'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Booking For: Self | Others */}
              <div className="px-1 py-1 flex items-center justify-between gap-2">
                <span className="text-[14px] text-[#4B5563]">Booking For</span>
                <div className="flex items-center gap-2.5">
                  {(['Self', 'Others'] as const).map((b) => {
                    const active = seasonBookingFor === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSeasonBookingFor(b)}
                        className={`min-h-[32px] px-7 rounded-full text-[13px] font-medium transition-colors ${
                          active
                            ? 'bg-[#0066FF] text-white'
                            : 'bg-white border border-[#9CA3AF] text-[#374151] hover:bg-slate-50'
                        }`}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* From / To Stack (No swap button in Season view) */}
              <div className="pt-1">
                <div>
                  <span className="block text-[13px] font-medium text-[#1F759E] mb-1.5">
                    From
                  </span>
                  <button
                    id="uts-season-from"
                    type="button"
                    onClick={() => setStationPickerTarget('Source')}
                    aria-haspopup="dialog"
                    aria-label="Season From Source Station"
                    className="w-full flex items-center gap-3 pb-3 border-b border-[#E5E7EB] text-left focus:outline-none group"
                  >
                    <TrainOutlineIcon />
                    {fromStation ? (
                      <span className="text-[15px] font-medium text-[#111827] truncate">
                        {fromStation.name} - {fromStation.code}
                      </span>
                    ) : (
                      <span className="text-[15px] text-[#9CA3AF] group-hover:text-[#6B7280]">
                        Source
                      </span>
                    )}
                  </button>
                </div>

                <div className="mt-3">
                  <span className="block text-[13px] font-medium text-[#1F759E] mb-1.5">To</span>
                  <button
                    id="uts-season-to"
                    type="button"
                    onClick={() => setStationPickerTarget('Destination')}
                    aria-haspopup="dialog"
                    aria-label="Season To Destination Station"
                    className="w-full flex items-center gap-3 pb-1 text-left focus:outline-none group"
                  >
                    <TrainOutlineIcon flip />
                    {toStation ? (
                      <span className="text-[15px] font-medium text-[#111827] truncate">
                        {toStation.name} - {toStation.code}
                      </span>
                    ) : (
                      <span className="text-[15px] text-[#9CA3AF] group-hover:text-[#6B7280]">
                        Destination
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Next Date | Current Date Pill Row */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {(['Next Date', 'Current Date'] as const).map((dt) => {
                  const active = seasonStartDateMode === dt;
                  return (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => setSeasonStartDateMode(dt)}
                      className={`min-h-[42px] rounded-full border text-[14px] font-medium transition-colors ${
                        active
                          ? 'bg-[#DCEAFF] border-[#0066FF] text-[#0066FF]'
                          : 'bg-white border-[#9CA3AF] text-[#374151] hover:bg-slate-50'
                      }`}
                    >
                      {dt}
                    </button>
                  );
                })}
              </div>

              {/* Season Proceed To Book: Click event disabled, hover effect only */}
              <button
                type="button"
                className="w-full min-h-[48px] rounded-full bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15.5px] font-medium transition-colors"
              >
                Proceed To Book
              </button>
            </>
          )}
        </section>

        {/* Recent Searches Section (Visible in Normal Mode) */}
        {utsSubMode === 'Normal' && recentSearches.length > 0 && (
          <section className="px-0.5">
            <h2 className="font-display text-[15.5px] font-bold text-[#111842] mb-3">
              Recent Searches
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {recentSearches.slice(0, 2).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setFromCode(item.fromCode);
                    setToCode(item.toCode);
                  }}
                  className="rounded-xl bg-[#DEEAFE] hover:bg-[#D0E2FD] px-3 py-3.5 text-center space-y-1.5 transition-colors"
                >
                  <p className="text-[13px] font-normal text-[#1E293B] truncate">
                    {item.fromLabel}
                  </p>
                  <CurvedRouteIcon />
                  <p className="text-[13px] font-normal text-[#1E293B] truncate">
                    {item.toLabel}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Full-Screen Search Station (Source / Destination) Modal */}
      {stationPickerTarget && (
        <UnreservedStationPickerModal
          mode={stationPickerTarget}
          stations={stations}
          onSelect={(st) => {
            setErrorMsg(null);
            if (stationPickerTarget === 'Source') {
              setFromCode(st.code);
            } else {
              setToCode(st.code);
            }
          }}
          onClose={() => setStationPickerTarget(null)}
        />
      )}
    </div>
  );
}
