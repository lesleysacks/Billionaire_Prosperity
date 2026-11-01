# Billionaire Prosperity — Private Transport & Tours, Cape Winelands

Static marketing and enquiry website for https://billionaireprosperity.co.za (GitHub Pages, `CNAME` in the repo root). Open `index.html`, or upload this folder to any static host. No Node.js, npm, or build step.

## Pages

- `index.html` — Home
- `services.html`
- `wine-tours.html`
- `fleet.html`
- `about.html`
- `gallery.html` — hidden for now: not linked from nav, footer or sitemap, and marked `noindex`. The file is kept. It may return later for customer reviews and satisfied-client photos, only with permission.
- `contact.html` — enquiry form (posts to Google Apps Script / Google Sheets, with WhatsApp and email as a fallback)
- `404.html`

Shared files: `css/style.css`, `js/main.js`, `google-apps-script/Code.gs`, `assets/images/`, `favicon.svg`, `favicon.ico`, `robots.txt`, `sitemap.xml`.

## Client details still to confirm

Do not invent these. Unconfirmed fields stay neutral until the business owner supplies them.

In `js/main.js`, the `SITE` object:

- `whatsapp` — `27790235061`, the international form of the published number 079 023 5061. WhatsApp links use `https://wa.me/27790235061`.
- `email` — `andremoses100.am@gmail.com`, the address already published in the footer. It only builds a `mailto:` link. The page does not send email by itself.
- `formEndpoint` — Google Apps Script web app that writes to the Enquiries sheet. The URL is public by design (the browser has to call it) and is not a secret.

Still unconfirmed in the HTML:

- Luggage and “ideal for” on every fleet card, and passenger capacity for the Chery Tiggo 4 Pro. The home page and fleet page previously disagreed (1–4 and 1–6), so that capacity now says “To be confirmed”.
- Both Suzuki Swift cards use the consistent published capacity of 1–4 passengers. There is no Chevrolet image in the repository.
- Cape Town tour route and activities on `wine-tours.html`.
- Logo: the header still uses the monogram. Print files in `assets/logo/` are not wired into the pages.

## Checks

No install is required. From the repository root:

```bash
node --check js/main.js
node --test tests/*.test.js
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

The form checks name, phone, service, email format, a future travel date, and a whole-number passenger count (1–50) in the browser and again in Apps Script. On submit it POSTs to the Apps Script web app, which writes a row to the `Enquiries` tab of [Billionaire Prosperity - Enquiry Register](https://docs.google.com/spreadsheets/d/1F2hVNrAnCIa9PeO9e3bKT2e_LYNQ171Dvh0R2HTfL9E/edit). Success is shown only after the script returns JSON such as `{"status":"ok","id":"BP-0001"}`. If that confirmation is missing, the page offers WhatsApp, email, or copy instead. Availability is subject to confirmation. A request is not a confirmed booking. There is no booking engine and no payment processing.

Pickup and destination are appended to **Customer Message**. Historical columns A–N are unchanged. Lead-management columns start at **O**.

### Email notifications

After an enquiry row is saved, Apps Script sends email with `MailApp`:

- **Customer confirmation** — only when a valid email was supplied. Includes the BP reference, service, travel date, passengers, pickup/destination, and a clear statement that the enquiry is **not** a confirmed booking.
- **Business notification** — always attempted, to `andremoses100.am@gmail.com`. Includes the enquiry ID, contact details, journey fields, and a link to the sheet.

The website response is the save result only (`{"status":"ok","id":"BP-####"}`). Email failure does not delete the row, does not change the enquiry ID, and does not show an error on the website.

Notification state is stored on the enquiry row:

| Status | Meaning |
| --- | --- |
| Pending | Saved, not yet sent |
| Sent | MailApp accepted the message |
| Failed | Send threw; retry from the menu |
| Skipped | Customer email omitted because none was supplied |

A 5-minute time trigger processes Pending and Failed rows. Duplicates within two minutes reuse the existing ID and do not send a second pair of emails.

### New spreadsheet columns (appended after Notes)

| Col | Header | Use |
| --- | --- | --- |
| O | Last Contact | Manual date of last owner contact |
| P | Booking Value | Actual booking revenue (ZAR). Only **Booked** rows count as revenue |
| Q | Customer Email Status | Pending / Sent / Failed / Skipped |
| R | Business Email Status | Pending / Sent / Failed / Skipped |
| S | Customer Email Sent At | South African timestamp |
| T | Business Email Sent At | South African timestamp |
| U | Notify Attempts | Retry count |
| V | Notify Error | Generic error code only (no customer PII) |

**Quoted Amount (M)** is a quote, not revenue. **Booking Value (P)** on status **Booked** is booking revenue.

Status dropdown: New, Contacted, Quoted, Booked, Closed.

### Private dashboard

The **Dashboard** tab lives in the same Google Sheet. It is not a public website page. Share the spreadsheet only with authorised users.

It counts rows that have a `BP-*` enquiry ID (placeholder Status=New rows without an ID are ignored) and uses live formulas for totals, conversion rate, quoted value, booking revenue, outstanding follow-ups, this month, and service breakdown.

### Retry failed emails

In the spreadsheet: **Billionaire Prosperity → Retry failed email notifications**. That resends Failed customer/business emails only. It does not create a new enquiry ID.

### WhatsApp — click-to-chat now, official API later

The website still uses `https://wa.me/27790235061`. Nothing claims that an automated WhatsApp message was sent. Do not automate WhatsApp Web.

To add official WhatsApp later, store credentials in **Apps Script → Project Settings → Script properties**, never in `js/main.js`:

- `WHATSAPP_PROVIDER` — `meta` or `twilio`
- `WHATSAPP_TOKEN` — access token (Meta Cloud API or Twilio)
- `WHATSAPP_PHONE_NUMBER_ID` — Meta phone number ID, or Twilio WhatsApp sender
- `WHATSAPP_TEMPLATE_CUSTOMER` — approved template name for customer confirmation
- `WHATSAPP_TEMPLATE_BUSINESS` — optional owner alert template

Business setup: Meta Business Manager, a WhatsApp Business Account, a verified display name, and message templates approved for utility/confirmation use. Twilio requires a WhatsApp-enabled sender and content templates. `sendWhatsAppNotification()` in `Code.gs` is the extension point; it currently returns Skipped / not configured.

### Deploy the Apps Script

Paste and deploy **before** expecting emails, the menu, or dashboard refresh from Apps Script. This repository does not deploy the script automatically.

1. Open the sheet → **Extensions → Apps Script**.
2. Replace `Code.gs` with `google-apps-script/Code.gs` from this repository.
3. Save.
4. **Deploy → New deployment** (or **Manage deployments → Edit → New version**).
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
5. Authorise **spreadsheet**, **gmail.send** / MailApp, and **script.scriptapp** (triggers) when Google prompts.
6. If the `/exec` URL changes, update `SITE.formEndpoint` in `js/main.js`.
7. Reload the sheet. Use **Billionaire Prosperity → Set up lead management** once (columns, dropdowns, ZAR format, Dashboard tab, retry trigger).
8. Send one test enquiry from `contact.html` with your own email. Confirm the on-page `BP-####` ID, the row in the sheet, customer and business emails, and Dashboard totals. Availability is subject to confirmation. A request is not a confirmed booking.

`doGet` is a health check only. It must not write rows. Keep the sheet / script timezone at `Africa/Johannesburg`.

### Confirmation strategy (do not use `no-cors`)

Google Apps Script web apps cannot answer CORS preflights (`OPTIONS`). A `fetch` with `mode: "no-cors"` yields an opaque response, which cannot prove that the row was saved.

The browser therefore sends a CORS simple request:

- `POST` with `mode: "cors"` and `redirect: "follow"`
- `Content-Type: application/x-www-form-urlencoded` (not `application/json`, which would preflight)
- Body fields: `name`, `phone`, `email`, `service`, `travel_date`, `passengers`, `message`, `source`, `started_at`, and the honeypot `company`

Apps Script runs `doPost`, then 302-redirects to `script.googleusercontent.com/macros/echo`. The browser follows that redirect with GET and reads JSON. `Access-Control-Allow-Origin: *` is already present on that response, so the page can require `status === "ok"` and a `BP-####` enquiry ID before showing success.

### Spam protection

- Hidden honeypot field `company` (client and server drop it; no success message)
- `started_at` timestamp from page load: reject instant or week-old submissions
- Submit button disabled while a request is in flight; a client guard blocks double clicks
- Server `LockService` plus a 2-minute name/phone/service duplicate window (returns the existing ID)
- Formula-like values (`=`, `+`, `-`, `@`) are quoted before they are written
- Apps Script logs only event codes and enquiry IDs, not names, emails, phones, or messages

The current `SITE.formEndpoint` already points at the deployed web app. Redeploy after pasting this `Code.gs` so email notifications and the lead-management menu go live.
