import type { ReactNode } from 'react';
import { UI_LABELS } from '../data/railData';
import { formatBookingKindLabel } from '../utils/railLogic';
import type { ActiveScreen, BookingRecord, LanguageCode, UserProfile } from '../types/rail';

interface HomeViewProps {
  profile: UserProfile;
  language: LanguageCode;
  upcomingBookings?: BookingRecord[];
  suburbanStationCount?: number;
  suburbanRouteCount?: number;
  onNavigate: (screen: ActiveScreen) => void;
  onSearchStationFromHome?: (query: string) => void;
  onOpenWalletTopup: () => void;
  onBookAgain?: (booking: BookingRecord) => void;
  onViewUpcomingDetails?: (booking: BookingRecord) => void;
}

type HomeOfferingKey = Exclude<ActiveScreen, 'home' | 'reserved' | 'unreserved' | 'platform' | 'performance-dashboard' | 'station-search' | 'travel-feedback'> | 'go-to-waves';

interface FactCardItem {
  id: string;
  caption: string;
  image: string;
}

const EXACT_DO_YOU_KNOW_CARDS: FactCardItem[] = [
  {
    id: 'dyk-1853',
    caption: 'First ever passenger train was run between Bori Bandar to Thane on April 16, 1853.',
    image: '/src/assets/images/dyk_steam_1853.jpg',
  },
  {
    id: 'dyk-chenab',
    caption:
      "Chenab Railway Bridge in Dharot, Jammu & Kashmir is the World's highest Railway Bridge.",
    image: '/src/assets/images/dyk_chenab_bridge.jpg',
  },
  {
    id: 'dyk-noney',
    caption:
      "Noney Bridge is going to be world's tallest railway bridge pier at a height of 141 meters.",
    image: '/src/assets/images/dyk_noney_bridge.jpg',
  },
  {
    id: 'dyk-hubballi',
    caption:
      "Shree Siddharoodha Swamiji Railway Station Hubballi is world's longest Railway Platform with length of 1505 meters.",
    image: '/src/assets/images/dyk_hubballi_platform.jpg',
  },
  {
    id: 'dyk-electrification',
    caption: '99% Electrification is achieved in Indian Railways.',
    image: '/src/assets/images/dyk_electrification_99.jpg',
  },
];

function OfferingIcon({ id }: { id: HomeOfferingKey }) {
  switch (id) {
    case 'search-trains':
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9 sm:h-10 sm:w-10" fill="none" aria-hidden="true">
          <circle cx="11.5" cy="11" r="4" stroke="#E072A4" strokeWidth="2.3" />
          <path d="M11.5 15v2.2" stroke="#E072A4" strokeWidth="2.3" strokeLinecap="round" />
          <circle cx="24" cy="24.5" r="4" stroke="#E072A4" strokeWidth="2.3" />
          <path
            d="M15.5 12h6.5a3.5 3.5 0 0 1 0 7H14a3.5 3.5 0 0 0 0 7h6"
            stroke="#E072A4"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'pnr-status':
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9 sm:h-10 sm:w-10" fill="none" aria-hidden="true">
          <path
            d="M6.5 12.5a2 2 0 0 1 2-2h19a2 2 0 0 1 2 2v3a2.5 2.5 0 0 0 0 5v3a2 2 0 0 1-2 2h-19a2 2 0 0 1-2-2v-3a2.5 2.5 0 0 0 0-5v-3Z"
            fill="#3B8E42"
          />
          <rect x="11.5" y="14.5" width="13" height="2" rx="1" fill="#EBF9EE" />
          <rect x="11.5" y="18" width="13" height="2" rx="1" fill="#EBF9EE" />
          <rect x="11.5" y="21.5" width="9" height="2" rx="1" fill="#EBF9EE" />
        </svg>
      );
    case 'coach-position':
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9 sm:h-10 sm:w-10" fill="none" aria-hidden="true">
          <path
            d="M7 14.5h13.5c3.8 0 7.2 2.2 8.7 5.8.4.9-.3 2.2-1.4 2.2H7V14.5Z"
            fill="#1D5BA3"
          />
          <path d="M19.5 16.2h3.8c1.7 0 3.1 1 3.9 2.5h-7.7v-2.5Z" fill="#E7F4FE" />
          <rect x="9.5" y="16.5" width="3" height="2.4" rx="0.6" fill="#E7F4FE" />
          <rect x="14" y="16.5" width="3" height="2.4" rx="0.6" fill="#E7F4FE" />
          <path d="M6.5 24.5h23" stroke="#1D5BA3" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="11" cy="23.5" r="1.4" fill="#1D5BA3" />
          <circle cx="16.5" cy="23.5" r="1.4" fill="#1D5BA3" />
          <circle cx="22.5" cy="23.5" r="1.4" fill="#1D5BA3" />
        </svg>
      );
    case 'track-train':
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9 sm:h-10 sm:w-10" fill="none" aria-hidden="true">
          <rect
            x="10"
            y="8"
            width="16"
            height="17"
            rx="4.5"
            stroke="#E5A22E"
            strokeWidth="2.4"
          />
          <rect x="12.8" y="11" width="10.4" height="6.2" rx="1.4" fill="#E5A22E" />
          <circle cx="13.5" cy="21" r="1.4" fill="#E5A22E" />
          <circle cx="22.5" cy="21" r="1.4" fill="#E5A22E" />
          <path
            d="M13 25l-2.2 3.5M23 25l2.2 3.5M10.5 28h15"
            stroke="#E5A22E"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'order-food':
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9 sm:h-10 sm:w-10" fill="none" aria-hidden="true">
          <path
            d="M19.5 11h8l-1.3 15.5a1.5 1.5 0 0 1-1.5 1.4h-3.4a1.5 1.5 0 0 1-1.5-1.4L19.5 11Z"
            fill="#4B4682"
          />
          <path d="M23.5 11V7.5l3-1.3" stroke="#4B4682" strokeWidth="2.1" strokeLinecap="round" />
          <path d="M8.5 18.5a6.5 6.5 0 0 1 13 0H8.5Z" fill="#4B4682" />
          <rect x="8" y="20.5" width="14" height="2.4" rx="1.2" fill="#4B4682" />
          <path d="M9 24.5h12v1.6a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-1.6Z" fill="#4B4682" />
        </svg>
      );
    case 'file-refund':
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9 sm:h-10 sm:w-10" fill="none" aria-hidden="true">
          <path
            d="M7.5 13a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4v-2Z"
            fill="#555555"
          />
          <circle cx="24" cy="12" r="4.8" fill="#555555" stroke="#EAEAEA" strokeWidth="1.6" />
          <path
            d="M22.3 10.3l3.4 3.4M25.7 10.3l-3.4 3.4"
            stroke="#FFFFFF"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'rail-madad':
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9 sm:h-10 sm:w-10" fill="none" aria-hidden="true">
          <path
            d="M7.5 16.5L13 11l5 4.2L23 11l5.5 5.5-2.8 2.8-2.7-2.4-4.8 5.9a2.6 2.6 0 0 1-3.8.2L7.5 16.5Z"
            fill="#E36D6D"
          />
          <path
            d="M12.5 20.5l3.8 3.8M15.4 18.4l3.8 3.8M18.3 16.3l3.8 3.8"
            stroke="#FCECEC"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M19.5 23.5l5.8-4.8"
            stroke="#E36D6D"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'go-to-waves':
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9 sm:h-10 sm:w-10" fill="none" aria-hidden="true">
          <path
            d="M7.5 13.5h3.8l2.5 9.8L18 4.8l4.2 18.5 2.5-9.8h3.8l-4.4 15.7h-3.4L18 17.5l-2.7 11.7h-3.4L7.5 13.5Z"
            fill="#FFFFFF"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function HomeView({
  profile,
  language,
  upcomingBookings = [],
  onNavigate,
  onBookAgain,
  onViewUpcomingDetails,
}: HomeViewProps) {
  const t = UI_LABELS[language];

  const journeyCards: Array<{
    id: ActiveScreen;
    label: string;
    image: string;
    fallbackBg: string;
  }> = [
    {
      id: 'reserved',
      label: t.reserved,
      image: '/src/assets/images/journey_reserved_1794993355760.jpg',
      fallbackBg: 'from-sky-100 to-blue-200',
    },
    {
      id: 'unreserved',
      label: t.unreserved,
      image: '/src/assets/images/journey_unreserved_1794993356648.jpg',
      fallbackBg: 'from-rose-100 to-amber-100',
    },
    {
      id: 'platform',
      label: t.platform,
      image: '/src/assets/images/journey_platform_1794993356427.jpg',
      fallbackBg: 'from-amber-100 to-orange-200',
    },
  ];

  const offerings: Array<{
    id: HomeOfferingKey;
    label: string;
    accessibleName: string;
    tileBg: string;
  }> = [
    {
      id: 'search-trains',
      label: language === 'en' ? 'Search\nTrains' : t.searchTrains,
      accessibleName: t.searchTrains,
      tileBg: 'bg-[#FDF0F6] hover:bg-[#FAE1EE]',
    },
    {
      id: 'pnr-status',
      label: language === 'en' ? 'PNR\nStatus' : t.pnrStatus,
      accessibleName: t.pnrStatus,
      tileBg: 'bg-[#E9F7EC] hover:bg-[#D9F1DF]',
    },
    {
      id: 'coach-position',
      label: language === 'en' ? 'Coach\nPosition' : t.coachPosition,
      accessibleName: t.coachPosition,
      tileBg: 'bg-[#E7F4FE] hover:bg-[#D5EAFC]',
    },
    {
      id: 'track-train',
      label: language === 'en' ? 'Track Your\nTrain' : t.trackTrain,
      accessibleName: t.trackTrain,
      tileBg: 'bg-[#FFF7E6] hover:bg-[#FEEED0]',
    },
    {
      id: 'order-food',
      label: language === 'en' ? 'Order\nFood' : t.orderFood,
      accessibleName: t.orderFood,
      tileBg: 'bg-[#E2E4FA] hover:bg-[#D2D6F7]',
    },
    {
      id: 'file-refund',
      label: language === 'en' ? 'File\nRefund' : t.fileRefund,
      accessibleName: t.fileRefund,
      tileBg: 'bg-[#EAEAEA] hover:bg-[#DCDCDC]',
    },
    {
      id: 'rail-madad',
      label: language === 'en' ? 'Rail\nMadad' : t.railMadad,
      accessibleName: t.railMadad,
      tileBg: 'bg-[#FCECEC] hover:bg-[#F9DADA]',
    },
    {
      id: 'go-to-waves',
      label: 'Go To\nWAVES',
      accessibleName: 'Go To WAVES',
      tileBg: 'bg-[#6F6D88]',
    },
  ];

  const greetingName = profile.name.trim() || 'Guest User';

  return (
    <div className="space-y-6 pb-4">
      {/* Greeting + Journey Planner */}
      <section aria-labelledby="journey-planner-heading" className="space-y-3">
        <p className="text-[13.5px] sm:text-sm font-medium text-[#1E3B70]">
          {t.hi}, {greetingName}!
        </p>

        <h1
          id="journey-planner-heading"
          className="font-display text-[17.5px] sm:text-xl font-bold text-[#0F2C5C]"
        >
          {t.journeyPlanner}
        </h1>

        <div className="grid grid-cols-3 gap-3 sm:gap-5 pt-0.5">
          {journeyCards.map((card) =>
            card.id === 'reserved' ? (
              <div key={card.id} className="flex flex-col items-center">
                <div
                  className={`relative aspect-[1.12/1] w-full overflow-hidden rounded-xl bg-gradient-to-br ${card.fallbackBg}`}
                >
                  <img
                    src={card.image}
                    alt={card.label}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover scale-[1.3]"
                  />
                </div>
                <span className="mt-2 text-[13px] sm:text-sm font-normal text-[#1E3B70] text-center">
                  {card.label}
                </span>
              </div>
            ) : (
              <button
                key={card.id}
                type="button"
                aria-label={card.label}
                onClick={() => onNavigate(card.id)}
                className="group flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B63E5] rounded-xl transition-transform active:scale-[0.98]"
              >
                <div
                  className={`relative aspect-[1.12/1] w-full overflow-hidden rounded-xl bg-gradient-to-br ${card.fallbackBg}`}
                >
                  <img
                    src={card.image}
                    alt={card.label}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover scale-[1.3] transition-transform duration-300 group-hover:scale-[1.34]"
                  />
                </div>
                <span className="mt-2 text-[13px] sm:text-sm font-normal text-[#1E3B70] text-center">
                  {card.label}
                </span>
              </button>
            )
          )}
        </div>
      </section>

      {/* More Offerings — 4x2 Pastel Tile Grid */}
      <section aria-labelledby="more-offerings-heading" className="space-y-3.5">
        <h2
          id="more-offerings-heading"
          className="font-display text-[17.5px] sm:text-xl font-bold text-[#0F2C5C]"
        >
          {t.moreOfferings}
        </h2>

        <div className="grid grid-cols-4 gap-x-2.5 gap-y-4 sm:gap-x-6 sm:gap-y-6">
          {offerings.map((item): ReactNode =>
            item.id === 'go-to-waves' ? (
              <div
                key={item.id}
                aria-label={item.accessibleName}
                className="flex flex-col items-center justify-start gap-2 rounded-xl py-0.5 min-h-[44px] cursor-default select-none"
              >
                <span
                  className={`flex h-[64px] w-[64px] sm:h-[74px] sm:w-[74px] items-center justify-center rounded-xl ${item.tileBg}`}
                >
                  <OfferingIcon id={item.id} />
                </span>
                <span className="text-[12px] sm:text-xs font-normal text-[#1E3B70] text-center leading-[1.3] whitespace-pre-line">
                  {item.label}
                </span>
              </div>
            ) : (
              <button
                key={item.id}
                type="button"
                aria-label={item.accessibleName}
                onClick={() => {
                  if (item.id !== 'go-to-waves') {
                    onNavigate(item.id);
                  }
                }}
                className="group flex flex-col items-center justify-start gap-2 rounded-xl py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B63E5] min-h-[44px]"
              >
                <span
                  className={`flex h-[64px] w-[64px] sm:h-[74px] sm:w-[74px] items-center justify-center rounded-xl transition-transform duration-150 group-active:scale-95 ${item.tileBg}`}
                >
                  <OfferingIcon id={item.id} />
                </span>
                <span className="text-[12px] sm:text-xs font-normal text-[#1E3B70] text-center leading-[1.3] whitespace-pre-line">
                  {item.label}
                </span>
              </button>
            )
          )}
        </div>
      </section>

      {/* Upcoming Journey — shown dynamically when active/upcoming bookings exist */}
      {upcomingBookings.length > 0 && (
        <section aria-labelledby="upcoming-journey-heading" className="space-y-3.5">
          <h2
            id="upcoming-journey-heading"
            className="font-display text-[17.5px] sm:text-xl font-bold text-[#0F2C5C]"
          >
            Upcoming Journey
          </h2>

          <div
            className={
              upcomingBookings.length === 1
                ? 'flex justify-center'
                : 'flex gap-3.5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1'
            }
          >
            {upcomingBookings.map((bk) => (
              <article
                key={bk.id}
                data-testid="home-upcoming-card"
                className={`relative overflow-hidden rounded-[22px] bg-[linear-gradient(108deg,#3B5298_0%,#635AB1_44%,#9572D1_74%,#C68AE9_100%)] text-white px-4 sm:px-5 py-4 shadow-xs ${
                  upcomingBookings.length === 1
                    ? 'w-full max-w-[390px]'
                    : 'w-[92%] max-w-[390px] shrink-0 snap-center'
                }`}
              >
                {/* Top & bottom semicircular ticket notches */}
                <span
                  aria-hidden="true"
                  className="absolute -top-[1px] right-[24%] h-3 w-6 rounded-b-full bg-white"
                />
                <span
                  aria-hidden="true"
                  className="absolute -bottom-[1px] right-[24%] h-3 w-6 rounded-t-full bg-white"
                />

                <div className="relative z-10">
                  <p className="text-[13.5px] font-normal text-white/95 leading-snug pt-0.5">
                    {bk.bookingDateLabel ?? bk.journeyDisplayDate}
                  </p>

                  <div className="border-t border-white/30 my-2.5" />

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] sm:text-[13.5px] font-normal text-white/95 uppercase tracking-wide truncate">
                      {bk.fromName}
                    </p>
                    <p className="text-[13px] sm:text-[13.5px] font-normal text-white/95 uppercase tracking-wide text-right truncate">
                      {bk.toName}
                    </p>
                  </div>

                  <div className="border-t border-white/30 mt-2.5 mb-3" />

                  <div className="flex items-center justify-between gap-2 pb-0.5">
                    <span className="text-[13.5px] sm:text-[15px] font-bold text-white shrink-0">
                      {formatBookingKindLabel(bk.kind)}
                    </span>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onBookAgain?.(bk)}
                        className="rounded-full border-[1.5px] border-white/95 bg-[linear-gradient(180deg,rgba(78,57,156,0.38)_0%,rgba(44,44,126,0.58)_100%)] hover:bg-[linear-gradient(180deg,rgba(78,57,156,0.55)_0%,rgba(44,44,126,0.75)_100%)] px-3 sm:px-3.5 py-1 text-[11.5px] sm:text-[12.5px] font-medium text-white whitespace-nowrap shadow-[0_1px_2px_rgba(30,27,75,0.18)] transition-colors"
                      >
                        Book Again
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewUpcomingDetails?.(bk)}
                        className="rounded-full border-[1.5px] border-white/95 bg-[linear-gradient(180deg,rgba(78,57,156,0.38)_0%,rgba(44,44,126,0.58)_100%)] hover:bg-[linear-gradient(180deg,rgba(78,57,156,0.55)_0%,rgba(44,44,126,0.75)_100%)] px-3 sm:px-3.5 py-1 text-[11.5px] sm:text-[12.5px] font-medium text-white whitespace-nowrap shadow-[0_1px_2px_rgba(30,27,75,0.18)] transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Do You know? — 5 Exact Railway Fact Cards with Image + Caption */}
      <section aria-labelledby="do-you-know-heading" className="space-y-3">
        <h2
          id="do-you-know-heading"
          className="font-display text-[17.5px] sm:text-xl font-bold text-[#0F2C5C]"
        >
          {t.doYouKnow}
        </h2>

        <div className="flex gap-3.5 md:grid md:grid-cols-5 md:gap-4 overflow-x-auto no-scrollbar pb-1">
          {EXACT_DO_YOU_KNOW_CARDS.map((card) => (
            <div
              key={card.id}
              className="flex flex-col items-start text-left w-[42%] md:w-full shrink-0"
            >
              <div className="relative aspect-[1.15/1] w-full overflow-hidden rounded-xl bg-slate-100">
                <img
                  src={card.image}
                  alt={card.caption}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover scale-[1.04]"
                />
              </div>
              <p className="mt-2.5 text-[12.5px] sm:text-[13px] leading-[1.38] font-normal text-[#1E3B70]">
                {card.caption}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Follow Us On Social Media Platforms */}
      <section aria-labelledby="follow-us-heading" className="space-y-3">
        <h2
          id="follow-us-heading"
          className="font-display text-[17.5px] sm:text-xl font-bold text-[#0F2C5C]"
        >
          {t.followUs}
        </h2>

        <div className="relative w-full max-w-[540px] aspect-[688/317] rounded-2xl overflow-hidden bg-slate-900 shadow-xs">
          <img
            src="/src/assets/images/social_train_sunset_banner.jpg"
            alt="Follow Indian Railways on X, Facebook, Instagram, and YouTube"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover scale-[1.02]"
          />
        </div>
      </section>

    </div>
  );
}
