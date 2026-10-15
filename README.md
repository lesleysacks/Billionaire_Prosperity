# Billionaire Prosperity — Private Transport & Tours, Cape Winelands

Static marketing and enquiry website for https://billionaireprosperity.co.za (GitHub Pages, `CNAME` in the repo root). Open `index.html`, or upload this folder to any static host. No Node.js, npm, or build step.

## Pages

- `index.html` — Home
- `services.html`
- `wine-tours.html`
- `fleet.html`
- `about.html`
- `gallery.html` — hidden for now: not linked from nav, footer or sitemap, and marked `noindex`. The file is kept for later.
- `contact.html` — enquiry form (WhatsApp, email, or copy until a form endpoint is set)
- `404.html`

Shared files: `css/style.css`, `js/main.js`, `assets/images/`, `favicon.svg`, `favicon.ico`, `robots.txt`, `sitemap.xml`.

## Client details still to confirm

Do not invent these. Unconfirmed fields stay neutral until the business owner supplies them.

In `js/main.js`, the `SITE` object:

- `whatsapp` — `27790235061`, the international form of the published number 079 023 5061. WhatsApp links use `https://wa.me/27790235061`.
- `email` — `andremoses100.am@gmail.com`, the address already published in the footer. It only builds a `mailto:` link. The page does not send email by itself.
- `formEndpoint` — still empty. No enquiry is stored or delivered by the website. Leave it empty until a real form service is approved.

Still unconfirmed in the HTML:

- Luggage and “ideal for” on every fleet card, and passenger capacity for the Chery Tiggo 4 Pro. The home page and fleet page previously disagreed (1–4 and 1–6), so that capacity now says “To be confirmed”.
- Both Suzuki Swift cards use the consistent published capacity of 1–4 passengers. There is no Chevrolet image in the repository.
- Cape Town tour route and activities on `wine-tours.html`.
- Logo: the header still uses the monogram. Print files in `assets/logo/` are not wired into the pages.

## Checks

No install is required. From the repository root:

```bash
node --check js/main.js
node --test tests/site.test.js
```

## Photos

Save images at the paths shown on each placeholder. The page swaps the placeholder for the photo as soon as the file is there. Reload to see it.

| Path | Used on |
| --- | --- |
| `assets/images/hero/hero-transport.jpg` | Home hero |
| `assets/images/hero/og-default.jpg` | Social share image (1200×630), then add the `og:image` tags |
| `assets/images/services/*.jpg` | Service cards and the services page |
| `assets/images/fleet/*.jpg` | Fleet |
| `assets/images/wine-tours/*.jpg` | Wine tours (`stellenbosch.jpg`, `paarl.jpg`, `cape-town-tour-map.jpg` still needed) |
| `assets/images/about/*.jpg` | About |
| `assets/images/gallery/gallery-01.jpg` … `gallery-09.jpg` | Gallery |

## Contact form

The form checks name, phone, service, email format, a future travel date, and a whole-number passenger count in the browser. Nothing is stored on this site. On submit it prepares the enquiry for WhatsApp, email, or copy. Set `SITE.formEndpoint` if you want it posted to a form service instead.
