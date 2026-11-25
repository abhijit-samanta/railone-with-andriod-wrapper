import { useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, CreditCard } from 'lucide-react';
import type { Station } from '../types/rail';
import { canBookTicketWithWallet } from '../utils/railLogic';

function IndianRailwaysCrestIcon() {
  return (
    <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="17" fill="#0A3D91" />
      <circle cx="18" cy="18" r="14.2" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="1.8 1.5" />
      <circle cx="18" cy="18" r="10.2" stroke="#FFFFFF" strokeWidth="1.2" />
      <rect x="13" y="12.5" width="10" height="8" rx="1.8" fill="#FFFFFF" />
      <rect x="14.5" y="14" width="3" height="2.6" rx="0.4" fill="#0A3D91" />
      <rect x="18.5" y="14" width="3" height="2.6" rx="0.4" fill="#0A3D91" />
      <circle cx="15.2" cy="18.6" r="0.9" fill="#0A3D91" />
      <circle cx="20.8" cy="18.6" r="0.9" fill="#0A3D91" />
      <path d="M12.5 23.2h11M14.5 21.5l-1.5 2.5M21.5 21.5l1.5 2.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function UpiLogoBadge() {
  return (
    <div className="flex items-center gap-3.5" aria-hidden="true">
      {/* Tricolor UPI icon */}
      <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" fill="none">
        <path d="M9.5 4.5L21 14 9.5 23.5l3.2-9.5-3.2-9.5Z" fill="#097939" />
        <path d="M5.5 4.5L17 14 5.5 23.5l3.2-9.5-3.2-9.5Z" fill="#E67E22" />
      </svg>
      {/* Italic UPI wordmark + double chevron */}
      <svg viewBox="0 0 72 22" className="h-[20px] w-[66px] shrink-0" fill="none">
        <text
          x="1"
          y="17"
          fill="#5F6368"
          fontSize="16"
          fontWeight="800"
          fontStyle="italic"
          fontFamily="Plus Jakarta Sans, sans-serif"
          letterSpacing="1"
        >
          UPI
        </text>
        <path d="M47 4.5L55 11l-8 6.5 2.3-6.5L47 4.5Z" fill="#E67E22" />
        <path d="M52 4.5L60 11l-8 6.5 2.3-6.5L52 4.5Z" fill="#097939" />
      </svg>
    </div>
  );
}

interface UnreservedMakePaymentScreenProps {
  fromStation: Station;
  toStation: Station;
  trainType: 'Ordinary' | 'Mail/Express' | 'Superfast';
  ticketType: 'JOURNEY' | 'RETURN';
  adults: number;
  childrenCount: number;
  availConcession: boolean;
  baseFare: number;
  finalFare: number;
  discountAmount: number;
  rWalletBalance: number;
  isPlatform?: boolean;
  errorMsg: string | null;
  onBack: () => void;
  onPayUsingRWallet: () => void;
}

export function UnreservedMakePaymentScreen({
  fromStation,
  toStation,
  trainType,
  ticketType,
  adults,
  childrenCount,
  availConcession,
  baseFare,
  finalFare,
  discountAmount,
  rWalletBalance,
  isPlatform = false,
  errorMsg,
  onBack,
  onPayUsingRWallet,
}: UnreservedMakePaymentScreenProps) {
  const [showReview, setShowReview] = useState(false);
  const walletCheck = canBookTicketWithWallet({
    rWalletBalance,
    payableFare: finalFare,
  });
  const activeErrorMsg = errorMsg ?? (!walletCheck.allowed ? walletCheck.reason : null);

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {/* Blue Header + Floating White Route/Amount Card */}
      <header className="bg-[#0066FF] text-white shrink-0">
        <div className="w-full max-w-lg mx-auto px-4 pt-4 pb-3.5 flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Unreserved Journey"
            className="h-9 w-9 rounded-full border-[1.4px] border-white/85 text-white hover:bg-white/15 flex items-center justify-center transition-colors shrink-0"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <h1 className="font-display text-[19px] font-medium text-white tracking-tight">
            Make Payment
          </h1>
        </div>

        <div className="w-full max-w-lg mx-auto px-4 pb-5">
          <div className="rounded-[16px] bg-white px-5 py-3.5 shadow-sm text-[#111827]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {isPlatform ? (
                  <span className="text-[15.5px] font-bold text-[#111827] uppercase">
                    {fromStation.code} · PLATFORM
                  </span>
                ) : (
                  <>
                    <span className="text-[15.5px] font-bold text-[#111827] uppercase">
                      {fromStation.code}
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#9CA3AF] shrink-0" strokeWidth={1.7} aria-hidden="true" />
                    <span className="text-[15.5px] font-bold text-[#111827] uppercase">
                      {toStation.code}
                    </span>
                  </>
                )}
              </div>

              <div className="text-right shrink-0">
                <p className="font-mono-num text-[15.5px] font-bold text-[#111827]">
                  Pay ₹ {baseFare}
                </p>
                <button
                  type="button"
                  onClick={() => setShowReview((prev) => !prev)}
                  aria-expanded={showReview}
                  className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-normal text-[#374151] hover:text-[#0066FF] transition-colors"
                >
                  <span>Review</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showReview ? 'rotate-180' : ''}`}
                    strokeWidth={2}
                  />
                </button>
              </div>
            </div>

            {showReview && (
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>{isPlatform ? 'Station' : 'Route'}</span>
                  <span className="font-semibold text-slate-900">
                    {isPlatform ? `${fromStation.name} (${fromStation.code})` : `${fromStation.name} → ${toStation.name}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Ticket Details</span>
                  <span className="font-semibold text-slate-900">
                    {isPlatform ? 'Platform Entry · Valid 2 Hours' : `${trainType} · Second (II) · ${ticketType}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Passengers</span>
                  <span className="font-semibold text-slate-900">
                    {isPlatform
                      ? `${adults} Person${adults > 1 ? 's' : ''}`
                      : `${adults} Adult${adults > 1 ? 's' : ''}${childrenCount > 0 ? `, ${childrenCount} Child` : ''}${availConcession ? ' · Concession' : ''}`}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700 pt-1 border-t border-slate-100">
                  <span>R-Wallet Net Payable (3% bonus)</span>
                  <span className="font-mono-num font-bold">
                    ₹ {finalFare.toFixed(2)} (Save ₹{discountAmount.toFixed(2)})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Payment Options & Pay Using R-Wallet CTA */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-5 pb-8">
        <div className="rounded-[20px] border border-[#E5E9F0] bg-white overflow-hidden shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
          {/* Row 1: R-Wallet (Active & Clickable when balance covers fare) */}
          <button
            type="button"
            disabled={!walletCheck.allowed}
            onClick={onPayUsingRWallet}
            className="w-full bg-[#F1FAF7] hover:bg-[#E5F6F0] disabled:bg-slate-50 disabled:opacity-65 disabled:cursor-not-allowed px-5 py-4 flex items-center justify-between gap-3 text-left transition-colors border-b border-dashed border-[#CBD5E1]"
          >
            <div className="flex items-center gap-4 min-w-0">
              <IndianRailwaysCrestIcon />
              <div className="min-w-0">
                <p className="text-[13.5px] font-normal text-[#4B5563] leading-tight">
                  R-Wallet
                </p>
                <p
                  className={`font-mono-num text-[17px] font-bold mt-0.5 leading-tight ${
                    walletCheck.allowed ? 'text-[#0F7657]' : 'text-rose-700'
                  }`}
                >
                  ₹ {rWalletBalance.toFixed(2)}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#111827] shrink-0" strokeWidth={1.8} />
          </button>

          {/* Row 2: UPI (Click event disabled, hover effect only) */}
          <button
            type="button"
            aria-label="UPI"
            className="w-full bg-white hover:bg-slate-50 px-5 py-4 flex items-center justify-between gap-3 text-left transition-colors border-b border-dashed border-[#CBD5E1]"
          >
            <UpiLogoBadge />
            <ChevronRight className="h-5 w-5 text-[#111827] shrink-0" strokeWidth={1.8} />
          </button>

          {/* Row 3: Other Payment Methods (Click event disabled, hover effect only) */}
          <button
            type="button"
            className="w-full bg-white hover:bg-slate-50 px-5 py-4 flex items-center justify-between gap-3 text-left transition-colors"
          >
            <div className="flex items-center gap-4 min-w-0">
              <CreditCard className="h-6 w-6 text-[#6B7280] shrink-0" strokeWidth={1.6} />
              <span className="text-[15.5px] font-medium text-[#374151] truncate">
                Other Payment Methods
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-[#111827] shrink-0" strokeWidth={1.8} />
          </button>
        </div>

        {activeErrorMsg && (
          <p
            role="alert"
            className="mt-4 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
          >
            {activeErrorMsg}
          </p>
        )}

        <button
          type="button"
          disabled={!walletCheck.allowed}
          onClick={onPayUsingRWallet}
          className="mt-7 w-full min-h-[50px] rounded-full bg-[#0066FF] hover:bg-[#0052CC] disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed text-white text-[16px] font-medium transition-colors shadow-2xs"
        >
          Pay Using R-Wallet
        </button>
      </main>
    </div>
  );
}
