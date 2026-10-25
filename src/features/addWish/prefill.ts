import { normalizeLink } from "./normalizeLink.ts";

export type Prefill = { link: string; name: string; price: string };

const MAX_NAME_LENGTH = 200;

// The bookmarklet hands over what it read from a shop page as `#add=<json>`.
// The page content is untrusted, so everything is validated and the user still
// reviews the form before saving.
export function parsePrefill(hash: string): Prefill | null {
  const encoded = /^#add=(.+)$/.exec(hash)?.[1];
  if (!encoded) return null;

  let data: unknown;
  try {
    data = JSON.parse(decodeURIComponent(encoded));
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;

  const { u, n, p, c } = data as Record<string, unknown>;
  const link = typeof u === "string" ? normalizeLink(u) : null;
  if (link === null) return null;

  const name =
    typeof n === "string"
      ? n.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH)
      : "";
  // Typed prices are in kroner, so a price in another currency is left blank.
  const isKroner =
    c === null ||
    c === undefined ||
    (typeof c === "string" && c.toUpperCase() === "NOK");
  const price =
    isKroner && typeof p === "number" && Number.isFinite(p) && p > 0
      ? String(p)
      : "";

  return { link, name, price };
}
