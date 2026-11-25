const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
const TRIMMED_API_BASE = RAW_API_BASE.trim().replace(/\/+$/, '');
const API_BASE = /^https?:\/\//i.test(TRIMMED_API_BASE) ? TRIMMED_API_BASE : '';

export function apiUrl(path: string): string {
  if (!API_BASE) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
