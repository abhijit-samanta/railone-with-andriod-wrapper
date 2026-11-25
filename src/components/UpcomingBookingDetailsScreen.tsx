import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ArrowLeft, GitBranch } from 'lucide-react';
import {
  buildScannableTicketQrData,
  buildUpcomingTicketFields,
  calculateCountdownProgress,
  formatCountdownParts,
  formatSaturdayReturnValidityLabel,
  isSaturdayReturnTicket,
  parseBookingBookedDate,
  resolveBookingValidUntilMs,
} from '../utils/railLogic';
import type { BookingRecord, UserProfile } from '../types/rail';

interface UpcomingBookingDetailsScreenProps {
  booking: BookingRecord;
  profile: UserProfile;
  onBack: () => void;
  onBookConnecting: (booking: BookingRecord) => void;
}

function RollingTwoDigitPair({
  value,
  testId,
}: {
  value: string;
  testId: string;
}) {
  const [rollState, setRollState] = useState<{
    curr: string;
    prev: string | null;
    tick: number;
  }>({ curr: value, prev: null, tick: 0 });

  useLayoutEffect(() => {
    setRollState((prev) => {
      if (prev.curr === value) return prev;
      return {
        curr: value,
        prev: prev.curr,
        tick: prev.tick + 1,
      };
    });
  }, [value]);

  const isAnimating = rollState.prev !== null && rollState.tick > 0;

  return (
    <span
      data-testid={testId}
      className="relative inline-block overflow-hidden align-middle leading-[1.15] h-[1.15em] min-w-[2.02ch] text-center"
    >
      {isAnimating && (
        <span
          key={`out-${rollState.tick}`}
          aria-hidden="true"
          className="absolute inset-x-0 top-0 block animate-pair-roll-out will-change-transform"
        >
          {rollState.prev}
        </span>
      )}
      <span
        key={`in-${rollState.tick}`}
        className={`block ${isAnimating ? 'animate-pair-roll-in will-change-transform' : ''}`}
      >
        {rollState.curr}
      </span>
    </span>
  );
}

function TicketQrCode({ value }: { value: string }) {
  const { size, pathData } = useMemo(() => buildScannableTicketQrData(value, 'H'), [value]);

  return (
    <div className="bg-white p-3.5 inline-block rounded-sm">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-[228px] w-[228px] block"
        shapeRendering="crispEdges"
        role="img"
        aria-label={`QR Code for ticket ${value}`}
      >
        <rect width={size} height={size} fill="#FFFFFF" />
        <path d={pathData} fill="#000000" />
      </svg>
    </div>
  );
}

const PREVIEW_DURATION_SECONDS = 300;

export function UpcomingBookingDetailsScreen({
  booking,
  profile,
  onBack,
  onBookConnecting,
}: UpcomingBookingDetailsScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(PREVIEW_DURATION_SECONDS);

  useEffect(() => {
    setSecondsLeft(PREVIEW_DURATION_SECONDS);
  }, [booking.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [booking.id]);

  useEffect(() => {
    if (secondsLeft === 0) {
      const doneTimer = window.setTimeout(() => {
        onBack();
      }, 350);
      return () => window.clearTimeout(doneTimer);
    }
  }, [secondsLeft, onBack]);

  const { mins, secs } = formatCountdownParts(secondsLeft);
  const progressPercent = calculateCountdownProgress(secondsLeft, PREVIEW_DURATION_SECONDS);

  const fields = useMemo(() => buildUpcomingTicketFields(booking), [booking]);
  const bookedDate = useMemo(() => parseBookingBookedDate(booking), [booking]);
  const satReturnExpiryLabel = useMemo(() => {
    if (!bookedDate || !isSaturdayReturnTicket({ bookedAt: bookedDate, ticketType: booking.ticketType })) {
      return null;
    }
    const expiryMs = resolveBookingValidUntilMs(booking);
    return expiryMs ? formatSaturdayReturnValidityLabel(new Date(expiryMs)) : 'Monday 12:00 Midnight';
  }, [booking, bookedDate]);
  const displayName = profile.name.trim() || 'RailOne Passenger';
  const displayMobile = profile.mobile.trim() || '9932021379';

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F3F7]">
      {/* Blue Header matching 44_f0f3efac.jpeg & video */}
      <header className="sticky top-0 z-30 bg-[#0066FF] text-white px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to My Bookings"
            className="h-9 w-9 rounded-full border border-white/85 flex items-center justify-center shrink-0 hover:bg-white/15 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-white" strokeWidth={2.2} />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-[19px] font-semibold leading-tight text-white">
              Booking Details
            </h1>
            <p className="font-display tabular-nums text-[13px] font-normal text-white/95 leading-snug mt-0.5">
              Mobile: {displayMobile}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 w-full max-w-3xl mx-auto">
        {/* Personalized Greeting */}
        <p className="px-4 sm:px-5 pt-3.5 pb-2.5 text-[14.5px] font-normal text-[#374151]">
          Thank You {displayName}, Happy Journey !
        </p>

        {/* Main Yellow-Capped Ticket Card */}
        <section className="mx-3 sm:mx-4 rounded-[18px] overflow-hidden bg-[#F7F8FA] border border-slate-200/80 shadow-xs">
          {/* Top Yellow Band */}
          <div className="h-3.5 w-full bg-[#FFC107]" aria-hidden="true" />

          {/* Black Dynamic Preview Countdown Strip with Rotated Side Rails */}
          <div className="bg-[#161616] text-white flex items-stretch">
            {/* Left Vertical Strip: INDIAN RAILWAYS */}
            <div className="w-9 sm:w-10 border-r border-dashed border-white/35 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-semibold tracking-[0.14em] text-white/90 uppercase whitespace-nowrap -rotate-90">
                INDIAN RAILWAYS
              </span>
            </div>

            {/* Center Timer & Booking Date Block */}
            <div className="flex-1 py-3 px-3 text-center flex flex-col items-center justify-center">
              <p className="text-[15.5px] font-semibold text-white leading-snug">
                Dynamic preview will close in
              </p>
              <div
                data-testid="preview-countdown"
                aria-label={`${mins} minutes ${secs} seconds remaining`}
                className="font-display tabular-nums text-[40px] sm:text-[42px] font-bold tracking-normal text-[#F42B18] leading-none my-1.5 inline-flex items-center justify-center"
              >
                <RollingTwoDigitPair value={mins} testId="countdown-mins" />
                <span className="inline-block px-[1px] leading-[1.15]">:</span>
                <RollingTwoDigitPair value={secs} testId="countdown-secs" />
              </div>
              <p className="text-[12.5px] text-white/85 mt-0.5">Ticket Booking Date &amp; Time</p>
              <p className="font-display tabular-nums text-[22px] sm:text-[24px] font-bold text-[#FFC107] leading-tight mt-0.5">
                {fields.bookingDateTime}
              </p>
              <p className="font-display tabular-nums text-[13px] font-medium text-white/95 mt-1">
                {fields.subRefCode}
              </p>
              <p className="text-[13px] font-medium text-white mt-0.5">
                Ticket is Non-Transferable
              </p>
            </div>

            {/* Right Vertical Strip: भारतीय रेल */}
            <div className="w-9 sm:w-10 border-l border-dashed border-white/35 flex items-center justify-center shrink-0">
              <span className="text-[12px] font-semibold text-white/90 whitespace-nowrap -rotate-90">
                भारतीय रेल
              </span>
            </div>
          </div>

          {/* Moving Yellow Progress Bar Linked to Countdown Timer (0% at 05:00 -> 100% at 00:00) */}
          <div
            role="progressbar"
            aria-label="Dynamic preview elapsed progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPercent)}
            data-testid="countdown-progress-track"
            className="w-full h-[6px] bg-[#D8DBE2] overflow-hidden"
          >
            <div
              data-testid="countdown-progress-fill"
              className="h-full bg-[#FFC107] transition-[width] duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Dynamic Ticket Details Grid */}
          <div className="px-4 sm:px-5 py-4 bg-[#F7F8FA]">
            {/* Row 1: Journey Ticket + Active Status Pill */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12.5px] text-[#5F6B7A]">{fields.categoryTitle}</p>
                <p className="font-display tabular-nums text-[16px] font-bold text-[#111827] mt-0.5">
                  {booking.pnrOrTicketNo}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1F3E6] px-3 py-1 text-[12px] font-semibold text-[#1E7E45] shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-[#248A49]" aria-hidden="true" />
                {fields.statusBadge}
              </span>
            </div>

            {/* Row 2: Source / Destination */}
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[12.5px] text-[#5F6B7A]">Source</p>
                <p className="text-[15px] font-bold text-[#111827] uppercase mt-0.5">
                  {booking.fromName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12.5px] text-[#5F6B7A]">Destination</p>
                <p className="text-[15px] font-bold text-[#111827] uppercase mt-0.5">
                  {booking.toName}
                </p>
              </div>
            </div>

            {/* Row 3: Distance / Passenger */}
            <div className="mt-3.5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[12.5px] text-[#5F6B7A]">Distance</p>
                <p className="text-[15px] font-bold text-[#111827] mt-0.5">
                  {fields.distanceLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12.5px] text-[#5F6B7A]">Passenger</p>
                <p className="text-[15px] font-bold text-[#111827] mt-0.5">
                  {fields.passengerLabel}
                </p>
              </div>
            </div>

            {/* Row 4: Ticket Type / Train Types */}
            <div className="mt-3.5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[12.5px] text-[#5F6B7A]">Ticket Type</p>
                <p className="text-[15px] font-bold text-[#111827] uppercase mt-0.5">
                  {fields.ticketTypeLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12.5px] text-[#5F6B7A]">Train Types</p>
                <p className="text-[15px] font-bold text-[#111827] uppercase mt-0.5">
                  {fields.trainTypeLabel}
                </p>
              </div>
            </div>

            {/* Row 5: Class / Fare */}
            <div className="mt-3.5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[12.5px] text-[#5F6B7A]">Class</p>
                <p className="text-[15px] font-bold text-[#111827] uppercase mt-0.5">
                  {fields.classLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12.5px] text-[#5F6B7A]">Fare</p>
                <p className="font-display tabular-nums text-[15px] font-bold text-[#111827] mt-0.5">
                  {fields.fareLabel}
                </p>
              </div>
            </div>

            {/* Via Pill */}
            <div className="mt-4 rounded-lg bg-[#EAECEF] px-3 py-2 flex items-center gap-2 text-[13px] font-medium text-[#374151]">
              <GitBranch className="h-3.5 w-3.5 text-[#4B5563] shrink-0" />
              <span>Via: {fields.viaLabel}</span>
            </div>

            {/* IR GST / Identifier */}
            <p
              data-testid="ticket-ir-code"
              className="mt-4 pb-4 border-b border-slate-200/90 font-display tabular-nums text-[14px] text-[#374151]"
            >
              IR:{fields.irCode}
            </p>

            {/* Start of Journey Note */}
            <p className="mt-3.5 text-[12.5px] text-[#4B5563] leading-snug">
              {satReturnExpiryLabel
                ? `*Return ticket booked on Saturday is valid up to ${satReturnExpiryLabel}.`
                : '*Valid for start of journey within 1 hour or until departure of the first train.'}
            </p>
          </div>

          {/* Bottom Yellow Band */}
          <div className="h-3.5 w-full bg-[#FFC107]" aria-hidden="true" />
        </section>

        {/* Non-refundable Note Box */}
        <div className="mx-3 sm:mx-4 mt-3.5 rounded-xl bg-[#F4E6E7] px-4 py-3 text-center">
          <p className="text-[13px] text-[#9A585A] leading-snug">
            Note: This ticket is non refundable. Ticket is stored locally on the device. Please do
            not change your handset or perform factory reset.
          </p>
        </div>

        {/* Book Connecting Journey Pill Button */}
        <div className="mx-3 sm:mx-4 mt-4">
          <button
            type="button"
            onClick={() => onBookConnecting(booking)}
            className="w-full min-h-[46px] rounded-full border border-[#3B82F6] bg-white text-[#1D63DC] text-[15px] font-medium hover:bg-[#EAF4FF] transition-colors"
          >
            Book Connecting Journey
          </button>
        </div>

        {/* Scannable High-Density UTS QR Code */}
        <div className="mt-5 mb-2 flex justify-center">
          <TicketQrCode
            value={[
              'INDIAN RAILWAYS | RAILONE UTS DIGITAL TICKET',
              `UTS NO: ${booking.pnrOrTicketNo}`,
              `MOBILE: ${displayMobile}`,
              `PASSENGER NAME: ${displayName}`,
              `FROM: ${booking.fromName} (${booking.fromCode})`,
              `TO: ${booking.toName} (${booking.toCode})`,
              `VIA: ${fields.viaLabel}`,
              `DISTANCE: ${fields.distanceLabel}`,
              `PASSENGER: ${fields.passengerLabel}`,
              `CLASS: ${fields.classLabel}`,
              `TRAIN TYPE: ${fields.trainTypeLabel}`,
              `TICKET TYPE: ${fields.ticketTypeLabel}`,
              `FARE: ${fields.fareLabel}`,
              `BOOKED: ${fields.bookingDateTime}`,
              `STATUS: ${fields.statusBadge}`,
              `REF: ${fields.subRefCode}`,
              `GSTIN: IR${fields.irCode}`,
            ].join('\n')}
          />
        </div>
      </div>

      {/* Light Background Footer Info Section matching 444_39403fbd.jpeg & video (no dark background) */}
      <footer className="w-full max-w-3xl mx-auto px-5 pt-4 pb-8 space-y-3.5">
        <h2 className="font-display italic text-[17px] font-bold text-[#111827]">Do you know?</h2>
        <p className="italic text-[14.5px] text-[#374151] leading-snug">
          IR recovers only 57% of cost of travel on an average.
        </p>
        <p className="italic text-[14.5px] text-[#374151] leading-snug">
          This ticket is booked on a personal user ID. It&apos;s sale/purchase is an offence u/s
          143 of the Railways Act, 1989
        </p>
        <p className="italic text-[14.5px] text-[#374151] leading-snug">
          For enquiry and integrated railway helpline. please dial 139.
        </p>
      </footer>
    </div>
  );
}
