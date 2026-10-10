/** Normalises user-typed or address-book numbers to E.164. US numbers may omit the country code. */
export function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/** Calendar day (YYYY-MM-DD) in the given IANA time zone. */
export function dayIn(tz: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: safeTz(tz), year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** Hour of day (0-23) in the given IANA time zone. */
export function hourIn(tz: string, at: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: safeTz(tz), hour: 'numeric', hourCycle: 'h23' }).format(at);
  return Number(h);
}

export function safeTz(tz: string | null | undefined): string {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

function prevDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive-day streak ending today or yesterday. A streak that ends yesterday is still
 * alive (today's take is pending), which is exactly the case the streak-saver text is for.
 */
export function streakFromDays(days: Iterable<string>, today: string): number {
  const set = new Set(days);
  let cursor = set.has(today) ? today : prevDay(today);
  let n = 0;
  while (set.has(cursor)) {
    n += 1;
    cursor = prevDay(cursor);
  }
  return n;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'A friend';
}
