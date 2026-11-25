import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Heart,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrainFront,
  UserPlus,
} from 'lucide-react';
import { RAIL_STATIONS, RAIL_TRAINS } from '../data/railData';
import {
  calculateReservedFare,
  canBookTicketWithWallet,
  formatBookingDateLabel,
  formatBookingTimestamp,
  generatePnr,
  generateRandomIrCode,
  isWalletExhausted,
  searchTrains,
} from '../utils/railLogic';
import type {
  BookingRecord,
  DayAvailability,
  QuotaType,
  SavedPassenger,
  Station,
  TrainClassOption,
  TrainInfo,
  UserProfile,
} from '../types/rail';
import { StationSearchField } from './StationSearchField';

interface ReservedBookingViewProps {
  stations?: Station[];
  profile: UserProfile;
  savedPassengers: SavedPassenger[];
  onBack: () => void;
  onCompleteBooking: (booking: BookingRecord, debitWallet: number) => void;
  onOpenBookings: () => void;
}

const DATE_STRIP = [
  { iso: '2026-07-03', label: 'Thu, 03 Jul' },
  { iso: '2026-07-04', label: 'Fri, 04 Jul' },
  { iso: '2026-07-05', label: 'Sat, 05 Jul' },
  { iso: '2026-07-06', label: 'Sun, 06 Jul' },
  { iso: '2026-07-07', label: 'Mon, 07 Jul' },
];

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function ReservedBookingView({
  stations = RAIL_STATIONS,
  profile,
  savedPassengers,
  onBack,
  onCompleteBooking,
  onOpenBookings,
}: ReservedBookingViewProps) {
  const [fromCode, setFromCode] = useState('NDLS');
  const [toCode, setToCode] = useState('CNB');
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [quota, setQuota] = useState<QuotaType>('General');
  const [query, setQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(['22416']);
  const [expandedTrainClass, setExpandedTrainClass] = useState<string | null>('12878-3A');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Checkout state
  const [checkoutTarget, setCheckoutTarget] = useState<{
    train: TrainInfo;
    classOpt: TrainClassOption;
    day: DayAvailability;
  } | null>(null);
  const [selectedPaxIds, setSelectedPaxIds] = useState<string[]>(
    savedPassengers.length > 0 ? [savedPassengers[0].id] : []
  );
  const [customPaxName, setCustomPaxName] = useState('');
  const [customPaxAge, setCustomPaxAge] = useState('28');
  const [customPaxGender, setCustomPaxGender] = useState<'M' | 'F'>('M');
  const [customPassengers, setCustomPassengers] = useState<SavedPassenger[]>([]);
  const [cateringSelected, setCateringSelected] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'R-Wallet' | 'UPI' | 'Card'>('R-Wallet');
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingRecord | null>(null);

  const selectedDate = DATE_STRIP[selectedDateIdx];

  const matchingTrains = useMemo(() => {
    const direct = searchTrains(RAIL_TRAINS, {
      fromCode,
      toCode,
      query,
      onlyAvailable,
    });
    if (direct.length > 0 || query.trim() !== '') return direct;
    // If user picks a route pair without direct seed match, still show matching origin/all trains transparently
    return searchTrains(RAIL_TRAINS, { query, onlyAvailable });
  }, [fromCode, toCode, query, onlyAvailable]);

  const fromStation =
    stations.find((s) => s.code.toUpperCase() === fromCode.toUpperCase()) ?? stations[0];
  const toStation =
    stations.find((s) => s.code.toUpperCase() === toCode.toUpperCase()) ?? stations[1] ?? stations[0];

  const handleSwap = () => {
    setFromCode(toCode);
    setToCode(fromCode);
  };

  const toggleFavorite = (trainNo: string) => {
    setFavorites((prev) =>
      prev.includes(trainNo) ? prev.filter((id) => id !== trainNo) : [...prev, trainNo]
    );
  };

  const handleRefresh = (key: string) => {
    setRefreshingId(key);
    setTimeout(() => setRefreshingId(null), 450);
  };

  const allAvailablePax = [...savedPassengers, ...customPassengers];
  const activePaxList = allAvailablePax.filter((p) => selectedPaxIds.includes(p.id));

  const fareBreakdown = checkoutTarget
    ? calculateReservedFare({
        baseClassFare: checkoutTarget.classOpt.fare,
        quota,
        passengerCount: Math.max(1, activePaxList.length),
        cateringSelected,
      })
    : null;

  const handleAddCustomPax = () => {
    const trimmed = customPaxName.trim();
    const ageNum = Number(customPaxAge);
    if (!trimmed || Number.isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      setBookingError('Enter a valid passenger name and age (1–120).');
      return;
    }
    setBookingError(null);
    const newPax: SavedPassenger = {
      id: `custom-${Date.now()}`,
      name: trimmed,
      age: ageNum,
      gender: customPaxGender,
      berthPref: 'LB',
      mealPref: 'Veg',
    };
    setCustomPassengers((prev) => [...prev, newPax]);
    setSelectedPaxIds((prev) => [...prev, newPax.id]);
    setCustomPaxName('');
  };

  const handleConfirmBooking = () => {
    if (!checkoutTarget || !fareBreakdown) return;
    if (activePaxList.length === 0) {
      setBookingError('Select or add at least one passenger before paying.');
      return;
    }
    if (isWalletExhausted(profile.rWalletBalance)) {
      setBookingError(
        canBookTicketWithWallet({
          rWalletBalance: profile.rWalletBalance,
          payableFare: fareBreakdown.totalFare,
        }).reason
      );
      return;
    }
    if (paymentMethod === 'R-Wallet') {
      const walletCheck = canBookTicketWithWallet({
        rWalletBalance: profile.rWalletBalance,
        payableFare: fareBreakdown.totalFare,
      });
      if (!walletCheck.allowed) {
        setBookingError(`${walletCheck.reason} Switch to UPI or top up R-Wallet.`);
        return;
      }
    }

    setBookingError(null);
    const isAvail = checkoutTarget.day.kind === 'available';
    const pnr = generatePnr();
    const now = new Date();
    const newBooking: BookingRecord = {
      id: `bk-${Date.now()}`,
      kind: 'reserved',
      pnrOrTicketNo: pnr,
      irCode: generateRandomIrCode(),
      title: `${checkoutTarget.train.number} · ${checkoutTarget.train.name}`,
      subtitle: `${checkoutTarget.classOpt.code} · ${quota} Quota`,
      ticketType: `${checkoutTarget.classOpt.code} · ${quota.toUpperCase()}`,
      via: '-',
      adultsCount: activePaxList.length,
      childrenCount: 0,
      fromCode: fromStation.code,
      fromName: fromStation.name,
      toCode: toStation.code,
      toName: toStation.name,
      distanceKm: checkoutTarget.train.distanceKm,
      journeyDate: checkoutTarget.day.isoDate,
      journeyDisplayDate: checkoutTarget.day.dateLabel,
      bookingDateLabel: formatBookingDateLabel(now),
      bookedAtTimestamp: formatBookingTimestamp(now),
      departureTime: checkoutTarget.train.departureTime,
      arrivalTime: checkoutTarget.train.arrivalTime,
      classOrMode: checkoutTarget.classOpt.code,
      quota,
      fare: fareBreakdown.totalFare,
      originalFare: fareBreakdown.totalFare,
      paymentMethod,
      status: isAvail ? 'Confirmed' : 'WL',
      passengers: activePaxList.map((p, idx) => ({
        name: p.name,
        age: p.age,
        gender: p.gender,
        coach: isAvail ? (checkoutTarget.classOpt.code === 'CC' ? 'C4' : 'B2') : '--',
        berth: isAvail ? `${21 + idx} (${p.berthPref})` : `WL ${12 + idx}`,
        status: isAvail ? 'CNF' : 'WL',
      })),
      createdAt: now.toISOString(),
    };

    onCompleteBooking(newBooking, paymentMethod === 'R-Wallet' ? fareBreakdown.totalFare : 0);
    setConfirmedBooking(newBooking);
    setCheckoutTarget(null);
  };

  if (confirmedBooking) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 max-w-2xl mx-auto shadow-xs space-y-6">
        <div className="flex items-center gap-3 text-emerald-700">
          <CheckCircle2 className="h-8 w-8 shrink-0" />
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              E-Ticket Booked Successfully
            </h2>
            <p className="text-sm text-slate-600">
              PNR: <span className="font-mono-num font-bold text-slate-900">{confirmedBooking.pnrOrTicketNo}</span> · Paid via {confirmedBooking.paymentMethod}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-[#F4F8FD] p-5 border border-slate-200/80 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <p className="font-display font-bold text-slate-900">{confirmedBooking.title}</p>
              <p className="text-xs text-slate-500">{confirmedBooking.subtitle}</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800">
              {confirmedBooking.status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">From</p>
              <p className="font-bold text-slate-900">{confirmedBooking.fromCode}</p>
              <p className="font-mono-num text-xs text-slate-600">{confirmedBooking.departureTime}</p>
            </div>
            <div className="text-center self-center text-xs text-slate-500">
              {confirmedBooking.journeyDisplayDate}
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">To</p>
              <p className="font-bold text-slate-900">{confirmedBooking.toCode}</p>
              <p className="font-mono-num text-xs text-slate-600">{confirmedBooking.arrivalTime}</p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-1.5">
            {confirmedBooking.passengers.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs text-slate-700">
                <span>
                  {idx + 1}. {p.name} ({p.age}Y, {p.gender})
                </span>
                <span className="font-mono-num font-semibold text-slate-900">
                  {p.status} / {p.coach} / {p.berth}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-sm font-bold text-slate-900">
            <span>Total Fare Paid</span>
            <span className="font-mono-num">₹ {confirmedBooking.fare.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onOpenBookings}
            className="flex-1 min-h-[44px] rounded-xl bg-[#0B63E5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0952C2] transition-colors"
          >
            View in My Bookings
          </button>
          <button
            type="button"
            onClick={() => setConfirmedBooking(null)}
            className="min-h-[44px] rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Book Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Blue RailOne Search Results Header (Screenshot 4) */}
      <div className="rounded-3xl overflow-hidden border border-slate-200/80 bg-white shadow-xs">
        <div className="bg-[#0B63E5] text-white px-4 py-3.5 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Home"
              className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/15 transition-colors shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="font-display text-sm sm:text-base font-bold truncate">
                {fromStation.name} → {toStation.name}
              </p>
              <p className="text-xs text-blue-100">{selectedDate.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal className="h-4 w-4 text-blue-100" aria-hidden="true" />
            <span className="text-xs font-medium text-blue-100 hidden sm:inline">
              {matchingTrains.length} Trains
            </span>
          </div>
        </div>

        {/* Station Selector Bar */}
        <div className="p-4 sm:px-6 bg-[#F8FBFF] border-b border-slate-200 grid grid-cols-1 sm:grid-cols-11 gap-2.5 items-end">
          <div className="sm:col-span-5">
            <StationSearchField
              id="res-from"
              label="From Station"
              valueCode={fromCode}
              stations={stations}
              onChange={(st) => setFromCode(st.code)}
            />
          </div>

          <div className="sm:col-span-1 flex justify-center">
            <button
              type="button"
              onClick={handleSwap}
              aria-label="Swap From and To stations"
              className="h-11 w-11 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-[#0B63E5] hover:bg-[#EAF4FF] transition-colors"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          </div>

          <div className="sm:col-span-5">
            <StationSearchField
              id="res-to"
              label="To Station"
              valueCode={toCode}
              stations={stations}
              onChange={(st) => setToCode(st.code)}
            />
          </div>
        </div>

        {/* Date Strip */}
        <div className="px-4 py-3 sm:px-6 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-100">
          <Calendar className="h-4 w-4 text-slate-400 shrink-0 mr-1" aria-hidden="true" />
          {DATE_STRIP.map((d, idx) => {
            const active = idx === selectedDateIdx;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => setSelectedDateIdx(idx)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors min-h-[40px] ${
                  active
                    ? 'bg-[#0B63E5] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        {/* Search Name/No, Quota, Available Toggle */}
        <div className="px-4 py-3 sm:px-6 flex flex-wrap items-center gap-2.5 bg-white">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name / No."
              aria-label="Filter trains by Name or Number"
              className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B63E5]"
            />
          </div>

          <select
            value={quota}
            onChange={(e) => setQuota(e.target.value as QuotaType)}
            aria-label="Select Quota"
            className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0B63E5]"
          >
            <option value="General">General</option>
            <option value="Tatkal">Tatkal</option>
            <option value="Ladies">Ladies</option>
            <option value="Senior Citizen">Senior Citizen</option>
          </select>

          <button
            type="button"
            onClick={() => setOnlyAvailable((v) => !v)}
            className={`min-h-[40px] px-3.5 rounded-xl border text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
              onlyAvailable
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Available Only
          </button>
        </div>
      </div>

      {/* Train Cards List */}
      <div className="space-y-3.5">
        {matchingTrains.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <TrainFront className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="font-display font-semibold text-slate-800">No trains match your filter</p>
            <p className="text-xs text-slate-500 mt-1">
              Clear the search query or turn off Available Only to view all trains.
            </p>
          </div>
        ) : (
          matchingTrains.map((train) => {
            const isFav = favorites.includes(train.number);
            return (
              <article
                key={train.number}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3.5"
              >
                {/* Train Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono-num text-xs font-semibold text-slate-500">
                      {train.number}
                    </p>
                    <h3 className="font-display text-base font-bold text-slate-900">
                      {train.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(train.number)}
                    aria-label={`Favorite ${train.name}`}
                    className="h-10 w-10 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors"
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-400'
                      }`}
                    />
                  </button>
                </div>

                {/* Timings & Running Days */}
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-mono-num font-bold text-slate-900">
                      {train.departureTime}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        {selectedDate.label}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 truncate max-w-[120px] sm:max-w-none">
                      {train.fromName}
                    </p>
                  </div>

                  <div className="text-center px-2">
                    <p className="text-[11px] font-mono-num text-slate-500">
                      — {train.duration} —
                    </p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      {DAY_LETTERS.map((letter, idx) => (
                        <span
                          key={idx}
                          className={`text-[10px] font-bold ${
                            train.runningDays[idx] ? 'text-emerald-600' : 'text-slate-300'
                          }`}
                        >
                          {letter}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-mono-num font-bold text-slate-900">
                      {train.arrivalTime}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        {selectedDate.label}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 truncate max-w-[120px] sm:max-w-none">
                      {train.toName}
                    </p>
                  </div>
                </div>

                {/* Class Availability Cards */}
                <div className="flex flex-wrap gap-2.5">
                  {train.classes.map((cls) => {
                    const key = `${train.number}-${cls.code}`;
                    const isExpanded = expandedTrainClass === key;
                    const colorBox =
                      cls.kind === 'available'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : cls.kind === 'rac'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-orange-50 border-orange-200 text-orange-800';

                    return (
                      <button
                        key={cls.code}
                        type="button"
                        onClick={() =>
                          setExpandedTrainClass(isExpanded ? null : key)
                        }
                        className={`min-w-[132px] rounded-xl border p-2.5 text-left transition-all hover:shadow-xs ${colorBox} ${
                          isExpanded ? 'ring-2 ring-[#0B63E5]' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-xs font-bold text-slate-900">
                            {cls.code}
                          </span>
                          <span className="font-mono-num text-xs font-bold text-slate-800">
                            ₹ {cls.fare}
                          </span>
                        </div>
                        <p className="font-mono-num text-[11px] font-semibold mt-1">
                          {cls.status}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Expanded 6-Day Nearby Dates Grid */}
                {train.classes.map((cls) => {
                  const key = `${train.number}-${cls.code}`;
                  if (expandedTrainClass !== key) return null;
                  return (
                    <div
                      key={key}
                      className="rounded-2xl bg-[#F8FBFF] border border-slate-200 p-3.5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800">
                          {cls.code} · Base Fare: ₹{cls.fare} ({quota})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRefresh(key)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B63E5] hover:underline"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${
                              refreshingId === key ? 'animate-spin' : ''
                            }`}
                          />
                          Refresh
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {cls.nearbyDates.map((day) => {
                          const tileStyle =
                            day.kind === 'available'
                              ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-800'
                              : day.kind === 'rac'
                              ? 'bg-amber-50 border-amber-200 hover:border-amber-400 text-amber-800'
                              : 'bg-orange-50 border-orange-200 hover:border-orange-400 text-orange-800';
                          return (
                            <button
                              key={day.isoDate}
                              type="button"
                              onClick={() => {
                                setBookingError(null);
                                setCheckoutTarget({ train, classOpt: cls, day });
                              }}
                              className={`rounded-xl border p-2.5 text-left transition-all ${tileStyle}`}
                            >
                              <p className="text-xs font-semibold text-slate-900">
                                {day.dateLabel}
                              </p>
                              <p className="font-mono-num text-[11px] font-bold mt-0.5">
                                {day.status}
                              </p>
                              <p className="text-[11px] font-semibold text-[#0B63E5] mt-1">
                                Book Now →
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedTrainClass(null)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                      >
                        <ChevronUp className="h-3.5 w-3.5" /> Hide Nearby Dates
                      </button>
                    </div>
                  );
                })}

                {!train.classes.some((c) => expandedTrainClass === `${train.number}-${c.code}`) && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTrainClass(`${train.number}-${train.classes[0].code}`)
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B63E5] hover:underline"
                  >
                    View Nearby Dates <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Passenger Checkout Modal */}
      {checkoutTarget && fareBreakdown && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Passenger Details and Payment"
          className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <p className="text-xs font-semibold text-[#0B63E5]">
                  {checkoutTarget.train.number} · {checkoutTarget.train.name}
                </p>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Review &amp; Add Passengers
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {fromStation.code} → {toStation.code} · {checkoutTarget.day.dateLabel} ·{' '}
                  {checkoutTarget.classOpt.code} ({quota})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutTarget(null)}
                className="min-h-[40px] px-3 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            {/* Saved Passengers Selection */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Select Travellers ({activePaxList.length} selected)
              </p>
              <div className="space-y-2">
                {allAvailablePax.map((pax) => {
                  const checked = selectedPaxIds.includes(pax.id);
                  return (
                    <label
                      key={pax.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        checked
                          ? 'border-[#0B63E5] bg-[#EAF4FF]/60'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedPaxIds((prev) =>
                              prev.includes(pax.id)
                                ? prev.filter((id) => id !== pax.id)
                                : [...prev, pax.id]
                            )
                          }
                          className="h-4 w-4 accent-[#0B63E5]"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{pax.name}</p>
                          <p className="text-xs text-slate-500">
                            {pax.age} Y · {pax.gender} · {pax.berthPref} · {pax.mealPref}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Add Co-Passenger inline */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2.5">
                <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5 text-[#0B63E5]" /> Add New Passenger
                </p>
                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={customPaxName}
                    onChange={(e) => setCustomPaxName(e.target.value)}
                    placeholder="Full Name"
                    aria-label="New passenger full name"
                    className="col-span-6 min-h-[40px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs"
                  />
                  <input
                    type="number"
                    value={customPaxAge}
                    onChange={(e) => setCustomPaxAge(e.target.value)}
                    placeholder="Age"
                    aria-label="New passenger age"
                    className="col-span-2 min-h-[40px] rounded-lg border border-slate-200 bg-white px-2 text-xs"
                  />
                  <select
                    value={customPaxGender}
                    onChange={(e) => setCustomPaxGender(e.target.value as 'M' | 'F')}
                    aria-label="New passenger gender"
                    className="col-span-2 min-h-[40px] rounded-lg border border-slate-200 bg-white px-1.5 text-xs"
                  >
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddCustomPax}
                    className="col-span-2 min-h-[40px] rounded-lg bg-[#0B63E5] text-white text-xs font-semibold hover:bg-[#0952C2]"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Optional E-Catering */}
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-slate-900">Include IRCTC Onboard Meal</p>
                <p className="text-xs text-slate-500">₹185 per passenger · Veg Meal Combo</p>
              </div>
              <input
                type="checkbox"
                checked={cateringSelected}
                onChange={(e) => setCateringSelected(e.target.checked)}
                className="h-4 w-4 accent-[#0B63E5]"
              />
            </label>

            {/* Payment Method */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Payment Mode</p>
              <div className="grid grid-cols-3 gap-2">
                {(['R-Wallet', 'UPI', 'Card'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`min-h-[44px] rounded-xl border text-xs font-semibold transition-colors ${
                      paymentMethod === method
                        ? 'border-[#0B63E5] bg-[#EAF4FF] text-[#0B63E5]'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {method}
                    {method === 'R-Wallet' && (
                      <span className="block font-mono-num text-[10px] font-normal">
                        ₹{profile.rWalletBalance.toFixed(0)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Fare Summary */}
            <div className="rounded-2xl bg-slate-50 p-3.5 text-xs space-y-1.5 border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Ticket Fare ({Math.max(1, activePaxList.length)} pax)</span>
                <span className="font-mono-num">₹ {fareBreakdown.ticketFare}</span>
              </div>
              {fareBreakdown.quotaCharge > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Tatkal Charges</span>
                  <span className="font-mono-num">₹ {fareBreakdown.quotaCharge}</span>
                </div>
              )}
              {fareBreakdown.cateringCharge > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Onboard Catering</span>
                  <span className="font-mono-num">₹ {fareBreakdown.cateringCharge}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>CRIS Convenience Fee</span>
                <span className="font-mono-num">₹ {fareBreakdown.convenienceFee}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Total Payable</span>
                <span className="font-mono-num">₹ {fareBreakdown.totalFare}</span>
              </div>
            </div>

            {bookingError && (
              <div role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                <span>{bookingError}</span>
                {paymentMethod === 'R-Wallet' &&
                  !isWalletExhausted(profile.rWalletBalance) &&
                  profile.rWalletBalance < fareBreakdown.totalFare && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('UPI');
                      setBookingError(null);
                    }}
                    className="px-3 py-1 rounded-lg bg-[#0B63E5] text-white font-semibold hover:bg-[#0952C2]"
                  >
                    Switch to UPI
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirmBooking}
              className="w-full min-h-[48px] rounded-xl bg-[#0B63E5] text-white text-sm font-bold hover:bg-[#0952C2] transition-colors shadow-sm"
            >
              Pay ₹ {fareBreakdown.totalFare} &amp; Book Ticket
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
