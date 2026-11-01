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
      message: "Pickup: Cape Town International\nDestination: Stellenbosch\n\nPlease keep the morning flexible.",
      started_at: String(now.getTime() - 8_000),
      ...overrides,
    },
  };
}

function emptyStore() {
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

function recordingMailer(failOn = []) {
  const sent = [];
  return {
    sent,
    send(message) {
      if (failOn.includes(message.to)) throw new Error("smtp_failed");
      sent.push(message);
    },
  };
}

test("valid enquiry is saved with a sequential BP ID before notifications", () => {
  const store = emptyStore();
  const mailer = recordingMailer();
  const result = logic.confirmSavedEnquiry(store, validEvent(), mailer, now, today);
  assert.equal(result.status, "ok");
  assert.equal(result.id, "BP-0001");
  assert.equal(result.saved, true);
  assert.equal(store.rows[0].id, "BP-0001");
  assert.equal(store.rows[0].status, "New");
});

test("customer confirmation email is sent when an email address exists", () => {
  const store = emptyStore();
  const mailer = recordingMailer();
  const result = logic.confirmSavedEnquiry(store, validEvent(), mailer, now, today);
  assert.equal(result.customerNotify, "Sent");
  const customer = mailer.sent.find((msg) => msg.to === "sam@example.com");
  assert.ok(customer);
  assert.match(customer.subject, /BP-0001/);
  assert.match(customer.html, /not a confirmed booking/i);
  assert.match(customer.html, /Private Tour/);
  assert.match(customer.html, /Stellenbosch/);
  assert.equal(customer.html.includes("<script>"), false);
});

test("customer notification is skipped when email is absent", () => {
  const store = emptyStore();
  const mailer = recordingMailer();
  const result = logic.confirmSavedEnquiry(store, validEvent({ email: "" }), mailer, now, today);
  assert.equal(result.status, "ok");
  assert.equal(result.customerNotify, "Skipped");
  assert.equal(
    mailer.sent.some((msg) => msg.subject.includes("we received enquiry")),
    false,
  );
});

test("business notification is sent for a saved enquiry", () => {
  const store = emptyStore();
  const mailer = recordingMailer();
  logic.confirmSavedEnquiry(store, validEvent(), mailer, now, today);
  const business = mailer.sent.find((msg) => msg.to === "andremoses100.am@gmail.com");
  assert.ok(business);
  assert.match(business.subject, /BP-0001/);
  assert.match(business.html, /Sam Naidoo/);
  assert.match(business.html, /\+27 79 023 5061/);
  assert.match(business.html, /docs.google.com\/spreadsheets/);
});

test("email failure does not lose a saved enquiry or change the public result", () => {
  const store = emptyStore();
  const mailer = recordingMailer(["sam@example.com", "andremoses100.am@gmail.com"]);
  const result = logic.confirmSavedEnquiry(store, validEvent(), mailer, now, today);
  assert.equal(result.status, "ok");
  assert.equal(result.id, "BP-0001");
  assert.equal(store.rows[0].id, "BP-0001");
  assert.equal(store.rows[0].customerNotify, "Failed");
  assert.equal(store.rows[0].businessNotify, "Failed");
  assert.equal(store.rows[0].notifyError.includes("send_failed"), true);
});

test("failed notifications can be retried without creating another enquiry", () => {
  const store = emptyStore();
  const failing = recordingMailer(["sam@example.com", "andremoses100.am@gmail.com"]);
  logic.confirmSavedEnquiry(store, validEvent(), failing, now, today);
  assert.equal(store.rows.filter((row) => row && row.id).length, 1);

  const retryMailer = recordingMailer();
  const retry = logic.retryFailedNotifications(store, retryMailer, now);
  assert.deepEqual(retry.retried, ["BP-0001"]);
  assert.equal(retry.rowCount, 1);
  assert.equal(store.rows[0].id, "BP-0001");
  assert.equal(store.rows[0].customerNotify, "Sent");
  assert.equal(store.rows[0].businessNotify, "Sent");
  assert.equal(retryMailer.sent.length, 2);
});

test("duplicate submissions do not create duplicate notifications", () => {
  const store = emptyStore();
  const mailer = recordingMailer();
  const first = logic.confirmSavedEnquiry(store, validEvent(), mailer, now, today);
  const second = logic.confirmSavedEnquiry(store, validEvent(), mailer, now, today);
  assert.equal(first.id, "BP-0001");
  assert.equal(second.duplicate, true);
  assert.equal(second.id, "BP-0001");
  assert.equal(store.rows.filter((row) => row && row.id).length, 1);
  assert.equal(mailer.sent.length, 2);
});

test("already-sent notifications are not sent again on retry", () => {
  const store = emptyStore();
  const mailer = recordingMailer();
  logic.confirmSavedEnquiry(store, validEvent(), mailer, now, today);
  const retry = logic.retryFailedNotifications(store, mailer, now);
  assert.deepEqual(retry.retried, []);
  assert.equal(mailer.sent.length, 2);
});

test("customer-supplied HTML is escaped in email bodies", () => {
  const email = logic.buildCustomerEmail({
    id: "BP-0003",
    name: '<img src=x onerror=alert(1)>',
    email: "sam@example.com",
    service: "Wine Tour",
    travel_date: "2026-11-02",
    passengers: "2",
    message: 'Pickup: <script>alert(1)</script>\nDestination: Paarl',
  });
  assert.equal(email.html.includes("<script>"), false);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /&lt;img/);
});

test("status dropdown values stay New, Contacted, Quoted, Booked, Closed", () => {
  assert.deepEqual(logic.CONFIG.LEAD_STATUSES, ["New", "Contacted", "Quoted", "Booked", "Closed"]);
});

test("historical spreadsheet columns remain the first fourteen headers", () => {
  const headers = logic.allHeaders();
  assert.equal(logic.preservedExistingHeaders(headers), true);
  assert.equal(headers[0], "Enquiry ID");
  assert.equal(headers[13], "Notes");
  assert.equal(headers[14], "Last Contact");
  assert.equal(headers[15], "Booking Value");
  assert.equal(headers.includes("Customer Email Status"), true);
});

test("revenue calculations exclude quotes and closed enquiries", () => {
  const summary = logic.summariseLeads(
    [
      { id: "BP-0001", status: "Quoted", quotedAmount: 2500, bookingValue: "", received: "2026-11-01 09:00", service: "Wine Tour" },
      { id: "BP-0002", status: "Booked", quotedAmount: 3000, bookingValue: 2800, received: "2026-11-01 10:00", service: "Private Tour" },
      { id: "BP-0003", status: "Closed", quotedAmount: 1800, bookingValue: 1800, received: "2026-10-12 10:00", service: "Airport Transfer" },
      { id: "", status: "New", quotedAmount: 9999, bookingValue: 9999, received: "2026-11-01 11:00", service: "Other" },
    ],
    today,
    "2026-11",
  );
  assert.equal(summary.total, 3);
  assert.equal(summary.quoted, 1);
  assert.equal(summary.booked, 1);
  assert.equal(summary.quotedValue, 7300);
  assert.equal(summary.bookingRevenue, 2800);
  assert.equal(summary.monthlyEnquiries, 2);
  assert.equal(summary.monthlyBookings, 1);
  assert.equal(summary.monthlyRevenue, 2800);
});

test("conversion rate is confirmed bookings divided by total enquiries", () => {
  const summary = logic.summariseLeads(
    [
      { id: "BP-0001", status: "New", quotedAmount: "", bookingValue: "", received: "2026-11-01 09:00", service: "Wine Tour" },
      { id: "BP-0002", status: "Contacted", quotedAmount: "", bookingValue: "", received: "2026-11-01 10:00", service: "Wine Tour" },
      { id: "BP-0003", status: "Quoted", quotedAmount: 1000, bookingValue: "", received: "2026-11-01 11:00", service: "Wine Tour" },
      { id: "BP-0004", status: "Booked", quotedAmount: 1000, bookingValue: 900, received: "2026-11-01 12:00", service: "Wine Tour" },
    ],
    today,
    "2026-11",
  );
  assert.equal(summary.total, 4);
  assert.equal(summary.booked, 1);
  assert.equal(summary.conversionRate, 25);
  assert.equal(summary.services["Wine Tour"], 4);
});

test("overdue follow-ups ignore booked and closed leads", () => {
  const summary = logic.summariseLeads(
    [
      { id: "BP-0001", status: "New", followUpDate: "2026-10-31", received: "2026-10-20 09:00", service: "Other" },
      { id: "BP-0002", status: "Contacted", followUpDate: "2026-11-01", received: "2026-10-21 09:00", service: "Other" },
      { id: "BP-0003", status: "Quoted", followUpDate: "2026-11-10", received: "2026-10-22 09:00", service: "Other" },
      { id: "BP-0004", status: "Booked", followUpDate: "2026-10-01", received: "2026-10-23 09:00", service: "Other", bookingValue: 500 },
      { id: "BP-0005", status: "Closed", followUpDate: "2026-10-01", received: "2026-10-24 09:00", service: "Other" },
    ],
    today,
    "2026-11",
  );
  assert.equal(summary.outstandingFollowUps, 2);
});
