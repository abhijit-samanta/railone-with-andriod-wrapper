export interface SuburbanMetadata {
  datasetName: string;
  version: string;
  generatedOn: string;
  country: string;
  state: string;
  currency: string;
  distanceUnit: string;
  status: string;
  notes: string[];
  dataModel: string;
  importantWarning: string;
  sources: string[];
}

export interface SuburbanRouteStop {
  sequence: number;
  stationCode: string | null;
  stationName: string;
  stationKm: number | null;
}

export interface SuburbanRouteRaw {
  routeId: string;
  routeName: string;
  corridor: string;
  origin: string | null;
  destination: string | null;
  distanceStatus: string;
  dataStatus?: string;
  stations: SuburbanRouteStop[];
  extensionToGoghat?: SuburbanRouteStop[];
}

export interface SuburbanDivisionRaw {
  divisionId: string;
  divisionName: string;
  headquarters?: string;
  routes: SuburbanRouteRaw[];
}

export interface SuburbanZoneRaw {
  zoneId: string;
  zoneName: string;
  divisions: SuburbanDivisionRaw[];
}

export interface SuburbanInterchange {
  stationCode: string;
  connectedRouteIds: string[];
  verificationStatus: string;
}

export interface SuburbanFareRules {
  status: string;
  currency: string;
  amountUnit: string;
  fareTypes: string[];
  classes: string[];
  rules: unknown[];
  calculationPolicy: string;
}

export interface SuburbanStationMaster {
  stationId: string;
  stationCode: string | null;
  stationName: string;
  zoneId: string;
  divisionId: string;
  isJunction: boolean;
  dataStatus: string;
}

export interface TrackSegment {
  fromStationCode: string | null;
  toStationCode: string | null;
  routeId: string;
  distanceKm: number | null;
  distanceStatus: string;
}

export interface SuburbanDataQuality {
  routeCount: number;
  stationMasterCount: number;
  trackSegmentCount: number;
  routeCoverage: string;
  stationKmMeaning: string;
  nullStationCodeMeaning: string;
  nullStationKmMeaning: string;
}

export interface KolkataSuburbanDb {
  metadata: SuburbanMetadata;
  zones: SuburbanZoneRaw[];
  interchanges: SuburbanInterchange[];
  fareRules: SuburbanFareRules;
  stations: SuburbanStationMaster[];
  trackSegments: TrackSegment[];
  dataQuality: SuburbanDataQuality;
}

export interface SuburbanRouteSummary {
  routeId: string;
  routeName: string;
  corridor: string;
  zoneId: string;
  zoneName: string;
  divisionId: string;
  divisionName: string;
  origin: string | null;
  destination: string | null;
  distanceStatus: string;
  dataStatus: string;
  stops: SuburbanRouteStop[];
  extensionToGoghat?: SuburbanRouteStop[];
}

export interface StationRouteMembership {
  routeId: string;
  routeName: string;
  corridor: string;
  sequence: number;
  stationKm: number | null;
  totalRouteStops: number;
  stopNameInRoute: string;
}

export interface AdjacentStopInfo {
  routeId: string;
  routeName: string;
  direction: 'prev' | 'next';
  stationId: string;
  stationCode: string | null;
  stationName: string;
  segmentKm: number | null;
}

export interface IndexedSuburbanStation {
  stationId: string;
  stationCode: string | null;
  displayCode: string;
  stationName: string;
  zoneId: string;
  zoneName: string;
  divisionId: string;
  divisionName: string;
  isJunction: boolean;
  isInterchange: boolean;
  interchangeConnectedRoutes: string[];
  interchangeVerificationStatus: string | null;
  dataStatus: string;
  routes: StationRouteMembership[];
  adjacentStops: AdjacentStopInfo[];
}

export interface SuburbanDivisionSummary {
  divisionId: string;
  divisionName: string;
  zoneId: string;
  zoneName: string;
  headquarters?: string;
  routeCount: number;
  populatedRouteCount: number;
}

export interface SuburbanIndex {
  metadata: SuburbanMetadata;
  fareRules: SuburbanFareRules;
  dataQuality: SuburbanDataQuality;
  zones: Array<{ zoneId: string; zoneName: string }>;
  divisions: SuburbanDivisionSummary[];
  routes: SuburbanRouteSummary[];
  interchanges: SuburbanInterchange[];
  stations: IndexedSuburbanStation[];
  trackSegments: TrackSegment[];
  byKey: Map<string, IndexedSuburbanStation>;
  routeById: Map<string, SuburbanRouteSummary>;
}

export interface SuburbanRouteLeg {
  routeId: string;
  routeName: string;
  corridor: string;
  fromStationName: string;
  fromStationCode: string | null;
  toStationName: string;
  toStationCode: string | null;
  stops: SuburbanRouteStop[];
  provisionalKm: number | null;
  hasUnverifiedKm: boolean;
}

export interface EasternRailwayFareSlab {
  fromKm: number;
  toKm: number;
  adultFareINR: number;
}

export interface EasternRailwaySuburbanFareDb {
  metadata: {
    railway: string;
    service: string;
    ticketType: string;
    class: string;
    currency: string;
    distanceUnit: string;
    fareBasis: string;
    fareChartPublished: string;
    lastConfirmedUnchangedBy: string;
    coverage: {
      minimumDistanceKm: number;
      maximumDistanceKm: number;
      note: string;
    };
    sources: string[];
  };
  fareRules: {
    minimumAdultFareINR: number;
    minimumChargeableFareINR: number;
    childAgeRule: string;
    childFareCalculation: string;
    additionalCharges: {
      reservationFee: number;
      superfastSurcharge: number;
      gst: string;
      bookingAgentCommission: {
        amountINR: number;
        appliesWhen: string;
        includedInBaseFare: boolean;
      };
    };
    rounding: string;
    distanceRule: string;
  };
  slabs: EasternRailwayFareSlab[];
}

export type SuburbanPassengerType = 'adult' | 'child';

export interface SuburbanFareBreakdown {
  distanceKm: number;
  iiSingle: number;
  iiChildSingle: number;
  iiSlabLabel: string;
  iiReturn: number;
  fcSingle: number;
  monthlySeasonII: number;
  rWalletII: number;
  rWalletChildII: number;
  rWalletSavingsII: number;
}

export interface SuburbanPathResult {
  found: boolean;
  kind: 'same-station' | 'direct' | 'interchange' | 'multi-interchange' | 'unavailable';
  fromStation: IndexedSuburbanStation | null;
  toStation: IndexedSuburbanStation | null;
  interchangeStation: IndexedSuburbanStation | null;
  legs: SuburbanRouteLeg[];
  totalProvisionalKm: number | null;
  totalStopCount: number;
  warning: string | null;
}

