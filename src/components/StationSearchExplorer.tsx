import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Check,
  Code2,
  Copy,
  Download,
  GitBranch,
  Layers,
  MapPin,
  RefreshCw,
  Route,
  Search,
  Ticket,
  X,
} from 'lucide-react';
import type { Station } from '../types/rail';
import type {
  EasternRailwaySuburbanFareDb,
  IndexedSuburbanStation,
  SuburbanIndex,
  SuburbanPassengerType,
  SuburbanRouteSummary,
} from '../types/suburban';
import {
  buildFullStationExportRows,
  calculateFare,
  calculateSuburbanFareBreakdown,
  computeShortestNetworkDistances,
  fetchStationDetail,
  findEasternRailwaySlab,
  findSuburbanPath,
  getOfficialEasternRailwayFareDb,
  searchSuburbanStations,
} from '../utils/suburbanLogic';
import { StationSearchField } from './StationSearchField';

interface StationSearchExplorerProps {
  suburbanIndex: SuburbanIndex | null;
  fareDb?: EasternRailwaySuburbanFareDb;
  loading: boolean;
  error: string | null;
  initialQuery?: string;
  onRetryFetch: () => void;
  onBack: () => void;
  onBookUnreservedPair: (fromCode: string, toCode: string) => void;
  onBookPlatformStation: (stationCode: string) => void;
}

export function StationSearchExplorer({
  suburbanIndex,
  fareDb = getOfficialEasternRailwayFareDb(),
  loading,
  error,
  initialQuery = '',
  onRetryFetch,
  onBack,
  onBookUnreservedPair,
  onBookPlatformStation,
}: StationSearchExplorerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'stations' | 'corridors' | 'lookup'>('stations');
  const [query, setQuery] = useState(initialQuery);
  const [zoneId, setZoneId] = useState<string>('ALL');
  const [divisionId, setDivisionId] = useState<string>('ALL');
  const [routeId, setRouteId] = useState<string>('ALL');
  const [junctionsOnly, setJunctionsOnly] = useState(false);
  const [interchangesOnly, setInterchangesOnly] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<string>('HWH');
  const [fareFromCode, setFareFromCode] = useState<string>('SDAH');

  const [corridorFilter, setCorridorFilter] = useState<'all' | 'populated' | 'pending'>('all');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('ER_SONARPUR_CANNING');

  const [lookupFrom, setLookupFrom] = useState<string>('SDAH');
  const [lookupTo, setLookupTo] = useState<string>('DH');
  const [calcDistanceInput, setCalcDistanceInput] = useState<string>('60');
  const [calcPassengerType, setCalcPassengerType] = useState<SuburbanPassengerType>('adult');
  const [showAllSlabs, setShowAllSlabs] = useState<boolean>(false);

  const [showFullCodeModal, setShowFullCodeModal] = useState(false);
  const [exportTab, setExportTab] = useState<'table' | 'json' | 'csv'>('table');
  const [exportFilter, setExportFilter] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setActiveSubTab('stations');
    }
  }, [initialQuery]);

  const matchedStations = useMemo(() => {
    if (!suburbanIndex) return [];
    return searchSuburbanStations(suburbanIndex, {
      query,
      zoneId,
      divisionId,
      routeId,
      junctionsOnly,
      interchangesOnly,
    });
  }, [suburbanIndex, query, zoneId, divisionId, routeId, junctionsOnly, interchangesOnly]);

  const shortestDistances = useMemo(() => {
    if (!suburbanIndex) return new Map<string, number>();
    return computeShortestNetworkDistances(suburbanIndex, fareFromCode);
  }, [suburbanIndex, fareFromCode]);

  const fareOriginStation = useMemo(() => {
    if (!suburbanIndex) return null;
    return fetchStationDetail(suburbanIndex, fareFromCode);
  }, [suburbanIndex, fareFromCode]);

  const fetchedStation: IndexedSuburbanStation | null = useMemo(() => {
    if (!suburbanIndex || matchedStations.length === 0) return null;
    const stillVisible = matchedStations.find((s) => s.stationId === selectedStationId);
    return stillVisible ?? matchedStations[0];
  }, [suburbanIndex, selectedStationId, matchedStations]);

  const fetchedStationFare = useMemo(() => {
    if (!fetchedStation) return null;
    const dist = shortestDistances.get(fetchedStation.stationId) ?? null;
    return calculateSuburbanFareBreakdown(dist, fareDb);
  }, [fetchedStation, shortestDistances, fareDb]);

  const suburbanPickerStations: Station[] = useMemo(() => {
    if (!suburbanIndex) return [];
    return suburbanIndex.stations.map((s) => ({
      code: (s.stationCode ?? s.stationId).toUpperCase(),
      name: s.stationName.toUpperCase(),
      city: s.divisionName,
      zone: s.zoneId,
      stationId: s.stationId,
      divisionId: s.divisionId,
      divisionName: s.divisionName,
      isJunction: s.isJunction,
      isInterchange: s.isInterchange,
      hasVerifiedCode: Boolean(s.stationCode),
      source: 'kolkata-suburban',
    }));
  }, [suburbanIndex]);

  const filteredRoutes = useMemo(() => {
    if (!suburbanIndex) return [];
    return suburbanIndex.routes.filter((r) => {
      if (corridorFilter === 'populated') return r.stops.length > 0;
      if (corridorFilter === 'pending') return r.stops.length === 0;
      return true;
    });
  }, [suburbanIndex, corridorFilter]);

  const selectedRoute: SuburbanRouteSummary | null = useMemo(() => {
    if (!suburbanIndex) return null;
    return suburbanIndex.routeById.get(selectedRouteId) ?? suburbanIndex.routes[0] ?? null;
  }, [suburbanIndex, selectedRouteId]);

  const pathResult = useMemo(() => {
    if (!suburbanIndex) return null;
    return findSuburbanPath(suburbanIndex, lookupFrom, lookupTo);
  }, [suburbanIndex, lookupFrom, lookupTo]);

  useEffect(() => {
    if (pathResult?.totalProvisionalKm && pathResult.totalProvisionalKm > 0) {
      setCalcDistanceInput(String(pathResult.totalProvisionalKm));
    }
  }, [pathResult]);

  const lookupFare = useMemo(
    () => (pathResult ? calculateSuburbanFareBreakdown(pathResult.totalProvisionalKm, fareDb) : null),
    [pathResult, fareDb]
  );

  const officialCalcResult = useMemo(() => {
    const parsedKm = Number(calcDistanceInput.trim());
    if (calcDistanceInput.trim() === '' || !Number.isFinite(parsedKm) || parsedKm <= 0) {
      return {
        valid: false as const,
        error: 'Invalid journey distance. Enter a distance between 1 and 500 km.',
      };
    }
    try {
      const fare = calculateFare(parsedKm, calcPassengerType, fareDb);
      const adultFare = calculateFare(parsedKm, 'adult', fareDb);
      const childFare = calculateFare(parsedKm, 'child', fareDb);
      const slab = findEasternRailwaySlab(parsedKm, fareDb);
      return {
        valid: true as const,
        distanceKm: parsedKm,
        fare,
        adultFare,
        childFare,
        rWalletFare: Number((fare * 0.97).toFixed(2)),
        slab,
      };
    } catch (err) {
      return {
        valid: false as const,
        error:
          err instanceof Error
            ? `${err.message}. Published Eastern Railway suburban chart covers 1–500 km only (no extrapolation beyond 500 km).`
            : 'Fare not available for this distance.',
      };
    }
  }, [calcDistanceInput, calcPassengerType, fareDb]);

  const exportRows = useMemo(() => {
    if (!suburbanIndex || !showFullCodeModal) return [];
    return buildFullStationExportRows(suburbanIndex, fareFromCode);
  }, [suburbanIndex, showFullCodeModal, fareFromCode]);

  const filteredExportRows = useMemo(() => {
    const q = exportFilter.trim().toLowerCase();
    if (!q) return exportRows;
    return exportRows.filter(
      (r) =>
        r.stationCode.toLowerCase().includes(q) ||
        r.stationName.toLowerCase().includes(q) ||
        r.divisionName.toLowerCase().includes(q) ||
        r.corridors.some((c) => c.toLowerCase().includes(q))
    );
  }, [exportRows, exportFilter]);

  const fullExportCodeString = useMemo(() => {
    if (!showFullCodeModal) return '';
    if (exportTab === 'csv') {
      const header =
        'stationCode,stationName,zoneId,divisionName,isJunction,distanceKm,fareIISingle,fareIIReturn,fareFCSingle,fareMonthlySeasonII,corridors';
      const lines = filteredExportRows.map(
        (r) =>
          `${r.stationCode},"${r.stationName.replace(/"/g, '""')}",${r.zoneId},"${r.divisionName}",${r.isJunction},${r.distanceFromOriginKm ?? ''},${r.fareIISingle ?? ''},${r.fareIIReturn ?? ''},${r.fareFCSingle ?? ''},${r.fareMonthlySeasonII ?? ''},"${r.corridors.join(' | ').replace(/"/g, '""')}"`
      );
      return [header, ...lines].join('\n');
    }
    return JSON.stringify(
      {
        originStation: fareFromCode,
        totalStations: filteredExportRows.length,
        stations: filteredExportRows,
      },
      null,
      2
    );
  }, [showFullCodeModal, exportTab, filteredExportRows, fareFromCode]);

  const handleCopyFullCode = async () => {
    try {
      await navigator.clipboard.writeText(fullExportCodeString);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  const handleDownloadJson = () => {
    const jsonPayload = JSON.stringify(
      {
        dataset: suburbanIndex?.metadata.datasetName,
        version: suburbanIndex?.metadata.version,
        fareOrigin: fareFromCode,
        totalStations: exportRows.length,
        stations: exportRows,
      },
      null,
      2
    );
    const blob = new Blob([jsonPayload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kolkata_suburban_stations_codes_fares_${fareFromCode}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFetchStation = (st: IndexedSuburbanStation) => {
    setSelectedStationId(st.stationId);
  };

  const handleResetFilters = () => {
    setQuery('');
    setZoneId('ALL');
    setDivisionId('ALL');
    setRouteId('ALL');
    setJunctionsOnly(false);
    setInterchangesOnly(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3 shadow-xs">
          <RefreshCw className="h-8 w-8 text-[#0B63E5] animate-spin mx-auto" />
          <h1 className="font-display text-lg font-bold text-slate-900">
            Fetching Kolkata Suburban Railway Database
          </h1>
          <p className="text-xs text-slate-500">
            Loading 396 stations, 28 corridors, interchanges, and suburban fares...
          </p>
        </div>
      </div>
    );
  }

  if (error || !suburbanIndex) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white rounded-3xl border border-rose-200 p-8 text-center space-y-4 shadow-xs">
          <AlertTriangle className="h-10 w-10 text-rose-600 mx-auto" />
          <h1 className="font-display text-lg font-bold text-slate-900">
            Unable to Load Station Database
          </h1>
          <p className="text-xs text-slate-600">
            {error ?? 'Suburban railway JSON file could not be loaded.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onRetryFetch}
              className="min-h-[42px] px-5 rounded-xl bg-[#0B63E5] text-white text-xs font-bold hover:bg-[#0952C2]"
            >
              Retry Fetch
            </button>
            <button
              type="button"
              onClick={onBack}
              className="min-h-[42px] px-5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const availableDivisions = suburbanIndex.divisions.filter(
    (d) => zoneId === 'ALL' || d.zoneId === zoneId
  );

  const stationPickerKey = (st: IndexedSuburbanStation) =>
    (st.stationCode ?? st.stationId).toUpperCase();

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      {/* Blue Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="bg-[#0B63E5] text-white px-4 sm:px-5 py-4 space-y-3">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to Home"
                className="h-10 w-10 rounded-xl hover:bg-white/15 flex items-center justify-center shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="font-display text-base sm:text-lg font-bold leading-snug">
                  {suburbanIndex.metadata.datasetName}
                </h1>
                <p className="text-xs text-blue-100">
                  v{suburbanIndex.metadata.version} · {suburbanIndex.stations.length} Stations ·{' '}
                  {suburbanIndex.routes.length} Corridors · ER, SER &amp; Metro
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowFullCodeModal(true)}
              className="min-h-[38px] px-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Code2 className="h-4 w-4" /> Full Code
            </button>
          </div>

          <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 bg-[#084CB3] p-1 rounded-xl w-full sm:w-auto">
            {(
              [
                { id: 'stations', label: `Stations (${suburbanIndex.stations.length})` },
                { id: 'corridors', label: `Corridors (${suburbanIndex.routes.length})` },
                { id: 'lookup', label: 'Route & Fare' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`min-h-[36px] px-1.5 sm:px-3.5 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap text-center transition-colors ${
                  activeSubTab === tab.id
                    ? 'bg-white text-[#0B63E5] shadow-xs'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Map Enrichment & Fare Basis Notice */}
        <div className="px-5 py-2.5 bg-[#F2F7FF] border-b border-blue-100 flex items-start gap-2.5 text-xs text-slate-700">
          <Route className="h-4 w-4 text-[#0B63E5] shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold text-slate-900">Complete Map Directory &amp; Fare Estimator:</span>{' '}
            All {suburbanIndex.stations.length} stations from the Kolkata Suburban Railway map (ER, SER, Circular &amp; Metro) carry station codes, km distances, and Indian Railways II / FC / MST distance-slab fares.
          </p>
        </div>

        {/* SUB-TAB 1: STATION SEARCH & FARE */}
        {activeSubTab === 'stations' && (
          <div className="p-5 space-y-5">
            {/* Search, Origin Fare Selector & Filters */}
            <div className="rounded-2xl bg-[#F8FBFF] border border-slate-200 p-4 space-y-3.5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                <div className="lg:col-span-7">
                  <label htmlFor="sub-search-input" className="block text-[11px] font-medium text-slate-500 mb-1">
                    Search Station by Name, Code, or Corridor
                  </label>
                  <div className="relative">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="sub-search-input"
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="e.g. Canning, Diamond Harbour, Belanagar, Amta, CG, DH, BZL..."
                      aria-label="Search Kolkata Suburban stations"
                      className="w-full min-h-[42px] pl-10 pr-9 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B63E5]"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label="Clear search query"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-5">
                  <div className="relative">
                    <div className="absolute right-0 top-0 flex items-center gap-1.5 text-[11px]">
                      {(['SDAH', 'HWH', 'KGP'] as const).map((hub) => (
                        <button
                          key={hub}
                          type="button"
                          onClick={() => setFareFromCode(hub)}
                          className={`px-2 py-0.5 rounded font-mono-num font-bold transition-colors ${
                            fareFromCode.toUpperCase() === hub
                              ? 'bg-[#0B63E5] text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {hub}
                        </button>
                      ))}
                    </div>
                    <StationSearchField
                      id="fare-from-origin"
                      label="Fare From Station"
                      valueCode={fareFromCode}
                      stations={suburbanPickerStations}
                      onChange={(st) => setFareFromCode(st.code)}
                      compact
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label htmlFor="sub-zone" className="block text-[11px] font-medium text-slate-500 mb-1">
                    Railway Zone / System
                  </label>
                  <select
                    id="sub-zone"
                    value={zoneId}
                    onChange={(e) => {
                      setZoneId(e.target.value);
                      setDivisionId('ALL');
                    }}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
                  >
                    <option value="ALL">All Systems (ER, SER &amp; Metro)</option>
                    {suburbanIndex.zones.map((z) => (
                      <option key={z.zoneId} value={z.zoneId}>
                        {z.zoneId} — {z.zoneName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="sub-div" className="block text-[11px] font-medium text-slate-500 mb-1">
                    Division / Line Group
                  </label>
                  <select
                    id="sub-div"
                    value={divisionId}
                    onChange={(e) => setDivisionId(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
                  >
                    <option value="ALL">All Divisions ({availableDivisions.length})</option>
                    {availableDivisions.map((d) => (
                      <option key={d.divisionId} value={d.divisionId}>
                        {d.divisionName} ({d.divisionId})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="sub-route" className="block text-[11px] font-medium text-slate-500 mb-1">
                    Corridor / Route
                  </label>
                  <select
                    id="sub-route"
                    value={routeId}
                    onChange={(e) => setRouteId(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
                  >
                    <option value="ALL">All Populated Corridors</option>
                    {suburbanIndex.routes
                      .filter((r) => r.stops.length > 0)
                      .map((r) => (
                        <option key={r.routeId} value={r.routeId}>
                          {r.routeName} ({r.stops.length} stops)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setJunctionsOnly((v) => !v)}
                    className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      junctionsOnly
                        ? 'bg-[#0B63E5] border-[#0B63E5] text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Junctions Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterchangesOnly((v) => !v)}
                    className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      interchangesOnly
                        ? 'bg-[#0B63E5] border-[#0B63E5] text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Interchange Hubs ({suburbanIndex.interchanges.length})
                  </button>
                </div>
                <span className="text-xs font-medium text-slate-600 tabular-nums">
                  {matchedStations.length} station{matchedStations.length === 1 ? '' : 's'} matched · Fare ex {fareFromCode.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Master-Detail Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Station Results List */}
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between">
                  <span>Station · Code</span>
                  <span className="font-mono-num">Dist · Fare ex {fareFromCode.toUpperCase()}</span>
                </div>

                {matchedStations.length === 0 ? (
                  <div className="p-8 text-center space-y-2.5">
                    <MapPin className="h-8 w-8 text-slate-300 mx-auto" />
                    <p className="font-display text-sm font-bold text-slate-800">
                      No Stations Found
                    </p>
                    <p className="text-xs text-slate-500">
                      No station matches &ldquo;{query}&rdquo; with current filters.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="min-h-[38px] px-4 rounded-xl bg-[#EAF4FF] text-[#0B63E5] text-xs font-bold"
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100">
                    {matchedStations.map((st) => {
                      const isSelected = fetchedStation?.stationId === st.stationId;
                      const dist = shortestDistances.get(st.stationId) ?? null;
                      const fare = calculateSuburbanFareBreakdown(dist, fareDb);
                      return (
                        <button
                          key={st.stationId}
                          type="button"
                          onClick={() => handleFetchStation(st)}
                          className={`w-full px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors ${
                            isSelected
                              ? 'bg-[#EAF4FF] border-l-4 border-[#0B63E5]'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {st.stationName}
                            </p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              <span className="font-mono-num font-bold text-[#0B63E5]">
                                {st.displayCode}
                              </span>{' '}
                              · {st.zoneId} · {st.divisionName}
                              {st.isInterchange ? ' · Interchange' : st.isJunction ? ' · Junction' : ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            {fare ? (
                              fare.distanceKm === 0 ? (
                                <span className="font-mono-num text-xs font-bold text-emerald-700">
                                  Origin
                                </span>
                              ) : (
                                <>
                                  <p className="font-mono-num text-xs font-bold text-slate-900">
                                    ₹{fare.iiSingle} II · ₹{fare.fcSingle} FC
                                  </p>
                                  <p className="font-mono-num text-[11px] text-slate-500">
                                    {fare.distanceKm} km
                                  </p>
                                </>
                              )
                            ) : (
                              <span className="font-mono-num text-xs text-slate-400">N/A</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Fetched Station Inspector Panel */}
              <div className="lg:col-span-7">
                {fetchedStation ? (
                  <div className="rounded-2xl border border-slate-200 bg-[#F9FBFF] p-5 space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                      <div>
                        <p className="font-mono-num text-xs font-bold text-[#0B63E5]">
                          CODE: {fetchedStation.displayCode}
                        </p>
                        <h2 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                          {fetchedStation.stationName}
                        </h2>
                        <p className="text-xs text-slate-600 mt-1">
                          {fetchedStation.zoneName} ({fetchedStation.zoneId}) ·{' '}
                          {fetchedStation.divisionName} ({fetchedStation.divisionId})
                        </p>
                      </div>

                      <div className="text-right text-xs">
                        <p className="font-semibold text-slate-800">
                          {fetchedStation.isInterchange
                            ? 'Interchange Hub & Junction'
                            : fetchedStation.isJunction
                            ? 'Junction Station'
                            : 'Suburban Station'}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          {fetchedStation.routes.length} Corridor{fetchedStation.routes.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>

                    {/* Suburban Fare Breakdown Card */}
                    {fetchedStationFare && (
                      <div className="rounded-xl bg-white border border-blue-200/80 overflow-hidden">
                        <div className="px-4 py-2.5 bg-[#EAF4FF]/70 border-b border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-slate-900">
                            Suburban Fare from {fareOriginStation?.stationName ?? fareFromCode} ({fareOriginStation?.displayCode ?? fareFromCode})
                          </span>
                          <span className="font-mono-num font-bold text-[#0B63E5]">
                            {fetchedStationFare.distanceKm === 0
                              ? 'Same Station (0 km)'
                              : `${fetchedStationFare.distanceKm} km · Slab ${fetchedStationFare.iiSlabLabel}`}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                          <div className="px-2.5 py-3">
                            <p className="text-[11px] text-slate-500">Second Class (II)</p>
                            <p className="font-mono-num text-base font-bold text-slate-900 mt-0.5">
                              ₹ {fetchedStationFare.iiSingle}
                            </p>
                            <p className="text-[10.5px] text-slate-600 font-mono-num">
                              Child ₹{fetchedStationFare.iiChildSingle}
                            </p>
                            <p className="text-[10.5px] text-emerald-700 font-mono-num whitespace-nowrap">
                              R-Wallet ₹{fetchedStationFare.rWalletII.toFixed(2)}
                            </p>
                          </div>
                          <div className="px-2.5 py-3">
                            <p className="text-[11px] text-slate-500">Return (II)</p>
                            <p className="font-mono-num text-base font-bold text-slate-900 mt-0.5">
                              ₹ {fetchedStationFare.iiReturn}
                            </p>
                            <p className="text-[11px] text-slate-500">Same-day return</p>
                          </div>
                          <div className="px-2.5 py-3">
                            <p className="text-[11px] text-slate-500">First Class (FC)</p>
                            <p className="font-mono-num text-base font-bold text-slate-900 mt-0.5">
                              ₹ {fetchedStationFare.fcSingle}
                            </p>
                            <p className="text-[11px] text-slate-500">Single journey</p>
                          </div>
                          <div className="px-2.5 py-3">
                            <p className="text-[11px] text-slate-500">Monthly (MST II)</p>
                            <p className="font-mono-num text-base font-bold text-[#0B63E5] mt-0.5">
                              ₹ {fetchedStationFare.monthlySeasonII}
                            </p>
                            <p className="text-[11px] text-slate-500">30-day MST pass</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick Booking / Lookup Actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onBookUnreservedPair(
                            fareFromCode.toUpperCase(),
                            stationPickerKey(fetchedStation)
                          )
                        }
                        className="min-h-[40px] px-3.5 rounded-xl bg-[#0B63E5] text-white text-xs font-bold hover:bg-[#0952C2] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
                      >
                        <Ticket className="h-3.5 w-3.5" /> Book {fareFromCode.toUpperCase()} →{' '}
                        {stationPickerKey(fetchedStation)}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onBookUnreservedPair(
                            stationPickerKey(fetchedStation),
                            fareFromCode.toUpperCase()
                          )
                        }
                        className="min-h-[40px] px-3.5 rounded-xl border border-[#0B63E5] text-[#0B63E5] bg-white text-xs font-bold hover:bg-[#EAF4FF] whitespace-nowrap shrink-0"
                      >
                        From Here → {fareFromCode.toUpperCase()}
                      </button>
                      <button
                        type="button"
                        onClick={() => onBookPlatformStation(stationPickerKey(fetchedStation))}
                        className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        Platform Ticket
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLookupFrom(fareFromCode.toUpperCase());
                          setLookupTo(stationPickerKey(fetchedStation));
                          setActiveSubTab('lookup');
                        }}
                        className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
                      >
                        <Route className="h-3.5 w-3.5" /> Full Route &amp; Fare
                      </button>
                    </div>

                    {/* Interchange Connections */}
                    {fetchedStation.isInterchange && (
                      <div className="rounded-xl bg-white border border-blue-200 p-3.5 space-y-2">
                        <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <GitBranch className="h-3.5 w-3.5 text-[#0B63E5]" /> Network
                          Interchange Hub
                        </p>
                        <p className="text-xs text-slate-600">
                          Connected Routes ({fetchedStation.interchangeConnectedRoutes.length}):{' '}
                          {fetchedStation.interchangeConnectedRoutes
                            .map((rid) => suburbanIndex.routeById.get(rid)?.routeName ?? rid)
                            .join(' · ')}
                        </p>
                      </div>
                    )}

                    {/* Corridors Serving Station */}
                    <div className="space-y-2">
                      <h3 className="font-display text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-[#0B63E5]" /> Corridors
                        Serving {fetchedStation.stationName} ({fetchedStation.routes.length})
                      </h3>
                      {fetchedStation.routes.length === 0 ? (
                        <p className="text-xs text-slate-500 bg-white rounded-xl border border-slate-200 p-3">
                          Station appears in master directory; corridor assignment pending verification.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {fetchedStation.routes.map((rm) => (
                            <div
                              key={rm.routeId}
                              className="rounded-xl bg-white border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <div>
                                <p className="font-semibold text-slate-900">{rm.routeName}</p>
                                <p className="text-slate-500 font-mono-num mt-0.5">
                                  Stop #{rm.sequence} of {rm.totalRouteStops} ·{' '}
                                  {rm.stationKm !== null ? `${rm.stationKm} km marker` : 'Km unverified'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRouteId(rm.routeId);
                                  setActiveSubTab('corridors');
                                }}
                                className="text-xs font-semibold text-[#0B63E5] hover:underline whitespace-nowrap shrink-0"
                              >
                                View Corridor →
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Adjacent Stops from Track Segments */}
                    <div className="space-y-2">
                      <h3 className="font-display text-xs font-bold text-slate-700">
                        Adjacent Stations ({fetchedStation.adjacentStops.length})
                      </h3>
                      {fetchedStation.adjacentStops.length === 0 ? (
                        <p className="text-xs text-slate-500 bg-white rounded-xl border border-slate-200 p-3">
                          No adjacent stops populated yet for this station.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {fetchedStation.adjacentStops.map((adj, idx) => (
                            <button
                              key={`${adj.routeId}-${adj.direction}-${adj.stationId}-${idx}`}
                              type="button"
                              onClick={() => setSelectedStationId(adj.stationId)}
                              className="rounded-xl bg-white border border-slate-200 p-3 text-left hover:border-[#0B63E5]/60 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-semibold text-slate-900 truncate">
                                  {adj.direction === 'prev' ? '← ' : '→ '}
                                  {adj.stationName}
                                </span>
                                <span className="font-mono-num font-bold text-[#0B63E5] shrink-0">
                                  {adj.segmentKm !== null ? `${adj.segmentKm} km` : 'Km N/A'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {adj.stationCode ?? 'N/A'} · {adj.routeName}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 2: ALL 28 CORRIDORS */}
        {activeSubTab === 'corridors' && (
          <div className="p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                {(
                  [
                    { id: 'all', label: `All (${suburbanIndex.routes.length})` },
                    {
                      id: 'populated',
                      label: `Populated (${suburbanIndex.routes.filter((r) => r.stops.length > 0).length})`,
                    },
                    {
                      id: 'pending',
                      label: `Pending (${suburbanIndex.routes.filter((r) => r.stops.length === 0).length})`,
                    },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCorridorFilter(f.id)}
                    className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      corridorFilter === f.id
                        ? 'bg-white text-[#0B63E5] shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                {filteredRoutes.map((r) => {
                  const active = selectedRoute?.routeId === r.routeId;
                  return (
                    <button
                      key={r.routeId}
                      type="button"
                      onClick={() => setSelectedRouteId(r.routeId)}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        active ? 'bg-[#EAF4FF] border-l-4 border-[#0B63E5]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {r.routeName}
                        </p>
                        <span className="font-mono-num text-xs font-bold text-[#0B63E5] shrink-0">
                          {r.stops.length > 0 ? `${r.stops.length} stops` : 'Pending'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {r.zoneId} · {r.divisionName} · {r.corridor}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="lg:col-span-7">
                {selectedRoute && (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                    <div className="p-4 bg-[#F8FBFF] border-b border-slate-200">
                      <p className="font-mono-num text-[11px] font-bold text-[#0B63E5]">
                        {selectedRoute.routeId} · {selectedRoute.zoneName}
                      </p>
                      <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                        {selectedRoute.routeName}
                      </h2>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {selectedRoute.divisionName} ·{' '}
                        {selectedRoute.stops.length > 0
                          ? `${selectedRoute.stops.length} stations with code & fare`
                          : 'Pending beyond map scope'}
                      </p>
                    </div>

                    {selectedRoute.stops.length === 0 ? (
                      <div className="p-8 text-center space-y-2">
                        <Layers className="h-8 w-8 text-slate-300 mx-auto" />
                        <p className="font-display text-sm font-bold text-slate-800">
                          Extended Mainline Corridor Beyond Kolkata Suburban Map
                        </p>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          {selectedRoute.routeName} extends north of Krishnanagar City Jn outside the suburban map boundary.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-[460px] overflow-y-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500">
                            <tr>
                              <th className="py-2.5 px-3">Sr</th>
                              <th className="py-2.5 px-3">Code</th>
                              <th className="py-2.5 px-3">Station Name</th>
                              <th className="py-2.5 px-3 text-right">Km</th>
                              <th className="py-2.5 px-3 text-right">II / FC Fare</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedRoute.stops.map((st) => {
                              const firstKm = selectedRoute.stops[0]?.stationKm;
                              const legDist =
                                typeof st.stationKm === 'number' && typeof firstKm === 'number'
                                  ? Math.abs(st.stationKm - firstKm)
                                  : null;
                              const stopFare = calculateSuburbanFareBreakdown(legDist, fareDb);
                              return (
                                <tr
                                  key={`${st.sequence}-${st.stationName}`}
                                  onClick={() => {
                                    const master = fetchStationDetail(
                                      suburbanIndex,
                                      st.stationCode ?? st.stationName
                                    );
                                    if (master) {
                                      setSelectedStationId(master.stationId);
                                      setActiveSubTab('stations');
                                    }
                                  }}
                                  className="hover:bg-[#EAF4FF]/60 cursor-pointer"
                                >
                                  <td className="py-2.5 px-3 font-mono-num text-slate-500">
                                    {st.sequence}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono-num font-bold text-[#0B63E5]">
                                    {st.stationCode ?? 'N/A'}
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                                    {st.stationName}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                                    {st.stationKm !== null ? `${st.stationKm} km` : '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-900">
                                    {stopFare
                                      ? stopFare.distanceKm === 0
                                        ? 'Origin'
                                        : `₹${stopFare.iiSingle} / ₹${stopFare.fcSingle}`
                                      : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 3: SUBURBAN ROUTE & FARE LOOKUP */}
        {activeSubTab === 'lookup' && (
          <div className="p-5 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-[#F8FBFF] p-4 grid grid-cols-1 sm:grid-cols-11 gap-3 items-end">
              <div className="sm:col-span-5">
                <StationSearchField
                  id="lookup-from"
                  label="From Suburban Station"
                  valueCode={lookupFrom}
                  stations={suburbanPickerStations}
                  onChange={(st) => setLookupFrom(st.code)}
                />
              </div>
              <div className="sm:col-span-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setLookupFrom(lookupTo);
                    setLookupTo(lookupFrom);
                  }}
                  aria-label="Swap suburban From and To stations"
                  className="h-11 w-11 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-[#0B63E5] hover:bg-[#EAF4FF]"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </button>
              </div>
              <div className="sm:col-span-5">
                <StationSearchField
                  id="lookup-to"
                  label="To Suburban Station"
                  valueCode={lookupTo}
                  stations={suburbanPickerStations}
                  onChange={(st) => setLookupTo(st.code)}
                />
              </div>
            </div>

            {pathResult && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                {pathResult.found && pathResult.fromStation && pathResult.toStation ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <p className="text-xs font-semibold text-[#0B63E5]">
                          {pathResult.kind === 'direct'
                            ? 'Direct Suburban Corridor'
                            : pathResult.kind === 'interchange'
                            ? `1-Transfer via ${pathResult.interchangeStation?.stationName} (${pathResult.interchangeStation?.displayCode})`
                            : pathResult.kind === 'multi-interchange'
                            ? `${pathResult.legs.length}-Corridor Connected Route`
                            : 'Same Station Selected'}
                        </p>
                        <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                          <span>
                            {pathResult.fromStation.stationName} ({pathResult.fromStation.displayCode})
                          </span>
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                          <span>
                            {pathResult.toStation.stationName} ({pathResult.toStation.displayCode})
                          </span>
                        </h2>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-500">Total Rail Distance</p>
                        <p className="font-mono-num text-lg font-bold text-slate-900">
                          {pathResult.totalProvisionalKm !== null
                            ? `${pathResult.totalProvisionalKm} km`
                            : 'Unverified'}
                        </p>
                      </div>
                    </div>

                    {lookupFare && (
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 rounded-xl bg-[#F4F8FD] border border-blue-100 p-4 text-xs">
                        <div>
                          <p className="text-slate-500">II Adult ({lookupFare.iiSlabLabel})</p>
                          <p className="font-mono-num text-base font-bold text-slate-900">
                            ₹ {lookupFare.iiSingle}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">II Child (5–11 yrs)</p>
                          <p className="font-mono-num text-base font-bold text-slate-900">
                            ₹ {lookupFare.iiChildSingle}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">R-Wallet (3% Off)</p>
                          <p className="font-mono-num text-base font-bold text-emerald-700">
                            ₹ {lookupFare.rWalletII.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">II Return</p>
                          <p className="font-mono-num text-base font-bold text-slate-900">
                            ₹ {lookupFare.iiReturn}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">First Class (FC)</p>
                          <p className="font-mono-num text-base font-bold text-slate-900">
                            ₹ {lookupFare.fcSingle}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Monthly MST (II)</p>
                          <p className="font-mono-num text-base font-bold text-[#0B63E5]">
                            ₹ {lookupFare.monthlySeasonII}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {pathResult.legs.map((leg, legIdx) => (
                        <div
                          key={`${leg.routeId}-${legIdx}`}
                          className="rounded-xl border border-slate-200 p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-slate-900">
                              Leg {legIdx + 1}: {leg.routeName}
                            </span>
                            <span className="font-mono-num text-[#0B63E5] font-semibold">
                              {leg.stops.length} stops ·{' '}
                              {leg.provisionalKm !== null ? `${leg.provisionalKm} km` : 'Km N/A'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-xs text-slate-700">
                            {leg.stops.map((s, sIdx) => (
                              <span key={`${s.sequence}-${s.stationName}`}>
                                <span className="font-medium text-slate-900">{s.stationName}</span>
                                {s.stationCode ? (
                                  <span className="font-mono-num text-[11px] text-[#0B63E5] font-semibold">
                                    {' '}
                                    ({s.stationCode})
                                  </span>
                                ) : null}
                                {sIdx < leg.stops.length - 1 ? ' → ' : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {pathResult.kind !== 'same-station' && (
                      <button
                        type="button"
                        onClick={() =>
                          onBookUnreservedPair(
                            stationPickerKey(pathResult.fromStation!),
                            stationPickerKey(pathResult.toStation!)
                          )
                        }
                        className="min-h-[44px] px-5 rounded-xl bg-[#0B63E5] text-white text-xs font-bold hover:bg-[#0952C2]"
                      >
                        Open in Unreserved Ticket Planner →
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 space-y-2">
                    <Route className="h-8 w-8 text-slate-300 mx-auto" />
                    <p className="font-display text-sm font-bold text-slate-900">
                      Corridor Path Unavailable
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {pathResult.warning}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Official Eastern Railway Second Class Ordinary Distance Fare Calculator (1–500 km JSON) */}
            <div className="rounded-2xl border border-blue-200/80 bg-[#F8FBFF] p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-[#0B63E5] uppercase tracking-wide">
                    Official Eastern Railway Fare Chart · Second Class Ordinary
                  </p>
                  <h3 className="font-display text-base font-bold text-slate-900 mt-0.5">
                    Distance &amp; Passenger Fare Calculator (1–500 km)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {fareDb.metadata.fareChartPublished} · {fareDb.metadata.lastConfirmedUnchangedBy}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllSlabs((v) => !v)}
                  className="min-h-[36px] px-3 rounded-xl border border-blue-200 bg-white text-xs font-semibold text-[#0B63E5] hover:bg-[#EAF4FF] whitespace-nowrap shrink-0"
                >
                  {showAllSlabs ? 'Hide 18-Slab Table' : 'View All 18 Slabs (1–500 km)'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <label
                    htmlFor="official-fare-km"
                    className="block text-[11px] font-medium text-slate-600 mb-1"
                  >
                    Journey Distance (km, 1–500)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="official-fare-km"
                      type="number"
                      min={1}
                      max={600}
                      step={1}
                      value={calcDistanceInput}
                      onChange={(e) => setCalcDistanceInput(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white font-mono-num text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B63E5]"
                    />
                    {pathResult?.totalProvisionalKm ? (
                      <button
                        type="button"
                        onClick={() => setCalcDistanceInput(String(pathResult.totalProvisionalKm))}
                        className="min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        Use Route ({pathResult.totalProvisionalKm} km)
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="sm:col-span-7">
                  <span className="block text-[11px] font-medium text-slate-600 mb-1">
                    Passenger Category (Eastern Railway Rule)
                  </span>
                  <div className="grid grid-cols-2 gap-2 bg-white border border-slate-200 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setCalcPassengerType('adult')}
                      className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-colors ${
                        calcPassengerType === 'adult'
                          ? 'bg-[#0B63E5] text-white'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Adult (Full Slab Fare)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcPassengerType('child')}
                      className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-colors ${
                        calcPassengerType === 'child'
                          ? 'bg-[#0B63E5] text-white'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Child 5–11 yrs (½ Fare)
                    </button>
                  </div>
                </div>
              </div>

              {officialCalcResult.valid ? (
                <div className="rounded-xl bg-white border border-blue-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">
                      {calcPassengerType === 'child' ? 'Child Single Fare' : 'Adult Single Fare'}
                    </p>
                    <p className="font-mono-num text-xl font-bold text-[#0B63E5] mt-0.5">
                      ₹ {officialCalcResult.fare}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Matched Distance Slab</p>
                    <p className="font-mono-num text-sm font-bold text-slate-900 mt-1">
                      {officialCalcResult.slab
                        ? `${officialCalcResult.slab.fromKm}–${officialCalcResult.slab.toKm} km`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Adult / Child Rate</p>
                    <p className="font-mono-num text-sm font-bold text-slate-900 mt-1">
                      ₹{officialCalcResult.adultFare} / ₹{officialCalcResult.childFare}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">R-Wallet UTS (3% Off)</p>
                    <p className="font-mono-num text-sm font-bold text-emerald-700 mt-1">
                      ₹ {officialCalcResult.rWalletFare.toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 flex items-start gap-2.5 text-xs text-rose-800"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <p className="font-medium">{officialCalcResult.error}</p>
                </div>
              )}

              <p className="text-[11px] text-slate-500 leading-relaxed">
                {fareDb.fareRules.childAgeRule} {fareDb.fareRules.distanceRule}
              </p>

              {showAllSlabs && (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500">
                        <tr>
                          <th className="py-2 px-3">Distance Slab</th>
                          <th className="py-2 px-3 text-right">Adult II Single</th>
                          <th className="py-2 px-3 text-right">Child II (½ Fare)</th>
                          <th className="py-2 px-3 text-right">R-Wallet Adult</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {fareDb.slabs.map((s) => {
                          const isCurrent =
                            officialCalcResult.valid &&
                            officialCalcResult.slab?.fromKm === s.fromKm &&
                            officialCalcResult.slab?.toKm === s.toKm;
                          return (
                            <tr
                              key={`${s.fromKm}-${s.toKm}`}
                              className={isCurrent ? 'bg-[#EAF4FF] font-semibold' : 'hover:bg-slate-50'}
                            >
                              <td className="py-2 px-3 font-mono-num text-slate-900">
                                {s.fromKm} – {s.toKm} km
                              </td>
                              <td className="py-2 px-3 text-right font-mono-num font-bold text-[#0B63E5]">
                                ₹ {s.adultFareINR}
                              </td>
                              <td className="py-2 px-3 text-right font-mono-num text-slate-800">
                                ₹ {s.adultFareINR / 2}
                              </td>
                              <td className="py-2 px-3 text-right font-mono-num text-emerald-700">
                                ₹ {(s.adultFareINR * 0.97).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FULL STATION CODE & FARE EXPORT MODAL */}
      {showFullCodeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full Kolkata Suburban Station Code & Fare Dataset"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
        >
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0B63E5] text-white px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold">
                  Full Station Code &amp; Fare Directory ({exportRows.length} Stations)
                </h2>
                <p className="text-xs text-blue-100">
                  Origin: {fareOriginStation?.stationName ?? fareFromCode} ({fareFromCode}) · ER, SER, Circular &amp; Metro
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullCodeModal(false)}
                aria-label="Close Full Code Dialog"
                className="h-9 w-9 rounded-xl hover:bg-white/15 flex items-center justify-center shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 bg-[#F8FBFF] border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-xl">
                {(
                  [
                    { id: 'table', label: 'All Stations Table' },
                    { id: 'json', label: 'Full JSON Code' },
                    { id: 'csv', label: 'CSV Code' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setExportTab(t.id)}
                    className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap ${
                      exportTab === t.id
                        ? 'bg-[#0B63E5] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial justify-end">
                <input
                  type="text"
                  value={exportFilter}
                  onChange={(e) => setExportFilter(e.target.value)}
                  placeholder="Filter export..."
                  aria-label="Filter full station export"
                  className="min-h-[36px] px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 w-44"
                />
                <button
                  type="button"
                  onClick={() => void handleCopyFullCode()}
                  className="min-h-[36px] px-3 rounded-xl bg-[#0B63E5] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedCode ? 'Copied' : 'Copy Code'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="min-h-[36px] px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" /> Download JSON
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {exportTab === 'table' ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500">
                    <tr>
                      <th className="py-2 px-2.5">Code</th>
                      <th className="py-2 px-2.5">Station Name</th>
                      <th className="py-2 px-2.5">Zone / Division</th>
                      <th className="py-2 px-2.5 text-right">Km</th>
                      <th className="py-2 px-2.5 text-right">II</th>
                      <th className="py-2 px-2.5 text-right">FC</th>
                      <th className="py-2 px-2.5 text-right">MST II</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExportRows.map((r) => (
                      <tr key={r.stationCode} className="hover:bg-slate-50">
                        <td className="py-2 px-2.5 font-mono-num font-bold text-[#0B63E5]">
                          {r.stationCode}
                        </td>
                        <td className="py-2 px-2.5 font-semibold text-slate-900">
                          {r.stationName}
                        </td>
                        <td className="py-2 px-2.5 text-slate-500">
                          {r.zoneId} · {r.divisionName}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono-num">
                          {r.distanceFromOriginKm ?? '—'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono-num font-bold">
                          {r.fareIISingle !== null ? `₹${r.fareIISingle}` : '—'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono-num">
                          {r.fareFCSingle !== null ? `₹${r.fareFCSingle}` : '—'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono-num text-[#0B63E5]">
                          {r.fareMonthlySeasonII !== null ? `₹${r.fareMonthlySeasonII}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <pre className="text-[11px] font-mono-num bg-slate-950 text-slate-100 p-4 rounded-2xl overflow-x-auto leading-relaxed">
                  {fullExportCodeString}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
