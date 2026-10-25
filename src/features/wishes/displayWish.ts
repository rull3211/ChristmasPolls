import type { Wish } from "../../gcp/firestoreFunctions/AddWishApi";

const numberFormat = new Intl.NumberFormat("nb-NO", {
  maximumFractionDigits: 2,
});

export function formatPrice(value: number, currency: string | null): string {
  const amount = numberFormat.format(value);
  return !currency || currency === "NOK" ? `${amount} kr` : `${amount} ${currency}`;
}

// Fetched values win; what the user typed is the fallback.
export function displayName(wish: Wish): string {
  return wish.fetched?.name ?? wish.name;
}

export function displayPrice(wish: Wish): string | null {
  if (wish.fetched?.price != null) {
    return formatPrice(wish.fetched.price, wish.fetched.currency);
  }
  return wish.price ? `${wish.price} kr` : null;
}

export function priceIsTyped(wish: Wish): boolean {
  return wish.fetched?.price == null && !!wish.price;
}

export function priceFetchedOn(wish: Wish): string | null {
  if (wish.fetched?.price == null) return null;
  return new Date(wish.fetched.fetchedAt).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
