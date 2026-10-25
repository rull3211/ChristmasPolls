import type { Wish } from "../../gcp/firestoreFunctions/AddWishApi";

const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

// Must agree with the server, which makes the final call on what to fetch.
export function needsRefresh(wish: Wish): boolean {
  return (
    typeof wish.fetchCheckedAt !== "number" ||
    Date.now() - wish.fetchCheckedAt >= REFRESH_AFTER_MS
  );
}
