import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";
import { isPublicAddress } from "./addresses.js";
import { getProductInfo, normalizeUrl } from "./productInfo.js";

test("normalizeUrl adds https and trims", () => {
  assert.equal(normalizeUrl("www.power.no/produkt/1"), "https://www.power.no/produkt/1");
  assert.equal(normalizeUrl("  https://kicks.no/a?b=1  "), "https://kicks.no/a?b=1");
  assert.equal(normalizeUrl("http://example.com"), "http://example.com/");
});

test("normalizeUrl rejects things that are not shop links", () => {
  for (const input of [
    "",
    "   ",
    "Jj",
    "http://localhost",
    "http://localhost:3000/x",
    "ftp://example.com/file",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://exa mple.com",
    "two words",
    `https://example.com/${"a".repeat(2100)}`,
  ]) {
    assert.equal(normalizeUrl(input), null, input);
  }
});

let server: http.Server;
let port: number;

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/product") {
      res.setHeader("content-type", "text/html");
      res.end(`<script type="application/ld+json">${JSON.stringify({
        "@type": "Product",
        name: "Testprodukt",
        offers: { price: "1 299,00", priceCurrency: "NOK" },
      })}</script>`);
    } else {
      res.statusCode = 403;
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

const local = () => ({
  isAllowedAddress: (address: string) =>
    address === "127.0.0.1" || isPublicAddress(address),
  allowedPorts: [port],
});

test("getProductInfo returns name, price and no failure reason", async () => {
  const info = await getProductInfo(`http://127.0.0.1:${port}/product`, local());
  assert.deepEqual(info, {
    name: "Testprodukt",
    price: 1299,
    currency: "NOK",
    source: "jsonld",
    finalUrl: `http://127.0.0.1:${port}/product`,
    reason: null,
  });
});

test("getProductInfo reports why nothing was found instead of throwing", async () => {
  const blocked = await getProductInfo(`http://127.0.0.1:${port}/other`, local());
  assert.equal(blocked.reason, "http_error");
  assert.equal(blocked.name, null);
  assert.equal(blocked.price, null);

  assert.equal((await getProductInfo("Jj")).reason, "invalid_url");
  assert.equal((await getProductInfo("http://169.254.169.254/")).reason, "blocked_address");
});
