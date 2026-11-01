const assert = require("node:assert/strict");
const test = require("node:test");
const logic = require("./enquiry-sheet-logic.js");

const today = "2026-11-01";
const now = new Date("2026-11-01T19:15:00+02:00");

function validEvent(overrides = {}) {
  return {
    parameter: {
      name: "Sam Naidoo",
      phone: "+27 79 023 5061",
      email: "sam@example.com",
      service: "Private Tour",
      travel_date: "2026-11-02",
      passengers: "2",
      message: "Airport pickup please",
      started_at: String(now.getTime() - 8_000),
      ...overrides,
    },
  };
}

function emptySheet() {
  return {
    ids: Array.from({ length: 12 }, () => ""),
    rows: Array.from({ length: 12 }, (_, i) => ({
      row: i + 2,
      id: "",
      received: "",
      name: "",
      phone: "",
      service: "",
    })),
  };
}

test("server validation requires name, phone and service", () => {
  assert.equal(logic.validateAndSanitize({ name: "A", phone: "", service: "" }, today).error, "name");
  assert.equal(
    logic.validateAndSanitize({ name: "Sam Naidoo", phone: "12", service: "Private Tour" }, today).error,
    "phone",
  );
  assert.equal(
    logic.validateAndSanitize({ name: "Sam Naidoo", phone: "+27 79 023 5061", service: "limousine" }, today).error,
    "service",
  );
  const ok = logic.validateAndSanitize(validEvent().parameter, today);
  assert.equal(ok.error, undefined);
  assert.equal(ok.record.service, "Private Tour");
  assert.equal(ok.record.source, "Website");
});

test("JSON bodies overlay form parameters and formula-like values are quoted", () => {
  const fields = logic.readRequestFields({
    parameter: { name: "Form Name", phone: "+27 79 023 5061", service: "Other" },
    postData: {
      contents: JSON.stringify({
        name: "JSON Name",
        phone: "+27 79 023 5061",
        service: "Wine Tour",
      }),
    },
  });
  assert.equal(fields.name, "JSON Name");
  assert.equal(fields.service, "Wine Tour");
  assert.equal(logic.quoteFormula('=HYPERLINK("http://evil")').startsWith("'"), true);
  assert.equal(logic.quoteFormula("+27 79 023 5061").startsWith("'"), true);
});

test("IDs stay sequential and the first blank Enquiry ID row is reused", () => {
  const ids = ["", "", "BP-0002", "", "BP-0001"];
  assert.equal(logic.nextEnquiryId(ids), "BP-0003");
  assert.equal(logic.firstBlankIdRow(ids), 2);
  assert.equal(logic.nextEnquiryId([]), "BP-0001");
  assert.equal(logic.firstBlankIdRow(["BP-0001", "BP-0002"]), 4);
  const prefilledStatus = Array.from({ length: 1000 }, () => "");
  assert.equal(logic.nextEnquiryId(prefilledStatus), "BP-0001");
  assert.equal(logic.firstBlankIdRow(prefilledStatus), 2);
});

test("honeypot, missing required fields and stale timestamps do not write a row", () => {
  const sheet = emptySheet();
  assert.equal(logic.handleEnquiry(validEvent({ company: "bot" }), sheet, now, today).status, "error");
  assert.equal(logic.handleEnquiry(validEvent({ name: "" }), sheet, now, today).error, "invalid");
  assert.equal(
    logic.handleEnquiry(validEvent({ started_at: String(now.getTime() - 100) }), sheet, now, today).error,
    "invalid",
  );
  assert.equal(logic.handleEnquiry(validEvent(), null, now, today).error, "config");
});

test("valid submissions write the next ID on the first blank row", () => {
  const sheet = emptySheet();
  const result = logic.handleEnquiry(validEvent(), sheet, now, today);
  assert.equal(result.status, "ok");
  assert.equal(result.id, "BP-0001");
  assert.equal(result.row, 2);
  assert.equal(result.record.service, "Private Tour");
});

test("repeat submissions within two minutes return the existing enquiry ID", () => {
  const first = logic.handleEnquiry(validEvent(), emptySheet(), now, today);
  const sheet = {
    ids: [first.id],
    rows: [
      {
        row: 2,
        id: first.id,
        received: "2026-11-01 19:15",
        name: "Sam Naidoo",
        phone: "+27 79 023 5061",
        service: "Private Tour",
      },
    ],
  };
  const second = logic.handleEnquiry(validEvent(), sheet, now, today);
  assert.equal(second.status, "ok");
  assert.equal(second.id, "BP-0001");
  assert.equal(second.duplicate, true);
});
