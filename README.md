# Private Transport & Tours — Cape Winelands

Static marketing and enquiry website. Open `index.html`, or upload this folder to any static host. No Node.js, npm, or build step.

## Pages

- `index.html` — Home
- `services.html`
- `wine-tours.html`
- `fleet.html`
- `about.html`
- `gallery.html`
- `contact.html` — enquiry form (WhatsApp, email, or copy until a form endpoint is set)
- `404.html`

Shared files: `css/style.css`, `js/main.js`, `assets/images/`, `favicon.svg`, `favicon.ico`, `robots.txt`, `sitemap.xml`.

## Client details still to fill in

Do not invent these. Placeholders stay in place until real values arrive.

In `js/main.js`, the `SITE` object:

- `whatsapp` — international digits only, e.g. `27821234567`. Until set, WhatsApp buttons go to the contact page.
- `email` — enables “Send via email” on the enquiry form.
- `formEndpoint` — optional Formspree, Basin, or Getform URL. Leave empty to keep the handoff.

In the HTML, when you have them:

- Business name (header, footer, titles)
- Phone and email in the footer and on `contact.html` (commented examples are in the footer)
- Vehicle names and specs on `index.html` and `fleet.html` (currently “To be confirmed”)
- Production domain in each canonical URL, `robots.txt`, and `sitemap.xml` (currently `https://example.com`)
- Logo: replace the monogram in the header, or drop a file in `assets/logo/`

## Photos

Save images at the paths shown on each placeholder. The page swaps the placeholder for the photo as soon as the file is there. Reload to see it.

| Path | Used on |
| --- | --- |
| `assets/images/hero/hero-transport.jpg` | Home hero |
| `assets/images/hero/og-default.jpg` | Social share image (1200×630), then add the `og:image` tags |
| `assets/images/services/*.jpg` | Service cards and the services page |
| `assets/images/fleet/*.jpg` | Fleet |
| `assets/images/wine-tours/*.jpg` | Wine tours |
| `assets/images/about/*.jpg` | About |
| `assets/images/gallery/gallery-01.jpg` … `gallery-09.jpg` | Gallery |

## Contact form

The form checks name, phone, service, email format, a future travel date, and a whole-number passenger count in the browser. Nothing is stored on this site. On submit it prepares the enquiry for WhatsApp, email, or copy. Set `SITE.formEndpoint` if you want it posted to a form service instead.
