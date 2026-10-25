/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { parsePrefill } from "../addWish/prefill.ts";
import { buildBookmarklet } from "./buildBookmarklet.ts";

const extractorSource = readFileSync(
  new URL("./pageExtractor.js", import.meta.url),
  "utf8"
);
const APP = "https://christmaspolls.web.app";
const hashOf = (url: string) => new URL(url).hash;

// Runs the bookmarklet exactly as a browser would, on a fake product page.
function clickBookmarklet(ld: unknown[], href: string, meta: Record<string, string> = {}) {
  const bookmarklet = buildBookmarklet(extractorSource, APP);
  assert.ok(bookmarklet.startsWith("javascript:"));
  const code = decodeURIComponent(bookmarklet.slice("javascript:".length));

  const opened: string[] = [];
  const document = {
    querySelectorAll(selector: string) {
      if (selector === 'script[type="application/ld+json"]') {
        return ld.map((block) => ({ textContent: JSON.stringify(block) }));
      }
      if (selector === "meta") {
        return Object.entries(meta).map(([key, content]) => ({
          getAttribute: (a: string) => (a === "property" ? key : a === "content" ? content : null),
        }));
      }
      return [];
    },
    querySelector: () => null,
  };
  vm.runInNewContext(code, {
    document,
    location: { href },
    window: { open: (url: string) => opened.push(url) },
    URL,
    JSON,
    encodeURIComponent,
  });
  return opened;
}

test("the bookmarklet opens the app with the page's data, and the app can read it", () => {
  const opened = clickBookmarklet(
    [{ "@type": "Product", name: "Iskremmaskin sølv", offers: { price: "1 590,00", priceCurrency: "NOK" } }],
    "https://www.elkjop.no/product/911705?utm_source=fb"
  );
  assert.equal(opened.length, 1);
  assert.ok(opened[0].startsWith(`${APP}/#add=`));
  assert.deepEqual(parsePrefill(hashOf(opened[0])), {
    link: "https://www.elkjop.no/product/911705?utm_source=fb",
    name: "Iskremmaskin sølv",
    price: "1590",
  });
});

test("a page without product data still opens the app with the link", () => {
  const opened = clickBookmarklet([], "https://www.zalando.no/some-bag.html");
  assert.equal(opened.length, 1);
  assert.deepEqual(parsePrefill(hashOf(opened[0])), {
    link: "https://www.zalando.no/some-bag.html",
    name: "",
    price: "",
  });
});

test("the right size is picked on a product group page", () => {
  const group = {
    "@type": "ProductGroup",
    name: "Libre EdP 50 ml",
    hasVariant: [
      { "@type": "Product", name: "Libre EdP 50 ml", url: "https://www.kicks.no/libre-50", offers: [{ price: "1119", priceCurrency: "NOK" }] },
      { "@type": "Product", name: "Libre EdP 30 ml", url: "https://www.kicks.no/libre-30", offers: [{ price: "779", priceCurrency: "NOK" }] },
    ],
  };
  const opened = clickBookmarklet([group], "https://www.kicks.no/libre-50");
  assert.equal(parsePrefill(hashOf(opened[0]))?.price, "1119");
});

test("a shop name with quotes or markup cannot break out of the payload", () => {
  const opened = clickBookmarklet(
    [{ "@type": "Product", name: `"</script><b>'x'`, offers: { price: 5, priceCurrency: "NOK" } }],
    "https://a.no/p"
  );
  assert.equal(parsePrefill(hashOf(opened[0]))?.name, `"</script><b>'x'`);
});

test("the emulator origin works too", () => {
  const code = decodeURIComponent(buildBookmarklet(extractorSource, "http://localhost:5174").slice("javascript:".length));
  assert.ok(code.includes('"http://localhost:5174"'));
});
