import { ArrowLeft, MapPin, Printer, RefreshCw, UtensilsCrossed, XCircle } from 'lucide-react';
import { buildBookingSummarySpec, resolveEffectiveBookingStatus } from '../utils/railLogic';
import type { ActiveScreen, BookingRecord, UserProfile } from '../types/rail';

function InvoiceReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M5 3.5 7 5l2-1.5L11 5l2-1.5L15 5l2-1.5L19 5v15.5l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5V3.5Z"
        fill="#FFFFFF"
      />
      <path
        d="M8.2 9.2h7.6M8.2 12.2h7.6M8.2 15.2h5.2"
        stroke="#0066FF"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RailOneLogoSquare() {
  return (
    <div className="h-14 w-14 rounded-2xl bg-[#0066FF] flex items-center justify-center shrink-0 shadow-xs">
      <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" aria-hidden="true">
        <path
          d="M7 28c0-5.5 6.5-10 17-10h12.5c3.2 0 5.5 2 5.5 4.8 0 4.6-4.2 8.2-10.8 8.2H9.5C8 31 7 29.8 7 28Z"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M11 24.5h19.5c2.8 0 5.2-1.2 6.8-3"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M13 34.5h22M10 38h28"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function IndianRailwaysCrest() {
  return (
    <svg viewBox="0 0 80 80" className="h-14 w-14 sm:h-16 sm:w-16 shrink-0" aria-hidden="true">
      <defs>
        <path id="ir-top-arc" d="M 14,40 A 26,26 0 1,1 66,40" />
        <path id="ir-bottom-arc" d="M 67,41 A 27,27 0 1,1 13,41" />
      </defs>
      <circle cx="40" cy="40" r="37" fill="#0A1FB8" />
      <circle cx="40" cy="40" r="24" fill="none" stroke="#FFFFFF" strokeWidth="1.4" />
      <circle cx="40" cy="40" r="20" fill="#FFFFFF" />
      {/* Stylized inner locomotive & rail star emblem */}
      <circle cx="40" cy="40" r="14" fill="#0A1FB8" />
      <path
        d="M32 45h16M34 48h12M36 33h8l2 9H34l2-9Z"
        stroke="#FFFFFF"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="40" cy="37" r="1.7" fill="#FFFFFF" />
      <text fill="#FFFFFF" fontSize="6.4" fontWeight="700" letterSpacing="0.8">
        <textPath href="#ir-top-arc" startOffset="50%" textAnchor="middle">
          • भारतीय रेल •
        </textPath>
      </text>
      <text fill="#FFFFFF" fontSize="5.4" fontWeight="700" letterSpacing="0.6">
        <textPath href="#ir-bottom-arc" startOffset="50%" textAnchor="middle">
          INDIAN RAILWAYS
        </textPath>
      </text>
    </svg>
  );
}

interface BookingDetailsScreenProps {
  booking: BookingRecord;
  onBack: () => void;
  onOpenInvoice: () => void;
  onRequestCancel: (booking: BookingRecord) => void;
  onNavigate: (screen: ActiveScreen) => void;
}

export function BookingDetailsScreen({
  booking,
  onBack,
  onOpenInvoice,
  onRequestCancel,
  onNavigate,
}: BookingDetailsScreenProps) {
  const effectiveStatus = resolveEffectiveBookingStatus(booking);
  const spec = buildBookingSummarySpec(booking);
  const canCancel =
    (booking.kind === 'reserved' || booking.kind === 'unreserved') &&
    (effectiveStatus === 'Confirmed' || effectiveStatus === 'WL' || effectiveStatus === 'Active');

  const statusTextColor =
    effectiveStatus === 'Cancelled' || effectiveStatus === 'Refunded'
      ? 'text-[#DC3E3E]'
      : effectiveStatus === 'Active' || effectiveStatus === 'Confirmed'
      ? 'text-[#1E7E45]'
      : effectiveStatus === 'WL'
      ? 'text-[#D99026]'
      : 'text-[#646A73]';

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Solid Blue Header matching 44_80c3499a.jpeg */}
      <header className="sticky top-0 z-30 bg-[#0066FF] text-white px-4 sm:px-6 py-3.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to My Bookings"
              className="h-9 w-9 rounded-full border border-white/85 flex items-center justify-center shrink-0 hover:bg-white/15 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-white" strokeWidth={2.2} />
            </button>
            <h1 className="font-display text-[19px] font-medium leading-tight text-white">
              Booking Details
            </h1>
          </div>

          <button
            type="button"
            onClick={onOpenInvoice}
            aria-label="Open UTS Invoice"
            title="View Invoice"
            className="h-10 w-10 rounded-full hover:bg-white/15 flex items-center justify-center shrink-0 transition-colors"
          >
            <InvoiceReceiptIcon />
          </button>
        </div>
      </header>

      {/* Light Cyan-Blue Perforated Ticket Card */}
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-5 bg-white">
        <div className="relative rounded-[16px] bg-[#DCF1FA] px-5 py-5 overflow-hidden">
          {/* Top & Bottom Semicircle Cutout Notches */}
          <span
            aria-hidden="true"
            className="absolute top-0 right-[20%] -translate-y-1/2 h-4 w-4 rounded-full bg-white"
          />
          <span
            aria-hidden="true"
            className="absolute bottom-0 right-[20%] translate-y-1/2 h-4 w-4 rounded-full bg-white"
          />

          {/* Row 1: JOURNEY + UTS/PNR Code */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-medium tracking-wide text-[#1E293B] uppercase">
              {spec.headerBadge}
            </span>
            <span className="font-mono-num text-[14px] font-semibold text-[#1E293B]">
              {booking.pnrOrTicketNo}
            </span>
          </div>

          {/* Row 2: Origin -> Destination */}
          <div className="mt-4 flex items-start justify-between gap-4">
            <p className="text-[14px] font-semibold text-[#1E293B] uppercase leading-snug">
              {booking.fromName}
            </p>
            <p className="text-[14px] font-semibold text-[#1E293B] uppercase text-right leading-snug">
              {booking.toName}
            </p>
          </div>

          {/* Row 3: Via & Booked on */}
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] text-[#5F6B7A]">Via</p>
              <p className="text-[14px] font-medium text-[#1E293B] mt-0.5">{spec.viaLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] text-[#5F6B7A]">Booked on</p>
              <p className="font-mono-num text-[14px] font-medium text-[#1E293B] mt-0.5">
                {spec.bookedOnLine}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Full-Width Band Divider */}
      <div className="h-2.5 w-full bg-[#F3F5F8]" aria-hidden="true" />

      {/* Lower Details Section */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-10 bg-white">
        <p className={`text-[15.5px] font-normal ${statusTextColor}`}>{spec.statusLine}</p>

        <p className="mt-5 text-[15.5px] font-normal text-[#111827]">
          Passenger(s) : {spec.passengerLabelDetails}
        </p>

        {booking.distanceKm !== undefined && booking.distanceKm > 0 && (
          <p className="mt-3 text-[15.5px] font-normal text-[#111827]">
            Distance : {booking.distanceKm} km
          </p>
        )}

        <p className="mt-3 text-[15.5px] font-normal text-[#111827] uppercase">
          {spec.tariffLine}
        </p>

        {/* Reserved Coach/Berth breakdown when reserved */}
        {booking.kind === 'reserved' && booking.passengers.length > 0 && (
          <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2 text-xs">
            <p className="font-semibold text-slate-700">{booking.title}</p>
            {booking.passengers.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between pt-1.5 border-t border-slate-200/70"
              >
                <span className="text-slate-700">
                  {idx + 1}. {p.name} ({p.age}Y, {p.gender})
                </span>
                <span className="font-mono-num font-bold text-slate-900">
                  {p.status} · {p.coach} {p.berth}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Contextual Actions for Upcoming / Reserved / Cancelled Tickets */}
        {(canCancel ||
          (booking.kind === 'reserved' && booking.status !== 'Cancelled') ||
          booking.status === 'Cancelled') && (
          <div className="mt-7 flex flex-wrap gap-2.5">
            {booking.kind === 'reserved' && booking.status !== 'Cancelled' && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('track-train')}
                  className="min-h-[40px] px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50"
                >
                  <MapPin className="h-3.5 w-3.5" /> Track Train
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('order-food')}
                  className="min-h-[40px] px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50"
                >
                  <UtensilsCrossed className="h-3.5 w-3.5" /> Order Food
                </button>
              </>
            )}

            {canCancel && (
              <button
                type="button"
                onClick={() => onRequestCancel(booking)}
                className="min-h-[40px] px-4 rounded-xl border border-rose-200 text-rose-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-rose-50"
              >
                <XCircle className="h-3.5 w-3.5" /> Cancel Ticket
              </button>
            )}

            {booking.status === 'Cancelled' && (
              <button
                type="button"
                onClick={() => onNavigate('file-refund')}
                className="min-h-[40px] px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refund Status
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

interface UtsInvoiceScreenProps {
  booking: BookingRecord;
  profile: UserProfile;
  onBack: () => void;
}

export function UtsInvoiceScreen({ booking, profile, onBack }: UtsInvoiceScreenProps) {
  const spec = buildBookingSummarySpec(booking);
  const displayName = profile.name.trim() || 'RailOne Passenger';
  const displayMobile = profile.mobile.trim() || '9932021379';
  const distanceLabel =
    booking.distanceKm && booking.distanceKm > 0 ? `${booking.distanceKm} km` : '—';

  return (
    <div className="min-h-screen flex flex-col bg-[#EEF2F6] print:bg-white">
      {/* Top Action Header */}
      <header className="sticky top-0 z-30 bg-[#0066FF] text-white px-4 sm:px-6 py-3.5 print:hidden">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Booking Details"
              className="h-9 w-9 rounded-full border border-white/85 flex items-center justify-center shrink-0 hover:bg-white/15 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-white" strokeWidth={2.2} />
            </button>
            <h1 className="font-display text-[19px] font-medium leading-tight text-white">
              UTS Invoice
            </h1>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            aria-label="Print or Save Invoice PDF"
            className="min-h-[36px] px-3.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Save PDF</span>
          </button>
        </div>
      </header>

      {/* PDF Sheet Container matching XEC9EAK0B4_journey_invoice_9a0cd074.pdf */}
      <main className="flex-1 px-3 sm:px-6 py-4 sm:py-6 flex justify-center print:p-0">
        <article
          aria-label="UTS Invoice Document"
          className="relative bg-white w-full max-w-[680px] min-h-[760px] rounded-xl border border-slate-200/90 shadow-sm px-6 sm:px-10 py-7 sm:py-9 flex flex-col justify-between overflow-hidden print:border-0 print:shadow-none"
        >
          {/* Repeating Diagonal RailOne Watermark */}
          <svg
            aria-hidden="true"
            className="pointer-events-none select-none absolute inset-0 w-full h-full opacity-[0.065]"
          >
            <defs>
              <pattern
                id="railone-invoice-watermark"
                width="210"
                height="150"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(34)"
              >
                <path
                  d="M12 30c0-5 5.5-9 14-9h10c2.5 0 4.5 1.8 4.5 4.2 0 4-3.8 7-9.2 7H14c-1.2 0-2-.9-2-2.2Z"
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="2"
                />
                <text
                  x="48"
                  y="34"
                  fill="#1E293B"
                  fontSize="24"
                  fontWeight="700"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  RailOne
                </text>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#railone-invoice-watermark)" />
          </svg>

          {/* Top Document Body */}
          <div className="relative z-10">
            {/* Header Row: RailOne Blue Icon + UTS Invoice + Indian Railways Crest */}
            <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-300/90">
              <div className="flex items-center gap-4 min-w-0">
                <RailOneLogoSquare />
                <h2 className="font-display text-[22px] sm:text-[26px] font-bold text-[#111827] tracking-tight">
                  UTS Invoice
                </h2>
              </div>
              <IndianRailwaysCrest />
            </div>

            {/* Customer Details Box */}
            <section className="mt-5 rounded-xl border border-slate-300/90 bg-slate-100/50 px-4 py-3.5">
              <h3 className="text-[13.5px] font-bold text-[#111827]">Customer Details</h3>
              <div className="mt-2.5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] text-[#4B5563]">Passenger Name</p>
                  <p className="text-[13px] font-bold text-[#111827] mt-0.5 break-words">
                    {displayName}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-[#4B5563]">Mobile Number</p>
                  <p className="font-mono-num text-[13px] font-bold text-[#111827] mt-0.5">
                    {displayMobile}
                  </p>
                </div>
              </div>
            </section>

            {/* Ticket Info Block */}
            <section className="mt-6 space-y-4">
              {/* Row 1: Journey Ticket + UTS No */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13.5px] font-bold text-[#111827]">
                  {spec.invoiceCategoryTitle}
                </span>
                <span className="font-mono-num text-[13.5px] font-bold text-[#111827]">
                  {booking.pnrOrTicketNo}
                </span>
              </div>

              {/* Row 2: Origin — Distance — Destination */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <p className="text-[13.5px] font-bold text-[#111827] uppercase leading-snug">
                  {booking.fromName}
                </p>
                <span className="text-[11.5px] font-medium text-[#4B5563] whitespace-nowrap px-2">
                  {distanceLabel}
                </span>
                <p className="text-[13.5px] font-bold text-[#111827] uppercase text-right leading-snug">
                  {booking.toName}
                </p>
              </div>

              {/* Row 3: Via + Passenger */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11.5px] text-[#4B5563]">Via</p>
                  <p className="text-[13px] font-bold text-[#111827] mt-0.5">{spec.viaLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11.5px] text-[#4B5563]">Passenger</p>
                  <p className="text-[13px] font-bold text-[#111827] mt-0.5">
                    {spec.passengerLabelInvoice}
                  </p>
                </div>
              </div>

              {/* Row 4: Booked On */}
              <div>
                <p className="text-[11.5px] text-[#4B5563]">Booked On</p>
                <p className="font-mono-num text-[13px] font-bold text-[#111827] mt-0.5">
                  {spec.bookedOnLine}
                </p>
              </div>
            </section>

            {/* Horizontal Divider + Bordered Tariff Box */}
            <div className="mt-6 pt-5 border-t border-slate-200/90">
              <div className="inline-block rounded-lg border border-slate-400/90 bg-white/80 px-3.5 py-2 text-[13.5px] font-bold text-[#111827] uppercase">
                {spec.tariffLine}
              </div>

              <p className="mt-5 text-[14.5px] leading-snug text-[#D32F2F]">
                This invoice is issued by RailOne solely as proof of transaction and does not
                constitute a travel ticket or authorise travel.
              </p>
            </div>
          </div>

          {/* Bottom Centered Footer */}
          <footer className="relative z-10 mt-16 pt-3 border-t border-slate-200/80 text-center">
            <p className="text-[12.5px] text-[#374151]">
              This invoice is computer-generated. No signature is required.
            </p>
          </footer>
        </article>
      </main>
    </div>
  );
}
