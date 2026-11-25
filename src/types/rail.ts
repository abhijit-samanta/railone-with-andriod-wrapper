export type LanguageCode = 'en' | 'hi' | 'bn';

export type MainTab = 'home' | 'bookings' | 'you' | 'menu';

export type ActiveScreen =
  | 'home'
  | 'reserved'
  | 'unreserved'
  | 'platform'
  | 'search-trains'
  | 'pnr-status'
  | 'coach-position'
  | 'track-train'
  | 'order-food'
  | 'file-refund'
  | 'rail-madad'
  | 'travel-feedback'
  | 'performance-dashboard'
  | 'station-search';

export type QuotaType = 'General' | 'Tatkal' | 'Ladies' | 'Senior Citizen';

export type TrainClassCode = '1A' | '2A' | '3A' | '3E' | 'CC' | 'EC' | 'SL' | '2S';

export interface Station {
  code: string;
  name: string;
  city: string;
  zone: string;
  stationId?: string;
  divisionId?: string;
  divisionName?: string;
  isJunction?: boolean;
  isInterchange?: boolean;
  hasVerifiedCode?: boolean;
  source?: 'mainline' | 'kolkata-suburban' | 'both';
}

export interface DayAvailability {
  dateLabel: string; // e.g. "Thu 3 Jul"
  isoDate: string;
  status: string; // e.g. "AVAILABLE-0241", "WL 77", "RAC 14"
  kind: 'available' | 'rac' | 'wl';
}

export interface TrainClassOption {
  code: TrainClassCode;
  fare: number;
  status: string;
  kind: 'available' | 'rac' | 'wl';
  nearbyDates: DayAvailability[];
}

export interface ScheduleStop {
  sr: number;
  stationCode: string;
  stationName: string;
  day: number;
  arrival: string;
  departure: string;
  haltMins: number;
  distanceKm: number;
  platform: string;
  status?: 'departed' | 'current' | 'upcoming';
  delayMins?: number;
}

export interface CoachPositionItem {
  position: number;
  label: string; // e.g. "ENG", "EOG", "GEN", "S1", "B1", "A1", "H1", "C1"
  type: 'engine' | 'luggage' | 'general' | 'sleeper' | 'ac3' | 'ac2' | 'ac1' | 'chair' | 'exec' | 'pantry';
  seats?: number;
}

export interface TrainInfo {
  number: string;
  name: string;
  category: 'VANDE BHARAT' | 'RAJDHANI' | 'SUPERFAST' | 'GARIB RATH' | 'EXPRESS' | 'INTERCITY';
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  distanceKm: number;
  runningDays: [boolean, boolean, boolean, boolean, boolean, boolean, boolean]; // M T W T F S S
  classes: TrainClassOption[];
  coachComposition: CoachPositionItem[];
  schedule: ScheduleStop[];
  liveStatus: {
    currentStationCode: string;
    currentStationName: string;
    lastUpdated: string;
    delayMins: number;
    expectedPlatform: string;
    nextStationCode: string;
    nextStationName: string;
    nextStationEta: string;
    progressPercent: number;
  };
}

export interface UnreservedTrain {
  number: string;
  name: string;
  type: 'ORDINARY' | 'MEMU' | 'MAIL/EXP' | 'SUPERFAST';
  departureTime: string;
  arrivalTime: string;
  platform: string;
  status: string;
}

export interface SavedPassenger {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F' | 'T';
  berthPref: 'LB' | 'MB' | 'UB' | 'SL' | 'SU' | 'WS' | 'NC';
  mealPref: 'Veg' | 'Non-Veg' | 'No Food';
}

export interface BookingPassenger {
  name: string;
  age: number;
  gender: 'M' | 'F' | 'T';
  coach: string;
  berth: string;
  status: string;
}

export type BookingKind = 'reserved' | 'unreserved' | 'platform' | 'food';
export type BookingStatus = 'Confirmed' | 'WL' | 'Active' | 'Completed' | 'Cancelled' | 'Refunded';

export interface BookingRecord {
  id: string;
  kind: BookingKind;
  pnrOrTicketNo: string;
  irCode?: string;
  title: string;
  subtitle: string;
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  journeyDate: string; // ISO YYYY-MM-DD
  journeyDisplayDate: string;
  bookingDateLabel?: string;
  bookedAtTimestamp?: string;
  via?: string;
  adultsCount?: number;
  childrenCount?: number;
  distanceKm?: number;
  ticketType?: string;
  departureTime: string;
  arrivalTime?: string;
  classOrMode: string;
  quota?: string;
  fare: number;
  originalFare?: number;
  discountSaved?: number;
  paymentMethod: 'R-Wallet' | 'UPI' | 'Card';
  status: BookingStatus;
  passengers: BookingPassenger[];
  createdAt: string;
  validUntil?: string;
  refundAmount?: number;
  tdrReason?: string;
}

export interface WalletTransaction {
  id: string;
  title: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
  refId: string;
  category?: string;
  timeLabel?: string;
  remarks?: string;
  isRefund?: boolean;
}

export interface FoodItem {
  id: string;
  name: string;
  vendor: string;
  stationCode: string;
  price: number;
  isVeg: boolean;
  prepTimeMins: number;
  rating: number;
  description: string;
}

export interface RailMadadComplaint {
  id: string;
  referenceNo: string;
  mode: 'Train' | 'Station';
  location: string;
  helpFor: string;
  problemFaced: string;
  description: string;
  mediaType?: 'Video' | 'Audio' | 'Image';
  status: 'Registered' | 'In Progress' | 'Resolved';
  createdAt: string;
}

export interface FeedbackEntry {
  id: string;
  pnrOrTrain: string;
  rating: number;
  cleanliness: number;
  punctuality: number;
  comment: string;
  createdAt: string;
}

export interface UserProfile {
  name: string;
  userId: string;
  mobile: string;
  email: string;
  emailVerified: boolean;
  aadhaarVerified: boolean;
  nameEditedOnce: boolean;
  biometricEnabled: boolean;
  isGuest: boolean;
  rWalletBalance: number;
  mpinSet: boolean;
  dob?: string;
  gender?: 'Male' | 'Female' | 'Transgender';
  idType?: string;
  idNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  pinCode?: string;
  postOffice?: string;
  city?: string;
  state?: string;
  country?: string;
  divyangjanFlowEnabled?: boolean;
  aadhaarNumber?: string;
}
