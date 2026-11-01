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

- **Customer confirmation** — only when a valid email was supplied, and only to that submitted address (`lead.email`). There is no fallback to the business address. Includes the BP reference, service, travel date, passengers, pickup/destination, and a clear statement that the enquiry is **not** a confirmed booking.
- **Business notification** — always attempted, and only to `CONFIG.BUSINESS_EMAIL`, which must be `andremoses100.am@gmail.com`. The script refuses to send if the resolved recipient is anything else, including `lesleysacks1@gmail.com`. It does not CC, BCC, or send the business copy to the customer email.

`MailApp` sends **from** the Apps Script owner account. A copy in that account's Sent folder is expected. The **To** header of the business notification must still be `andremoses100.am@gmail.com`.

The website response is the save result only (`{"status":"ok","id":"BP-####"}`). Email failure does not delete the row, does not change the enquiry ID, and does not show an error on the website.

Notification state is stored on the enquiry row:

| Status | Meaning |
| --- | --- |
| Pending | Saved, not yet sent |
| Sent | MailApp accepted the message |
| Failed | Send threw or the business recipient was blocked; retry from the menu |
| Skipped | Customer email omitted because none was supplied |

A 5-minute time trigger processes Pending and Failed rows. `doPost` keeps `LockService` through save and send so the trigger cannot also deliver the same Pending row. Each notification is claimed before send. Status is written to Sent only after MailApp succeeds. Changing `BUSINESS_EMAIL` does not resend historical Sent rows. Duplicates within two minutes reuse the existing ID and do not send a second pair of emails.

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

Changing `CONFIG.BUSINESS_EMAIL` in the editor and clicking Save is **not** enough for the public form. The website calls the **deployed** `/exec` version. Time-driven triggers run the **latest saved** project code. Those can differ.

1. Open the sheet → **Extensions → Apps Script**.
2. Confirm you are in the script project bound to [Billionaire Prosperity - Enquiry Register](https://docs.google.com/spreadsheets/d/1F2hVNrAnCIa9PeO9e3bKT2e_LYNQ171Dvh0R2HTfL9E/edit).
3. Replace `Code.gs` with `google-apps-script/Code.gs` from this repository.
4. Confirm `CONFIG.BUSINESS_EMAIL` and `CONFIG.REQUIRED_BUSINESS_EMAIL` are both `andremoses100.am@gmail.com`.
5. Save.
6. **Deploy → Manage deployments**. Edit the **existing** web app whose `/exec` path matches `SITE.formEndpoint` in `js/main.js` (`…/AKfycbzZxz8HFsoFdJ6IRf3jJ87xUn8vtuT0HeSyCJF_Opb3SyE7TQj2VSgo1jPQemOg71FWPw/exec`). Choose **New version**, not a second deployment.
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
7. Authorise **spreadsheet**, **gmail.send** / MailApp, and **script.scriptapp** (triggers) when Google prompts.
8. Leave the public `/exec` URL unchanged if that existing deployment was versioned. Update `SITE.formEndpoint` only if Google issued a new `/exec` URL.
9. Do **not** run **Set up lead management** again just to change the email recipient. That menu recreates the 5-minute `processPendingNotifications` trigger. Reinstall the trigger only if it is missing: **Triggers** (clock icon) should show one time-driven `processPendingNotifications` every 5 minutes.

#### Manual email-routing test

Use a new customer email that is not `lesleysacks1@gmail.com`. Do not resend historical Sent rows.

1. Submit one enquiry from `contact.html`.
2. Confirm the page shows a `BP-####` ID and a new Enquiries row with that ID.
3. Customer confirmation **To** = the submitted email. Business notification **To** = `andremoses100.am@gmail.com`.
4. Confirm there is no CC or BCC, and no new business notification addressed to `lesleysacks1@gmail.com`. A Sent-folder copy in the script-owner Gmail account is normal because MailApp sends from that account.
5. Submit a second enquiry with the email field blank. Customer Email Status must be Skipped. Business Email Status must still become Sent to `andremoses100.am@gmail.com`.
6. If a send is marked Failed, use **Billionaire Prosperity → Retry failed email notifications**. The same enquiry ID must be reused. Sent rows must not send again.

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
