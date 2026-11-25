import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, MapPin, Search, X } from 'lucide-react';
import type { Station } from '../types/rail';

interface StationSearchFieldProps {
  id: string;
  label: string;
  valueCode: string;
  stations: Station[];
  onChange: (station: Station) => void;
  placeholder?: string;
  compact?: boolean;
  renderTrigger?: (opts: {
    onClick: () => void;
    selectedStation: Station | undefined;
    isOpen: boolean;
  }) => ReactNode;
}

export function StationSearchField({
  id,
  label,
  valueCode,
  stations,
  onChange,
  placeholder = 'Select station',
  compact = false,
  renderTrigger,
}: StationSearchFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState<'ALL' | 'ER' | 'SER' | 'METRO' | 'MAINLINE'>('ALL');

  const selectedStation = useMemo(
    () =>
      valueCode.trim()
        ? stations.find(
            (s) =>
              s.code.toUpperCase() === valueCode.toUpperCase() ||
              (s.stationId && s.stationId.toLowerCase() === valueCode.toLowerCase())
          )
        : undefined,
    [stations, valueCode]
  );

  const filteredStations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = stations.filter((s) => {
      if (zoneFilter === 'ER' && s.zone !== 'ER') return false;
      if (zoneFilter === 'SER' && s.zone !== 'SER') return false;
      if (zoneFilter === 'METRO' && s.zone !== 'METRO') return false;
      if (zoneFilter === 'MAINLINE' && s.source === 'kolkata-suburban') return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.stationId && s.stationId.toLowerCase().includes(q)) ||
        (s.divisionName && s.divisionName.toLowerCase().includes(q)) ||
        s.city.toLowerCase().includes(q)
      );
    });

    if (q) {
      list.sort((a, b) => {
        const aExact = a.code.toLowerCase() === q || a.name.toLowerCase() === q ? 1 : 0;
        const bExact = b.code.toLowerCase() === q || b.name.toLowerCase() === q ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        const aStart =
          a.code.toLowerCase().startsWith(q) || a.name.toLowerCase().startsWith(q) ? 1 : 0;
        const bStart =
          b.code.toLowerCase().startsWith(q) || b.name.toLowerCase().startsWith(q) ? 1 : 0;
        if (aStart !== bStart) return bStart - aStart;
        return a.name.localeCompare(b.name);
      });
    }

    return list;
  }, [stations, searchQuery, zoneFilter]);

  const visibleStations = filteredStations.slice(0, 80);

  const openPicker = () => {
    setSearchQuery('');
    setIsOpen(true);
  };

  return (
    <div>
      {renderTrigger ? (
        renderTrigger({ onClick: openPicker, selectedStation, isOpen })
      ) : (
        <>
          <label htmlFor={id} className="block text-xs font-medium text-slate-500 mb-1">
            {label}
          </label>
          <button
            id={id}
            type="button"
            onClick={openPicker}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            className={`w-full ${
              compact ? 'min-h-[40px] px-3' : 'min-h-[44px] px-3.5'
            } bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-left hover:border-[#0B63E5]/60 focus:outline-none focus:ring-2 focus:ring-[#0B63E5] transition-colors`}
          >
            <div className="min-w-0 flex-1">
              {selectedStation ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono-num text-xs font-bold text-[#0B63E5] shrink-0">
                    {selectedStation.hasVerifiedCode === false ? 'NO CODE' : selectedStation.code}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 truncate">
                    {selectedStation.name}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-slate-400">{placeholder}</span>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          </button>
        </>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Select ${label}`}
          className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-[#0B63E5] text-white px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold">Select {label}</h2>
                <p className="text-xs text-blue-100">
                  {stations.length} stations loaded (Kolkata Suburban, Metro &amp; Mainline)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={`Close ${label} picker`}
                className="h-9 w-9 rounded-xl hover:bg-white/15 flex items-center justify-center shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 space-y-3 bg-[#F8FBFF]">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search station name, code (HWH, SDAH, CG, DH, AMZ), or division..."
                  aria-label={`Search ${label}`}
                  className="w-full min-h-[44px] pl-10 pr-9 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B63E5]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear station search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: 'ALL', label: `All (${stations.length})` },
                    { id: 'ER', label: 'Eastern (ER)' },
                    { id: 'SER', label: 'South Eastern (SER)' },
                    { id: 'METRO', label: 'Metro' },
                    { id: 'MAINLINE', label: 'Mainline Hubs' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setZoneFilter(tab.id)}
                    className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      zoneFilter === tab.id
                        ? 'bg-[#0B63E5] text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>
                Showing {visibleStations.length} of {filteredStations.length} matching stations
              </span>
              {filteredStations.length > 80 && <span>Refine search to narrow</span>}
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
              {visibleStations.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <MapPin className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="font-display text-sm font-bold text-slate-800">
                    No matching stations found
                  </p>
                  <p className="text-xs text-slate-500">
                    Try searching by full name (e.g. Belanagar, Chandannagar, Digha) or code.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setZoneFilter('ALL');
                    }}
                    className="mt-2 min-h-[36px] px-4 rounded-xl bg-[#EAF4FF] text-[#0B63E5] text-xs font-bold"
                  >
                    Reset Search
                  </button>
                </div>
              ) : (
                visibleStations.map((st) => {
                  const isSelected = st.code.toUpperCase() === valueCode.toUpperCase();
                  return (
                    <button
                      key={`${st.code}-${st.stationId ?? st.name}`}
                      type="button"
                      onClick={() => {
                        onChange(st);
                        setIsOpen(false);
                      }}
                      className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors ${
                        isSelected ? 'bg-[#EAF4FF]/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{st.name}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {st.zone} · {st.divisionName ?? st.city}
                          {st.isJunction ? ' · Junction' : ''}
                          {st.isInterchange ? ' · Interchange' : ''}
                        </p>
                      </div>
                      <span
                        className={`font-mono-num text-xs font-bold shrink-0 ${
                          st.hasVerifiedCode === false ? 'text-amber-700' : 'text-[#0B63E5]'
                        }`}
                      >
                        {st.hasVerifiedCode === false ? 'NO CODE' : st.code}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
