import { useState } from 'react';
import {
  ArrowLeft,
  Edit3,
  Eye,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { computeProfileCompletion } from '../utils/railLogic';
import {
  AadhaarAuthSheet,
  ChangePasswordSheet,
  EditDetailsModal,
  MyAccountSheet,
  MyTransactionsScreen,
  YourDetailsModal,
} from './YouSubScreens';
import type { SavedPassenger, UserProfile, WalletTransaction } from '../types/rail';

interface YouViewProps {
  profile: UserProfile;
  savedPassengers: SavedPassenger[];
  walletTransactions: WalletTransaction[];
  onUpdateProfile: (next: UserProfile) => void;
  onAddWalletMoney: (amount: number) => void;
  onSavePassenger: (pax: SavedPassenger) => void;
  onDeletePassenger: (id: string) => void;
  onOpenAuthModal: () => void;
  onBackToHome?: () => void;
}

function AvatarSilhouette() {
  return (
    <div className="h-[92px] w-[92px] rounded-full bg-[#47ADEB] flex items-center justify-center shadow-2xs">
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" aria-hidden="true">
        <circle cx="32" cy="22" r="8.5" fill="#C4E8FC" />
        <ellipse cx="32" cy="41" rx="16.5" ry="9.5" fill="#C4E8FC" />
      </svg>
    </div>
  );
}

function GreenWalletIcon() {
  return (
    <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0" fill="none" aria-hidden="true">
      <rect x="4" y="7" width="28" height="22" rx="5.5" fill="#39B54A" />
      <rect x="19" y="13.5" width="13.5" height="9" rx="4.5" fill="#FFFFFF" />
      <circle cx="24" cy="18" r="2.2" fill="#39B54A" />
      <rect x="8.5" y="11" width="7" height="2.2" rx="1.1" fill="#A9E5B2" />
    </svg>
  );
}

function AmberUsersIcon() {
  return (
    <svg viewBox="0 0 36 36" className="h-8 w-8 shrink-0" fill="none" aria-hidden="true">
      <circle cx="14" cy="13.5" r="4.2" fill="#F4B44C" />
      <path d="M6.5 26.5c0-3.8 3.3-6.5 7.5-6.5s7.5 2.7 7.5 6.5" fill="#F4B44C" />
      <circle cx="24.5" cy="15" r="3.1" fill="#F6C470" />
      <path d="M21 26.5c0-2.8 2.2-4.8 5.2-4.8 2.5 0 4.5 1.7 4.5 4.8" fill="#F6C470" />
    </svg>
  );
}

function TileIcon({
  kind,
}: {
  kind: 'password' | 'account' | 'transfer' | 'transaction' | 'aadhar';
}) {
  switch (kind) {
    case 'password':
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9" fill="none" aria-hidden="true">
          <path d="M19 6v24" stroke="#42ADEB" strokeWidth="2.2" strokeLinecap="round" />
          <path
            d="M17 11.5h-4.5a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3H17v-13Z"
            fill="#42ADEB"
          />
          <circle cx="12.5" cy="18" r="1.2" fill="#E5F7FF" />
          <circle cx="15" cy="18" r="1.2" fill="#E5F7FF" />
          <path
            d="M21 11.5h3.5a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H21v-13Z"
            fill="#7CC8F4"
          />
        </svg>
      );
    case 'account':
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9" fill="none" aria-hidden="true">
          <rect x="6" y="9" width="22" height="15" rx="3" fill="#5CB85C" />
          <rect x="6" y="13" width="22" height="3" fill="#E9FBE9" />
          <rect x="9" y="18.5" width="7" height="2" rx="1" fill="#E9FBE9" />
          <circle cx="26.5" cy="23.5" r="5" fill="#4CAF50" stroke="#E9FBE9" strokeWidth="1.5" />
          <path
            d="M24.5 23.5l1.4 1.4 2.8-2.8"
            stroke="#FFFFFF"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'transfer':
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9" fill="none" aria-hidden="true">
          <path
            d="M7 11.5a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v3.5a3 3 0 0 0 0 6v3.5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V21a3 3 0 0 0 0-6v-3.5Z"
            fill="#47BCEB"
          />
          <path
            d="M18 11.5v13"
            stroke="#EEF6FB"
            strokeWidth="2"
            strokeDasharray="2.5 2.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'transaction':
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9" fill="none" aria-hidden="true">
          <path
            d="M10 7.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v21l-3-2-3 2-3-2-3 2-4-2V7.5Z"
            fill="#F4B44C"
          />
          <rect x="14" y="11.5" width="8" height="2.2" rx="1.1" fill="#FDF2E6" />
          <circle cx="18" cy="19" r="2.1" fill="#FDF2E6" />
        </svg>
      );
    case 'aadhar':
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9" fill="none" aria-hidden="true">
          <rect x="6" y="11" width="21" height="15" rx="3" fill="#C4C462" />
          <rect x="9" y="14.5" width="5.5" height="4.5" rx="1" fill="#F7F8E8" />
          <rect x="9" y="21" width="5" height="2" rx="1" fill="#F7F8E8" />
          <rect x="16" y="21" width="6" height="2" rx="1" fill="#F7F8E8" />
          <rect x="23" y="6.5" width="8" height="8" rx="2" fill="#B5B552" stroke="#F7F8E8" strokeWidth="1.4" />
          <path
            d="M27 12.2V8.8M25.5 10.2 27 8.7l1.5 1.5"
            stroke="#FFFFFF"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export function YouView({
  profile,
  savedPassengers,
  walletTransactions,
  onUpdateProfile,
  onSavePassenger,
  onDeletePassenger,
  onBackToHome,
}: YouViewProps) {
  const [showProfileDetails, setShowProfileDetails] = useState<'view' | 'edit' | null>(null);
  const [showPassbook, setShowPassbook] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPaxListModal, setShowPaxListModal] = useState(false);
  const [showPaxModal, setShowPaxModal] = useState<SavedPassenger | 'new' | null>(null);
  const [paxForm, setPaxForm] = useState<SavedPassenger>({
    id: '',
    name: '',
    age: 28,
    gender: 'M',
    berthPref: 'LB',
    mealPref: 'Veg',
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAadharModal, setShowAadharModal] = useState(false);
  const [walletRefreshing, setWalletRefreshing] = useState(false);

  const completionPct = computeProfileCompletion(profile);

  const handleOpenNewPax = () => {
    setPaxForm({
      id: `pax-${Date.now()}`,
      name: '',
      age: 28,
      gender: 'M',
      berthPref: 'LB',
      mealPref: 'Veg',
    });
    setShowPaxModal('new');
  };

  const handleOpenEditPax = (p: SavedPassenger) => {
    setPaxForm({ ...p });
    setShowPaxModal(p);
  };

  const handleSavePaxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paxForm.name.trim() || paxForm.age < 1 || paxForm.age > 120) return;
    onSavePassenger({ ...paxForm, name: paxForm.name.trim() });
    setShowPaxModal(null);
  };

  const handleRefreshWallet = () => {
    setWalletRefreshing(true);
    setTimeout(() => setWalletRefreshing(false), 450);
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto">
        {/* Top Sky-Blue Curved Hero matching Image 1 */}
        <section className="rounded-b-[28px] bg-[#E5F6FF] px-4 sm:px-5 pt-3.5 pb-5">
          <div className="flex items-center">
            <button
              type="button"
              onClick={onBackToHome}
              aria-label="Back to Home"
              className="h-10 w-10 rounded-full border-[1.5px] border-[#66AFE9] bg-white/40 hover:bg-white/75 flex items-center justify-center text-[#1976D2] transition-colors"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          <div className="flex flex-col items-center text-center -mt-2">
            <AvatarSilhouette />
            <h1 className="font-display text-[18.5px] sm:text-[20px] font-bold text-[#111827] mt-2.5 leading-snug px-2">
              {profile.name}
            </h1>

            <div className="flex items-center justify-center gap-3 mt-1 text-[13.5px] font-medium text-[#1565D8]">
              <button
                type="button"
                onClick={() => setShowProfileDetails('view')}
                className="inline-flex items-center gap-1.5 hover:underline min-h-[32px]"
              >
                <Eye className="h-4 w-4" strokeWidth={2} /> View Details
              </button>
              <span className="text-[#93B8DC]" aria-hidden="true">
                |
              </span>
              <button
                type="button"
                onClick={() => setShowProfileDetails('edit')}
                className="inline-flex items-center gap-1.5 hover:underline min-h-[32px]"
              >
                <Edit3 className="h-3.5 w-3.5" strokeWidth={2} /> Edit Details
              </button>
            </div>
          </div>

          {/* R-Wallet White Pill Card */}
          <div className="mt-4 rounded-[20px] bg-white px-4 py-3 shadow-[0_2px_12px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowPassbook(true)}
              className="flex items-center gap-3.5 text-left min-w-0"
            >
              <GreenWalletIcon />
              <div className="min-w-0">
                <p className="text-[13px] font-normal text-[#4B5563] leading-tight">R-Wallet</p>
                <p className="font-display tabular-nums text-[19px] font-bold text-[#1E293B] mt-0.5 leading-tight">
                  ₹ {profile.rWalletBalance.toFixed(2)}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleRefreshWallet}
                aria-label="Refresh R-Wallet balance"
                className="h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-[#0066FF]"
              >
                <RefreshCw
                  className={`h-5 w-5 ${walletRefreshing ? 'animate-spin' : ''}`}
                  strokeWidth={2}
                />
              </button>
              <div className="min-h-[38px] px-6 rounded-full bg-[#0066FF] hover:bg-[#0052CC] text-white text-[14px] font-medium transition-colors flex items-center justify-center cursor-default select-none">
                Add
              </div>
            </div>
          </div>
        </section>

        {/* Body Content on White */}
        <div className="px-4 sm:px-5 pt-3.5 space-y-3">
          {/* Profile Complete Progress Card */}
          <div className="rounded-[14px] border border-slate-200/90 bg-white px-4 py-3 shadow-[0_1px_4px_rgba(15,23,42,0.03)]">
            <p className="text-[15px] font-normal text-[#1E293B] mb-2">Profile Complete</p>
            <div className="flex items-center gap-3">
              <div className="h-2.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#26890C] transition-all duration-300"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <span className="font-display tabular-nums text-[15px] font-medium text-[#111827] shrink-0">
                {completionPct}%
              </span>
            </div>
          </div>

          {/* Saved Passengers Warm Cream Card */}
          <div className="rounded-[14px] bg-[#FEF4E6] px-3.5 py-3.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowPaxListModal(true)}
              className="flex items-center gap-2.5 text-left min-w-0 flex-1"
            >
              <AmberUsersIcon />
              <div className="min-w-0">
                <p className="font-display text-[14.5px] font-semibold text-[#111827] leading-snug">
                  Saved Passengers
                </p>
                <p className="text-[12px] text-[#4B5563] mt-0.5 whitespace-nowrap">
                  Add/Edit Passenger info
                </p>
              </div>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowPaxListModal(true)}
                aria-label="View saved passengers"
                className="h-8 w-8 rounded-full hover:bg-amber-200/40 flex items-center justify-center text-[#D99B26]"
              >
                <RefreshCw className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={handleOpenNewPax}
                className="min-h-[38px] px-5 rounded-full bg-[#F9C661] hover:bg-[#F3B742] text-[#111827] text-[13.5px] font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* 3x2 Pastel Action Grid matching Image 1 */}
          <div className="grid grid-cols-3 gap-2.5 pt-0.5">
            {/* 1. Change Password */}
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              className="rounded-[12px] bg-[#E5F7FF] hover:bg-[#D6F1FE] px-2 py-3 min-h-[106px] flex flex-col items-center justify-center gap-2 text-center transition-colors"
            >
              <TileIcon kind="password" />
              <span className="text-[12.5px] sm:text-[13px] font-normal text-[#1E293B] leading-snug">
                Change
                <br />
                Password
              </span>
            </button>

            {/* 2. My Account */}
            <button
              type="button"
              onClick={() => setShowAccountModal(true)}
              className="rounded-[12px] bg-[#E9FBE9] hover:bg-[#DAF7DA] px-2 py-3 min-h-[106px] flex flex-col items-center justify-center gap-2 text-center transition-colors"
            >
              <TileIcon kind="account" />
              <span className="text-[12.5px] sm:text-[13px] font-normal text-[#1E293B] leading-snug">
                My
                <br />
                Account
              </span>
            </button>

            {/* 3. Biometric (click disabled, hover effect only) */}
            <div className="rounded-[12px] bg-[#FDF2F6] hover:bg-[#FBE6EE] px-2 py-3 min-h-[106px] flex flex-col items-center justify-center gap-2.5 text-center transition-colors cursor-default select-none">
              <div
                className={`relative h-[28px] w-[58px] rounded-full border-[1.5px] flex items-center px-1.5 transition-colors ${
                  profile.biometricEnabled
                    ? 'border-[#0066FF] bg-white justify-between'
                    : 'border-slate-400 bg-white justify-between flex-row-reverse'
                }`}
              >
                <span
                  className={`text-[11px] font-medium px-1 ${
                    profile.biometricEnabled ? 'text-[#0066FF]' : 'text-slate-600'
                  }`}
                >
                  {profile.biometricEnabled ? 'On' : 'Off'}
                </span>
                <span
                  className={`h-[20px] w-[20px] rounded-full shrink-0 ${
                    profile.biometricEnabled ? 'bg-[#0066FF]' : 'bg-slate-400'
                  }`}
                />
              </div>
              <span className="text-[12.5px] sm:text-[13px] font-normal text-[#1E293B] leading-snug">
                Biometric
              </span>
            </div>

            {/* 4. Transfer Ticket (click disabled, hover effect only) */}
            <div className="rounded-[12px] bg-[#EEF6FB] hover:bg-[#E1EFF8] px-2 py-3 min-h-[106px] flex flex-col items-center justify-center gap-2 text-center transition-colors cursor-default select-none">
              <TileIcon kind="transfer" />
              <span className="text-[12.5px] sm:text-[13px] font-normal text-[#1E293B] leading-snug">
                Transfer
                <br />
                Ticket
              </span>
            </div>

            {/* 5. My Transaction */}
            <button
              type="button"
              onClick={() => setShowPassbook(true)}
              className="rounded-[12px] bg-[#FDF2E6] hover:bg-[#FCE8D3] px-2 py-3 min-h-[106px] flex flex-col items-center justify-center gap-2 text-center transition-colors"
            >
              <TileIcon kind="transaction" />
              <span className="text-[12.5px] sm:text-[13px] font-normal text-[#1E293B] leading-snug">
                My
                <br />
                Transaction
              </span>
            </button>

            {/* 6. Link Your Aadhar */}
            <button
              type="button"
              onClick={() => setShowAadharModal(true)}
              className="rounded-[12px] bg-[#F7F8E8] hover:bg-[#EFF1D7] px-2 py-3 min-h-[106px] flex flex-col items-center justify-center gap-2 text-center transition-colors"
            >
              <TileIcon kind="aadhar" />
              <span className="text-[12.5px] sm:text-[13px] font-normal text-[#1E293B] leading-snug">
                Link Your
                <br />
                Aadhar
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. My Transactions Full-Screen View */}
      {showPassbook && (
        <MyTransactionsScreen
          transactions={walletTransactions}
          onClose={() => setShowPassbook(false)}
        />
      )}

      {/* Saved Passengers List Modal */}
      {showPaxListModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Saved Passengers List"
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900">
                Saved Passengers ({savedPassengers.length})
              </h2>
              <button
                type="button"
                onClick={() => setShowPaxListModal(false)}
                aria-label="Close saved passengers"
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="divide-y divide-slate-100 max-h-[50vh] overflow-y-auto">
              {savedPassengers.length === 0 ? (
                <p className="py-6 text-xs text-slate-500 text-center">
                  No saved passengers yet. Add co-passengers for 1-tap booking.
                </p>
              ) : (
                savedPassengers.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {p.age} Y, {p.gender}, {p.berthPref} | {p.mealPref}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPaxListModal(false);
                          handleOpenEditPax(p);
                        }}
                        aria-label={`Edit ${p.name}`}
                        className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-600"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePassenger(p.id)}
                        aria-label={`Delete ${p.name}`}
                        className="h-9 w-9 rounded-xl hover:bg-rose-50 flex items-center justify-center text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowPaxListModal(false);
                handleOpenNewPax();
              }}
              className="w-full min-h-[44px] rounded-xl bg-[#F9C661] text-[#111827] text-sm font-bold hover:bg-[#F3B742] inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add New Passenger
            </button>
          </div>
        </div>
      )}

      {/* 1. View Details Modal */}
      {showProfileDetails === 'view' && (
        <YourDetailsModal
          profile={profile}
          onClose={() => setShowProfileDetails(null)}
          onSwitchToEdit={() => setShowProfileDetails('edit')}
        />
      )}

      {/* 2. Edit Details Modal */}
      {showProfileDetails === 'edit' && (
        <EditDetailsModal
          profile={profile}
          onSave={(next) => {
            onUpdateProfile(next);
            setShowProfileDetails('view');
          }}
          onClose={() => setShowProfileDetails(null)}
        />
      )}

      {/* 4. My Account Bottom Sheet */}
      {showAccountModal && (
        <MyAccountSheet
          profile={profile}
          onUpdateProfile={onUpdateProfile}
          onClose={() => setShowAccountModal(false)}
        />
      )}

      {/* Add / Edit Saved Passenger Modal */}
      {showPaxModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Saved Passenger Form"
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSavePaxSubmit}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900">
                {showPaxModal === 'new' ? 'Add Saved Passenger' : 'Edit Passenger'}
              </h2>
              <button
                type="button"
                onClick={() => setShowPaxModal(null)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label htmlFor="sp-name" className="block text-xs font-medium text-slate-600 mb-1">
                Passenger Full Name
              </label>
              <input
                id="sp-name"
                type="text"
                required
                value={paxForm.name}
                onChange={(e) => setPaxForm({ ...paxForm, name: e.target.value })}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sp-age" className="block text-xs font-medium text-slate-600 mb-1">
                  Age
                </label>
                <input
                  id="sp-age"
                  type="number"
                  min={1}
                  max={120}
                  required
                  value={paxForm.age}
                  onChange={(e) => setPaxForm({ ...paxForm, age: Number(e.target.value) })}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="sp-gender" className="block text-xs font-medium text-slate-600 mb-1">
                  Gender
                </label>
                <select
                  id="sp-gender"
                  value={paxForm.gender}
                  onChange={(e) =>
                    setPaxForm({ ...paxForm, gender: e.target.value as 'M' | 'F' | 'T' })
                  }
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm bg-white"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="T">Transgender</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sp-berth" className="block text-xs font-medium text-slate-600 mb-1">
                  Berth Preference
                </label>
                <select
                  id="sp-berth"
                  value={paxForm.berthPref}
                  onChange={(e) =>
                    setPaxForm({
                      ...paxForm,
                      berthPref: e.target.value as SavedPassenger['berthPref'],
                    })
                  }
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm bg-white"
                >
                  <option value="LB">Lower Berth (LB)</option>
                  <option value="MB">Middle Berth (MB)</option>
                  <option value="UB">Upper Berth (UB)</option>
                  <option value="SL">Side Lower (SL)</option>
                  <option value="WS">Window Side (WS)</option>
                </select>
              </div>
              <div>
                <label htmlFor="sp-meal" className="block text-xs font-medium text-slate-600 mb-1">
                  Meal Preference
                </label>
                <select
                  id="sp-meal"
                  value={paxForm.mealPref}
                  onChange={(e) =>
                    setPaxForm({
                      ...paxForm,
                      mealPref: e.target.value as SavedPassenger['mealPref'],
                    })
                  }
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm bg-white"
                >
                  <option value="Veg">Veg</option>
                  <option value="Non-Veg">Non-Veg</option>
                  <option value="No Food">No Food</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-[#0066FF] text-white text-sm font-bold hover:bg-[#0052CC]"
            >
              Save Passenger
            </button>
          </form>
        </div>
      )}

      {/* 3. Change Password Bottom Sheet */}
      {showPasswordModal && (
        <ChangePasswordSheet onClose={() => setShowPasswordModal(false)} />
      )}

      {/* 6. Link Your Aadhar / Authenticate with Aadhaar Bottom Sheet */}
      {showAadharModal && (
        <AadhaarAuthSheet
          profile={profile}
          onUpdateProfile={onUpdateProfile}
          onClose={() => setShowAadharModal(false)}
        />
      )}
    </div>
  );
}
