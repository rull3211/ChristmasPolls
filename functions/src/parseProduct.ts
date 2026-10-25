import { load } from "cheerio";

export type ProductInfo = {
  name: string | null;
  price: number | null;
  currency: string | null;
  source: "jsonld" | "opengraph" | null;
};

type Node = Record<string, unknown>;

const MAX_NAME_LENGTH = 200;

export function parsePrice(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/[^\d.,]/g, "");
  if (!/\d/.test(cleaned)) return null;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let normalized: string;
  if (lastDot !== -1 && lastComma !== -1) {
    // Both present: the later one is the decimal separator.
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastDot !== -1 || lastComma !== -1) {
    const separator = lastDot !== -1 ? "." : ",";
    const parts = cleaned.split(separator);
    const lastPart = parts[parts.length - 1];
    // "1.299" and "1.299.000" are thousands; "12.50" and "1299.0" are decimals.
    const isThousands = parts.length > 2 || lastPart.length === 3;
    normalized = isThousands ? parts.join("") : parts.join(".");
  } else {
    normalized = cleaned;
  }

  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const decoded = value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number(dec))
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  const collapsed = decoded.replace(/\s+/g, " ").trim();
  return collapsed ? collapsed.slice(0, MAX_NAME_LENGTH) : null;
}

function asNodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(asNodes);
  return value !== null && typeof value === "object" ? [value as Node] : [];
}

function typesOf(node: Node): string[] {
  const raw = node["@type"];
  return (Array.isArray(raw) ? raw : [raw])
    .filter((type): type is string => typeof type === "string")
    .map((type) => type.replace(/^.*[/#]/, ""));
}

// Document order, and never descends into a product: products nested inside
// another product (related items, variants) are not the page's product.
function findProducts(root: unknown): Node[] {
  const found: Node[] = [];
  const visit = (node: Node) => {
    const types = typesOf(node);
    if (types.includes("Product") || types.includes("ProductGroup")) {
      found.push(node);
      return;
    }
    for (const value of Object.values(node)) {
      asNodes(value).forEach(visit);
    }
  };
  asNodes(root).forEach(visit);
  return found;
}

type PricePoint = { price: number; currency: string | null };

function isListPrice(spec: Node): boolean {
  return /list|strike/i.test(String(spec.priceType ?? ""));
}

function offerPoints(offer: Node): PricePoint[] {
  const currencyOf = (node: Node) =>
    typeof node.priceCurrency === "string"
      ? node.priceCurrency.toUpperCase()
      : null;
  const points: PricePoint[] = [];

  for (const key of ["price", "lowPrice"]) {
    const price = parsePrice(offer[key]);
    if (price !== null) points.push({ price, currency: currencyOf(offer) });
  }
  for (const spec of asNodes(offer.priceSpecification)) {
    if (isListPrice(spec)) continue;
    const price = parsePrice(spec.price);
    if (price !== null) {
      points.push({ price, currency: currencyOf(spec) ?? currencyOf(offer) });
    }
  }
  for (const nested of asNodes(offer.offers)) {
    points.push(...offerPoints(nested));
  }
  return points;
}

// Only follows a product's own offers, so reviews or related products on the
// same page can never contribute a price.
function ownPoints(product: Node): PricePoint[] {
  return asNodes(product.offers).flatMap(offerPoints);
}

function cheapest(points: PricePoint[]): PricePoint | null {
  return points.reduce<PricePoint | null>(
    (best, point) => (best === null || point.price < best.price ? point : best),
    null
  );
}

// A variant is the linked one when its URL has the page's path and every
// query parameter of the variant URL is also on the page URL.
function variantMatches(variant: Node, page: URL): boolean {
  const candidates = [
    variant.url,
    variant["@id"],
    ...asNodes(variant.offers).map((offer) => offer.url),
  ].filter((value): value is string => typeof value === "string");

  return candidates.some((candidate) => {
    try {
      const url = new URL(candidate, page);
      return (
        url.origin === page.origin &&
        url.pathname === page.pathname &&
        [...url.searchParams].every(
          ([key, value]) => page.searchParams.get(key) === value
        )
      );
    } catch {
      return false;
    }
  });
}

// "… 50 ml 50 ml" becomes "… 50 ml".
function collapseRepeatedSuffix(name: string): string {
  const words = name.split(" ");
  for (let size = Math.floor(words.length / 2); size >= 1; size--) {
    const tail = words.slice(-size).join(" ");
    const before = words.slice(-2 * size, -size).join(" ");
    if (tail === before) return words.slice(0, -size).join(" ");
  }
  return name;
}

type Found = {
  name: string | null;
  price: number | null;
  currency: string | null;
  ambiguous: boolean;
};

// For a product group the price is that of the variant the URL points at. If
// the URL does not single one out and the variants cost different amounts,
// no price is better than the wrong size's price.
function resolveProduct(product: Node, page: URL | null): Found {
  const groupName = cleanText(product.name);
  const own = cheapest(ownPoints(product));
  const variants = asNodes(product.hasVariant);
  if (own !== null || variants.length === 0) {
    return {
      name: groupName,
      price: own?.price ?? null,
      currency: own?.currency ?? null,
      ambiguous: false,
    };
  }

  const matched = page ? variants.filter((v) => variantMatches(v, page)) : [];
  const pool = matched.length > 0 ? matched : variants;
  const priced = pool
    .map((variant) => cheapest(ownPoints(variant)))
    .filter((point): point is PricePoint => point !== null);
  const distinct = new Set(priced.map((point) => point.price));

  let name = groupName;
  if (matched.length === 1) {
    const variantName = cleanText(matched[0].name);
    const collapsed = variantName ? collapseRepeatedSuffix(variantName) : null;
    if (
      collapsed &&
      groupName &&
      collapsed.startsWith(groupName) &&
      collapsed.length > groupName.length
    ) {
      name = collapsed;
    }
  }

  return {
    name,
    price: distinct.size === 1 ? priced[0].price : null,
    currency: distinct.size === 1 ? priced[0].currency : null,
    ambiguous: distinct.size > 1,
  };
}

function fromJsonLd(html: ReturnType<typeof load>, page: URL | null): Found | null {
  const products: Node[] = [];
  html('script[type="application/ld+json"]').each((_, element) => {
    try {
      products.push(...findProducts(JSON.parse(html(element).text().trim())));
    } catch {
      // Malformed JSON-LD blocks are common; skip them.
    }
  });

  // The first named product is the page's product; later ones are never a
  // fallback, since they are usually related items with unrelated prices.
  const product = products.find((p) => cleanText(p.name) !== null);
  return product ? resolveProduct(product, page) : null;
}

function fromOpenGraph(html: ReturnType<typeof load>): Omit<Found, "ambiguous"> | null {
  const meta = (property: string): string | null => {
    const value = html(`meta[property="${property}"], meta[name="${property}"]`)
      .first()
      .attr("content");
    return value === undefined ? null : value;
  };

  const price = parsePrice(
    meta("product:price:amount") ?? meta("og:price:amount")
  );
  const currency = (
    meta("product:price:currency") ?? meta("og:price:currency")
  )?.toUpperCase();
  const type = meta("og:type") ?? "";
  const isProduct = /product/i.test(type) || price !== null;
  const name = cleanText(meta("og:title"));

  if (!isProduct) return null;
  return { name, price, currency: currency ?? null };
}

function toUrl(value: string | undefined): URL | null {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

export function parseProduct(htmlText: string, pageUrl?: string): ProductInfo {
  const html = load(htmlText);
  const jsonLd = fromJsonLd(html, toUrl(pageUrl));
  const openGraph = fromOpenGraph(html);

  // Open Graph carries one price for the whole page, so it must not fill in
  // a price that JSON-LD found to be ambiguous between variants.
  const openGraphPrice = jsonLd?.ambiguous ? null : openGraph;
  const price = jsonLd?.price ?? openGraphPrice?.price ?? null;
  const currency =
    jsonLd?.price != null ? jsonLd.currency : (openGraphPrice?.currency ?? null);
  const name = jsonLd?.name ?? openGraph?.name ?? null;

  const usedJsonLd = jsonLd !== null && (jsonLd.name !== null || jsonLd.price !== null);
  const usedOpenGraph = !usedJsonLd && (name !== null || price !== null);

  return {
    name,
    price,
    currency,
    source: usedJsonLd ? "jsonld" : usedOpenGraph ? "opengraph" : null,
  };
}
