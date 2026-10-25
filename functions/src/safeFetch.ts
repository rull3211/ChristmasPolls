import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import type { Readable } from "node:stream";
import zlib from "node:zlib";
import { isPublicAddress } from "./addresses.js";

export type FetchFailure =
  | "invalid_url"
  | "blocked_address"
  | "too_many_redirects"
  | "timeout"
  | "http_error"
  | "not_html"
  | "too_large"
  | "network_error";

export class FetchError extends Error {
  constructor(
    readonly reason: FetchFailure,
    message?: string
  ) {
    super(message ?? reason);
  }
}

export interface FetchOptions {
  isAllowedAddress?: (address: string) => boolean;
  allowedPorts?: number[];
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
}

const DEFAULTS = {
  isAllowedAddress: isPublicAddress,
  allowedPorts: [80, 443],
  maxBytes: 2_000_000,
  timeoutMs: 10_000,
  maxRedirects: 5,
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function parseUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new FetchError("invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchError("invalid_url");
  }
  return url;
}

function portOf(url: URL): number {
  if (url.port) return Number(url.port);
  return url.protocol === "https:" ? 443 : 80;
}

// IP literals skip DNS, so they never reach the guarded lookup below.
function assertAllowed(url: URL, options: Required<FetchOptions>): void {
  if (!options.allowedPorts.includes(portOf(url))) {
    throw new FetchError("blocked_address", "port not allowed");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0 && !options.isAllowedAddress(host)) {
    throw new FetchError("blocked_address");
  }
}

// Validating inside lookup means the address that is checked is the address
// that is connected to, so DNS rebinding cannot swap it afterwards.
function guardedLookup(isAllowed: (address: string) => boolean): LookupFunction {
  return (hostname, lookupOptions, callback) => {
    dns.lookup(hostname, lookupOptions, (error, address, family) => {
      if (error) {
        callback(error, address as string, family as number);
        return;
      }
      const resolved = Array.isArray(address)
        ? address.map((entry) => entry.address)
        : [address];
      if (resolved.length === 0 || !resolved.every(isAllowed)) {
        callback(
          new FetchError("blocked_address") as unknown as NodeJS.ErrnoException,
          "",
          4
        );
        return;
      }
      callback(null, address as string, family as number);
    });
  };
}

function decompress(res: http.IncomingMessage): Readable {
  switch (res.headers["content-encoding"]) {
    case "gzip":
      return res.pipe(zlib.createGunzip());
    case "deflate":
      return res.pipe(zlib.createInflate());
    case "br":
      return res.pipe(zlib.createBrotliDecompress());
    default:
      return res;
  }
}

function decode(body: Buffer, contentType: string | undefined): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  const head = body.subarray(0, 4096).toString("latin1");
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  for (const label of [fromHeader, fromMeta, "utf-8"]) {
    if (!label) continue;
    try {
      return new TextDecoder(label).decode(body);
    } catch {
      continue;
    }
  }
  return body.toString("utf-8");
}

type RawResponse = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
};

function requestOnce(
  url: URL,
  options: Required<FetchOptions>,
  deadline: number
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(new FetchError("timeout"));
      return;
    }

    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup(options.isAllowedAddress),
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "nb-NO,nb;q=0.9,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, headers: res.headers, body: Buffer.alloc(0) });
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new FetchError("http_error", `HTTP ${status}`));
          return;
        }
        if (!/html|xml/i.test(res.headers["content-type"] ?? "")) {
          req.destroy();
          reject(new FetchError("not_html"));
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        const stream = decompress(res);
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > options.maxBytes) {
            req.destroy();
            reject(new FetchError("too_large"));
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () =>
          resolve({ status, headers: res.headers, body: Buffer.concat(chunks) })
        );
        stream.on("error", () => reject(new FetchError("network_error")));
      }
    );

    const timer = setTimeout(() => {
      req.destroy();
      reject(new FetchError("timeout"));
    }, remaining);
    req.on("close", () => clearTimeout(timer));
    req.on("error", (error) =>
      reject(
        error instanceof FetchError
          ? error
          : new FetchError("network_error", error.message)
      )
    );
    req.end();
  });
}

export async function fetchHtml(
  startUrl: string,
  overrides: FetchOptions = {}
): Promise<{ html: string; finalUrl: string }> {
  const options: Required<FetchOptions> = { ...DEFAULTS, ...overrides };
  const deadline = Date.now() + options.timeoutMs;
  let url = parseUrl(startUrl);

  for (let hop = 0; hop <= options.maxRedirects; hop++) {
    assertAllowed(url, options);
    const response = await requestOnce(url, options, deadline);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location;
      if (!location) throw new FetchError("http_error", "redirect without location");
      url = parseUrl(new URL(location, url).toString());
      continue;
    }
    return {
      html: decode(response.body, response.headers["content-type"]),
      finalUrl: url.toString(),
    };
  }
  throw new FetchError("too_many_redirects");
}
