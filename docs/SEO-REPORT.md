# Billionaire Prosperity — SEO report

**Site:** https://billionaireprosperity.co.za  
**Host:** GitHub Pages (`CNAME` → `billionaireprosperity.co.za`)  
**Stack:** Static HTML5, CSS3, vanilla JavaScript. No build step.  
**Reviewed:** 2 November 2026 (Africa/Johannesburg)  
**Production not deployed** from this work. Merge and GitHub Pages publish still need owner approval.

This report is limited to the existing Billionaire Prosperity website. No business facts, reviews, ratings, prices, vehicle capacities or addresses were invented.

Keyword volumes, difficulty scores and current ranking positions are **not included**. Those figures were not measured in a keyword planner or Search Console for this project. Search intent below is inferred from the services already published on the site.

---

## 1. Initial SEO health assessment

Before this work the site was a small, well-designed brochure site that search engines could crawl, but it was not set up to compete for commercial queries.

**What already worked**

- HTTPS on the live domain, with a `CNAME` for GitHub Pages.
- `robots.txt` already allowed `/` and pointed at the sitemap. It did not blanket-block the site.
- Unique-enough URLs (`services.html`, `wine-tours.html`, `fleet.html`, `about.html`, `contact.html`).
- A custom `404.html` (GitHub Pages serves this automatically).
- `gallery.html` already `noindex, nofollow` and unlinked.
- Mobile-first CSS, skip link, WhatsApp number `079 023 5061`, enquiry form posting to Google Apps Script.
- Honest copy: Chery Tiggo 4 Pro capacity “To be confirmed”; Suzuki Swift 1–4 passengers; “A request is not a confirmed booking.”

**What was holding the site back**

| Area | Finding |
| --- | --- |
| Canonicals | Homepage canonical and sitemap used `…/index.html` instead of `https://billionaireprosperity.co.za/`. That splits ranking signals between `/` and `/index.html`. |
| Titles | Thin brand-only titles: `Wine \| Billionaire Prosperity`, `Fleet \| Billionaire Prosperity`, `Contact \| Billionaire Prosperity`. Home title did not lead with the service. |
| Meta descriptions | Home was 167 characters; contact was 196. Both risk truncation. Several others were short and generic. |
| Indexing hints | Most pages had no robots meta. Gallery and 404 were correctly noindexed. |
| Structured data | None. Google had no Organisation, Service, FAQ or breadcrumb graph. |
| Open Graph | `og:image` existed without width, height, type, or a dedicated 1200×630 file. |
| Content | No FAQ URL for informational queries. Wine tours did not use `custom.jpg`. About footer HTML was truncated. |
| Internal links | Weak service ↔ FAQ ↔ enquiry paths. |
| Performance | Google Fonts CSS was render-blocking. Hero images were a single large JPEG with no `srcset`. Many `<img>` tags lacked width/height (CLS risk). Server HTML used `.is-missing`, so placeholder boxes could flash before photos painted. |
| Analytics | No Google Search Console, GA4 or Google Business Profile markup/IDs in the HTML. Correct — those need owner accounts. |

Overall: **technically crawlable, commercially under-optimised.** The offer (Cape Town airport transfers and Cape Winelands wine tours) was on the page, but titles, canonicals, schema and supporting content did not make that obvious to Google.

---

## 2. Problems discovered and how they were handled

1. **Homepage URL duplication** — Canonical, Open Graph URL and sitemap now use `/`, not `index.html`.
2. **Missing FAQ landing page** — Added `faq.html` with ten factual questions, `FAQPage` schema, breadcrumbs and enquiry CTAs.
3. **Broken About footer** — Restored the full footer (phones, email, navigation) to match the rest of the site.
4. **Unused wine-tour photo** — `custom.jpg` is now the Custom destinations block (`#custom`), with an enquiry CTA.
5. **Placeholder flash** — `.is-missing` is no longer in the static markup for real photos. `js/main.js` still adds it if an image fails to load.
6. **No Organisation logo for schema / Apple icon** — Added `assets/images/brand/logo.png` (512×512) and `assets/images/hero/og-default.jpg` (1200×630). The header still uses the existing monogram; print logos in `assets/logo/` were not invented into the header.
7. **Render-blocking Google Fonts** — Inter and Cormorant Garamond are now self-hosted (OFL, Latin + Latin-ext) and preloaded.
8. **Oversized LCP images** — Home, wine-tours and about heroes use `srcset` / `imagesrcset` with 800px variants.
9. **LocalBusiness schema skipped** — There is no verified street address or Google Business Profile in the repository. Organisation + Service + areaServed (Cape Town, Cape Winelands, Western Cape) is used instead.

---

## 3. Keywords and search intent

**Assumption (stated):** South African travellers, visitors and businesses search in English for the named service plus a place. Primary terms follow the four published services. No volume or difficulty numbers are claimed.

### Primary (commercial)

- Cape Town airport transfer / private airport transfer Cape Town
- Cape Winelands wine tour / private wine tour Stellenbosch / Franschhoek / Paarl
- Cape Town business transport / private chauffeur Cape Town
- private Cape Town tour

### Secondary

- Billionaire Prosperity
- private transport Cape Town
- Winelands day tour from Cape Town
- airport pickup Cape Town International

### Long-tail / informational

- how to enquire about a private wine tour Cape Town
- does an enquiry confirm a booking
- private transfer vehicles Cape Town
- custom Winelands route

### Location

Cape Town, Cape Winelands, Stellenbosch, Franschhoek, Paarl, Western Cape. Service area only — not a claimed shopfront.

### Page map

| Page | Primary keyword | Supporting | Intent | Title (implemented) | Meta description (implemented) |
| --- | --- | --- | --- | --- | --- |
| `index.html` → `/` | private transport Cape Town | airport transfers, wine tours, business travel | Commercial + brand | Private Transport & Tours in Cape Town \| Billionaire Prosperity | Private airport transfers, business travel, Cape Winelands wine tours and personalised Cape Town tours. Enquire by form, phone or WhatsApp. |
| `services.html` | Cape Town airport transfers | business transport, private tours | Commercial | Cape Town Airport Transfers & Private Tours \| Billionaire Prosperity | Private Cape Town airport transfers, business transport, Winelands wine tours and personalised private tours. Tell us your plans and we will arrange the journey. |
| `wine-tours.html` | private Cape Winelands wine tours | Stellenbosch, Franschhoek, Paarl, custom route | Commercial | Private Cape Winelands Wine Tours \| Billionaire Prosperity | Private wine tours through Stellenbosch, Franschhoek, Paarl or a custom Cape Winelands route. Enquire to plan a private wine day at your own pace. |
| `fleet.html` | private transfer vehicles Cape Town | Suzuki Swift 1–4, Chery Tiggo 4 Pro (capacity unconfirmed) | Commercial / consideration | Private Transfer Vehicles in Cape Town \| Billionaire Prosperity | See the vehicles used for private Cape Town transfers, business travel and Cape Winelands wine tours. Tell us your group size and we will confirm a suitable car. |
| `about.html` | Billionaire Prosperity Cape Town | private transport, Winelands | Brand / trust | About Billionaire Prosperity \| Cape Town Private Transport | Billionaire Prosperity offers private transport and tours across Cape Town and the Cape Winelands, with a focus on comfortable, personal journeys. |
| `faq.html` | Cape Town private transport FAQs | enquiry vs booking, wine regions, WhatsApp | Informational | FAQs \| Cape Town Private Transport & Wine Tours | Answers about enquiries, airport transfers, Cape Winelands wine tours, vehicles and how Billionaire Prosperity confirms travel requests. |
| `contact.html` | contact Billionaire Prosperity / enquire Cape Town transfer | WhatsApp, phone, form | Transactional | Contact Billionaire Prosperity \| Cape Town Transfers & Tours | Enquire about airport transfers, business transport, wine tours or private tours in Cape Town and the Cape Winelands. Availability is subject to confirmation. |

Copy was written in South African English. Keywords are used in titles, H1s and first paragraphs where they already matched the offer. They are not stuffed into body copy.

---

## 4. Pages optimised

Indexable: home, services, wine tours, fleet, about, FAQs, contact.  
Left out of the sitemap on purpose: `gallery.html` (`noindex, nofollow`), `404.html` (`noindex, follow`).

Every indexable page now has:

- One H1
- Unique title (30–65 characters) and unique description
- Canonical on `https://billionaireprosperity.co.za/…`
- `index, follow, max-image-preview:large`
- Open Graph + Twitter card, shared 1200×630 image
- JSON-LD `@graph`
- Internal links to services, wine tours, FAQs and contact
- Visible enquiry / WhatsApp / phone paths
- Image `alt`, `width` and `height`

---

## 5. Technical improvements implemented

- Canonical homepage is `/`.
- `sitemap.xml` lists the seven public URLs with `lastmod` 2026-11-02. No `index.html`, gallery or 404.
- `robots.txt` still allows all crawlers and points at the sitemap. Nothing is blanket-disallowed.
- `rel="sitemap"` on pages.
- Apple touch icon + Organisation `logo`.
- Breadcrumb nav + `BreadcrumbList` on inner pages.
- `html lang="en-ZA"`, `og:locale` `en_ZA`.
- `defer` on `js/main.js`.
- Self-hosted fonts; no `fonts.googleapis.com` requests.
- Hero `srcset` / preload `imagesrcset`.
- Custom 404 retained for GitHub Pages.

No robots `Disallow: /`. No accidental `noindex` on money pages.

---

## 6. Content improvements

- Home intro now states the four services and who they are for, with CTAs to enquire and WhatsApp.
- Services page describes airport transfers, business transport, wine tours and private tours against real customer jobs (flight times, diaries, estates, personal days).
- Wine tours page covers Stellenbosch, Franschhoek, Paarl, custom routes and Cape Town days. Cape Town route/activities stay **To be confirmed**.
- New FAQ page answers only facts already on the site (how to enquire, confirmation, areas, services, regions, vehicles, WhatsApp/phone/email).
- FAQ excerpts also appear on home, services, wine tours and contact, each linking to `faq.html`.
- Trust copy repeats the booking disclaimer on enquiry surfaces. No testimonials, star ratings or awards.

**Recommended later content (do not publish until true):**

1. A short “What to send us for an airport pickup” guide — only after the owner confirms the details they actually need.
2. A Stellenbosch / Franschhoek pacing note — only if it matches how the driver really runs a day.
3. Gallery and reviews — only with written client permission. Keep `gallery.html` noindexed until then.
4. Case studies — none exist in the repo; do not invent them.

---

## 7. Structured data results

JSON-LD `@graph` on indexable pages:

- `Organization` — name, URL, logo, email `andremoses100.am@gmail.com`, telephone `+27790235061`, `areaServed`, `contactPoint`. No `AggregateRating`.
- `WebSite`
- `WebPage` (About uses `AboutPage`, Contact uses `ContactPage`)
- `Service` nodes for airport transfers, business transport, wine tours and private tours where the page discusses them
- `BreadcrumbList` on inner pages
- `FAQPage` on `faq.html` with the same questions and answers shown on the page

**Not added:** `LocalBusiness`, `Review`, `AggregateRating`, `Offer` prices.  
**Validation performed:** `JSON.parse` on each JSON-LD block via `tests/seo.test.js` (passes). Google’s Rich Results Test was not run against production in this environment.

---

## 8. Performance measurements

Measured with Lighthouse 12 against `http://127.0.0.1:8080/` (Python static server, Chrome headless). These are **lab** scores on this VM, not CrUX field data.

Local HTTP has no gzip. GitHub Pages does compress HTML/CSS/JS in production, so text-compression findings here overstate production cost.

### After this work

| Page | Form | Performance | SEO | Accessibility | Best practices | LCP | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | Mobile | 93 | 100 | 100 | 100 | 3.2 s | 0 |
| Wine tours | Mobile | 90 | 100 | 100 | 100 | 3.6 s | 0 |
| Contact | Mobile | 99 | 100 | 100 | 100 | 2.1 s | 0 |
| Home | Desktop | 98 | 100 | 100 | 100 | 1.0 s | 0 |

### Home mobile, before the font/srcset pass

Performance **81**, LCP **4.9 s**, CLS 0.001, SEO 100.

INP was not emitted in these navigation runs (no interaction sample). Total blocking time on home mobile after the change: 20 ms.

Remaining LCP gap on image-heavy pages is mainly hero decode and font swap on simulated slow 4G. Further wins would be AVIF/WebP (design change to image pipeline) or a smaller unique hero crop. Not done here, to avoid rebuilding the visual system.

---

## 9. Mobile optimisation results

Checked in Chrome at 390×844 and 1280×800.

- Hamburger opens and closes; Wine Tours / Contact routes work.
- Hero type, buttons and WhatsApp FAB remain usable. Primary buttons are full-width on small screens.
- Enquiry form stacks; empty submit shows name, phone and service errors without posting.
- `?service=private-tour#enquiry-form` selects Private Tour.
- Breadcrumbs remain readable on contact and FAQ.
- No horizontal overflow observed on the pages tested.
- `gallery.html` still uses placeholders (intentional; page is noindex).

The cloud GUI computer-use agent was unavailable in this environment. Checks were run with headless Chrome / Playwright against the local server, plus the screenshots and walkthrough video attached to the pull request.

---

## 10. Outstanding issues

| Item | Owner | Notes |
| --- | --- | --- |
| Deploy this branch to GitHub Pages | Business owner | Not deployed from this work. |
| Google Search Console | Business owner | See section 11. |
| Google Analytics 4 | Business owner | No Measurement ID in the repo. Do not invent one. |
| Google Business Profile | Business owner | Only if there is a real, qualifying local presence. Then NAP must match the site. |
| Chery Tiggo 4 Pro passenger capacity | Business owner | Still “To be confirmed” on home and fleet. |
| Cape Town tour route and activities | Business owner | Still “To be confirmed”. |
| Header logo vs print files in `assets/logo/` | Business owner | Header keeps the monogram until the owner chooses a file. |
| Gallery photos / reviews | Business owner | Keep noindex until real, permitted assets exist. |
| `custom.jpg` subject | Optional | The file is an illustrated Cape Town day, used for “custom destinations”. A real Winelands photo would be a better match. |
| Apps Script deployment | Already documented in README | Live `/exec` URL must stay in `js/main.js` if it changes. |
| Field LCP on 4G | Engineering, later | Home/wine mobile LCP still above 2.5 s in the lab. |
| Add FAQs to the header | Optional | FAQs are in the footer, on-page excerpts and sitemap, not the primary nav. |

---

## 11. Google Search Console and Analytics setup

No tracking snippets were added. Do not paste another GA/GTM container if one is added later in a different branch.

### Search Console (do this after the SEO pages are live)

1. Sign in at [https://search.google.com/search-console](https://search.google.com/search-console) with the Google account that should own the property.
2. Add a **URL prefix** property: `https://billionaireprosperity.co.za`.
3. Verify. Fastest options for this host:
   - **DNS TXT** on the domain (owner’s registrar), or
   - **HTML file** upload into this repo’s root, commit, wait for GitHub Pages, then Verify.
   An HTML tag in `<head>` also works; add it once, on every page, and keep it.
4. After verification: **Sitemaps → Add sitemap** → `https://billionaireprosperity.co.za/sitemap.xml`.
5. Use **URL Inspection** on `/`, `/services.html`, `/wine-tours.html`, `/fleet.html`, `/about.html`, `/faq.html`, `/contact.html`. Request indexing once each.
6. Confirm `gallery.html` and unknown URLs are not being submitted.
7. Set the preferred domain as the `www`-less host if both resolve. Today the `CNAME` is the apex `billionaireprosperity.co.za`.

### Analytics 4

1. Create a GA4 property for Billionaire Prosperity (same Google account or with access granted).
2. Create a Web data stream for `https://billionaireprosperity.co.za`.
3. Put the Measurement ID (`G-XXXXXXXX`) into a single site-wide snippet, or into Google Tag Manager — not both.
4. Mark internal traffic if the owner tests from a stable office IP.
5. Events worth capturing later (optional, owner approval): `generate_lead` on successful enquiry (`status=ok`), WhatsApp click (`data-wa` links), `tel:` click.

### Google Business Profile

Only if the business has a real service-area or premises listing that Google will accept. Categories to consider: Airport shuttle service, Tour operator, or Chauffeur service — pick the one that matches how the owner actually trades. Do not create a pin at an address that is not used.

---

## 12. 90-day organic growth strategy

Field ranking data does not exist in this repo. The plan below is operational, not a promise of positions.

### Days 1–30 — index and measure

- Merge and publish this branch.
- Complete Search Console verification and sitemap submission.
- Inspect the seven public URLs; request indexing.
- Create GA4 (or confirm an existing property) and watch enquiry / WhatsApp events if approved.
- Decide on Google Business Profile with the owner. If yes, match name, phones `079 023 5061` / `062 133 8497`, email, and website URL to the site.
- Confirm Chery capacity and Cape Town tour notes so those lines can stop saying “To be confirmed”.

### Days 31–60 — strengthen what Google actually queries

- Read Search Console → Queries and Pages. Write the next piece of copy from **real** queries, not a guessed keyword list.
- Likely first additions, only if they match the business: a tighter airport-transfer section (flight number, meet-and-greet policy — owner must confirm) and a Winelands “how a private day is paced” note.
- Collect permitted client photos for the gallery; keep `noindex` until a set is ready.
- Do not buy reviews or add schema ratings.

### Days 61–90 — convert and earn mentions

- Compare enquiry form starts vs WhatsApp clicks in GA4. If WhatsApp dominates, keep it prominent (already in header, hero, FAB and contact card).
- Ask past clients, with permission, for a named quote. Publish only with consent. Still no star schema unless Google eligible.
- One honest partnership or estate mention is worth more than a blog calendar. Do not publish destination guides the driver cannot stand behind.
- Re-run Lighthouse on the **live** HTTPS origin and compare with the lab table in section 8.

---

## 13. SEO scorecard

| Item | Status |
| --- | --- |
| Unique titles and meta descriptions | Completed |
| Canonical URLs (homepage `/`) | Completed |
| `robots.txt` allows crawl + sitemap | Completed |
| XML sitemap of public pages | Completed |
| Index / noindex directives | Completed |
| Open Graph + Twitter cards + 1200×630 image | Completed |
| Heading hierarchy (one H1, H2/H3) | Completed |
| Descriptive URLs | Completed (existing `.html` URLs kept) |
| Internal linking (services, FAQs, contact, regions) | Completed |
| Broken-link check (automated) | Completed |
| Image alt + width/height | Completed on indexable pages |
| Custom 404 | Completed |
| Mobile-first layout retained | Completed |
| Keyword–page mapping | Completed (intent only; no volumes) |
| On-page copy refresh | Completed |
| New FAQ content | Completed |
| Organisation / WebSite / WebPage / Service schema | Completed |
| BreadcrumbList | Completed |
| FAQPage schema | Completed |
| LocalBusiness schema | Not completed — no verified premises |
| Review / rating schema | Not completed — no genuine reviews to mark up |
| Self-hosted fonts + preload | Completed |
| Hero `srcset` / LCP preload | Completed |
| CLS (lab = 0 on tested pages) | Completed in lab |
| Home mobile LCP under 2.5 s | Partially completed (4.9 s → 3.2 s in lab) |
| Gzip / CDN | Requires GitHub Pages production (not this local server) |
| Enquiry / WhatsApp CTAs + disclaimer | Completed |
| Form still validates; no live test booking sent | Completed |
| HTTPS | Completed on production domain (pre-existing) |
| No new secrets committed | Completed |
| Google Search Console | Requires external account access |
| Google Analytics 4 | Requires external account access |
| Google Business Profile | Requires business-owner approval |
| Deploy to production | Requires business-owner approval |
| Chery capacity / Cape Town itinerary | Requires business-owner approval |
| Client gallery and reviews | Requires business-owner approval |
| Header swap to print logo files | Requires business-owner approval |

---

## 14. Tests actually run

```bash
node --check js/main.js
node --test tests/*.test.js
```

33 tests passed (enquiry logic, sheet logic, site integrity, SEO assertions).

Also run: JSON-LD parse, sitemap/robots assertions, Playwright checks for H1, breadcrumbs, `#custom`, empty-form validation, `private-tour` preset, mobile menu, Lighthouse 12 as tabled above.
