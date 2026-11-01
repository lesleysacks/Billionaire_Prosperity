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

test("customer confirmation goes only to the submitted customer email", () => {
  const store = emptyStore();
  const mailer = recordingMailer();
  logic.confirmSavedEnquiry(store, validEvent(), mailer, now, today);
  const customer = mailer.sent.find((msg) => msg.subject.includes("we received enquiry"));
  assert.ok(customer);
  assert.equal(customer.to, "sam@example.com");
  assert.equal(customer.to, logic.resolveCustomerRecipient({ email: "sam@example.com" }));
  assert.notEqual(customer.to, logic.CONFIG.BUSINESS_EMAIL);
  assert.equal(customer.cc, undefined);
  assert.equal(customer.bcc, undefined);
});

test("customer confirmation never falls back to the business address", () => {
  const email = logic.buildCustomerEmail({
    id: "BP-0001",
    name: "Sam Naidoo",
    email: "",
    service: "Wine Tour",
  });
  assert.equal(email.to, "");
  assert.notEqual(email.to, "andremoses100.am@gmail.com");
  assert.throws(
    () => logic.assertSafeOutgoingEmail({ to: "andremoses100.am@gmail.com", subject: "x" }, "customer", { email: "" }),
    /missing_customer_recipient|invalid_customer_recipient/,
  );
});

test("business notification goes only to andremoses100.am@gmail.com", () => {
  const store = emptyStore();
  const mailer = recordingMailer();
  logic.confirmSavedEnquiry(store, validEvent(), mailer, now, today);
  const businessMessages = mailer.sent.filter((msg) => msg.subject.startsWith("New enquiry"));
  assert.equal(businessMessages.length, 1);
  assert.equal(businessMessages[0].to, "andremoses100.am@gmail.com");
  assert.equal(businessMessages[0].to, logic.resolveBusinessRecipient());
  assert.equal(businessMessages[0].cc, undefined);
  assert.equal(businessMessages[0].bcc, undefined);
  assert.equal(mailer.sent.filter((msg) => msg.to === "sam@example.com").length, 1);
});

test("lesleysacks1@gmail.com is never used as a business recipient", () => {
  const original = logic.CONFIG.BUSINESS_EMAIL;
  logic.CONFIG.BUSINESS_EMAIL = "lesleysacks1@gmail.com";
  try {
    assert.equal(logic.resolveBusinessRecipient(), "");
    assert.equal(logic.isBlockedBusinessRecipient("lesleysacks1@gmail.com"), true);
    const store = emptyStore();
    const mailer = recordingMailer();
    const result = logic.confirmSavedEnquiry(store, validEvent(), mailer, now, today);
    assert.equal(result.status, "ok");
    assert.equal(result.id, "BP-0001");
    assert.equal(result.customerNotify, "Sent");
    assert.equal(result.businessNotify, "Failed");
    assert.match(store.rows[0].notifyError, /invalid_business_recipient/);
    assert.equal(
      mailer.sent.some((msg) => logic.normalizeEmail(msg.to) === "lesleysacks1@gmail.com"),
      false,
    );
    assert.equal(mailer.sent.filter((msg) => msg.subject.startsWith("New enquiry")).length, 0);
    assert.equal(mailer.sent[0].to, "sam@example.com");
  } finally {
    logic.CONFIG.BUSINESS_EMAIL = original;
  }
});

test("personal Gmail can be the customer recipient but never the business recipient", () => {
  const store = emptyStore();
  const mailer = recordingMailer();
  logic.confirmSavedEnquiry(
    store,
    validEvent({ email: "lesleysacks1@gmail.com" }),
    mailer,
    now,
    today,
  );
  const customer = mailer.sent.find((msg) => msg.subject.includes("we received enquiry"));
  const business = mailer.sent.find((msg) => msg.subject.startsWith("New enquiry"));
  assert.equal(customer.to, "lesleysacks1@gmail.com");
  assert.equal(business.to, "andremoses100.am@gmail.com");
  assert.notEqual(business.to, "lesleysacks1@gmail.com");
});

test("missing customer email does not prevent the business notification", () => {
  const store = emptyStore();
  const mailer = recordingMailer();
  const result = logic.confirmSavedEnquiry(store, validEvent({ email: "" }), mailer, now, today);
  assert.equal(result.status, "ok");
  assert.equal(result.id, "BP-0001");
  assert.equal(result.customerNotify, "Skipped");
  assert.equal(result.businessNotify, "Sent");
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].to, "andremoses100.am@gmail.com");
  assert.match(mailer.sent[0].subject, /New enquiry BP-0001/);
});

test("failed email attempts can be retried safely without changing the enquiry", () => {
  const store = emptyStore();
  const failing = recordingMailer(["sam@example.com", "andremoses100.am@gmail.com"]);
  logic.confirmSavedEnquiry(store, validEvent(), failing, now, today);
  const before = {
    id: store.rows[0].id,
    name: store.rows[0].name,
    email: store.rows[0].email,
    status: store.rows[0].status,
  };
  const retryMailer = recordingMailer();
  const retry = logic.retryFailedNotifications(store, retryMailer, now);
  assert.deepEqual(retry.retried, ["BP-0001"]);
  assert.equal(store.rows[0].id, before.id);
  assert.equal(store.rows[0].name, before.name);
  assert.equal(store.rows[0].email, before.email);
  assert.equal(store.rows[0].status, before.status);
  assert.equal(store.rows[0].customerNotify, "Sent");
  assert.equal(store.rows[0].businessNotify, "Sent");
  assert.equal(retryMailer.sent.length, 2);
  assert.equal(
    retryMailer.sent.filter((msg) => msg.to === "andremoses100.am@gmail.com").length,
    1,
  );
});

test("already-sent notifications are not sent again by POST, retry, or the trigger", () => {
  const store = emptyStore();
  const mailer = recordingMailer();
  logic.confirmSavedEnquiry(store, validEvent(), mailer, now, today);
  assert.equal(mailer.sent.length, 2);
  const retry = logic.retryFailedNotifications(store, mailer, now);
  const pending = logic.processPendingNotifications(store, mailer, now);
  const second = logic.confirmSavedEnquiry(store, validEvent(), mailer, now, today);
  assert.deepEqual(retry.retried, []);
  assert.deepEqual(pending.processed, []);
  assert.equal(second.duplicate, true);
  assert.equal(mailer.sent.length, 2);
});

test("concurrent POST and trigger executions cannot send the same notification twice", () => {
  const store = emptyStore();
  const lock = logic.createNotificationLock();
  const claims = logic.createClaimStore();
  const mailer = recordingMailer();
  let triggerResult;

  const intercepting = {
    sent: mailer.sent,
    send(message) {
      triggerResult = logic.processPendingNotifications(store, mailer, now, { lock, claims });
      mailer.sent.push(message);
    },
  };

  const result = logic.confirmSavedEnquiry(store, validEvent(), intercepting, now, today, {
    lock,
    claims,
  });
  assert.equal(result.status, "ok");
  assert.equal(result.customerNotify, "Sent");
  assert.equal(result.businessNotify, "Sent");
  assert.equal(triggerResult.status, "busy");
  assert.equal(mailer.sent.filter((msg) => msg.to === "sam@example.com").length, 1);
  assert.equal(mailer.sent.filter((msg) => msg.to === "andremoses100.am@gmail.com").length, 1);
});

test("claim store blocks a second worker that still sees Pending", () => {
  const claims = logic.createClaimStore();
  const mailer = recordingMailer();
  const shared = {
    id: "BP-0099",
    name: "Sam Naidoo",
    email: "sam@example.com",
    service: "Private Tour",
    customerNotify: "Pending",
    businessNotify: "Pending",
    notifyAttempts: 0,
    notifyError: "",
  };
  const stale = {
    ...shared,
    customerNotify: "Pending",
    businessNotify: "Pending",
  };

  let nested;
  const intercepting = {
    sent: mailer.sent,
    send(message) {
      nested = logic.deliverNotifications(stale, mailer, now, { claims });
      mailer.sent.push(message);
    },
  };

  const first = logic.deliverNotifications(shared, intercepting, now, { claims });
  assert.equal(first.status, "ok");
  assert.equal(nested.status, "busy");
  assert.equal(mailer.sent.filter((msg) => msg.to === "andremoses100.am@gmail.com").length, 1);
  assert.equal(mailer.sent.filter((msg) => msg.to === "sam@example.com").length, 1);
});

test("existing enquiry data remains intact when routing rules change", () => {
  const store = emptyStore();
  store.ids[0] = "BP-0001";
  store.rows[0] = {
    row: 2,
    id: "BP-0001",
    received: "2026-10-01 09:00",
    name: "Historical Lead",
    phone: "0791234567",
    email: "old@example.com",
    service: "Wine Tour",
    travel_date: "2026-10-12",
    passengers: "2",
    message: "Keep this row",
    source: "Website",
    status: "Contacted",
    followUpDate: "2026-10-05",
    quotedAmount: 1800,
    notes: "Called",
    lastContact: "2026-10-02",
    bookingValue: "",
    customerNotify: "Sent",
    businessNotify: "Sent",
    customerNotifyAt: "2026-10-01 09:01",
    businessNotifyAt: "2026-10-01 09:01",
    notifyAttempts: 1,
    notifyError: "",
  };
  const snapshot = JSON.parse(JSON.stringify(store.rows[0]));
  const mailer = recordingMailer();
  logic.retryFailedNotifications(store, mailer, now);
  logic.processPendingNotifications(store, mailer, now);
  const original = logic.CONFIG.BUSINESS_EMAIL;
  logic.CONFIG.BUSINESS_EMAIL = "lesleysacks1@gmail.com";
  try {
    logic.processPendingNotifications(store, mailer, now);
  } finally {
    logic.CONFIG.BUSINESS_EMAIL = original;
  }
  assert.deepEqual(store.rows[0], snapshot);
  assert.equal(mailer.sent.length, 0);
});

test("business emails reject CC, BCC, and non-allowlisted recipients", () => {
  const lead = { id: "BP-0001", email: "sam@example.com", name: "Sam", service: "Wine Tour" };
  assert.throws(
    () =>
      logic.assertSafeOutgoingEmail(
        { to: "andremoses100.am@gmail.com", cc: "lesleysacks1@gmail.com", subject: "x" },
        "business",
        lead,
      ),
    /copy_recipients_forbidden/,
  );
  assert.throws(
    () =>
      logic.assertSafeOutgoingEmail(
        { to: "lesleysacks1@gmail.com", subject: "x" },
        "business",
        lead,
      ),
    /invalid_business_recipient|blocked_business_recipient/,
  );
  assert.throws(
    () =>
      logic.assertSafeOutgoingEmail({ to: "sam@example.com", subject: "x" }, "business", lead),
    /invalid_business_recipient/,
  );
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
