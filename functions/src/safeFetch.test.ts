import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";
import zlib from "node:zlib";
import { isPublicAddress } from "./addresses.js";
import { FetchError, fetchHtml, type FetchFailure } from "./safeFetch.js";

const HTML = "<html><body>hello</body></html>";
let server: http.Server;
let port: number;

before(async () => {
  server = http.createServer((req, res) => {
    switch (req.url) {
      case "/ok":
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.end(HTML);
        break;
      case "/latin1":
        res.setHeader("content-type", "text/html; charset=iso-8859-1");
        res.end(Buffer.from("<p>Brødform</p>", "latin1"));
        break;
      case "/gzip":
        res.setHeader("content-type", "text/html");
        res.setHeader("content-encoding", "gzip");
        res.end(zlib.gzipSync(HTML));
        break;
      case "/redirect-ok":
        res.statusCode = 302;
        res.setHeader("location", "/ok");
        res.end();
        break;
      case "/redirect-private":
        res.statusCode = 302;
        res.setHeader("location", "http://169.254.169.254/latest/meta-data/");
        res.end();
        break;
      case "/redirect-loop":
        res.statusCode = 302;
        res.setHeader("location", "/redirect-loop");
        res.end();
        break;
      case "/big":
        res.setHeader("content-type", "text/html");
        res.write("x".repeat(500_000));
        res.write("x".repeat(500_000));
        res.end("x".repeat(500_000));
        break;
      case "/bomb":
        res.setHeader("content-type", "text/html");
        res.setHeader("content-encoding", "gzip");
        res.end(zlib.gzipSync("a".repeat(5_000_000)));
        break;
      case "/json":
        res.setHeader("content-type", "application/json");
        res.end("{}");
        break;
      case "/forbidden":
        res.statusCode = 403;
        res.end("no");
        break;
      case "/hang":
        break;
      default:
        res.statusCode = 404;
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

// Lets the tests reach the local server while keeping every other private
// address blocked, exactly as in production.
const local = () => ({
  isAllowedAddress: (address: string) =>
    address === "127.0.0.1" || isPublicAddress(address),
  allowedPorts: [port],
});

async function reasonOf(promise: Promise<unknown>): Promise<FetchFailure | "ok"> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    assert.ok(error instanceof FetchError, `unexpected error: ${error}`);
    return error.reason;
  }
}

test("fetches a page and follows a redirect", async () => {
  const direct = await fetchHtml(`http://127.0.0.1:${port}/ok`, local());
  assert.equal(direct.html, HTML);
  const redirected = await fetchHtml(`http://127.0.0.1:${port}/redirect-ok`, local());
  assert.equal(redirected.html, HTML);
  assert.equal(redirected.finalUrl, `http://127.0.0.1:${port}/ok`);
});

test("decompresses gzip and decodes the declared charset", async () => {
  assert.equal((await fetchHtml(`http://127.0.0.1:${port}/gzip`, local())).html, HTML);
  assert.equal(
    (await fetchHtml(`http://127.0.0.1:${port}/latin1`, local())).html,
    "<p>Brødform</p>"
  );
});

test("default options refuse loopback even on a normal port", async () => {
  assert.equal(await reasonOf(fetchHtml(`http://127.0.0.1:${port}/ok`)), "blocked_address");
  assert.equal(await reasonOf(fetchHtml("http://127.0.0.1/")), "blocked_address");
});

test("refuses private and metadata IP literals in every spelling", async () => {
  for (const url of [
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://2130706433/",
    "http://0x7f.0.0.1/",
    "http://0177.0.0.1/",
    "http://127.1/",
    "http://10.0.0.5/",
    "https://192.168.0.1/",
  ]) {
    assert.equal(await reasonOf(fetchHtml(url)), "blocked_address", url);
  }
});

test("refuses a hostname that resolves to a private address", async () => {
  const reason = await reasonOf(fetchHtml(`http://localhost:${port}/ok`, {
    allowedPorts: [port],
  }));
  assert.equal(reason, "blocked_address");
});

test("refuses a redirect into a private address", async () => {
  const reason = await reasonOf(fetchHtml(`http://127.0.0.1:${port}/redirect-private`, local()));
  assert.equal(reason, "blocked_address");
});

test("refuses unusual ports and non-http schemes", async () => {
  assert.equal(await reasonOf(fetchHtml("http://example.com:22/")), "blocked_address");
  for (const url of ["file:///etc/passwd", "ftp://example.com/", "gopher://example.com/", "not a url"]) {
    assert.equal(await reasonOf(fetchHtml(url)), "invalid_url", url);
  }
});

test("gives up on redirect loops", async () => {
  const reason = await reasonOf(fetchHtml(`http://127.0.0.1:${port}/redirect-loop`, local()));
  assert.equal(reason, "too_many_redirects");
});

test("stops reading oversized pages, including decompression bombs", async () => {
  const options = { ...local(), maxBytes: 1_000_000 };
  assert.equal(await reasonOf(fetchHtml(`http://127.0.0.1:${port}/big`, options)), "too_large");
  assert.equal(await reasonOf(fetchHtml(`http://127.0.0.1:${port}/bomb`, options)), "too_large");
});

test("rejects non-HTML content and HTTP errors", async () => {
  assert.equal(await reasonOf(fetchHtml(`http://127.0.0.1:${port}/json`, local())), "not_html");
  assert.equal(await reasonOf(fetchHtml(`http://127.0.0.1:${port}/forbidden`, local())), "http_error");
});

test("times out on a server that never answers", async () => {
  const started = Date.now();
  const reason = await reasonOf(
    fetchHtml(`http://127.0.0.1:${port}/hang`, { ...local(), timeoutMs: 300 })
  );
  assert.equal(reason, "timeout");
  assert.ok(Date.now() - started < 2000, "should fail fast");
});
