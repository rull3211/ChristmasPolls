import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./pageExtractor.js", import.meta.url), "utf8");
const extractFromPage = new Function(`${source}; return extractFromPage;`)();

function page({ ld = [], meta = {}, heading = null, itemprop = null, href = "https://shop.no/produkt" } = {}) {
  const doc = {
    querySelectorAll(selector) {
      if (selector === 'script[type="application/ld+json"]') {
        return ld.map((block) => ({ textContent: typeof block === "string" ? block : JSON.stringify(block) }));
      }
      if (selector === "meta") {
        return Object.entries(meta).map(([key, content]) => ({
          getAttribute: (attribute) => (attribute === "property" ? key : attribute === "content" ? content : null),
        }));
      }
      return [];
    },
    querySelector(selector) {
      if (selector === "h1") return heading === null ? null : { textContent: heading };
      if (selector === '[itemprop="price"]') {
        return itemprop === null
          ? null
          : { getAttribute: (attribute) => (attribute === "content" ? (itemprop.content ?? null) : null), textContent: itemprop.text ?? "" };
      }
      return null;
    },
  };
  return extractFromPage(doc, { href });
}

const product = (extra) => ({ "@type": "Product", name: "Lenco LS-10 platespiller", offers: { "@type": "Offer", price: "1 499,00", priceCurrency: "nok" }, ...extra });

test("reads a JSON-LD product with a Norwegian-formatted price", () => {
  assert.deepEqual(page({ ld: [product()] }), { name: "Lenco LS-10 platespiller", price: 1499, currency: "NOK" });
});

test("finds the product inside @graph and decodes entities", () => {
  const result = page({ ld: [{ "@graph": [{ "@type": "WebSite", name: "Shop" }, product({ name: "Tom &amp; Jerry" })] }] });
  assert.equal(result.name, "Tom & Jerry");
  assert.equal(result.price, 1499);
});

test("lowest of several offers, and list prices are ignored", () => {
  const offers = [{ price: 1200, priceCurrency: "NOK" }, { priceSpecification: [{ price: 5000, priceType: "https://schema.org/ListPrice" }, { price: 999, priceCurrency: "NOK" }] }];
  assert.equal(page({ ld: [product({ offers })] }).price, 999);
});

test("a product group takes the variant whose URL is the current page", () => {
  const group = {
    "@type": "ProductGroup",
    name: "Libre EdP 50 ml",
    hasVariant: [
      { "@type": "Product", name: "Libre EdP 50 ml 50 ml", url: "https://shop.no/libre-50", offers: [{ price: "1119", priceCurrency: "NOK" }] },
      { "@type": "Product", name: "Libre EdP 30 ml", url: "https://shop.no/libre-30", offers: [{ price: "779", priceCurrency: "NOK" }] },
    ],
  };
  assert.deepEqual(page({ ld: [group], href: "https://shop.no/libre-50?utm=x" }), { name: "Libre EdP 50 ml", price: 1119, currency: "NOK" });
  assert.equal(page({ ld: [group], href: "https://shop.no/libre-30" }).price, 779);
});

test("a size in the query string selects the variant and shows in the name", () => {
  const group = {
    "@type": "ProductGroup",
    name: "Spicebomb",
    hasVariant: [
      { "@type": "Product", name: "Spicebomb - 90-ml", url: "https://shop.no/s/?size=90", offers: [{ priceSpecification: { price: "1665", priceCurrency: "NOK" } }] },
      { "@type": "Product", name: "Spicebomb - 50-ml", url: "https://shop.no/s/?size=50", offers: [{ priceSpecification: { price: "1215", priceCurrency: "NOK" } }] },
    ],
  };
  const result = page({ ld: [group], href: "https://shop.no/s/?size=50&gclid=1" });
  assert.deepEqual(result, { name: "Spicebomb - 50-ml", price: 1215, currency: "NOK" });
});

test("ambiguous variants give no price, not even from meta tags", () => {
  const group = {
    "@type": "ProductGroup",
    name: "Spicebomb",
    hasVariant: [
      { "@type": "Product", name: "A", url: "https://shop.no/s/?size=90", offers: [{ price: "1665", priceCurrency: "NOK" }] },
      { "@type": "Product", name: "B", url: "https://shop.no/s/?size=50", offers: [{ price: "1215", priceCurrency: "NOK" }] },
    ],
  };
  const result = page({ ld: [group], meta: { "product:price:amount": "1215" }, itemprop: { content: "1215" }, href: "https://shop.no/s/" });
  assert.equal(result.name, "Spicebomb");
  assert.equal(result.price, null);
});

test("related products never replace the page's product", () => {
  const main = product({ isRelatedTo: [{ "@type": "Product", name: "Related", offers: { price: 5 } }] });
  const result = page({ ld: [main, { "@type": "ItemList", itemListElement: [{ "@type": "Product", name: "Other", offers: { price: 1 } }] }] });
  assert.equal(result.name, "Lenco LS-10 platespiller");
  assert.equal(result.price, 1499);
});

test("falls back to Open Graph, then microdata price, then the heading", () => {
  assert.deepEqual(
    page({ meta: { "og:title": "Glass 4 stk", "product:price:amount": "1140", "product:price:currency": "nok" } }),
    { name: "Glass 4 stk", price: 1140, currency: "NOK" }
  );
  const rendered = page({ heading: "  Glass   4 stk ", itemprop: { text: "570,-" } });
  assert.equal(rendered.name, "Glass 4 stk");
  assert.equal(rendered.price, 570);
});

test("malformed JSON-LD is skipped and an empty page gives nulls", () => {
  assert.equal(page({ ld: ["{ not json", product()] }).price, 1499);
  assert.deepEqual(page({}), { name: null, price: null, currency: null });
});
