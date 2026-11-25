import { useEffect, useState } from 'react';
import { Info, Minus, Plus, X } from 'lucide-react';
import type { Station } from '../types/rail';
import {
  calculatePlatformFare,
  canBookTicketWithWallet,
  getRecentPlatformStorageKey,
  isDefaultSeedUserKey,
  isWalletExhausted,
} from '../utils/railLogic';
import { UnreservedMakePaymentScreen } from './UnreservedMakePaymentScreen';
import { UnreservedStationPickerModal } from './UnreservedStationPickerModal';

interface RecentPlatformSearch {
  code: string;
  name: string;
}

const DEFAULT_RECENT_PLATFORM: RecentPlatformSearch[] = [
  { code: 'HWH', name: 'HOWRAH' },
];

function loadRecentPlatform(userId: string): RecentPlatformSearch[] {
  const scopedKey = getRecentPlatformStorageKey(userId);
  try {
    const raw = localStorage.getItem(scopedKey);
    if (raw) {
      const parsed = JSON.parse(raw) as RecentPlatformSearch[];
      return Array.isArray(parsed) ? parsed : [];
    }
    if (isDefaultSeedUserKey(userId)) {
      const legacyRaw = localStorage.getItem('railone_recent_platform');
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw) as RecentPlatformSearch[];
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_RECENT_PLATFORM;
      }
      return DEFAULT_RECENT_PLATFORM;
    }
    return [];
  } catch {
    return isDefaultSeedUserKey(userId) ? DEFAULT_RECENT_PLATFORM : [];
  }
}

function TrainOutlineIcon() {
  return (
    <svg
      viewBox="0 0 28 18"
      className="h-[18px] w-[26px] shrink-0 text-[#6B7280]"
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

function BlueTicketIcon() {
  return (
    <svg viewBox="0 0 32 22" className="h-[22px] w-[30px] text-[#0066FF] shrink-0" fill="none" aria-hidden="true">
      <path
        d="M2.5 3.5h27v4.2a2.8 2.8 0 0 0 0 5.6v5.2h-27v-5.2a2.8 2.8 0 0 0 0-5.6V3.5Z"
        fill="currentColor"
      />
      <path d="M10.5 4v14" stroke="#FFFFFF" strokeWidth="1.6" strokeDasharray="2.5 2" />
      <path d="M14.5 7.5h10M14.5 11h10M14.5 14.5h8" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" />
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

interface PlatformBookingScreenProps {
  userId?: string;
  initialStationCode?: string;
  stations: Station[];
  rWalletBalance: number;
  onBack: () => void;
  onCompletePlatformBooking: (params: {
    station: Station;
    persons: number;
    proximity: 'Outside Station' | 'At Station';
    baseFare: number;
    finalFare: number;
    discountSaved: number;
  }) => void;
}

const EXTRA_PLATFORM_STATIONS: Record<string, Station> = {
  PGTN: { code: 'PGTN', name: 'PALGHAT TOWN', city: 'Palakkad', zone: 'SR' },
  KLYG: { code: 'KLYG', name: 'KALYANI GHOSHPARA', city: 'Kolkata', zone: 'ER' },
  LKPR: { code: 'LKPR', name: 'LAKSHMIKANTAPUR', city: 'Kolkata', zone: 'ER' },
  MCA: { code: 'MCA', name: 'MECHEDA', city: 'Mecheda', zone: 'SER' },
};

export function PlatformBookingScreen({
  userId = 'kailash_rail',
  initialStationCode,
  stations,
  rWalletBalance,
  onBack,
  onCompletePlatformBooking,
}: PlatformBookingScreenProps) {
  const [proximity] = useState<'Outside Station' | 'At Station'>('Outside Station');
  const [showOutsideInfo, setShowOutsideInfo] = useState(false);
  const [stationCode, setStationCode] = useState(initialStationCode ?? '');
  const [pickedStation, setPickedStation] = useState<Station | null>(null);
  const [persons, setPersons] = useState(1);
  const [showStationPicker, setShowStationPicker] = useState(false);
  const [showPaymentScreen, setShowPaymentScreen] = useState(false);
  const [recentStations, setRecentStations] = useState<RecentPlatformSearch[]>(() =>
    loadRecentPlatform(userId)
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setRecentStations(loadRecentPlatform(userId));
  }, [userId]);

  const selectedStation = stationCode.trim()
    ? (pickedStation && pickedStation.code.toUpperCase() === stationCode.trim().toUpperCase()
        ? pickedStation
        : undefined) ??
      stations.find(
        (s) =>
          s.code.toUpperCase() === stationCode.trim().toUpperCase() ||
          s.stationId?.toLowerCase() === stationCode.trim().toLowerCase()
      ) ??
      EXTRA_PLATFORM_STATIONS[stationCode.trim().toUpperCase()]
    : undefined;

  const baseFare = selectedStation ? calculatePlatformFare(persons) : 0;
  const discountSaved = selectedStation ? Number((baseFare * 0.03).toFixed(2)) : 0;
  const finalFare = selectedStation ? Number((baseFare - discountSaved).toFixed(2)) : 0;
  const displayFareStr = selectedStation ? baseFare.toFixed(1) : '0.0';

  const saveRecentPlatform = (st: Station) => {
    const entry: RecentPlatformSearch = { code: st.code, name: st.name };
    setRecentStations((prev) => {
      const next = [entry, ...prev.filter((item) => item.code !== st.code)].slice(0, 3);
      try {
        localStorage.setItem(getRecentPlatformStorageKey(userId), JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  };

  const handlePayClick = () => {
    if (isWalletExhausted(rWalletBalance)) {
      setErrorMsg(
        canBookTicketWithWallet({
          rWalletBalance,
          payableFare: finalFare,
        }).reason
      );
      return;
    }
    if (!selectedStation) {
      setErrorMsg('Please select a Station.');
      return;
    }
    const walletCheck = canBookTicketWithWallet({
      rWalletBalance,
      payableFare: finalFare,
    });
    if (!walletCheck.allowed) {
      setErrorMsg(walletCheck.reason);
      return;
    }
    setErrorMsg(null);
    setShowPaymentScreen(true);
  };

  const handleConfirmRWalletPayment = () => {
    if (!selectedStation) return;
    const walletCheck = canBookTicketWithWallet({
      rWalletBalance,
      payableFare: finalFare,
    });
    if (!walletCheck.allowed) {
      setErrorMsg(walletCheck.reason);
      return;
    }
    setErrorMsg(null);
    saveRecentPlatform(selectedStation);
    onCompletePlatformBooking({
      station: selectedStation,
      persons,
      proximity,
      baseFare,
      finalFare,
      discountSaved,
    });
    setShowPaymentScreen(false);
  };

  if (showPaymentScreen && selectedStation) {
    return (
      <UnreservedMakePaymentScreen
        fromStation={selectedStation}
        toStation={selectedStation}
        trainType="Ordinary"
        ticketType="JOURNEY"
        adults={persons}
        childrenCount={0}
        availConcession={false}
        baseFare={baseFare}
        finalFare={finalFare}
        discountAmount={discountSaved}
        rWalletBalance={rWalletBalance}
        isPlatform
        errorMsg={errorMsg}
        onBack={() => {
          setErrorMsg(null);
          setShowPaymentScreen(false);
        }}
        onPayUsingRWallet={handleConfirmRWalletPayment}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {/* Top White Header matching reference Platform screenshot */}
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-100/80 shrink-0">
        <div className="w-9" aria-hidden="true" />
        <h1 className="font-display text-[18px] sm:text-[19px] font-bold text-[#111842] tracking-tight">
          Platform E-Ticket
        </h1>
        <button
          type="button"
          onClick={onBack}
          aria-label="Close Platform E-Ticket"
          className="h-9 w-9 rounded-full border border-[#BBD4EC] text-[#111842] hover:bg-slate-50 flex items-center justify-center transition-colors"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-3.5 pt-3 pb-8 space-y-5">
        {/* Main White Platform Card */}
        <section className="rounded-[24px] border border-[#E5E9F0] bg-white px-4 py-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)] space-y-4 overflow-hidden">
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
              Book paperless Platform E-Tickets via GPS geofence when outside railway station premises.
            </p>
          )}

          {/* Station Picker Row */}
          <div className="pt-1">
            <span className="block text-[13px] font-medium text-[#1F759E] mb-2">Station</span>
            <button
              id="platform-station-trigger"
              type="button"
              onClick={() => setShowStationPicker(true)}
              aria-haspopup="dialog"
              aria-label="Select Platform Station"
              className="w-full flex items-center gap-3 pb-3 border-b border-[#E5E7EB] text-left focus:outline-none group"
            >
              <TrainOutlineIcon />
              {selectedStation ? (
                <span className="text-[15px] font-medium text-[#111827] truncate">
                  {selectedStation.name} - {selectedStation.code}
                </span>
              ) : (
                <span className="text-[15px] text-[#9CA3AF] group-hover:text-[#6B7280]">
                  Station
                </span>
              )}
            </button>
          </div>

          {/* Number of Person(s) Stepper */}
          <div className="py-1 flex items-center justify-between gap-3">
            <span className="text-[15.5px] font-semibold text-[#111842]">
              Number of Person(s)
            </span>
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                aria-label="Decrease Number of Persons"
                disabled={persons <= 1}
                onClick={() => setPersons((p) => Math.max(1, p - 1))}
                className="h-8 w-8 rounded-full flex items-center justify-center text-[#0066FF] hover:bg-[#EAF4FF] disabled:opacity-45 transition-colors"
              >
                <Minus className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </button>
              <span
                aria-label="Person count"
                className="h-8 w-8 rounded-full bg-[#0066FF] text-white text-[14px] font-semibold flex items-center justify-center font-mono-num"
              >
                {persons}
              </span>
              <button
                type="button"
                aria-label="Increase Number of Persons"
                disabled={persons >= 4}
                onClick={() => setPersons((p) => Math.min(4, p + 1))}
                className="h-8 w-8 rounded-full flex items-center justify-center text-[#0066FF] hover:bg-[#EAF4FF] disabled:opacity-45 transition-colors"
              >
                <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {/* Full-bleed Total Fare Strip */}
          <div className="-mx-4 bg-[#F1F5F9]/85 px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BlueTicketIcon />
              <span className="font-display text-[15.5px] font-bold text-[#111842]">
                Total Fare
              </span>
            </div>
            <span className="font-mono-num text-[15.5px] font-medium text-[#111827]">
              ₹ {displayFareStr}
            </span>
          </div>

          {errorMsg && (
            <p
              role="alert"
              className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
            >
              {errorMsg}
            </p>
          )}

          {/* Primary Pay CTA */}
          <div className="pt-1 pb-1">
            <button
              type="button"
              onClick={handlePayClick}
              className="w-full min-h-[48px] rounded-full bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15.5px] font-medium transition-colors"
            >
              Pay ₹ {displayFareStr}
            </button>
          </div>
        </section>

        {/* Recent Searches Section */}
        {recentStations.length > 0 && (
          <section className="px-0.5">
            <h2 className="font-display text-[15.5px] font-bold text-[#111842] mb-3">
              Recent Searches
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              {recentStations.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setPickedStation(null);
                    setStationCode(item.code);
                  }}
                  className="min-w-[100px] rounded-xl bg-white hover:bg-[#EAF4FF] px-6 py-4 text-center space-y-1.5 shadow-[0_1px_4px_rgba(15,23,42,0.04)] transition-colors"
                >
                  <p className="text-[13.5px] font-normal text-[#1E293B]">{item.code}</p>
                  <CurvedRouteIcon />
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {showStationPicker && (
        <UnreservedStationPickerModal
          mode="Station"
          stations={stations}
          onSelect={(st) => {
            setErrorMsg(null);
            setPickedStation(st);
            setStationCode(st.code);
          }}
          onClose={() => setShowStationPicker(false)}
        />
      )}
    </div>
  );
}
