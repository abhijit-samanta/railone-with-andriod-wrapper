import { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  TrainFront,
  User,
  X,
} from 'lucide-react';
import { RailOneLogo } from './RailOneLogo';

interface AuthSSOModalProps {
  currentName: string;
  onLoginSuccess: (
    name: string,
    isGuest: boolean,
    meta?: { isNewRegistration?: boolean; mobile?: string }
  ) => void;
  onClose: () => void;
}

const CAPTCHA_TOKENS = ['7B', 'HL', 'R4', 'K9'];

export function AuthSSOModal({
  currentName,
  onLoginSuccess,
  onClose,
}: AuthSSOModalProps) {
  const [step, setStep] = useState<'welcome' | 'login'>('welcome');
  const [loginMethod, setLoginMethod] = useState<'MPIN' | 'Password'>('Password');
  const [userId, setUserId] = useState('kailash_rail');
  const [secret, setSecret] = useState('••••••••');
  const [showSecret, setShowSecret] = useState(false);
  const [mobileInput, setMobileInput] = useState('');
  const [captchaIndex, setCaptchaIndex] = useState(0);
  const [sliderVal, setSliderVal] = useState(12);
  const [error, setError] = useState<string | null>(null);

  const activeToken = CAPTCHA_TOKENS[captchaIndex];
  const isMatched = sliderVal >= 88;

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      setError('Enter your User ID or Mobile Number.');
      return;
    }
    if (!isMatched) {
      setError('Slide the captcha token all the way to the right to Sign In.');
      return;
    }
    setError(null);
    onLoginSuccess(
      userId.includes('kailash') ? 'Kailash Kumar' : userId.trim(),
      false
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="RailOne Single Sign-On"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-gradient-to-b from-[#EAF4FF] to-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl overflow-hidden relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Sign In"
          className="absolute right-4 top-4 h-9 w-9 rounded-xl bg-white/80 hover:bg-white flex items-center justify-center text-slate-700 z-10"
        >
          <X className="h-4 w-4" />
        </button>

        {step === 'welcome' ? (
          /* Exact Screenshot 1 & 9 Welcome / Registration Screen */
          <div className="p-6 sm:p-7 space-y-5 text-center">
            <div className="flex justify-center pt-2">
              <RailOneLogo />
            </div>

            <button
              type="button"
              onClick={() => setStep('login')}
              className="w-full min-h-[48px] rounded-2xl bg-white border border-slate-200 px-4 flex items-center justify-center gap-2 text-sm font-semibold text-slate-800 hover:border-[#0B63E5] shadow-xs transition-colors"
            >
              <span>Registered user</span>
              <span className="text-[#0B63E5] font-bold inline-flex items-center gap-1">
                Login Here <ArrowRight className="h-4 w-4" />
              </span>
            </button>

            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 space-y-4 shadow-xs">
              <p className="font-display text-sm font-bold text-slate-800">
                New User Registration
              </p>

              <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-1.5 bg-[#F8FBFF]">
                <input
                  type="tel"
                  maxLength={10}
                  value={mobileInput}
                  onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Mobile Number"
                  aria-label="Mobile Number for registration"
                  className="flex-1 bg-transparent px-2.5 text-sm focus:outline-none font-mono-num"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (mobileInput.length >= 10) {
                      onLoginSuccess(`Traveller (${mobileInput.slice(-4)})`, false, {
                        isNewRegistration: true,
                        mobile: mobileInput,
                      });
                    } else {
                      setStep('login');
                    }
                  }}
                  className="min-h-[36px] px-4 rounded-lg bg-slate-200 hover:bg-[#0B63E5] hover:text-white text-xs font-bold text-slate-700 transition-colors"
                >
                  Register
                </button>
              </div>

              <div className="space-y-2.5">
                <p className="text-xs text-slate-500">Or Register with</p>
                <div className="flex items-center justify-center gap-6">
                  <button
                    type="button"
                    onClick={() => setStep('login')}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <span className="h-11 w-11 rounded-full bg-[#EEF2FF] border border-indigo-200 flex items-center justify-center text-[#0B63E5] group-hover:scale-105 transition-transform">
                      <TrainFront className="h-5 w-5" />
                    </span>
                    <span className="text-[11px] font-medium text-slate-600">Rail Connect</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('login')}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <span className="h-11 w-11 rounded-full bg-[#FFF7ED] border border-amber-200 flex items-center justify-center text-amber-700 font-display text-xs font-bold group-hover:scale-105 transition-transform">
                      UTS
                    </span>
                    <span className="text-[11px] font-medium text-slate-600">UTS</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onLoginSuccess('Guest User', true)}
              className="text-sm font-semibold text-slate-700 hover:text-[#0B63E5]"
            >
              Login as <span className="text-[#0B63E5]">Guest</span>
            </button>

            <div className="rounded-2xl bg-[#DBEAFE] p-3.5 text-left flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-xs font-bold text-slate-900">
                  Get Support, Share Feedback through RAIL MADAD
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Single Sign-On across all Indian Railways services
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#0B63E5] shrink-0">
                Current: {currentName.split(' ')[0]}
              </span>
            </div>
          </div>
        ) : (
          /* Exact Screenshot 2 & 10 Login Screen with MPIN / Password + Slide & Match Captcha */
          <form onSubmit={handleSignIn} className="p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('welcome')}
                className="text-xs font-semibold text-[#0B63E5] hover:underline"
              >
                ← Back
              </button>
              <RailOneLogo compact />
              <span className="w-10" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-bold text-slate-800">Login with</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {(['MPIN', 'Password'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setLoginMethod(m)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                      loginMethod === m ? 'bg-[#0B63E5] text-white' : 'text-slate-600'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-full bg-white border border-slate-200 px-4 min-h-[46px]">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="User ID / Mobile Number"
                  aria-label="User ID or Mobile Number"
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 rounded-full bg-white border border-slate-200 px-4 min-h-[46px]">
                <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={loginMethod === 'MPIN' ? '4-Digit MPIN' : 'Password'}
                  aria-label={loginMethod}
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((s) => !s)}
                  aria-label="Toggle visibility"
                  className="text-slate-400 hover:text-slate-700"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Slide & Match to Sign In Captcha */}
            <div className="pt-2 space-y-2.5 text-center">
              <p className="text-xs font-semibold text-slate-700">
                Slide &amp; Match to <span className="text-[#0B63E5]">Sign In</span>
              </p>

              <div className="relative h-14 rounded-full bg-white border border-slate-200 px-3 flex items-center justify-between overflow-hidden">
                <div
                  className="h-10 w-10 rounded-full bg-slate-100 border-2 border-[#0B63E5] flex items-center justify-center font-mono-num text-xs font-bold text-slate-900 shrink-0 z-10 pointer-events-none transition-all"
                  style={{ marginLeft: `${Math.min(72, Math.max(0, sliderVal * 0.72))}%` }}
                >
                  {activeToken}
                </div>

                <div className="flex items-center gap-1.5 opacity-60 pr-1 pointer-events-none">
                  {['HL', 'R4', activeToken].map((tok, idx) => (
                    <span
                      key={idx}
                      className={`h-9 w-9 rounded-full border flex items-center justify-center font-mono-num text-[11px] font-bold ${
                        tok === activeToken && isMatched
                          ? 'bg-emerald-100 border-emerald-500 text-emerald-800'
                          : 'bg-slate-100 border-slate-300 text-slate-600'
                      }`}
                    >
                      {tok}
                    </span>
                  ))}
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sliderVal}
                  onChange={(e) => setSliderVal(Number(e.target.value))}
                  aria-label="Slide to match captcha"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setCaptchaIndex((i) => (i + 1) % CAPTCHA_TOKENS.length);
                  setSliderVal(10);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B63E5] hover:underline"
              >
                <RefreshCw className="h-3 w-3" /> Refresh Captcha
              </button>
            </div>

            {error && (
              <p role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 rounded-xl p-2.5 text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full min-h-[46px] rounded-full bg-[#0B63E5] text-white text-sm font-bold hover:bg-[#0952C2] transition-colors"
            >
              Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
