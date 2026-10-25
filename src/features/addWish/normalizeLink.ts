// Mirrors the server's normalisation closely enough to give early feedback;
// the server stays the authority on what it will fetch.
export function normalizeLink(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    const isWeb = url.protocol === "http:" || url.protocol === "https:";
    return isWeb && url.hostname.includes(".") ? withScheme : null;
  } catch {
    return null;
  }
}
