const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function weekAgo(from: Date = new Date()): Date {
  return new Date(from.getTime() - WEEK_MS);
}
