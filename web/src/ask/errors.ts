// Telling a busy service from an unreadable picture, so WeKnow never blames the photo for a full queue.

import { isDailyQuota } from '../core/templateParse';

/**
 * Busy, not the photo's fault: the cloud said too many requests (per minute or per day, after reader.ts has
 * already waited and retried), the network failed, or the reading took too long.
 */
export function isBusy(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e);
  return (
    isDailyQuota(e) ||
    /\[(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|quota|Failed to fetch|NetworkError|network|timed out|fetch-error/i.test(msg)
  );
}

