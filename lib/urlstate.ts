// sync state ↔ URL query แบบ client-only (replaceState ไม่เพิ่ม history entry)
export function getParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
}

export function setParam(key: string, value: string | null) {
  if (typeof window === 'undefined') return;
  const q = new URLSearchParams(window.location.search);
  if (value == null) q.delete(key);
  else q.set(key, value);
  const qs = q.toString();
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
}
