import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Image as ImageIcon,
  Lightbulb,
  MapPin,
  MessageSquareWarning,
  Mic,
  Phone,
  Search,
  ShoppingBag,
  Star,
  UtensilsCrossed,
  Video,
  X,
} from 'lucide-react';
import { FOOD_MENU_ITEMS, RAIL_STATIONS, RAIL_TRAINS } from '../data/railData';
import { canBookTicketWithWallet, validatePnr } from '../utils/railLogic';
import type {
  BookingRecord,
  CoachPositionItem,
  FeedbackEntry,
  RailMadadComplaint,
  Station,
  UserProfile,
} from '../types/rail';

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

function AudioPersonIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[17px] w-[17px] text-[#0066FF]" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="6.5" r="2.7" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 16c0-2.5 2-4.2 4.5-4.2S12 13.5 12 16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M14.2 6.8a3.2 3.2 0 0 1 0 4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16.4 4.8a6 6 0 0 1 0 8.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function getDateChoices(): Array<{ label: string; iso: string }> {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return [0, 1, 2, 3].map((offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    const tag = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : days[d.getDay()];
    return {
      iso,
      label: `${tag}, ${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* 1. PNR STATUS VIEW (Matches 22_de705312.jpeg)                              */
/* -------------------------------------------------------------------------- */
export function PnrStatusView({
  bookings,
  onBack,
  onOpenOrderFood,
  onOpenTrackTrain,
}: {
  bookings: BookingRecord[];
  onBack: () => void;
  onOpenOrderFood: () => void;
  onOpenTrackTrain: () => void;
}) {
  const reservedBookings = bookings.filter((b) => b.kind === 'reserved');
  const [pnrInput, setPnrInput] = useState('');
  const [checkedPnr, setCheckedPnr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const matchedBooking = reservedBookings.find((b) => b.pnrOrTicketNo === checkedPnr);

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePnr(pnrInput)) {
      setError('Enter a valid 10-digit numeric PNR number.');
      return;
    }
    setError(null);
    setCheckedPnr(pnrInput.trim());
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Centered Header with right circular X button */}
      <header className="bg-white px-4 py-3.5 relative flex items-center justify-center">
        <h1 className="font-display text-[18.5px] font-bold text-[#0A265A] tracking-tight">
          PNR Status
        </h1>
        <button
          type="button"
          onClick={onBack}
          aria-label="Close PNR Status"
          className="absolute right-4 h-10 w-10 rounded-full border border-[#B8D6F8] bg-white hover:bg-slate-50 flex items-center justify-center text-[#0A265A] transition-colors"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
      </header>

      <div className="w-full max-w-xl mx-auto px-4 pt-2 pb-8 space-y-5">
        <form onSubmit={handleCheck} className="flex items-center gap-2.5">
          <input
            type="text"
            inputMode="numeric"
            maxLength={10}
            value={pnrInput}
            onChange={(e) => {
              setPnrInput(e.target.value.replace(/\D/g, ''));
              if (error) setError(null);
            }}
            placeholder="Enter PNR Number"
            aria-label="Enter PNR Number"
            className="flex-1 min-w-0 h-[48px] rounded-[10px] border border-[#93C5FD] px-3.5 text-[15px] text-slate-900 placeholder:text-[#6B7280] focus:outline-none focus:border-[#0066FF]"
          />
          <button
            type="submit"
            className="h-[48px] px-5 rounded-[10px] bg-[#0066FF] hover:bg-[#0055D4] text-white text-[15px] font-medium whitespace-nowrap shrink-0 transition-colors"
          >
            Show Status
          </button>
        </form>

        {error && (
          <p role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 rounded-xl p-3">
            {error}
          </p>
        )}

        {checkedPnr && (
          <div className="bg-white rounded-[20px] border border-slate-200 p-5 shadow-xs space-y-4">
            {matchedBooking ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <p className="font-mono-num text-xs font-semibold text-[#0066FF]">
                      PNR: {matchedBooking.pnrOrTicketNo}
                    </p>
                    <h2 className="font-display text-base font-bold text-slate-900">
                      {matchedBooking.title}
                    </h2>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {matchedBooking.status === 'Confirmed'
                      ? 'Chart Prepared · CNF'
                      : matchedBooking.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs bg-[#F8FBFF] rounded-2xl p-3.5">
                  <div>
                    <p className="text-slate-500">Boarding</p>
                    <p className="font-bold text-slate-900">{matchedBooking.fromCode}</p>
                    <p className="font-mono-num text-slate-600">{matchedBooking.departureTime}</p>
                  </div>
                  <div className="text-center self-center">
                    <p className="font-semibold text-slate-800">{matchedBooking.journeyDisplayDate}</p>
                    <p className="text-slate-500">{matchedBooking.classOrMode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500">Destination</p>
                    <p className="font-bold text-slate-900">{matchedBooking.toCode}</p>
                    <p className="font-mono-num text-slate-600">{matchedBooking.arrivalTime}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700">Passenger Current Status</p>
                  {matchedBooking.passengers.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs"
                    >
                      <span className="font-semibold text-slate-900">
                        Passenger {i + 1}: {p.name} ({p.age}Y/{p.gender})
                      </span>
                      <span className="font-mono-num font-bold text-emerald-700">
                        {p.status} · Coach {p.coach} · {p.berth}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={onOpenOrderFood}
                    className="min-h-[40px] px-4 rounded-full bg-[#EAF4FF] text-[#0066FF] text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <UtensilsCrossed className="h-3.5 w-3.5" /> Order Food for PNR
                  </button>
                  <button
                    type="button"
                    onClick={onOpenTrackTrain}
                    className="min-h-[40px] px-4 rounded-full border border-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Track Live Train
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4 space-y-2">
                <ClipboardCheck className="h-8 w-8 text-[#0066FF] mx-auto" />
                <p className="font-display font-bold text-slate-900">
                  PNR {checkedPnr} · Live Status: CNF / B2, 34
                </p>
                <p className="text-xs text-slate-500">
                  12314 SEALDAH RAJDHNI · 3A · Chart preparation 4 hours prior to departure.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. TRAIN COACH POSITION (Matches 33_38d7330b.jpeg)                         */
/* -------------------------------------------------------------------------- */
export function CoachPositionView({
  stations = RAIL_STATIONS,
  onBack,
}: {
  stations?: Station[];
  onBack: () => void;
}) {
  const [trainQuery, setTrainQuery] = useState('');
  const [showTrainList, setShowTrainList] = useState(false);
  const [selectedTrainNo, setSelectedTrainNo] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<CoachPositionItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateChoices = useMemo(() => getDateChoices(), []);

  const filteredTrains = useMemo(() => {
    const q = trainQuery.trim().toLowerCase();
    if (!q) return RAIL_TRAINS;
    return RAIL_TRAINS.filter(
      (t) =>
        t.number.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)
    );
  }, [trainQuery]);

  const resolvedTrain = useMemo(() => {
    if (selectedTrainNo) {
      return RAIL_TRAINS.find((t) => t.number === selectedTrainNo) ?? RAIL_TRAINS[0];
    }
    const q = trainQuery.trim().toLowerCase();
    if (q) {
      return (
        RAIL_TRAINS.find(
          (t) => t.number.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
        ) ?? RAIL_TRAINS[0]
      );
    }
    return RAIL_TRAINS[0];
  }, [selectedTrainNo, trainQuery]);

  const stationOptions = useMemo(() => {
    if (selectedTrainNo || trainQuery.trim()) {
      return resolvedTrain.schedule.map((s) => ({
        code: s.stationCode,
        name: s.stationName,
      }));
    }
    return stations.slice(0, 35).map((s) => ({ code: s.code, name: s.name }));
  }, [resolvedTrain, selectedTrainNo, trainQuery, stations]);

  const activeCoach =
    selectedCoach ?? resolvedTrain.coachComposition[3] ?? resolvedTrain.coachComposition[0];

  const coachColor = (type: CoachPositionItem['type']) => {
    switch (type) {
      case 'engine':
        return 'bg-slate-800 text-white border-slate-900';
      case 'ac1':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'ac2':
        return 'bg-sky-100 text-sky-900 border-sky-300';
      case 'ac3':
      case 'chair':
        return 'bg-blue-50 text-[#0066FF] border-blue-200';
      case 'exec':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'pantry':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      default:
        return 'bg-emerald-50 text-emerald-900 border-emerald-200';
    }
  };

  const handleShow = () => {
    if (!trainQuery.trim() && !selectedTrainNo) {
      setError('Please enter or select a Train Number/Name.');
      return;
    }
    setError(null);
    setHasSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col">
      <header className="bg-white px-4 py-3.5 relative flex items-center justify-center border-b border-slate-100/70">
        <h1 className="font-display text-[18.5px] font-bold text-[#0A265A] tracking-tight">
          Train Coach Position
        </h1>
        <button
          type="button"
          onClick={onBack}
          aria-label="Close Train Coach Position"
          className="absolute right-4 h-10 w-10 rounded-full border border-[#B8D6F8] bg-white hover:bg-slate-50 flex items-center justify-center text-[#0A265A] transition-colors"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
      </header>

      <div className="w-full max-w-xl mx-auto px-4 pt-4 pb-8 space-y-5">
        <div className="bg-white rounded-[20px] border border-slate-200/80 shadow-[0_2px_10px_rgba(15,23,42,0.03)] px-5 py-6 space-y-6">
          {/* Train Input */}
          <div className="relative">
            <label
              htmlFor="cp-train-input"
              className="block text-[15px] font-normal text-[#2B8AC6] mb-1.5"
            >
              Train
            </label>
            <div className="flex items-center gap-3 border-b border-slate-200/80 pb-2.5">
              <TrainOutlineIcon />
              <input
                id="cp-train-input"
                type="text"
                value={trainQuery}
                onFocus={() => setShowTrainList(true)}
                onBlur={() => setTimeout(() => setShowTrainList(false), 180)}
                onChange={(e) => {
                  setTrainQuery(e.target.value);
                  setSelectedTrainNo('');
                  setShowTrainList(true);
                  if (error) setError(null);
                }}
                placeholder="Train Number/Name"
                className="w-full bg-transparent text-[15px] text-slate-900 placeholder:text-[#9CA3AF] focus:outline-none"
              />
            </div>

            {showTrainList && filteredTrains.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                {filteredTrains.map((t) => (
                  <button
                    key={t.number}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setTrainQuery(`${t.number} - ${t.name}`);
                      setSelectedTrainNo(t.number);
                      setSelectedCoach(null);
                      setShowTrainList(false);
                      setError(null);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-[#EAF4FF] flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold text-slate-900">
                      {t.number} - {t.name}
                    </span>
                    <span className="text-[11px] text-[#0066FF] font-mono-num">
                      {t.fromCode} → {t.toCode}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Journey Station */}
          <div>
            <label
              htmlFor="cp-station-select"
              className="block text-[15px] font-normal text-[#2B8AC6] mb-1.5"
            >
              Journey Station
            </label>
            <div className="relative flex items-center border-b border-slate-200/80 pb-2.5">
              <select
                id="cp-station-select"
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="w-full appearance-none bg-transparent pr-7 text-[15px] font-medium text-[#111827] focus:outline-none"
              >
                <option value="">Select Station</option>
                {stationOptions.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.name} - {st.code}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="h-4 w-4 text-[#0066FF] pointer-events-none absolute right-0.5"
                strokeWidth={2.2}
              />
            </div>
          </div>

          {/* Journey Date */}
          <div>
            <label
              htmlFor="cp-date-select"
              className="block text-[15px] font-normal text-[#2B8AC6] mb-1.5"
            >
              Journey Date
            </label>
            <div className="relative flex items-center border-b border-slate-200/80 pb-2.5">
              <select
                id="cp-date-select"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full appearance-none bg-transparent pr-7 text-[15px] font-medium text-[#111827] focus:outline-none"
              >
                <option value="">Select Date</option>
                {dateChoices.map((d) => (
                  <option key={d.iso} value={d.iso}>
                    {d.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="h-4 w-4 text-[#0066FF] pointer-events-none absolute right-0.5"
                strokeWidth={2.2}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-amber-800 bg-amber-50 rounded-xl p-2.5">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleShow}
            className="w-full h-[48px] rounded-full bg-[#0066FF] hover:bg-[#0055D4] text-white text-[16px] font-medium transition-colors"
          >
            Show Coach Position
          </button>
        </div>

        {/* Platform Alignment Diagram shown once submitted */}
        {hasSubmitted && (
          <div className="rounded-[20px] bg-white border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold text-[#0A265A]">
                {resolvedTrain.number} {resolvedTrain.name} · PF{' '}
                {resolvedTrain.liveStatus.expectedPlatform}
              </span>
              <span>Tap any coach</span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {resolvedTrain.coachComposition.map((c) => {
                const isSelected = activeCoach.position === c.position;
                return (
                  <button
                    key={`${c.position}-${c.label}`}
                    type="button"
                    onClick={() => setSelectedCoach(c)}
                    className={`min-w-[58px] h-16 rounded-xl border-2 flex flex-col items-center justify-center transition-all shrink-0 ${coachColor(
                      c.type
                    )} ${isSelected ? 'ring-2 ring-[#0066FF] scale-105 shadow-sm' : ''}`}
                  >
                    <span className="font-mono-num text-[10px] opacity-70">#{c.position}</span>
                    <span className="font-display text-xs font-bold">{c.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dashed border-slate-300 text-[11px] text-slate-600 text-center">
              <div className="bg-[#F8FBFF] rounded-lg py-1.5 px-2 border border-slate-200">
                North FOB (Coach #2–3)
              </div>
              <div className="bg-[#F8FBFF] rounded-lg py-1.5 px-2 border border-slate-200">
                Main Stairs (Coach #6–7)
              </div>
              <div className="bg-[#F8FBFF] rounded-lg py-1.5 px-2 border border-slate-200">
                South Exit (Coach #10–11)
              </div>
            </div>

            <div className="rounded-xl bg-[#F8FBFF] border border-blue-200 p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-sm font-bold text-slate-900">
                  Coach {activeCoach.label} · Position {activeCoach.position} from Engine
                </p>
                <p className="text-xs text-slate-500">
                  Approx. {(activeCoach.position - 1) * 23} metres from front of train
                  {activeCoach.seats ? ` · ${activeCoach.seats} seats/berths` : ''}
                </p>
              </div>
              <span className="text-xs font-semibold text-[#0066FF]">
                Expected PF {resolvedTrain.liveStatus.expectedPlatform}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. TRACK YOUR TRAIN (Matches 44_119ea3e2.jpeg)                             */
/* -------------------------------------------------------------------------- */
export function TrackTrainView({
  stations = RAIL_STATIONS,
  onBack,
}: {
  stations?: Station[];
  onBack: () => void;
}) {
  const [trainQuery, setTrainQuery] = useState('');
  const [showTrainList, setShowTrainList] = useState(false);
  const [selectedTrainNo, setSelectedTrainNo] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateChoices = useMemo(() => getDateChoices(), []);

  const filteredTrains = useMemo(() => {
    const q = trainQuery.trim().toLowerCase();
    if (!q) return RAIL_TRAINS;
    return RAIL_TRAINS.filter(
      (t) =>
        t.number.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)
    );
  }, [trainQuery]);

  const train = useMemo(() => {
    if (selectedTrainNo) {
      return RAIL_TRAINS.find((t) => t.number === selectedTrainNo) ?? RAIL_TRAINS[0];
    }
    const q = trainQuery.trim().toLowerCase();
    if (q) {
      return (
        RAIL_TRAINS.find(
          (t) => t.number.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
        ) ?? RAIL_TRAINS[0]
      );
    }
    return RAIL_TRAINS[0];
  }, [selectedTrainNo, trainQuery]);

  const stationOptions = useMemo(() => {
    if (selectedTrainNo || trainQuery.trim()) {
      return train.schedule.map((s) => ({
        code: s.stationCode,
        name: s.stationName,
      }));
    }
    return stations.slice(0, 35).map((s) => ({ code: s.code, name: s.name }));
  }, [train, selectedTrainNo, trainQuery, stations]);

  const handleShowStatus = () => {
    if (!trainQuery.trim() && !selectedTrainNo) {
      setError('Please enter or select a Train Number/Name.');
      return;
    }
    setError(null);
    setHasSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col">
      <header className="bg-white px-4 py-3.5 relative flex items-center justify-center border-b border-slate-100/70">
        <h1 className="font-display text-[18.5px] font-bold text-[#0A265A] tracking-tight">
          Track Your Train
        </h1>
        <button
          type="button"
          onClick={onBack}
          aria-label="Close Track Your Train"
          className="absolute right-4 h-10 w-10 rounded-full border border-[#B8D6F8] bg-white hover:bg-slate-50 flex items-center justify-center text-[#0A265A] transition-colors"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
      </header>

      <div className="w-full max-w-xl mx-auto px-4 pt-4 pb-8 space-y-5">
        <div className="bg-white rounded-[20px] border border-slate-200/80 shadow-[0_2px_10px_rgba(15,23,42,0.03)] px-5 py-6 space-y-6">
          {/* Train Input */}
          <div className="relative">
            <label
              htmlFor="tt-train-input"
              className="block text-[15px] font-normal text-[#2B8AC6] mb-1.5"
            >
              Train
            </label>
            <div className="flex items-center gap-3 border-b border-slate-200/80 pb-2.5">
              <TrainOutlineIcon />
              <input
                id="tt-train-input"
                type="text"
                value={trainQuery}
                onFocus={() => setShowTrainList(true)}
                onBlur={() => setTimeout(() => setShowTrainList(false), 180)}
                onChange={(e) => {
                  setTrainQuery(e.target.value);
                  setSelectedTrainNo('');
                  setShowTrainList(true);
                  if (error) setError(null);
                }}
                placeholder="Train Number/Name"
                className="w-full bg-transparent text-[15px] text-slate-900 placeholder:text-[#9CA3AF] focus:outline-none"
              />
            </div>

            {showTrainList && filteredTrains.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                {filteredTrains.map((t) => (
                  <button
                    key={t.number}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setTrainQuery(`${t.number} - ${t.name}`);
                      setSelectedTrainNo(t.number);
                      setShowTrainList(false);
                      setError(null);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-[#EAF4FF] flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold text-slate-900">
                      {t.number} - {t.name}
                    </span>
                    <span className="text-[11px] text-[#0066FF] font-mono-num">
                      {t.fromCode} → {t.toCode}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Journey Station */}
          <div>
            <label
              htmlFor="tt-station-select"
              className="block text-[15px] font-normal text-[#2B8AC6] mb-1.5"
            >
              Journey Station
            </label>
            <div className="relative flex items-center border-b border-slate-200/80 pb-2.5">
              <select
                id="tt-station-select"
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="w-full appearance-none bg-transparent pr-7 text-[15px] font-medium text-[#111827] focus:outline-none"
              >
                <option value="">Select Station</option>
                {stationOptions.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.name} - {st.code}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="h-4 w-4 text-[#0066FF] pointer-events-none absolute right-0.5"
                strokeWidth={2.2}
              />
            </div>
          </div>

          {/* Journey Date */}
          <div>
            <label
              htmlFor="tt-date-select"
              className="block text-[15px] font-normal text-[#2B8AC6] mb-1.5"
            >
              Journey Date
            </label>
            <div className="relative flex items-center border-b border-slate-200/80 pb-2.5">
              <select
                id="tt-date-select"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full appearance-none bg-transparent pr-7 text-[15px] font-medium text-[#111827] focus:outline-none"
              >
                <option value="">Select Date</option>
                {dateChoices.map((d) => (
                  <option key={d.iso} value={d.iso}>
                    {d.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="h-4 w-4 text-[#0066FF] pointer-events-none absolute right-0.5"
                strokeWidth={2.2}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-amber-800 bg-amber-50 rounded-xl p-2.5">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleShowStatus}
            className="w-full h-[48px] rounded-full bg-[#0066FF] hover:bg-[#0055D4] text-white text-[16px] font-medium transition-colors"
          >
            Show Status
          </button>
        </div>

        {/* Live NTES Status & Route Timeline shown once submitted */}
        {hasSubmitted && (
          <div className="bg-white rounded-[20px] border border-slate-200/80 p-5 shadow-xs space-y-5">
            <div className="rounded-2xl bg-[#EAF4FF] border border-blue-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-slate-600">
                    {train.number} · {train.name}
                  </p>
                  <p className="font-display text-base font-bold text-slate-900">
                    {train.liveStatus.currentStationName} ({train.liveStatus.currentStationCode})
                  </p>
                </div>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    train.liveStatus.delayMins === 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {train.liveStatus.delayMins === 0
                    ? 'Right On Time'
                    : `Delayed by ${train.liveStatus.delayMins} mins`}
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-white overflow-hidden">
                <div
                  className="h-full bg-[#0066FF] rounded-full"
                  style={{ width: `${train.liveStatus.progressPercent}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between text-xs text-slate-600">
                <span>
                  Next Halt: <strong className="text-slate-900">{train.liveStatus.nextStationName}</strong> (ETA{' '}
                  <span className="font-mono-num">{train.liveStatus.nextStationEta}</span>)
                </span>
                <span>
                  PF <strong className="font-mono-num text-slate-900">{train.liveStatus.expectedPlatform}</strong> · Updated {train.liveStatus.lastUpdated}
                </span>
              </div>
            </div>

            <div className="space-y-0">
              {train.schedule.map((stop, idx) => {
                const isCurrent = stop.status === 'current';
                const isDeparted = stop.status === 'departed';
                return (
                  <div key={stop.sr} className="flex items-stretch gap-4">
                    <div className="flex flex-col items-center w-6 shrink-0">
                      <div
                        className={`h-4 w-4 rounded-full border-2 mt-1 ${
                          isCurrent
                            ? 'bg-[#0066FF] border-[#0066FF] ring-4 ring-blue-100'
                            : isDeparted
                            ? 'bg-emerald-600 border-emerald-600'
                            : 'bg-white border-slate-300'
                        }`}
                      />
                      {idx < train.schedule.length - 1 && (
                        <div
                          className={`w-0.5 flex-1 my-1 ${
                            isDeparted ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        />
                      )}
                    </div>

                    <div
                      className={`flex-1 pb-5 flex items-center justify-between gap-2 ${
                        isCurrent ? 'font-semibold' : ''
                      }`}
                    >
                      <div>
                        <p className="text-sm text-slate-900 flex items-center gap-2">
                          {stop.stationName} ({stop.stationCode})
                          {isCurrent && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0066FF] text-white">
                              Train Here
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 font-mono-num">
                          PF {stop.platform} · {stop.distanceKm} km
                        </p>
                      </div>
                      <div className="text-right font-mono-num text-xs">
                        <p className="text-slate-900">
                          {stop.arrival} / {stop.departure}
                        </p>
                        <p className={stop.delayMins ? 'text-amber-700' : 'text-emerald-700'}>
                          {stop.delayMins ? `+${stop.delayMins}m` : 'On Time'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. FOOD ON TRAIN (Matches 55_23aa12d7.jpeg)                                */
/* -------------------------------------------------------------------------- */
export function OrderFoodView({
  profile,
  bookings,
  onBack,
  onPlaceFoodOrder,
}: {
  profile: UserProfile;
  bookings: BookingRecord[];
  onBack: () => void;
  onPlaceFoodOrder: (booking: BookingRecord, debitWallet: number) => void;
}) {
  const [pnrInput, setPnrInput] = useState('');
  const [activePnr, setActivePnr] = useState<string | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [vegOnly, setVegOnly] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderPlaced, setOrderPlaced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const foodOrders = bookings.filter((b) => b.kind === 'food');
  const visibleMenu = vegOnly ? FOOD_MENU_ITEMS.filter((f) => f.isVeg) : FOOD_MENU_ITEMS;

  const totalAmount = FOOD_MENU_ITEMS.reduce(
    (sum, item) => sum + item.price * (cart[item.id] ?? 0),
    0
  );
  const totalCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const handlePnrSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePnr(pnrInput)) {
      setError('Enter a valid 10-digit numeric PNR number.');
      return;
    }
    setError(null);
    setOrderPlaced(null);
    setActivePnr(pnrInput.trim());
  };

  const handleCheckout = () => {
    if (!activePnr || totalAmount <= 0) return;
    const walletCheck = canBookTicketWithWallet({
      rWalletBalance: profile.rWalletBalance,
      payableFare: totalAmount,
    });
    if (!walletCheck.allowed) {
      setError(walletCheck.reason);
      return;
    }
    const orderNo = `FD${Math.floor(100000 + Math.random() * 900000)}`;
    const itemsSummary = FOOD_MENU_ITEMS.filter((f) => (cart[f.id] ?? 0) > 0)
      .map((f) => `${cart[f.id]}x ${f.name}`)
      .join(', ');

    const newBooking: BookingRecord = {
      id: `food-${Date.now()}`,
      kind: 'food',
      pnrOrTicketNo: orderNo,
      title: `E-Catering · PNR ${activePnr}`,
      subtitle: itemsSummary,
      fromCode: 'CNB',
      fromName: 'KANPUR CENTRAL JN.',
      toCode: 'SEAT',
      toName: 'Delivered at Seat',
      journeyDate: new Date().toISOString().slice(0, 10),
      journeyDisplayDate: 'Today · Next Halt',
      departureTime: '20 mins',
      classOrMode: 'IRCTC E-Catering',
      fare: totalAmount,
      paymentMethod: 'R-Wallet',
      status: 'Confirmed',
      passengers: [
        {
          name: profile.name,
          age: 34,
          gender: 'M',
          coach: 'C4',
          berth: '24',
          status: 'CONFIRMED',
        },
      ],
      createdAt: new Date().toISOString(),
    };

    onPlaceFoodOrder(newBooking, totalAmount);
    setCart({});
    setOrderPlaced(orderNo);
  };

  return (
    <div className="min-h-screen bg-[#F7F8FC] flex flex-col">
      {/* Blue Header matching 55_23aa12d7.jpeg */}
      <header className="bg-[#0066FF] text-white px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => {
              if (showOrders) {
                setShowOrders(false);
              } else {
                onBack();
              }
            }}
            aria-label={showOrders ? 'Back to Food On Train' : 'Back to Home'}
            className="h-10 w-10 rounded-full border border-white/90 hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <h1 className="font-display text-[18.5px] font-semibold tracking-tight">
            {showOrders ? 'Food Orders' : 'Food On Train'}
          </h1>
        </div>

        {!showOrders && (
          <button
            type="button"
            onClick={() => setShowOrders(true)}
            className="rounded-full border border-white/90 px-4 py-1.5 text-[14px] font-medium text-white hover:bg-white/10 transition-colors shrink-0"
          >
            Orders
          </button>
        )}
      </header>

      {showOrders ? (
        <div className="w-full max-w-xl mx-auto px-4 py-6 space-y-3 flex-1 flex flex-col">
          {foodOrders.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[15px] text-slate-600">
              No food orders placed yet.
            </div>
          ) : (
            foodOrders.map((o) => (
              <div
                key={o.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-num text-xs font-bold text-[#0066FF]">
                    Order {o.pnrOrTicketNo}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">{o.status}</span>
                </div>
                <p className="font-display text-sm font-bold text-slate-900">{o.title}</p>
                <p className="text-xs text-slate-600">{o.subtitle}</p>
                <p className="font-mono-num text-xs font-bold text-slate-900 pt-1">
                  ₹ {o.fare.toFixed(2)}
                </p>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="w-full max-w-xl mx-auto flex-1 flex flex-col pb-8">
          {/* Full-bleed Food Hero Image */}
          <div className="relative w-full h-[350px] sm:h-[385px] overflow-hidden bg-slate-800">
            <img
              src="/src/assets/images/food_on_train_banner.jpg"
              alt="Fresh biryani and meals served on train"
              className="h-full w-full object-cover object-center"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#F7F8FC] via-[#F7F8FC]/65 to-transparent pointer-events-none"
            />
          </div>

          {/* Floating PNR Search Box overlapping hero bottom edge */}
          <form
            onSubmit={handlePnrSearch}
            className="relative z-10 mx-4 -mt-[70px] bg-white rounded-[14px] border border-slate-200/80 shadow-[0_4px_16px_rgba(15,23,42,0.08)] p-2.5 pl-4 flex items-center gap-2"
          >
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={pnrInput}
              onChange={(e) => {
                setPnrInput(e.target.value.replace(/\D/g, ''));
                if (error) setError(null);
              }}
              placeholder="PNR Number"
              aria-label="PNR Number"
              className="flex-1 min-w-0 bg-transparent text-[15px] text-slate-900 placeholder:text-[#6B7280] focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Search PNR for Food On Train"
              className="h-11 w-11 rounded-[10px] bg-[#0066FF] hover:bg-[#0055D4] text-white flex items-center justify-center shrink-0 transition-colors"
            >
              <Search className="h-5 w-5" strokeWidth={2.2} />
            </button>
          </form>

          {error && (
            <p role="alert" className="mx-4 mt-3 text-xs font-medium text-rose-700 bg-rose-50 rounded-xl p-3">
              {error}
            </p>
          )}

          {orderPlaced && (
            <div className="mx-4 mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Order {orderPlaced} confirmed for PNR {activePnr}! View it under Orders.
            </div>
          )}

          {/* Menu appears after PNR lookup */}
          {activePnr && (
            <div className="mx-4 mt-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#0066FF] font-mono-num">
                    PNR {activePnr}
                  </p>
                  <h2 className="font-display text-sm font-bold text-[#0A265A]">
                    IRCTC Partner Meals
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setVegOnly((v) => !v)}
                  className={`min-h-[36px] px-3.5 rounded-full border text-xs font-semibold ${
                    vegOnly
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  Veg Only {vegOnly ? '✓' : ''}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {visibleMenu.map((item) => {
                  const qty = cart[item.id] ?? 0;
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            {item.isVeg ? 'Pure Veg' : 'Non-Veg'} · {item.stationCode}
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                            <Star className="h-3 w-3 fill-amber-500" /> {item.rating}
                          </span>
                        </div>
                        <h3 className="font-display text-sm font-bold text-slate-900 mt-1">
                          {item.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.vendor}</p>
                        <p className="text-xs text-slate-600 mt-1.5">{item.description}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="font-mono-num text-sm font-bold text-slate-900">
                          ₹ {item.price}
                        </span>
                        {qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => setCart((c) => ({ ...c, [item.id]: 1 }))}
                            className="min-h-[36px] px-4 rounded-full bg-[#EAF4FF] text-[#0066FF] text-xs font-bold hover:bg-[#D9EAFF]"
                          >
                            + Add
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setCart((c) => ({ ...c, [item.id]: Math.max(0, qty - 1) }))
                              }
                              className="h-8 w-8 rounded-full bg-slate-100 font-bold text-sm"
                            >
                              -
                            </button>
                            <span className="font-mono-num text-xs font-bold">{qty}</span>
                            <button
                              type="button"
                              onClick={() => setCart((c) => ({ ...c, [item.id]: qty + 1 }))}
                              className="h-8 w-8 rounded-full bg-[#0066FF] text-white font-bold text-sm"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalCount > 0 && (
                <div className="rounded-2xl bg-[#0066FF] text-white p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ShoppingBag className="h-5 w-5" />
                    <div>
                      <p className="text-xs text-blue-100">{totalCount} Meal Item(s)</p>
                      <p className="font-mono-num text-base font-bold">Total: ₹ {totalAmount}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckout}
                    className="min-h-[42px] px-5 rounded-full bg-white text-[#0066FF] text-xs font-bold hover:bg-blue-50"
                  >
                    Pay via R-Wallet
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. TICKETS ELIGIBLE FOR REFUND (Matches 66_3da691d9.jpeg)                  */
/* -------------------------------------------------------------------------- */
export function FileRefundView({
  bookings,
  onFileTdr,
  onBack,
}: {
  bookings: BookingRecord[];
  onFileTdr: (bookingId: string, reason: string) => void;
  onBack: () => void;
}) {
  const eligible = bookings.filter((b) => b.kind === 'reserved' && b.status !== 'Refunded');
  const [selectedId, setSelectedId] = useState(eligible[0]?.id ?? '');
  const [reason, setReason] = useState('Train Delayed More Than 3 Hours');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col">
      {/* Blue Header matching 66_3da691d9.jpeg */}
      <header className="bg-[#0066FF] text-white px-4 py-3 flex items-center gap-3.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Home"
          className="h-10 w-10 rounded-full border border-white/90 hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
        <h1 className="font-display text-[18.5px] font-semibold tracking-tight truncate">
          Tickets Eligible For Refund
        </h1>
      </header>

      {eligible.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-[15.5px] font-normal text-[#1E293B] text-center">
            No Tickets Eligible For Refund
          </p>
        </div>
      ) : (
        <div className="w-full max-w-xl mx-auto px-4 py-5 space-y-4">
          <div className="bg-white rounded-[20px] border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div>
              <label htmlFor="tdr-bk" className="block text-xs font-medium text-[#2B8AC6] mb-1.5">
                Select Booking / PNR
              </label>
              <select
                id="tdr-bk"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
              >
                {eligible.map((b) => (
                  <option key={b.id} value={b.id}>
                    PNR {b.pnrOrTicketNo} · {b.title} ({b.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tdr-reason" className="block text-xs font-medium text-[#2B8AC6] mb-1.5">
                TDR Filing Reason
              </label>
              <select
                id="tdr-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
              >
                <option>Train Delayed More Than 3 Hours</option>
                <option>AC Failure During Journey</option>
                <option>Train Cancelled by Railways</option>
                <option>Passenger Not Travelled</option>
              </select>
            </div>

            {submitted && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                TDR Refund Request filed successfully. Refund will credit within 48 hours.
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (selectedId) {
                  onFileTdr(selectedId, reason);
                  setSubmitted(true);
                }
              }}
              className="w-full h-[46px] rounded-full bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0055D4]"
            >
              Submit TDR Refund Request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. RAIL MADAD (Matches 77_fb1bfc38.jpeg)                                   */
/* -------------------------------------------------------------------------- */
export function RailMadadView({
  stations = RAIL_STATIONS,
  complaints,
  onSubmitComplaint,
  onOpenFeedback,
  onBack,
}: {
  stations?: Station[];
  complaints: RailMadadComplaint[];
  onSubmitComplaint: (complaint: RailMadadComplaint) => void;
  onOpenFeedback?: () => void;
  onBack: () => void;
}) {
  const [mediaType, setMediaType] = useState<'Video' | 'Audio' | 'Image' | null>(null);
  const [mode, setMode] = useState<'Train' | 'Station' | null>(null);
  const [location, setLocation] = useState('PALTA-PTF');
  const [helpFor, setHelpFor] = useState('');
  const [problemFaced, setProblemFaced] = useState('');
  const [description, setDescription] = useState('');
  const [viewMode, setViewMode] = useState<'form' | 'track' | 'suggestions'>('form');
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const locationOptions = useMemo(() => {
    const base = ['PALTA-PTF', ...stations.slice(0, 30).map((s) => `${s.name}-${s.code}`)];
    return Array.from(new Set(base));
  }, [stations]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!helpFor) {
      setFormError('Please select Help Required For before submitting.');
      return;
    }
    setFormError(null);
    const refNo = `RM2026${Math.floor(100000 + Math.random() * 900000)}`;
    const newCmp: RailMadadComplaint = {
      id: `cmp-${Date.now()}`,
      referenceNo: refNo,
      mode: mode ?? 'Train',
      location,
      helpFor,
      problemFaced: problemFaced || 'General Assistance',
      description: description.trim() || problemFaced || helpFor,
      mediaType: mediaType ?? 'Image',
      status: 'Registered',
      createdAt: 'Just now',
    };
    onSubmitComplaint(newCmp);
    setDescription('');
    setSuccessRef(refNo);
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col">
      {/* Blue Header matching 77_fb1bfc38.jpeg */}
      <header className="bg-[#0066FF] text-white px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => {
              if (viewMode !== 'form') {
                setViewMode('form');
              } else {
                onBack();
              }
            }}
            aria-label={viewMode !== 'form' ? 'Back to Rail Madad Form' : 'Back to Home'}
            className="h-10 w-10 rounded-full border border-white/90 hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <h1 className="font-display text-[18.5px] font-semibold tracking-tight">Rail Madad</h1>
        </div>

        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'track' ? 'form' : 'track')}
          className="rounded-full border border-white/90 px-4 py-1.5 text-[14px] font-medium text-white hover:bg-white/10 transition-colors shrink-0"
        >
          {viewMode === 'track' ? 'Form' : 'Track'}
        </button>
      </header>

      <div className="w-full max-w-xl mx-auto px-4 pt-3.5 pb-6 space-y-3.5">
        <p className="text-center text-[13.5px] font-medium text-[#2B8AC6]">
          We are Commited to Make Your Journey Pleasant !
        </p>

        {/* Your Location Bar */}
        <div className="rounded-[10px] bg-[#E5F0FF] px-4 py-2 flex items-center justify-center gap-1.5 text-[13.5px]">
          <MapPin className="h-4 w-4 text-[#0066FF] shrink-0" fill="#0066FF" stroke="#E5F0FF" strokeWidth={1.6} />
          <span className="text-[#5B6472] shrink-0">Your Location</span>
          <select
            aria-label="Your Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="appearance-none bg-transparent font-medium text-[#2B8AC6] focus:outline-none max-w-[190px] truncate cursor-pointer"
          >
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {viewMode === 'form' && (
          <>
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-[20px] border border-slate-200/80 shadow-[0_2px_10px_rgba(15,23,42,0.03)] px-4 py-4 space-y-3.5"
            >
              <div>
                <p className="text-[15px] font-normal text-[#2B8AC6] mb-2.5">Your Concern</p>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMediaType(mediaType === 'Video' ? null : 'Video')}
                    className={`h-[40px] rounded-full border text-[13.5px] inline-flex items-center justify-center gap-1.5 transition-colors ${
                      mediaType === 'Video'
                        ? 'border-[#0066FF] bg-[#E7F2FF] text-[#0A265A] font-medium'
                        : 'border-slate-300 bg-white text-[#4B5563]'
                    }`}
                  >
                    <Video className="h-[17px] w-[17px] text-[#0066FF]" strokeWidth={1.8} />
                    <span>Video</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMediaType(mediaType === 'Audio' ? null : 'Audio')}
                    className={`h-[40px] rounded-full border text-[13.5px] inline-flex items-center justify-center gap-1.5 transition-colors ${
                      mediaType === 'Audio'
                        ? 'border-[#0066FF] bg-[#E7F2FF] text-[#0A265A] font-medium'
                        : 'border-slate-300 bg-white text-[#4B5563]'
                    }`}
                  >
                    <AudioPersonIcon />
                    <span>Audio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMediaType(mediaType === 'Image' ? null : 'Image')}
                    className={`h-[40px] rounded-full border text-[13.5px] inline-flex items-center justify-center gap-1.5 transition-colors ${
                      mediaType === 'Image'
                        ? 'border-[#0066FF] bg-[#E7F2FF] text-[#0A265A] font-medium'
                        : 'border-slate-300 bg-white text-[#4B5563]'
                    }`}
                  >
                    <ImageIcon className="h-[17px] w-[17px] text-[#0066FF]" strokeWidth={1.8} />
                    <span>Image</span>
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-[#6B7280]">
                  *Choose any one option. File should not be more than 5 MB.
                </p>
              </div>

              <p className="text-[15px] font-normal text-[#2B8AC6] pt-0.5">
                More Details to Assist You Better
              </p>

              {/* Help Required At Radio Row */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[13.5px] text-[#4B5563]">Help Required At</span>
                <div className="flex items-center gap-5">
                  {(['Train', 'Station'] as const).map((m) => {
                    const selected = mode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setMode(m)}
                        className="inline-flex items-center gap-2 text-[14px] text-[#4B5563]"
                      >
                        <span
                          className={`h-[20px] w-[20px] rounded-full border-2 flex items-center justify-center transition-colors ${
                            selected ? 'border-[#0066FF]' : 'border-[#BAE6FD]'
                          }`}
                        >
                          {selected && <span className="h-2.5 w-2.5 rounded-full bg-[#0066FF]" />}
                        </span>
                        <span>{m}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Help Required For */}
              <div className="relative flex items-center border-b border-slate-200/80 pb-2 pt-1">
                <select
                  aria-label="Help Required For"
                  value={helpFor}
                  onChange={(e) => {
                    setHelpFor(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  className={`w-full appearance-none bg-transparent pr-7 text-[14.5px] focus:outline-none ${
                    helpFor ? 'text-slate-900 font-medium' : 'text-[#4B5563]'
                  }`}
                >
                  <option value="">Help Required For</option>
                  <option>Cleanliness &amp; Hygiene</option>
                  <option>Medical Assistance</option>
                  <option>Security</option>
                  <option>Water Availability</option>
                  <option>Electrical / AC Equipment</option>
                  <option>Catering / Vending</option>
                </select>
                <ChevronDown
                  className="h-4 w-4 text-[#0066FF] pointer-events-none absolute right-0.5"
                  strokeWidth={2.2}
                />
              </div>

              {/* Problem Faced */}
              <div className="relative flex items-center border-b border-slate-200/80 pb-2 pt-1">
                <select
                  aria-label="Problem Faced"
                  value={problemFaced}
                  onChange={(e) => setProblemFaced(e.target.value)}
                  className={`w-full appearance-none bg-transparent pr-7 text-[14.5px] focus:outline-none ${
                    problemFaced ? 'text-slate-900 font-medium' : 'text-[#4B5563]'
                  }`}
                >
                  <option value="">Problem Faced</option>
                  <option>Coach / Toilet Cleaning Required</option>
                  <option>AC Not Cooling</option>
                  <option>No Water in Washroom</option>
                  <option>Overcharging by Vendor</option>
                  <option>Seat / Berth Dispute</option>
                </select>
                <ChevronDown
                  className="h-4 w-4 text-[#0066FF] pointer-events-none absolute right-0.5"
                  strokeWidth={2.2}
                />
              </div>

              {/* Describe More */}
              <div className="relative rounded-[12px] border border-slate-200/90 p-3">
                <textarea
                  aria-label="Describe More"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe More"
                  className="w-full resize-none bg-transparent pr-7 text-[14.5px] text-slate-900 placeholder:text-[#6B7280] focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Voice input for description"
                  onClick={() =>
                    setDescription((prev) =>
                      prev ? `${prev} (Voice note attached)` : 'Assistance needed near coach entrance.'
                    )
                  }
                  className="absolute right-3 bottom-3 text-[#0066FF] hover:text-[#0055D4]"
                >
                  <Mic className="h-[19px] w-[19px]" strokeWidth={2} />
                </button>
              </div>

              {formError && (
                <p role="alert" className="text-xs font-medium text-amber-800 bg-amber-50 rounded-xl p-2.5">
                  {formError}
                </p>
              )}

              {successRef && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
                  Complaint Registered! Reference No: <span className="font-mono-num">{successRef}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full h-[46px] rounded-full bg-[#0066FF] hover:bg-[#0055D4] text-white text-[16px] font-medium transition-colors"
              >
                Submit
              </button>
            </form>

            {/* Suggestions & Feedback Buttons matching 77_fb1bfc38.jpeg */}
            <div className="grid grid-cols-2 gap-3 pt-0.5">
              <button
                type="button"
                onClick={() => setViewMode('suggestions')}
                className="h-[46px] rounded-full border-[1.5px] border-[#0066FF] bg-white hover:bg-[#F0F7FF] text-[#0066FF] text-[15px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span className="h-6 w-6 rounded-full bg-[#0066FF] text-white flex items-center justify-center">
                  <Lightbulb className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
                <span>Suggestions</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onOpenFeedback) onOpenFeedback();
                  else setViewMode('suggestions');
                }}
                className="h-[46px] rounded-full border-[1.5px] border-[#0066FF] bg-white hover:bg-[#F0F7FF] text-[#0066FF] text-[15px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
              >
                <MessageSquareWarning className="h-[19px] w-[19px] text-[#0066FF]" strokeWidth={2} />
                <span>Feedback</span>
              </button>
            </div>
          </>
        )}

        {viewMode === 'track' && (
          <div className="bg-white rounded-[20px] border border-slate-200/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-[#0A265A]">
                Registered Complaints ({complaints.length})
              </h2>
              <button
                type="button"
                onClick={() => setViewMode('form')}
                className="text-xs font-semibold text-[#0066FF]"
              >
                + New Complaint
              </button>
            </div>
            {complaints.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 p-3.5 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-num font-bold text-[#0066FF]">
                    {c.referenceNo}
                  </span>
                  <span className="font-semibold text-emerald-700">{c.status}</span>
                </div>
                <p className="font-semibold text-slate-900">
                  {c.helpFor} · {c.problemFaced}
                </p>
                <p className="text-slate-500">
                  {c.mode}: {c.location} · {c.createdAt}
                </p>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'suggestions' && (
          <div className="bg-white rounded-[20px] border border-slate-200/80 p-5 text-xs text-slate-600 space-y-3">
            <p className="font-display text-sm font-bold text-[#0A265A]">
              Railway Improvement Suggestions
            </p>
            <p>
              Share ideas for station accessibility, Vande Bharat routes, or digital passenger
              amenities.
            </p>
            <button
              type="button"
              onClick={() => setViewMode('form')}
              className="text-[#0066FF] font-semibold"
            >
              ← Back to Complaint Form
            </button>
          </div>
        )}

        {/* Bottom 139 Helpline Pill */}
        <div className="flex justify-center pt-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E3F5EC] px-4 py-1.5 text-[12.5px] font-medium text-[#1E293B]">
            <Phone className="h-3.5 w-3.5 text-[#1E293B]" fill="#1E293B" />
            <span>139 for Security/Medical Assistance</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. TRAVEL FEEDBACK                                                         */
/* -------------------------------------------------------------------------- */
export function TravelFeedbackView({
  feedbacks,
  onSubmitFeedback,
  onBack,
}: {
  feedbacks: FeedbackEntry[];
  onSubmitFeedback: (entry: FeedbackEntry) => void;
  onBack: () => void;
}) {
  const [pnrOrTrain, setPnrOrTrain] = useState('22416 · VANDE BHARAT EXP');
  const [rating, setRating] = useState(5);
  const [cleanliness, setCleanliness] = useState(5);
  const [punctuality, setPunctuality] = useState(5);
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitFeedback({
      id: `fb-${Date.now()}`,
      pnrOrTrain,
      rating,
      cleanliness,
      punctuality,
      comment: comment.trim() || 'Smooth and comfortable railway journey.',
      createdAt: 'Just now',
    });
    setComment('');
    setSaved(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Home"
            className="h-10 w-10 rounded-xl hover:bg-slate-100 flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">Travel Feedback</h1>
            <p className="text-xs text-slate-500">
              Rate your train journey, coach hygiene &amp; punctuality
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fb-train" className="block text-xs font-medium text-slate-600 mb-1">
              Train / Journey
            </label>
            <select
              id="fb-train"
              value={pnrOrTrain}
              onChange={(e) => setPnrOrTrain(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
            >
              {RAIL_TRAINS.map((t) => (
                <option key={t.number} value={`${t.number} · ${t.name}`}>
                  {t.number} · {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">Overall Experience</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  aria-label={`Rate ${n} stars`}
                  className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-amber-50"
                >
                  <Star
                    className={`h-5 w-5 ${
                      n <= rating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="fb-clean" className="block text-xs font-medium text-slate-600 mb-1">
                Coach Cleanliness ({cleanliness}/5)
              </label>
              <input
                id="fb-clean"
                type="range"
                min={1}
                max={5}
                value={cleanliness}
                onChange={(e) => setCleanliness(Number(e.target.value))}
                className="w-full accent-[#0066FF]"
              />
            </div>
            <div>
              <label htmlFor="fb-punc" className="block text-xs font-medium text-slate-600 mb-1">
                Punctuality ({punctuality}/5)
              </label>
              <input
                id="fb-punc"
                type="range"
                min={1}
                max={5}
                value={punctuality}
                onChange={(e) => setPunctuality(Number(e.target.value))}
                className="w-full accent-[#0066FF]"
              />
            </div>
          </div>

          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write feedback about onboard staff, cleanliness, or catering..."
            aria-label="Journey feedback comments"
            className="w-full rounded-xl border border-slate-200 p-3 text-sm"
          />

          {saved && (
            <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-xl p-3">
              Thank you! Your travel feedback has been shared with CRIS &amp; Indian Railways.
            </p>
          )}

          <button
            type="submit"
            className="w-full min-h-[46px] rounded-xl bg-[#0066FF] text-white text-sm font-bold hover:bg-[#0055D4]"
          >
            Submit Feedback
          </button>
        </form>

        {feedbacks.length > 0 && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <h2 className="font-display text-xs font-bold text-slate-700">Your Recent Feedback</h2>
            {feedbacks.map((f) => (
              <div key={f.id} className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
                <div className="flex justify-between font-semibold text-slate-900">
                  <span>{f.pnrOrTrain}</span>
                  <span>{f.rating}/5 ★</span>
                </div>
                <p className="text-slate-600">{f.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
