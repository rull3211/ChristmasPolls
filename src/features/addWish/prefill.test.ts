/// <reference types="node" />
import assert from "node:assert/strict";
import test from "node:test";
import { parsePrefill } from "./prefill.ts";

const hash = (data: unknown) =>
  `#add=${encodeURIComponent(JSON.stringify(data))}`;

test("reads link, name and a krone price", () => {
  assert.deepEqual(
    parsePrefill(hash({ u: "https://www.elkjop.no/product/1", n: "Iskremmaskin", p: 1590, c: "NOK" })),
    { link: "https://www.elkjop.no/product/1", name: "Iskremmaskin", price: "1590" }
  );
});

test("a missing currency counts as kroner, another currency leaves the price blank", () => {
  assert.equal(parsePrefill(hash({ u: "https://a.no/x", n: "X", p: 99.5 }))?.price, "99.5");
  assert.equal(parsePrefill(hash({ u: "https://a.no/x", n: "X", p: 99, c: "EUR" }))?.price, "");
});

test("prices that are not positive numbers are ignored", () => {
  for (const p of [0, -5, "1590", null, NaN, Infinity]) {
    assert.equal(parsePrefill(hash({ u: "https://a.no/x", n: "X", p }))?.price, "", String(p));
  }
});

test("name is cleaned and capped", () => {
  assert.equal(parsePrefill(hash({ u: "https://a.no/x", n: "  Glass \n 4  stk " }))?.name, "Glass 4 stk");
  assert.equal(parsePrefill(hash({ u: "https://a.no/x", n: "x".repeat(500) }))?.name.length, 200);
  assert.equal(parsePrefill(hash({ u: "https://a.no/x", n: 42 }))?.name, "");
});

test("a link is required and must be a normal web link", () => {
  for (const u of [undefined, 42, "", "Jj", "javascript:alert(1)", "file:///etc/passwd", "http://localhost/x"]) {
    assert.equal(parsePrefill(hash({ u, n: "X", p: 1 })), null, String(u));
  }
  assert.equal(parsePrefill(hash({ u: "www.kicks.no/a", n: "X" }))?.link, "https://www.kicks.no/a");
});

test("anything that is not a bookmarklet payload is ignored", () => {
  for (const value of ["", "#", "#other=1", "#add=", "#add=%E0%A4%A", "#add=not-json", `#add=${encodeURIComponent("null")}`, `#add=${encodeURIComponent("42")}`]) {
    assert.equal(parsePrefill(value), null, value);
  }
});
