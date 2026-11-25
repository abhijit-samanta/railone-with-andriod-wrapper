import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Minus, Plus, Sparkles, X } from 'lucide-react';
import type { Station } from '../types/rail';
import type { SuburbanFareBreakdown, SuburbanPathResult } from '../types/suburban';

function BlueTicketIcon() {
  return (
    <svg viewBox="0 0 32 22" className="h-[22px] w-[30px] text-[#0066FF] shrink-0" fill="none" aria-hidden="true">
      <path
        d="M2.5 3.5h27v4.2a2.8 2.8 0 0 0 0 5.6v5.2h-27v-5.2a2.8 2.8 0 0 0 0-5.6V3.5Z"
        fill="currentColor"
      />
      <path d="M10.5 4v14" stroke="#FFFFFF" strokeWidth="1.6" strokeDasharray="2.5 2" />
      <path d="M14.5 7.5h10M14.5 11h10M14.5 14.5h8" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

interface UnreservedJourneyScreenProps {
  fromStation: Station;
  toStation: Station;
  trainType: 'Ordinary' | 'Mail/Express' | 'Superfast';
  onChangeTrainType: (val: 'Ordinary' | 'Mail/Express' | 'Superfast') => void;
  ticketType: 'JOURNEY' | 'RETURN';
  onChangeTicketType: (val: 'JOURNEY' | 'RETURN') => void;
  adults: number;
  onChangeAdults: (val: number) => void;
  childrenCount: number;
  onChangeChildren: (val: number) => void;
  availConcession: boolean;
  onToggleConcession: () => void;
  payWithRWallet: boolean;
  onChangePayWithRWallet: (val: boolean) => void;
  baseFare: number;
  finalFare: number;
  discountAmount: number;
  estimatedDistanceKm: number;
  suburbanPath: SuburbanPathResult | null;
  suburbanFareBreakdown: SuburbanFareBreakdown | null;
  rWalletBalance: number;
  errorMsg: string | null;
  onBack: () => void;
  onBookNow: () => void;
}

export function UnreservedJourneyScreen({
  fromStation,
  toStation,
  trainType,
  onChangeTrainType,
  ticketType,
  onChangeTicketType,
  adults,
  onChangeAdults,
  childrenCount,
  onChangeChildren,
  availConcession,
  onToggleConcession,
  payWithRWallet,
  onChangePayWithRWallet,
  baseFare,
  finalFare,
  discountAmount,
  estimatedDistanceKm,
  suburbanPath,
  suburbanFareBreakdown,
  rWalletBalance,
  errorMsg,
  onBack,
  onBookNow,
}: UnreservedJourneyScreenProps) {
  const [showOthersMenu, setShowOthersMenu] = useState(false);
  const [showFareBreakup, setShowFareBreakup] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {/* Blue Header matching Screenshot 3 */}
      <header className="bg-[#0066FF] text-white px-4 py-3.5 shrink-0">
        <div className="w-full max-w-lg mx-auto flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Unreserved E-Ticket"
            className="h-9 w-9 rounded-full bg-white text-[#0066FF] hover:bg-blue-50 flex items-center justify-center transition-colors shrink-0"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
          <div>
            <h1 className="font-display text-[17.5px] font-bold text-white leading-tight">
              Unreserved Journey
            </h1>
            <p className="text-[12.5px] font-medium text-white/95 leading-tight mt-0.5">
              E-Ticket
            </p>
          </div>
        </div>
      </header>

      {/* Route Summary Strip */}
      <div className="bg-[#F6F8FC] border-b border-[#E5E9F0]/80 px-5 py-3.5 shrink-0">
        <div className="w-full max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15.5px] font-bold text-[#111827] uppercase truncate leading-tight">
              {fromStation.name}
            </p>
            <p className="text-[13.5px] font-normal text-[#4B5563] mt-0.5">
              {fromStation.code}
            </p>
          </div>

          <ArrowRight className="h-4 w-4 text-[#6B7280] shrink-0" strokeWidth={1.8} aria-hidden="true" />

          <div className="min-w-0 text-right">
            <p className="text-[15.5px] font-bold text-[#111827] uppercase truncate leading-tight">
              {toStation.name}
            </p>
            <p className="text-[13.5px] font-normal text-[#4B5563] mt-0.5">
              {toStation.code}
            </p>
          </div>
        </div>
      </div>

      {/* Main White Body */}
      <main className="flex-1 bg-white flex flex-col">
        <div className="w-full max-w-lg mx-auto flex-1 px-5 pt-5 pb-6 space-y-5">
          {/* Train Type */}
          <section>
            <h2 className="text-[15.5px] font-normal text-[#1F2937] mb-2.5">Train Type</h2>
            <div className="relative flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  onChangeTrainType('Ordinary');
                  setShowOthersMenu(false);
                }}
                className={`min-h-[38px] px-5 rounded-full text-[13.5px] font-medium uppercase border transition-colors ${
                  trainType === 'Ordinary'
                    ? 'bg-[#0066FF] border-[#0066FF] text-white'
                    : 'bg-white border-[#D1D5DB] text-[#374151] hover:bg-slate-50'
                }`}
              >
                ORDINARY
              </button>

              <button
                type="button"
                onClick={() => {
                  onChangeTrainType('Mail/Express');
                  setShowOthersMenu(false);
                }}
                className={`min-h-[38px] px-5 rounded-full text-[13.5px] font-medium uppercase border transition-colors ${
                  trainType === 'Mail/Express'
                    ? 'bg-[#0066FF] border-[#0066FF] text-white'
                    : 'bg-white border-[#D1D5DB] text-[#374151] hover:bg-slate-50'
                }`}
              >
                MAIL/EXP
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOthersMenu((v) => !v)}
                  aria-expanded={showOthersMenu}
                  className={`min-h-[38px] px-4 rounded-full text-[13.5px] font-medium uppercase border inline-flex items-center gap-2 transition-colors ${
                    trainType === 'Superfast'
                      ? 'bg-[#0066FF] border-[#0066FF] text-white'
                      : 'bg-white border-[#D1D5DB] text-[#374151] hover:bg-slate-50'
                  }`}
                >
                  <span>{trainType === 'Superfast' ? 'SUPERFAST' : 'OTHERS'}</span>
                  <ChevronDown
                    className={`h-4 w-4 ${trainType === 'Superfast' ? 'text-white' : 'text-[#0066FF]'}`}
                    strokeWidth={2.2}
                  />
                </button>

                {showOthersMenu && (
                  <div className="absolute right-0 mt-1.5 w-40 rounded-2xl border border-slate-200 bg-white shadow-lg py-1 z-20">
                    {(['Superfast', 'Ordinary', 'Mail/Express'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          onChangeTrainType(opt);
                          setShowOthersMenu(false);
                        }}
                        className={`w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-[#F0F6FF] ${
                          trainType === opt ? 'text-[#0066FF]' : 'text-[#374151]'
                        }`}
                      >
                        {opt === 'Superfast' ? 'Superfast (SF)' : opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Ticket Type */}
          <section>
            <h2 className="text-[15.5px] font-normal text-[#1F2937] mb-2.5">Ticket Type</h2>
            <div className="flex items-center gap-3">
              {(['JOURNEY', 'RETURN'] as const).map((tt) => {
                const active = ticketType === tt;
                return (
                  <button
                    key={tt}
                    type="button"
                    onClick={() => onChangeTicketType(tt)}
                    className={`min-h-[38px] px-6 rounded-full text-[13.5px] font-medium uppercase border transition-colors ${
                      active
                        ? 'bg-[#0066FF] border-[#0066FF] text-white'
                        : 'bg-white border-[#D1D5DB] text-[#374151] hover:bg-slate-50'
                    }`}
                  >
                    {tt}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Adult & Child Steppers */}
          <section className="space-y-3">
            {/* Adult Card */}
            <div className="rounded-xl border border-[#D1D5DB]/80 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-[15.5px] text-[#6B7280]">Adult</span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  aria-label="Decrease Adult count"
                  disabled={adults <= 1}
                  onClick={() => onChangeAdults(Math.max(1, adults - 1))}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[#0066FF] hover:bg-[#EAF4FF] disabled:opacity-45 transition-colors"
                >
                  <Minus className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </button>
                <span
                  aria-label="Adult count"
                  className="h-8 w-8 rounded-full bg-[#0066FF] text-white text-[14px] font-semibold flex items-center justify-center font-mono-num"
                >
                  {adults}
                </span>
                <button
                  type="button"
                  aria-label="Increase Adult count"
                  disabled={adults >= 4}
                  onClick={() => onChangeAdults(Math.min(4, adults + 1))}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[#0066FF] hover:bg-[#EAF4FF] disabled:opacity-45 transition-colors"
                >
                  <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </button>
              </div>
            </div>

            {/* Child Card */}
            <div>
              <div className="rounded-xl border border-[#D1D5DB]/80 bg-white px-4 py-3 flex items-center justify-between">
                <span className="text-[15.5px] text-[#6B7280]">Child</span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    aria-label="Decrease Child count"
                    disabled={childrenCount <= 0}
                    onClick={() => onChangeChildren(Math.max(0, childrenCount - 1))}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-[#0066FF] hover:bg-[#EAF4FF] disabled:opacity-45 transition-colors"
                  >
                    <Minus className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </button>
                  <span
                    aria-label="Child count"
                    className="h-8 w-8 rounded-full bg-[#0066FF] text-white text-[14px] font-semibold flex items-center justify-center font-mono-num"
                  >
                    {childrenCount}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase Child count"
                    disabled={childrenCount >= 3}
                    onClick={() => onChangeChildren(Math.min(3, childrenCount + 1))}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-[#0066FF] hover:bg-[#EAF4FF] disabled:opacity-45 transition-colors"
                  >
                    <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </button>
                </div>
              </div>
              <p className="text-[12.5px] text-[#6B7280] mt-2">
                Aged between 5 and 12 years on the day of Travel
              </p>
            </div>
          </section>

          {/* Class */}
          <section>
            <h2 className="text-[15.5px] font-normal text-[#1F2937] mb-2.5">Class</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="min-h-[38px] px-6 rounded-full bg-[#0066FF] text-white text-[13.5px] font-medium uppercase"
              >
                SECOND
              </button>
            </div>
          </section>

          {/* Avail Concession */}
          <div className="pt-1">
            <button
              type="button"
              role="checkbox"
              aria-checked={availConcession}
              onClick={onToggleConcession}
              className="inline-flex items-center gap-3 text-left group"
            >
              <span
                className={`h-[20px] w-[20px] rounded-full border-[1.7px] flex items-center justify-center transition-colors ${
                  availConcession
                    ? 'bg-[#0066FF] border-[#0066FF] text-white'
                    : 'bg-white border-[#6B7280] group-hover:border-[#0066FF]'
                }`}
              >
                {availConcession && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="text-[15px] text-[#4B5563]">Avail Concession</span>
            </button>
          </div>
        </div>

        {/* Sticky Bottom Fare & CTA Section matching Screenshot 3 */}
        <div className="mt-auto shrink-0">
          <div className="bg-[#F6F8FC] border-t border-[#E5E9F0] px-5 py-3">
            <div className="w-full max-w-lg mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <BlueTicketIcon />
                <span className="font-display text-[16px] font-bold text-[#111842]">Fare</span>
              </div>
              <div className="text-right">
                <p className="font-mono-num text-[16px] font-bold text-[#111827]">
                  ₹ {baseFare}
                </p>
                <button
                  type="button"
                  onClick={() => setShowFareBreakup(true)}
                  className="mt-1 inline-flex items-center justify-center rounded-full border border-[#6B7280] bg-white px-3 py-0.5 text-[11.5px] font-medium text-[#374151] hover:bg-slate-50 transition-colors"
                >
                  Fare Breakup
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white px-5 pt-3 pb-5 border-t border-[#F1F5F9]">
            <div className="w-full max-w-lg mx-auto space-y-3">
              {errorMsg && (
                <p
                  role="alert"
                  className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
                >
                  {errorMsg}
                </p>
              )}

              <p className="text-[12px] text-[#374151] text-center">
                By proceeding further you agree to our{' '}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-[#0066FF] font-medium hover:underline"
                >
                  Terms &amp; Conditions
                </button>
              </p>

              <button
                type="button"
                onClick={onBookNow}
                className="w-full min-h-[48px] rounded-full bg-[#0066FF] hover:bg-[#0052CC] text-white text-[16px] font-medium transition-colors"
              >
                Book Now
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Fare Breakup Dialog */}
      {showFareBreakup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fare Breakup"
          onClick={() => setShowFareBreakup(false)}
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#111842]">Fare Breakup</h2>
                <p className="text-xs text-slate-500">
                  {fromStation.name} ({fromStation.code}) → {toStation.name} ({toStation.code})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFareBreakup(false)}
                aria-label="Close Fare Breakup"
                className="h-9 w-9 rounded-full border border-slate-200 hover:bg-slate-50 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#F4F8FD] border border-blue-200/80 p-3.5 text-xs space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span>Route Distance</span>
                <span className="font-mono-num font-semibold text-slate-900">{estimatedDistanceKm} km</span>
              </div>
              {suburbanPath?.found && (
                <div className="flex justify-between">
                  <span>Suburban Corridor</span>
                  <span className="font-semibold text-slate-900 text-right">
                    {suburbanPath.legs[0]?.routeName ?? 'Kolkata Suburban'} ({suburbanPath.totalStopCount} stops)
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Train / Class / Type</span>
                <span className="font-semibold text-slate-900">
                  {trainType} · Second (II) · {ticketType}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Passengers</span>
                <span className="font-semibold text-slate-900">
                  {adults} Adult{adults > 1 ? 's' : ''}
                  {childrenCount > 0 ? `, ${childrenCount} Child` : ''}
                </span>
              </div>
              {availConcession && (
                <div className="flex justify-between text-emerald-700">
                  <span>Concession Applied</span>
                  <span className="font-semibold">50% Concession</span>
                </div>
              )}
              {suburbanFareBreakdown && (
                <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-blue-200/60">
                  <span>Official Slab (II Single)</span>
                  <span className="font-mono-num">₹ {suburbanFareBreakdown.iiSingle}</span>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-[#EAF4FF] border border-blue-200/80 p-3.5 space-y-2">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                  <Sparkles className="h-4 w-4 text-[#0066FF]" />
                  Pay with R-Wallet (Balance ₹{rWalletBalance.toFixed(2)} · 3% off)
                </span>
                <input
                  type="checkbox"
                  checked={payWithRWallet}
                  onChange={(e) => onChangePayWithRWallet(e.target.checked)}
                  className="h-4 w-4 accent-[#0066FF]"
                />
              </label>
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-blue-200/60">
                <span className="text-slate-600">
                  Base ₹{baseFare}
                  {discountAmount > 0 ? ` − ₹${discountAmount.toFixed(2)} (R-Wallet bonus)` : ''}
                </span>
                <span className="font-mono-num text-base font-bold text-[#0066FF]">
                  ₹ {finalFare.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowFareBreakup(false)}
              className="w-full min-h-[44px] rounded-full bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0052CC]"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="UTS Terms and Conditions"
          onClick={() => setShowTermsModal(false)}
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h2 className="font-display text-base font-bold text-[#111842]">
                UTS E-Ticket Terms &amp; Conditions
              </h2>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                aria-label="Close Terms"
                className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
              <li>Paperless journey must commence within 3 hours of ticket issuance.</li>
              <li>Tickets are non-transferable and stored offline inside My Bookings for TTE inspection.</li>
              <li>R-Wallet payments enjoy an instant 3% bonus discount on unreserved fares.</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowTermsModal(false)}
              className="w-full min-h-[42px] rounded-full bg-[#0066FF] text-white text-sm font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
