import assert from "node:assert/strict";
import test from "node:test";
import { isPublicAddress } from "./addresses.js";

test("blocks private, loopback, link-local and metadata addresses", () => {
  const blocked = [
    "127.0.0.1",
    "127.255.255.254",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "100.64.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    "0:0:0:0:0:ffff:7f00:1",
    "fe80::1%eth0",
    "::FFFF:A00:1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::1",
  ];
  for (const address of blocked) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test("allows public addresses", () => {
  for (const address of [
    "8.8.8.8",
    "1.1.1.1",
    "93.184.216.34",
    "172.32.0.1",
    "172.15.255.255",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
  ]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});

test("rejects anything that is not an IP address", () => {
  for (const value of ["localhost", "", "999.1.1.1", "example.com"]) {
    assert.equal(isPublicAddress(value), false, value);
  }
});
