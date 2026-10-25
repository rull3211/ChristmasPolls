function extractFromPage(doc, loc) {
  var MAX_NAME = 200;

  function clean(value) {
    if (typeof value !== "string") { return null; }
    var text = value
      .replace(/&#x([0-9a-f]+);/gi, function (_, hex) { return String.fromCodePoint(parseInt(hex, 16)); })
      .replace(/&#(\d+);/g, function (_, dec) { return String.fromCodePoint(Number(dec)); })
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&apos;|&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    return text ? text.slice(0, MAX_NAME) : null;
  }

  function parsePrice(value) {
    if (typeof value === "number") { return isFinite(value) && value > 0 ? value : null; }
    if (typeof value !== "string") { return null; }
    var cleaned = value.replace(/[^\d.,]/g, "");
    if (!/\d/.test(cleaned)) { return null; }
    var lastDot = cleaned.lastIndexOf(".");
    var lastComma = cleaned.lastIndexOf(",");
    var normalized;
    if (lastDot !== -1 && lastComma !== -1) {
      normalized = lastComma > lastDot ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
    } else if (lastDot !== -1 || lastComma !== -1) {
      var parts = cleaned.split(lastDot !== -1 ? "." : ",");
      var lastPart = parts[parts.length - 1];
      normalized = parts.length > 2 || lastPart.length === 3 ? parts.join("") : parts.join(".");
    } else {
      normalized = cleaned;
    }
    var number = Number(normalized);
    return isFinite(number) && number > 0 ? number : null;
  }

  function nodes(value) {
    if (Array.isArray(value)) {
      return value.reduce(function (all, item) { return all.concat(nodes(item)); }, []);
    }
    return value !== null && typeof value === "object" ? [value] : [];
  }

  function typesOf(node) {
    var raw = node["@type"];
    return (Array.isArray(raw) ? raw : [raw])
      .filter(function (type) { return typeof type === "string"; })
      .map(function (type) { return type.replace(/^.*[\/#]/, ""); });
  }

  function findProducts(root) {
    var found = [];
    function visit(node) {
      var types = typesOf(node);
      if (types.indexOf("Product") !== -1 || types.indexOf("ProductGroup") !== -1) {
        found.push(node);
        return;
      }
      Object.keys(node).forEach(function (key) { nodes(node[key]).forEach(visit); });
    }
    nodes(root).forEach(visit);
    return found;
  }

  function currencyOf(node) {
    return typeof node.priceCurrency === "string" ? node.priceCurrency.toUpperCase() : null;
  }

  function offerPoints(offer) {
    var points = [];
    ["price", "lowPrice"].forEach(function (key) {
      var price = parsePrice(offer[key]);
      if (price !== null) { points.push({ price: price, currency: currencyOf(offer) }); }
    });
    nodes(offer.priceSpecification).forEach(function (spec) {
      if (/list|strike/i.test(String(spec.priceType || ""))) { return; }
      var price = parsePrice(spec.price);
      if (price !== null) { points.push({ price: price, currency: currencyOf(spec) || currencyOf(offer) }); }
    });
    nodes(offer.offers).forEach(function (nested) { points = points.concat(offerPoints(nested)); });
    return points;
  }

  function ownPoints(product) {
    return nodes(product.offers).reduce(function (all, offer) { return all.concat(offerPoints(offer)); }, []);
  }

  function cheapest(points) {
    return points.reduce(function (best, point) { return best === null || point.price < best.price ? point : best; }, null);
  }

  function variantMatches(variant, page) {
    var candidates = [variant.url, variant["@id"]]
      .concat(nodes(variant.offers).map(function (offer) { return offer.url; }))
      .filter(function (value) { return typeof value === "string"; });
    return candidates.some(function (candidate) {
      try {
        var url = new URL(candidate, page);
        if (url.origin !== page.origin || url.pathname !== page.pathname) { return false; }
        var allPresent = true;
        url.searchParams.forEach(function (value, key) {
          if (page.searchParams.get(key) !== value) { allPresent = false; }
        });
        return allPresent;
      } catch (error) {
        return false;
      }
    });
  }

  function collapseRepeatedSuffix(name) {
    var words = name.split(" ");
    for (var size = Math.floor(words.length / 2); size >= 1; size--) {
      var tail = words.slice(-size).join(" ");
      var before = words.slice(-2 * size, -size).join(" ");
      if (tail === before) { return words.slice(0, -size).join(" "); }
    }
    return name;
  }

  function resolveProduct(product, page) {
    var groupName = clean(product.name);
    var own = cheapest(ownPoints(product));
    var variants = nodes(product.hasVariant);
    if (own !== null || variants.length === 0) {
      return { name: groupName, price: own ? own.price : null, currency: own ? own.currency : null, ambiguous: false };
    }

    var matched = page ? variants.filter(function (variant) { return variantMatches(variant, page); }) : [];
    var pool = matched.length > 0 ? matched : variants;
    var priced = pool
      .map(function (variant) { return cheapest(ownPoints(variant)); })
      .filter(function (point) { return point !== null; });
    var distinct = {};
    priced.forEach(function (point) { distinct[point.price] = true; });
    var distinctCount = Object.keys(distinct).length;

    var name = groupName;
    if (matched.length === 1) {
      var variantName = clean(matched[0].name);
      var collapsed = variantName ? collapseRepeatedSuffix(variantName) : null;
      if (collapsed && groupName && collapsed.indexOf(groupName) === 0 && collapsed.length > groupName.length) {
        name = collapsed;
      }
    }
    return {
      name: name,
      price: distinctCount === 1 ? priced[0].price : null,
      currency: distinctCount === 1 ? priced[0].currency : null,
      ambiguous: distinctCount > 1
    };
  }

  var page = null;
  try { page = new URL(loc.href); } catch (error) { page = null; }

  var products = [];
  Array.prototype.forEach.call(doc.querySelectorAll('script[type="application/ld+json"]'), function (element) {
    try { products = products.concat(findProducts(JSON.parse(element.textContent))); } catch (error) { }
  });
  var product = products.filter(function (candidate) { return clean(candidate.name) !== null; })[0];
  var fromJsonLd = product ? resolveProduct(product, page) : null;

  var meta = {};
  Array.prototype.forEach.call(doc.querySelectorAll("meta"), function (element) {
    var key = (element.getAttribute("property") || element.getAttribute("name") || "").toLowerCase();
    if (key && !(key in meta)) { meta[key] = element.getAttribute("content"); }
  });

  var ambiguous = fromJsonLd !== null && fromJsonLd.ambiguous;
  var metaPrice = ambiguous ? null : parsePrice(meta["product:price:amount"] || meta["og:price:amount"]);
  var metaCurrency = (meta["product:price:currency"] || meta["og:price:currency"] || "").toUpperCase() || null;
  var itemprop = ambiguous ? null : doc.querySelector('[itemprop="price"]');
  var itemPrice = itemprop ? parsePrice(itemprop.getAttribute("content") || itemprop.textContent) : null;
  var heading = doc.querySelector("h1");

  var jsonLdHasPrice = fromJsonLd !== null && fromJsonLd.price !== null;
  var price = jsonLdHasPrice ? fromJsonLd.price : metaPrice !== null ? metaPrice : itemPrice;
  var currency = jsonLdHasPrice ? fromJsonLd.currency : metaPrice !== null ? metaCurrency : null;
  var name = (fromJsonLd && fromJsonLd.name) || clean(meta["og:title"]) || (heading ? clean(heading.textContent) : null);

  return { name: name || null, price: price === undefined ? null : price, currency: currency || null };
}
