import { useMemo, useState } from 'react';
import { ArrowUpLeft, MapPin, Mic, Search, X } from 'lucide-react';
import type { Station } from '../types/rail';

export interface RecentStationOption {
  code: string;
  name: string;
  subtitle: string;
  city: string;
  zone: string;
}

const DEFAULT_RECENT_STATION_SEARCHES: RecentStationOption[] = [
  {
    code: 'BP',
    name: 'BARRACKPORE',
    subtitle: 'Howrah / Kolkata, WEST BENGAL',
    city: 'Kolkata',
    zone: 'ER',
  },
  {
    code: 'PGTN',
    name: 'PALGHAT TOWN',
    subtitle: 'PALAKKAD, KERALA',
    city: 'Palakkad',
    zone: 'SR',
  },
  {
    code: 'PTF',
    name: 'PALTA',
    subtitle: 'WEST BENGAL',
    city: 'Kolkata',
    zone: 'ER',
  },
  {
    code: 'SDAH',
    name: 'SEALDAH',
    subtitle: 'Howrah / Kolkata, WEST BENGAL',
    city: 'Kolkata',
    zone: 'ER',
  },
  {
    code: 'MCA',
    name: 'MECHEDA',
    subtitle: 'MECHEDA, WEST BENGAL',
    city: 'Mecheda',
    zone: 'SER',
  },
  {
    code: 'HWH',
    name: 'HOWRAH',
    subtitle: 'Howrah / Kolkata, WEST BENGAL',
    city: 'Kolkata',
    zone: 'ER',
  },
  {
    code: 'DDJ',
    name: 'DUMDUM JN.',
    subtitle: 'Howrah / Kolkata, WEST BENGAL',
    city: 'Kolkata',
    zone: 'ER',
  },
  {
    code: 'LKPR',
    name: 'LAKSHMIKANTAPUR',
    subtitle: 'Howrah / Kolkata, WEST BENGAL',
    city: 'Kolkata',
    zone: 'ER',
  },
  {
    code: 'KYI',
    name: 'KALYANI  JN',
    subtitle: 'Howrah / Kolkata, WEST BENGAL',
    city: 'Kolkata',
    zone: 'ER',
  },
  {
    code: 'KLYG',
    name: 'KALYANI GHOSHPARA',
    subtitle: 'WEST BENGAL',
    city: 'Kolkata',
    zone: 'ER',
  },
];

const CURATED_SUBTITLE_BY_CODE: Record<string, string> = Object.fromEntries(
  DEFAULT_RECENT_STATION_SEARCHES.map((s) => [s.code, s.subtitle])
);

const CURATED_NAME_BY_CODE: Record<string, string> = Object.fromEntries(
  DEFAULT_RECENT_STATION_SEARCHES.map((s) => [s.code, s.name])
);

function formatStationSubtitle(st: Station): string {
  const curated = CURATED_SUBTITLE_BY_CODE[st.code.toUpperCase()];
  if (curated) return curated;
  if (st.zone === 'ER' || st.zone === 'SER' || st.zone === 'METRO') {
    return `${st.divisionName ?? st.city}, WEST BENGAL`;
  }
  return `${st.city.toUpperCase()}, ${st.zone}`;
}

function RecentClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[20px] w-[20px] text-[#111842] shrink-0" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.9" />
      <path d="M12 6.5A5.5 5.5 0 1 1 7.2 14.8L12 12V6.5Z" fill="currentColor" />
    </svg>
  );
}

interface UnreservedStationPickerModalProps {
  mode: 'Source' | 'Destination' | 'Station';
  stations: Station[];
  onSelect: (station: Station) => void;
  onClose: () => void;
}

export function UnreservedStationPickerModal({
  mode,
  stations,
  onSelect,
  onClose,
}: UnreservedStationPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const allSearchableStations = useMemo<Station[]>(() => {
    const map = new Map<string, Station>();
    for (const s of stations) {
      map.set(s.code.toUpperCase(), s);
    }
    for (const fallback of DEFAULT_RECENT_STATION_SEARCHES) {
      if (!map.has(fallback.code)) {
        map.set(fallback.code, {
          code: fallback.code,
          name: fallback.name,
          city: fallback.city,
          zone: fallback.zone,
        });
      }
    }
    return Array.from(map.values());
  }, [stations]);

  const resolvedMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const matches = allSearchableStations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.divisionName && s.divisionName.toLowerCase().includes(q)) ||
        s.city.toLowerCase().includes(q)
    );

    matches.sort((a, b) => {
      const aExact = a.code.toLowerCase() === q || a.name.toLowerCase() === q ? 1 : 0;
      const bExact = b.code.toLowerCase() === q || b.name.toLowerCase() === q ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      const aStart = a.code.toLowerCase().startsWith(q) || a.name.toLowerCase().startsWith(q) ? 1 : 0;
      const bStart = b.code.toLowerCase().startsWith(q) || b.name.toLowerCase().startsWith(q) ? 1 : 0;
      if (aStart !== bStart) return bStart - aStart;
      return a.name.localeCompare(b.name);
    });

    return matches.slice(0, 60);
  }, [allSearchableStations, searchQuery]);

  const handlePickOption = (opt: RecentStationOption) => {
    const existing =
      stations.find((s) => s.code.toUpperCase() === opt.code.toUpperCase()) ?? {
        code: opt.code,
        name: opt.name,
        city: opt.city,
        zone: opt.zone,
      };
    onSelect({
      ...existing,
      name: CURATED_NAME_BY_CODE[existing.code.toUpperCase()]?.replace(/\s+/g, ' ').trim() || existing.name,
    });
    onClose();
  };

  const handlePickStation = (st: Station) => {
    onSelect({
      ...st,
      name: CURATED_NAME_BY_CODE[st.code.toUpperCase()]?.replace(/\s+/g, ' ').trim() || st.name,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Search Station - ${mode}`}
      className="fixed inset-0 z-50 bg-white flex flex-col"
    >
      {/* Top Bar matching Reference Screenshot 1 & 2 */}
      <header className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0 bg-white">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Search Station"
          className="h-10 w-10 rounded-full border border-[#BBD4EC] text-[#111842] hover:bg-slate-50 flex items-center justify-center transition-colors"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </button>
        <h1 className="font-display text-[19px] font-bold text-[#111842] tracking-tight">
          Search Station
        </h1>
        <div className="w-10" aria-hidden="true" />
      </header>

      <div className="w-full max-w-lg mx-auto flex-1 flex flex-col min-h-0">
        {/* Source / Destination Subheading */}
        <div className="px-5 pt-4 pb-3 shrink-0">
          <h2 className="font-display text-[17px] font-bold text-[#111842]">{mode}</h2>
        </div>

        {/* Teal-bordered Search Pill */}
        <div className="px-5 shrink-0">
          <div className="min-h-[48px] rounded-full border-[1.5px] border-[#42B8A6] bg-white px-4 flex items-center gap-3">
            <Search className="h-[19px] w-[19px] text-[#6B7280] shrink-0" strokeWidth={1.9} />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Select Station"
              aria-label={`Search ${mode} Station`}
              className="flex-1 min-w-0 bg-transparent text-[15.5px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none caret-[#111842]"
            />
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
                className="h-6 w-6 rounded-full hover:bg-slate-100 flex items-center justify-center text-[#6B7280]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <Mic className="h-[19px] w-[19px] text-[#6B7280] shrink-0" strokeWidth={1.9} aria-hidden="true" />
          </div>
        </div>

        {/* Recent Station Searches Header */}
        <div className="px-5 pt-5 pb-2 flex items-center gap-2.5 shrink-0">
          <RecentClockIcon />
          <span className="text-[15px] font-medium text-[#111842]">
            {searchQuery.trim() ? `Matching Stations (${resolvedMatches.length})` : 'Recent Station Searches'}
          </span>
        </div>

        {/* Station List */}
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-6 space-y-3.5">
          {!searchQuery.trim() ? (
            DEFAULT_RECENT_STATION_SEARCHES.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => handlePickOption(opt)}
                className="w-full flex items-center justify-between gap-3 py-1 px-2 -mx-2 rounded-xl text-left hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-[#1F2937] leading-snug whitespace-pre">
                    {opt.name} - {opt.code}
                  </p>
                  <p className="text-[12.5px] text-[#9CA3AF] mt-0.5 leading-snug truncate">
                    {opt.subtitle}
                  </p>
                </div>
                <ArrowUpLeft
                  className="h-[18px] w-[18px] text-[#6B7280] shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </button>
            ))
          ) : resolvedMatches.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <MapPin className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="font-display text-sm font-bold text-[#111842]">
                No matching stations found
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Try searching by station name or code (e.g. BP, PTF, SDAH, HWH, MCA).
              </p>
            </div>
          ) : (
            resolvedMatches.map((st) => (
              <button
                key={`${st.code}-${st.stationId ?? st.name}`}
                type="button"
                onClick={() => handlePickStation(st)}
                className="w-full flex items-center justify-between gap-3 py-1 px-2 -mx-2 rounded-xl text-left hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-[#1F2937] leading-snug truncate">
                    {(CURATED_NAME_BY_CODE[st.code.toUpperCase()] ?? st.name).toUpperCase()} - {st.code}
                  </p>
                  <p className="text-[12.5px] text-[#9CA3AF] mt-0.5 leading-snug truncate">
                    {formatStationSubtitle(st)}
                  </p>
                </div>
                <ArrowUpLeft
                  className="h-[18px] w-[18px] text-[#6B7280] shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
