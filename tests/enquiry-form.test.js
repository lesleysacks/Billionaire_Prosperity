const assert = require("node:assert/strict");
const test = require("node:test");
const enquiry = require("../js/main.js");

const validFields = {
  name: "Sam Naidoo",
  phone: "+27 79 023 5061",
  email: "sam@example.com",
  serviceLabel: "Private Tour",
  pickup: "Cape Town International",
  destination: "Stellenbosch",
  date: "2026-11-02",
  passengers: "2",
  message: "Please keep the day flexible.",
  company: "",
  startedAt: "1730000000000",
};

test("enquiry payload uses Apps Script field names and folds pickup into the message", () => {
  const payload = enquiry.buildEnquiryPayload(validFields);
  assert.equal(payload.name, "Sam Naidoo");
  assert.equal(payload.service, "Private Tour");
  assert.equal(payload.travel_date, "2026-11-02");
  assert.equal(payload.source, "Website");
  assert.match(payload.message, /Pickup: Cape Town International/);
  assert.match(payload.message, /Destination: Stellenbosch/);
  assert.match(payload.message, /Please keep the day flexible/);
  assert.equal(payload.company, "");
  const body = enquiry.encodeEnquiryBody(payload);
  assert.match(body, /travel_date=2026-11-02/);
  assert.match(body, /source=Website/);
});

test("client validation rejects missing required fields and oversized passenger counts", () => {
  const today = "2026-11-01";
  const missing = enquiry.validateEnquiry({ name: "", phone: "", service: "" }, today);
  assert.match(missing.name, /name/i);
  assert.match(missing.phone, /phone/i);
  assert.match(missing.service, /service/i);

  const passengers = enquiry.validateEnquiry(
    {
      name: "Sam Naidoo",
      phone: "+27 79 023 5061",
      service: "private-tour",
      passengers: "51",
    },
    today,
  );
  assert.match(passengers.passengers, /passenger/i);
});

test("parseEnquiryResponse never treats opaque or empty bodies as success", () => {
  assert.deepEqual(enquiry.parseEnquiryResponse("", true, "opaque"), { ok: false, error: "opaque" });
  assert.deepEqual(enquiry.parseEnquiryResponse("", true), { ok: false, error: "empty" });
  assert.equal(enquiry.parseEnquiryResponse("not-json", true).ok, false);
  assert.equal(enquiry.parseEnquiryResponse(JSON.stringify({ status: "ok" }), true).ok, false);
  assert.equal(enquiry.parseEnquiryResponse(JSON.stringify({ status: "error", error: "invalid" }), true).ok, false);
  assert.equal(enquiry.parseEnquiryResponse(JSON.stringify({ status: "ok", id: "BP-0001" }), false).ok, false);
  assert.deepEqual(enquiry.parseEnquiryResponse(JSON.stringify({ status: "ok", id: "BP-0001" }), true), {
    ok: true,
    id: "BP-0001",
    duplicate: false,
  });
});

test("submitEnquiry requires a confirmed enquiry id from CORS JSON", async () => {
  const calls = [];
  const okFetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      type: "cors",
      text: async () => JSON.stringify({ status: "ok", id: "BP-0004" }),
    };
  };
  const payload = enquiry.buildEnquiryPayload(validFields);
  const result = await enquiry.submitEnquiry(enquiry.SITE.formEndpoint, payload, okFetch);
  assert.equal(result.ok, true);
  assert.equal(result.id, "BP-0004");
  assert.equal(calls[0].options.mode, "cors");
  assert.equal(calls[0].options.redirect, "follow");
  assert.match(calls[0].options.headers["Content-Type"], /application\/x-www-form-urlencoded/);
  assert.equal(calls[0].options.method, "POST");

  const opaque = await enquiry.submitEnquiry(enquiry.SITE.formEndpoint, payload, async () => ({
    ok: true,
    type: "opaque",
    text: async () => "",
  }));
  assert.equal(opaque.ok, false);
  assert.equal(opaque.error, "opaque");

  const serverError = await enquiry.submitEnquiry(enquiry.SITE.formEndpoint, payload, async () => ({
    ok: true,
    type: "cors",
    text: async () => JSON.stringify({ status: "error", error: "server" }),
  }));
  assert.equal(serverError.ok, false);
});

test("submit guard blocks overlapping clicks until the first attempt finishes", () => {
  const guard = enquiry.createSubmitGuard();
  assert.equal(guard.begin(), true);
  assert.equal(guard.begin(), false);
  assert.equal(guard.isBusy(), true);
  guard.end();
  assert.equal(guard.begin(), true);
});

test("submitEnquiry confirms a real HTTP JSON response and rejects invalid payloads", async () => {
  const http = require("node:http");
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const params = new URLSearchParams(body);
      const ok = Boolean(params.get("name") && params.get("phone") && params.get("service"));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(ok ? { status: "ok", id: "BP-0007" } : { status: "error", error: "invalid" }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/exec`;
  try {
    const payload = enquiry.buildEnquiryPayload(validFields);
    const saved = await enquiry.submitEnquiry(url, payload);
    assert.equal(saved.ok, true);
    assert.equal(saved.id, "BP-0007");
    const rejected = await enquiry.submitEnquiry(url, { ...payload, name: "", phone: "", service: "" });
    assert.equal(rejected.ok, false);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("honeypot and instant timestamps are rejected before a network call", () => {
  assert.equal(enquiry.isHoneypotFilled("Acme Ltd"), true);
  assert.equal(enquiry.isHoneypotFilled("  "), false);
  const now = 1_700_000_000_000;
  assert.equal(enquiry.isSubmitTimingInvalid(String(now), now + 100), true);
  assert.equal(enquiry.isSubmitTimingInvalid(String(now), now + 5_000), false);
  assert.equal(enquiry.isSubmitTimingInvalid("", now), false);
});
