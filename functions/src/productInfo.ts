import { isIP } from "node:net";
import {
  FetchError,
  fetchHtml,
  type FetchFailure,
  type FetchOptions,
} from "./safeFetch.js";
import { parseProduct, type ProductInfo } from "./parseProduct.js";

export type ProductLookup = ProductInfo & {
  finalUrl: string | null;
  reason: FetchFailure | null;
};

const MAX_URL_LENGTH = 2000;

export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH || /\s/.test(trimmed)) {
    return null;
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") && isIP(host) === 0) return null;
  return url.toString();
}

const EMPTY: ProductInfo = { name: null, price: null, currency: null, source: null };

export async function getProductInfo(
  rawUrl: string,
  fetchOptions?: FetchOptions
): Promise<ProductLookup> {
  const url = normalizeUrl(rawUrl);
  if (url === null) {
    return { ...EMPTY, finalUrl: null, reason: "invalid_url" };
  }

  try {
    const { html, finalUrl } = await fetchHtml(url, fetchOptions);
    return { ...parseProduct(html, finalUrl), finalUrl, reason: null };
  } catch (error) {
    const reason = error instanceof FetchError ? error.reason : "network_error";
    return { ...EMPTY, finalUrl: null, reason };
  }
}
