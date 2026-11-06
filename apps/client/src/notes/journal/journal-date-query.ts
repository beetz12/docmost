// Turns a quick-search query into journal dates ("yest" -> yesterday, "mar 5" -> 5 March this year).
// Pure functions; all dates are local calendar dates written as YYYY-MM-DD.

export interface JournalDateSuggestion {
  date: string;
  label: string;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromIsoDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + days);
  return out;
}

/** Weekday in the current week, weeks starting on Monday. */
function weekdayThisWeek(now: Date, weekday: number): Date {
  const mondayOffset = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = addDays(now, -mondayOffset);
  return addDays(monday, (weekday + 6) % 7);
}

/** Matches when the token is a prefix of the word (at least 2 letters, or the whole word). */
function prefixOf(token: string, word: string, min = 2): boolean {
  return token.length >= Math.min(min, word.length) && word.startsWith(token);
}

function findWeekday(token: string): number {
  return WEEKDAYS.findIndex((w) => prefixOf(token, w));
}

function findMonth(token: string): number {
  return MONTHS.findIndex((m) => prefixOf(token, m, 3));
}

export function formatJournalLabel(date: string, locale?: string): string {
  return fromIsoDate(date).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Returns journal date suggestions for a query, best first. Empty array when the
 * query does not look like a date. An empty query means today.
 */
export function parseJournalDateQuery(
  raw: string,
  now: Date = new Date(),
): JournalDateSuggestion[] {
  const q = (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out: JournalDateSuggestion[] = [];
  const push = (d: Date, label: string) => {
    const date = toIsoDate(d);
    if (!out.some((s) => s.date === date)) out.push({ date, label });
  };

  if (q === "") {
    push(today, "Today");
    return out;
  }

  // ISO date typed directly
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(q);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (d.getMonth() === Number(iso[2]) - 1) push(d, toIsoDate(d));
    return out;
  }

  const tokens = q.split(" ");
  const [first, second] = tokens;

  if (tokens.length === 1) {
    if (prefixOf(first, "today")) push(today, "Today");
    if (prefixOf(first, "tomorrow")) push(addDays(today, 1), "Tomorrow");
    if (prefixOf(first, "yesterday")) push(addDays(today, -1), "Yesterday");
    if (prefixOf(first, "last")) push(addDays(today, -7), `Last ${WEEKDAYS[today.getDay()]}`);
    if (prefixOf(first, "next")) push(addDays(today, 7), `Next ${WEEKDAYS[today.getDay()]}`);
  }

  // "last friday" / "next fri": that weekday in the previous / next week
  if (tokens.length === 2 && (prefixOf(first, "last") || prefixOf(first, "next"))) {
    const wd = findWeekday(second);
    if (wd >= 0) {
      const shift = prefixOf(first, "last") ? -7 : 7;
      const word = prefixOf(first, "last") ? "Last" : "Next";
      push(addDays(weekdayThisWeek(today, wd), shift), `${word} ${WEEKDAYS[wd]}`);
    }
  }

  // weekday name: that weekday this week
  if (tokens.length === 1) {
    const wd = findWeekday(first);
    if (wd >= 0) push(weekdayThisWeek(today, wd), WEEKDAYS[wd]);
  }

  // month name with optional day number: "mar", "mar 5", "5 mar"
  if (tokens.length <= 2) {
    let monthTok = first;
    let dayTok = second;
    if (/^\d{1,2}$/.test(first) && second) {
      monthTok = second;
      dayTok = first;
    }
    const m = findMonth(monthTok);
    if (m >= 0 && (dayTok === undefined || /^\d{1,2}$/.test(dayTok))) {
      const day = dayTok ? Number(dayTok) : 1;
      const d = new Date(today.getFullYear(), m, day);
      if (d.getMonth() === m) {
        push(d, `${day} ${MONTHS[m]}`);
      }
    }
  }

  return out.slice(0, 3).map((s) => ({
    ...s,
    label: s.label.charAt(0).toUpperCase() + s.label.slice(1),
  }));
}
