import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { RAIL_STATIONS } from '../data/railData.ts';
import type {
  EasternRailwaySuburbanFareDb,
  KolkataSuburbanDb,
} from '../types/suburban.ts';
import { OFFICIAL_ER_SUBURBAN_SECOND_CLASS_FARES } from './easternRailwayFare.ts';
import {
  buildFullStationExportRows,
  buildSuburbanIndex,
  calculateFare,
  calculateSuburbanFareBreakdown,
  computeShortestNetworkDistances,
  fetchStationDetail,
  findSuburbanPath,
  mergeUnifiedStations,
  searchSuburbanStations,
} from './suburbanLogic.ts';

const dbPath = path.resolve(
  process.cwd(),
  'public/assets/aistudio/kolkata_suburban_railway_database_0a0fee1d.json'
);
const farePath = path.resolve(
  process.cwd(),
  'public/assets/aistudio/eastern_railway_suburban_second_class_fares_412194ad.json'
);
const rawDb = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as KolkataSuburbanDb;
const officialFareDb = JSON.parse(
  fs.readFileSync(farePath, 'utf8')
) as EasternRailwaySuburbanFareDb;
const index = buildSuburbanIndex(rawDb);

test('enriches and indexes all 396 map stations, 28 routes, 7 divisions, and 3 zones with zero missing codes', () => {
  assert.equal(index.stations.length, 396);
  assert.equal(index.routes.length, 28);
  assert.equal(index.divisions.length, 7);
  assert.equal(index.zones.length, 3);
  assert.equal(index.fareRules.status, 'suburban_distance_slab_estimator');

  const missingCodes = index.stations.filter((s) => !s.stationCode);
  assert.equal(missingCodes.length, 0);

  // Check unique station codes across entire network
  const seenCodes = new Set<string>();
  for (const s of index.stations) {
    const code = s.stationCode!;
    assert.ok(!seenCodes.has(code), `Duplicate stationCode found: ${code}`);
    seenCodes.add(code);
  }
});

test('assigns official codes to Chord Line stations & searches newly added map stations', () => {
  const belanagarHits = searchSuburbanStations(index, { query: 'Belanagar' });
  assert.equal(belanagarHits.length, 1);
  assert.equal(belanagarHits[0]?.stationCode, 'BZL');
  assert.equal(belanagarHits[0]?.displayCode, 'BZL');

  const hazigarh = fetchStationDetail(index, 'HZG');
  assert.ok(hazigarh);
  assert.equal(hazigarh.stationName, 'Hajigarh');

  const canningHits = searchSuburbanStations(index, { query: 'Canning' });
  assert.equal(canningHits[0]?.stationCode, 'CG');

  const diamondHarbour = searchSuburbanStations(index, { query: 'Diamond Harbour' });
  assert.equal(diamondHarbour[0]?.stationCode, 'DH');

  const amta = searchSuburbanStations(index, { query: 'Amta' });
  assert.equal(amta[0]?.stationCode, 'AMZ');

  const namkhana = searchSuburbanStations(index, { query: 'Namkhana' });
  assert.equal(namkhana[0]?.stationCode, 'NMKA');

  const esplanade = searchSuburbanStations(index, { query: 'Esplanade' });
  assert.equal(esplanade[0]?.stationCode, 'ESP');
  assert.equal(esplanade[0]?.zoneId, 'METRO');
});

test('populates map routes accurately including Hasnabad fix, Sealdah South, Circular, and Metro', () => {
  const btToHnb = findSuburbanPath(index, 'BT', 'HNB');
  assert.equal(btToHnb.found, true);
  assert.equal(btToHnb.kind, 'direct');
  assert.equal(btToHnb.totalProvisionalKm, 52); // 75 - 23 = 52 km
  assert.ok(btToHnb.legs[0]?.stops.some((s) => s.stationCode === 'BSHT'));
  assert.ok(!btToHnb.legs[0]?.stops.some((s) => s.stationCode === 'BNJ'));

  const sdahToCg = findSuburbanPath(index, 'SDAH', 'CG');
  assert.equal(sdahToCg.found, true);
  assert.equal(sdahToCg.kind, 'direct');
  assert.equal(sdahToCg.totalProvisionalKm, 46);

  const sdahToDh = findSuburbanPath(index, 'SDAH', 'DH');
  assert.equal(sdahToDh.found, true);
  assert.equal(sdahToDh.totalProvisionalKm, 60);

  const shmToAmz = findSuburbanPath(index, 'SHM', 'AMZ');
  assert.equal(shmToAmz.found, true);
  assert.equal(shmToAmz.totalProvisionalKm, 44);

  const ddjToMjt = findSuburbanPath(index, 'DDJ', 'MJT');
  assert.equal(ddjToMjt.found, true);
  assert.equal(ddjToMjt.totalProvisionalKm, 21);

  const klnpToStb = findSuburbanPath(index, 'KLNP', 'STB');
  assert.equal(klnpToStb.found, true);
  assert.equal(klnpToStb.totalProvisionalKm, 16); // 94 - 78 = 16 km
});

test('computes suburban distance-slab fares and shortest network distances across all 396 stations', () => {
  const f15 = calculateSuburbanFareBreakdown(15, officialFareDb);
  assert.ok(f15);
  assert.equal(f15.iiSingle, 5);
  assert.equal(f15.iiChildSingle, 2.5);
  assert.equal(f15.iiSlabLabel, '1–20 km');
  assert.equal(f15.iiReturn, 10);
  assert.equal(f15.fcSingle, 45);
  assert.equal(f15.monthlySeasonII, 100);
  assert.equal(f15.rWalletII, 4.85);

  const f60 = calculateSuburbanFareBreakdown(60, officialFareDb);
  assert.ok(f60);
  assert.equal(f60.iiSingle, 15);
  assert.equal(f60.iiChildSingle, 7.5);
  assert.equal(f60.iiSlabLabel, '46–70 km');
  assert.equal(f60.iiReturn, 30);
  assert.equal(f60.fcSingle, 135);
  assert.equal(f60.monthlySeasonII, 255);

  // Verify official ER JSON slab accuracy at 85 km, 145 km, 500 km, and no extrapolation at 501 km
  const f85 = calculateSuburbanFareBreakdown(85, officialFareDb);
  assert.equal(f85?.iiSingle, 25);
  assert.equal(f85?.iiSlabLabel, '81–115 km');

  const f145 = calculateSuburbanFareBreakdown(145, officialFareDb);
  assert.equal(f145?.iiSingle, 35);
  assert.equal(f145?.iiSlabLabel, '141–170 km');

  const f500 = calculateSuburbanFareBreakdown(500, officialFareDb);
  assert.equal(f500?.iiSingle, 90);
  assert.equal(f500?.iiChildSingle, 45);

  assert.equal(calculateSuburbanFareBreakdown(501, officialFareDb), null);

  const distFromSdah = computeShortestNetworkDistances(index, 'SDAH');
  assert.equal(distFromSdah.get('SDAH'), 0);
  assert.equal(distFromSdah.get('CG'), 46);
  assert.equal(distFromSdah.get('DH'), 60);
  assert.equal(distFromSdah.get('BGB'), 26);
  assert.equal(distFromSdah.get('NMKA'), 108);
  assert.equal(distFromSdah.get('ESP'), 17); // SDAH -> DDJ (7) -> DDM (0) -> ESP (10)
  // Verify every station on the network is reachable with a distance
  assert.equal(distFromSdah.size, 396);

  // Multi-leg route between Howrah and Canning connects automatically
  const hwhToCg = findSuburbanPath(index, 'HWH', 'CG');
  assert.equal(hwhToCg.found, true);
  assert.ok((hwhToCg.totalProvisionalKm ?? 0) > 60);

  const exportRows = buildFullStationExportRows(index, 'SDAH');
  assert.equal(exportRows.length, 396);
  assert.ok(exportRows.every((r) => Boolean(r.stationCode) && r.fareIISingle !== null));
});

test('calculateFare matches every official Eastern Railway 1-500 km JSON slab, child half-fare, and error bounds', () => {
  assert.deepEqual(OFFICIAL_ER_SUBURBAN_SECOND_CLASS_FARES.slabs, officialFareDb.slabs);
  assert.equal(officialFareDb.slabs.length, 18);

  for (const slab of officialFareDb.slabs) {
    assert.equal(calculateFare(slab.fromKm, 'adult', officialFareDb), slab.adultFareINR);
    assert.equal(calculateFare(slab.toKm, 'adult', officialFareDb), slab.adultFareINR);
    assert.equal(calculateFare(slab.fromKm, 'child', officialFareDb), slab.adultFareINR / 2);
    assert.equal(calculateFare(slab.toKm, 'child', officialFareDb), slab.adultFareINR / 2);
  }

  assert.throws(() => calculateFare(0, 'adult', officialFareDb), /Invalid journey distance/);
  assert.throws(() => calculateFare(-10, 'adult', officialFareDb), /Invalid journey distance/);
  assert.throws(() => calculateFare(Number.NaN, 'adult', officialFareDb), /Invalid journey distance/);
  assert.throws(
    () => calculateFare(501, 'adult', officialFareDb),
    /Fare not available for this distance/
  );
});

test('merges mainline and all 396 suburban stations cleanly with full station codes', () => {
  const merged = mergeUnifiedStations(RAIL_STATIONS, index);
  assert.ok(merged.length >= 410);
  assert.ok(merged.some((s) => s.code === 'BZL' && s.hasVerifiedCode === true));
  assert.ok(merged.some((s) => s.code === 'CG' && s.hasVerifiedCode === true));
  assert.ok(merged.some((s) => s.code === 'AMZ' && s.hasVerifiedCode === true));
  assert.ok(merged.some((s) => s.code === 'HWH' && s.source === 'both'));
  assert.ok(merged.some((s) => s.code === 'NDLS' && s.source === 'mainline'));
});
