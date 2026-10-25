import assert from "node:assert/strict";
import test from "node:test";
import type { ProductLookup } from "./productInfo.js";
import {
  isStale,
  refreshUserWishes,
  REFRESH_AFTER_MS,
  type FetchedValue,
  type StoredWish,
  type WishStore,
} from "./refreshWishes.js";

const NOW = 1_800_000_000_000;

class MemoryStore implements WishStore {
  checked = new Map<string, number>();
  fetched = new Map<string, FetchedValue>();
  constructor(private wishes: StoredWish[]) {
    for (const wish of wishes) {
      if (typeof wish.fetchCheckedAt === "number") this.checked.set(wish.id, wish.fetchCheckedAt);
    }
  }
  async list() {
    return this.wishes.map((w) => ({ ...w, fetchCheckedAt: this.checked.get(w.id) }));
  }
  async claim(_userId: string, wishId: string, now: number) {
    if (!isStale({ fetchCheckedAt: this.checked.get(wishId) }, now)) return false;
    this.checked.set(wishId, now);
    return true;
  }
  async saveFetched(_userId: string, wishId: string, fetched: FetchedValue) {
    this.fetched.set(wishId, fetched);
  }
}

const found = (name: string, price: number): ProductLookup => ({
  name,
  price,
  currency: "NOK",
  source: "jsonld",
  finalUrl: null,
  reason: null,
});
const nothing: ProductLookup = {
  name: null,
  price: null,
  currency: null,
  source: null,
  finalUrl: null,
  reason: "http_error",
};

test("isStale: never checked, old, and fresh", () => {
  assert.equal(isStale({ fetchCheckedAt: undefined }, NOW), true);
  assert.equal(isStale({ fetchCheckedAt: "yesterday" }, NOW), true);
  assert.equal(isStale({ fetchCheckedAt: NOW - REFRESH_AFTER_MS }, NOW), true);
  assert.equal(isStale({ fetchCheckedAt: NOW - REFRESH_AFTER_MS + 1 }, NOW), false);
  assert.equal(isStale({ fetchCheckedAt: NOW }, NOW), false);
});

test("only wishes not checked in the last day are fetched", async () => {
  const store = new MemoryStore([
    { id: "never", link: "https://a.no/1", fetchCheckedAt: undefined },
    { id: "old", link: "https://a.no/2", fetchCheckedAt: NOW - 2 * REFRESH_AFTER_MS },
    { id: "fresh", link: "https://a.no/3", fetchCheckedAt: NOW - 1000 },
  ]);
  const urls: string[] = [];
  const result = await refreshUserWishes(store, "u", async (url) => {
    urls.push(url);
    return found("Thing", 100);
  }, () => NOW);

  assert.deepEqual(urls.sort(), ["https://a.no/1", "https://a.no/2"]);
  assert.deepEqual(result, { checked: 2, updated: 2 });
  assert.deepEqual([...store.fetched.keys()].sort(), ["never", "old"]);
  assert.equal(store.fetched.get("never")?.fetchedAt, NOW);
});

test("a failed lookup is still marked checked and keeps earlier data", async () => {
  const store = new MemoryStore([{ id: "w", link: "https://elkjop.no/x", fetchCheckedAt: undefined }]);
  const result = await refreshUserWishes(store, "u", async () => nothing, () => NOW);

  assert.deepEqual(result, { checked: 1, updated: 0 });
  assert.equal(store.checked.get("w"), NOW);
  assert.equal(store.fetched.has("w"), false);
});

test("a second visit right after fetches nothing", async () => {
  const store = new MemoryStore([{ id: "w", link: "https://a.no/1", fetchCheckedAt: undefined }]);
  let calls = 0;
  const lookup = async () => (calls++, found("Thing", 5));

  await refreshUserWishes(store, "u", lookup, () => NOW);
  const second = await refreshUserWishes(store, "u", lookup, () => NOW + 60_000);
  assert.equal(calls, 1);
  assert.deepEqual(second, { checked: 0, updated: 0 });
});

test("two simultaneous visits fetch each wish once", async () => {
  const store = new MemoryStore(
    Array.from({ length: 6 }, (_, i) => ({ id: `w${i}`, link: `https://a.no/${i}`, fetchCheckedAt: undefined }))
  );
  let calls = 0;
  const lookup = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return found("Thing", 5);
  };
  const [a, b] = await Promise.all([
    refreshUserWishes(store, "u", lookup, () => NOW),
    refreshUserWishes(store, "u", lookup, () => NOW),
  ]);
  assert.equal(calls, 6);
  assert.equal(a.checked + b.checked, 6);
});

test("one failing wish does not stop the others", async () => {
  const store = new MemoryStore([
    { id: "bad", link: "https://a.no/bad", fetchCheckedAt: undefined },
    { id: "good", link: "https://a.no/good", fetchCheckedAt: undefined },
  ]);
  const errors: string[] = [];
  const result = await refreshUserWishes(
    store,
    "u",
    async (url) => {
      if (url.endsWith("bad")) throw new Error("boom");
      return found("Good", 1);
    },
    () => NOW,
    (message) => errors.push(message)
  );
  assert.deepEqual(result, { checked: 2, updated: 1 });
  assert.equal(store.fetched.has("good"), true);
  assert.equal(errors.length, 1);
});

test("wishes without a usable link are skipped", async () => {
  const store = new MemoryStore([
    { id: "a", link: undefined, fetchCheckedAt: undefined },
    { id: "b", link: 42, fetchCheckedAt: undefined },
  ]);
  const result = await refreshUserWishes(store, "u", async () => found("x", 1), () => NOW);
  assert.deepEqual(result, { checked: 0, updated: 0 });
});

test("at most 3 lookups run at once and at most 25 wishes per call", async () => {
  const store = new MemoryStore(
    Array.from({ length: 40 }, (_, i) => ({ id: `w${i}`, link: `https://a.no/${i}`, fetchCheckedAt: undefined }))
  );
  let inFlight = 0;
  let peak = 0;
  const result = await refreshUserWishes(store, "u", async () => {
    peak = Math.max(peak, ++inFlight);
    await new Promise((r) => setTimeout(r, 2));
    inFlight--;
    return found("x", 1);
  }, () => NOW);

  assert.equal(peak, 3);
  assert.equal(result.checked, 25);
});
