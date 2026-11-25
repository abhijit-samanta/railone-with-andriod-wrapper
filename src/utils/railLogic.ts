import QRCode from 'qrcode';
import type {
  BookingKind,
  BookingRecord,
  BookingStatus,
  FeedbackEntry,
  QuotaType,
  RailMadadComplaint,
  SavedPassenger,
  TrainInfo,
  UserProfile,
  WalletTransaction,
} from '../types/rail';

export interface UnreservedFareResult {
  baseFare: number;
  discountAmount: number;
  finalFare: number;
  discountPercent: number;
}

/**
 * Computes Indian Railways UTS unreserved fare with 3% R-Wallet bonus discount.
 */
export function calculateUnreservedFare(params: {
  distanceKm: number;
  trainType: 'Ordinary' | 'Mail/Express' | 'Superfast';
  classCode: 'II' | 'FC';
  adults: number;
  children: number;
  mode: 'Normal' | 'Season';
  payWithRWallet: boolean;
  ticketType?: 'JOURNEY' | 'RETURN';
  availConcession?: boolean;
}): UnreservedFareResult {
  const dist = Math.max(5, params.distanceKm);
  const perKm =
    params.trainType === 'Ordinary' ? 0.35 : params.trainType === 'Mail/Express' ? 0.65 : 0.85;
  const classMultiplier = params.classCode === 'FC' ? 3.2 : 1;
  const singleAdultRaw = Math.max(10, Math.round((dist * perKm * classMultiplier) / 5) * 5);

  const passengerUnits = Math.max(1, params.adults) + Math.max(0, params.children) * 0.5;
  const seasonMultiplier = params.mode === 'Season' ? 15 : 1;
  const tripMultiplier = params.mode === 'Normal' && params.ticketType === 'RETURN' ? 2 : 1;
  const concessionMultiplier = params.availConcession ? 0.5 : 1;

  const baseFare = Math.max(
    5,
    Math.round(singleAdultRaw * passengerUnits * seasonMultiplier * tripMultiplier * concessionMultiplier)
  );
  const discountPercent = params.payWithRWallet ? 3 : 0;
  const discountAmount = params.payWithRWallet ? Number(((baseFare * 3) / 100).toFixed(2)) : 0;
  const finalFare = Number((baseFare - discountAmount).toFixed(2));

  return {
    baseFare,
    discountAmount,
    finalFare,
    discountPercent,
  };
}

export function calculatePlatformFare(persons: number): number {
  const safeCount = Math.min(4, Math.max(1, Math.floor(persons)));
  return safeCount * 10;
}

export function calculateReservedFare(params: {
  baseClassFare: number;
  quota: QuotaType;
  passengerCount: number;
  cateringSelected: boolean;
}): {
  ticketFare: number;
  quotaCharge: number;
  cateringCharge: number;
  convenienceFee: number;
  totalFare: number;
} {
  const count = Math.max(1, params.passengerCount);
  const ticketFare = params.baseClassFare * count;

  let perPaxQuota = 0;
  if (params.quota === 'Tatkal') {
    perPaxQuota = Math.min(400, Math.max(100, Math.round(params.baseClassFare * 0.3)));
  }
  const quotaCharge = perPaxQuota * count;
  const cateringCharge = params.cateringSelected ? 185 * count : 0;
  const convenienceFee = 20;
  const totalFare = ticketFare + quotaCharge + cateringCharge + convenienceFee;

  return {
    ticketFare,
    quotaCharge,
    cateringCharge,
    convenienceFee,
    totalFare,
  };
}

export function calculateRefundAmount(params: {
  fare: number;
  status: BookingStatus;
  hoursBeforeDeparture: number;
}): { refundAmount: number; deduction: number; ruleSummary: string } {
  if (params.status === 'Cancelled' || params.status === 'Refunded') {
    return {
      refundAmount: 0,
      deduction: params.fare,
      ruleSummary: 'Ticket is already cancelled or refunded.',
    };
  }

  if (params.status === 'WL') {
    const clerkage = Math.min(params.fare, 60);
    return {
      refundAmount: Math.max(0, params.fare - clerkage),
      deduction: clerkage,
      ruleSummary: 'Waitlisted ticket cancelled: ₹60 clerkage deducted.',
    };
  }

  if (params.hoursBeforeDeparture >= 48) {
    const flatFee = Math.min(params.fare, 180);
    return {
      refundAmount: Math.max(0, params.fare - flatFee),
      deduction: flatFee,
      ruleSummary: 'Cancelled >48h before departure: flat ₹180 cancellation charge.',
    };
  }

  if (params.hoursBeforeDeparture >= 12) {
    const deduction = Math.round(params.fare * 0.25);
    return {
      refundAmount: Math.max(0, params.fare - deduction),
      deduction,
      ruleSummary: 'Cancelled 12h–48h before departure: 25% cancellation deduction.',
    };
  }

  if (params.hoursBeforeDeparture >= 4) {
    const deduction = Math.round(params.fare * 0.5);
    return {
      refundAmount: Math.max(0, params.fare - deduction),
      deduction,
      ruleSummary: 'Cancelled 4h–12h before departure: 50% cancellation deduction.',
    };
  }

  return {
    refundAmount: 0,
    deduction: params.fare,
    ruleSummary: 'Less than 4h before departure: File TDR for special refund.',
  };
}

export interface BookingFilterCriteria {
  kind: 'all' | BookingKind;
  statusGroup: 'all' | 'active' | 'completed' | 'cancelled';
  durationDays: 'all' | 30 | 180;
  nowMs?: number;
}

export const UPCOMING_VALIDITY_HOURS = 24;
export const UPCOMING_VALIDITY_MS = UPCOMING_VALIDITY_HOURS * 60 * 60 * 1000;

export function parseBookingBookedDate(
  booking: Pick<BookingRecord, 'bookedAtTimestamp' | 'createdAt'>
): Date | null {
  const createdMs = booking.createdAt ? Date.parse(booking.createdAt) : Number.NaN;
  if (!Number.isNaN(createdMs)) {
    return new Date(createdMs);
  }
  if (booking.bookedAtTimestamp) {
    const match = booking.bookedAtTimestamp
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        match[6] ? Number(match[6]) : 0
      );
    }
    const parsedTs = Date.parse(booking.bookedAtTimestamp);
    if (!Number.isNaN(parsedTs)) {
      return new Date(parsedTs);
    }
  }
  return null;
}

export function isSaturdayReturnTicket(params: {
  bookedAt: Date;
  ticketType?: string;
}): boolean {
  return (
    params.ticketType?.trim().toUpperCase() === 'RETURN' &&
    params.bookedAt.getDay() === 6
  );
}

/**
 * Upcoming tickets remain valid for 24 hours by default.
 * Return tickets booked on Saturday remain valid up to Monday midnight (end of Monday, 00:00 Tuesday).
 */
export function calculateBookingValidUntil(params: {
  bookedAt: Date;
  ticketType?: string;
}): Date {
  if (isSaturdayReturnTicket(params)) {
    return new Date(
      params.bookedAt.getFullYear(),
      params.bookedAt.getMonth(),
      params.bookedAt.getDate() + 3,
      0,
      0,
      0,
      0
    );
  }
  return new Date(params.bookedAt.getTime() + UPCOMING_VALIDITY_MS);
}

export function resolveBookingValidUntilMs(
  booking: Pick<BookingRecord, 'validUntil' | 'bookedAtTimestamp' | 'createdAt' | 'ticketType'>
): number | null {
  if (booking.validUntil) {
    const explicitMs = Date.parse(booking.validUntil);
    if (!Number.isNaN(explicitMs)) {
      return explicitMs;
    }
  }
  const bookedAt = parseBookingBookedDate(booking);
  if (!bookedAt) return null;
  return calculateBookingValidUntil({
    bookedAt,
    ticketType: booking.ticketType,
  }).getTime();
}

export function resolveEffectiveBookingStatus(
  booking: BookingRecord,
  nowMs: number = Date.now()
): BookingStatus {
  if (
    booking.status === 'Cancelled' ||
    booking.status === 'Refunded' ||
    booking.status === 'Completed'
  ) {
    return booking.status;
  }
  const expiryMs = resolveBookingValidUntilMs(booking);
  if (expiryMs !== null && nowMs >= expiryMs) {
    return 'Completed';
  }
  return booking.status;
}

export function normalizeExpiredBookings(
  bookings: BookingRecord[],
  nowMs: number = Date.now()
): BookingRecord[] {
  let changed = false;
  const next = bookings.map((b) => {
    const effective = resolveEffectiveBookingStatus(b, nowMs);
    if (effective !== b.status) {
      changed = true;
      return {
        ...b,
        status: effective,
        passengers: b.passengers.map((p) =>
          p.status === 'ACTIVE' || p.status === 'CNF' || p.status === 'WL'
            ? { ...p, status: 'COMPLETED' }
            : p
        ),
      };
    }
    return b;
  });
  return changed ? next : bookings;
}

export function filterBookings(
  bookings: BookingRecord[],
  criteria: BookingFilterCriteria
): BookingRecord[] {
  const now = criteria.nowMs ?? Date.now();
  return bookings.filter((b) => {
    if (criteria.kind !== 'all' && b.kind !== criteria.kind) {
      return false;
    }

    const effectiveStatus = resolveEffectiveBookingStatus(b, now);

    if (criteria.statusGroup === 'active') {
      if (effectiveStatus !== 'Confirmed' && effectiveStatus !== 'WL' && effectiveStatus !== 'Active') {
        return false;
      }
    } else if (criteria.statusGroup === 'completed') {
      if (effectiveStatus !== 'Completed') return false;
    } else if (criteria.statusGroup === 'cancelled') {
      if (effectiveStatus !== 'Cancelled' && effectiveStatus !== 'Refunded') return false;
    }

    if (criteria.durationDays !== 'all') {
      const createdMs = Date.parse(b.createdAt);
      if (!Number.isNaN(createdMs)) {
        const diffDays = (now - createdMs) / (1000 * 60 * 60 * 24);
        if (diffDays > criteria.durationDays) return false;
      }
    }

    return true;
  });
}

export function searchTrains(
  trains: TrainInfo[],
  params: {
    fromCode?: string;
    toCode?: string;
    query?: string;
    onlyAvailable?: boolean;
  }
): TrainInfo[] {
  const q = (params.query ?? '').trim().toLowerCase();
  const from = (params.fromCode ?? '').trim().toUpperCase();
  const to = (params.toCode ?? '').trim().toUpperCase();

  return trains.filter((t) => {
    if (from && t.fromCode !== from && !t.schedule.some((s) => s.stationCode === from)) {
      return false;
    }
    if (to && t.toCode !== to && !t.schedule.some((s) => s.stationCode === to)) {
      return false;
    }
    if (from && to) {
      const idxFrom = t.schedule.findIndex((s) => s.stationCode === from);
      const idxTo = t.schedule.findIndex((s) => s.stationCode === to);
      if (idxFrom !== -1 && idxTo !== -1 && idxFrom >= idxTo) {
        return false;
      }
    }
    if (q) {
      const matchesNameOrNumber =
        t.number.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
      if (!matchesNameOrNumber) return false;
    }
    if (params.onlyAvailable) {
      const hasAvail = t.classes.some((c) => c.kind === 'available');
      if (!hasAvail) return false;
    }
    return true;
  });
}

export function validatePnr(pnr: string): boolean {
  return /^\d{10}$/.test(pnr.trim());
}

export function generatePnr(seedNumber?: number): string {
  const prefix = ['241', '652', '834', '419', '671'][Math.floor(Math.random() * 5)];
  const tail =
    seedNumber !== undefined
      ? String(Math.abs(seedNumber) % 10000000).padStart(7, '0')
      : String(Math.floor(1000000 + Math.random() * 9000000));
  return `${prefix}${tail}`;
}

export function generateUtsNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let out = 'X';
    for (let i = 0; i < 9; i += 1) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    if (/[A-Z]/.test(out.slice(1)) && /\d/.test(out)) {
      return out;
    }
  }
  return `XEC${Math.floor(1000000 + Math.random() * 9000000)}`;
}

export const IR_CODE_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9][A-Z][0-9A-Z]$/;

const UPPER_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALPHANUM_UPPER = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateRandomIrCode(): string {
  const randChar = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
  const stateDigits = String(1 + Math.floor(Math.random() * 38)).padStart(2, '0');
  let panLetters = '';
  for (let i = 0; i < 5; i += 1) {
    panLetters += randChar(UPPER_ALPHA);
  }
  const panDigits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const panTailLetter = randChar(UPPER_ALPHA);
  const entityDigit = String(1 + Math.floor(Math.random() * 9));
  const defaultLetter = 'Z';
  const checkChar = randChar(ALPHANUM_UPPER);
  return `${stateDigits}${panLetters}${panDigits}${panTailLetter}${entityDigit}${defaultLetter}${checkChar}`;
}

export function resolveBookingIrCode(booking: BookingRecord): string {
  if (booking.irCode && IR_CODE_PATTERN.test(booking.irCode)) {
    return booking.irCode;
  }
  const seed = `${booking.id}|${booking.pnrOrTicketNo}|${
    booking.bookedAtTimestamp ?? booking.createdAt
  }|${booking.fromCode}|${booking.toCode}`;
  let h1 = 2166136261;
  let h2 = 374761393;
  let h3 = 2654435761;
  for (let i = 0; i < seed.length; i += 1) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 16777619);
    h2 = Math.imul(h2 ^ (ch + i * 7), 2246822519);
    h3 = Math.imul(h3 ^ (ch * 31), 3266489917);
  }
  const nextRand = (idx: number) => {
    h1 = Math.imul(h1 ^ (idx + 17), 16777619);
    h2 = Math.imul(h2 ^ (h1 >>> 13), 2246822519);
    return (h1 ^ h2 ^ h3) >>> 0;
  };
  const stateDigits = String(1 + (nextRand(0) % 38)).padStart(2, '0');
  let panLetters = '';
  for (let i = 0; i < 5; i += 1) {
    panLetters += UPPER_ALPHA[nextRand(i + 1) % UPPER_ALPHA.length];
  }
  const panDigits = String(nextRand(6) % 10000).padStart(4, '0');
  const panTailLetter = UPPER_ALPHA[nextRand(7) % UPPER_ALPHA.length];
  const entityDigit = String(1 + (nextRand(8) % 9));
  const checkChar = ALPHANUM_UPPER[nextRand(9) % ALPHANUM_UPPER.length];
  return `${stateDigits}${panLetters}${panDigits}${panTailLetter}${entityDigit}Z${checkChar}`;
}

export function computeProfileCompletion(profile: UserProfile): number {
  let score = 0;
  if (profile.name.trim().length > 1) score += 25;
  if (profile.mobile.trim().length >= 10) score += 20;
  if (profile.email.includes('@')) score += 15;
  if (profile.emailVerified) score += 15;
  if (profile.aadhaarVerified) score += 15;
  if (profile.mpinSet) score += 10;
  return Math.min(100, score);
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function formatBookingDateLabel(date: Date = new Date()): string {
  const dayName = SHORT_DAYS[date.getDay()];
  const dayNum = String(date.getDate()).padStart(2, '0');
  const monthName = SHORT_MONTHS[date.getMonth()];
  const yr = String(date.getFullYear()).slice(-2);
  return `${dayName}, ${dayNum} ${monthName} ${yr}`;
}

export function formatBookingTimestamp(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function formatSaturdayReturnValidityLabel(validUntil: Date): string {
  // validUntil is Tuesday 00:00:00.000 (end of Monday); subtract 1ms to show Monday's calendar date
  const mondayDate = new Date(validUntil.getTime() - 1);
  const dd = String(mondayDate.getDate()).padStart(2, '0');
  const mon = SHORT_MONTHS[mondayDate.getMonth()];
  return `Mon, ${dd} ${mon} · 12:00 Midnight`;
}

export function buildBookingSummarySpec(
  booking: BookingRecord,
  nowMs: number = Date.now()
): {
  headerBadge: string;
  invoiceCategoryTitle: string;
  bookedOnLine: string;
  viaLabel: string;
  statusLine: string;
  passengerLabelDetails: string;
  passengerLabelInvoice: string;
  tariffLine: string;
} {
  const headerBadge =
    booking.kind === 'unreserved'
      ? 'JOURNEY'
      : booking.kind === 'platform'
      ? 'PLATFORM'
      : booking.kind === 'food'
      ? 'FOOD ORDER'
      : 'RESERVED';

  const invoiceCategoryTitle =
    booking.kind === 'unreserved'
      ? 'Journey Ticket'
      : booking.kind === 'platform'
      ? 'Platform Ticket'
      : booking.kind === 'food'
      ? 'E-Catering Order'
      : 'Reserved Ticket';

  let bookedOnLine = booking.bookedAtTimestamp;
  if (!bookedOnLine) {
    const parsed = new Date(booking.createdAt);
    bookedOnLine = Number.isNaN(parsed.getTime())
      ? `${booking.journeyDate} 12:00:00`
      : formatBookingTimestamp(parsed);
  }

  const viaLabel = booking.via?.trim() ? booking.via : '-';
  const effectiveStatus = resolveEffectiveBookingStatus(booking, nowMs);

  const statusLine =
    effectiveStatus === 'Completed'
      ? 'Ticket Expired'
      : effectiveStatus === 'Cancelled'
      ? 'Ticket Cancelled'
      : effectiveStatus === 'Refunded'
      ? 'Ticket Refunded'
      : effectiveStatus === 'WL'
      ? 'Ticket Waitlisted'
      : booking.kind === 'unreserved' || booking.kind === 'platform'
      ? `Ticket Active · ${booking.journeyDisplayDate}`
      : 'Ticket Confirmed';

  let adults = booking.adultsCount;
  let children = booking.childrenCount;
  if (adults === undefined || children === undefined) {
    const firstName = booking.passengers[0]?.name ?? '';
    const adultMatch = firstName.match(/(\d+)\s*Adult/i);
    const childMatch = firstName.match(/(\d+)\s*Child/i);
    if (adultMatch || childMatch) {
      adults = adultMatch ? Number(adultMatch[1]) : 1;
      children = childMatch ? Number(childMatch[1]) : 0;
    } else if (booking.kind === 'reserved' || booking.kind === 'food') {
      adults = Math.max(1, booking.passengers.length);
      children = 0;
    } else {
      adults = 1;
      children = 0;
    }
  }

  const adultWord = adults === 1 ? 'Adult' : 'Adults';
  const childWord = children === 1 ? 'Child' : 'Children';
  const passengerLabelDetails = `${adults} ${adultWord} , ${children} ${children === 0 ? 'Child' : childWord}`;
  const passengerLabelInvoice = `${adults} ${adultWord}, ${children} ${children === 0 ? 'Child' : childWord}`;

  const displayFare =
    booking.originalFare ??
    (booking.discountSaved && booking.discountSaved > 0
      ? Number((booking.fare + booking.discountSaved).toFixed(2))
      : booking.fare);

  let tariffLine: string;
  if (booking.kind === 'unreserved') {
    const rawClass = booking.classOrMode.toUpperCase();
    const className = rawClass.includes('FC') || rawClass.includes('FIRST') ? 'FIRST' : 'SECOND';
    const modeName = rawClass.includes('SUPERFAST')
      ? 'SUPERFAST'
      : rawClass.includes('MAIL') || rawClass.includes('EXP')
      ? 'MAIL/EXP'
      : 'ORDINARY';
    const typeName = (booking.ticketType ?? 'JOURNEY').toUpperCase();
    tariffLine = `${className} | ${modeName} | ${typeName} | ₹${displayFare.toFixed(2)}`;
  } else if (booking.kind === 'platform') {
    tariffLine = `PLATFORM | ENTRY | 2 HRS | ₹${displayFare.toFixed(2)}`;
  } else {
    tariffLine = `${booking.classOrMode.toUpperCase()} | ${booking.quota?.toUpperCase() ?? 'GN'} | ₹${displayFare.toFixed(2)}`;
  }

  return {
    headerBadge,
    invoiceCategoryTitle,
    bookedOnLine,
    viaLabel,
    statusLine,
    passengerLabelDetails,
    passengerLabelInvoice,
    tariffLine,
  };
}

export function formatUpcomingPreviewDateTime(booking: BookingRecord): string {
  const rawTs = booking.bookedAtTimestamp;
  if (rawTs) {
    const match = rawTs.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (match) {
      const yr = match[1];
      const monthIdx = Math.max(0, Math.min(11, Number(match[2]) - 1));
      const dayNum = String(Number(match[3])).padStart(2, '0');
      const hh = match[4];
      const min = match[5];
      return `${dayNum} ${SHORT_MONTHS[monthIdx]} ${yr}, ${hh}:${min}`;
    }
  }
  const parsed = new Date(booking.createdAt);
  if (!Number.isNaN(parsed.getTime())) {
    const dayNum = String(parsed.getDate()).padStart(2, '0');
    const monthName = SHORT_MONTHS[parsed.getMonth()];
    const yr = parsed.getFullYear();
    const hh = String(parsed.getHours()).padStart(2, '0');
    const min = String(parsed.getMinutes()).padStart(2, '0');
    return `${dayNum} ${monthName} ${yr}, ${hh}:${min}`;
  }
  return `${booking.journeyDate}, 00:00`;
}

export function buildUpcomingTicketFields(booking: BookingRecord): {
  categoryTitle: string;
  statusBadge: string;
  bookingDateTime: string;
  subRefCode: string;
  irCode: string;
  distanceLabel: string;
  passengerLabel: string;
  ticketTypeLabel: string;
  trainTypeLabel: string;
  classLabel: string;
  fareLabel: string;
  viaLabel: string;
} {
  const summary = buildBookingSummarySpec(booking);
  const displayFare =
    booking.originalFare ??
    (booking.discountSaved && booking.discountSaved > 0
      ? Number((booking.fare + booking.discountSaved).toFixed(2))
      : booking.fare);

  const rawClass = booking.classOrMode.toUpperCase();
  const classLabel =
    booking.kind === 'unreserved'
      ? rawClass.includes('FC') || rawClass.includes('FIRST')
        ? 'FIRST'
        : 'SECOND'
      : booking.kind === 'platform'
      ? 'PLATFORM'
      : booking.classOrMode.toUpperCase();

  const trainTypeLabel =
    booking.kind === 'unreserved'
      ? rawClass.includes('SUPERFAST')
        ? 'SUPERFAST'
        : rawClass.includes('MAIL') || rawClass.includes('EXP')
        ? 'MAIL/EXP'
        : 'ORDINARY'
      : booking.kind === 'platform'
      ? 'ENTRY PASS'
      : booking.departureTime.toUpperCase();

  const ticketTypeLabel =
    booking.kind === 'unreserved'
      ? (booking.ticketType ?? 'JOURNEY').toUpperCase()
      : booking.kind === 'platform'
      ? 'PLATFORM'
      : (booking.quota ?? 'GENERAL').toUpperCase();

  const statusBadge =
    booking.status === 'Confirmed'
      ? 'CONFIRMED'
      : booking.status === 'WL'
      ? 'WL'
      : 'ACTIVE';

  let hash = 27675;
  for (let i = 0; i < booking.pnrOrTicketNo.length; i += 1) {
    hash = (hash * 31 + booking.pnrOrTicketNo.charCodeAt(i)) % 90000;
  }
  const subRefCode = `R${String(10000 + hash).slice(0, 5)}`;

  return {
    categoryTitle: summary.invoiceCategoryTitle,
    statusBadge,
    bookingDateTime: formatUpcomingPreviewDateTime(booking),
    subRefCode,
    irCode: resolveBookingIrCode(booking),
    distanceLabel:
      booking.distanceKm !== undefined && booking.distanceKm > 0
        ? `${booking.distanceKm} km`
        : '—',
    passengerLabel: summary.passengerLabelInvoice,
    ticketTypeLabel,
    trainTypeLabel,
    classLabel,
    fareLabel: `₹${displayFare.toFixed(2)}`,
    viaLabel: summary.viaLabel,
  };
}

export function formatCountdownParts(secondsLeft: number): { mins: string; secs: string } {
  const clamped = Math.max(0, Math.floor(secondsLeft));
  const mins = String(Math.floor(clamped / 60)).padStart(2, '0');
  const secs = String(clamped % 60).padStart(2, '0');
  return { mins, secs };
}

export function calculateCountdownProgress(secondsLeft: number, totalSeconds = 300): number {
  if (totalSeconds <= 0) return 100;
  const clamped = Math.max(0, Math.min(totalSeconds, secondsLeft));
  return Number((((totalSeconds - clamped) / totalSeconds) * 100).toFixed(4));
}

export function buildHighDensityQrData(
  seedStr: string,
  size = 133
): { size: number; pathData: string; alignmentCenters: number[] } {
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinder = (row0: number, col0: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = row0 + r;
        const cc = col0 + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        reserved[rr][cc] = true;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          grid[rr][cc] = false;
        } else if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          grid[rr][cc] = true;
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Version 29 (133x133) alignment pattern grid centers (6x6 grid matching UTS high-density QR)
  const alignmentCenters = [6, 30, 54, 78, 102, size - 7];
  const lastIdx = alignmentCenters.length - 1;
  for (let i = 0; i < alignmentCenters.length; i += 1) {
    for (let j = 0; j < alignmentCenters.length; j += 1) {
      if ((i === 0 && j === 0) || (i === 0 && j === lastIdx) || (i === lastIdx && j === 0)) {
        continue;
      }
      const ar = alignmentCenters[i];
      const ac = alignmentCenters[j];
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          const rr = ar + r;
          const cc = ac + c;
          reserved[rr][cc] = true;
          grid[rr][cc] =
            Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i += 1) {
    if (!reserved[6][i]) {
      reserved[6][i] = true;
      grid[6][i] = i % 2 === 0;
    }
    if (!reserved[i][6]) {
      reserved[i][6] = true;
      grid[i][6] = i % 2 === 0;
    }
  }

  // Format information reserved strips around finders
  for (let i = 0; i <= 8; i += 1) {
    if (!reserved[8][i]) {
      reserved[8][i] = true;
      grid[8][i] = i % 3 !== 1;
    }
    if (!reserved[i][8]) {
      reserved[i][8] = true;
      grid[i][8] = i % 2 === 0;
    }
  }
  for (let i = size - 8; i < size; i += 1) {
    reserved[8][i] = true;
    grid[8][i] = i % 2 === 1;
    if (i < size - 7) continue;
    reserved[i][8] = true;
    grid[i][8] = i % 2 === 0;
  }

  // Version information 6x3 & 3x6 blocks beside top-right & bottom-left finders
  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      reserved[r][size - 11 + c] = true;
      grid[r][size - 11 + c] = ((r + c) % 2) === 0;
      reserved[size - 11 + c][r] = true;
      grid[size - 11 + c][r] = ((r + c) % 2) === 0;
    }
  }

  // Dark module
  reserved[size - 8][8] = true;
  grid[size - 8][8] = true;

  // Deterministic seeded PRNG for dense authentic UTS QR data codewords
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i += 1) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (reserved[r][c]) continue;
      h ^= ((r + 1) * 131 + (c + 1) * 67) & 0xff;
      h = Math.imul(h, 16777619);
      grid[r][c] = ((h >>> 16) & 1) === 1;
    }
  }

  const parts: string[] = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (grid[r][c]) {
        parts.push(`M${c} ${r}h1v1h-1z`);
      }
    }
  }

  return {
    size,
    pathData: parts.join(''),
    alignmentCenters,
  };
}

export function buildScannableTicketQrData(
  payload: string,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'H'
): { size: number; pathData: string } {
  const safePayload = payload.trim() || 'RAILONE-UTS-TICKET';
  const qr = QRCode.create(safePayload, { errorCorrectionLevel });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const parts: string[] = [];

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (data[r * size + c]) {
        parts.push(`M${c} ${r}h1v1h-1z`);
      }
    }
  }

  return {
    size,
    pathData: parts.join(''),
  };
}

export function getUpcomingBookings(
  bookings: BookingRecord[],
  nowMs: number = Date.now()
): BookingRecord[] {
  return bookings
    .filter((b) => {
      const effectiveStatus = resolveEffectiveBookingStatus(b, nowMs);
      return effectiveStatus === 'Active' || effectiveStatus === 'Confirmed' || effectiveStatus === 'WL';
    })
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

export function formatBookingKindLabel(kind: BookingKind): string {
  switch (kind) {
    case 'unreserved':
      return 'Unreserved';
    case 'reserved':
      return 'Reserved';
    case 'platform':
      return 'Platform';
    case 'food':
      return 'Food Order';
    default:
      return 'Ticket';
  }
}

const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function maskIdNumber(idNumber: string): string {
  const cleaned = idNumber.trim().toUpperCase();
  if (!cleaned) return '—';
  if (cleaned.length <= 4) return `${cleaned}******`;
  const visible = cleaned.slice(0, 4);
  const maskLen = Math.max(6, cleaned.length - 4);
  return `${visible}${'*'.repeat(maskLen)}`;
}

export function formatOrdinalDob(input: string): string {
  const trimmed = input.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) return trimmed;
  const year = Number(isoMatch[1]);
  const monthIdx = Number(isoMatch[2]) - 1;
  const day = Number(isoMatch[3]);
  if (monthIdx < 0 || monthIdx > 11 || day < 1 || day > 31) return trimmed;
  const mod100 = day % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? 'th'
      : day % 10 === 1
      ? 'st'
      : day % 10 === 2
      ? 'nd'
      : day % 10 === 3
      ? 'rd'
      : 'th';
  return `${day}${suffix} ${FULL_MONTHS[monthIdx]}, ${year}`;
}

export function formatTransactionTimeLabel(date: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const dayName = SHORT_DAYS[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mon = SHORT_MONTHS[date.getMonth()];
  return `${hh}:${min} ${dayName}, ${dd} ${mon}`;
}

export function generateTransactionId(): string {
  const lead = String(1 + Math.floor(Math.random() * 8));
  let tail = '';
  for (let i = 0; i < 15; i += 1) {
    tail += String(Math.floor(Math.random() * 10));
  }
  return `${lead}${tail}`;
}

export function resolveTransactionDisplay(tx: WalletTransaction): {
  category: string;
  txnId: string;
  timeLabel: string;
  amountLabel: string;
  remarks: string;
  isRefund: boolean;
} {
  const lowerTitle = tx.title.toLowerCase();
  const isRefund =
    Boolean(tx.isRefund) || lowerTitle.includes('refund');

  let category = tx.category;
  if (!category) {
    if (isRefund) {
      category = 'Refund';
    } else if (lowerTitle.includes('top-up') || lowerTitle.includes('recharge')) {
      category = 'R-Wallet Top-up';
    } else if (lowerTitle.includes('platform')) {
      category = 'Platform';
    } else if (lowerTitle.includes('reserved') && !lowerTitle.includes('unreserved')) {
      category = 'Reserved';
    } else if (lowerTitle.includes('food') || lowerTitle.includes('meal')) {
      category = 'Food Order';
    } else {
      category = 'Unreserved';
    }
  }

  const remarks =
    tx.remarks ??
    (isRefund
      ? 'Refund Credited'
      : lowerTitle.includes('top-up') || lowerTitle.includes('recharge')
      ? 'Wallet Credited'
      : 'Ticket Booked');

  return {
    category,
    txnId: tx.refId,
    timeLabel: tx.timeLabel ?? tx.date,
    amountLabel: `₹ ${tx.amount.toFixed(1)}`,
    remarks,
    isRefund,
  };
}

export const INITIAL_NEW_USER_WALLET_BALANCE = 5001;

export function deductWalletBalance(currentBalance: number, debitAmount: number): number {
  const safeCurrent = Number.isFinite(currentBalance) ? currentBalance : 0;
  const safeDebit = Number.isFinite(debitAmount) && debitAmount > 0 ? debitAmount : 0;
  return Number(Math.max(0, safeCurrent - safeDebit).toFixed(2));
}

export function resolveInitialUserProfile(params: {
  seedProfile: UserProfile;
  storedV2Raw: string | null;
  legacyStoredRaw: string | null;
}): UserProfile {
  if (params.storedV2Raw) {
    try {
      const parsed = JSON.parse(params.storedV2Raw) as Partial<UserProfile>;
      if (parsed && typeof parsed === 'object') {
        return {
          ...params.seedProfile,
          ...parsed,
          rWalletBalance:
            typeof parsed.rWalletBalance === 'number' && Number.isFinite(parsed.rWalletBalance)
              ? parsed.rWalletBalance
              : INITIAL_NEW_USER_WALLET_BALANCE,
        };
      }
    } catch {
      // fall through to legacy or fresh seed
    }
  }

  if (params.legacyStoredRaw) {
    try {
      const legacy = JSON.parse(params.legacyStoredRaw) as Partial<UserProfile>;
      if (legacy && typeof legacy === 'object') {
        return {
          ...params.seedProfile,
          ...legacy,
          rWalletBalance: INITIAL_NEW_USER_WALLET_BALANCE,
        };
      }
    } catch {
      // fall through to fresh seed
    }
  }

  return {
    ...params.seedProfile,
    rWalletBalance: INITIAL_NEW_USER_WALLET_BALANCE,
  };
}

export function isWalletExhausted(rWalletBalance: number): boolean {
  return !Number.isFinite(rWalletBalance) || rWalletBalance <= 0;
}

export function canBookTicketWithWallet(params: {
  rWalletBalance: number;
  payableFare: number;
}): { allowed: boolean; reason: string | null } {
  const balance = Number.isFinite(params.rWalletBalance) ? params.rWalletBalance : 0;
  const fare = Number.isFinite(params.payableFare) ? params.payableFare : 0;

  if (isWalletExhausted(balance)) {
    return {
      allowed: false,
      reason:
        'Your R-Wallet balance is ₹0.00. You have used all your wallet balance and cannot book any ticket.',
    };
  }

  if (fare > 0 && balance < fare) {
    return {
      allowed: false,
      reason: `Insufficient R-Wallet balance (₹${balance.toFixed(2)}). Need ₹${fare.toFixed(2)} to book this ticket.`,
    };
  }

  return { allowed: true, reason: null };
}

export interface StoredUserSummary {
  userKey: string;
  name: string;
  mobile: string;
  mpin: string;
  rWalletBalance: number;
}

export interface MpinAuthSession {
  isLifetimeLoggedIn: boolean;
  activeUserKey: string;
  usersByKey: Record<string, StoredUserSummary>;
}

export function normalizeAuthUserKey(userIdOrMobile: string): string {
  const cleaned = userIdOrMobile.trim().toLowerCase();
  return cleaned || 'default_user';
}

export function createInitialMpinAuthSession(profile: UserProfile): MpinAuthSession {
  const userKey = normalizeAuthUserKey(profile.userId || profile.mobile || 'kailash_rail');
  return {
    isLifetimeLoggedIn: false,
    activeUserKey: userKey,
    usersByKey: {},
  };
}

export function resolveInitialMpinAuthSession(params: {
  storedRaw: string | null;
  profile: UserProfile;
}): MpinAuthSession {
  const fallback = createInitialMpinAuthSession(params.profile);
  if (!params.storedRaw) return fallback;
  try {
    const parsed = JSON.parse(params.storedRaw) as Partial<MpinAuthSession>;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const usersByKey =
      parsed.usersByKey && typeof parsed.usersByKey === 'object' ? parsed.usersByKey : {};
    const activeUserKey =
      typeof parsed.activeUserKey === 'string' && parsed.activeUserKey.trim()
        ? normalizeAuthUserKey(parsed.activeUserKey)
        : fallback.activeUserKey;
    return {
      isLifetimeLoggedIn: Boolean(parsed.isLifetimeLoggedIn),
      activeUserKey,
      usersByKey,
    };
  } catch {
    return fallback;
  }
}

export function hasRegisteredOneTimeMpin(session: MpinAuthSession, userKey: string): boolean {
  const key = normalizeAuthUserKey(userKey);
  const existing = session.usersByKey[key];
  return Boolean(existing && /^[A-Za-z0-9]{6}$/.test(existing.mpin));
}

export function resolveLocalUserByMpin(
  session: MpinAuthSession,
  enteredMpin: string
): StoredUserSummary | null {
  const cleanMpin = enteredMpin.trim();
  if (!/^[A-Za-z0-9]{6}$/.test(cleanMpin)) return null;
  return (
    Object.values(session.usersByKey).find(
      (u) => /^[A-Za-z0-9]{6}$/.test(u.mpin) && u.mpin === cleanMpin
    ) ?? null
  );
}

export function submitMpinLogin(params: {
  session: MpinAuthSession;
  userKey: string;
  userName: string;
  mobile: string;
  currentBalance: number;
  enteredMpin: string;
}): {
  ok: boolean;
  error: string | null;
  nextSession: MpinAuthSession;
  isFirstTimeSetup: boolean;
} {
  const cleanMpin = params.enteredMpin.trim();
  if (!/^[A-Za-z0-9]{6}$/.test(cleanMpin)) {
    return {
      ok: false,
      error: 'Please enter a valid 6-character mPIN.',
      nextSession: params.session,
      isFirstTimeSetup: false,
    };
  }

  const key = normalizeAuthUserKey(params.userKey);

  // Returning user logging in directly by mPIN (without re-creating a user on a fresh install/switch)
  if (key === PENDING_USER_KEY) {
    const matchedLocal = resolveLocalUserByMpin(params.session, cleanMpin);
    if (matchedLocal) {
      const matchedKey = normalizeAuthUserKey(matchedLocal.userKey);
      return {
        ok: true,
        error: null,
        isFirstTimeSetup: false,
        nextSession: {
          isLifetimeLoggedIn: true,
          activeUserKey: matchedKey,
          usersByKey: params.session.usersByKey,
        },
      };
    }
    return {
      ok: true,
      error: null,
      isFirstTimeSetup: false,
      nextSession: params.session,
    };
  }

  const existing = params.session.usersByKey[key];

  // Existing user: enforce "one user, one mPIN"
  if (existing && /^[A-Za-z0-9]{6}$/.test(existing.mpin)) {
    if (cleanMpin !== existing.mpin) {
      return {
        ok: false,
        error: 'Incorrect mPIN. One user can only use their registered 6-character mPIN.',
        nextSession: params.session,
        isFirstTimeSetup: false,
      };
    }

    return {
      ok: true,
      error: null,
      isFirstTimeSetup: false,
      nextSession: {
        isLifetimeLoggedIn: true,
        activeUserKey: key,
        usersByKey: {
          ...params.session.usersByKey,
          [key]: {
            ...existing,
            name: params.userName.trim() || existing.name,
            mobile: params.mobile.trim() || existing.mobile,
          },
        },
      },
    };
  }

  // First-time new user setup: ensure no other local user already owns this mPIN
  const ownerOfMpin = Object.values(params.session.usersByKey).find(
    (u) => normalizeAuthUserKey(u.userKey) !== key && u.mpin === cleanMpin
  );
  if (ownerOfMpin) {
    return {
      ok: false,
      error: 'This mPIN is already used and linked to another user. Each user must use their own mPIN.',
      nextSession: params.session,
      isFirstTimeSetup: false,
    };
  }

  // First-time new user setup: binds mPIN once permanently + activates lifetime login
  return {
    ok: true,
    error: null,
    isFirstTimeSetup: true,
    nextSession: {
      isLifetimeLoggedIn: true,
      activeUserKey: key,
      usersByKey: {
        ...params.session.usersByKey,
        [key]: {
          userKey: key,
          name: params.userName.trim() || 'RailOne Traveller',
          mobile: params.mobile.trim() || '9876543210',
          mpin: cleanMpin,
          rWalletBalance: Number.isFinite(params.currentBalance)
            ? params.currentBalance
            : INITIAL_NEW_USER_WALLET_BALANCE,
        },
      },
    },
  };
}

export function loginWithBiometricSession(params: {
  session: MpinAuthSession;
  userKey: string;
}): { ok: boolean; error: string | null; nextSession: MpinAuthSession } {
  const key = normalizeAuthUserKey(params.userKey);
  if (!hasRegisteredOneTimeMpin(params.session, key)) {
    return {
      ok: false,
      error: 'New user: please enter a 6-character mPIN once to set up lifetime login.',
      nextSession: params.session,
    };
  }

  return {
    ok: true,
    error: null,
    nextSession: {
      ...params.session,
      isLifetimeLoggedIn: true,
      activeUserKey: key,
    },
  };
}

export function switchOrCreateAuthUser(params: {
  session: MpinAuthSession;
  name: string;
  mobile: string;
  initialBalance?: number;
}): {
  ok: boolean;
  error: string | null;
  userKey: string;
  existingUser: StoredUserSummary | null;
  nextSession: MpinAuthSession;
} {
  const cleanName = params.name.trim().replace(/\s+/g, ' ');
  const cleanMobile = params.mobile.replace(/\D/g, '');
  if (!cleanName) {
    return {
      ok: false,
      error: 'Please enter the user name.',
      userKey: params.session.activeUserKey,
      existingUser: null,
      nextSession: params.session,
    };
  }
  if (!/^\d{10}$/.test(cleanMobile)) {
    return {
      ok: false,
      error: 'Please enter a valid 10-digit mobile number.',
      userKey: params.session.activeUserKey,
      existingUser: null,
      nextSession: params.session,
    };
  }

  const userKey = normalizeAuthUserKey(`user_${cleanMobile}`);
  const existingUser = params.session.usersByKey[userKey] ?? null;

  if (
    existingUser &&
    /^[A-Za-z0-9]{6}$/.test(existingUser.mpin) &&
    existingUser.name.trim().replace(/\s+/g, ' ').toLowerCase() !== cleanName.toLowerCase()
  ) {
    return {
      ok: false,
      error: 'This mobile number is already registered and linked to another user name.',
      userKey: params.session.activeUserKey,
      existingUser: null,
      nextSession: params.session,
    };
  }

  return {
    ok: true,
    error: null,
    userKey,
    existingUser,
    nextSession: {
      ...params.session,
      isLifetimeLoggedIn: false,
      activeUserKey: userKey,
      usersByKey: existingUser
        ? {
            ...params.session.usersByKey,
            [userKey]: {
              ...existingUser,
              name: existingUser.mpin ? existingUser.name : cleanName,
            },
          }
        : params.session.usersByKey,
    },
  };
}

export function logoutToMpinScreen(
  session: MpinAuthSession,
  activeBalance: number
): MpinAuthSession {
  const key = normalizeAuthUserKey(session.activeUserKey);
  const existing = session.usersByKey[key];
  return {
    ...session,
    isLifetimeLoggedIn: false,
    usersByKey: existing
      ? {
          ...session.usersByKey,
          [key]: {
            ...existing,
            rWalletBalance: Number.isFinite(activeBalance) ? activeBalance : existing.rWalletBalance,
          },
        }
      : session.usersByKey,
  };
}

export interface UserDataSnapshot {
  profile: UserProfile;
  bookings: BookingRecord[];
  savedPassengers: SavedPassenger[];
  walletTransactions: WalletTransaction[];
  complaints: RailMadadComplaint[];
  feedbacks: FeedbackEntry[];
}

export const DEFAULT_SEED_USER_KEY = 'kailash_rail';
export const PENDING_USER_KEY = 'pending_user';

export function isDefaultSeedUserKey(userKey: string): boolean {
  return normalizeAuthUserKey(userKey) === DEFAULT_SEED_USER_KEY;
}

export function isPendingUserOnboarding(profile: UserProfile, activeUserKey: string): boolean {
  const key = normalizeAuthUserKey(activeUserKey);
  return (
    key === PENDING_USER_KEY ||
    key === 'default_user' ||
    !profile.name.trim() ||
    !/^\d{10}$/.test(profile.mobile.replace(/\D/g, ''))
  );
}

export function getUserDataStorageKey(userKey: string): string {
  return `railone_user_data_v1_${normalizeAuthUserKey(userKey)}`;
}

export function getRecentUnreservedStorageKey(userKey: string): string {
  return `railone_recent_unreserved_${normalizeAuthUserKey(userKey)}`;
}

export function getRecentPlatformStorageKey(userKey: string): string {
  return `railone_recent_platform_${normalizeAuthUserKey(userKey)}`;
}

export function createCleanNewUserProfile(params: {
  userKey: string;
  name: string;
  mobile: string;
  initialBalance?: number;
  mpinSet?: boolean;
  allowEmptyName?: boolean;
}): UserProfile {
  const trimmedName = params.name.trim();
  return {
    name: params.allowEmptyName ? trimmedName : trimmedName || 'RailOne User',
    userId: normalizeAuthUserKey(params.userKey),
    mobile: params.mobile.replace(/\D/g, ''),
    email: '',
    emailVerified: false,
    aadhaarVerified: false,
    nameEditedOnce: false,
    biometricEnabled: false,
    isGuest: false,
    rWalletBalance:
      typeof params.initialBalance === 'number' && Number.isFinite(params.initialBalance)
        ? params.initialBalance
        : INITIAL_NEW_USER_WALLET_BALANCE,
    mpinSet: Boolean(params.mpinSet),
    dob: '',
    gender: 'Male',
    idType: '',
    idNumber: '',
    addressLine1: '',
    addressLine2: '',
    pinCode: '',
    postOffice: '',
    city: '',
    state: '',
    country: 'India',
    divyangjanFlowEnabled: false,
    aadhaarNumber: '',
  };
}

export function createCleanNewUserData(params: {
  userKey: string;
  name: string;
  mobile: string;
  initialBalance?: number;
  mpinSet?: boolean;
  allowEmptyName?: boolean;
}): UserDataSnapshot {
  return {
    profile: createCleanNewUserProfile(params),
    bookings: [],
    savedPassengers: [],
    walletTransactions: [],
    complaints: [],
    feedbacks: [],
  };
}

export function resolveFreshInstallSession(): MpinAuthSession {
  return {
    isLifetimeLoggedIn: false,
    activeUserKey: PENDING_USER_KEY,
    usersByKey: {},
  };
}

export function resolveUserDataSnapshot(params: {
  userKey: string;
  scopedRaw: string | null;
  seedData: UserDataSnapshot;
  legacyData?: Partial<UserDataSnapshot> | null;
  fallbackName?: string;
  fallbackMobile?: string;
}): UserDataSnapshot {
  const key = normalizeAuthUserKey(params.userKey);
  if (key === PENDING_USER_KEY) {
    return createCleanNewUserData({
      userKey: PENDING_USER_KEY,
      name: '',
      mobile: '',
      initialBalance: INITIAL_NEW_USER_WALLET_BALANCE,
      mpinSet: false,
      allowEmptyName: true,
    });
  }

  if (params.scopedRaw) {
    try {
      const parsed = JSON.parse(params.scopedRaw) as Partial<UserDataSnapshot>;
      if (parsed && typeof parsed === 'object' && parsed.profile) {
        return {
          profile: {
            ...createCleanNewUserProfile({
              userKey: key,
              name: parsed.profile.name || params.fallbackName || 'RailOne User',
              mobile: parsed.profile.mobile || params.fallbackMobile || '',
              initialBalance: parsed.profile.rWalletBalance,
              mpinSet: parsed.profile.mpinSet,
            }),
            ...parsed.profile,
          },
          bookings: normalizeExpiredBookings(Array.isArray(parsed.bookings) ? parsed.bookings : []),
          savedPassengers: Array.isArray(parsed.savedPassengers) ? parsed.savedPassengers : [],
          walletTransactions: Array.isArray(parsed.walletTransactions)
            ? parsed.walletTransactions
            : [],
          complaints: Array.isArray(parsed.complaints) ? parsed.complaints : [],
          feedbacks: Array.isArray(parsed.feedbacks) ? parsed.feedbacks : [],
        };
      }
    } catch {
      // fall through
    }
  }

  if (isDefaultSeedUserKey(key)) {
    const leg = params.legacyData;
    return {
      profile: leg?.profile ?? params.seedData.profile,
      bookings: normalizeExpiredBookings(leg?.bookings ?? params.seedData.bookings),
      savedPassengers: leg?.savedPassengers ?? params.seedData.savedPassengers,
      walletTransactions: leg?.walletTransactions ?? params.seedData.walletTransactions,
      complaints: leg?.complaints ?? params.seedData.complaints,
      feedbacks: leg?.feedbacks ?? params.seedData.feedbacks,
    };
  }

  return createCleanNewUserData({
    userKey: key,
    name: params.fallbackName || 'RailOne User',
    mobile: params.fallbackMobile || '',
    initialBalance: INITIAL_NEW_USER_WALLET_BALANCE,
    mpinSet: false,
  });
}





