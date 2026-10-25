/// <reference types="node" />
import assert from "node:assert/strict";
import test from "node:test";
import { applyOrder, isRanked, moveId, placeAtEnd, sortWishes } from "./wishOrder.ts";

const wish = (id: string, name: string, order?: number) => ({ id, name, order });

test("a list is ranked as soon as one wish has an order", () => {
  assert.equal(isRanked([wish("a", "A"), wish("b", "B")]), false);
  assert.equal(isRanked([wish("a", "A"), wish("b", "B", 0)]), true);
  assert.equal(isRanked([]), false);
});

test("ranked wishes come first in order, the rest follow alphabetically", () => {
  const sorted = sortWishes([
    wish("z", "Zebra"),
    wish("b", "Banan", 1),
    wish("a", "Eple"),
    wish("c", "Citron", 0),
    wish("å", "Åpner"),
  ]);
  assert.deepEqual(sorted.map((w) => w.id), ["c", "b", "a", "z", "å"]);
});

test("a list nobody ranked keeps the old alphabetical order", () => {
  const sorted = sortWishes([wish("2", "Bok"), wish("1", "Ball"), wish("3", "Ark")]);
  assert.deepEqual(sorted.map((w) => w.name), ["Ark", "Ball", "Bok"]);
});

test("sorting does not change the list it was given", () => {
  const input = [wish("b", "B", 1), wish("a", "A", 0)];
  sortWishes(input);
  assert.deepEqual(input.map((w) => w.id), ["b", "a"]);
});

test("a new wish goes after the highest order in a ranked list", () => {
  assert.deepEqual(placeAtEnd([wish("a", "A", 0), wish("b", "B", 4)]), { order: 5, rankExisting: [] });
  assert.deepEqual(placeAtEnd([wish("a", "A"), wish("b", "B", 2)]), { order: 3, rankExisting: [] });
});

test("on an unranked list the existing wishes are ranked in their shown order first", () => {
  assert.deepEqual(placeAtEnd([wish("x", "Ark"), wish("y", "Ball"), wish("z", "Bok")]), {
    order: 3,
    rankExisting: ["x", "y", "z"],
  });
});

test("the first wish on an empty list is simply first", () => {
  assert.deepEqual(placeAtEnd([]), { order: 0, rankExisting: [] });
});

test("the new wish sorts last once placed, whatever its name", () => {
  const existing = [wish("x", "Ark"), wish("y", "Ball")];
  const { order, rankExisting } = placeAtEnd(existing);
  const ranked = applyOrder(existing, rankExisting);
  const sorted = sortWishes([...ranked, { id: "new", name: "Aaa first alphabetically", order }]);
  assert.deepEqual(sorted.map((w) => w.id), ["x", "y", "new"]);
});

test("moving a wish down and up", () => {
  const ids = ["a", "b", "c", "d"];
  assert.deepEqual(moveId(ids, "a", "c"), ["b", "c", "a", "d"]);
  assert.deepEqual(moveId(ids, "d", "b"), ["a", "d", "b", "c"]);
  assert.deepEqual(moveId(ids, "b", "a"), ["b", "a", "c", "d"]);
});

test("moving onto itself or an unknown id changes nothing", () => {
  const ids = ["a", "b", "c"];
  assert.deepEqual(moveId(ids, "b", "b"), ids);
  assert.deepEqual(moveId(ids, "b", "zzz"), ids);
  assert.deepEqual(moveId(ids, "zzz", "b"), ids);
  assert.notEqual(moveId(ids, "b", "b"), ids);
});

test("applying an order numbers the wishes from zero in that order", () => {
  const result = applyOrder([wish("a", "A"), wish("b", "B"), wish("c", "C")], ["c", "a", "b"]);
  assert.deepEqual(result.map((w) => [w.id, w.order]), [["c", 0], ["a", 1], ["b", 2]]);
});

test("a wish missing from the order stays at the end, unknown ids are ignored", () => {
  const result = applyOrder([wish("a", "A"), wish("b", "B"), wish("new", "New")], ["b", "ghost", "a"]);
  assert.deepEqual(result.map((w) => [w.id, w.order]), [["b", 0], ["a", 1], ["new", 2]]);
});
