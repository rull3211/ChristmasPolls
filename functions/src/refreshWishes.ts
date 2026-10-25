import type { ProductLookup } from "./productInfo.js";

export const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_WISHES_PER_CALL = 25;
const CONCURRENCY = 3;

export type StoredWish = {
  id: string;
  link: unknown;
  fetchCheckedAt: unknown;
};

export type FetchedValue = {
  name: string | null;
  price: number | null;
  currency: string | null;
  source: "jsonld" | "opengraph";
  fetchedAt: number;
};

export interface WishStore {
  list(userId: string): Promise<StoredWish[]>;
  // Marks the wish as checked now; false if someone else already did.
  claim(userId: string, wishId: string, now: number): Promise<boolean>;
  saveFetched(userId: string, wishId: string, fetched: FetchedValue): Promise<void>;
}

export function isStale(
  wish: Pick<StoredWish, "fetchCheckedAt">,
  now: number
): boolean {
  return (
    typeof wish.fetchCheckedAt !== "number" ||
    now - wish.fetchCheckedAt >= REFRESH_AFTER_MS
  );
}

export async function refreshUserWishes(
  store: WishStore,
  userId: string,
  lookup: (url: string) => Promise<ProductLookup>,
  now: () => number = Date.now,
  logError: (message: string, error: unknown) => void = () => {}
): Promise<{ checked: number; updated: number }> {
  const queue = (await store.list(userId))
    .filter((wish) => typeof wish.link === "string" && isStale(wish, now()))
    .slice(0, MAX_WISHES_PER_CALL);

  let checked = 0;
  let updated = 0;

  const worker = async () => {
    for (let wish = queue.shift(); wish; wish = queue.shift()) {
      try {
        if (!(await store.claim(userId, wish.id, now()))) continue;
        checked++;

        const info = await lookup(wish.link as string);
        // A failed lookup keeps whatever was fetched before.
        if (info.source && (info.name !== null || info.price !== null)) {
          await store.saveFetched(userId, wish.id, {
            name: info.name,
            price: info.price,
            currency: info.currency,
            source: info.source,
            fetchedAt: now(),
          });
          updated++;
        }
      } catch (error) {
        logError(`refresh failed for wish ${wish.id}`, error);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker)
  );
  return { checked, updated };
}
