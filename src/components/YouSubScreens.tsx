import { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Mail,
  Pencil,
  Phone,
  X,
} from 'lucide-react';
import {
  formatOrdinalDob,
  maskIdNumber,
  resolveTransactionDisplay,
} from '../utils/railLogic';
import type { UserProfile, WalletTransaction } from '../types/rail';

const CITY_OPTIONS = [
  'East Midnapore',
  'New Delhi',
  'Kolkata',
  'North 24 Parganas',
  'Howrah',
  'Mumbai',
  'Bengaluru',
  'Chennai',
  'Hyderabad',
  'Pune',
  'Patna',
  'Lucknow',
];

const STATE_OPTIONS = [
  'West Bengal',
  'Delhi',
  'Maharashtra',
  'Karnataka',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'Bihar',
  'Gujarat',
  'Rajasthan',
];

const ID_TYPE_OPTIONS = [
  'PAN Card',
  'Aadhaar Card',
  'Passport',
  'Voter ID',
  'Driving License',
];

export function YourDetailsModal({
  profile,
  onClose,
  onSwitchToEdit,
}: {
  profile: UserProfile;
  onClose: () => void;
  onSwitchToEdit: () => void;
}) {
  const detailRows: Array<{ label: string; value: string }> = [
    { label: 'DOB', value: profile.dob || 'Not Provided' },
    { label: 'Gender', value: profile.gender || 'Not Provided' },
    { label: 'ID Type', value: profile.idType || 'Not Provided' },
    { label: 'ID Number', value: profile.idNumber ? maskIdNumber(profile.idNumber) : 'Not Provided' },
    { label: 'Address Line1', value: profile.addressLine1 || 'Not Provided' },
    { label: 'Address Line2', value: profile.addressLine2 || 'Not Provided' },
    { label: 'Pin Code*', value: profile.pinCode || 'Not Provided' },
    { label: 'Post Office', value: profile.postOffice || 'Not Provided' },
    { label: 'City*', value: profile.city || 'Not Provided' },
    { label: 'Country*', value: profile.country || 'India' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your Details"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-2.5 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[26px] max-w-md w-full max-h-[92vh] overflow-y-auto px-5 pt-5 pb-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[21px] font-bold text-[#111842]">Your Details</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Your Details"
            className="h-9 w-9 rounded-full border border-[#BBD4EC] text-[#111842] hover:bg-slate-50 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="mt-4 mb-5 flex items-center justify-center gap-2.5">
          <p className="font-display text-[17.5px] font-bold text-[#111827] text-center leading-snug">
            {profile.name}
          </p>
          <button
            type="button"
            onClick={onSwitchToEdit}
            aria-label="Edit Details"
            className="h-8 w-8 rounded-lg hover:bg-[#EAF4FF] text-[#0066FF] flex items-center justify-center shrink-0 transition-colors"
          >
            <Pencil className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>

        <div className="space-y-3.5">
          {detailRows.map(({ label, value }) => (
            <div
              key={label}
              className="relative rounded-xl border border-[#C7D7EA] bg-white px-4 pt-3.5 pb-2.5"
            >
              <span className="absolute -top-2.5 left-3 bg-white px-1.5 text-[12px] font-normal text-[#6B7280]">
                {label}
              </span>
              <p className="text-[15px] font-normal text-[#1F2937] min-h-[22px] break-words">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EditDetailsModal({
  profile,
  onSave,
  onClose,
}: {
  profile: UserProfile;
  onSave: (next: UserProfile) => void;
  onClose: () => void;
}) {
  const [dob, setDob] = useState(profile.dob ?? '');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Transgender'>(
    profile.gender || 'Male'
  );
  const [idType, setIdType] = useState(profile.idType || 'PAN Card');
  const [idNumber, setIdNumber] = useState(profile.idNumber ?? '');
  const [addressLine1, setAddressLine1] = useState(profile.addressLine1 ?? '');
  const [addressLine2, setAddressLine2] = useState(profile.addressLine2 ?? '');
  const [pinCode, setPinCode] = useState(profile.pinCode ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  const [customCityMode, setCustomCityMode] = useState(false);
  const [stateVal, setStateVal] = useState(profile.state ?? '');
  const [customStateMode, setCustomStateMode] = useState(false);
  const [country, setCountry] = useState(profile.country || 'India');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cityList =
    city && !CITY_OPTIONS.includes(city) ? [city, ...CITY_OPTIONS] : CITY_OPTIONS;
  const stateList =
    stateVal && !STATE_OPTIONS.includes(stateVal) ? [stateVal, ...STATE_OPTIONS] : STATE_OPTIONS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dob.trim() || !idNumber.trim() || !pinCode.trim() || !city.trim() || !country.trim()) {
      setErrorMsg('Please fill in DOB, ID Number, Pin Code, City, and Country.');
      return;
    }
    setErrorMsg(null);
    onSave({
      ...profile,
      dob: dob.trim(),
      gender,
      idType,
      idNumber: idNumber.trim().toUpperCase(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      pinCode: pinCode.trim(),
      city: city.trim(),
      state: stateVal.trim(),
      country: country.trim(),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit Your Details"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-2.5 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[26px] max-w-md w-full max-h-[92vh] overflow-y-auto px-5 pt-5 pb-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[21px] font-bold text-[#111842]">Edit Your Details</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Edit Your Details"
            className="h-9 w-9 rounded-full border border-[#BBD4EC] text-[#111842] hover:bg-slate-50 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {/* 1. DOB with calendar icon */}
          <div className="relative flex items-center rounded-xl border border-[#C7D7EA] bg-white px-4 min-h-[48px] focus-within:border-[#0066FF]">
            <input
              type="text"
              aria-label="Date of Birth"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              placeholder="Date of Birth"
              className="w-full text-[15px] text-[#1F2937] bg-transparent focus:outline-none pr-8"
            />
            <div className="relative h-8 w-8 flex items-center justify-center text-[#0066FF] shrink-0">
              <Calendar className="h-[19px] w-[19px]" strokeWidth={2} />
              <input
                type="date"
                aria-label="Choose Date of Birth"
                onChange={(e) => {
                  if (e.target.value) {
                    setDob(formatOrdinalDob(e.target.value));
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* 2. Gender */}
          <div className="relative">
            <select
              aria-label="Gender"
              value={gender}
              onChange={(e) =>
                setGender(e.target.value as 'Male' | 'Female' | 'Transgender')
              }
              className="w-full appearance-none rounded-xl border border-[#C7D7EA] bg-white px-4 pr-10 min-h-[48px] text-[15px] text-[#1F2937] focus:outline-none focus:border-[#0066FF]"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Transgender">Transgender</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0066FF]"
              strokeWidth={2.5}
            />
          </div>

          {/* 3. ID Type */}
          <div className="relative">
            <select
              aria-label="ID Type"
              value={idType}
              onChange={(e) => setIdType(e.target.value)}
              className="w-full appearance-none rounded-xl border border-[#C7D7EA] bg-white px-4 pr-10 min-h-[48px] text-[15px] text-[#1F2937] focus:outline-none focus:border-[#0066FF]"
            >
              {ID_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0066FF]"
              strokeWidth={2.5}
            />
          </div>

          {/* 4. ID Number (green border) */}
          <input
            type="text"
            aria-label="ID Number"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
            placeholder="ID Number"
            className="w-full rounded-xl border-[1.5px] border-[#3E8E41] bg-white px-4 min-h-[48px] text-[15px] text-[#1F2937] uppercase focus:outline-none"
          />

          {/* 5. Address Line 1 */}
          <input
            type="text"
            aria-label="Address Line 1"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder="Address Line 1"
            className="w-full rounded-xl border border-[#C7D7EA] bg-white px-4 min-h-[48px] text-[15px] text-[#1F2937] focus:outline-none focus:border-[#0066FF]"
          />

          {/* 6. Address Line 2 */}
          <input
            type="text"
            aria-label="Address Line 2"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            placeholder="Address Line 2"
            className="w-full rounded-xl border border-[#C7D7EA] bg-white px-4 min-h-[48px] text-[15px] text-[#1F2937] focus:outline-none focus:border-[#0066FF]"
          />

          {/* 7. Pin Code */}
          <input
            type="text"
            aria-label="Pin Code"
            inputMode="numeric"
            maxLength={6}
            value={pinCode}
            onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
            placeholder="Pin Code"
            className="w-full rounded-xl border border-[#C7D7EA] bg-white px-4 min-h-[48px] text-[15px] text-[#1F2937] focus:outline-none focus:border-[#0066FF]"
          />

          {/* 8. City */}
          {customCityMode ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                aria-label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Enter City"
                className="flex-1 rounded-xl border border-[#C7D7EA] bg-white px-4 min-h-[48px] text-[15px] text-[#1F2937] focus:outline-none focus:border-[#0066FF]"
              />
              <button
                type="button"
                onClick={() => setCustomCityMode(false)}
                className="text-xs font-medium text-[#0066FF] px-2"
              >
                List
              </button>
            </div>
          ) : (
            <div className="relative">
              <select
                aria-label="City"
                value={city}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCustomCityMode(true);
                  } else {
                    setCity(e.target.value);
                  }
                }}
                className="w-full appearance-none rounded-xl border border-[#C7D7EA] bg-white px-4 pr-10 min-h-[48px] text-[15px] text-[#1F2937] focus:outline-none focus:border-[#0066FF]"
              >
                <option value="">Select City</option>
                {cityList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__custom__">Enter Custom City...</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0066FF]"
                strokeWidth={2.5}
              />
            </div>
          )}

          {/* 9. State */}
          {customStateMode ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                aria-label="State"
                value={stateVal}
                onChange={(e) => setStateVal(e.target.value)}
                placeholder="Enter State"
                className="flex-1 rounded-xl border border-[#C7D7EA] bg-white px-4 min-h-[48px] text-[15px] text-[#1F2937] focus:outline-none focus:border-[#0066FF]"
              />
              <button
                type="button"
                onClick={() => setCustomStateMode(false)}
                className="text-xs font-medium text-[#0066FF] px-2"
              >
                List
              </button>
            </div>
          ) : (
            <div className="relative">
              <select
                aria-label="State"
                value={stateVal}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCustomStateMode(true);
                  } else {
                    setStateVal(e.target.value);
                  }
                }}
                className="w-full appearance-none rounded-xl border border-[#C7D7EA] bg-white px-4 pr-10 min-h-[48px] text-[15px] text-[#1F2937] focus:outline-none focus:border-[#0066FF]"
              >
                <option value="">Select State</option>
                {stateList.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
                <option value="__custom__">Enter Custom State...</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0066FF]"
                strokeWidth={2.5}
              />
            </div>
          )}

          {/* 10. Country */}
          <input
            type="text"
            aria-label="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
            className="w-full rounded-xl border border-[#C7D7EA] bg-white px-4 min-h-[48px] text-[15px] text-[#1F2937] focus:outline-none focus:border-[#0066FF]"
          />

          {errorMsg && <p className="text-xs font-medium text-rose-600">{errorMsg}</p>}

          <button
            type="submit"
            className="mt-2 w-full min-h-[48px] rounded-full bg-[#0066FF] hover:bg-[#0052CC] text-white text-[16px] font-medium transition-colors"
          >
            Update
          </button>
        </form>
      </div>
    </div>
  );
}

export function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setErrorMsg('Please fill in all required password fields.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and Confirm New Password do not match.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg('Password updated successfully.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Change Password"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/45 flex items-end justify-center"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-[28px] bg-white px-5 pt-5 pb-6 shadow-2xl space-y-3.5"
      >
        <div className="flex items-center justify-between pb-1">
          <h2 className="font-display text-[20px] font-bold text-[#111842]">Change Password</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Change Password"
            className="h-9 w-9 rounded-full border border-[#BBD4EC] text-[#111842] hover:bg-slate-50 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="rounded-xl border border-[#C7D7EA] bg-white px-4 min-h-[50px] flex items-center gap-2 focus-within:border-[#0066FF]">
          <input
            type={showCurrent ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current Password*"
            aria-label="Current Password"
            className="w-full text-[15px] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none bg-transparent"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
            className="text-[#0066FF] hover:opacity-80 shrink-0"
          >
            {showCurrent ? (
              <Eye className="h-[19px] w-[19px]" strokeWidth={2} />
            ) : (
              <EyeOff className="h-[19px] w-[19px]" strokeWidth={2} />
            )}
          </button>
        </div>

        <div className="rounded-xl border border-[#C7D7EA] bg-white px-4 min-h-[50px] flex items-center gap-2 focus-within:border-[#0066FF]">
          <input
            type={showNew ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New Password*"
            aria-label="New Password"
            className="w-full text-[15px] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none bg-transparent"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            aria-label={showNew ? 'Hide new password' : 'Show new password'}
            className="text-[#0066FF] hover:opacity-80 shrink-0"
          >
            {showNew ? (
              <Eye className="h-[19px] w-[19px]" strokeWidth={2} />
            ) : (
              <EyeOff className="h-[19px] w-[19px]" strokeWidth={2} />
            )}
          </button>
        </div>

        <div className="rounded-xl border border-[#C7D7EA] bg-white px-4 min-h-[50px] flex items-center focus-within:border-[#0066FF]">
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm New Password*"
            aria-label="Confirm New Password"
            className="w-full text-[15px] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none bg-transparent"
          />
        </div>

        {errorMsg && <p className="text-xs font-medium text-rose-600">{errorMsg}</p>}
        {successMsg && (
          <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> {successMsg}
          </p>
        )}

        <button
          type="submit"
          className="w-full min-h-[48px] rounded-full bg-[#0066FF] hover:bg-[#0052CC] text-white text-[16px] font-medium transition-colors"
        >
          Change Password
        </button>
      </form>
    </div>
  );
}

export function MyAccountSheet({
  profile,
  onUpdateProfile,
  onClose,
}: {
  profile: UserProfile;
  onUpdateProfile: (next: UserProfile) => void;
  onClose: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [mobileDraft, setMobileDraft] = useState(profile.mobile);
  const [emailDraft, setEmailDraft] = useState(profile.email);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed) {
      onUpdateProfile({ ...profile, name: trimmed });
      setStatusMsg('Account name updated.');
    } else {
      setNameDraft(profile.name);
    }
    setEditingName(false);
  };

  const commitMobile = () => {
    const digits = mobileDraft.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 10 && digits !== profile.mobile) {
      onUpdateProfile({ ...profile, mobile: digits });
      setMobileDraft(digits);
    } else if (digits.length !== 10) {
      setMobileDraft(profile.mobile);
    }
  };

  const commitEmail = () => {
    const trimmed = emailDraft.trim();
    if (trimmed.includes('@') && trimmed !== profile.email) {
      onUpdateProfile({ ...profile, email: trimmed, emailVerified: true });
    } else if (!trimmed.includes('@')) {
      setEmailDraft(profile.email);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="My Account"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/45 flex items-end justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-[28px] bg-white px-5 pt-5 pb-6 shadow-2xl space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[20px] font-bold text-[#111842]">My Account</h2>
        </div>

        {/* 1. User ID gray read-only box */}
        <div className="rounded-xl bg-[#F1F2F4] px-4 min-h-[48px] flex items-center text-[15px] text-[#4B5563]">
          {profile.userId}
        </div>

        {/* 2. Editable Name box with green border and blue pencil icon */}
        <div className="rounded-xl border-[1.2px] border-[#3E8E41] bg-white px-4 min-h-[48px] flex items-center justify-between gap-2">
          {editingName ? (
            <input
              type="text"
              aria-label="Account Holder Name"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitName();
                }
              }}
              className="w-full text-[15px] text-[#1F2937] focus:outline-none bg-transparent"
            />
          ) : (
            <span className="text-[15px] text-[#1F2937] truncate">{profile.name}</span>
          )}
          <button
            type="button"
            onClick={() => {
              if (editingName) {
                commitName();
              } else {
                setNameDraft(profile.name);
                setEditingName(true);
              }
            }}
            aria-label={editingName ? 'Save account name' : 'Edit account name'}
            className="text-[#0066FF] hover:opacity-80 shrink-0 p-1"
          >
            {editingName ? (
              <Check className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <Pencil className="h-4 w-4" strokeWidth={2.2} />
            )}
          </button>
        </div>

        {/* 3. Mobile Number row with phone icon + green check badge */}
        <div className="rounded-xl border-[1.2px] border-[#3E8E41] bg-white px-4 min-h-[48px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Phone className="h-[17px] w-[17px] text-[#6B7280] shrink-0" strokeWidth={1.8} />
            <input
              type="tel"
              aria-label="Account Mobile Number"
              value={mobileDraft}
              onChange={(e) => setMobileDraft(e.target.value.replace(/\D/g, '').slice(0, 10))}
              onBlur={commitMobile}
              className="w-full text-[15px] text-[#1F2937] focus:outline-none bg-transparent"
            />
          </div>
          <span
            aria-label="Mobile Verified"
            className="h-5 w-5 rounded-full bg-[#16A34A] text-white flex items-center justify-center shrink-0"
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        </div>

        {/* 4. Email row with mail icon + green check badge */}
        <div className="rounded-xl border-[1.2px] border-[#3E8E41] bg-white px-4 min-h-[48px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Mail className="h-[17px] w-[17px] text-[#6B7280] shrink-0" strokeWidth={1.8} />
            <input
              type="email"
              aria-label="Account Email Address"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              onBlur={commitEmail}
              placeholder="Add Email Address"
              className="w-full text-[15px] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none bg-transparent"
            />
          </div>
          {profile.emailVerified && (
            <span
              aria-label="Email Verified"
              className="h-5 w-5 rounded-full bg-[#16A34A] text-white flex items-center justify-center shrink-0"
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
          )}
        </div>

        {/* 5. Mint pill toggle row */}
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(profile.divyangjanFlowEnabled)}
          onClick={() =>
            onUpdateProfile({
              ...profile,
              divyangjanFlowEnabled: !profile.divyangjanFlowEnabled,
            })
          }
          className="w-full rounded-xl bg-[#EBF7ED] hover:bg-[#DFEFE2] px-3.5 py-2.5 flex items-center gap-3 text-left transition-colors"
        >
          <span
            className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              profile.divyangjanFlowEnabled
                ? 'border-[#16A34A] bg-[#16A34A] text-white'
                : 'border-[#A3B1A7] bg-white'
            }`}
          >
            {profile.divyangjanFlowEnabled && <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
          <span className="text-[14px] text-[#1F2937]">
            Enable Reserved Divyangjan Booking Flow
          </span>
        </button>

        {statusMsg && <p className="text-xs font-medium text-emerald-700">{statusMsg}</p>}

        {/* 6. Bottom-right Delete Account? link */}
        {confirmDelete ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-rose-800">
              Sign out &amp; reset account session?
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs font-semibold text-slate-600 px-2 py-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateProfile({ ...profile, isGuest: true });
                  setConfirmDelete(false);
                  onClose();
                }}
                className="text-xs font-semibold text-rose-700 bg-white border border-rose-200 rounded-lg px-2.5 py-1"
              >
                Confirm
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-[14px] font-medium text-[#0066FF] hover:underline"
            >
              Delete Account?
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MyTransactionsScreen({
  transactions,
  onClose,
}: {
  transactions: WalletTransaction[];
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'Transactions' | 'Passbook' | 'Refund'>(
    'Transactions'
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const normalized = transactions.map((tx) => ({
    raw: tx,
    ...resolveTransactionDisplay(tx),
  }));

  const visibleItems = normalized.filter((item) => {
    if (activeTab === 'Refund') return item.isRefund;
    if (activeTab === 'Passbook') return true;
    return true;
  });

  const handleCopyTxnId = (txnId: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(txnId).catch(() => {});
    }
    setCopiedId(txnId);
    setTimeout(() => {
      setCopiedId((curr) => (curr === txnId ? null : curr));
    }, 1500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="My Transactions"
      className="fixed inset-0 z-50 bg-[#EEF1F5] flex flex-col"
    >
      {/* Solid Blue Header matching Screenshot 5 */}
      <header className="bg-[#0066FF] text-white px-4 py-3.5 flex items-center gap-4 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back from My Transactions"
          className="h-10 w-10 rounded-full border-[1.5px] border-white/80 hover:bg-white/15 flex items-center justify-center transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <h1 className="font-display text-[20px] font-medium tracking-tight">My Transactions</h1>
      </header>

      {/* Segmented Tabs */}
      <div className="max-w-lg w-full mx-auto px-3.5 pt-3 pb-2 shrink-0">
        <div role="tablist" className="rounded-xl bg-[#E3E7EE] p-1 grid grid-cols-3">
          {(['Transactions', 'Passbook', 'Refund'] as const).map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab)}
                className={`py-2 rounded-lg text-[14px] transition-all ${
                  active
                    ? 'bg-white text-[#0066FF] font-semibold shadow-2xs'
                    : 'text-[#1E293B] font-medium hover:text-[#0066FF]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Transaction Cards */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg w-full mx-auto px-3.5 pb-6 space-y-3 pt-1">
          {visibleItems.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#BFD8F8] px-4 py-8 text-center text-sm text-slate-500">
              No {activeTab.toLowerCase()} records found.
            </div>
          ) : (
            visibleItems.map((item) => {
              const isExpanded = Boolean(expandedIds[item.raw.id]);
              return (
                <article
                  key={item.raw.id}
                  className="bg-white rounded-xl border border-[#BFD8F8] px-4 py-3.5 space-y-2.5 shadow-[0_1px_3px_rgba(0,102,255,0.04)]"
                >
                  {/* Top Row: Category & Txn ID + Copy */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-[#111827]">
                      {item.category}
                    </span>
                    <div className="flex items-center gap-1.5 text-[13px] sm:text-[13.5px]">
                      <span className="text-[#4B5563]">Txn ID:</span>
                      <span className="font-mono-num font-bold text-[#111827]">
                        {item.txnId}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyTxnId(item.txnId)}
                        aria-label={`Copy Txn ID ${item.txnId}`}
                        className="text-[#6B7280] hover:text-[#0066FF] p-0.5 transition-colors"
                      >
                        <Copy className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                      {copiedId === item.txnId && (
                        <span className="text-[11px] font-semibold text-[#0066FF]">Copied</span>
                      )}
                    </div>
                  </div>

                  {/* Middle Row: Transaction Time & Amount */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] text-[#9CA3AF]">Transaction Time</p>
                      <p className="text-[14px] font-bold text-[#374151] mt-0.5">
                        {item.timeLabel}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] text-[#9CA3AF]">Amount</p>
                      <p className="text-[14px] font-semibold text-[#374151] mt-0.5 tabular-nums">
                        {activeTab === 'Passbook'
                          ? `${item.raw.type === 'credit' ? '+' : '-'} ${item.amountLabel}`
                          : item.amountLabel}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Row: Remarks & Chevron Toggle */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <p className="text-[13.5px] text-[#6B7280]">
                      Remarks:{' '}
                      <span
                        className={
                          item.isRefund
                            ? 'font-medium text-[#0066FF]'
                            : 'font-medium text-[#2E7D32]'
                        }
                      >
                        {item.remarks}
                      </span>
                    </p>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-label={`Toggle details for transaction ${item.txnId}`}
                      onClick={() =>
                        setExpandedIds((prev) => ({
                          ...prev,
                          [item.raw.id]: !prev[item.raw.id],
                        }))
                      }
                      className="text-[#3B82F6] hover:bg-blue-50 rounded-lg p-1 transition-colors"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        strokeWidth={2.5}
                      />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 pt-2 text-[12.5px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
                      <span>{item.raw.title}</span>
                      <span className="font-medium text-slate-500">
                        {item.raw.type === 'credit' ? 'Credit' : 'Debit'} · {item.raw.date}
                      </span>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function AadhaarAuthSheet({
  profile,
  onUpdateProfile,
  onClose,
}: {
  profile: UserProfile;
  onUpdateProfile: (next: UserProfile) => void;
  onClose: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(profile.name);
  const [dob, setDob] = useState(profile.dob ?? '');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Transgender'>(
    profile.gender || 'Male'
  );
  const [aadhaarNumber, setAadhaarNumber] = useState(profile.aadhaarNumber ?? '');
  const [consentChecked, setConsentChecked] = useState(false);
  const [showReadMore, setShowReadMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verifiedMsg, setVerifiedMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = aadhaarNumber.replace(/\D/g, '');
    if (digits.length !== 12) {
      setErrorMsg('Please enter a valid 12-digit Aadhaar Number.');
      return;
    }
    if (!consentChecked) {
      setErrorMsg('Please provide your consent for Aadhaar-based verification.');
      return;
    }
    setErrorMsg(null);
    onUpdateProfile({
      ...profile,
      name: nameVal.trim() || profile.name,
      dob: dob.trim() || profile.dob,
      gender,
      aadhaarNumber: digits,
      aadhaarVerified: true,
    });
    setVerifiedMsg('Aadhaar authentication completed successfully.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Authenticate with Aadhaar"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/45 flex items-end justify-center"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-[28px] bg-white px-5 pt-5 pb-6 shadow-2xl space-y-3"
      >
        <div className="flex items-center justify-between pb-0.5">
          <h2 className="font-display text-[20px] font-bold text-[#111842]">
            Authenticate with Aadhaar
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Authenticate with Aadhaar"
            className="h-9 w-9 rounded-full border border-[#BBD4EC] text-[#111842] hover:bg-slate-50 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* 1. Gray read-only User ID */}
        <div className="rounded-xl bg-[#F1F2F4] px-4 min-h-[48px] flex items-center text-[15px] text-[#4B5563]">
          {profile.userId}
        </div>

        {/* 2. Name with green border + blue pencil */}
        <div className="rounded-xl border-[1.2px] border-[#3E8E41] bg-white px-4 min-h-[48px] flex items-center justify-between gap-2">
          {editingName ? (
            <input
              type="text"
              aria-label="Aadhaar Holder Name"
              autoFocus
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={() => setEditingName(false)}
              className="w-full text-[15px] text-[#1F2937] focus:outline-none bg-transparent"
            />
          ) : (
            <span className="text-[15px] text-[#1F2937] truncate">{nameVal}</span>
          )}
          <button
            type="button"
            onClick={() => setEditingName((v) => !v)}
            aria-label="Edit Aadhaar Name"
            className="text-[#0066FF] hover:opacity-80 shrink-0 p-1"
          >
            {editingName ? (
              <Check className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <Pencil className="h-4 w-4" strokeWidth={2.2} />
            )}
          </button>
        </div>

        {/* 3. DOB with blue calendar icon */}
        <div className="relative flex items-center rounded-xl border border-[#C7D7EA] bg-white px-4 min-h-[48px] focus-within:border-[#0066FF]">
          <input
            type="text"
            aria-label="Aadhaar Date of Birth"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            placeholder="Date of Birth"
            className="w-full text-[15px] text-[#1F2937] bg-transparent focus:outline-none pr-8"
          />
          <div className="relative h-8 w-8 flex items-center justify-center text-[#0066FF] shrink-0">
            <Calendar className="h-[19px] w-[19px]" strokeWidth={2} />
            <input
              type="date"
              aria-label="Pick Aadhaar Date of Birth"
              onChange={(e) => {
                if (e.target.value) {
                  setDob(formatOrdinalDob(e.target.value));
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
        </div>

        {/* 4. Gender select */}
        <div className="relative">
          <select
            aria-label="Aadhaar Gender"
            value={gender}
            onChange={(e) =>
              setGender(e.target.value as 'Male' | 'Female' | 'Transgender')
            }
            className="w-full appearance-none rounded-xl border border-[#C7D7EA] bg-white px-4 pr-10 min-h-[48px] text-[15px] text-[#1F2937] focus:outline-none focus:border-[#0066FF]"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Transgender">Transgender</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0066FF]"
            strokeWidth={2.5}
          />
        </div>

        {/* 5. Aadhaar Number input */}
        <input
          type="text"
          inputMode="numeric"
          maxLength={12}
          aria-label="Aadhaar Number"
          value={aadhaarNumber}
          onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
          placeholder="Aadhaar Number"
          className="w-full rounded-xl border border-[#C7D7EA] bg-white px-4 min-h-[48px] text-[15px] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#0066FF]"
        />

        {/* 6. Consent checkbox */}
        <div className="flex items-start gap-2.5 pt-0.5">
          <input
            id="aadhaar-consent"
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="h-5 w-5 rounded border-[1.5px] border-[#0066FF] accent-[#0066FF] shrink-0 mt-0.5 cursor-pointer"
          />
          <label htmlFor="aadhaar-consent" className="text-[13.5px] text-[#1F2937] leading-snug">
            I hereby give my consent for Aadhaar-based verification.{' '}
            <button
              type="button"
              onClick={() => setShowReadMore((v) => !v)}
              className="text-[#0066FF] hover:underline font-medium"
            >
              Read more
            </button>
          </label>
        </div>

        {showReadMore && (
          <p className="rounded-xl bg-[#F8FAFC] border border-slate-200 px-3 py-2 text-[12px] text-slate-600 leading-relaxed">
            Your Aadhaar number is used solely for UIDAI demographic authentication required for
            Tatkal and higher monthly Indian Railways ticket booking limits. Only the masked token
            is stored on your RailOne profile.
          </p>
        )}

        {errorMsg && <p className="text-xs font-medium text-rose-600">{errorMsg}</p>}
        {verifiedMsg && (
          <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> {verifiedMsg}
          </p>
        )}

        <button
          type="submit"
          className="w-full min-h-[48px] rounded-full bg-[#0066FF] hover:bg-[#0052CC] text-white text-[16px] font-medium transition-colors"
        >
          Verify
        </button>
      </form>
    </div>
  );
}
