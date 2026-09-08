/**
 * Date and Timezone Utilities for EduQuizX
 * Ensures dates transmitted in UTC from the backend are always correctly
 * converted to and displayed in the user's local timezone (e.g. Indian Standard Time - IST).
 */

/**
 * Safely parses any date or datetime representation from API or strings into a JavaScript Date object.
 * If the string contains an ISO date-time (with 'T') but lacks an explicit timezone indicator ('Z', '+', or '-'),
 * it explicitly interprets it as UTC, preventing browsers from incorrectly assuming it is local time.
 */
export function parseUtcDate(val: string | Date | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  const str = String(val).trim();
  if (!str) return null;

  // If string has ISO date-time 'T' but no timezone offset (neither Z nor +/-offset),
  // assume UTC by appending 'Z'
  if (str.includes("T") && !str.endsWith("Z") && !/[+-]\d{2}(:\d{2})?$/.test(str)) {
    const d = new Date(`${str}Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a date in user's local timezone (e.g. IST) for display.
 */
export function formatLocalizedDate(
  val: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseUtcDate(val);
  if (!d) return "—";
  const defaultOpts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  };
  return d.toLocaleDateString([], defaultOpts);
}

/**
 * Formats a localized time string (e.g. "03:30 PM").
 */
export function formatLocalizedTime(val: string | Date | null | undefined): string {
  const d = parseUtcDate(val);
  if (!d) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Formats a Date object into 'YYYY-MM-DDTHH:mm' for <input type="datetime-local"> in the user's local time.
 */
export function formatLocalForInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formats an exam schedule range (e.g. "Sep 8, 03:00 PM – Sep 8, 03:30 PM").
 */
export function formatExamScheduleRange(
  startVal: string | Date | null | undefined,
  endVal: string | Date | null | undefined
): string {
  const start = parseUtcDate(startVal);
  const end = parseUtcDate(endVal);

  if (!start && !end) return "Continuous Open";
  if (!start && end) return `Closes ${formatLocalizedDate(end)}`;
  if (start && !end) return `Opens ${formatLocalizedDate(start)}`;

  const startStr = formatLocalizedDate(start);
  const endStr = formatLocalizedDate(end);
  return `${startStr} – ${endStr}`;
}
