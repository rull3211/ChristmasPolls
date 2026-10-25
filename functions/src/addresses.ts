import { BlockList, isIP } from "node:net";

const blocked = new BlockList();

const ipv4Ranges: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

// Ranges that embed an IPv4 address (NAT64, 6to4, Teredo) are blocked whole,
// so a private IPv4 address cannot be smuggled in through IPv6. Mapped
// ::ffff:a.b.c.d addresses are handled separately: a BlockList rule for them
// would also match every plain IPv4 address.
const ipv6Ranges: [string, number][] = [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
];

for (const [network, prefix] of ipv4Ranges) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of ipv6Ranges) {
  blocked.addSubnet(network, prefix, "ipv6");
}

// The URL parser canonicalises any spelling of an IPv6 address, so a mapped
// address always arrives here as ::ffff:<hex>:<hex>.
function mappedIPv4(address: string): string | null {
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const match = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(canonical);
  if (!match) return null;
  const high = parseInt(match[1], 16);
  const low = parseInt(match[2], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  if (family === 4) return !blocked.check(address, "ipv4");

  try {
    const embedded = mappedIPv4(address);
    if (embedded !== null) return isPublicAddress(embedded);
    return !blocked.check(address, "ipv6");
  } catch {
    // Unparseable spellings (such as zone IDs) are never treated as public.
    return false;
  }
}
