import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBookingSummarySpec,
  buildHighDensityQrData,
  buildScannableTicketQrData,
  buildUpcomingTicketFields,
  calculateBookingValidUntil,
  calculateCountdownProgress,
  calculatePlatformFare,
  calculateRefundAmount,
  calculateReservedFare,
  calculateUnreservedFare,
  computeProfileCompletion,
  deductWalletBalance,
  filterBookings,
  formatBookingKindLabel,
  formatBookingTimestamp,
  formatCountdownParts,
  formatOrdinalDob,
  formatSaturdayReturnValidityLabel,
  formatTransactionTimeLabel,
  formatUpcomingPreviewDateTime,
  generatePnr,
  generateRandomIrCode,
  generateTransactionId,
  generateUtsNumber,
  getUpcomingBookings,
  INITIAL_NEW_USER_WALLET_BALANCE,
  IR_CODE_PATTERN,
  isPendingUserOnboarding,
  isSaturdayReturnTicket,
  isWalletExhausted,
  loginWithBiometricSession,
  logoutToMpinScreen,
  maskIdNumber,
  normalizeAuthUserKey,
  normalizeExpiredBookings,
  PENDING_USER_KEY,
  resolveBookingIrCode,
  resolveEffectiveBookingStatus,
  resolveFreshInstallSession,
  resolveInitialMpinAuthSession,
  resolveInitialUserProfile,
  resolveLocalUserByMpin,
  resolveTransactionDisplay,
  searchTrains,
  submitMpinLogin,
  switchOrCreateAuthUser,
  validatePnr,
  canBookTicketWithWallet,
  createCleanNewUserData,
  getUserDataStorageKey,
  hasRegisteredOneTimeMpin,
  resolveUserDataSnapshot,
} from './railLogic';
import {
  RAIL_TRAINS,
  SEED_BOOKINGS,
  SEED_COMPLAINTS,
  SEED_SAVED_PASSENGERS,
  SEED_USER_PROFILE,
  SEED_WALLET_TRANSACTIONS,
} from '../data/railData';

test('unreserved fare applies exact 3% R-Wallet discount', () => {
  const withWallet = calculateUnreservedFare({
    distanceKm: 60,
    trainType: 'Ordinary',
    classCode: 'II',
    adults: 1,
    children: 0,
    mode: 'Normal',
    payWithRWallet: true,
  });
  assert.equal(withWallet.baseFare, 20);
  assert.equal(withWallet.discountAmount, 0.6);
  assert.equal(withWallet.finalFare, 19.4);

  const withoutWallet = calculateUnreservedFare({
    distanceKm: 60,
    trainType: 'Ordinary',
    classCode: 'II',
    adults: 1,
    children: 0,
    mode: 'Normal',
    payWithRWallet: false,
  });
  assert.equal(withoutWallet.discountAmount, 0);
  assert.equal(withoutWallet.finalFare, 20);

  const returnTicket = calculateUnreservedFare({
    distanceKm: 60,
    trainType: 'Ordinary',
    classCode: 'II',
    adults: 1,
    children: 0,
    mode: 'Normal',
    payWithRWallet: false,
    ticketType: 'RETURN',
  });
  assert.equal(returnTicket.baseFare, 40);

  const concessionTicket = calculateUnreservedFare({
    distanceKm: 60,
    trainType: 'Ordinary',
    classCode: 'II',
    adults: 1,
    children: 0,
    mode: 'Normal',
    payWithRWallet: false,
    ticketType: 'JOURNEY',
    availConcession: true,
  });
  assert.equal(concessionTicket.baseFare, 10);
});

test('platform ticket fare scales linearly at ₹10 per person up to 4', () => {
  assert.equal(calculatePlatformFare(1), 10);
  assert.equal(calculatePlatformFare(3), 30);
  assert.equal(calculatePlatformFare(8), 40);
});

test('reserved fare computes Tatkal surcharge and catering accurately', () => {
  const result = calculateReservedFare({
    baseClassFare: 1000,
    quota: 'Tatkal',
    passengerCount: 2,
    cateringSelected: true,
  });
  assert.equal(result.ticketFare, 2000);
  assert.equal(result.quotaCharge, 600);
  assert.equal(result.cateringCharge, 370);
  assert.equal(result.convenienceFee, 20);
  assert.equal(result.totalFare, 2990);
});

test('refund calculation respects Indian Railways cancellation slabs', () => {
  const early = calculateRefundAmount({
    fare: 1070,
    status: 'Confirmed',
    hoursBeforeDeparture: 72,
  });
  assert.equal(early.refundAmount, 890);

  const mid = calculateRefundAmount({
    fare: 1000,
    status: 'Confirmed',
    hoursBeforeDeparture: 24,
  });
  assert.equal(mid.refundAmount, 750);

  const wl = calculateRefundAmount({
    fare: 570,
    status: 'WL',
    hoursBeforeDeparture: 2,
  });
  assert.equal(wl.refundAmount, 510);
});

test('booking filter separates reserved, unreserved, and status groups', () => {
  const sampleFixture = [
    ...SEED_BOOKINGS,
    {
      ...SEED_BOOKINGS[0],
      id: 'fixture-res',
      kind: 'reserved' as const,
      status: 'Confirmed' as const,
    },
    {
      ...SEED_BOOKINGS[0],
      id: 'fixture-can',
      kind: 'reserved' as const,
      status: 'Cancelled' as const,
    },
  ];
  const reservedOnly = filterBookings(sampleFixture, {
    kind: 'reserved',
    statusGroup: 'all',
    durationDays: 'all',
  });
  assert.ok(reservedOnly.length >= 1);
  assert.ok(reservedOnly.every((b) => b.kind === 'reserved'));

  const cancelledOnly = filterBookings(sampleFixture, {
    kind: 'all',
    statusGroup: 'cancelled',
    durationDays: 'all',
  });
  assert.ok(cancelledOnly.length >= 1);
  assert.ok(cancelledOnly.every((b) => b.status === 'Cancelled' || b.status === 'Refunded'));
});

test('PNR validator & generator produce valid 10-digit PNRs', () => {
  const pnr = generatePnr(1234567);
  assert.equal(pnr.length, 10);
  assert.equal(validatePnr(pnr), true);
  assert.equal(validatePnr('12345'), false);
  assert.equal(validatePnr('ABC1234567'), false);
});

test('train search finds NDLS -> CNB trains and filters available classes', () => {
  const ndlsToCnb = searchTrains(RAIL_TRAINS, {
    fromCode: 'NDLS',
    toCode: 'CNB',
  });
  assert.ok(ndlsToCnb.some((t) => t.number === '22416'));

  const onlyAvail = searchTrains(RAIL_TRAINS, {
    fromCode: 'NDLS',
    toCode: 'CNB',
    onlyAvailable: true,
  });
  assert.ok(onlyAvail.every((t) => t.classes.some((c) => c.kind === 'available')));
});

test('profile completion reaches 100% when verified', () => {
  const pct = computeProfileCompletion({
    name: 'Kailash Kumar',
    userId: 'kailash_rail',
    mobile: '9876543210',
    email: 'kailash@railone.in',
    emailVerified: true,
    aadhaarVerified: true,
    nameEditedOnce: false,
    biometricEnabled: false,
    isGuest: false,
    rWalletBalance: 916.4,
    mpinSet: true,
  });
  assert.equal(pct, 100);
});

test('booking summary spec and timestamp formatter match Booking Details and UTS Invoice format', () => {
  const formatted = formatBookingTimestamp(new Date(2026, 1, 18, 14, 52, 57));
  assert.equal(formatted, '2026-02-18 14:52:57');

  const spec = buildBookingSummarySpec(SEED_BOOKINGS[0]);
  assert.equal(spec.headerBadge, 'JOURNEY');
  assert.equal(spec.invoiceCategoryTitle, 'Journey Ticket');
  assert.equal(spec.viaLabel, '-');
  assert.equal(spec.bookedOnLine, '2026-02-18 14:52:57');
  assert.equal(spec.statusLine, 'Ticket Expired');
  assert.equal(spec.passengerLabelDetails, '1 Adult , 0 Child');
  assert.equal(spec.passengerLabelInvoice, '1 Adult, 0 Child');
  assert.equal(spec.tariffLine, 'SECOND | ORDINARY | RETURN | ₹20.00');

  const activeFc = buildBookingSummarySpec({
    ...SEED_BOOKINGS[0],
    status: 'Active',
    ticketType: 'JOURNEY',
    classOrMode: 'FC · Superfast',
    adultsCount: 2,
    childrenCount: 1,
    fare: 97,
  });
  assert.equal(activeFc.passengerLabelDetails, '2 Adults , 1 Child');
  assert.equal(activeFc.passengerLabelInvoice, '2 Adults, 1 Child');
  assert.equal(activeFc.tariffLine, 'FIRST | SUPERFAST | JOURNEY | ₹97.00');

  const rWalletDiscounted = buildBookingSummarySpec({
    ...SEED_BOOKINGS[0],
    status: 'Active',
    ticketType: 'JOURNEY',
    classOrMode: 'II · Ordinary',
    fare: 19.4,
    originalFare: 20,
    discountSaved: 0.6,
  });
  assert.equal(rWalletDiscounted.tariffLine, 'SECOND | ORDINARY | JOURNEY | ₹20.00');

  const legacyDiscounted = buildBookingSummarySpec({
    ...SEED_BOOKINGS[0],
    status: 'Active',
    ticketType: 'JOURNEY',
    classOrMode: 'II · Ordinary',
    fare: 9.7,
    discountSaved: 0.3,
  });
  assert.equal(legacyDiscounted.tariffLine, 'SECOND | ORDINARY | JOURNEY | ₹10.00');
});

test('upcoming ticket fields format dynamic booking date, original fare, and distance cleanly', () => {
  const fields = buildUpcomingTicketFields({
    ...SEED_BOOKINGS[0],
    pnrOrTicketNo: 'XEC8EI90HI',
    fromName: 'BARRACKPORE',
    toName: 'PALTA',
    distanceKm: 3,
    ticketType: 'JOURNEY',
    classOrMode: 'II · Ordinary',
    fare: 4.85,
    originalFare: 5,
    discountSaved: 0.15,
    status: 'Active',
    bookedAtTimestamp: '2026-11-22 00:03:11',
  });
  assert.equal(fields.categoryTitle, 'Journey Ticket');
  assert.equal(fields.statusBadge, 'ACTIVE');
  assert.equal(fields.bookingDateTime, '22 Nov 2026, 00:03');
  assert.equal(fields.distanceLabel, '3 km');
  assert.equal(fields.passengerLabel, '1 Adult, 0 Child');
  assert.equal(fields.ticketTypeLabel, 'JOURNEY');
  assert.equal(fields.trainTypeLabel, 'ORDINARY');
  assert.equal(fields.classLabel, 'SECOND');
  assert.equal(fields.fareLabel, '₹5.00');
  assert.equal(fields.viaLabel, '-');
  assert.match(fields.subRefCode, /^R\d{5}$/);

  assert.equal(
    formatUpcomingPreviewDateTime({
      ...SEED_BOOKINGS[0],
      bookedAtTimestamp: '2026-11-22 00:03:11',
    }),
    '22 Nov 2026, 00:03'
  );
});

test('formatCountdownParts splits MM:SS pairs consistently across minute and second ticks', () => {
  assert.deepEqual(formatCountdownParts(300), { mins: '05', secs: '00' });
  assert.deepEqual(formatCountdownParts(299), { mins: '04', secs: '59' });
  assert.deepEqual(formatCountdownParts(215), { mins: '03', secs: '35' });
  assert.deepEqual(formatCountdownParts(214), { mins: '03', secs: '34' });
  assert.deepEqual(formatCountdownParts(-5), { mins: '00', secs: '00' });
});

test('calculateCountdownProgress tracks yellow line from 0% at start to 100% at expiry', () => {
  assert.equal(calculateCountdownProgress(300, 300), 0);
  assert.equal(calculateCountdownProgress(240, 300), 20);
  assert.equal(calculateCountdownProgress(150, 300), 50);
  assert.equal(calculateCountdownProgress(0, 300), 100);
});

test('buildHighDensityQrData generates Version 29 (133x133) deterministic path with 6x6 alignment centers', () => {
  const qr = buildHighDensityQrData('XEC8EI90HI|BRP|PTF|₹5.00');
  assert.equal(qr.size, 133);
  assert.deepEqual(qr.alignmentCenters, [6, 30, 54, 78, 102, 126]);
  assert.ok(qr.pathData.length > 50000);
  const qr2 = buildHighDensityQrData('XEC8EI90HI|BRP|PTF|₹5.00');
  assert.equal(qr.pathData, qr2.pathData);
});

test('getUpcomingBookings returns only active/confirmed/WL sorted newest first and formats kind labels', () => {
  const refNowMs = Date.parse('2026-11-21T15:00:00.000Z');
  const sample = [
    ...SEED_BOOKINGS,
    {
      ...SEED_BOOKINGS[0],
      id: 'up-old',
      status: 'Active' as const,
      createdAt: '2026-11-21T10:00:00.000Z',
    },
    {
      ...SEED_BOOKINGS[0],
      id: 'up-new',
      status: 'Confirmed' as const,
      createdAt: '2026-11-21T11:00:00.000Z',
    },
  ];
  const upcoming = getUpcomingBookings(sample, refNowMs);
  assert.equal(upcoming.length, 2);
  assert.equal(upcoming[0].id, 'up-new');
  assert.equal(upcoming[1].id, 'up-old');
  assert.equal(formatBookingKindLabel('unreserved'), 'Unreserved');
  assert.equal(formatBookingKindLabel('reserved'), 'Reserved');
  assert.equal(formatBookingKindLabel('platform'), 'Platform');
  assert.equal(formatBookingKindLabel('food'), 'Food Order');
});

test('buildScannableTicketQrData generates deterministic valid ISO-18004 QR path data', () => {
  const payload = [
    'INDIAN RAILWAYS | RAILONE UTS DIGITAL TICKET',
    'UTS NO: XEC8EI90HI',
    'FROM: BARRACKPORE (BP)',
    'TO: PALTA (PTF)',
    'FARE: ₹5.00',
  ].join('\n');
  const qr = buildScannableTicketQrData(payload, 'H');
  assert.ok(qr.size >= 45 && (qr.size - 17) % 4 === 0);
  assert.ok(qr.pathData.includes('M0 0h1v1h-1z'));
  assert.ok(qr.pathData.length > 5000);
  const qr2 = buildScannableTicketQrData(payload, 'H');
  assert.equal(qr.pathData, qr2.pathData);
});

test('generateRandomIrCode produces unique 15-character alphanumeric IR codes matching 19AAAGM0289C1ZG format', () => {
  assert.match('19AAAGM0289C1ZG', IR_CODE_PATTERN);
  const generated = new Set<string>();
  for (let i = 0; i < 20; i += 1) {
    const code = generateRandomIrCode();
    assert.equal(code.length, 15);
    assert.match(code, IR_CODE_PATTERN);
    assert.match(code, /[A-Z]/);
    assert.match(code, /\d/);
    generated.add(code);
  }
  assert.equal(generated.size, 20);

  const explicitTicket = {
    ...SEED_BOOKINGS[0],
    id: 'bk-explicit',
    irCode: '27KMPQT4812R3Z9',
  };
  assert.equal(resolveBookingIrCode(explicitTicket), '27KMPQT4812R3Z9');
  assert.equal(buildUpcomingTicketFields(explicitTicket).irCode, '27KMPQT4812R3Z9');

  const legacyNumericTicket = {
    ...SEED_BOOKINGS[0],
    id: 'bk-legacy-numeric',
    irCode: '442020354583514',
  };
  const normalizedLegacy = resolveBookingIrCode(legacyNumericTicket);
  assert.match(normalizedLegacy, IR_CODE_PATTERN);

  const seedCodes = SEED_BOOKINGS.map((bk) => buildUpcomingTicketFields(bk).irCode);
  for (const code of seedCodes) {
    assert.match(code, IR_CODE_PATTERN);
  }
  assert.equal(new Set(seedCodes).size, SEED_BOOKINGS.length);
});

test('maskIdNumber masks IDs keeping first 4 characters and formatOrdinalDob formats ISO dates cleanly', () => {
  assert.equal(maskIdNumber('OIFPS8651Q'), 'OIFP******');
  assert.equal(maskIdNumber('abcpk4821q'), 'ABCP******');
  assert.equal(maskIdNumber('123456789012'), '1234********');

  assert.equal(formatOrdinalDob('2003-08-05'), '5th August, 2003');
  assert.equal(formatOrdinalDob('2001-01-01'), '1st January, 2001');
  assert.equal(formatOrdinalDob('2002-05-22'), '22nd May, 2002');
  assert.equal(formatOrdinalDob('1998-11-13'), '13th November, 1998');
  assert.equal(formatOrdinalDob('5th August, 2003'), '5th August, 2003');
});

test('transaction helpers generate 16-digit Txn IDs and format display metadata', () => {
  const txnId = generateTransactionId();
  assert.match(txnId, /^\d{16}$/);

  const timeLabel = formatTransactionTimeLabel(new Date(2026, 10, 22, 0, 3, 0));
  assert.equal(timeLabel, '00:03 Sun, 22 Nov');

  const display = resolveTransactionDisplay({
    id: 'wt-x',
    title: 'UTS Unreserved Ticket',
    amount: 5,
    type: 'debit',
    date: '22 Nov 2026',
    refId: '2011227746262610',
    timeLabel: '00:03 Sun, 22 Nov',
  });
  assert.equal(display.category, 'Unreserved');
  assert.equal(display.txnId, '2011227746262610');
  assert.equal(display.timeLabel, '00:03 Sun, 22 Nov');
  assert.equal(display.amountLabel, '₹ 5.0');
  assert.equal(display.remarks, 'Ticket Booked');
  assert.equal(display.isRefund, false);

  const refundDisplay = resolveTransactionDisplay({
    id: 'wt-r',
    title: 'Refund · PNR 8349201156',
    amount: 530,
    type: 'credit',
    date: '19 Sep 2026',
    refId: '8349201156001234',
  });
  assert.equal(refundDisplay.category, 'Refund');
  assert.equal(refundDisplay.remarks, 'Refund Credited');
  assert.equal(refundDisplay.isRefund, true);
});

test('generateUtsNumber generates unique 10-character alphanumeric journey ticket numbers', () => {
  const generated = new Set<string>();
  for (let i = 0; i < 30; i += 1) {
    const utsNo = generateUtsNumber();
    assert.equal(utsNo.length, 10);
    assert.match(utsNo, /^X[A-Z0-9]{9}$/);
    assert.match(utsNo, /[A-Z]/);
    assert.match(utsNo, /\d/);
    generated.add(utsNo);
  }
  assert.equal(generated.size, 30);
});

test('upcoming journey stays active for 24h and moves to Completed after 24h', () => {
  const bookedAt = new Date(2026, 10, 22, 10, 0, 0); // Sunday 22 Nov 2026, 10:00 AM
  const validUntil = calculateBookingValidUntil({ bookedAt, ticketType: 'JOURNEY' });
  assert.equal(validUntil.getTime() - bookedAt.getTime(), 24 * 60 * 60 * 1000);

  const ticket = {
    ...SEED_BOOKINGS[0],
    id: 'bk-24h-test',
    ticketType: 'JOURNEY',
    status: 'Active' as const,
    createdAt: bookedAt.toISOString(),
    validUntil: validUntil.toISOString(),
  };

  const before24h = bookedAt.getTime() + (23 * 60 + 59) * 60 * 1000;
  assert.equal(resolveEffectiveBookingStatus(ticket, before24h), 'Active');
  assert.equal(getUpcomingBookings([ticket], before24h).length, 1);
  assert.equal(
    filterBookings([ticket], { kind: 'all', statusGroup: 'active', durationDays: 'all', nowMs: before24h }).length,
    1
  );
  assert.equal(
    filterBookings([ticket], { kind: 'all', statusGroup: 'completed', durationDays: 'all', nowMs: before24h }).length,
    0
  );

  const after24h = bookedAt.getTime() + 24 * 60 * 60 * 1000;
  assert.equal(resolveEffectiveBookingStatus(ticket, after24h), 'Completed');
  assert.equal(getUpcomingBookings([ticket], after24h).length, 0);
  assert.equal(
    filterBookings([ticket], { kind: 'all', statusGroup: 'active', durationDays: 'all', nowMs: after24h }).length,
    0
  );
  assert.equal(
    filterBookings([ticket], { kind: 'all', statusGroup: 'completed', durationDays: 'all', nowMs: after24h }).length,
    1
  );
  assert.equal(buildBookingSummarySpec(ticket, after24h).statusLine, 'Ticket Expired');

  const normalized = normalizeExpiredBookings([ticket], after24h);
  assert.equal(normalized[0].status, 'Completed');
  assert.equal(normalized[0].passengers[0].status, 'COMPLETED');
});

test('Saturday Return ticket remains valid up to Monday midnight and completes after Monday midnight', () => {
  // Saturday 21 Nov 2026 at 09:30 AM local
  const satBooked = new Date(2026, 10, 21, 9, 30, 0);
  assert.equal(satBooked.getDay(), 6);
  assert.equal(isSaturdayReturnTicket({ bookedAt: satBooked, ticketType: 'RETURN' }), true);
  assert.equal(isSaturdayReturnTicket({ bookedAt: satBooked, ticketType: 'JOURNEY' }), false);

  const monMidnight = calculateBookingValidUntil({ bookedAt: satBooked, ticketType: 'RETURN' });
  // Monday midnight = end of Monday 23 Nov (24 Nov 00:00:00.000)
  assert.equal(monMidnight.getFullYear(), 2026);
  assert.equal(monMidnight.getMonth(), 10);
  assert.equal(monMidnight.getDate(), 24);
  assert.equal(monMidnight.getHours(), 0);
  assert.equal(monMidnight.getMinutes(), 0);
  assert.equal(formatSaturdayReturnValidityLabel(monMidnight), 'Mon, 23 Nov · 12:00 Midnight');

  const satReturnTicket = {
    ...SEED_BOOKINGS[0],
    id: 'bk-sat-return',
    ticketType: 'RETURN',
    status: 'Active' as const,
    createdAt: satBooked.toISOString(),
    validUntil: monMidnight.toISOString(),
  };

  // Sunday evening (>36h after Saturday morning): still Active & Upcoming!
  const sundayEvening = new Date(2026, 10, 22, 22, 0, 0).getTime();
  assert.equal(resolveEffectiveBookingStatus(satReturnTicket, sundayEvening), 'Active');
  assert.equal(getUpcomingBookings([satReturnTicket], sundayEvening).length, 1);

  // Monday 23:59:59: still Active & Upcoming!
  const mondayLastSecond = new Date(2026, 10, 23, 23, 59, 59).getTime();
  assert.equal(resolveEffectiveBookingStatus(satReturnTicket, mondayLastSecond), 'Active');
  assert.equal(getUpcomingBookings([satReturnTicket], mondayLastSecond).length, 1);

  // At Monday midnight (00:00 Tue): expires into Completed!
  const atMondayMidnight = new Date(2026, 10, 24, 0, 0, 0).getTime();
  assert.equal(resolveEffectiveBookingStatus(satReturnTicket, atMondayMidnight), 'Completed');
  assert.equal(getUpcomingBookings([satReturnTicket], atMondayMidnight).length, 0);
  assert.equal(
    filterBookings([satReturnTicket], {
      kind: 'all',
      statusGroup: 'completed',
      durationDays: 'all',
      nowMs: atMondayMidnight,
    }).length,
    1
  );

  // Return ticket booked on Friday follows the standard 24-hour rule
  const friBooked = new Date(2026, 10, 20, 9, 30, 0);
  assert.equal(isSaturdayReturnTicket({ bookedAt: friBooked, ticketType: 'RETURN' }), false);
  const friValidUntil = calculateBookingValidUntil({ bookedAt: friBooked, ticketType: 'RETURN' });
  assert.equal(friValidUntil.getTime() - friBooked.getTime(), 24 * 60 * 60 * 1000);
});

test('new user opens app with 5001 R-Wallet balance and deducts ticket fares cleanly', () => {
  assert.equal(INITIAL_NEW_USER_WALLET_BALANCE, 5001);
  assert.equal(SEED_USER_PROFILE.rWalletBalance, 5001);

  const freshProfile = resolveInitialUserProfile({
    seedProfile: SEED_USER_PROFILE,
    storedV2Raw: null,
    legacyStoredRaw: null,
  });
  assert.equal(freshProfile.rWalletBalance, 5001);

  // Legacy cached profile from earlier version upgrades balance to 5001 while keeping profile edits
  const legacyProfile = resolveInitialUserProfile({
    seedProfile: SEED_USER_PROFILE,
    storedV2Raw: null,
    legacyStoredRaw: JSON.stringify({ ...SEED_USER_PROFILE, name: 'Abhijit Samanta', rWalletBalance: 916.4 }),
  });
  assert.equal(legacyProfile.name, 'Abhijit Samanta');
  assert.equal(legacyProfile.rWalletBalance, 5001);

  // Subsequent reload after spending preserves remaining wallet balance
  const afterUnreservedTicket = deductWalletBalance(freshProfile.rWalletBalance, 4.85);
  assert.equal(afterUnreservedTicket, 4996.15);

  const reloadedProfile = resolveInitialUserProfile({
    seedProfile: SEED_USER_PROFILE,
    storedV2Raw: JSON.stringify({ ...freshProfile, rWalletBalance: afterUnreservedTicket }),
    legacyStoredRaw: null,
  });
  assert.equal(reloadedProfile.rWalletBalance, 4996.15);

  const afterPlatformTicket = deductWalletBalance(reloadedProfile.rWalletBalance, 9.7);
  assert.equal(afterPlatformTicket, 4986.45);
  assert.equal(deductWalletBalance(10, 25), 0);
});

test('user cannot book any ticket once all R-Wallet balance is used or insufficient', () => {
  // Using exact remaining balance leaves 0 and blocks all further bookings
  const remainingAfterSpendingAll = deductWalletBalance(5001, 5001);
  assert.equal(remainingAfterSpendingAll, 0);
  assert.equal(isWalletExhausted(remainingAfterSpendingAll), true);
  assert.equal(isWalletExhausted(-1), true);
  assert.equal(isWalletExhausted(4.85), false);

  const blockedAtZero = canBookTicketWithWallet({
    rWalletBalance: remainingAfterSpendingAll,
    payableFare: 4.85,
  });
  assert.equal(blockedAtZero.allowed, false);
  assert.match(blockedAtZero.reason ?? '', /₹0\.00/);
  assert.match(blockedAtZero.reason ?? '', /cannot book any ticket/i);

  // Even a 0-fare edge case or platform ticket cannot book once wallet balance is 0
  const blockedZeroFare = canBookTicketWithWallet({
    rWalletBalance: 0,
    payableFare: 0,
  });
  assert.equal(blockedZeroFare.allowed, false);

  // Partial remaining balance < fare also blocks booking
  const blockedInsufficient = canBookTicketWithWallet({
    rWalletBalance: 3.5,
    payableFare: 4.85,
  });
  assert.equal(blockedInsufficient.allowed, false);
  assert.match(blockedInsufficient.reason ?? '', /Insufficient R-Wallet balance/);

  // Recharging wallet restores ticket booking
  const unblockedAfterRecharge = canBookTicketWithWallet({
    rWalletBalance: 100,
    payableFare: 4.85,
  });
  assert.equal(unblockedAfterRecharge.allowed, true);
  assert.equal(unblockedAfterRecharge.reason, null);
});

test('new user sets mPIN once for lifetime login and enforces one user one mPIN', () => {
  const initial = resolveInitialMpinAuthSession({
    storedRaw: null,
    profile: SEED_USER_PROFILE,
  });
  assert.equal(initial.isLifetimeLoggedIn, false);
  const key = normalizeAuthUserKey(SEED_USER_PROFILE.userId);
  assert.equal(hasRegisteredOneTimeMpin(initial, key), false);

  // Biometric cannot skip the new user's one-time mPIN setup
  const bioBeforeSetup = loginWithBiometricSession({ session: initial, userKey: key });
  assert.equal(bioBeforeSetup.ok, false);

  // Incomplete mPIN rejected
  const shortAttempt = submitMpinLogin({
    session: initial,
    userKey: key,
    userName: SEED_USER_PROFILE.name,
    mobile: SEED_USER_PROFILE.mobile,
    currentBalance: 5001,
    enteredMpin: '1234',
  });
  assert.equal(shortAttempt.ok, false);

  // New user enters 6-digit mPIN once -> permanently bound + lifetime login activated
  const firstSetup = submitMpinLogin({
    session: initial,
    userKey: key,
    userName: SEED_USER_PROFILE.name,
    mobile: SEED_USER_PROFILE.mobile,
    currentBalance: 5001,
    enteredMpin: '258014',
  });
  assert.equal(firstSetup.ok, true);
  assert.equal(firstSetup.isFirstTimeSetup, true);
  assert.equal(firstSetup.nextSession.isLifetimeLoggedIn, true);
  assert.equal(hasRegisteredOneTimeMpin(firstSetup.nextSession, key), true);

  // Reloading app restores lifetime login directly without re-asking mPIN
  const reloaded = resolveInitialMpinAuthSession({
    storedRaw: JSON.stringify(firstSetup.nextSession),
    profile: SEED_USER_PROFILE,
  });
  assert.equal(reloaded.isLifetimeLoggedIn, true);
  assert.equal(hasRegisteredOneTimeMpin(reloaded, key), true);

  // If user logs out explicitly, one-user-one-mPIN rejects any different mPIN
  const loggedOut = logoutToMpinScreen(reloaded, 4996.15);
  assert.equal(loggedOut.isLifetimeLoggedIn, false);

  const wrongMpin = submitMpinLogin({
    session: loggedOut,
    userKey: key,
    userName: SEED_USER_PROFILE.name,
    mobile: SEED_USER_PROFILE.mobile,
    currentBalance: 4996.15,
    enteredMpin: '999999',
  });
  assert.equal(wrongMpin.ok, false);
  assert.match(wrongMpin.error ?? '', /One user can only use their registered 6-character mPIN/);

  // Same registered mPIN (or biometric) logs back in for lifetime
  const matchingMpin = submitMpinLogin({
    session: loggedOut,
    userKey: key,
    userName: SEED_USER_PROFILE.name,
    mobile: SEED_USER_PROFILE.mobile,
    currentBalance: 4996.15,
    enteredMpin: '258014',
  });
  assert.equal(matchingMpin.ok, true);
  assert.equal(matchingMpin.isFirstTimeSetup, false);
  assert.equal(matchingMpin.nextSession.isLifetimeLoggedIn, true);

  const bioAfterSetup = loginWithBiometricSession({ session: loggedOut, userKey: key });
  assert.equal(bioAfterSetup.ok, true);
  assert.equal(bioAfterSetup.nextSession.isLifetimeLoggedIn, true);

  // Switching to a Different User creates a separate user with 5001 wallet & own mixed-case alphanumeric 1-time mPIN
  const switched = switchOrCreateAuthUser({
    session: loggedOut,
    name: 'Abhijit samanta',
    mobile: '9123456789',
    initialBalance: 5001,
  });
  assert.equal(switched.ok, true);
  assert.equal(switched.existingUser, null);
  assert.equal(hasRegisteredOneTimeMpin(switched.nextSession, switched.userKey), false);

  const mixedCaseSetup = submitMpinLogin({
    session: switched.nextSession,
    userKey: switched.userKey,
    userName: 'Abhijit samanta',
    mobile: '9123456789',
    currentBalance: 5001,
    enteredMpin: 'aB4xZ9',
  });
  assert.equal(mixedCaseSetup.ok, true);
  assert.equal(mixedCaseSetup.nextSession.usersByKey[switched.userKey].mpin, 'aB4xZ9');
});

test('new user gets completely clean profile, empty booking history, and zero previous user data', () => {
  const seedData = {
    profile: SEED_USER_PROFILE,
    bookings: SEED_BOOKINGS,
    savedPassengers: SEED_SAVED_PASSENGERS,
    walletTransactions: SEED_WALLET_TRANSACTIONS,
    complaints: SEED_COMPLAINTS,
    feedbacks: [],
  };

  // New user snapshot has NO seed/previous bookings, passengers, transactions, DOB, or PAN
  const cleanUser = createCleanNewUserData({
    userKey: 'user_9123456789',
    name: 'Abhijit samanta',
    mobile: '9123456789',
    initialBalance: 5001,
  });
  assert.equal(cleanUser.profile.name, 'Abhijit samanta');
  assert.equal(cleanUser.profile.mobile, '9123456789');
  assert.equal(cleanUser.profile.rWalletBalance, 5001);
  assert.equal(cleanUser.profile.email, '');
  assert.equal(cleanUser.profile.dob, '');
  assert.equal(cleanUser.profile.idNumber, '');
  assert.equal(cleanUser.profile.aadhaarVerified, false);
  assert.equal(cleanUser.bookings.length, 0);
  assert.equal(cleanUser.savedPassengers.length, 0);
  assert.equal(cleanUser.walletTransactions.length, 0);
  assert.equal(cleanUser.complaints.length, 0);

  // Resolving a brand new user without scoped storage never leaks seed/previous user data
  const resolvedBrandNew = resolveUserDataSnapshot({
    userKey: 'user_9123456789',
    scopedRaw: null,
    seedData,
    fallbackName: 'Abhijit samanta',
    fallbackMobile: '9123456789',
  });
  assert.equal(resolvedBrandNew.bookings.length, 0);
  assert.equal(resolvedBrandNew.walletTransactions.length, 0);
  assert.equal(resolvedBrandNew.savedPassengers.length, 0);
  assert.equal(resolvedBrandNew.profile.rWalletBalance, 5001);
  assert.equal(resolvedBrandNew.profile.email, '');

  // Switching back to original seeded user retains their own storage key & data
  assert.notEqual(
    getUserDataStorageKey('kailash_rail'),
    getUserDataStorageKey('user_9123456789')
  );
  const resolvedDefault = resolveUserDataSnapshot({
    userKey: 'kailash_rail',
    scopedRaw: null,
    seedData,
  });
  assert.equal(resolvedDefault.bookings.length, SEED_BOOKINGS.length);
});

test('fresh app install requires Name & Phone Number setup first with zero previous user data', () => {
  const freshSession = resolveFreshInstallSession();
  assert.equal(freshSession.isLifetimeLoggedIn, false);
  assert.equal(freshSession.activeUserKey, PENDING_USER_KEY);

  const pendingData = createCleanNewUserData({
    userKey: PENDING_USER_KEY,
    name: '',
    mobile: '',
    initialBalance: INITIAL_NEW_USER_WALLET_BALANCE,
    mpinSet: false,
    allowEmptyName: true,
  });
  assert.equal(pendingData.profile.name, '');
  assert.equal(pendingData.bookings.length, 0);
  assert.equal(isPendingUserOnboarding(pendingData.profile, freshSession.activeUserKey), true);

  // User submits Name & 10-digit Mobile in "Different User" onboarding
  const onboarded = switchOrCreateAuthUser({
    session: freshSession,
    name: 'Priya Sharma',
    mobile: '9812345678',
    initialBalance: INITIAL_NEW_USER_WALLET_BALANCE,
  });
  assert.equal(onboarded.ok, true);
  const newUserData = createCleanNewUserData({
    userKey: onboarded.userKey,
    name: 'Priya Sharma',
    mobile: '9812345678',
    initialBalance: INITIAL_NEW_USER_WALLET_BALANCE,
  });
  assert.equal(isPendingUserOnboarding(newUserData.profile, onboarded.userKey), false);
  assert.equal(newUserData.profile.name, 'Priya Sharma');
  assert.equal(newUserData.profile.rWalletBalance, 5001);
  assert.equal(newUserData.bookings.length, 0);
  assert.equal(newUserData.savedPassengers.length, 0);
  assert.equal(newUserData.walletTransactions.length, 0);
});

test('one MPIN used by one user cannot be reused by another user and links with user name', () => {
  const fresh = resolveFreshInstallSession();
  const u1 = switchOrCreateAuthUser({
    session: fresh,
    name: 'Priya Sharma',
    mobile: '9812345678',
  });
  const u1Login = submitMpinLogin({
    session: u1.nextSession,
    userKey: u1.userKey,
    userName: 'Priya Sharma',
    mobile: '9812345678',
    currentBalance: 5001,
    enteredMpin: 'Ab3kX9',
  });
  assert.equal(u1Login.ok, true);

  // Switch to another user (Rahul Das) -> cannot reuse Priya's MPIN 'Ab3kX9'
  const u2 = switchOrCreateAuthUser({
    session: u1Login.nextSession,
    name: 'Rahul Das',
    mobile: '9988776655',
  });
  assert.equal(u2.ok, true);
  const u2ReuseAttempt = submitMpinLogin({
    session: u2.nextSession,
    userKey: u2.userKey,
    userName: 'Rahul Das',
    mobile: '9988776655',
    currentBalance: 5001,
    enteredMpin: 'Ab3kX9',
  });
  assert.equal(u2ReuseAttempt.ok, false);
  assert.match(u2ReuseAttempt.error ?? '', /already used and linked to another user/i);

  // Same phone under a different name cannot overwrite Priya Sharma's registered name
  const hijackAttempt = switchOrCreateAuthUser({
    session: u1Login.nextSession,
    name: 'Imposter User',
    mobile: '9812345678',
  });
  assert.equal(hijackAttempt.ok, false);
});

test('same user can log out and log back in with the same single MPIN without creating a new user or MPIN', () => {
  const fresh = resolveFreshInstallSession();
  const onboarded = switchOrCreateAuthUser({
    session: fresh,
    name: 'Priya   Sharma',
    mobile: '9812345678',
  });
  assert.equal(onboarded.ok, true);

  const firstLogin = submitMpinLogin({
    session: onboarded.nextSession,
    userKey: onboarded.userKey,
    userName: 'Priya Sharma',
    mobile: '9812345678',
    currentBalance: 5001,
    enteredMpin: 'Ab3kX9',
  });
  assert.equal(firstLogin.ok, true);
  assert.equal(firstLogin.nextSession.isLifetimeLoggedIn, true);

  // User logs out -> remains bound to same userKey and same MPIN
  const afterLogout = logoutToMpinScreen(firstLogin.nextSession, 4950);
  assert.equal(afterLogout.isLifetimeLoggedIn, false);
  assert.equal(afterLogout.activeUserKey, onboarded.userKey);
  assert.equal(afterLogout.usersByKey[onboarded.userKey].rWalletBalance, 4950);

  // Same user logs back in with the same MPIN directly after logout
  const reloginSameScreen = submitMpinLogin({
    session: afterLogout,
    userKey: onboarded.userKey,
    userName: 'Priya Sharma',
    mobile: '9812345678',
    currentBalance: 4950,
    enteredMpin: 'Ab3kX9',
  });
  assert.equal(reloginSameScreen.ok, true);
  assert.equal(reloginSameScreen.isFirstTimeSetup, false);
  assert.equal(reloginSameScreen.nextSession.isLifetimeLoggedIn, true);
  assert.equal(reloginSameScreen.nextSession.activeUserKey, onboarded.userKey);

  // Returning user entering ONLY her registered MPIN from PENDING_USER_KEY resolves back to her account
  const matchedLocal = resolveLocalUserByMpin(afterLogout, 'Ab3kX9');
  assert.equal(matchedLocal?.userKey, onboarded.userKey);
  const reloginByMpinOnly = submitMpinLogin({
    session: afterLogout,
    userKey: PENDING_USER_KEY,
    userName: '',
    mobile: '',
    currentBalance: 5001,
    enteredMpin: 'Ab3kX9',
  });
  assert.equal(reloginByMpinOnly.ok, true);
  assert.equal(reloginByMpinOnly.isFirstTimeSetup, false);
  assert.equal(reloginByMpinOnly.nextSession.isLifetimeLoggedIn, true);
  assert.equal(reloginByMpinOnly.nextSession.activeUserKey, onboarded.userKey);

  // On a clean device/URL (empty usersByKey), PENDING_USER_KEY allows Firestore to resolve the returning MPIN
  const freshReturn = submitMpinLogin({
    session: fresh,
    userKey: PENDING_USER_KEY,
    userName: '',
    mobile: '',
    currentBalance: 5001,
    enteredMpin: 'Ab3kX9',
  });
  assert.equal(freshReturn.ok, true);
  assert.equal(freshReturn.isFirstTimeSetup, false);
  assert.equal(freshReturn.nextSession.activeUserKey, PENDING_USER_KEY);
});




