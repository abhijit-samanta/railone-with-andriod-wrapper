import { useEffect, useRef, useState } from 'react';
import { Cloud, LogOut, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  formatFirebaseAuthError,
  getFirestoreConnectionStatus,
  subscribeFirestoreStatus,
  testConnection,
  type FirestoreConnectionStatus,
} from '../lib/firebase';

interface MpinLoginScreenProps {
  userName: string;
  hasRegisteredMpin: boolean;
  requiresUserSetup?: boolean;
  firebaseUser?: User | null;
  onGoogleSignIn?: () => Promise<void>;
  onGoogleSignOut?: () => Promise<void>;
  onSubmitMpin: (
    mpin: string
  ) => Promise<{ ok: boolean; error: string | null }> | { ok: boolean; error: string | null };
  onSwitchUser: (name: string, mobile: string) => { ok: boolean; error: string | null };
  onUseExistingMpin?: () => void;
  onOpenAdminPanel?: () => void;
}

function FaceIdIcon() {
  return (
    <svg viewBox="0 0 36 36" className="h-9 w-9" fill="none" aria-hidden="true">
      {/* 4 corner brackets */}
      <path
        d="M5.5 11.5V8.5a3 3 0 0 1 3-3h3M24.5 5.5h3a3 3 0 0 1 3 3v3M30.5 24.5v3a3 3 0 0 1-3 3h-3M11.5 30.5h-3a3 3 0 0 1-3-3v-3"
        stroke="#4B5563"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Eyes */}
      <path d="M13 13.5v2.5M23 13.5v2.5" stroke="#4B5563" strokeWidth="2.1" strokeLinecap="round" />
      {/* Nose */}
      <path d="M18 14v4.5c0 .7-.4 1.1-1.1 1.1" stroke="#4B5563" strokeWidth="1.9" strokeLinecap="round" />
      {/* Smile */}
      <path d="M14 22.8c1.1 1.2 2.4 1.7 4 1.7s2.9-.5 4-1.7" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FingerprintIcon() {
  return (
    <svg viewBox="0 0 36 36" className="h-9 w-9" fill="none" aria-hidden="true">
      <path
        d="M18 6.5c5.8 0 10.5 4.3 10.5 10.5 0 2.2-.3 4.2-.8 6"
        stroke="#4B5563"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M9.8 10.6C11.9 8.1 14.8 6.5 18 6.5M7.5 17c0-1.6.3-3.1.8-4.4"
        stroke="#4B5563"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M11 17c0-3.9 3.1-7 7-7s7 3.1 7 7c0 3.7-.6 6.8-1.8 9.7"
        stroke="#4B5563"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M14.5 17c0-1.9 1.6-3.5 3.5-3.5s3.5 1.6 3.5 3.5c0 4.2-.8 8-2.4 11.4"
        stroke="#4B5563"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M18 17c0 3.7-.7 7.1-2 10.3M11.2 21.5c-.2 1.8-.8 3.6-1.7 5.2M14.5 21.2c-.3 2.5-1 5-2.1 7.3"
        stroke="#4B5563"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MpinLoginScreen({
  userName,
  hasRegisteredMpin,
  requiresUserSetup = false,
  firebaseUser = null,
  onGoogleSignIn,
  onGoogleSignOut,
  onSubmitMpin,
  onSwitchUser,
  onUseExistingMpin,
  onOpenAdminPanel,
}: MpinLoginScreenProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [signingInGoogle, setSigningInGoogle] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'info'; message: string } | null>(
    null
  );
  const [showDifferentUserModal, setShowDifferentUserModal] = useState(false);
  const [switchName, setSwitchName] = useState('');
  const [switchMobile, setSwitchMobile] = useState('');
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [firestoreStatus, setFirestoreStatus] = useState<FirestoreConnectionStatus>(
    () => getFirestoreConnectionStatus()
  );
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const unsub = subscribeFirestoreStatus(setFirestoreStatus);
    return () => unsub();
  }, []);

  const isUserSetupModalOpen = requiresUserSetup || showDifferentUserModal;
  const displayName = userName.trim();

  const handleConnectGoogle = async () => {
    if (!onGoogleSignIn || signingInGoogle) return;
    setSigningInGoogle(true);
    setSwitchError(null);
    setFeedback(null);
    try {
      await testConnection();
      await onGoogleSignIn();
    } catch (err) {
      const msg = formatFirebaseAuthError(err);
      setFeedback({ kind: 'error', message: msg });
      setSwitchError(msg);
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const clean = rawValue.replace(/[^A-Za-z0-9]/g, '');
    if (!clean) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    setFeedback(null);
    if (clean.length > 1) {
      // Handle paste / multi-character input across boxes
      const next = [...digits];
      for (let i = 0; i < clean.length && index + i < 6; i += 1) {
        next[index + i] = clean[i];
      }
      setDigits(next);
      const focusIdx = Math.min(5, index + clean.length);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    setFeedback(null);
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i += 1) {
      next[i] = pasted[i];
    }
    setDigits(next);
    inputRefs.current[Math.min(5, pasted.length - 1)]?.focus();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || requiresUserSetup) return;
    const entered = digits.join('');
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await onSubmitMpin(entered);
      if (!result.ok && result.error) {
        setFeedback({ kind: 'error', message: result.error });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onSwitchUser(switchName, switchMobile);
    if (!res.ok) {
      setSwitchError(res.error);
      return;
    }
    setSwitchError(null);
    setSwitchName('');
    setSwitchMobile('');
    setDigits(['', '', '', '', '', '']);
    setFeedback(null);
    setShowDifferentUserModal(false);
    window.setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 50);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7FCFF] text-[#1F2937]">
      {/* Upper Pale Sky-Blue Section matching reference screenshot */}
      <div className="bg-[#EAF7FE] px-6 pt-9 pb-7 shrink-0">
        <div className="w-full max-w-[360px] mx-auto text-center">
          {/* Centered RailOne Wordmark */}
          <h1 className="font-display text-[29px] tracking-tight text-[#374151] mb-10 select-none">
            <span className="font-normal">Rail</span>
            <span className="font-bold text-[#22262E]">One</span>
          </h1>

          <h2 className="font-display text-[22px] font-bold text-[#22262E] tracking-tight">
            Login using mPIN
          </h2>

          <p className="mt-4 text-[15.5px] font-normal text-[#2D3748]">
            {displayName
              ? `Welcome ${displayName}!`
              : requiresUserSetup
                ? 'Enter your name and mobile number'
                : 'Returning User · Login with your registered mPIN'}
          </p>

          {onGoogleSignIn && (
            <div className="mt-3 flex flex-col items-center gap-1.5">
              {firebaseUser ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-white/85 border border-[#BBD8FB] px-3 py-1 text-[11.5px] font-medium text-[#0E1E5B]">
                  <Cloud className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="truncate max-w-[190px]">Firebase: {firebaseUser.email}</span>
                  {onGoogleSignOut && (
                    <button
                      type="button"
                      onClick={() => void onGoogleSignOut()}
                      aria-label="Sign out Google Cloud Sync"
                      className="text-slate-500 hover:text-rose-600 transition-colors"
                    >
                      <LogOut className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleConnectGoogle()}
                  disabled={signingInGoogle}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white hover:bg-slate-50 border border-[#A5D3EC] px-3.5 py-1.5 text-[12px] font-semibold text-[#0E1E5B] shadow-2xs transition-colors"
                >
                  <Cloud className="h-3.5 w-3.5 text-[#0B63E5]" />
                  {signingInGoogle ? 'Connecting Firebase...' : 'Connect Firebase (Google Sign-In)'}
                </button>
              )}
              <span className="text-[11px] font-medium text-slate-500">
                {firestoreStatus === 'connected'
                  ? 'Firebase Firestore: Connected'
                  : firestoreStatus === 'checking'
                    ? 'Firebase Firestore: Checking...'
                    : 'Firebase Firestore: Offline'}
              </span>
            </div>
          )}

          <p className="mt-5 mb-3.5 text-[14.5px] font-normal text-[#2D3748]">
            {hasRegisteredMpin
              ? 'Enter mPIN below'
              : !requiresUserSetup && !displayName
                ? 'Enter your existing 6-character mPIN'
                : 'Enter Admin-issued 6-character mPIN'}
          </p>

          <form id="mpin-login-form" onSubmit={handleLoginSubmit}>
            <div
              role="group"
              aria-label="6-character mPIN"
              className="grid grid-cols-6 gap-2.5 max-w-[340px] mx-auto"
            >
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="one-time-code"
                  maxLength={1}
                  disabled={requiresUserSetup}
                  aria-label={`mPIN digit ${idx + 1}`}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  className="h-[50px] w-full rounded-[13px] bg-white border border-[#A5D3EC] focus:border-[#0B63E5] focus:ring-2 focus:ring-[#0B63E5]/15 text-center font-mono-num text-[20px] font-bold text-[#0E1E5B] focus:outline-none transition-all disabled:opacity-50"
                />
              ))}
            </div>
          </form>

          <div className="max-w-[340px] mx-auto flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() =>
                setFeedback({
                  kind: 'info',
                  message: hasRegisteredMpin
                    ? 'Enter your registered 6-character mPIN or use Different User? below.'
                    : 'Enter your Admin-issued mPIN (digits + upper/lowercase letters) once to activate lifetime login.',
                })
              }
              className="text-[14px] font-bold text-[#0E1E5B] hover:text-[#0B63E5] transition-colors"
            >
              Forgot Password?
            </button>
            <button
              type="button"
              onClick={() =>
                setFeedback({
                  kind: 'info',
                  message: hasRegisteredMpin
                    ? 'One user, one mPIN is active for lifetime login.'
                    : 'Enter your Admin-issued 6-character mPIN above and press Login.',
                })
              }
              className="text-[14px] font-bold text-[#0E1E5B] hover:text-[#0B63E5] transition-colors"
            >
              Reset mPIN?
            </button>
          </div>
        </div>
      </div>

      {/* Lower Soft Ice-White Section */}
      <div className="flex-1 bg-[#F7FCFF] px-6 pt-12 pb-10 flex flex-col items-center">
        <div className="w-full max-w-[340px] flex flex-col items-center">
          {/* Dashed Divider */}
          <div className="w-full flex items-center gap-3">
            <span className="flex-1 border-t border-dashed border-[#CBD5E1]" />
            <span className="text-[14px] font-normal text-[#94A3B8] shrink-0">
              Or login using biometric
            </span>
            <span className="flex-1 border-t border-dashed border-[#CBD5E1]" />
          </div>

          {!hasRegisteredMpin && (
            <p className="mt-3 text-[12px] text-[#0F4C81] text-center">
              One-time setup · One user, one mPIN · Lifetime login
            </p>
          )}

          {feedback && (
            <p
              role="alert"
              className={`mt-4 w-full rounded-xl px-3.5 py-2.5 text-xs font-medium text-center border ${
                feedback.kind === 'error'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-[#EAF4FF] text-[#0E1E5B] border-[#BBD8FB]'
              }`}
            >
              {feedback.message}
            </p>
          )}

          {/* Deactivated Biometric Icons (no onClick) + Login Pill Button Row */}
          <div className="w-full mt-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled
                aria-disabled="true"
                tabIndex={-1}
                aria-label="Face ID login deactivated"
                className="p-1.5 rounded-xl opacity-40 cursor-not-allowed pointer-events-none select-none"
              >
                <FaceIdIcon />
              </button>
              <button
                type="button"
                disabled
                aria-disabled="true"
                tabIndex={-1}
                aria-label="Fingerprint login deactivated"
                className="p-1.5 rounded-xl opacity-40 cursor-not-allowed pointer-events-none select-none"
              >
                <FingerprintIcon />
              </button>
            </div>

            <button
              type="submit"
              form="mpin-login-form"
              disabled={submitting || requiresUserSetup}
              className="min-w-[136px] min-h-[46px] px-8 rounded-full bg-[#EAF4FE] hover:bg-[#DCEBFF] disabled:opacity-60 border border-[#84B8F6] text-[#0B63E5] text-[15.5px] font-semibold transition-colors"
            >
              {submitting ? 'Verifying...' : 'Login'}
            </button>
          </div>

          {/* Different User? & Admin Panel Links */}
          <div className="mt-14 flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={() => {
                setSwitchError(null);
                setShowDifferentUserModal(true);
              }}
              className="text-[16px] font-bold text-[#0E1E5B] hover:text-[#0B63E5] transition-colors"
            >
              Different User?
            </button>
            {onOpenAdminPanel && (
              <>
                <span className="text-[#CBD5E1]" aria-hidden="true">|</span>
                <button
                  type="button"
                  onClick={onOpenAdminPanel}
                  className="text-[15px] font-semibold text-[#0B63E5] hover:text-[#0E1E5B] transition-colors"
                >
                  Admin Panel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Different User Switch / Fresh Install New User Registration Dialog */}
      {isUserSetupModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Different User Registration"
          onClick={() => {
            if (!requiresUserSetup) setShowDifferentUserModal(false);
          }}
          className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <form
            onSubmit={handleSwitchSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-[28px] sm:rounded-[24px] bg-white p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0B63E5]">
                  Different User
                </p>
                <h3 className="font-display text-lg font-bold text-[#111842]">
                  {requiresUserSetup ? 'New User Setup' : 'Switch / New User'}
                </h3>
              </div>
              {!requiresUserSetup && (
                <button
                  type="button"
                  onClick={() => setShowDifferentUserModal(false)}
                  aria-label="Close switch user"
                  className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <p className="text-xs text-slate-600">
              Enter your full name and 10-digit mobile number. New users start with a clean profile, ₹5001.00 R-Wallet balance, and no previous user history.
            </p>

            {onGoogleSignIn && (
              <div className="rounded-xl border border-[#D4E6FA] bg-[#F4F9FF] px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#0E1E5B]">
                    {firebaseUser
                      ? 'Firebase Connected'
                      : firestoreStatus === 'connected'
                        ? 'Firebase Firestore Ready'
                        : 'Connect Firebase'}
                  </p>
                  <p className="text-[11px] text-slate-600 truncate">
                    {firebaseUser
                      ? firebaseUser.email
                      : 'Sign in with Google to save MPIN & bookings in Firestore'}
                  </p>
                </div>
                {!firebaseUser ? (
                  <button
                    type="button"
                    onClick={() => void handleConnectGoogle()}
                    disabled={signingInGoogle}
                    className="shrink-0 min-h-[34px] px-3 rounded-lg bg-white border border-[#84B8F6] text-[11.5px] font-semibold text-[#0B63E5] hover:bg-[#EAF4FE]"
                  >
                    {signingInGoogle ? 'Connecting...' : 'Connect Firebase'}
                  </button>
                ) : (
                  <span className="shrink-0 text-[11px] font-semibold text-emerald-700">Synced</span>
                )}
              </div>
            )}

            <div className="space-y-3">
              <input
                type="text"
                value={switchName}
                onChange={(e) => setSwitchName(e.target.value)}
                placeholder="Full Name*"
                aria-label="Full Name"
                autoFocus
                className="w-full min-h-[46px] rounded-xl border border-[#C7D7EA] px-3.5 text-sm text-[#1F2937] focus:outline-none focus:border-[#0066FF]"
              />
              <input
                type="tel"
                maxLength={10}
                value={switchMobile}
                onChange={(e) => setSwitchMobile(e.target.value.replace(/\D/g, ''))}
                placeholder="10-Digit Mobile Number*"
                aria-label="10-Digit Mobile Number"
                className="w-full min-h-[46px] rounded-xl border border-[#C7D7EA] px-3.5 font-mono-num text-sm text-[#1F2937] focus:outline-none focus:border-[#0066FF]"
              />
            </div>

            {switchError && (
              <p role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 rounded-xl px-3 py-2">
                {switchError}
              </p>
            )}

            <button
              type="submit"
              className="w-full min-h-[46px] rounded-full bg-[#0066FF] hover:bg-[#0052CC] text-white text-sm font-semibold transition-colors"
            >
              Continue to mPIN Login
            </button>

            {onUseExistingMpin && (
              <button
                type="button"
                onClick={() => {
                  setSwitchError(null);
                  setShowDifferentUserModal(false);
                  setFeedback(null);
                  onUseExistingMpin();
                  window.setTimeout(() => {
                    inputRefs.current[0]?.focus();
                  }, 50);
                }}
                className="w-full min-h-[40px] rounded-full bg-[#EAF4FE] hover:bg-[#DCEBFF] border border-[#BBD8FB] text-[#0E1E5B] text-xs font-semibold transition-colors"
              >
                Already registered? Login with existing mPIN
              </button>
            )}

            {onOpenAdminPanel && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={onOpenAdminPanel}
                  className="text-xs font-semibold text-[#0B63E5] hover:text-[#0E1E5B] transition-colors"
                >
                  Admin Panel
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
