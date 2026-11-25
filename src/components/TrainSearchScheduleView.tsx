import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import { RAIL_STATIONS, RAIL_TRAINS } from '../data/railData';
import { searchTrains } from '../utils/railLogic';
import type { Station, TrainInfo } from '../types/rail';

interface TrainSearchScheduleViewProps {
  stations?: Station[];
  onBack: () => void;
  onSelectTrainForBooking: (train: TrainInfo) => void;
}

interface RecentRouteSearch {
  id: string;
  fromCode: string;
  fromLabel: string;
  toCode: string;
  toLabel: string;
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const DEFAULT_RECENT_SEARCHES: RecentRouteSearch[] = [
  {
    id: 'bp-klys',
    fromCode: 'BP',
    fromLabel: 'BARRACKPORE - BP',
    toCode: 'KLYI',
    toLabel: 'KALYANI SILPANCHAL - KLYS',
  },
];

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

export function TrainSearchScheduleView({
  stations = RAIL_STATIONS,
  onBack,
  onSelectTrainForBooking,
}: TrainSearchScheduleViewProps) {
  const [trainQuery, setTrainQuery] = useState('');
  const [showTrainList, setShowTrainList] = useState(false);
  const [selectedTrainNo, setSelectedTrainNo] = useState('');

  const [stationQuery, setStationQuery] = useState('');
  const [showStationList, setShowStationList] = useState(false);

  const [fromStation, setFromStation] = useState<Station | null>(null);
  const [toStation, setToStation] = useState<Station | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');

  const [runFilter, setRunFilter] = useState<'All Trains' | 'Trains on Run'>('All Trains');
  const [activeScheduleTrain, setActiveScheduleTrain] = useState<TrainInfo | null>(null);
  const [routeResults, setRouteResults] = useState<TrainInfo[] | null>(null);
  const [suburbanPairs, setSuburbanPairs] = useState<Array<{ number: string; name: string; dep: string; arr: string; plat: string }> | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentRouteSearch[]>(DEFAULT_RECENT_SEARCHES);
  const [formNotice, setFormNotice] = useState<string | null>(null);

  const filteredTrains = useMemo(() => {
    const q = trainQuery.trim().toLowerCase();
    if (!q) return RAIL_TRAINS;
    return RAIL_TRAINS.filter(
      (t) =>
        t.number.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.fromCode.toLowerCase().includes(q) ||
        t.toCode.toLowerCase().includes(q)
    );
  }, [trainQuery]);

  const filteredQuickStations = useMemo(() => {
    const q = stationQuery.trim().toLowerCase();
    if (!q) return stations.slice(0, 12);
    return stations
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [stations, stationQuery]);

  const pickerStations = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return stations.slice(0, 80);
    return stations
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q)
      )
      .slice(0, 80);
  }, [stations, pickerQuery]);

  const handleOpenSchedule = () => {
    setFormNotice(null);
    const q = trainQuery.trim().toLowerCase();
    const byTrain =
      RAIL_TRAINS.find((t) => t.number === selectedTrainNo) ||
      (q
        ? RAIL_TRAINS.find(
            (t) => t.number.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
          )
        : undefined);

    if (byTrain) {
      setActiveScheduleTrain(byTrain);
      return;
    }

    const stQ = stationQuery.trim().toUpperCase();
    if (stQ) {
      const codeGuess = stQ.split(' - ').pop()?.trim() || stQ;
      const stationMatches = RAIL_TRAINS.filter(
        (t) =>
          t.fromCode === codeGuess ||
          t.toCode === codeGuess ||
          t.schedule.some(
            (s) =>
              s.stationCode.toUpperCase() === codeGuess ||
              s.stationName.toUpperCase().includes(stQ)
          )
      );
      setSuburbanPairs(null);
      setRouteResults(stationMatches.length > 0 ? stationMatches : RAIL_TRAINS.slice(0, 3));
      return;
    }

    setFormNotice('Enter a Train Number/Name or Station to view schedule.');
  };

  const runPairSearch = (from: Station | { code: string; name: string }, to: Station | { code: string; name: string }) => {
    setFormNotice(null);
    const res = searchTrains(RAIL_TRAINS, {
      fromCode: from.code,
      toCode: to.code,
    });
    setRouteResults(res);

    if (res.length === 0) {
      setSuburbanPairs([
        {
          number: '31311',
          name: `${from.name} - ${to.name} EMU LOCAL`,
          dep: '10:12',
          arr: '10:34',
          plat: '2',
        },
        {
          number: '31315',
          name: `${from.name} - ${to.name} GALLOPING`,
          dep: '11:05',
          arr: '11:24',
          plat: '1',
        },
        {
          number: '31321',
          name: `${from.name} - ${to.name} EMU`,
          dep: '12:18',
          arr: '12:41',
          plat: '3',
        },
      ]);
    } else {
      setSuburbanPairs(null);
    }

    const displayCodeFrom = from.code === 'KLYI' ? 'KLYS' : from.code;
    const displayCodeTo = to.code === 'KLYI' ? 'KLYS' : to.code;
    const entry: RecentRouteSearch = {
      id: `${from.code}-${to.code}`,
      fromCode: from.code,
      fromLabel: `${from.name} - ${displayCodeFrom}`,
      toCode: to.code,
      toLabel: `${to.name} - ${displayCodeTo}`,
    };
    setRecentSearches((prev) => [
      entry,
      ...prev.filter((item) => item.id !== entry.id).slice(0, 3),
    ]);
  };

  const handleRouteSearch = () => {
    if (!fromStation || !toStation) {
      setFormNotice('Select both From and To stations to search trains.');
      return;
    }
    runPairSearch(fromStation, toStation);
  };

  // Blue Train Schedule Screen
  if (activeScheduleTrain) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex flex-col">
        <div className="bg-[#0066FF] text-white px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveScheduleTrain(null)}
              aria-label="Back to Search Trains"
              className="h-10 w-10 rounded-full border border-white/90 hover:bg-white/15 flex items-center justify-center"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-display text-[17px] font-semibold">Train Schedule</h1>
              <p className="text-xs text-blue-100">Schedule Date: Today</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectTrainForBooking(activeScheduleTrain)}
            className="min-h-[36px] px-4 rounded-full border border-white/90 text-white text-xs font-semibold hover:bg-white/15"
          >
            Book Seats
          </button>
        </div>

        <div className="p-4 max-w-2xl mx-auto w-full space-y-4">
          <div className="bg-white rounded-[20px] border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="p-4 bg-[#F8FBFF] border-b border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-sm sm:text-base font-bold text-[#0A265A]">
                  <span className="font-mono-num">{activeScheduleTrain.number}</span> |{' '}
                  {activeScheduleTrain.name}
                </p>
                <span className="text-xs font-semibold text-[#0066FF]">
                  {activeScheduleTrain.category} ·{' '}
                  {activeScheduleTrain.classes.map((c) => c.code).join(', ')}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                <span>
                  {activeScheduleTrain.fromName} ({activeScheduleTrain.fromCode})
                </span>
                <span className="font-mono-num font-semibold text-slate-800">
                  — {activeScheduleTrain.duration} —
                </span>
                <span>
                  {activeScheduleTrain.toName} ({activeScheduleTrain.toCode})
                </span>
              </div>

              <div className="flex items-center justify-center gap-1.5 pt-1">
                {DAY_LETTERS.map((l, i) => (
                  <span
                    key={i}
                    className={`text-[11px] font-bold ${
                      activeScheduleTrain.runningDays[i] ? 'text-emerald-600' : 'text-slate-300'
                    }`}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">Sr</th>
                    <th className="py-3 px-4">Station Name</th>
                    <th className="py-3 px-3 text-center">Day</th>
                    <th className="py-3 px-4">Arr. / Dep.</th>
                    <th className="py-3 px-3 text-right">Halt</th>
                    <th className="py-3 px-4 text-right">Dist. Kms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeScheduleTrain.schedule.map((stop) => (
                    <tr key={stop.sr} className="hover:bg-[#F8FBFF]">
                      <td className="py-3 px-4 font-mono-num text-slate-500">{stop.sr}</td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{stop.stationCode}</p>
                        <p className="text-[11px] text-slate-500">{stop.stationName}</p>
                      </td>
                      <td className="py-3 px-3 text-center font-mono-num text-slate-700">
                        {stop.day}
                      </td>
                      <td className="py-3 px-4 font-mono-num text-slate-800">
                        <div>{stop.arrival}</div>
                        <div className="text-slate-500">{stop.departure}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-600">
                        {stop.haltMins > 0 ? `${stop.haltMins}m` : '0'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-semibold text-slate-800">
                        {stop.distanceKm}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Exact match to Screenshot 11_283c8eae.jpeg
  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col">
      {/* White Header with centered title and circular X close button */}
      <header className="bg-white px-4 py-3.5 relative flex items-center justify-center border-b border-slate-100/70">
        <h1 className="font-display text-[18.5px] font-bold text-[#0A265A] tracking-tight">
          Search Trains
        </h1>
        <button
          type="button"
          onClick={onBack}
          aria-label="Close Search Trains"
          className="absolute right-4 h-10 w-10 rounded-full border border-[#B8D6F8] bg-white hover:bg-slate-50 flex items-center justify-center text-[#0A265A] transition-colors"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
      </header>

      <div className="flex-1 w-full max-w-xl mx-auto px-4 pt-4 pb-8 space-y-5">
        {/* Main Rounded White Form Card */}
        <div className="bg-white rounded-[20px] border border-slate-200/80 shadow-[0_2px_10px_rgba(15,23,42,0.03)] px-5 py-5 space-y-4">
          {/* Train Input */}
          <div className="relative">
            <label
              htmlFor="search-train-input"
              className="block text-[15px] font-normal text-[#2B8AC6] mb-1.5"
            >
              Train
            </label>
            <div className="flex items-center gap-3 border-b border-slate-200/80 pb-2.5">
              <TrainOutlineIcon />
              <input
                id="search-train-input"
                type="text"
                value={trainQuery}
                onFocus={() => setShowTrainList(true)}
                onBlur={() => setTimeout(() => setShowTrainList(false), 180)}
                onChange={(e) => {
                  setTrainQuery(e.target.value);
                  setSelectedTrainNo('');
                  setShowTrainList(true);
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

          {/* OR Divider */}
          <div className="relative flex items-center justify-center py-0.5">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-slate-200/70" />
            <span className="relative bg-white px-2.5 text-[12px] font-medium text-[#6B7280]">
              OR
            </span>
          </div>

          {/* Station Input */}
          <div className="relative">
            <label
              htmlFor="search-station-input"
              className="block text-[15px] font-normal text-[#2B8AC6] mb-1.5"
            >
              Station
            </label>
            <div className="flex items-center gap-3 border-b border-slate-200/80 pb-2.5">
              <TrainOutlineIcon />
              <input
                id="search-station-input"
                type="text"
                value={stationQuery}
                onFocus={() => setShowStationList(true)}
                onBlur={() => setTimeout(() => setShowStationList(false), 180)}
                onChange={(e) => {
                  setStationQuery(e.target.value);
                  setShowStationList(true);
                }}
                placeholder="Station"
                className="w-full bg-transparent text-[15px] text-slate-900 placeholder:text-[#9CA3AF] focus:outline-none"
              />
            </div>

            {showStationList && filteredQuickStations.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                {filteredQuickStations.map((s) => (
                  <button
                    key={`${s.code}-${s.stationId ?? s.name}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setStationQuery(`${s.name} - ${s.code}`);
                      setShowStationList(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-[#EAF4FF] flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold text-slate-900">{s.name}</span>
                    <span className="text-[11px] text-[#0066FF] font-mono-num">{s.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Schedule Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleOpenSchedule}
              className="w-full h-[48px] rounded-full bg-[#0066FF] hover:bg-[#0055D4] text-white text-[16px] font-medium transition-colors"
            >
              Schedule
            </button>
          </div>

          {/* From / To Inputs + Swap Button */}
          <div className="relative space-y-4 pt-2">
            <div>
              <label
                htmlFor="st-from-trigger"
                className="block text-[15px] font-normal text-[#2B8AC6] mb-1.5"
              >
                From
              </label>
              <button
                id="st-from-trigger"
                type="button"
                onClick={() => {
                  setPickerQuery('');
                  setPickerTarget('from');
                }}
                className="w-full flex items-center gap-3 border-b border-slate-200/80 pb-2.5 pr-12 text-left"
              >
                <TrainOutlineIcon />
                <span
                  className={`text-[15px] truncate ${
                    fromStation ? 'text-slate-900 font-medium' : 'text-[#9CA3AF]'
                  }`}
                >
                  {fromStation ? `${fromStation.name} - ${fromStation.code}` : 'Source'}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setFromStation(toStation);
                setToStation(fromStation);
              }}
              aria-label="Swap Source and Destination"
              className="absolute right-0 top-[48px] z-10 h-10 w-10 rounded-full bg-[#DDEAFF] hover:bg-[#C9DFFF] text-[#0066FF] flex items-center justify-center transition-colors"
            >
              <ArrowUpDown className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>

            <div>
              <label
                htmlFor="st-to-trigger"
                className="block text-[15px] font-normal text-[#2B8AC6] mb-1.5"
              >
                To
              </label>
              <button
                id="st-to-trigger"
                type="button"
                onClick={() => {
                  setPickerQuery('');
                  setPickerTarget('to');
                }}
                className="w-full flex items-center gap-3 border-b border-slate-200/80 pb-2.5 text-left"
              >
                <TrainOutlineIcon flip />
                <span
                  className={`text-[15px] truncate ${
                    toStation ? 'text-slate-900 font-medium' : 'text-[#9CA3AF]'
                  }`}
                >
                  {toStation ? `${toStation.name} - ${toStation.code}` : 'Destination'}
                </span>
              </button>
            </div>
          </div>

          {/* Filter Pills: All Trains | Trains on Run */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {(['All Trains', 'Trains on Run'] as const).map((tab) => {
              const selected = runFilter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRunFilter(tab)}
                  className={`h-[44px] rounded-full text-[15px] transition-colors ${
                    selected
                      ? 'border-[1.5px] border-[#2B7DE9] bg-[#E7F2FF] text-[#0F2C5C] font-medium'
                      : 'border border-slate-300 bg-white text-[#1E293B] font-normal'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {formNotice && (
            <p role="alert" className="text-xs font-medium text-amber-800 bg-amber-50 rounded-xl px-3 py-2">
              {formNotice}
            </p>
          )}

          {/* Search CTA */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={handleRouteSearch}
              className="w-full h-[48px] rounded-full bg-[#0066FF] hover:bg-[#0055D4] text-white text-[16px] font-medium transition-colors"
            >
              Search
            </button>
          </div>
        </div>

        {/* Recent Searches */}
        <section aria-labelledby="recent-searches-heading" className="space-y-3">
          <h2
            id="recent-searches-heading"
            className="font-display text-[17px] font-bold text-[#0A265A]"
          >
            Recent Searches
          </h2>

          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {recentSearches.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  const f =
                    stations.find((s) => s.code === item.fromCode) ?? {
                      code: item.fromCode,
                      name: item.fromLabel.replace(/\s-\s[A-Z0-9]+$/, ''),
                      city: 'Kolkata',
                      zone: 'ER',
                    };
                  const t =
                    stations.find((s) => s.code === item.toCode) ?? {
                      code: item.toCode,
                      name: item.toLabel.replace(/\s-\s[A-Z0-9]+$/, ''),
                      city: 'Kolkata',
                      zone: 'ER',
                    };
                  setFromStation(f);
                  setToStation(t);
                  runPairSearch(f, t);
                }}
                className="shrink-0 w-[235px] rounded-[14px] bg-[#E2EEFF] hover:bg-[#D5E6FF] px-4 py-3.5 text-center space-y-1 transition-colors"
              >
                <p className="text-[13px] font-normal text-[#1E293B] uppercase truncate">
                  {item.fromLabel}
                </p>
                <CurvedRouteIcon />
                <p className="text-[13px] font-normal text-[#1E293B] uppercase truncate">
                  {item.toLabel}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Search Results */}
        {routeResults && (
          <div className="space-y-3">
            <h2 className="font-display text-sm font-bold text-[#0A265A]">
              {routeResults.length > 0
                ? `${routeResults.length} Trains Found (${runFilter})`
                : `${suburbanPairs?.length ?? 0} Suburban / Local Trains (${runFilter})`}
            </h2>

            {routeResults.length > 0 ? (
              routeResults.map((tr) => (
                <div
                  key={tr.number}
                  className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-mono-num text-xs font-semibold text-[#0066FF]">
                      {tr.number} · {tr.category}
                    </p>
                    <p className="font-display text-sm font-bold text-slate-900">{tr.name}</p>
                    <p className="text-xs text-slate-500 font-mono-num">
                      {tr.departureTime} ({tr.fromCode}) → {tr.arrivalTime} ({tr.toCode}) ·{' '}
                      {tr.duration}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveScheduleTrain(tr)}
                      className="min-h-[38px] px-3.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Schedule
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTrainForBooking(tr)}
                      className="min-h-[38px] px-4 rounded-full bg-[#0066FF] text-white text-xs font-semibold hover:bg-[#0055D4]"
                    >
                      Book
                    </button>
                  </div>
                </div>
              ))
            ) : (
              suburbanPairs?.map((sp) => (
                <div
                  key={sp.number}
                  className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-mono-num text-xs font-semibold text-[#0066FF]">
                      {sp.number} · SUBURBAN EMU
                    </p>
                    <p className="font-display text-sm font-bold text-slate-900">{sp.name}</p>
                    <p className="text-xs text-slate-500 font-mono-num">
                      Dep {sp.dep} → Arr {sp.arr} · Expected PF {sp.plat}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                    Daily
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Station Picker Modal */}
      {pickerTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Select ${pickerTarget === 'from' ? 'Source' : 'Destination'} Station`}
          className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh]">
            <div className="bg-[#0066FF] text-white px-5 py-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold">
                Select {pickerTarget === 'from' ? 'Source' : 'Destination'} Station
              </h2>
              <button
                type="button"
                onClick={() => setPickerTarget(null)}
                aria-label="Close station picker"
                className="h-9 w-9 rounded-full border border-white/80 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100 bg-[#F8FBFF]">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Search station name or code..."
                  className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                />
              </div>
            </div>
            <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
              {pickerStations.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  <MapPin className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                  No matching stations found.
                </div>
              ) : (
                pickerStations.map((st) => (
                  <button
                    key={`${st.code}-${st.stationId ?? st.name}`}
                    type="button"
                    onClick={() => {
                      if (pickerTarget === 'from') setFromStation(st);
                      else setToStation(st);
                      setPickerTarget(null);
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#EAF4FF]/60"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{st.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {st.zone} · {st.divisionName ?? st.city}
                      </p>
                    </div>
                    <span className="font-mono-num text-xs font-bold text-[#0066FF]">
                      {st.hasVerifiedCode === false ? 'NO CODE' : st.code}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
