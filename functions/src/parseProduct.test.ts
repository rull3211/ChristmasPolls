import assert from "node:assert/strict";
import test from "node:test";
import { parsePrice, parseProduct } from "./parseProduct.js";

const page = (head: string) => `<html><head>${head}</head><body></body></html>`;
const jsonLd = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

test("parsePrice handles Norwegian, English and machine formats", () => {
  const cases: [unknown, number | null][] = [
    [1499, 1499],
    ["598.0", 598],
    ["1665.00", 1665],
    ["1 299,00", 1299],
    ["1 299,00", 1299],
    ["1.299,00", 1299],
    ["1,299.00", 1299],
    ["1.299", 1299],
    ["12.50", 12.5],
    ["12,5", 12.5],
    ["kr 349,-", 349],
    ["1.299.000", 1299000],
    ["0", null],
    [0, null],
    [-5, null],
    ["", null],
    ["gratis", null],
    [null, null],
    [undefined, null],
    [NaN, null],
  ];
  for (const [input, expected] of cases) {
    assert.equal(parsePrice(input), expected, JSON.stringify(input));
  }
});

test("reads a plain JSON-LD product", () => {
  const info = parseProduct(
    page(
      jsonLd({
        "@type": "Product",
        name: "JBL Flip 7",
        offers: { "@type": "Offer", price: "1490.0", priceCurrency: "NOK" },
      })
    )
  );
  assert.deepEqual(info, {
    name: "JBL Flip 7",
    price: 1490,
    currency: "NOK",
    source: "jsonld",
  });
});

test("finds the product inside @graph and a schema.org type URL", () => {
  const info = parseProduct(
    page(
      jsonLd({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", name: "Shop" },
          {
            "@type": "https://schema.org/Product",
            name: "Brødform",
            offers: { price: 259, priceCurrency: "nok" },
          },
        ],
      })
    )
  );
  assert.equal(info.name, "Brødform");
  assert.equal(info.price, 259);
  assert.equal(info.currency, "NOK");
});

test("takes the lowest price from several offers and from AggregateOffer", () => {
  const many = parseProduct(
    page(
      jsonLd({
        "@type": "Product",
        name: "X",
        offers: [
          { price: 1200, priceCurrency: "NOK" },
          { price: 999, priceCurrency: "NOK" },
        ],
      })
    )
  );
  assert.equal(many.price, 999);

  const aggregate = parseProduct(
    page(
      jsonLd({
        "@type": "Product",
        name: "X",
        offers: { "@type": "AggregateOffer", lowPrice: "499", highPrice: "799", priceCurrency: "NOK" },
      })
    )
  );
  assert.equal(aggregate.price, 499);
});

const perfumeGroup = (extra: Record<string, unknown> = {}) =>
  jsonLd({
    "@type": "ProductGroup",
    name: "Libre EdP 50 ml",
    hasVariant: [
      {
        "@type": "Product",
        name: "Libre EdP 50 ml 50 ml",
        url: "https://shop.no/libre-edp-50-ml",
        offers: [{ "@type": "Offer", price: "1119.00", priceCurrency: "NOK", url: "/libre-edp-50-ml" }],
      },
      {
        "@type": "Product",
        name: "Libre EdP 30 ml",
        url: "https://shop.no/libre-edp-30-ml",
        offers: [{ "@type": "Offer", price: "779.00", priceCurrency: "NOK", url: "/libre-edp-30-ml" }],
      },
      {
        "@type": "Product",
        name: "Libre EdP 90 ml",
        url: "https://shop.no/libre-edp-90-ml",
        offers: [{ "@type": "Offer", price: "1509.00", priceCurrency: "NOK", url: "/libre-edp-90-ml" }],
      },
    ],
    ...extra,
  });

test("a product group takes the price of the variant whose URL was linked", () => {
  const fifty = parseProduct(page(perfumeGroup()), "https://shop.no/libre-edp-50-ml?utm_source=x");
  assert.equal(fifty.price, 1119);
  assert.equal(fifty.name, "Libre EdP 50 ml");

  const thirty = parseProduct(page(perfumeGroup()), "https://shop.no/libre-edp-30-ml");
  assert.equal(thirty.price, 779);
});

test("a product group never guesses between differently priced variants", () => {
  const noUrl = parseProduct(page(perfumeGroup()));
  assert.equal(noUrl.name, "Libre EdP 50 ml");
  assert.equal(noUrl.price, null);

  const otherPage = parseProduct(page(perfumeGroup()), "https://shop.no/something-else");
  assert.equal(otherPage.price, null);
});

test("ambiguous variant prices are not filled in from Open Graph", () => {
  const info = parseProduct(
    page(
      perfumeGroup() +
        `<meta property="product:price:amount" content="779"><meta property="product:price:currency" content="NOK">`
    ),
    "https://shop.no/something-else"
  );
  assert.equal(info.price, null);
  assert.equal(info.name, "Libre EdP 50 ml");
});

test("a size in the query string selects the variant, with its size in the name", () => {
  const html = page(
    jsonLd({
      "@type": "ProductGroup",
      name: "Spicebomb Extreme EdP",
      hasVariant: [
        {
          "@type": "Product",
          name: "Spicebomb Extreme EdP - 90-ml",
          url: "https://shop.no/spicebomb/?attribute_pa_storrelse=90-ml",
          offers: [{ url: "https://shop.no/spicebomb/?attribute_pa_storrelse=90-ml", priceSpecification: { price: "1665.00", priceCurrency: "NOK" } }],
        },
        {
          "@type": "Product",
          name: "Spicebomb Extreme EdP - 50-ml",
          url: "https://shop.no/spicebomb/?attribute_pa_storrelse=50-ml",
          offers: [{ url: "https://shop.no/spicebomb/?attribute_pa_storrelse=50-ml", priceSpecification: { price: "1215.00", priceCurrency: "NOK" } }],
        },
      ],
    })
  );

  const fifty = parseProduct(html, "https://shop.no/spicebomb/?attribute_pa_storrelse=50-ml&gclid=abc");
  assert.equal(fifty.price, 1215);
  assert.equal(fifty.name, "Spicebomb Extreme EdP - 50-ml");

  const noSize = parseProduct(html, "https://shop.no/spicebomb/");
  assert.equal(noSize.price, null);
  assert.equal(noSize.name, "Spicebomb Extreme EdP");
});

test("variants that all cost the same give that price", () => {
  const info = parseProduct(
    page(
      jsonLd({
        "@type": "ProductGroup",
        name: "T-skjorte",
        hasVariant: [
          { "@type": "Product", name: "T-skjorte S", offers: { price: 250, priceCurrency: "NOK" } },
          { "@type": "Product", name: "T-skjorte L", offers: { price: 250, priceCurrency: "NOK" } },
        ],
      })
    )
  );
  assert.equal(info.name, "T-skjorte");
  assert.equal(info.price, 250);
});

test("ignores list prices in a price specification", () => {
  const info = parseProduct(
    page(
      jsonLd({
        "@type": "Product",
        name: "X",
        offers: {
          priceSpecification: [
            { price: 1999, priceCurrency: "NOK", priceType: "https://schema.org/ListPrice" },
            { price: 1499, priceCurrency: "NOK" },
          ],
        },
      })
    )
  );
  assert.equal(info.price, 1499);
});

test("related products never replace the page's product", () => {
  const info = parseProduct(
    page(
      jsonLd({
        "@type": "Product",
        name: "Main",
        isRelatedTo: [{ "@type": "Product", name: "Related", offers: { price: 5, priceCurrency: "NOK" } }],
        offers: { price: 700, priceCurrency: "NOK" },
      }) +
        jsonLd({
          "@type": "ItemList",
          itemListElement: [{ "@type": "Product", name: "Other", offers: { price: 1, priceCurrency: "NOK" } }],
        })
    )
  );
  assert.equal(info.name, "Main");
  assert.equal(info.price, 700);
});

test("a main product without a price does not borrow a later product's price", () => {
  const info = parseProduct(
    page(
      jsonLd({ "@type": "Product", name: "Sold out thing" }) +
        jsonLd({ "@type": "Product", name: "Another", offers: { price: 10, priceCurrency: "NOK" } })
    )
  );
  assert.equal(info.name, "Sold out thing");
  assert.equal(info.price, null);
});

test("skips malformed JSON-LD blocks and keeps reading", () => {
  const info = parseProduct(
    page(
      `<script type="application/ld+json">{ not json</script>` +
        jsonLd({ "@type": "Product", name: "Fine", offers: { price: 10, priceCurrency: "NOK" } })
    )
  );
  assert.equal(info.name, "Fine");
});

test("decodes HTML entities and collapses whitespace in names", () => {
  const info = parseProduct(
    page(jsonLd({ "@type": "Product", name: "  Tom &amp;  Jerry &#39;s\n set  " }))
  );
  assert.equal(info.name, "Tom & Jerry 's set");
});

test("falls back to Open Graph product tags", () => {
  const info = parseProduct(
    page(`
      <meta property="og:type" content="product">
      <meta property="og:title" content="Glass 4 stk">
      <meta property="product:price:amount" content="1 140,00">
      <meta property="product:price:currency" content="nok">`)
  );
  assert.deepEqual(info, {
    name: "Glass 4 stk",
    price: 1140,
    currency: "NOK",
    source: "opengraph",
  });
});

test("Open Graph on a non-product page is ignored", () => {
  const info = parseProduct(
    page(`<meta property="og:type" content="website"><meta property="og:title" content="Shop home">`)
  );
  assert.deepEqual(info, { name: null, price: null, currency: null, source: null });
});

test("a bot-challenge page yields nothing", () => {
  const info = parseProduct(
    "<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>"
  );
  assert.equal(info.source, null);
  assert.equal(info.name, null);
});

test("JSON-LD name with Open Graph price combines both", () => {
  const info = parseProduct(
    page(
      jsonLd({ "@type": "Product", name: "Named" }) +
        `<meta property="product:price:amount" content="250"><meta property="product:price:currency" content="NOK">`
    )
  );
  assert.equal(info.name, "Named");
  assert.equal(info.price, 250);
  assert.equal(info.currency, "NOK");
});
