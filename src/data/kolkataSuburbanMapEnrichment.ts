import type {
  KolkataSuburbanDb,
  SuburbanInterchange,
  SuburbanRouteRaw,
  SuburbanRouteStop,
  SuburbanStationMaster,
} from '../types/suburban';

/**
 * Official/standard ER station codes for the 17 Chord Line stations
 * left as `null` in the starter JSON, plus Hajigarh (`HZG`) which
 * collided with Hooghly (`HGY`).
 */
export const CHORD_STATION_CODE_UPDATES: Record<string, string> = {
  belanagar: 'BZL',
  gobra: 'GBRA',
  janai_road: 'JOX',
  begampur: 'BPAE',
  baruipara: 'BRPA',
  'mirzapur-bankipur': 'MBE',
  balarambati: 'BLAE',
  madhusudanpur: 'MDSE',
  porabazar: 'PBZ',
  dhaniakhali: 'DHKH',
  cheragram: 'CGAE',
  gurap: 'GRAE',
  jhapandanga: 'JPQ',
  jaugram: 'JRAE',
  nabagram: 'NBAE',
  chanchai: 'CHC',
  palla_road: 'PRAE',
};

function makeStop(
  sequence: number,
  stationCode: string,
  stationName: string,
  stationKm: number
): SuburbanRouteStop {
  return { sequence, stationCode, stationName, stationKm };
}

function makeStation(
  stationCode: string,
  stationName: string,
  zoneId: string,
  divisionId: string,
  isJunction = false
): SuburbanStationMaster {
  return {
    stationId: stationCode,
    stationCode,
    stationName,
    zoneId,
    divisionId,
    isJunction,
    dataStatus: 'map_verified_provisional',
  };
}

/**
 * Complete list of stations extracted from `kolkata_suburban_map.jpg`
 * (Eastern Railway, South Eastern Railway, Circular Railway, Metro Railway)
 * that were missing from the starter JSON's 237-station master list.
 */
export const MAP_EXTRA_STATIONS: SuburbanStationMaster[] = [
  // ER_HWH - Belur Math & Hajigarh
  makeStation('BRMH', 'Belur Math', 'ER', 'ER_HWH', false),
  makeStation('HZG', 'Hajigarh', 'ER', 'ER_HWH', false),

  // ER_SDAH - Ranaghat - Krishnanagar
  makeStation('KLNP', 'Kalinarayanpur Junction', 'ER', 'ER_SDAH', true),
  makeStation('BIJ', 'Birnagar', 'ER', 'ER_SDAH', false),
  makeStation('THP', 'Taherpur', 'ER', 'ER_SDAH', false),
  makeStation('BDZ', 'Badkulla', 'ER', 'ER_SDAH', false),
  makeStation('JLK', 'Jalalkhali', 'ER', 'ER_SDAH', false),
  makeStation('KNJ', 'Krishnanagar City Junction', 'ER', 'ER_SDAH', true),

  // ER_SDAH - Kalinarayanpur - Shantipur
  makeStation('HBP', 'Habibpur', 'ER', 'ER_SDAH', false),
  makeStation('FLU', 'Phulia', 'ER', 'ER_SDAH', false),
  makeStation('BTKB', 'Bathna Krittibas', 'ER', 'ER_SDAH', false),
  makeStation('STB', 'Shantipur Junction', 'ER', 'ER_SDAH', true),

  // ER_SDAH - Ranaghat - Bangaon & Sealdah - Bangaon missing stops
  makeStation('NRYN', 'Naba Ray Nagar', 'ER', 'ER_SDAH', false),
  makeStation('GGP', 'Gangnapur', 'ER', 'ER_SDAH', false),
  makeStation('MJM', 'Majhergram', 'ER', 'ER_SDAH', false),
  makeStation('AKP', 'Akaipur', 'ER', 'ER_SDAH', false),
  makeStation('GN', 'Gopalnagar', 'ER', 'ER_SDAH', false),
  makeStation('STBB', 'Satberia', 'ER', 'ER_SDAH', false),
  makeStation('CDP', 'Chandpara', 'ER', 'ER_SDAH', false),
  makeStation('BBN', 'Bibhuti Bhushan', 'ER', 'ER_SDAH', false),

  // ER_SDAH - Naihati - Bandel & Kalyani Simanta
  makeStation('GFAE', 'Garifa', 'ER', 'ER_SDAH', false),
  makeStation('HYG', 'Hooghly Ghat', 'ER', 'ER_SDAH', false),
  makeStation('KLYS', 'Kalyani Shilpanchal', 'ER', 'ER_SDAH', false),
  makeStation('KLYG', 'Kalyani Ghoshpara', 'ER', 'ER_SDAH', false),
  makeStation('KLYM', 'Kalyani Simanta', 'ER', 'ER_SDAH', false),

  // ER_SDAH - Barasat - Hasnabad branch
  makeStation('KBGH', 'Karea Kadambagachhi', 'ER', 'ER_SDAH', false),
  makeStation('BHKA', 'Bahira Kalibari', 'ER', 'ER_SDAH', false),
  makeStation('BGRD', 'Beliaghata Road', 'ER', 'ER_SDAH', false),
  makeStation('LBTL', 'Labutala', 'ER', 'ER_SDAH', false),
  makeStation('BSLA', 'Bhasila', 'ER', 'ER_SDAH', false),
  makeStation('HRD', 'Harua Road', 'ER', 'ER_SDAH', false),
  makeStation('KMZN', 'Kankra Mirzanagar', 'ER', 'ER_SDAH', false),
  makeStation('MLT', 'Malatipur', 'ER', 'ER_SDAH', false),
  makeStation('GOG', 'Ghoraras Ghona', 'ER', 'ER_SDAH', false),
  makeStation('CPK', 'Champapukur', 'ER', 'ER_SDAH', false),
  makeStation('BHB', 'Bhyabla', 'ER', 'ER_SDAH', false),
  makeStation('BSHT', 'Basirhat', 'ER', 'ER_SDAH', false),
  makeStation('MPN', 'Madhyampur', 'ER', 'ER_SDAH', false),
  makeStation('NMDR', 'Nimdanri', 'ER', 'ER_SDAH', false),
  makeStation('TKF', 'Taki Road', 'ER', 'ER_SDAH', false),

  // ER_SDAH_SOUTH - Trunk (Sealdah South - Baruipur - Lakshmikantapur - Namkhana)
  makeStation('PQS', 'Park Circus', 'ER', 'ER_SDAH_SOUTH', true),
  makeStation('BLN', 'Ballygunge Junction', 'ER', 'ER_SDAH_SOUTH', true),
  makeStation('DHK', 'Dhakuria', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('JDP', 'Jadabpur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('BGJT', 'Bagha Jatin', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('GIA', 'Garia', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('NRPR', 'Narendrapur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('SPR', 'Sonarpur Junction', 'ER', 'ER_SDAH_SOUTH', true),
  makeStation('SBGR', 'Subhasgram', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('MLK', 'Mallikpur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('BRP', 'Baruipur Junction', 'ER', 'ER_SDAH_SOUTH', true),
  makeStation('SHRD', 'Sashan Road', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('KMHN', 'Krishna Mohan', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('DPDP', 'Dhapdhapi', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('SURP', 'Suryapur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('GCN', 'Gocharan', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('HGA', 'Hogla', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('DBT', 'Dakshin Barasat', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('BARU', 'Baharu', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('JNM', 'Jaynagar Majilpur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('MPRD', 'Mathurapur Road', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('MDP', 'Madhabpur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('LKPR', 'Lakshmikantapur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('UDR', 'Udairampur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('KLP', 'Kulpi', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('KNJI', 'Karanjali (TP 74/17-75/1)', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('NCPM', 'Nischindapur Market', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('NCP', 'Nischindapur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('KSGR', 'Kashinagar', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('KWDP', 'Kakdwip', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('NMKA', 'Namkhana', 'ER', 'ER_SDAH_SOUTH', false),

  // ER_SDAH_SOUTH - Ballygunge - Budge Budge
  makeStation('LKG', 'Lake Gardens', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('TLG', 'Tollygunge', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('NACC', 'New Alipore', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('MJT', 'Majerhat', 'ER', 'ER_SDAH_SOUTH', true),
  makeStation('BRJ', 'Brace Bridge', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('SSP', 'Santoshpur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('AKRA', 'Akra', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('NAI', 'Nangi', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('BGB', 'Budge Budge', 'ER', 'ER_SDAH_SOUTH', false),

  // ER_SDAH_SOUTH - Sonarpur - Canning
  makeStation('BDYP', 'Bidyadharpur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('KLKR', 'Kalikapur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('CHT', 'Champahati', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('PLF', 'Piali', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('GRD', 'Gourdaha', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('GSF', 'Ghutiari Sharif', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('BTG', 'Beathberia Ghola', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('TLX', 'Taldi', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('CG', 'Canning', 'ER', 'ER_SDAH_SOUTH', false),

  // ER_SDAH_SOUTH - Baruipur - Diamond Harbour
  makeStation('KYP', 'Kalyanpur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('DKDP', 'Dakshin Durgapur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('HT', 'Hotar', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('DMU', 'Dhamuah', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('UTN', 'Uttar Radhanagar', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('MGT', 'Magra Hat', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('BHPA', 'Bahirpuya', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('SNU', 'Sangrampur', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('DEUL', 'Deula', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('NTA', 'Netra', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('BSD', 'Basuldanga', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('GURN', 'Gurudas Nagar', 'ER', 'ER_SDAH_SOUTH', false),
  makeStation('DH', 'Diamond Harbour', 'ER', 'ER_SDAH_SOUTH', false),

  // ER_CHORD_LINK - Sealdah - Dankuni & Dankuni - Andul
  makeStation('BARN', 'Baranagar Road', 'ER', 'ER_CHORD_LINK', false),
  makeStation('DAKE', 'Dakshineswar', 'ER', 'ER_CHORD_LINK', false),
  makeStation('BLYG', 'Bally Ghat', 'ER', 'ER_CHORD_LINK', false),
  makeStation('BLYH', 'Bally Halt', 'ER', 'ER_CHORD_LINK', false),
  makeStation('RCD', 'Rajchandrapur', 'ER', 'ER_CHORD_LINK', false),
  makeStation('KONA', 'Kona', 'ER', 'ER_CHORD_LINK', true),
  makeStation('BALT', 'Baltikuri', 'ER', 'ER_CHORD_LINK', true),
  makeStation('BKNM', 'Bankranayabaz', 'ER', 'ER_CHORD_LINK', true),

  // ER_CIRCULAR - Dum Dum - Majerhat & Sealdah chord
  makeStation('PTPK', 'Patipukur', 'ER', 'ER_CIRCULAR', false),
  makeStation('UDGR', 'Ultadanga Road', 'ER', 'ER_CIRCULAR', false),
  makeStation('TALA', 'Tala', 'ER', 'ER_CIRCULAR', false),
  makeStation('BGBR', 'Bag Bazar', 'ER', 'ER_CIRCULAR', false),
  makeStation('SBZR', 'Sova Bazar Ahiritola', 'ER', 'ER_CIRCULAR', false),
  makeStation('BBZR', 'Burra Bazar', 'ER', 'ER_CIRCULAR', false),
  makeStation('BBDB', 'BBD Bag', 'ER', 'ER_CIRCULAR', false),
  makeStation('EDG', 'Eden Gardens', 'ER', 'ER_CIRCULAR', false),
  makeStation('PPGT', 'Princep Ghat', 'ER', 'ER_CIRCULAR', false),
  makeStation('HSTG', 'Hastings', 'ER', 'ER_CIRCULAR', false),
  makeStation('KHDP', 'Khidirpur', 'ER', 'ER_CIRCULAR', false),
  makeStation('RMTR', 'Remount Road', 'ER', 'ER_CIRCULAR', false),
  makeStation('SGBH', 'Sir Gurudas Banerjee Halt', 'ER', 'ER_CIRCULAR', false),

  // SER_HWH - Shalimar - Amta
  makeStation('SHM', 'Shalimar', 'SER', 'SER_HWH', true),
  makeStation('PDPK', 'Padmapukur', 'SER', 'SER_HWH', false),
  makeStation('DNSI', 'Dansi', 'SER', 'SER_HWH', false),
  makeStation('JLB', 'Jhalurberi', 'SER', 'SER_HWH', false),
  makeStation('MKD', 'Makardaha', 'SER', 'SER_HWH', false),
  makeStation('DJR', 'Domjur Road', 'SER', 'SER_HWH', false),
  makeStation('DJ', 'Domjur', 'SER', 'SER_HWH', false),
  makeStation('DKB', 'Dakshinbari', 'SER', 'SER_HWH', false),
  makeStation('BAC', 'Bargachia', 'SER', 'SER_HWH', false),
  makeStation('PTHL', 'Pantihal', 'SER', 'SER_HWH', false),
  makeStation('MNH', 'Munsirhat', 'SER', 'SER_HWH', false),
  makeStation('MHLN', 'Mahendralalnagar', 'SER', 'SER_HWH', false),
  makeStation('AMZ', 'Amta', 'SER', 'SER_HWH', false),

  // METRO - Metro Railway Kolkata (Blue Line shown on map)
  makeStation('DDM', 'Dum Dum (Metro)', 'METRO', 'METRO_NS', true),
  makeStation('BLG', 'Belgachhia', 'METRO', 'METRO_NS', false),
  makeStation('SHB', 'Shyambazar', 'METRO', 'METRO_NS', false),
  makeStation('SVB', 'Sova Bazar (Metro)', 'METRO', 'METRO_NS', false),
  makeStation('GPK', 'Girish Park', 'METRO', 'METRO_NS', false),
  makeStation('MGR', 'MG Road (Metro)', 'METRO', 'METRO_NS', false),
  makeStation('CNT', 'Central (Metro)', 'METRO', 'METRO_NS', false),
  makeStation('CNC', 'Chandni Chowk', 'METRO', 'METRO_NS', false),
  makeStation('ESP', 'Esplanade', 'METRO', 'METRO_NS', true),
  makeStation('PKS', 'Park Street', 'METRO', 'METRO_NS', false),
  makeStation('MDNM', 'Maidan (Metro)', 'METRO', 'METRO_NS', false),
  makeStation('RBS', 'Rabindra Sadan', 'METRO', 'METRO_NS', false),
  makeStation('NTB', 'Netaji Bhawan', 'METRO', 'METRO_NS', false),
  makeStation('JDPK', 'Jatin Das Park', 'METRO', 'METRO_NS', false),
  makeStation('KGT', 'Kalighat', 'METRO', 'METRO_NS', false),
  makeStation('RBSR', 'Rabindra Sarobar', 'METRO', 'METRO_NS', false),
  makeStation('TLGM', 'Tollygunge (Metro)', 'METRO', 'METRO_NS', true),
  makeStation('KUDG', 'Kudghat', 'METRO', 'METRO_NS', false),
  makeStation('BNDR', 'Bansdroni', 'METRO', 'METRO_NS', false),
  makeStation('NKTL', 'Naktala', 'METRO', 'METRO_NS', false),
  makeStation('GRBZ', 'Garia Bazar', 'METRO', 'METRO_NS', false),
  makeStation('PRBN', 'Pranabnagar', 'METRO', 'METRO_NS', false),
  makeStation('NWGA', 'New Garia', 'METRO', 'METRO_NS', true),
];

export const MAP_POPULATED_ROUTES_BY_ID: Record<string, SuburbanRouteStop[]> = {
  ER_BELUR_MATH: [
    makeStop(1, 'HWH', 'Howrah Junction', 0),
    makeStop(2, 'LLH', 'Liluah', 5),
    makeStop(3, 'BEQ', 'Belur', 7),
    makeStop(4, 'BRMH', 'Belur Math', 8),
  ],

  ER_RANAGHAT_KRISHNANAGAR: [
    makeStop(1, 'RHA', 'Ranaghat Junction', 74),
    makeStop(2, 'KLNP', 'Kalinarayanpur Junction', 78),
    makeStop(3, 'BIJ', 'Birnagar', 82),
    makeStop(4, 'THP', 'Taherpur', 85),
    makeStop(5, 'BDZ', 'Badkulla', 90),
    makeStop(6, 'JLK', 'Jalalkhali', 95),
    makeStop(7, 'KNJ', 'Krishnanagar City Junction', 100),
  ],

  ER_KALINARAYANPUR_SHANTIPUR: [
    makeStop(1, 'KLNP', 'Kalinarayanpur Junction', 78),
    makeStop(2, 'HBP', 'Habibpur', 81),
    makeStop(3, 'FLU', 'Phulia', 86),
    makeStop(4, 'BTKB', 'Bathna Krittibas', 90),
    makeStop(5, 'STB', 'Shantipur Junction', 94),
  ],

  ER_RANAGHAT_BANGAON: [
    makeStop(1, 'RHA', 'Ranaghat Junction', 0),
    makeStop(2, 'NRYN', 'Naba Ray Nagar', 5),
    makeStop(3, 'GGP', 'Gangnapur', 11),
    makeStop(4, 'MJM', 'Majhergram', 15),
    makeStop(5, 'AKP', 'Akaipur', 19),
    makeStop(6, 'GN', 'Gopalnagar', 23),
    makeStop(7, 'STBB', 'Satberia', 28),
    makeStop(8, 'BNJ', 'Bongaon Junction', 33),
  ],

  ER_SEALDAH_BANGAON: [
    makeStop(1, 'SDAH', 'Sealdah', 0),
    makeStop(2, 'BNXR', 'Bidhannagar Road', 4),
    makeStop(3, 'DDJ', 'Dum Dum Junction', 7),
    makeStop(4, 'DDC', 'Dum Dum Cantonment', 10),
    makeStop(5, 'DGNR', 'Durganagar', 12),
    makeStop(6, 'BBT', 'Birati', 14),
    makeStop(7, 'BESB', 'Bisharpara Kodaliya', 15),
    makeStop(8, 'NBE', 'New Barrackpore', 17),
    makeStop(9, 'MMG', 'Madhyamgram', 19),
    makeStop(10, 'HHR', 'Hridaypur', 21),
    makeStop(11, 'BT', 'Barasat Junction', 23),
    makeStop(12, 'BMG', 'Bamangachhi', 27),
    makeStop(13, 'DTK', 'Duttapukur', 30),
    makeStop(14, 'BIRA', 'Bira', 34),
    makeStop(15, 'GUMA', 'Guma', 38),
    makeStop(16, 'ASKR', 'Ashoknagar Road', 41),
    makeStop(17, 'HB', 'Habra', 45),
    makeStop(18, 'SNHT', 'Sanhati Halt', 50),
    makeStop(19, 'MSL', 'Machlandapur', 54),
    makeStop(20, 'GBG', 'Gobardanga', 58),
    makeStop(21, 'TKNR', 'Thakurnagar', 63),
    makeStop(22, 'CDP', 'Chandpara', 67),
    makeStop(23, 'BBN', 'Bibhuti Bhushan', 72),
    makeStop(24, 'BNJ', 'Bongaon Junction', 77),
  ],

  ER_BARASAT_HASNABAD: [
    makeStop(1, 'BT', 'Barasat Junction', 23),
    makeStop(2, 'KBGH', 'Karea Kadambagachhi', 29),
    makeStop(3, 'BHKA', 'Bahira Kalibari', 32),
    makeStop(4, 'SXC', 'Sondalia', 35),
    makeStop(5, 'BGRD', 'Beliaghata Road', 37),
    makeStop(6, 'LBTL', 'Labutala', 41),
    makeStop(7, 'BSLA', 'Bhasila', 43),
    makeStop(8, 'HRD', 'Harua Road', 46),
    makeStop(9, 'KMZN', 'Kankra Mirzanagar', 49),
    makeStop(10, 'MLT', 'Malatipur', 54),
    makeStop(11, 'GOG', 'Ghoraras Ghona', 56),
    makeStop(12, 'CPK', 'Champapukur', 58),
    makeStop(13, 'BHB', 'Bhyabla', 63),
    makeStop(14, 'BSHT', 'Basirhat', 65),
    makeStop(15, 'MPN', 'Madhyampur', 69),
    makeStop(16, 'NMDR', 'Nimdanri', 71),
    makeStop(17, 'TKF', 'Taki Road', 74),
    makeStop(18, 'HNB', 'Hasnabad', 75),
  ],

  ER_NAIHATI_BANDEL: [
    makeStop(1, 'NH', 'Naihati Junction', 0),
    makeStop(2, 'GFAE', 'Garifa', 2),
    makeStop(3, 'HYG', 'Hooghly Ghat', 7),
    makeStop(4, 'BDC', 'Bandel Junction', 9),
  ],

  ER_KALYANI_SIMANTA: [
    makeStop(1, 'KYI', 'Kalyani', 48),
    makeStop(2, 'KLYS', 'Kalyani Shilpanchal', 50),
    makeStop(3, 'KLYG', 'Kalyani Ghoshpara', 52),
    makeStop(4, 'KLYM', 'Kalyani Simanta', 53),
  ],

  ER_SEALDAH_NAMKHANA: [
    makeStop(1, 'SDAH', 'Sealdah', 0),
    makeStop(2, 'PQS', 'Park Circus', 4),
    makeStop(3, 'BLN', 'Ballygunge Junction', 6),
    makeStop(4, 'DHK', 'Dhakuria', 7),
    makeStop(5, 'JDP', 'Jadabpur', 8),
    makeStop(6, 'BGJT', 'Bagha Jatin', 10),
    makeStop(7, 'GIA', 'Garia', 13),
    makeStop(8, 'NRPR', 'Narendrapur', 15),
    makeStop(9, 'SPR', 'Sonarpur Junction', 17),
    makeStop(10, 'SBGR', 'Subhasgram', 20),
    makeStop(11, 'MLK', 'Mallikpur', 22),
    makeStop(12, 'BRP', 'Baruipur Junction', 25),
    makeStop(13, 'SHRD', 'Sashan Road', 28),
    makeStop(14, 'KMHN', 'Krishna Mohan', 30),
    makeStop(15, 'DPDP', 'Dhapdhapi', 32),
    makeStop(16, 'SURP', 'Suryapur', 34),
    makeStop(17, 'GCN', 'Gocharan', 36),
    makeStop(18, 'HGA', 'Hogla', 39),
    makeStop(19, 'DBT', 'Dakshin Barasat', 42),
    makeStop(20, 'BARU', 'Baharu', 45),
    makeStop(21, 'JNM', 'Jaynagar Majilpur', 50),
    makeStop(22, 'MPRD', 'Mathurapur Road', 54),
    makeStop(23, 'MDP', 'Madhabpur', 59),
    makeStop(24, 'LKPR', 'Lakshmikantapur', 62),
    makeStop(25, 'UDR', 'Udairampur', 68),
    makeStop(26, 'KLP', 'Kulpi', 72),
    makeStop(27, 'KNJI', 'Karanjali (TP 74/17-75/1)', 77),
    makeStop(28, 'NCPM', 'Nischindapur Market', 83),
    makeStop(29, 'NCP', 'Nischindapur', 84),
    makeStop(30, 'KSGR', 'Kashinagar', 92),
    makeStop(31, 'KWDP', 'Kakdwip', 95),
    makeStop(32, 'NMKA', 'Namkhana', 108),
  ],

  ER_BALLYGUNGE_BUDGE_BUDGE: [
    makeStop(1, 'SDAH', 'Sealdah', 0),
    makeStop(2, 'PQS', 'Park Circus', 4),
    makeStop(3, 'BLN', 'Ballygunge Junction', 6),
    makeStop(4, 'LKG', 'Lake Gardens', 8),
    makeStop(5, 'TLG', 'Tollygunge', 9),
    makeStop(6, 'NACC', 'New Alipore', 10),
    makeStop(7, 'MJT', 'Majerhat', 12),
    makeStop(8, 'BRJ', 'Brace Bridge', 14),
    makeStop(9, 'SSP', 'Santoshpur', 17),
    makeStop(10, 'AKRA', 'Akra', 19),
    makeStop(11, 'NAI', 'Nangi', 23),
    makeStop(12, 'BGB', 'Budge Budge', 26),
  ],

  ER_SONARPUR_CANNING: [
    makeStop(1, 'SDAH', 'Sealdah', 0),
    makeStop(2, 'PQS', 'Park Circus', 4),
    makeStop(3, 'BLN', 'Ballygunge Junction', 6),
    makeStop(4, 'DHK', 'Dhakuria', 7),
    makeStop(5, 'JDP', 'Jadabpur', 8),
    makeStop(6, 'BGJT', 'Bagha Jatin', 10),
    makeStop(7, 'GIA', 'Garia', 13),
    makeStop(8, 'NRPR', 'Narendrapur', 15),
    makeStop(9, 'SPR', 'Sonarpur Junction', 17),
    makeStop(10, 'BDYP', 'Bidyadharpur', 20),
    makeStop(11, 'KLKR', 'Kalikapur', 23),
    makeStop(12, 'CHT', 'Champahati', 24),
    makeStop(13, 'PLF', 'Piali', 27),
    makeStop(14, 'GRD', 'Gourdaha', 29),
    makeStop(15, 'GSF', 'Ghutiari Sharif', 32),
    makeStop(16, 'BTG', 'Beathberia Ghola', 35),
    makeStop(17, 'TLX', 'Taldi', 39),
    makeStop(18, 'CG', 'Canning', 46),
  ],

  ER_BARUIPUR_DIAMOND_HARBOUR: [
    makeStop(1, 'SDAH', 'Sealdah', 0),
    makeStop(2, 'PQS', 'Park Circus', 4),
    makeStop(3, 'BLN', 'Ballygunge Junction', 6),
    makeStop(4, 'DHK', 'Dhakuria', 7),
    makeStop(5, 'JDP', 'Jadabpur', 8),
    makeStop(6, 'BGJT', 'Bagha Jatin', 10),
    makeStop(7, 'GIA', 'Garia', 13),
    makeStop(8, 'NRPR', 'Narendrapur', 15),
    makeStop(9, 'SPR', 'Sonarpur Junction', 17),
    makeStop(10, 'SBGR', 'Subhasgram', 20),
    makeStop(11, 'MLK', 'Mallikpur', 22),
    makeStop(12, 'BRP', 'Baruipur Junction', 25),
    makeStop(13, 'KYP', 'Kalyanpur', 28),
    makeStop(14, 'DKDP', 'Dakshin Durgapur', 30),
    makeStop(15, 'HT', 'Hotar', 32),
    makeStop(16, 'DMU', 'Dhamuah', 35),
    makeStop(17, 'UTN', 'Uttar Radhanagar', 37),
    makeStop(18, 'MGT', 'Magra Hat', 40),
    makeStop(19, 'BHPA', 'Bahirpuya', 43),
    makeStop(20, 'SNU', 'Sangrampur', 45),
    makeStop(21, 'DEUL', 'Deula', 50),
    makeStop(22, 'NTA', 'Netra', 53),
    makeStop(23, 'BSD', 'Basuldanga', 55),
    makeStop(24, 'GURN', 'Gurudas Nagar', 57),
    makeStop(25, 'DH', 'Diamond Harbour', 60),
  ],

  ER_SEALDAH_DANKUNI: [
    makeStop(1, 'SDAH', 'Sealdah', 0),
    makeStop(2, 'BNXR', 'Bidhannagar Road', 4),
    makeStop(3, 'DDJ', 'Dum Dum Junction', 7),
    makeStop(4, 'BARN', 'Baranagar Road', 12),
    makeStop(5, 'DAKE', 'Dakshineswar', 14),
    makeStop(6, 'BLYG', 'Bally Ghat', 15),
    makeStop(7, 'BLYH', 'Bally Halt', 16),
    makeStop(8, 'RCD', 'Rajchandrapur', 18),
    makeStop(9, 'DKAE', 'Dankuni Junction', 22),
  ],

  ER_DANKUNI_ANDUL: [
    makeStop(1, 'DKAE', 'Dankuni Junction', 0),
    makeStop(2, 'KONA', 'Kona', 3),
    makeStop(3, 'BALT', 'Baltikuri', 5),
    makeStop(4, 'BKNM', 'Bankranayabaz', 8),
    makeStop(5, 'ADL', 'Andul', 10),
  ],

  ER_CIRCULAR_DUMDUM_MAJERHAT: [
    makeStop(1, 'DDJ', 'Dum Dum Junction', 0),
    makeStop(2, 'PTPK', 'Patipukur', 2),
    makeStop(3, 'UDGR', 'Ultadanga Road', 3),
    makeStop(4, 'TALA', 'Tala', 5),
    makeStop(5, 'BGBR', 'Bag Bazar', 7),
    makeStop(6, 'SBZR', 'Sova Bazar Ahiritola', 8),
    makeStop(7, 'BBZR', 'Burra Bazar', 9),
    makeStop(8, 'BBDB', 'BBD Bag', 10),
    makeStop(9, 'EDG', 'Eden Gardens', 12),
    makeStop(10, 'PPGT', 'Princep Ghat', 14),
    makeStop(11, 'HSTG', 'Hastings', 15),
    makeStop(12, 'KHDP', 'Khidirpur', 17),
    makeStop(13, 'RMTR', 'Remount Road', 19),
    makeStop(14, 'MJT', 'Majerhat', 21),
  ],

  SER_SHALIMAR_AMTA: [
    makeStop(1, 'SHM', 'Shalimar', 0),
    makeStop(2, 'PDPK', 'Padmapukur', 3),
    makeStop(3, 'SRC', 'Santragachi Junction', 8),
    makeStop(4, 'BKNM', 'Bankranayabaz', 14),
    makeStop(5, 'BALT', 'Baltikuri', 17),
    makeStop(6, 'KONA', 'Kona', 18),
    makeStop(7, 'DNSI', 'Dansi', 21),
    makeStop(8, 'JLB', 'Jhalurberi', 23),
    makeStop(9, 'MKD', 'Makardaha', 25),
    makeStop(10, 'DJR', 'Domjur Road', 26),
    makeStop(11, 'DJ', 'Domjur', 28),
    makeStop(12, 'DKB', 'Dakshinbari', 31),
    makeStop(13, 'BAC', 'Bargachia', 36),
    makeStop(14, 'PTHL', 'Pantihal', 38),
    makeStop(15, 'MNH', 'Munsirhat', 40),
    makeStop(16, 'MHLN', 'Mahendralalnagar', 41),
    makeStop(17, 'AMZ', 'Amta', 44),
  ],
};

export const EXTRA_ROUTES: Array<{
  zoneId: string;
  zoneName?: string;
  divisionId: string;
  divisionName?: string;
  route: SuburbanRouteRaw;
}> = [
  {
    zoneId: 'ER',
    divisionId: 'ER_CIRCULAR',
    route: {
      routeId: 'ER_CIRCULAR_SEALDAH_LINK',
      routeName: 'Sealdah - Sir Gurudas Banerjee - Park Circus',
      corridor: 'Circular Chord Link',
      origin: 'SDAH',
      destination: 'BLN',
      distanceStatus: 'map_verified_km',
      dataStatus: 'populated_from_map',
      stations: [
        makeStop(1, 'SDAH', 'Sealdah', 0),
        makeStop(2, 'SGBH', 'Sir Gurudas Banerjee Halt', 2),
        makeStop(3, 'PQS', 'Park Circus', 4),
        makeStop(4, 'BLN', 'Ballygunge Junction', 6),
      ],
    },
  },
  {
    zoneId: 'METRO',
    zoneName: 'Metro Railway, Kolkata',
    divisionId: 'METRO_NS',
    divisionName: 'North-South Blue Line',
    route: {
      routeId: 'METRO_NORTH_SOUTH',
      routeName: 'Dum Dum - Esplanade - Tollygunge - New Garia',
      corridor: 'Metro Blue Line',
      origin: 'DDM',
      destination: 'NWGA',
      distanceStatus: 'map_verified_km',
      dataStatus: 'populated_from_map',
      stations: [
        makeStop(1, 'DDM', 'Dum Dum (Metro)', 0),
        makeStop(2, 'BLG', 'Belgachhia', 2),
        makeStop(3, 'SHB', 'Shyambazar', 4),
        makeStop(4, 'SVB', 'Sova Bazar (Metro)', 5),
        makeStop(5, 'GPK', 'Girish Park', 6),
        makeStop(6, 'MGR', 'MG Road (Metro)', 7),
        makeStop(7, 'CNT', 'Central (Metro)', 8),
        makeStop(8, 'CNC', 'Chandni Chowk', 9),
        makeStop(9, 'ESP', 'Esplanade', 10),
        makeStop(10, 'PKS', 'Park Street', 11),
        makeStop(11, 'MDNM', 'Maidan (Metro)', 12),
        makeStop(12, 'RBS', 'Rabindra Sadan', 13),
        makeStop(13, 'NTB', 'Netaji Bhawan', 14),
        makeStop(14, 'JDPK', 'Jatin Das Park', 15),
        makeStop(15, 'KGT', 'Kalighat', 16),
        makeStop(16, 'RBSR', 'Rabindra Sarobar', 17),
        makeStop(17, 'TLGM', 'Tollygunge (Metro)', 18),
        makeStop(18, 'KUDG', 'Kudghat', 20),
        makeStop(19, 'BNDR', 'Bansdroni', 21),
        makeStop(20, 'NKTL', 'Naktala', 22),
        makeStop(21, 'GRBZ', 'Garia Bazar', 24),
        makeStop(22, 'PRBN', 'Pranabnagar', 25),
        makeStop(23, 'NWGA', 'New Garia', 26),
      ],
    },
  },
];

export const MAP_INTERCHANGES: SuburbanInterchange[] = [
  {
    stationCode: 'SDAH',
    connectedRouteIds: [
      'ER_SDAH_GEDE',
      'ER_SEALDAH_BANGAON',
      'ER_SEALDAH_DANKUNI',
      'ER_SEALDAH_NAMKHANA',
      'ER_BALLYGUNGE_BUDGE_BUDGE',
      'ER_SONARPUR_CANNING',
      'ER_BARUIPUR_DIAMOND_HARBOUR',
      'ER_CIRCULAR_SEALDAH_LINK',
    ],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'DDJ',
    connectedRouteIds: [
      'ER_SDAH_GEDE',
      'ER_SEALDAH_BANGAON',
      'ER_SEALDAH_DANKUNI',
      'ER_CIRCULAR_DUMDUM_MAJERHAT',
    ],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'NH',
    connectedRouteIds: ['ER_SDAH_GEDE', 'ER_NAIHATI_BANDEL'],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'KYI',
    connectedRouteIds: ['ER_SDAH_GEDE', 'ER_KALYANI_SIMANTA'],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'RHA',
    connectedRouteIds: [
      'ER_SDAH_GEDE',
      'ER_RANAGHAT_KRISHNANAGAR',
      'ER_RANAGHAT_BANGAON',
    ],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'KLNP',
    connectedRouteIds: ['ER_RANAGHAT_KRISHNANAGAR', 'ER_KALINARAYANPUR_SHANTIPUR'],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'BT',
    connectedRouteIds: ['ER_SEALDAH_BANGAON', 'ER_BARASAT_HASNABAD'],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'BLN',
    connectedRouteIds: [
      'ER_SEALDAH_NAMKHANA',
      'ER_BALLYGUNGE_BUDGE_BUDGE',
      'ER_SONARPUR_CANNING',
      'ER_BARUIPUR_DIAMOND_HARBOUR',
      'ER_CIRCULAR_SEALDAH_LINK',
    ],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'MJT',
    connectedRouteIds: ['ER_BALLYGUNGE_BUDGE_BUDGE', 'ER_CIRCULAR_DUMDUM_MAJERHAT'],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'SPR',
    connectedRouteIds: [
      'ER_SEALDAH_NAMKHANA',
      'ER_SONARPUR_CANNING',
      'ER_BARUIPUR_DIAMOND_HARBOUR',
    ],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'BRP',
    connectedRouteIds: ['ER_SEALDAH_NAMKHANA', 'ER_BARUIPUR_DIAMOND_HARBOUR'],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'SRC',
    connectedRouteIds: ['SER_HWH_MIDNAPORE', 'SER_SHALIMAR_AMTA'],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'PKU',
    connectedRouteIds: ['SER_HWH_MIDNAPORE', 'SER_PANSKURA_HALDIA'],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'TMZ',
    connectedRouteIds: ['SER_PANSKURA_HALDIA', 'SER_TAMLUK_DIGHA'],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'KONA',
    connectedRouteIds: ['ER_DANKUNI_ANDUL', 'SER_SHALIMAR_AMTA'],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'BALT',
    connectedRouteIds: ['ER_DANKUNI_ANDUL', 'SER_SHALIMAR_AMTA'],
    verificationStatus: 'map_verified_hub',
  },
  {
    stationCode: 'BKNM',
    connectedRouteIds: ['ER_DANKUNI_ANDUL', 'SER_SHALIMAR_AMTA'],
    verificationStatus: 'map_verified_hub',
  },
];

/**
 * Enriches the starter Kolkata Suburban Railway JSON with all missing stations,
 * missing/fixed Chord Line codes, Circular Railway, Sealdah South branches,
 * Metro Railway North-South Blue Line, and red km distances from the map image.
 * Leaves the starter JSON file untouched and keeps everything pure & deterministic.
 */
export function enrichSuburbanDatabaseWithMapData(
  rawDb: KolkataSuburbanDb
): KolkataSuburbanDb {
  const junctionCodes = new Set(
    MAP_INTERCHANGES.map((ic) => ic.stationCode.toUpperCase())
  );

  // 1. Update stations: fill the 17 null Chord Line codes & add all extra map stations
  const updatedStations: SuburbanStationMaster[] = rawDb.stations.map((st) => {
    const chordCode = CHORD_STATION_CODE_UPDATES[st.stationId];
    if (chordCode) {
      return {
        ...st,
        stationCode: chordCode,
        dataStatus: 'map_verified_provisional',
      };
    }
    return {
      ...st,
      isJunction:
        st.isJunction ||
        Boolean(st.stationCode && junctionCodes.has(st.stationCode.toUpperCase())),
    };
  });

  const existingCodes = new Set(
    updatedStations
      .map((s) => s.stationCode?.trim().toUpperCase())
      .filter((c): c is string => Boolean(c))
  );
  const existingIds = new Set(updatedStations.map((s) => s.stationId.toLowerCase()));

  for (const extra of MAP_EXTRA_STATIONS) {
    const codeUpper = extra.stationCode?.toUpperCase();
    if (
      (codeUpper && existingCodes.has(codeUpper)) ||
      existingIds.has(extra.stationId.toLowerCase())
    ) {
      continue;
    }
    updatedStations.push(extra);
    if (codeUpper) existingCodes.add(codeUpper);
    existingIds.add(extra.stationId.toLowerCase());
  }

  // 2. Populate routes from the map image
  const updatedZones = rawDb.zones.map((zone) => ({
    ...zone,
    divisions: zone.divisions.map((div) => ({
      ...div,
      routes: div.routes.map((route) => {
        if (route.routeId === 'ER_HWH_CHORD') {
          return {
            ...route,
            distanceStatus: 'map_verified_km',
            dataStatus: 'populated_from_map',
            stations: route.stations.map((stop) => {
              if (stop.stationName.toLowerCase() === 'hajigarh') {
                return { ...stop, stationCode: 'HZG' };
              }
              const key = stop.stationName.toLowerCase().replace(/\s+/g, '_');
              const fixedCode =
                CHORD_STATION_CODE_UPDATES[key] ??
                CHORD_STATION_CODE_UPDATES[stop.stationName.toLowerCase()];
              return fixedCode ? { ...stop, stationCode: fixedCode } : stop;
            }),
          };
        }

        if (route.routeId === 'ER_TARAKESWAR_GOGHAT') {
          return {
            ...route,
            distanceStatus: 'map_verified_km',
            dataStatus: 'populated_from_map',
            stations: route.stations.map((stop) =>
              stop.stationCode === 'GOGT' && stop.stationKm === null
                ? { ...stop, stationKm: 69 }
                : stop
            ),
          };
        }

        const overrideStops = MAP_POPULATED_ROUTES_BY_ID[route.routeId];
        if (overrideStops) {
          return {
            ...route,
            distanceStatus: 'map_verified_km',
            dataStatus: 'populated_from_map',
            stations: overrideStops,
          };
        }

        return route;
      }),
    })),
  }));

  // 3. Append Circular Sealdah link & Metro Railway North-South corridor
  for (const extra of EXTRA_ROUTES) {
    let targetZone = updatedZones.find((z) => z.zoneId === extra.zoneId);
    if (!targetZone) {
      targetZone = {
        zoneId: extra.zoneId,
        zoneName: extra.zoneName ?? extra.zoneId,
        divisions: [],
      };
      updatedZones.push(targetZone);
    }

    let targetDiv = targetZone.divisions.find((d) => d.divisionId === extra.divisionId);
    if (!targetDiv) {
      targetDiv = {
        divisionId: extra.divisionId,
        divisionName: extra.divisionName ?? extra.divisionId,
        routes: [],
      };
      targetZone.divisions.push(targetDiv);
    }

    if (!targetDiv.routes.some((r) => r.routeId === extra.route.routeId)) {
      targetDiv.routes.push(extra.route);
    }
  }

  // 4. Merge interchanges
  const interchangeMap = new Map<string, SuburbanInterchange>();
  for (const ic of rawDb.interchanges) {
    interchangeMap.set(ic.stationCode.toUpperCase(), {
      ...ic,
      connectedRouteIds: [...ic.connectedRouteIds],
    });
  }
  for (const ic of MAP_INTERCHANGES) {
    const code = ic.stationCode.toUpperCase();
    const existing = interchangeMap.get(code);
    if (existing) {
      const mergedRoutes = Array.from(
        new Set([...existing.connectedRouteIds, ...ic.connectedRouteIds])
      );
      interchangeMap.set(code, {
        ...existing,
        connectedRouteIds: mergedRoutes,
        verificationStatus: 'map_verified_hub',
      });
    } else {
      interchangeMap.set(code, ic);
    }
  }

  // Ensure SHE includes ER_HWH_MAIN as well
  const she = interchangeMap.get('SHE');
  if (she && !she.connectedRouteIds.includes('ER_HWH_MAIN')) {
    she.connectedRouteIds.unshift('ER_HWH_MAIN');
  }

  return {
    ...rawDb,
    metadata: {
      ...rawDb.metadata,
      version: '1.0.0-map-enriched',
      status: 'kolkata_suburban_map_enriched',
    },
    zones: updatedZones,
    interchanges: Array.from(interchangeMap.values()),
    fareRules: {
      ...rawDb.fareRules,
      status: 'suburban_distance_slab_estimator',
      calculationPolicy:
        'Calculated from Kolkata Suburban Railway map distances (km) using Indian Railways suburban II/FC/MST distance slabs.',
    },
    stations: updatedStations,
    dataQuality: {
      ...rawDb.dataQuality,
      routeCount: updatedZones.reduce(
        (acc, z) => acc + z.divisions.reduce((dAcc, d) => dAcc + d.routes.length, 0),
        0
      ),
      stationMasterCount: updatedStations.length,
      routeCoverage: 'All Kolkata Suburban Railway Map v1.0 corridors + Metro Blue Line populated',
    },
  };
}
