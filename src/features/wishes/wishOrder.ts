import type { StoredWish } from "../../gcp/firestoreFunctions/AddWishApi";

export function isRanked(wishes: Pick<StoredWish, "order">[]): boolean {
  return wishes.some((wish) => typeof wish.order === "number");
}

// Ranked wishes come first in their order. The rest keep the alphabetical
// order that lists had before ranking existed.
export function sortWishes<T extends Pick<StoredWish, "name" | "order">>(
  wishes: T[]
): T[] {
  return [...wishes].sort(
    (a, b) =>
      (a.order ?? Infinity) - (b.order ?? Infinity) ||
      a.name.localeCompare(b.name, "nb")
  );
}

// A new wish goes last. On a list nobody has ranked yet, the wishes already
// there are ranked in their current order at the same time, so the new wish
// cannot end up sorted first or in its alphabetical place among the numbers.
export function placeAtEnd(
  wishes: Pick<StoredWish, "id" | "order">[]
): { order: number; rankExisting: string[] } {
  if (!isRanked(wishes)) {
    return { order: wishes.length, rankExisting: wishes.map((wish) => wish.id) };
  }
  const highest = Math.max(
    ...wishes.map((wish) => wish.order).filter((o): o is number => typeof o === "number")
  );
  return { order: highest + 1, rankExisting: [] };
}

export function moveId(
  ids: readonly string[],
  activeId: string,
  overId: string
): string[] {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return [...ids];

  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// Wishes missing from `orderedIds`, for instance added while dragging, keep
// their place at the end.
export function applyOrder<T extends { id: string }>(
  wishes: T[],
  orderedIds: readonly string[]
): (T & { order: number })[] {
  const byId = new Map(wishes.map((wish) => [wish.id, wish]));
  const listed = orderedIds.flatMap((id) => {
    const wish = byId.get(id);
    return wish ? [wish] : [];
  });
  const rest = wishes.filter((wish) => !orderedIds.includes(wish.id));
  return [...listed, ...rest].map((wish, order) => ({ ...wish, order }));
}
