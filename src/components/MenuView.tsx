import { useState } from 'react';
import { Cloud, LogOut } from 'lucide-react';
import type { User } from 'firebase/auth';
import { FREIGHT_ZONE_DATA, MONTHLY_TONNAGE_DATA } from '../data/railData';
import { formatFirebaseAuthError, type FirestoreConnectionStatus } from '../lib/firebase';
import type { ActiveScreen, LanguageCode, UserProfile } from '../types/rail';

interface MenuViewProps {
  profile: UserProfile;
  language: LanguageCode;
  firebaseUser?: User | null;
  firestoreStatus?: FirestoreConnectionStatus;
  onConnectFirebase?: () => Promise<void>;
  onDisconnectFirebase?: () => Promise<void>;
  onChangeLanguage: (lang: LanguageCode) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onOpenAuthModal: () => void;
  onLogout?: () => void;
  onOpenAdminPanel?: () => void;
  onAddWalletMoney?: (amount: number) => void;
  onClose?: () => void;
  showPerformanceOnly?: boolean;
  onBackFromPerf?: () => void;
}

function MenuAvatarSilhouette() {
  return (
    <div className="h-[92px] w-[92px] rounded-full bg-[#47ADEB] flex items-center justify-center shadow-2xs mx-auto">
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" aria-hidden="true">
        <circle cx="32" cy="22" r="8.5" fill="#C4E8FC" />
        <ellipse cx="32" cy="41" rx="16.5" ry="9.5" fill="#C4E8FC" />
      </svg>
    </div>
  );
}

function LavenderWalletIcon() {
  return (
    <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0" fill="none" aria-hidden="true">
      <rect x="4" y="7" width="28" height="22" rx="5.5" fill="#8080D7" />
      <rect x="19" y="13.5" width="13.5" height="9" rx="4.5" fill="#FFFFFF" />
      <circle cx="24" cy="18" r="2.2" fill="#8080D7" />
      <rect x="8.5" y="11" width="7" height="2.2" rx="1.1" fill="#C4C4F0" />
    </svg>
  );
}

function DrawerRowIcon({
  kind,
}: {
  kind:
    | 'services'
    | 'faqs'
    | 'support'
    | 'counter'
    | 'about'
    | 'rate'
    | 'share'
    | 'logout';
}) {
  const color = '#7D80DE';
  switch (kind) {
    case 'services':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
          <path
            d="M5 4.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-2.5-1.6-2.5 1.6-2-1.6-2 1.6-2.5-1.6L5 20.5v-16Z"
            fill={color}
          />
          <path d="M9 11h6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'faqs':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
          <path
            d="M4 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H9l-3.5 3V14H6a2 2 0 0 1-2-2V5.5Z"
            fill={color}
          />
          <path
            d="M18.5 8.5h.5a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2h-.5v2.8l-3.2-2.8H11a2 2 0 0 1-1.9-1.4"
            fill="#9A9CE6"
          />
        </svg>
      );
    case 'support':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
          <path
            d="M5 13a7 7 0 0 1 14 0"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect x="3.5" y="12" width="3" height="5" rx="1.5" fill={color} />
          <rect x="17.5" y="12" width="3" height="5" rx="1.5" fill={color} />
          <circle cx="12" cy="12" r="2.2" fill={color} />
          <path
            d="M8.5 19c1-1.6 6-1.6 7 0"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'counter':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
          <rect x="3.5" y="5.5" width="17" height="13" rx="3" fill={color} />
          <path
            d="m12 8.2 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.2-2.4 1.2.5-2.6-1.9-1.8 2.6-.4L12 8.2Z"
            fill="#FFFFFF"
          />
        </svg>
      );
    case 'about':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill={color} />
          <circle cx="12" cy="8.2" r="1.2" fill="#FFFFFF" />
          <path d="M12 11.2v5.2" stroke="#FFFFFF" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
      );
    case 'rate':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
          <rect x="3.5" y="10.5" width="3.5" height="9" rx="1.2" fill={color} />
          <path
            d="M9 10.5 12.2 4.8a1.5 1.5 0 0 1 2.7.9V10h4.2a1.8 1.8 0 0 1 1.7 2.2l-1.4 5.8a1.8 1.8 0 0 1-1.7 1.4H9v-8.9Z"
            fill={color}
          />
        </svg>
      );
    case 'share':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
          <path
            d="M16.5 6.5 7.5 12l9 5.5"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="17" cy="6" r="2.7" fill={color} />
          <circle cx="7" cy="12" r="2.7" fill={color} />
          <circle cx="17" cy="18" r="2.7" fill={color} />
        </svg>
      );
    case 'logout':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
          <circle cx="10.5" cy="12" r="7.5" fill="#9B9DE6" />
          <path
            d="M10.5 12h8.5m0 0-2.7-2.7m2.7 2.7-2.7 2.7"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10.5 12h5"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

export function MenuView({
  profile,
  firebaseUser = null,
  firestoreStatus = 'connected',
  onConnectFirebase,
  onDisconnectFirebase,
  onLogout,
  onOpenAdminPanel,
  onClose,
  showPerformanceOnly = false,
  onBackFromPerf,
}: MenuViewProps) {
  const [connectingFirebase, setConnectingFirebase] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  const handleConnectClick = async () => {
    if (!onConnectFirebase || connectingFirebase) return;
    setConnectingFirebase(true);
    setFirebaseError(null);
    try {
      await onConnectFirebase();
    } catch (err) {
      setFirebaseError(formatFirebaseAuthError(err));
    } finally {
      setConnectingFirebase(false);
    }
  };

  if (showPerformanceOnly) {
    return (
      <div className="max-w-4xl mx-auto space-y-5 pb-8">
        <div className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-xs">
          <div className="bg-[#0B63E5] text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBackFromPerf && (
                <button
                  type="button"
                  onClick={onBackFromPerf}
                  className="px-3 py-1.5 rounded-xl bg-white/15 text-xs font-semibold hover:bg-white/25"
                >
                  ← Back
                </button>
              )}
              <h1 className="font-display text-lg font-bold">Performance Dashboard</h1>
            </div>
            <span className="text-xs text-blue-100">CRIS Freight &amp; Ops</span>
          </div>

          <div className="p-5 space-y-6">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 mb-3">
                Live Statistics
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-[#EEF2FF] p-3.5">
                  <p className="text-[11px] font-medium text-slate-600">Rakes on Run</p>
                  <p className="font-mono-num text-xl font-bold text-slate-900 mt-1">6610</p>
                  <p className="font-mono-num text-[11px] text-slate-500 mt-0.5">
                    L: 3958 / E: 2652
                  </p>
                </div>
                <div className="rounded-2xl bg-[#FFF3EB] p-3.5">
                  <p className="text-[11px] font-medium text-slate-600">Under Loading</p>
                  <p className="font-mono-num text-xl font-bold text-slate-900 mt-1">276</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">All Zones</p>
                </div>
                <div className="rounded-2xl bg-[#E8F8EE] p-3.5">
                  <p className="text-[11px] font-medium text-slate-600">Under Unloading</p>
                  <p className="font-mono-num text-xl font-bold text-slate-900 mt-1">501</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Active Terminals</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="font-display text-sm font-bold text-slate-900 text-center mb-4">
                Under Loading by Railway Zone
              </h3>
              <div className="flex items-end justify-between gap-1 sm:gap-2 h-44 pt-4 border-b border-slate-200 px-1">
                {FREIGHT_ZONE_DATA.map((d) => {
                  const heightPct = Math.max(8, Math.round((d.val / 45) * 100));
                  return (
                    <div
                      key={d.zone}
                      className="flex-1 flex flex-col items-center justify-end h-full group"
                    >
                      <span className="font-mono-num text-[9px] text-slate-600 mb-1">
                        {d.val}
                      </span>
                      <div
                        className="w-full max-w-[18px] rounded-t-sm bg-[#2E7D32] group-hover:bg-[#1B5E20] transition-colors"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-1 sm:gap-2 px-1 pt-1.5">
                {FREIGHT_ZONE_DATA.map((d) => (
                  <span
                    key={d.zone}
                    className="flex-1 text-center text-[9px] font-semibold text-slate-500 truncate"
                  >
                    {d.zone}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <h3 className="font-display text-sm font-bold text-slate-900">Today&apos;s</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 p-3.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Consignments Booked</span>
                  <span className="font-mono-num text-base font-bold text-slate-900">144</span>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Loading (in MT)</span>
                  <span className="font-mono-num text-base font-bold text-slate-900">0</span>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Freight (₹ Cr)</span>
                  <span className="font-mono-num text-base font-bold text-slate-900">24</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="font-display text-sm font-bold text-slate-900 text-center mb-4">
                Monthly Loading (Tonnage in MT - 12 Months)
              </h3>
              <div className="flex items-end justify-between gap-1.5 sm:gap-2.5 h-36 pt-4 border-b border-slate-200 px-1">
                {MONTHLY_TONNAGE_DATA.map((m) => {
                  const heightPct = Math.max(15, Math.round(((m.val - 90) / 80) * 100));
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full">
                      <span className="font-mono-num text-[9px] text-slate-600 mb-1">
                        {m.val}
                      </span>
                      <div
                        className="w-full max-w-[24px] rounded-t-sm bg-[#0284C7]"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 px-1 pt-1.5">
                {MONTHLY_TONNAGE_DATA.map((m) => (
                  <span
                    key={m.month}
                    className="flex-1 text-center text-[10px] font-medium text-slate-500"
                  >
                    {m.month}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const menuItems: Array<{
    kind:
      | 'services'
      | 'faqs'
      | 'support'
      | 'counter'
      | 'about'
      | 'rate'
      | 'share';
    label: string;
  }> = [
    { kind: 'services', label: 'Show/Hide Services' },
    { kind: 'faqs', label: 'FAQs' },
    { kind: 'support', label: 'Help & Support' },
    { kind: 'counter', label: 'Reserved Services - Counter' },
    { kind: 'about', label: 'About' },
    { kind: 'rate', label: 'Rate Us' },
    { kind: 'share', label: 'Share' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="RailOne Menu Drawer"
      className="fixed inset-0 z-50 flex justify-end bg-black/45"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      {/* Right-aligned Drawer matching Image 2 */}
      <aside className="w-[80%] max-w-[360px] h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Top Lavender-Tinted Header */}
        <div className="bg-[#EFF0F9] rounded-b-[20px] px-5 pt-7 pb-12 shrink-0">
          <MenuAvatarSilhouette />
          <h2 className="mt-5 font-display text-[18px] font-bold text-[#111827] leading-snug break-words">
            {profile.name}
          </h2>
        </div>

        {/* Overlapping White R-Wallet Card */}
        <div className="-mt-8 mx-4 rounded-[20px] bg-white px-4 py-3.5 shadow-[0_4px_16px_rgba(15,23,42,0.08)] flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <LavenderWalletIcon />
            <div className="min-w-0">
              <p className="text-[12.5px] font-normal text-[#4B5563] leading-tight">R-Wallet</p>
              <p className="font-display tabular-nums text-[17px] font-bold text-[#111827] mt-0.5 leading-tight truncate">
                ₹ {profile.rWalletBalance.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="rounded-full bg-[#0066FF] hover:bg-[#0052CC] text-white px-4 py-2.5 text-[13.5px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-default select-none">
            Add Money
          </div>
        </div>

        {/* Menu List (text items are hover-only with click events disabled) */}
        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-3 flex flex-col">
          <div className="space-y-3">
            {menuItems.map((item) => (
              <div
                key={item.label}
                className="w-full flex items-center gap-4 text-left text-[15.5px] font-normal text-[#1E293B] hover:text-[#0066FF] hover:bg-[#F5F7FF] rounded-xl px-2.5 -mx-2.5 py-1.5 transition-colors cursor-default select-none"
              >
                <DrawerRowIcon kind={item.kind} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 my-5" />

          {onConnectFirebase && (
            <div className="mb-3 rounded-xl border border-[#D4E6FA] bg-[#F4F9FF] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0E1E5B]">
                  <Cloud className="h-3.5 w-3.5 text-[#0B63E5]" />
                  <span>Firebase Firestore</span>
                </div>
                <span
                  className={`text-[10.5px] font-semibold ${
                    firebaseUser
                      ? 'text-emerald-700'
                      : firestoreStatus === 'offline'
                        ? 'text-rose-700'
                        : 'text-[#0B63E5]'
                  }`}
                >
                  {firebaseUser
                    ? 'Synced'
                    : firestoreStatus === 'connected'
                      ? 'Ready'
                      : firestoreStatus === 'checking'
                        ? 'Checking...'
                        : 'Offline'}
                </span>
              </div>
              {firebaseUser ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-600 truncate">{firebaseUser.email}</span>
                  {onDisconnectFirebase && (
                    <button
                      type="button"
                      onClick={() => void onDisconnectFirebase()}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-rose-600 shrink-0"
                    >
                      <LogOut className="h-3 w-3" />
                      Disconnect
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleConnectClick()}
                  disabled={connectingFirebase}
                  className="w-full min-h-[34px] rounded-lg bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                >
                  {connectingFirebase ? 'Connecting...' : 'Connect Firebase (Google)'}
                </button>
              )}
              {firebaseError && (
                <p role="alert" className="text-[11px] font-medium text-rose-700 leading-snug">
                  {firebaseError}
                </p>
              )}
            </div>
          )}

          {onOpenAdminPanel && (
            <button
              type="button"
              onClick={() => {
                onClose?.();
                onOpenAdminPanel();
              }}
              className="w-full flex items-center gap-4 text-left text-[15.5px] font-medium text-[#0B63E5] hover:bg-[#F5F7FF] rounded-xl px-2.5 -mx-2.5 py-2 mb-1 transition-colors cursor-pointer select-none"
            >
              <DrawerRowIcon kind="services" />
              <span>Admin Panel</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onLogout?.()}
            className="w-full flex items-center gap-4 text-left text-[15.5px] font-normal text-[#1E293B] hover:text-[#0066FF] hover:bg-[#F5F7FF] rounded-xl px-2.5 -mx-2.5 py-1.5 transition-colors cursor-pointer select-none"
          >
            <DrawerRowIcon kind="logout" />
            <span>Log Out</span>
          </button>
        </div>

        {/* Version Footer */}
        <div className="py-4 text-center text-[13.5px] font-normal text-[#8E939C] shrink-0">
          V-2.1.81-255
        </div>
      </aside>
    </div>
  );
}
