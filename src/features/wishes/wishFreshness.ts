import type { StoredWish } from "../../gcp/firestoreFunctions/AddWishApi";

const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

// Must agree with the server, which makes the final call on what to fetch.
export function needsRefresh(
  wish: Pick<StoredWish, "fetchCheckedAt">,
  now: number = Date.now()
): boolean {
  return (
    typeof wish.fetchCheckedAt !== "number" ||
    now - wish.fetchCheckedAt >= REFRESH_AFTER_MS
  );
}

// A new link on the same wish counts as a new attempt.
export function refreshKey(wish: Pick<StoredWish, "id" | "link">): string {
  return `${wish.id}:${wish.link}`;
}

// Wishes that are due and not yet tried in this session. Trying each at most
// once keeps a failing request from looping, while a wish added or re-linked
// later is picked up as soon as the list shows it.
export function pendingRefreshKeys(
  wishes: Pick<StoredWish, "id" | "link" | "fetchCheckedAt">[],
  attempted: ReadonlySet<string>,
  now: number = Date.now()
): string[] {
  return wishes
    .filter((wish) => needsRefresh(wish, now))
    .map(refreshKey)
    .filter((key) => !attempted.has(key));
}
