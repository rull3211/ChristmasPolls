// The extractor is written without line comments and with explicit
// semicolons, so joining its lines cannot change what it does.
export function buildBookmarklet(
  extractorSource: string,
  appOrigin: string
): string {
  const extractor = extractorSource.replace(/\s*\n\s*/g, " ");
  const code =
    `(function(){${extractor};` +
    `var r;try{r=extractFromPage(document,location)}catch(e){r={}}` +
    `var d={u:location.href,n:r.name,p:r.price,c:r.currency};` +
    `window.open(${JSON.stringify(appOrigin)}+"/#add="+encodeURIComponent(JSON.stringify(d)),"_blank")})();`;
  return `javascript:${encodeURIComponent(code)}`;
}
