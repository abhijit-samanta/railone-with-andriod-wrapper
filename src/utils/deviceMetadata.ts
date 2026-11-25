export type ClientDeviceType = 'Android' | 'iOS';

const DEVICE_ID_STORAGE_KEY = 'railone_device_id_v1';

export function detectClientDeviceType(): ClientDeviceType {
  if (typeof navigator === 'undefined') return 'Android';
  const ua = navigator.userAgent || '';
  const isAppleMobile =
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);
  return isAppleMobile ? 'iOS' : 'Android';
}

export function getOrCreateClientDeviceId(): string {
  const type = detectClientDeviceType();
  const prefix = type === 'iOS' ? 'RO-IOS-' : 'RO-AND-';
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && /^RO-(AND|IOS)-[A-Z0-9]{8}$/.test(existing)) {
      return existing;
    }
  } catch {
    // ignore storage errors
  }

  let hex = '';
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  } else {
    hex = Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0')
      .toUpperCase();
  }

  const deviceId = `${prefix}${hex}`;
  try {
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  } catch {
    // ignore storage errors
  }
  return deviceId;
}
