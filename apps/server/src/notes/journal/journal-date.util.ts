// Pure helpers for journals. No Nest/DB dependencies, so they are easy to unit test.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** True for a real calendar date written as YYYY-MM-DD. */
export function isValidJournalDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

/** First and last day (inclusive) of a YYYY-MM month, or null when invalid. */
export function monthRange(
  month: string,
): { start: string; end: string } | null {
  const m = ISO_MONTH.exec(month ?? '');
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return {
    start: `${m[1]}-${m[2]}-01`,
    end: `${m[1]}-${m[2]}-${String(last).padStart(2, '0')}`,
  };
}

/** Values for template placeholders, computed from the journal date only (no time zone needed). */
export function placeholderValues(date: string): Record<string, string> {
  const [y, mo, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const weekday = WEEKDAYS[dt.getUTCDay()];
  const monthName = MONTHS[mo - 1];
  return {
    date,
    weekday,
    day: String(d),
    month: monthName,
    year: String(y),
    longdate: `${weekday}, ${d} ${monthName} ${y}`,
  };
}

/**
 * Replaces {{date}}, {{weekday}}, {{day}}, {{month}}, {{year}} and {{longdate}}
 * (case-insensitive, spaces allowed inside the braces) in a string.
 * Unknown placeholders are left as they are.
 */
export function fillPlaceholders(text: string, date: string): string {
  const values = placeholderValues(date);
  return text.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (whole, key: string) => {
    const v = values[key.toLowerCase()];
    return v === undefined ? whole : v;
  });
}

/** Deep-copies a ProseMirror JSON doc and fills placeholders in every text node. */
export function fillTemplateDoc<T>(doc: T, date: string): T {
  const walk = (node: any): any => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === 'text' && typeof v === 'string') {
          out[k] = fillPlaceholders(v, date);
        } else {
          out[k] = walk(v);
        }
      }
      return out;
    }
    return node;
  };
  return walk(doc);
}

/** A journal is empty when its text is blank or unchanged since creation (template only). */
export function isJournalEmpty(
  currentText: string | null | undefined,
  initialText: string | null | undefined,
): boolean {
  const norm = (s: string | null | undefined) =>
    (s ?? '').replace(/\s+/g, ' ').trim();
  const now = norm(currentText);
  return now === '' || now === norm(initialText);
}

/** created_at for a journal dated in the past or future (noon UTC keeps the day stable). */
export function journalCreatedAt(date: string, today: string): Date | null {
  if (date === today) return null;
  return new Date(`${date}T12:00:00.000Z`);
}
