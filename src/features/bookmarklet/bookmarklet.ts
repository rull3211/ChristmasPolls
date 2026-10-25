import extractorSource from "./pageExtractor.js?raw";
import { buildBookmarklet } from "./buildBookmarklet";

export function bookmarkletHref(appOrigin: string): string {
  return buildBookmarklet(extractorSource, appOrigin);
}
