// ช่วงชั่วโมงที่แสดงของ Timebox — Calendar แบบวันใช้กรอบเดียวกันให้เวลาตรงกัน
export const HOURS_KEY = 'timebox:hours';
export const DEFAULT_HOURS = { start: 8, end: 18 };

export function loadHours(): { start: number; end: number } {
  try {
    const s = localStorage.getItem(HOURS_KEY);
    if (s) {
      const p = JSON.parse(s);
      if (Number.isInteger(p.start) && Number.isInteger(p.end) && p.start >= 0 && p.end <= 24 && p.end > p.start) {
        return p;
      }
    }
  } catch { /* ค่าเสียก็ใช้ default */ }
  return DEFAULT_HOURS;
}

export function saveHours(h: { start: number; end: number }) {
  try { localStorage.setItem(HOURS_KEY, JSON.stringify(h)); } catch { /* private mode */ }
}
