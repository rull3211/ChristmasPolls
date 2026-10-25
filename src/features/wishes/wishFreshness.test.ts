/// <reference types="node" />
import assert from "node:assert/strict";
import test from "node:test";
import { needsRefresh, pendingRefreshKeys, refreshKey } from "./wishFreshness.ts";

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const wish = (id: string, link: string, fetchCheckedAt?: number) => ({ id, link, fetchCheckedAt });

test("a wish is due when never checked or checked a day ago", () => {
  assert.equal(needsRefresh({ fetchCheckedAt: undefined }, NOW), true);
  assert.equal(needsRefresh({ fetchCheckedAt: NOW - DAY }, NOW), true);
  assert.equal(needsRefresh({ fetchCheckedAt: NOW - DAY + 1 }, NOW), false);
});

test("only due wishes that were not tried yet are returned", () => {
  const wishes = [wish("new", "https://a.no/1"), wish("fresh", "https://a.no/2", NOW - 1000), wish("old", "https://a.no/3", NOW - 2 * DAY)];
  assert.deepEqual(pendingRefreshKeys(wishes, new Set(), NOW), ["new:https://a.no/1", "old:https://a.no/3"]);
  assert.deepEqual(pendingRefreshKeys(wishes, new Set(["new:https://a.no/1"]), NOW), ["old:https://a.no/3"]);
});

test("a wish added after the first refresh is picked up", () => {
  const attempted = new Set(pendingRefreshKeys([wish("a", "https://a.no/1")], new Set(), NOW));
  const withNewWish = [wish("a", "https://a.no/1"), wish("b", "https://a.no/2")];
  assert.deepEqual(pendingRefreshKeys(withNewWish, attempted, NOW), ["b:https://a.no/2"]);
});

test("a failed attempt is not repeated, but a changed link is tried again", () => {
  const attempted = new Set([refreshKey(wish("a", "https://a.no/1"))]);
  assert.deepEqual(pendingRefreshKeys([wish("a", "https://a.no/1")], attempted, NOW), []);
  assert.deepEqual(pendingRefreshKeys([wish("a", "https://a.no/other")], attempted, NOW), ["a:https://a.no/other"]);
});

test("nothing is returned for an empty list", () => {
  assert.deepEqual(pendingRefreshKeys([], new Set(), NOW), []);
});
