import { enrichSuburbanDatabaseWithMapData } from '../data/kolkataSuburbanMapEnrichment';
import type { Station } from '../types/rail';
import type {
  AdjacentStopInfo,
  EasternRailwaySuburbanFareDb,
  IndexedSuburbanStation,
  KolkataSuburbanDb,
  StationRouteMembership,
  SuburbanDivisionSummary,
  SuburbanFareBreakdown,
  SuburbanIndex,
  SuburbanPathResult,
  SuburbanRouteLeg,
  SuburbanRouteStop,
  SuburbanRouteSummary,
} from '../types/suburban';
import {
  calculateFare,
  findEasternRailwaySlab,
  getOfficialEasternRailwayFareDb,
  setOfficialEasternRailwayFareDb,
} from './easternRailwayFare';

export {
  calculateFare,
  findEasternRailwaySlab,
  getOfficialEasternRailwayFareDb,
  setOfficialEasternRailwayFareDb,
};

function findMasterStationForStop(
  stop: SuburbanRouteStop,
  byNameLower: Map<string, IndexedSuburbanStation>,
  byCode: Map<string, IndexedSuburbanStation>
): IndexedSuburbanStation | undefined {
  const stopNameLower = stop.stationName.trim().toLowerCase();
  const byName = byNameLower.get(stopNameLower);
  if (byName) return byName;
  if (stop.stationCode) {
    const candidate = byCode.get(stop.stationCode.trim().toUpperCase());
    if (
      candidate &&
      (candidate.stationName.trim().toLowerCase().includes(stopNameLower) ||
        stopNameLower.includes(candidate.stationName.trim().toLowerCase()))
    ) {
      return candidate;
    }
  }
  return undefined;
}

function findStopIndexInRoute(
  stops: SuburbanRouteStop[],
  station: IndexedSuburbanStation
): number {
  const nameLower = station.stationName.trim().toLowerCase();
  const byNameIdx = stops.findIndex(
    (s) => s.stationName.trim().toLowerCase() === nameLower
  );
  if (byNameIdx !== -1) return byNameIdx;
  if (station.stationCode) {
    const codeUpper = station.stationCode.trim().toUpperCase();
    return stops.findIndex((s) => {
      if (!s.stationCode || s.stationCode.trim().toUpperCase() !== codeUpper) {
        return false;
      }
      const sName = s.stationName.trim().toLowerCase();
      return sName.includes(nameLower) || nameLower.includes(sName);
    });
  }
  return -1;
}

function buildLeg(
  route: SuburbanRouteSummary,
  stops: SuburbanRouteStop[],
  fromIdx: number,
  toIdx: number
): SuburbanRouteLeg {
  const orderedStops =
    fromIdx <= toIdx
      ? stops.slice(fromIdx, toIdx + 1)
      : stops.slice(toIdx, fromIdx + 1).reverse();

  const startStop = stops[fromIdx];
  const endStop = stops[toIdx];
  const hasNumericKm =
    typeof startStop.stationKm === 'number' && typeof endStop.stationKm === 'number';
  const provisionalKm = hasNumericKm
    ? Math.abs((endStop.stationKm as number) - (startStop.stationKm as number))
    : null;

  return {
    routeId: route.routeId,
    routeName: route.routeName,
    corridor: route.corridor,
    fromStationName: startStop.stationName,
    fromStationCode: startStop.stationCode,
    toStationName: endStop.stationName,
    toStationCode: endStop.stationCode,
    stops: orderedStops,
    provisionalKm,
    hasUnverifiedKm: provisionalKm === null,
  };
}

export function buildSuburbanIndex(rawDb: KolkataSuburbanDb): SuburbanIndex {
  const db = enrichSuburbanDatabaseWithMapData(rawDb);
  const zones: Array<{ zoneId: string; zoneName: string }> = [];
  const zoneNameById = new Map<string, string>();
  const divisionById = new Map<string, SuburbanDivisionSummary>();
  const divisions: SuburbanDivisionSummary[] = [];
  const routes: SuburbanRouteSummary[] = [];
  const routeById = new Map<string, SuburbanRouteSummary>();

  for (const z of db.zones) {
    zones.push({ zoneId: z.zoneId, zoneName: z.zoneName });
    zoneNameById.set(z.zoneId, z.zoneName);

    for (const d of z.divisions) {
      let populatedCount = 0;
      for (const r of d.routes) {
        const isPopulated = r.stations.length > 0;
        if (isPopulated) populatedCount += 1;
        const summary: SuburbanRouteSummary = {
          routeId: r.routeId,
          routeName: r.routeName,
          corridor: r.corridor,
          zoneId: z.zoneId,
          zoneName: z.zoneName,
          divisionId: d.divisionId,
          divisionName: d.divisionName,
          origin: r.origin,
          destination: r.destination,
          distanceStatus: r.distanceStatus,
          dataStatus: r.dataStatus ?? (isPopulated ? 'populated' : 'pending_verification'),
          stops: r.stations,
          extensionToGoghat: r.extensionToGoghat,
        };
        routes.push(summary);
        routeById.set(summary.routeId, summary);
      }

      const divSummary: SuburbanDivisionSummary = {
        divisionId: d.divisionId,
        divisionName: d.divisionName,
        zoneId: z.zoneId,
        zoneName: z.zoneName,
        headquarters: d.headquarters,
        routeCount: d.routes.length,
        populatedRouteCount: populatedCount,
      };
      divisions.push(divSummary);
      divisionById.set(d.divisionId, divSummary);
    }
  }

  const interchangeByCode = new Map(
    db.interchanges.map((ic) => [ic.stationCode.toUpperCase(), ic])
  );

  // Build segment lookup for routes where cumulative stationKm is null
  const segmentDistanceMap = new Map<string, number>();
  for (const seg of db.trackSegments) {
    if (seg.fromStationCode && seg.toStationCode && typeof seg.distanceKm === 'number') {
      const k1 = `${seg.routeId}:${seg.fromStationCode.toUpperCase()}->${seg.toStationCode.toUpperCase()}`;
      const k2 = `${seg.routeId}:${seg.toStationCode.toUpperCase()}->${seg.fromStationCode.toUpperCase()}`;
      segmentDistanceMap.set(k1, seg.distanceKm);
      segmentDistanceMap.set(k2, seg.distanceKm);
    }
  }

  const stations: IndexedSuburbanStation[] = [];
  const byKey = new Map<string, IndexedSuburbanStation>();
  const byCode = new Map<string, IndexedSuburbanStation>();
  const byNameLower = new Map<string, IndexedSuburbanStation>();

  for (const st of db.stations) {
    const codeUpper = st.stationCode ? st.stationCode.trim().toUpperCase() : null;
    const ic = codeUpper ? interchangeByCode.get(codeUpper) : undefined;
    const divInfo = divisionById.get(st.divisionId);
    const indexed: IndexedSuburbanStation = {
      stationId: st.stationId,
      stationCode: codeUpper,
      displayCode: codeUpper ?? 'NO CODE',
      stationName: st.stationName,
      zoneId: st.zoneId,
      zoneName: zoneNameById.get(st.zoneId) ?? st.zoneId,
      divisionId: st.divisionId,
      divisionName: divInfo?.divisionName ?? st.divisionId,
      isJunction: st.isJunction,
      isInterchange: Boolean(ic),
      interchangeConnectedRoutes: ic ? ic.connectedRouteIds : [],
      interchangeVerificationStatus: ic ? ic.verificationStatus : null,
      dataStatus: st.dataStatus,
      routes: [],
      adjacentStops: [],
    };
    stations.push(indexed);

    byKey.set(indexed.stationId.toLowerCase(), indexed);
    byKey.set(indexed.stationName.trim().toLowerCase(), indexed);
    byNameLower.set(indexed.stationName.trim().toLowerCase(), indexed);
    if (codeUpper) {
      byCode.set(codeUpper, indexed);
      byKey.set(codeUpper.toLowerCase(), indexed);
    }
  }

  // Enrich stations with route memberships & adjacent stops
  for (const route of routes) {
    const stops = route.stops;
    for (let i = 0; i < stops.length; i += 1) {
      const stop = stops[i];
      const master = findMasterStationForStop(stop, byNameLower, byCode);
      if (!master) continue;

      const membership: StationRouteMembership = {
        routeId: route.routeId,
        routeName: route.routeName,
        corridor: route.corridor,
        sequence: stop.sequence,
        stationKm: stop.stationKm,
        totalRouteStops: stops.length,
        stopNameInRoute: stop.stationName,
      };
      if (!master.routes.some((m) => m.routeId === route.routeId)) {
        master.routes.push(membership);
      }

      const addAdj = (otherStop: SuburbanRouteStop, direction: 'prev' | 'next') => {
        const otherMaster = findMasterStationForStop(otherStop, byNameLower, byCode);
        let segmentKm: number | null = null;
        if (typeof stop.stationKm === 'number' && typeof otherStop.stationKm === 'number') {
          segmentKm = Math.abs(otherStop.stationKm - stop.stationKm);
        } else if (stop.stationCode && otherStop.stationCode) {
          const segKey = `${route.routeId}:${stop.stationCode.toUpperCase()}->${otherStop.stationCode.toUpperCase()}`;
          segmentKm = segmentDistanceMap.get(segKey) ?? null;
        }
        const adj: AdjacentStopInfo = {
          routeId: route.routeId,
          routeName: route.routeName,
          direction,
          stationId: otherMaster?.stationId ?? otherStop.stationCode ?? otherStop.stationName,
          stationCode: otherStop.stationCode,
          stationName: otherStop.stationName,
          segmentKm,
        };
        const dup = master.adjacentStops.some(
          (a) =>
            a.routeId === adj.routeId &&
            a.direction === adj.direction &&
            a.stationId === adj.stationId
        );
        if (!dup) {
          master.adjacentStops.push(adj);
        }
      };

      if (i > 0) addAdj(stops[i - 1], 'prev');
      if (i < stops.length - 1) addAdj(stops[i + 1], 'next');
    }
  }

  const resultIndex: SuburbanIndex = {
    metadata: db.metadata,
    fareRules: db.fareRules,
    dataQuality: db.dataQuality,
    zones,
    divisions,
    routes,
    interchanges: db.interchanges,
    stations,
    trackSegments: db.trackSegments,
    byKey,
    routeById,
  };

  return resultIndex;
}

/**
 * Computes Indian Railways Kolkata Suburban distance-slab fare estimates
 * using the official Eastern Railway Second Class Ordinary fare chart (1–500 km)
 * for Adult & Child (half fare), Return (II), First Class (FC), Monthly MST (II),
 * and 3% R-Wallet UTS discount. Never extrapolates beyond 500 km.
 */
export function calculateSuburbanFareBreakdown(
  distanceKm: number | null,
  fareDb: EasternRailwaySuburbanFareDb = getOfficialEasternRailwayFareDb()
): SuburbanFareBreakdown | null {
  if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm < 0) return null;
  const km = Math.round(distanceKm);
  if (km === 0) {
    return {
      distanceKm: 0,
      iiSingle: 0,
      iiChildSingle: 0,
      iiSlabLabel: '0 km',
      iiReturn: 0,
      fcSingle: 0,
      monthlySeasonII: 0,
      rWalletII: 0,
      rWalletChildII: 0,
      rWalletSavingsII: 0,
    };
  }

  const slab = findEasternRailwaySlab(km, fareDb);
  if (!slab) {
    // Official chart covers 1–500 km; do not extrapolate beyond 500 km.
    return null;
  }

  const iiSingle = calculateFare(km, 'adult', fareDb);
  const iiChildSingle = calculateFare(km, 'child', fareDb);
  const iiSlabLabel = `${slab.fromKm}–${slab.toKm} km`;

  let fcSingle = 35;
  if (km <= 10) fcSingle = 35;
  else if (km <= 15) fcSingle = 45;
  else if (km <= 20) fcSingle = 55;
  else if (km <= 30) fcSingle = 75;
  else if (km <= 45) fcSingle = 95;
  else if (km <= 55) fcSingle = 115;
  else if (km <= 70) fcSingle = 135;
  else if (km <= 95) fcSingle = 155;
  else if (km <= 120) fcSingle = 185;
  else if (km <= 150) fcSingle = 215;
  else fcSingle = 215 + Math.ceil((km - 150) / 30) * 25;

  let monthlySeasonII = 100;
  if (km <= 15) monthlySeasonII = 100;
  else if (km <= 20) monthlySeasonII = 125;
  else if (km <= 45) monthlySeasonII = 185;
  else if (km <= 70) monthlySeasonII = 255;
  else if (km <= 95) monthlySeasonII = 325;
  else if (km <= 120) monthlySeasonII = 395;
  else monthlySeasonII = 395 + Math.ceil((km - 120) / 25) * 60;

  const iiReturn = iiSingle * 2;
  const rWalletII = Number((iiSingle * 0.97).toFixed(2));
  const rWalletChildII = Number((iiChildSingle * 0.97).toFixed(2));
  const rWalletSavingsII = Number((iiSingle - rWalletII).toFixed(2));

  return {
    distanceKm: km,
    iiSingle,
    iiChildSingle,
    iiSlabLabel,
    iiReturn,
    fcSingle,
    monthlySeasonII,
    rWalletII,
    rWalletChildII,
    rWalletSavingsII,
  };
}

interface GraphEdge {
  toStationId: string;
  weightKm: number;
  routeId: string;
  fromIdx: number;
  toIdx: number;
  isPedestrianTransfer?: boolean;
}

function buildStationGraph(index: SuburbanIndex): Map<string, GraphEdge[]> {
  const adj = new Map<string, GraphEdge[]>();
  const pushEdge = (fromId: string, edge: GraphEdge) => {
    const arr = adj.get(fromId);
    if (arr) arr.push(edge);
    else adj.set(fromId, [edge]);
  };

  const stationByLookup = new Map<string, IndexedSuburbanStation>();
  for (const st of index.stations) {
    stationByLookup.set(st.stationName.trim().toLowerCase(), st);
    if (st.stationCode) {
      stationByLookup.set(st.stationCode.trim().toUpperCase(), st);
    }
  }

  const resolveStop = (stop: SuburbanRouteStop): IndexedSuburbanStation | undefined => {
    const byName = stationByLookup.get(stop.stationName.trim().toLowerCase());
    if (byName) return byName;
    if (stop.stationCode) return stationByLookup.get(stop.stationCode.trim().toUpperCase());
    return undefined;
  };

  for (const route of index.routes) {
    if (route.stops.length < 2) continue;
    for (let i = 0; i < route.stops.length - 1; i += 1) {
      const sA = route.stops[i];
      const sB = route.stops[i + 1];
      const stA = resolveStop(sA);
      const stB = resolveStop(sB);
      if (!stA || !stB || stA.stationId === stB.stationId) continue;

      const km =
        typeof sA.stationKm === 'number' && typeof sB.stationKm === 'number'
          ? Math.max(1, Math.abs(sB.stationKm - sA.stationKm))
          : 4;

      pushEdge(stA.stationId, {
        toStationId: stB.stationId,
        weightKm: km,
        routeId: route.routeId,
        fromIdx: i,
        toIdx: i + 1,
      });
      pushEdge(stB.stationId, {
        toStationId: stA.stationId,
        weightKm: km,
        routeId: route.routeId,
        fromIdx: i + 1,
        toIdx: i,
      });
    }
  }

  // Foot-overbridge / station-complex links shown directly on the Kolkata Suburban Map
  const bridgePairs: Array<[string, string, number]> = [
    ['DDJ', 'DDM', 0], // Dum Dum Rail <-> Dum Dum Metro
    ['TLG', 'TLGM', 0], // Tollygunge Circular <-> Tollygunge Metro
    ['BLY', 'BLYH', 1], // Bally Main <-> Bally Halt Cord
  ];
  for (const [codeA, codeB, km] of bridgePairs) {
    const a = index.byKey.get(codeA.toLowerCase());
    const b = index.byKey.get(codeB.toLowerCase());
    if (a && b) {
      pushEdge(a.stationId, {
        toStationId: b.stationId,
        weightKm: km,
        routeId: '__TRANSFER__',
        fromIdx: 0,
        toIdx: 0,
        isPedestrianTransfer: true,
      });
      pushEdge(b.stationId, {
        toStationId: a.stationId,
        weightKm: km,
        routeId: '__TRANSFER__',
        fromIdx: 0,
        toIdx: 0,
        isPedestrianTransfer: true,
      });
    }
  }

  return adj;
}

/**
 * Computes shortest network rail distance (km) from a given origin station
 * to every reachable station across ER, SER, Circular, and Metro lines.
 */
export function computeShortestNetworkDistances(
  index: SuburbanIndex,
  originKey: string
): Map<string, number> {
  const distances = new Map<string, number>();
  const origin = fetchStationDetail(index, originKey);
  if (!origin) return distances;

  const adj = buildStationGraph(index);
  const visited = new Set<string>();
  const queue: Array<{ stationId: string; dist: number }> = [
    { stationId: origin.stationId, dist: 0 },
  ];
  distances.set(origin.stationId, 0);

  while (queue.length > 0) {
    queue.sort((a, b) => a.dist - b.dist);
    const current = queue.shift()!;
    if (visited.has(current.stationId)) continue;
    visited.add(current.stationId);

    const neighbors = adj.get(current.stationId) ?? [];
    for (const edge of neighbors) {
      const nextDist = current.dist + edge.weightKm;
      const existing = distances.get(edge.toStationId);
      if (existing === undefined || nextDist < existing) {
        distances.set(edge.toStationId, nextDist);
        queue.push({ stationId: edge.toStationId, dist: nextDist });
      }
    }
  }

  return distances;
}

export interface StationSearchFilter {
  query?: string;
  zoneId?: string;
  divisionId?: string;
  routeId?: string;
  junctionsOnly?: boolean;
  interchangesOnly?: boolean;
  limit?: number;
}

export function searchSuburbanStations(
  index: SuburbanIndex,
  filter: StationSearchFilter = {}
): IndexedSuburbanStation[] {
  const q = (filter.query ?? '').trim().toLowerCase();
  const routeSequenceMap = new Map<string, number>();

  if (filter.routeId) {
    const r = index.routeById.get(filter.routeId);
    if (r) {
      r.stops.forEach((st, idx) => {
        routeSequenceMap.set(st.stationName.trim().toLowerCase(), idx);
        if (st.stationCode) {
          routeSequenceMap.set(st.stationCode.trim().toUpperCase(), idx);
        }
      });
    }
  }

  const scored: Array<{ station: IndexedSuburbanStation; score: number }> = [];

  for (const st of index.stations) {
    if (filter.zoneId && filter.zoneId !== 'ALL' && st.zoneId !== filter.zoneId) continue;
    if (
      filter.divisionId &&
      filter.divisionId !== 'ALL' &&
      st.divisionId !== filter.divisionId
    ) {
      continue;
    }
    if (filter.routeId && filter.routeId !== 'ALL') {
      const inRoute =
        st.routes.some((r) => r.routeId === filter.routeId) ||
        st.interchangeConnectedRoutes.includes(filter.routeId);
      if (!inRoute) continue;
    }
    if (filter.junctionsOnly && !st.isJunction) continue;
    if (filter.interchangesOnly && !st.isInterchange) continue;

    if (!q) {
      scored.push({ station: st, score: 1 });
      continue;
    }

    const codeLower = (st.stationCode ?? '').toLowerCase();
    const idLower = st.stationId.toLowerCase();
    const nameLower = st.stationName.toLowerCase();
    const divLower = st.divisionName.toLowerCase();
    const zoneLower = st.zoneName.toLowerCase();

    let score = 0;
    if (codeLower && codeLower === q) {
      score = 100;
    } else if (idLower === q || nameLower === q) {
      score = 95;
    } else if (codeLower && codeLower.startsWith(q)) {
      score = 88;
    } else if (nameLower.startsWith(q) || idLower.startsWith(q)) {
      score = 82;
    } else if (nameLower.includes(` ${q}`) || nameLower.includes(`-${q}`)) {
      score = 72;
    } else if (nameLower.includes(q) || codeLower.includes(q) || idLower.includes(q)) {
      score = 58;
    } else if (
      divLower.includes(q) ||
      zoneLower.includes(q) ||
      st.routes.some(
        (r) =>
          r.routeName.toLowerCase().includes(q) || r.corridor.toLowerCase().includes(q)
      )
    ) {
      score = 35;
    }

    if (score > 0) {
      // Slight priority boost for interchanges & junctions on tie
      const tieBonus = (st.isInterchange ? 2 : 0) + (st.isJunction ? 1 : 0);
      scored.push({ station: st, score: score + tieBonus * 0.1 });
    }
  }

  scored.sort((a, b) => {
    if (!q && filter.routeId && filter.routeId !== 'ALL') {
      const idxA =
        routeSequenceMap.get(a.station.stationName.trim().toLowerCase()) ??
        (a.station.stationCode ? routeSequenceMap.get(a.station.stationCode) : undefined) ??
        9999;
      const idxB =
        routeSequenceMap.get(b.station.stationName.trim().toLowerCase()) ??
        (b.station.stationCode ? routeSequenceMap.get(b.station.stationCode) : undefined) ??
        9999;
      if (idxA !== idxB) return idxA - idxB;
    }
    if (b.score !== a.score) return b.score - a.score;
    return a.station.stationName.localeCompare(b.station.stationName);
  });

  const result = scored.map((s) => s.station);
  return typeof filter.limit === 'number' && filter.limit > 0
    ? result.slice(0, filter.limit)
    : result;
}

export function fetchStationDetail(
  index: SuburbanIndex,
  stationKey: string
): IndexedSuburbanStation | null {
  const key = stationKey.trim().toLowerCase();
  if (!key) return null;
  return index.byKey.get(key) ?? null;
}

export function findSuburbanPath(
  index: SuburbanIndex,
  fromKey: string,
  toKey: string
): SuburbanPathResult {
  const fromStation = fetchStationDetail(index, fromKey);
  const toStation = fetchStationDetail(index, toKey);

  if (!fromStation || !toStation) {
    return {
      found: false,
      kind: 'unavailable',
      fromStation,
      toStation,
      interchangeStation: null,
      legs: [],
      totalProvisionalKm: null,
      totalStopCount: 0,
      warning: 'One or both selected stations were not found in the suburban database.',
    };
  }

  if (fromStation.stationId === toStation.stationId) {
    return {
      found: true,
      kind: 'same-station',
      fromStation,
      toStation,
      interchangeStation: null,
      legs: [],
      totalProvisionalKm: 0,
      totalStopCount: 1,
      warning: null,
    };
  }

  const populatedRoutes = index.routes.filter((r) => r.stops.length > 0);

  // 1. Check direct routes containing both stations
  const directCandidates: SuburbanRouteLeg[] = [];
  for (const route of populatedRoutes) {
    const fromIdx = findStopIndexInRoute(route.stops, fromStation);
    const toIdx = findStopIndexInRoute(route.stops, toStation);
    if (fromIdx !== -1 && toIdx !== -1) {
      directCandidates.push(buildLeg(route, route.stops, fromIdx, toIdx));
    }
  }

  if (directCandidates.length > 0) {
    directCandidates.sort((a, b) => {
      if (a.provisionalKm !== null && b.provisionalKm !== null) {
        return a.provisionalKm - b.provisionalKm;
      }
      return a.stops.length - b.stops.length;
    });
    const best = directCandidates[0];
    return {
      found: true,
      kind: 'direct',
      fromStation,
      toStation,
      interchangeStation: null,
      legs: [best],
      totalProvisionalKm: best.provisionalKm,
      totalStopCount: best.stops.length,
      warning: best.hasUnverifiedKm
        ? index.dataQuality.nullStationKmMeaning
        : index.dataQuality.stationKmMeaning,
    };
  }

  // 2. Check 1-transfer paths through interchanges & junctions
  const transferCandidates: Array<{
    hub: IndexedSuburbanStation;
    leg1: SuburbanRouteLeg;
    leg2: SuburbanRouteLeg;
    totalStops: number;
    totalKm: number | null;
  }> = [];

  const hubStations = index.stations.filter((s) => s.isInterchange || s.isJunction);

  for (const hub of hubStations) {
    if (hub.stationId === fromStation.stationId || hub.stationId === toStation.stationId) {
      continue;
    }

    let bestLeg1: SuburbanRouteLeg | null = null;
    let bestLeg2: SuburbanRouteLeg | null = null;

    for (const r of populatedRoutes) {
      const fIdx = findStopIndexInRoute(r.stops, fromStation);
      const hIdx = findStopIndexInRoute(r.stops, hub);
      if (fIdx !== -1 && hIdx !== -1) {
        const leg = buildLeg(r, r.stops, fIdx, hIdx);
        if (!bestLeg1 || leg.stops.length < bestLeg1.stops.length) {
          bestLeg1 = leg;
        }
      }

      const hIdx2 = findStopIndexInRoute(r.stops, hub);
      const tIdx = findStopIndexInRoute(r.stops, toStation);
      if (hIdx2 !== -1 && tIdx !== -1) {
        const leg = buildLeg(r, r.stops, hIdx2, tIdx);
        if (!bestLeg2 || leg.stops.length < bestLeg2.stops.length) {
          bestLeg2 = leg;
        }
      }
    }

    if (bestLeg1 && bestLeg2) {
      const totalKm =
        bestLeg1.provisionalKm !== null && bestLeg2.provisionalKm !== null
          ? bestLeg1.provisionalKm + bestLeg2.provisionalKm
          : null;
      transferCandidates.push({
        hub,
        leg1: bestLeg1,
        leg2: bestLeg2,
        totalStops: bestLeg1.stops.length + bestLeg2.stops.length - 1,
        totalKm,
      });
    }
  }

  if (transferCandidates.length > 0) {
    transferCandidates.sort((a, b) => {
      // Prefer declared interchange hubs, then fewer stops
      if (a.hub.isInterchange !== b.hub.isInterchange) {
        return a.hub.isInterchange ? -1 : 1;
      }
      if (a.totalKm !== null && b.totalKm !== null && a.totalKm !== b.totalKm) {
        return a.totalKm - b.totalKm;
      }
      return a.totalStops - b.totalStops;
    });

    const best = transferCandidates[0];
    return {
      found: true,
      kind: 'interchange',
      fromStation,
      toStation,
      interchangeStation: best.hub,
      legs: [best.leg1, best.leg2],
      totalProvisionalKm: best.totalKm,
      totalStopCount: best.totalStops,
      warning:
        best.totalKm === null
          ? index.dataQuality.nullStationKmMeaning
          : `Requires interchange at ${best.hub.stationName} (${best.hub.displayCode}). ${index.dataQuality.stationKmMeaning}`,
    };
  }

  // 3. Multi-transfer shortest network path fallback via Dijkstra
  const adj = buildStationGraph(index);
  const dist = new Map<string, number>();
  const prev = new Map<string, { fromId: string; edge: GraphEdge }>();
  const visited = new Set<string>();
  const pq: Array<{ id: string; cost: number }> = [{ id: fromStation.stationId, cost: 0 }];
  dist.set(fromStation.stationId, 0);

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const cur = pq.shift()!;
    if (visited.has(cur.id)) continue;
    visited.add(cur.id);
    if (cur.id === toStation.stationId) break;

    for (const edge of adj.get(cur.id) ?? []) {
      const nextCost = cur.cost + edge.weightKm + (edge.isPedestrianTransfer ? 0.5 : 0);
      if (dist.get(edge.toStationId) === undefined || nextCost < dist.get(edge.toStationId)!) {
        dist.set(edge.toStationId, nextCost);
        prev.set(edge.toStationId, { fromId: cur.id, edge });
        pq.push({ id: edge.toStationId, cost: nextCost });
      }
    }
  }

  if (prev.has(toStation.stationId)) {
    const chain: Array<{ fromId: string; edge: GraphEdge }> = [];
    let curr = toStation.stationId;
    while (curr !== fromStation.stationId) {
      const step = prev.get(curr);
      if (!step) break;
      chain.push(step);
      curr = step.fromId;
    }
    chain.reverse();

    // Group consecutive edges sharing the same routeId into SuburbanRouteLegs
    const legs: SuburbanRouteLeg[] = [];
    let i = 0;
    while (i < chain.length) {
      const first = chain[i];
      if (first.edge.isPedestrianTransfer) {
        i += 1;
        continue;
      }
      const route = index.routeById.get(first.edge.routeId);
      if (!route) {
        i += 1;
        continue;
      }
      const startIdx = first.edge.fromIdx;
      let endIdx = first.edge.toIdx;
      while (
        i + 1 < chain.length &&
        !chain[i + 1].edge.isPedestrianTransfer &&
        chain[i + 1].edge.routeId === first.edge.routeId
      ) {
        i += 1;
        endIdx = chain[i].edge.toIdx;
      }
      legs.push(buildLeg(route, route.stops, startIdx, endIdx));
      i += 1;
    }

    if (legs.length > 0) {
      const totalKm = legs.every((l) => l.provisionalKm !== null)
        ? legs.reduce((acc, l) => acc + (l.provisionalKm ?? 0), 0)
        : null;
      const totalStopCount =
        legs.reduce((acc, l) => acc + l.stops.length, 0) - Math.max(0, legs.length - 1);
      const firstInterchange =
        legs.length > 1 ? fetchStationDetail(index, legs[0].toStationName) : null;

      return {
        found: true,
        kind: legs.length === 1 ? 'direct' : legs.length === 2 ? 'interchange' : 'multi-interchange',
        fromStation,
        toStation,
        interchangeStation: firstInterchange,
        legs,
        totalProvisionalKm: totalKm,
        totalStopCount,
        warning: `Multi-corridor route across ${legs.length} lines via ${legs
          .slice(0, -1)
          .map((l) => `${l.toStationName} (${l.toStationCode ?? 'Junction'})`)
          .join(' → ')}. Distances & fares are based on map km slabs.`,
      };
    }
  }

  return {
    found: false,
    kind: 'unavailable',
    fromStation,
    toStation,
    interchangeStation: null,
    legs: [],
    totalProvisionalKm: null,
    totalStopCount: 0,
    warning:
      'No populated corridor path connects these stations yet. Some corridors in the dataset are marked pending verification.',
  };
}

export interface FullStationExportRow {
  stationCode: string;
  stationName: string;
  zoneId: string;
  divisionName: string;
  isJunction: boolean;
  corridors: string[];
  distanceFromOriginKm: number | null;
  fareIISingle: number | null;
  fareIIReturn: number | null;
  fareFCSingle: number | null;
  fareMonthlySeasonII: number | null;
}

export function buildFullStationExportRows(
  index: SuburbanIndex,
  originKey = 'SDAH'
): FullStationExportRow[] {
  const distances = computeShortestNetworkDistances(index, originKey);
  return index.stations.map((st) => {
    const dist = distances.get(st.stationId) ?? null;
    const fare = calculateSuburbanFareBreakdown(dist);
    return {
      stationCode: st.stationCode ?? st.stationId,
      stationName: st.stationName,
      zoneId: st.zoneId,
      divisionName: st.divisionName,
      isJunction: st.isJunction,
      corridors: st.routes.map((r) => r.routeName),
      distanceFromOriginKm: fare ? fare.distanceKm : null,
      fareIISingle: fare ? fare.iiSingle : null,
      fareIIReturn: fare ? fare.iiReturn : null,
      fareFCSingle: fare ? fare.fcSingle : null,
      fareMonthlySeasonII: fare ? fare.monthlySeasonII : null,
    };
  });
}

export function mergeUnifiedStations(
  mainlineStations: Station[],
  suburbanIndex: SuburbanIndex | null
): Station[] {
  if (!suburbanIndex) {
    return mainlineStations.map((s) => ({
      ...s,
      stationId: s.code,
      hasVerifiedCode: true,
      source: 'mainline',
    }));
  }

  const byKey = new Map<string, Station>();

  for (const m of mainlineStations) {
    byKey.set(m.code.toUpperCase(), {
      ...m,
      stationId: m.code,
      hasVerifiedCode: true,
      source: 'mainline',
    });
  }

  for (const sub of suburbanIndex.stations) {
    const pickerKey = (sub.stationCode ?? sub.stationId).toUpperCase();
    const existing = sub.stationCode ? byKey.get(sub.stationCode.toUpperCase()) : undefined;
    if (existing) {
      byKey.set(pickerKey, {
        ...existing,
        name: sub.stationName.toUpperCase(),
        zone: sub.zoneId,
        stationId: sub.stationId,
        divisionId: sub.divisionId,
        divisionName: sub.divisionName,
        isJunction: sub.isJunction,
        isInterchange: sub.isInterchange,
        hasVerifiedCode: true,
        source: 'both',
      });
    } else {
      byKey.set(pickerKey, {
        code: pickerKey,
        name: sub.stationName.toUpperCase(),
        city: sub.divisionName,
        zone: sub.zoneId,
        stationId: sub.stationId,
        divisionId: sub.divisionId,
        divisionName: sub.divisionName,
        isJunction: sub.isJunction,
        isInterchange: sub.isInterchange,
        hasVerifiedCode: Boolean(sub.stationCode),
        source: 'kolkata-suburban',
      });
    }
  }

  return Array.from(byKey.values());
}
