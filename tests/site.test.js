const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const enquiry = require("../js/main.js");

const root = path.resolve(__dirname, "..");
const pages = fs.readdirSync(root).filter((name) => name.endsWith(".html"));

function read(name) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

function decodeSrc(src) {
  return decodeURIComponent(src.split("#")[0].split("?")[0]);
}

test("WhatsApp link uses the international number and encodes the message", () => {
  assert.equal(enquiry.SITE.whatsapp, "27790235061");
  assert.match(enquiry.SITE.formEndpoint, /^https:\/\/script\.google\.com\/macros\/s\/AKfycb[\w-]+\/exec$/);
  assert.equal(enquiry.whatsappDigits("079 023 5061"), "0790235061");
  assert.equal(enquiry.whatsappDigits("+27 79 023 5061"), "27790235061");
  assert.equal(enquiry.whatsappDigits("123"), "");

  const message = "Name: A & B\nPickup: 100% + hotel\nNote: \"table\"";
  const href = enquiry.whatsappLink("27790235061", message);
  const url = new URL(href);
  assert.equal(url.origin + url.pathname, "https://wa.me/27790235061");
  assert.equal(url.searchParams.get("text"), message);
  assert.equal(href.includes(" "), false);
  assert.equal(enquiry.whatsappLink("", message), "");
});

test("email handoff encodes the subject and body without a stored endpoint", () => {
  const body = "Enquiry for Billionaire Prosperity\n\nName: Sam";
  const href = enquiry.mailtoLink("andremoses100.am@gmail.com", "Enquiry: Private Tour", body);
  assert.equal(href.startsWith("mailto:andremoses100.am@gmail.com?"), true);
  const url = new URL(href);
  assert.equal(url.searchParams.get("subject"), "Enquiry: Private Tour");
  assert.equal(url.searchParams.get("body"), body);
  assert.equal(enquiry.mailtoLink("not-an-email", "Hi", "There"), "");
});

test("service query values are accepted only when they match the form", () => {
  const allowed = ["airport-transfer", "wine-tour", "business-transport", "private-tour", "other"];
  assert.equal(enquiry.resolveServiceValue("private-tour", allowed), "private-tour");
  assert.equal(enquiry.resolveServiceValue("  private-tour  ", allowed), "private-tour");
  assert.equal(enquiry.resolveServiceValue("chevrolet", allowed), "");
  assert.equal(enquiry.resolveServiceValue("private-tour<script>", allowed), "");
  assert.equal(enquiry.resolveServiceValue(null, allowed), "");
});

test("vehicle notes stay plain text and reject markup", () => {
  assert.equal(
    enquiry.vehicleEnquiryNote("Chery Tiggo 4 Pro"),
    "I would like to enquire about the Chery Tiggo 4 Pro.",
  );
  assert.equal(enquiry.vehicleEnquiryNote("<img src=x>"), "");
  assert.equal(enquiry.vehicleEnquiryNote("Swift\n<script>"), "");
  assert.equal(enquiry.vehicleEnquiryNote("x".repeat(81)), "");
});

test("enquiry validation reports required fields and bad email", () => {
  const today = "2026-10-15";
  const errors = enquiry.validateEnquiry(
    {
      name: "A",
      phone: "12",
      email: "not-an-email",
      service: "",
      date: "2020-01-01",
      passengers: "1.5",
    },
    today,
  );
  assert.match(errors.name, /name/i);
  assert.match(errors.phone, /phone/i);
  assert.match(errors.email, /email/i);
  assert.match(errors.service, /service/i);
  assert.match(errors.date, /date/i);
  assert.match(errors.passengers, /passenger/i);

  const ok = enquiry.validateEnquiry(
    {
      name: "Andre Moses",
      phone: "+27 79 023 5061",
      email: "",
      service: "private-tour",
      date: "2026-10-16",
      passengers: "",
    },
    today,
  );
  assert.deepEqual(ok, {
    name: "",
    phone: "",
    email: "",
    service: "",
    date: "",
    passengers: "",
  });
});

test("enquiry message keeps customer details readable", () => {
  const text = enquiry.buildEnquiryMessage(
    {
      name: "Sam Naidoo",
      phone: "+27 79 023 5061",
      email: "sam@example.com",
      serviceLabel: "Private Tour",
      pickup: "Cape Town International",
      destination: "Stellenbosch",
      dateLabel: enquiry.formatTravelDate("2026-11-02"),
      passengers: "2",
      message: "Please keep the day flexible.",
    },
    "Billionaire Prosperity",
  );
  assert.match(text, /^Enquiry for Billionaire Prosperity/);
  assert.match(text, /Name: Sam Naidoo/);
  assert.match(text, /Service: Private Tour/);
  assert.match(text, /Phone \/ WhatsApp: \+27 79 023 5061/);
  assert.match(text, /Message:\nPlease keep the day flexible\./);
  assert.equal(text.includes("<"), false);
  assert.match(enquiry.formatTravelDate("2026-11-02"), /2026/);
  assert.equal(enquiry.formatTravelDate("not-a-date"), "");
});

test("pages use the public domain, one heading, and real contact details", () => {
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<title>[^<]+<\/title>/, `${page} title`);
    assert.match(html, /name="description" content="[^"]+"/, `${page} description`);
    assert.match(html, /rel="canonical" href="https:\/\/billionaireprosperity\.co\.za\//, `${page} canonical`);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${page} should have one h1`);
    assert.equal(html.includes("mailto:mailto:"), false, `${page} doubled mailto`);
    assert.equal(html.includes("hello@example.com"), false, `${page} placeholder email`);
    assert.equal(html.includes("Chevrolet"), false, `${page} Chevrolet label`);
    assert.equal(html.includes("Cherry Pro"), false, `${page} misspelled Chery`);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${page} duplicate id`);
  }
});

test("fleet cards name the vehicles shown in the image files", () => {
  const fleet = read("fleet.html");
  const home = read("index.html");
  for (const html of [fleet, home]) {
    assert.match(html, /Grey Chery Tiggo 4 Pro/);
    assert.match(html, /alt="Grey Chery Tiggo 4 Pro from the private fleet"/);
    assert.match(html, /alt="White Suzuki Swift hatchback from the private fleet"/);
    assert.match(html, /alt="White Suzuki Swift hatchback from the private fleet, seen from the rear"/);
  }
  assert.match(fleet, /<h2 class="fleet-item__name" id="vehicle-01-name">Chery Tiggo 4 Pro<\/h2>/);
  assert.match(fleet, /<h2 class="fleet-item__name" id="vehicle-02-name">Suzuki Swift<\/h2>/);
  assert.match(fleet, /<h2 class="fleet-item__name" id="vehicle-03-name">Suzuki Swift<\/h2>/);
  assert.equal(home.includes(">Vehicle 01<"), false);
  assert.equal(home.includes(">Vehicle 03<"), false);
});

test("private tour enquiry opens the contact form with the service selected", () => {
  const services = read("services.html");
  assert.match(services, /id="private-tours"/);
  assert.match(services, /href="contact\.html\?service=private-tour#enquiry-form"/);
  const contact = read("contact.html");
  assert.match(contact, /<option value="private-tour">Private Tour<\/option>/);
  assert.match(contact, /id="enquiry-form"/);
  assert.match(contact, /data-service-preset/);
  assert.match(contact, /Send enquiry/);
  assert.match(read("js/main.js"), /resolveServiceValue/);
});

test("local images and internal links resolve", () => {
  const missing = [];
  const brokenLinks = [];
  for (const page of pages) {
    const html = read(page);
    for (const match of html.matchAll(/\ssrc="([^"]+)"/g)) {
      const src = match[1];
      if (/^(https?:|data:)/.test(src)) continue;
      const relative = decodeSrc(src);
      const file = path.join(root, relative);
      if (!fs.existsSync(file) && !relative.startsWith("assets/images/gallery/")) {
        missing.push(`${page} -> ${src}`);
      }
    }
    for (const match of html.matchAll(/\shref="([^"]+)"/g)) {
      const href = match[1];
      if (/^(https?:|mailto:|tel:|#)/.test(href)) continue;
      const [filePart, hash] = href.split("#");
      const clean = filePart.split("?")[0];
      if (!clean || clean.endsWith("/")) continue;
      const target = path.join(root, decodeSrc(clean));
      if (!fs.existsSync(target)) {
        brokenLinks.push(`${page} -> ${href}`);
        continue;
      }
      if (hash && target.endsWith(".html")) {
        const targetHtml = fs.readFileSync(target, "utf8");
        if (!targetHtml.includes(`id="${hash}"`)) brokenLinks.push(`${page} -> ${href} missing #${hash}`);
      }
    }
  }
  assert.deepEqual(missing, []);
  assert.deepEqual(brokenLinks, []);
});

test("Chery capacity stays unconfirmed and Suzuki cards keep 1–4", () => {
  for (const page of ["index.html", "fleet.html"]) {
    const html = read(page);
    assert.equal(html.includes("1–6"), false, `${page} must not publish 1–6`);
    assert.equal(/1-6 passengers/i.test(html), false, `${page} must not publish 1-6 passengers`);
    const cheryAt = html.indexOf(">Chery Tiggo 4 Pro<");
    assert.notEqual(cheryAt, -1, page);
    const chery = html.slice(cheryAt, cheryAt + 1800);
    assert.match(chery, /Passenger capacity<\/dt><dd>To be confirmed<\/dd>/);
    assert.equal(chery.includes("1–4"), false, `${page} Chery capacity`);
    assert.equal((html.match(/1–4 passengers/g) || []).length, 2, `${page} Suzuki capacities`);
  }
});

test("enquiry surfaces say a request is not a confirmed booking", () => {
  const phrase = /Availability is subject to confirmation\. A request is not a confirmed booking\./;
  for (const page of ["contact.html", "index.html", "services.html", "wine-tours.html", "fleet.html", "about.html"]) {
    assert.match(read(page), phrase, page);
  }
  const script = read("js/main.js");
  assert.match(script, phrase);
  assert.match(script, /script\.google\.com\/macros\/s\//);
  assert.equal(script.includes('mode: "no-cors"'), false);
  assert.match(script, /mode: "cors"/);
  assert.equal(/stripe|payfast|paypal|checkout/i.test(script), false);
});

test("gallery stays hidden until the client approves photos", () => {
  const gallery = read("gallery.html");
  assert.match(gallery, /name="robots" content="noindex, nofollow"/);
  assert.match(gallery, /customer reviews and satisfied-client photos, only with permission/);
  assert.equal(read("sitemap.xml").includes("gallery"), false);
  for (const page of pages) {
    if (page === "gallery.html") continue;
    assert.equal(read(page).includes('href="gallery.html"'), false, `${page} gallery link`);
  }
});

test("form controls on the contact page have matching labels", () => {
  const html = read("contact.html");
  const ids = [...html.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)]
    .map((match) => match[0].match(/\sid="([^"]+)"/)?.[1])
    .filter(Boolean);
  const labels = [...html.matchAll(/<label\b[^>]*>/g)]
    .map((match) => match[0].match(/\sfor="([^"]+)"/)?.[1])
    .filter(Boolean);
  assert.deepEqual(ids.sort(), [...labels].sort());
  assert.match(html, /class="field--hp"/);
  assert.match(html, /name="company"/);
});
