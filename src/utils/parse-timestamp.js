export function parseTimestamp(timestamp) {
  const match = timestamp.match(/(\d+)\s+days?\s+(\d+):(\d+):(\d+)/);
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match.map(Number);
  return days * 24 * 60 + hours * 60 + minutes + seconds / 60;
}
