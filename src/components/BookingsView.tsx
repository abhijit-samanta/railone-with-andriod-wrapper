import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  RotateCcw,
} from 'lucide-react';
import { SEED_USER_PROFILE } from '../data/railData';
import {
  calculateRefundAmount,
  filterBookings,
  resolveEffectiveBookingStatus,
} from '../utils/railLogic';
import type { ActiveScreen, BookingKind, BookingRecord, UserProfile } from '../types/rail';
import { BookingDetailsScreen, UtsInvoiceScreen } from './BookingDetailsAndInvoice';
import { UpcomingBookingDetailsScreen } from './UpcomingBookingDetailsScreen';

export type BookingTabId = 'upcoming' | 'completed' | 'cancelled' | 'all';

interface BookingsViewProps {
  bookings: BookingRecord[];
  profile?: UserProfile;
  onCancelBooking: (bookingId: string, refundAmount: number) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onBackToHome: () => void;
  onBookAgain?: (booking: BookingRecord) => void;
  onBookConnecting?: (booking: BookingRecord) => void;
}

function TabTicketIcon({
  tab,
  active,
}: {
  tab: BookingTabId;
  active: boolean;
}) {
  const fillColor = !active
    ? 'none'
    : tab === 'upcoming'
    ? '#F5A623'
    : tab === 'completed'
    ? '#248A49'
    : tab === 'cancelled'
    ? '#EB5757'
    : '#0066FF';

  const strokeColor = !active ? '#7C828D' : '#111827';
  const lineColor = !active ? '#7C828D' : tab === 'all' ? '#FFFFFF' : '#111827';

  return (
    <svg viewBox="0 0 28 22" className="h-[22px] w-[26px]" fill="none" aria-hidden="true">
      <path
        d="M3 4.5A1.5 1.5 0 0 1 4.5 3h19A1.5 1.5 0 0 1 25 4.5v3.2a2.6 2.6 0 0 0 0 5.2v3.6a1.5 1.5 0 0 1-1.5 1.5h-19A1.5 1.5 0 0 1 3 16.5v-3.6a2.6 2.6 0 0 0 0-5.2V4.5Z"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 6.5v8"
        stroke={lineColor}
        strokeWidth="1.4"
        strokeDasharray="2 2"
        strokeLinecap="round"
      />
      <path
        d="M13 8.2h7M13 11.8h5"
        stroke={lineColor}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SortDescendingIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M6.5 4.5v13m0 0-3-3m3 3 3-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 7h8M12.5 11.5h6M12.5 16h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EmptyTicketIllustration() {
  return (
    <svg viewBox="0 0 96 64" className="h-16 w-24" fill="none" aria-hidden="true">
      <path
        d="M10 12a6 6 0 0 1 6-6h64a6 6 0 0 1 6 6v12.5a7.5 7.5 0 0 0 0 15V52a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6V39.5a7.5 7.5 0 0 0 0-15V12Z"
        fill="#CBCED3"
      />
      <rect
        x="26"
        y="19"
        width="44"
        height="26"
        rx="2.5"
        stroke="#FFFFFF"
        strokeWidth="5"
      />
    </svg>
  );
}

function TicketCard({
  booking,
  onBookAgain,
  onViewDetails,
}: {
  booking: BookingRecord;
  onBookAgain: () => void;
  onViewDetails: () => void;
}) {
  const effectiveStatus = resolveEffectiveBookingStatus(booking);
  const isCancelled = effectiveStatus === 'Cancelled' || effectiveStatus === 'Refunded';
  const isUpcoming =
    effectiveStatus === 'Active' || effectiveStatus === 'Confirmed' || effectiveStatus === 'WL';

  const borderColor = isCancelled
    ? 'border-[#E05252]'
    : isUpcoming
    ? 'border-[#E59E2C]'
    : 'border-[#2E8B57]';

  const badgeStyle =
    booking.kind === 'unreserved'
      ? 'bg-[#F3E5F5] text-[#9C57B0]'
      : booking.kind === 'reserved'
      ? 'bg-[#E7F4FE] text-[#0B63E5]'
      : booking.kind === 'platform'
      ? 'bg-[#FFF3E0] text-[#D97706]'
      : 'bg-[#E8F8EE] text-[#1D7A44]';

  const kindLabel =
    booking.kind === 'unreserved'
      ? 'Unreserved'
      : booking.kind === 'reserved'
      ? 'Reserved'
      : booking.kind === 'platform'
      ? 'Platform'
      : 'Food Order';

  const codePrefix =
    booking.kind === 'unreserved' || booking.kind === 'platform'
      ? `UTS: ${booking.pnrOrTicketNo}`
      : booking.kind === 'food'
      ? `Order: ${booking.pnrOrTicketNo}`
      : `PNR: ${booking.pnrOrTicketNo}`;

  const ticketTypeLabel =
    booking.ticketType ??
    (booking.kind === 'unreserved'
      ? 'JOURNEY'
      : booking.kind === 'platform'
      ? 'PLATFORM'
      : booking.classOrMode);

  const bookingDateLabel = booking.bookingDateLabel ?? booking.journeyDisplayDate;

  const centerMetric =
    booking.distanceKm && booking.distanceKm > 0
      ? `— ${booking.distanceKm} km —`
      : booking.kind === 'platform'
      ? '— Entry —'
      : `— ${booking.departureTime} —`;

  return (
    <article
      className={`relative bg-white rounded-[16px] border-[1.5px] ${borderColor} shadow-[0_1px_2px_rgba(15,23,42,0.03)]`}
    >
      <div className="px-4 pt-3.5 pb-3">
        {/* Top Badge + UTS/PNR Code */}
        <div className="flex items-center justify-between gap-2">
          <span className={`px-3 py-1 rounded-[8px] text-[12px] font-semibold ${badgeStyle}`}>
            {kindLabel}
          </span>
          <span className="font-mono-num text-[13.5px] font-semibold text-[#1E3B70]">
            {codePrefix}
          </span>
        </div>

        {/* Ticket Type & Booking Date */}
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11.5px] text-[#8E939C]">Ticket Type</p>
            <p className="text-[13.5px] font-medium text-[#1E293B] uppercase mt-0.5">
              {ticketTypeLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11.5px] text-[#8E939C]">Booking Date</p>
            <p className="text-[13.5px] font-medium text-[#1E293B] mt-0.5">
              {bookingDateLabel}
            </p>
          </div>
        </div>

        {/* Route Row: Origin — Distance — Destination */}
        <div className="mt-3.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <p className="text-[13.5px] font-medium text-[#1E293B] uppercase leading-snug">
            {booking.fromName}
          </p>
          <span className="text-[12px] text-[#8E939C] whitespace-nowrap px-1">
            {centerMetric}
          </span>
          <p className="text-[13.5px] font-medium text-[#1E293B] uppercase text-right leading-snug">
            {booking.toName}
          </p>
        </div>
      </div>

      {/* Perforated Dashed Divider with Left & Right Semicircle Cutouts */}
      <div className="relative h-5 flex items-center">
        <span
          aria-hidden="true"
          className={`absolute -left-[1.5px] h-5 w-2.5 rounded-r-full bg-white border-y-[1.5px] border-r-[1.5px] ${borderColor}`}
        />
        <div className="w-full border-t border-dashed border-slate-200 mx-3" />
        <span
          aria-hidden="true"
          className={`absolute -right-[1.5px] h-5 w-2.5 rounded-l-full bg-white border-y-[1.5px] border-l-[1.5px] ${borderColor}`}
        />
      </div>

      {/* Bottom Actions: Book Again | View Details */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center pb-3 pt-0.5">
        <button
          type="button"
          onClick={onBookAgain}
          className="text-center text-[15px] font-medium text-[#0B63E5] hover:text-[#0952C2] py-1 transition-colors"
        >
          Book Again
        </button>
        <span className="h-4 w-px bg-slate-200" aria-hidden="true" />
        <button
          type="button"
          onClick={onViewDetails}
          className="text-center text-[15px] font-medium text-[#0B63E5] hover:text-[#0952C2] py-1 transition-colors"
        >
          View Details
        </button>
      </div>
    </article>
  );
}

export function BookingsView({
  bookings,
  profile = SEED_USER_PROFILE,
  onCancelBooking,
  onNavigate,
  onBackToHome,
  onBookAgain,
  onBookConnecting,
}: BookingsViewProps) {
  const [activeTab, setActiveTab] = useState<BookingTabId>('all');
  const [kindFilter, setKindFilter] = useState<'all' | BookingKind>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detailsTicketId, setDetailsTicketId] = useState<string | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<BookingRecord | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const detailsTicket = useMemo(
    () => (detailsTicketId ? bookings.find((b) => b.id === detailsTicketId) ?? null : null),
    [bookings, detailsTicketId]
  );

  const handleRefresh = () => {
    setNowMs(Date.now());
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 450);
  };

  const sortList = (list: BookingRecord[]) => {
    return [...list].sort((a, b) => {
      const ta = Date.parse(a.createdAt) || 0;
      const tb = Date.parse(b.createdAt) || 0;
      return sortOrder === 'newest' ? tb - ta : ta - tb;
    });
  };

  const upcomingList = useMemo(
    () =>
      sortList(
        filterBookings(bookings, {
          kind: kindFilter,
          statusGroup: 'active',
          durationDays: 'all',
          nowMs,
        })
      ),
    [bookings, kindFilter, sortOrder, nowMs]
  );

  const completedList = useMemo(
    () =>
      sortList(
        filterBookings(bookings, {
          kind: kindFilter,
          statusGroup: 'completed',
          durationDays: 'all',
          nowMs,
        })
      ),
    [bookings, kindFilter, sortOrder, nowMs]
  );

  const cancelledList = useMemo(
    () =>
      sortList(
        filterBookings(bookings, {
          kind: kindFilter,
          statusGroup: 'cancelled',
          durationDays: 'all',
          nowMs,
        })
      ),
    [bookings, kindFilter, sortOrder, nowMs]
  );

  const groupsToRender = useMemo(() => {
    if (activeTab === 'upcoming') {
      return upcomingList.length > 0
        ? [{ id: 'upcoming' as const, title: `Upcoming (${upcomingList.length})`, color: 'text-[#D99026]', items: upcomingList }]
        : [];
    }
    if (activeTab === 'completed') {
      return completedList.length > 0
        ? [{ id: 'completed' as const, title: `Completed (${completedList.length})`, color: 'text-[#1E7E45]', items: completedList }]
        : [];
    }
    if (activeTab === 'cancelled') {
      return cancelledList.length > 0
        ? [{ id: 'cancelled' as const, title: `Cancelled (${cancelledList.length})`, color: 'text-[#DC3E3E]', items: cancelledList }]
        : [];
    }

    const groups: Array<{
      id: 'upcoming' | 'completed' | 'cancelled';
      title: string;
      color: string;
      items: BookingRecord[];
    }> = [];
    if (upcomingList.length > 0) {
      groups.push({
        id: 'upcoming',
        title: `Upcoming (${upcomingList.length})`,
        color: 'text-[#D99026]',
        items: upcomingList,
      });
    }
    if (completedList.length > 0) {
      groups.push({
        id: 'completed',
        title: `Completed (${completedList.length})`,
        color: 'text-[#1E7E45]',
        items: completedList,
      });
    }
    if (cancelledList.length > 0) {
      groups.push({
        id: 'cancelled',
        title: `Cancelled (${cancelledList.length})`,
        color: 'text-[#DC3E3E]',
        items: cancelledList,
      });
    }
    return groups;
  }, [activeTab, upcomingList, completedList, cancelledList]);

  const handleBookAgainClick = (bk: BookingRecord) => {
    if (onBookAgain) {
      onBookAgain(bk);
      return;
    }
    if (bk.kind === 'unreserved') onNavigate('unreserved');
    else if (bk.kind === 'platform') onNavigate('platform');
    else if (bk.kind === 'food') onNavigate('order-food');
    else onNavigate('reserved');
  };

  const refundPreview = cancelTarget
    ? calculateRefundAmount({
        fare: cancelTarget.fare,
        status: cancelTarget.status,
        hoursBeforeDeparture: 36,
      })
    : null;

  const bottomTabs: Array<{
    id: BookingTabId;
    label: string;
    activeTextColor: string;
  }> = [
    { id: 'upcoming', label: 'Upcoming', activeTextColor: 'text-[#D99026]' },
    { id: 'completed', label: 'Completed', activeTextColor: 'text-[#1E7E45]' },
    { id: 'cancelled', label: 'Cancelled', activeTextColor: 'text-[#DC3E3E]' },
    { id: 'all', label: 'All', activeTextColor: 'text-[#1E293B]' },
  ];

  const cancelModal = cancelTarget && refundPreview ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cancel Ticket Confirmation"
      className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Cancel Ticket {cancelTarget.pnrOrTicketNo}?
            </h2>
            <p className="text-xs text-slate-600 mt-1">{refundPreview.ruleSummary}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs space-y-1.5">
          <div className="flex justify-between text-slate-600">
            <span>Original Fare</span>
            <span className="font-mono-num">₹ {cancelTarget.fare.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-rose-600">
            <span>Cancellation Deduction</span>
            <span className="font-mono-num">- ₹ {refundPreview.deduction.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-emerald-700 border-t border-slate-200 pt-2 text-sm">
            <span>Instant R-Wallet Refund</span>
            <span className="font-mono-num">₹ {refundPreview.refundAmount.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setCancelTarget(null)}
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Keep Ticket
          </button>
          <button
            type="button"
            onClick={() => {
              onCancelBooking(cancelTarget.id, refundPreview.refundAmount);
              setCancelTarget(null);
            }}
            className="flex-1 min-h-[44px] rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
          >
            Confirm Cancellation
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (detailsTicket && showInvoice) {
    return (
      <UtsInvoiceScreen
        booking={detailsTicket}
        profile={profile}
        onBack={() => setShowInvoice(false)}
      />
    );
  }

  if (detailsTicket) {
    const effectiveDetailsStatus = resolveEffectiveBookingStatus(detailsTicket, nowMs);
    const isUpcomingTicket =
      effectiveDetailsStatus === 'Active' ||
      effectiveDetailsStatus === 'Confirmed' ||
      effectiveDetailsStatus === 'WL';

    if (isUpcomingTicket) {
      return (
        <UpcomingBookingDetailsScreen
          booking={detailsTicket}
          profile={profile}
          onBack={() => {
            setShowInvoice(false);
            setDetailsTicketId(null);
          }}
          onBookConnecting={(bk) => {
            setShowInvoice(false);
            setDetailsTicketId(null);
            if (onBookConnecting) {
              onBookConnecting(bk);
            } else {
              onNavigate('unreserved');
            }
          }}
        />
      );
    }

    return (
      <>
        <BookingDetailsScreen
          booking={detailsTicket}
          onBack={() => {
            setShowInvoice(false);
            setDetailsTicketId(null);
          }}
          onOpenInvoice={() => setShowInvoice(true)}
          onRequestCancel={(bk) => setCancelTarget(bk)}
          onNavigate={(screen) => {
            setShowInvoice(false);
            setDetailsTicketId(null);
            onNavigate(screen);
          }}
        />
        {cancelModal}
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Solid Blue Header matching screenshots */}
      <header className="sticky top-0 z-30 bg-[#0066FF] text-white px-4 sm:px-6 py-3.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 relative">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              type="button"
              onClick={onBackToHome}
              aria-label="Back to Home"
              className="h-9 w-9 rounded-full border border-white/85 flex items-center justify-center shrink-0 hover:bg-white/15 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-white" strokeWidth={2.2} />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-[19px] font-medium leading-tight text-white">
                My Bookings
              </h1>
              {activeTab !== 'upcoming' && (
                <p className="text-[13px] font-normal text-white/95 leading-snug mt-0.5">
                  Tickets from last 45 days are displayed
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSortMenu((v) => !v)}
            aria-label="Sort and filter bookings"
            className="h-10 w-10 rounded-full hover:bg-white/15 flex items-center justify-center shrink-0 transition-colors"
          >
            <SortDescendingIcon />
          </button>

          {showSortMenu && (
            <div
              role="menu"
              aria-label="Sort and Filter Options"
              className="absolute right-0 top-12 w-52 rounded-2xl bg-white text-slate-800 shadow-xl border border-slate-200 p-2 z-50 space-y-1 text-xs"
            >
              <p className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase">
                Sort Order
              </p>
              {(
                [
                  { id: 'newest', label: 'Newest First' },
                  { id: 'oldest', label: 'Oldest First' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSortOrder(opt.id);
                    setShowSortMenu(false);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-slate-100 flex items-center justify-between font-medium"
                >
                  <span>{opt.label}</span>
                  {sortOrder === opt.id && <Check className="h-3.5 w-3.5 text-[#0066FF]" />}
                </button>
              ))}
              <div className="border-t border-slate-100 my-1" />
              <p className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase">
                Ticket Category
              </p>
              {(
                [
                  { id: 'all', label: 'All Categories' },
                  { id: 'unreserved', label: 'Unreserved' },
                  { id: 'reserved', label: 'Reserved' },
                  { id: 'platform', label: 'Platform' },
                  { id: 'food', label: 'Food Order' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setKindFilter(cat.id);
                    setShowSortMenu(false);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-slate-100 flex items-center justify-between font-medium"
                >
                  <span>{cat.label}</span>
                  {kindFilter === cat.id && <Check className="h-3.5 w-3.5 text-[#0066FF]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pt-3 pb-28">
        {groupsToRender.length === 0 ? (
          <div className="min-h-[64vh] flex flex-col items-center justify-center text-center px-6">
            <button
              type="button"
              onClick={handleRefresh}
              aria-label="Refresh bookings"
              className="flex flex-col items-center focus:outline-none group"
            >
              <div className={`transition-transform ${refreshing ? 'scale-95 opacity-70' : ''}`}>
                <EmptyTicketIllustration />
              </div>
              <p className="mt-4 text-[14.5px] font-normal text-[#8E939C]">
                No Tickets Found. Swipe down to refresh.
              </p>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groupsToRender.map((group, idx) => (
              <section key={group.id} className="space-y-3.5">
                <div className="relative flex items-center justify-center py-0.5">
                  <h2 className={`font-display text-[15.5px] font-semibold ${group.color}`}>
                    {group.title}
                  </h2>
                  {idx === 0 && (
                    <button
                      type="button"
                      onClick={handleRefresh}
                      aria-label="Refresh tickets"
                      className="absolute right-0 h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
                    >
                      <RotateCcw
                        className={`h-[18px] w-[18px] ${refreshing ? 'animate-spin' : ''}`}
                      />
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {group.items.map((bk) => (
                    <TicketCard
                      key={bk.id}
                      booking={bk}
                      onBookAgain={() => handleBookAgainClick(bk)}
                      onViewDetails={() => {
                        setShowInvoice(false);
                        setDetailsTicketId(bk.id);
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Bottom 4-Tab Bar (Upcoming | Completed | Cancelled | All) */}
      <nav
        aria-label="Bookings Status Tabs"
        className="fixed bottom-0 left-0 right-0 z-40 rounded-t-[20px] bg-[#EAF2FD] border-t border-blue-100/80 px-3 py-2 shadow-[0_-2px_10px_rgba(15,23,42,0.05)]"
      >
        <div className="max-w-3xl mx-auto grid grid-cols-4 gap-2">
          {bottomTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl py-2 px-1 flex flex-col items-center justify-center gap-1 transition-all ${
                  active
                    ? 'bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)]'
                    : 'hover:bg-white/50'
                }`}
              >
                <TabTicketIcon tab={tab.id} active={active} />
                <span
                  className={`text-[12px] leading-tight whitespace-nowrap ${
                    active ? `font-semibold ${tab.activeTextColor}` : 'font-normal text-[#7C828D]'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {cancelModal}
    </div>
  );
}
