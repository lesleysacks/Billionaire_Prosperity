const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const pages = fs.readdirSync(root).filter((name) => name.endsWith(".html"));
const indexable = ["index.html", "services.html", "wine-tours.html", "fleet.html", "about.html", "contact.html", "faq.html"];

function read(name) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

function jsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, "JSON-LD script");
  return JSON.parse(match[1]);
}

test("indexable pages have unique titles and descriptions", () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const page of indexable) {
    const html = read(page);
    const title = html.match(/<title>([^<]+)<\/title>/)[1];
    const description = html.match(/name="description" content="([^"]+)"/)[1];
    assert.ok(title.length >= 30 && title.length <= 70, `${page} title length ${title.length}: ${title}`);
    assert.ok(description.length >= 70 && description.length <= 170, `${page} description length ${description.length}`);
    assert.equal(titles.has(title), false, `duplicate title: ${title}`);
    assert.equal(descriptions.has(description), false, `duplicate description: ${description}`);
    titles.add(title);
    descriptions.add(description);
    assert.match(html, /Cape Town|Winelands|wine tour|transfer/i, `${page} should mention the offer`);
  }
});

test("canonicals use the live domain and the homepage is the root URL", () => {
  assert.match(read("index.html"), /rel="canonical" href="https:\/\/billionaireprosperity\.co\.za\/"/);
  assert.match(read("index.html"), /property="og:url" content="https:\/\/billionaireprosperity\.co\.za\/"/);
  for (const page of indexable) {
    const html = read(page);
    assert.match(html, /rel="canonical" href="https:\/\/billionaireprosperity\.co\.za\//);
    assert.equal(html.includes('name="robots" content="noindex'), false, `${page} must stay indexable`);
    assert.match(html, /property="og:image" content="https:\/\/billionaireprosperity\.co\.za\/assets\/images\/hero\/og-default\.jpg"/);
    assert.match(html, /property="og:image:width" content="1200"/);
    assert.match(html, /rel="apple-touch-icon"/);
  }
});

test("structured data parses and matches visible organisation details", () => {
  for (const page of indexable) {
    const data = jsonLd(read(page));
    assert.equal(data["@context"], "https://schema.org");
    const types = data["@graph"].map((node) => node["@type"]).flat();
    assert.ok(types.includes("Organization"), page);
    assert.ok(types.includes("WebPage") || types.includes("WebSite"), page);
    const org = data["@graph"].find((node) => node["@type"] === "Organization");
    assert.equal(org.telephone, "+27790235061");
    assert.equal(org.email, "andremoses100.am@gmail.com");
    assert.equal(org.url, "https://billionaireprosperity.co.za/");
    assert.equal(JSON.stringify(org).includes("ratingValue"), false);
    assert.equal(JSON.stringify(data).includes("AggregateRating"), false);
  }
  const faq = jsonLd(read("faq.html"));
  const faqPage = faq["@graph"].find((node) => node["@type"] === "FAQPage");
  assert.ok(faqPage.mainEntity.length >= 8);
  const wine = jsonLd(read("wine-tours.html"));
  assert.ok(wine["@graph"].some((node) => node["@type"] === "Service" && /wine/i.test(node.name)));
});

test("sitemap lists public URLs and robots.txt does not block the site", () => {
  const sitemap = read("sitemap.xml");
  assert.match(sitemap, /<loc>https:\/\/billionaireprosperity\.co\.za\/<\/loc>/);
  assert.equal(sitemap.includes("index.html"), false);
  assert.equal(sitemap.includes("gallery"), false);
  assert.equal(sitemap.includes("404"), false);
  for (const page of ["services.html", "wine-tours.html", "fleet.html", "about.html", "contact.html", "faq.html"]) {
    assert.match(sitemap, new RegExp(`<loc>https://billionaireprosperity\\.co\\.za/${page}</loc>`));
  }
  const robots = read("robots.txt");
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/billionaireprosperity\.co\.za\/sitemap\.xml/);
  assert.equal(/Disallow:\s*$/m.test(robots) && robots.includes("Disallow: /"), false);
  assert.equal(robots.includes("Disallow: /"), false);
});

test("pages self-host fonts, defer JavaScript, and preload local typefaces", () => {
  const fonts = [
    "assets/fonts/inter-latin.woff2",
    "assets/fonts/inter-latin-ext.woff2",
    "assets/fonts/cormorant-garamond-latin.woff2",
    "assets/fonts/cormorant-garamond-latin-ext.woff2",
  ];
  for (const file of fonts) {
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
  const css = read("css/style.css");
  assert.match(css, /@font-face/);
  assert.match(css, /inter-latin\.woff2/);
  assert.match(css, /cormorant-garamond-latin\.woff2/);
  for (const page of pages) {
    const html = read(page);
    assert.equal(html.includes("fonts.googleapis.com"), false, page);
    assert.equal(html.includes("fonts.gstatic.com"), false, page);
    assert.match(html, /<script src="js\/main\.js" defer><\/script>/, page);
    assert.match(html, /rel="preload" href="assets\/fonts\/inter-latin\.woff2"/, page);
  }
  const home = read("index.html");
  assert.match(home, /index_image-800\.jpg 800w/);
  assert.match(home, /srcset="/);
});

test("inner pages have breadcrumbs and FAQ links, and images have dimensions", () => {
  for (const page of ["services.html", "wine-tours.html", "fleet.html", "about.html", "contact.html", "faq.html"]) {
    assert.match(read(page), /class="breadcrumbs"/, page);
    assert.match(read(page), /href=['"]faq\.html['"]/, page);
  }
  assert.match(read("index.html"), /href=['"]faq\.html['"]/);
  assert.match(read("wine-tours.html"), /id="custom"/);
  assert.match(read("wine-tours.html"), /assets\/images\/wine-tours\/custom\.jpg/);
  for (const page of indexable) {
    const html = read(page);
    for (const match of html.matchAll(/<img\b[^>]*>/g)) {
      const tag = match[0];
      assert.match(tag, /\salt="/, `${page} img alt`);
      assert.match(tag, /\swidth="\d+"/, `${page} img width: ${tag.slice(0, 80)}`);
      assert.match(tag, /\sheight="\d+"/, `${page} img height`);
    }
  }
});
