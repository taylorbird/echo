// The time beside a room's name in the phone list: the clock time today, the
// weekday within the last week, the date before that.

const DAY = 24 * 60 * 60 * 1000;

export function listTime(
  timestamp: number | null | undefined,
  now: Date = new Date()
): { label: string; iso: string } | null {
  if (timestamp === null || timestamp === undefined || timestamp <= 0) return null;
  const date = new Date(timestamp);
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let options: Intl.DateTimeFormatOptions;
  if (timestamp >= midnight) options = { hour: 'numeric', minute: '2-digit' };
  else if (timestamp >= midnight - 6 * DAY) options = { weekday: 'short' };
  else if (date.getFullYear() === now.getFullYear()) options = { month: 'short', day: 'numeric' };
  else options = { year: 'numeric', month: 'short', day: 'numeric' };
  return {
    label: new Intl.DateTimeFormat(undefined, options).format(date),
    iso: date.toISOString(),
  };
}
