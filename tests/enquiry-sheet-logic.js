/**
 * Node-testable copy of the enquiry, notification, and dashboard rules in
 * google-apps-script/Code.gs. Keep the two files aligned.
 */

const CONFIG = {
  BUSINESS_NAME: "Billionaire Prosperity",
  BUSINESS_EMAIL: "andremoses100.am@gmail.com",
  BUSINESS_PHONE: "079 023 5061",
  BUSINESS_PHONE_ALT: "062 133 8497",
  WHATSAPP_DISPLAY: "+27 79 023 5061",
  SHEET_URL: "https://docs.google.com/spreadsheets/d/1F2hVNrAnCIa9PeO9e3bKT2e_LYNQ171Dvh0R2HTfL9E/edit",
  ID_PREFIX: "BP-",
  ID_PAD: 4,
  SOURCE: "Website",
  STATUS_NEW: "New",
  LEAD_STATUSES: ["New", "Contacted", "Quoted", "Booked", "Closed"],
  NOTIFY_PENDING: "Pending",
  NOTIFY_SENT: "Sent",
  NOTIFY_FAILED: "Failed",
  NOTIFY_SKIPPED: "Skipped",
  MIN_ELAPSED_MS: 400,
  MAX_ELAPSED_MS: 7 * 24 * 60 * 60 * 1000,
  DUPLICATE_WINDOW_MS: 2 * 60 * 1000,
  SERVICE_LABELS: {
    "airport-transfer": "Airport Transfer",
    "wine-tour": "Wine Tour",
    "business-transport": "Business Transport",
    "private-tour": "Private Tour",
    other: "Other",
  },
  LIMITS: {
    name: 80,
    phone: 20,
    email: 120,
    service: 40,
    travel_date: 10,
    passengers: 4,
    message: 1200,
    source: 40,
  },
  EXISTING_HEADERS: [
    "Enquiry ID",
    "Date Received",
    "Customer Name",
    "Phone",
    "Email",
    "Service",
    "Travel Date",
    "Passengers",
    "Customer Message",
    "Source",
    "Status",
    "Follow-up Date",
    "Quoted Amount",
    "Notes",
  ],
  APPENDED_HEADERS: [
    "Last Contact",
    "Booking Value",
    "Customer Email Status",
    "Business Email Status",
    "Customer Email Sent At",
    "Business Email Sent At",
    "Notify Attempts",
    "Notify Error",
  ],
};

function readRequestFields(event) {
  const fromParams = event && event.parameter ? event.parameter : {};
  let fromJson = {};
  const raw = event && event.postData ? event.postData.contents : "";
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) fromJson = parsed;
    } catch {
      // Form-encoded bodies stay in parameter.
    }
  }
  return { ...fromParams, ...fromJson };
}

function cleanText(value, maxLen) {
  let text = String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > maxLen) text = text.slice(0, maxLen);
  return text;
}

function cleanMultiline(value, maxLen) {
  let text = String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  if (text.length > maxLen) text = text.slice(0, maxLen);
  return text;
}

function quoteFormula(value) {
  const text = String(value ?? "");
  if (/^[=+\-@|]/.test(text)) return `'${text}`;
  return text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeService(value) {
  if (!value) return "";
  if (CONFIG.SERVICE_LABELS[value]) return CONFIG.SERVICE_LABELS[value];
  const match = Object.values(CONFIG.SERVICE_LABELS).find(
    (label) => label.toLowerCase() === String(value).toLowerCase(),
  );
  return match || "";
}

function validateAndSanitize(fields, todayISO) {
  const name = cleanText(fields.name, CONFIG.LIMITS.name);
  const phone = cleanText(fields.phone, CONFIG.LIMITS.phone);
  const email = cleanText(fields.email, CONFIG.LIMITS.email).toLowerCase();
  const service = normalizeService(cleanText(fields.service, CONFIG.LIMITS.service));
  const travelDate = cleanText(fields.travel_date || fields.date, CONFIG.LIMITS.travel_date);
  const passengers = cleanText(fields.passengers, CONFIG.LIMITS.passengers);
  const message = cleanMultiline(fields.message, CONFIG.LIMITS.message);

  if (name.length < 2) return { error: "name" };
  const digits = phone.replace(/\D/g, "");
  if (!phone || !/^[\d\s+()-]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
    return { error: "phone" };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "email" };
  if (!service) return { error: "service" };
  if (travelDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) return { error: "travel_date" };
    if (travelDate < todayISO) return { error: "travel_date" };
  }
  let passengerValue = "";
  if (passengers) {
    if (!/^\d+$/.test(passengers)) return { error: "passengers" };
    const count = Number(passengers);
    if (!count || count < 1 || count > 50) return { error: "passengers" };
    passengerValue = String(count);
  }

  return {
    record: {
      name,
      phone,
      email,
      service,
      travel_date: travelDate,
      passengers: passengerValue,
      message,
      source: CONFIG.SOURCE,
    },
  };
}

function isSubmitTimingInvalid(startedAt, nowMs) {
  if (startedAt == null || startedAt === "") return false;
  const started = Number(startedAt);
  if (!Number.isFinite(started) || started <= 0) return true;
  if (started > nowMs + 5 * 60 * 1000) return true;
  if (nowMs - started < CONFIG.MIN_ELAPSED_MS) return true;
  if (nowMs - started > CONFIG.MAX_ELAPSED_MS) return true;
  return false;
}

function nextEnquiryId(ids) {
  let max = 0;
  for (const id of ids) {
    const match = String(id || "").trim().match(/^BP-(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1]));
  }
  const n = max + 1;
  const padded = String(n);
  const width = Math.max(CONFIG.ID_PAD, padded.length);
  return CONFIG.ID_PREFIX + padded.padStart(width, "0");
}

function firstBlankIdRow(ids) {
  for (let i = 0; i < ids.length; i += 1) {
    if (!String(ids[i] || "").trim()) return i + 2;
  }
  return ids.length + 2;
}

function findRecentDuplicate(rows, record, nowMs) {
  const name = String(record.name || "").toLowerCase();
  const phone = String(record.phone || "").replace(/\D/g, "");
  const service = String(record.service || "").toLowerCase();
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    const id = String(row.id || "").trim();
    if (!id) continue;
    const rowPhone = String(row.phone || "").replace(/\D/g, "");
    if (
      String(row.name || "").trim().toLowerCase() === name &&
      rowPhone === phone &&
      String(row.service || "").trim().toLowerCase() === service
    ) {
      const receivedMs = receivedToMs(row.received);
      if (receivedMs && nowMs - receivedMs <= CONFIG.DUPLICATE_WINDOW_MS) return id;
    }
  }
  return "";
}

function receivedToMs(value) {
  if (!value) return 0;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return 0;
  const date = new Date(
    `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || "00"}+02:00`,
  );
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function parseJourneyDetails(message) {
  const text = String(message || "");
  const pickup = (text.match(/^Pickup:\s*(.+)$/m) || [])[1] || "";
  const destination = (text.match(/^Destination:\s*(.+)$/m) || [])[1] || "";
  const notes = text
    .replace(/^Pickup:\s*.+$/m, "")
    .replace(/^Destination:\s*.+$/m, "")
    .replace(/^\s+|\s+$/g, "")
    .trim();
  return { pickup: pickup.trim(), destination: destination.trim(), notes };
}

function initialNotificationState(email) {
  return {
    customer: String(email || "").trim() ? CONFIG.NOTIFY_PENDING : CONFIG.NOTIFY_SKIPPED,
    business: CONFIG.NOTIFY_PENDING,
    whatsapp: CONFIG.NOTIFY_SKIPPED,
  };
}

function shouldSendNotification(currentStatus) {
  return currentStatus === CONFIG.NOTIFY_PENDING || currentStatus === CONFIG.NOTIFY_FAILED;
}

function handleEnquiry(event, sheetState, now = new Date(), todayISO) {
  const fields = readRequestFields(event);
  if (String(fields.company || "").trim()) return { status: "error", error: "invalid" };
  if (isSubmitTimingInvalid(fields.started_at, now.getTime())) {
    return { status: "error", error: "invalid" };
  }
  const parsed = validateAndSanitize(fields, todayISO);
  if (parsed.error) return { status: "error", error: "invalid" };
  if (!sheetState) return { status: "error", error: "config" };

  const duplicateId = findRecentDuplicate(sheetState.rows, parsed.record, now.getTime());
  if (duplicateId) return { status: "ok", id: duplicateId, duplicate: true };

  const enquiryId = nextEnquiryId(sheetState.ids);
  const row = firstBlankIdRow(sheetState.ids);
  return {
    status: "ok",
    id: enquiryId,
    row,
    record: parsed.record,
    duplicate: false,
    notifications: initialNotificationState(parsed.record.email),
  };
}

function saveEnquiry(store, event, now, todayISO) {
  const result = handleEnquiry(event, store, now, todayISO);
  if (result.status !== "ok") return result;
  if (result.duplicate) return result;

  const notify = result.notifications;
  const lead = {
    row: result.row,
    id: result.id,
    received: formatTimestamp(now),
    name: result.record.name,
    phone: result.record.phone,
    email: result.record.email,
    service: result.record.service,
    travel_date: result.record.travel_date,
    passengers: result.record.passengers,
    message: result.record.message,
    source: result.record.source,
    status: CONFIG.STATUS_NEW,
    followUpDate: "",
    quotedAmount: "",
    notes: "",
    lastContact: "",
    bookingValue: "",
    customerNotify: notify.customer,
    businessNotify: notify.business,
    customerNotifyAt: "",
    businessNotifyAt: "",
    notifyAttempts: 0,
    notifyError: "",
  };
  store.ids[result.row - 2] = result.id;
  store.rows[result.row - 2] = { ...store.rows[result.row - 2], ...lead };
  result.saved = true;
  return result;
}

function formatTimestamp(date) {
  const sast = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  const iso = sast.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function buildCustomerEmail(lead) {
  const journey = parseJourneyDetails(lead.message);
  const details = [
    ["Reference", lead.id],
    ["Service", lead.service],
    ["Travel date", lead.travel_date || "To be confirmed"],
    ["Passengers", lead.passengers || "Not specified"],
    ["Pickup", journey.pickup || "Not specified"],
    ["Destination", journey.destination || "Not specified"],
  ];
  const rows = details
    .map(([label, value]) => `<tr><td style="padding:6px 0;color:#675f56">${escapeHtml(label)}</td><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`)
    .join("");
  const messageBlock = journey.notes
    ? `<p style="white-space:pre-wrap">${escapeHtml(journey.notes)}</p>`
    : "";
  return {
    to: lead.email,
    subject: `${CONFIG.BUSINESS_NAME} — we received enquiry ${lead.id}`,
    html: `<div style="font-family:Georgia,serif;background:#faf7f1;padding:24px;color:#141312">
      <h1 style="font-weight:500;color:#6b2131">${escapeHtml(CONFIG.BUSINESS_NAME)}</h1>
      <p>Dear ${escapeHtml(lead.name)},</p>
      <p>Thank you for your enquiry. We have received it and will reply to confirm availability and the details.</p>
      <p><strong>Your enquiry is not a confirmed booking.</strong> Availability is subject to confirmation.</p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      ${messageBlock}
      <p>You can reach us on ${escapeHtml(CONFIG.BUSINESS_PHONE)}, ${escapeHtml(CONFIG.BUSINESS_PHONE_ALT)}, WhatsApp ${escapeHtml(CONFIG.WHATSAPP_DISPLAY)}, or ${escapeHtml(CONFIG.BUSINESS_EMAIL)}.</p>
      <p>Kind regards,<br>${escapeHtml(CONFIG.BUSINESS_NAME)}</p>
    </div>`,
  };
}

function buildBusinessEmail(lead) {
  const journey = parseJourneyDetails(lead.message);
  const fields = [
    ["Enquiry ID", lead.id],
    ["Received", lead.received],
    ["Name", lead.name],
    ["Phone", lead.phone],
    ["Email", lead.email || "Not supplied"],
    ["Service", lead.service],
    ["Travel date", lead.travel_date || "Not specified"],
    ["Passengers", lead.passengers || "Not specified"],
    ["Pickup", journey.pickup || "Not specified"],
    ["Destination", journey.destination || "Not specified"],
  ];
  const rows = fields
    .map(([label, value]) => `<tr><td style="padding:8px 0;font-size:14px;color:#675f56">${escapeHtml(label)}</td><td style="padding:8px 0;font-size:16px">${escapeHtml(value)}</td></tr>`)
    .join("");
  const notes = journey.notes ? `<p style="white-space:pre-wrap">${escapeHtml(journey.notes)}</p>` : "<p>No extra message.</p>";
  return {
    to: CONFIG.BUSINESS_EMAIL,
    subject: `New enquiry ${lead.id} — ${lead.service}`,
    html: `<div style="font-family:Arial,sans-serif;background:#ffffff;padding:16px;color:#141312;max-width:640px">
      <h1 style="font-size:22px;color:#6b2131">New enquiry</h1>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <h2 style="font-size:16px">Customer message</h2>
      ${notes}
      <p><a href="${CONFIG.SHEET_URL}">Open the enquiry register</a></p>
    </div>`,
  };
}

function deliverNotifications(lead, mailer, now = new Date()) {
  const result = {
    customer: lead.customerNotify,
    business: lead.businessNotify,
    whatsapp: CONFIG.NOTIFY_SKIPPED,
    sent: [],
    failed: [],
  };
  lead.notifyAttempts = Number(lead.notifyAttempts || 0) + 1;
  lead.notifyError = "";

  if (lead.customerNotify === CONFIG.NOTIFY_SKIPPED) {
    result.customer = CONFIG.NOTIFY_SKIPPED;
  } else if (shouldSendNotification(lead.customerNotify)) {
    try {
      mailer.send(buildCustomerEmail(lead));
      lead.customerNotify = CONFIG.NOTIFY_SENT;
      lead.customerNotifyAt = formatTimestamp(now);
      result.customer = CONFIG.NOTIFY_SENT;
      result.sent.push("customer");
    } catch {
      lead.customerNotify = CONFIG.NOTIFY_FAILED;
      lead.notifyError = "customer_send_failed";
      result.customer = CONFIG.NOTIFY_FAILED;
      result.failed.push("customer");
    }
  }

  if (shouldSendNotification(lead.businessNotify)) {
    try {
      mailer.send(buildBusinessEmail(lead));
      lead.businessNotify = CONFIG.NOTIFY_SENT;
      lead.businessNotifyAt = formatTimestamp(now);
      result.business = CONFIG.NOTIFY_SENT;
      result.sent.push("business");
    } catch {
      lead.businessNotify = CONFIG.NOTIFY_FAILED;
      lead.notifyError = lead.notifyError ? `${lead.notifyError},business_send_failed` : "business_send_failed";
      result.business = CONFIG.NOTIFY_FAILED;
      result.failed.push("business");
    }
  }

  return result;
}

function confirmSavedEnquiry(store, event, mailer, now, todayISO) {
  const saved = saveEnquiry(store, event, now, todayISO);
  if (saved.status !== "ok") return saved;
  if (saved.duplicate) {
    saved.notificationsSent = false;
    return saved;
  }
  const lead = store.rows.find((row) => row && row.id === saved.id);
  try {
    saved.delivery = deliverNotifications(lead, mailer, now);
  } catch {
    if (lead.customerNotify === CONFIG.NOTIFY_PENDING) lead.customerNotify = CONFIG.NOTIFY_FAILED;
    if (lead.businessNotify === CONFIG.NOTIFY_PENDING) lead.businessNotify = CONFIG.NOTIFY_FAILED;
    lead.notifyError = "send_failed";
    saved.delivery = { failed: ["exception"] };
  }
  return {
    status: "ok",
    id: saved.id,
    duplicate: false,
    saved: true,
    customerNotify: lead.customerNotify,
    businessNotify: lead.businessNotify,
  };
}

function retryFailedNotifications(store, mailer, now = new Date()) {
  const retried = [];
  for (const lead of store.rows) {
    if (!lead || !lead.id) continue;
    const needsRetry =
      lead.customerNotify === CONFIG.NOTIFY_FAILED || lead.businessNotify === CONFIG.NOTIFY_FAILED;
    if (!needsRetry) continue;
    deliverNotifications(lead, mailer, now);
    retried.push(lead.id);
  }
  return { retried, rowCount: store.rows.filter((row) => row && row.id).length };
}

function numberOrZero(value) {
  if (value === "" || value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function monthKeyFromReceived(value) {
  const text = String(value || "");
  const match = text.match(/^(\d{4}-\d{2})/);
  return match ? match[1] : "";
}

function summariseLeads(rows, todayISO, monthKey) {
  const leads = rows.filter((row) => row && /^BP-\d+$/i.test(String(row.id || "").trim()));
  const byStatus = (status) => leads.filter((row) => row.status === status);
  const booked = byStatus("Booked");
  const quotedValue = leads.reduce((sum, row) => sum + numberOrZero(row.quotedAmount), 0);
  const bookingRevenue = booked.reduce((sum, row) => sum + numberOrZero(row.bookingValue), 0);
  const outstandingFollowUps = leads.filter((row) => {
    if (!row.followUpDate) return false;
    if (row.status === "Booked" || row.status === "Closed") return false;
    return String(row.followUpDate) <= todayISO;
  });
  const inMonth = leads.filter((row) => monthKeyFromReceived(row.received) === monthKey);
  const services = {};
  for (const lead of leads) {
    const service = lead.service || "Other";
    services[service] = (services[service] || 0) + 1;
  }
  return {
    total: leads.length,
    new: byStatus("New").length,
    contacted: byStatus("Contacted").length,
    quoted: byStatus("Quoted").length,
    booked: booked.length,
    closed: byStatus("Closed").length,
    conversionRate: leads.length ? (booked.length / leads.length) * 100 : 0,
    quotedValue,
    bookingRevenue,
    outstandingFollowUps: outstandingFollowUps.length,
    monthlyEnquiries: inMonth.length,
    monthlyBookings: inMonth.filter((row) => row.status === "Booked").length,
    monthlyRevenue: inMonth
      .filter((row) => row.status === "Booked")
      .reduce((sum, row) => sum + numberOrZero(row.bookingValue), 0),
    services,
  };
}

function preservedExistingHeaders(headers) {
  return CONFIG.EXISTING_HEADERS.every((title, index) => headers[index] === title);
}

function allHeaders() {
  return CONFIG.EXISTING_HEADERS.concat(CONFIG.APPENDED_HEADERS);
}

module.exports = {
  CONFIG,
  readRequestFields,
  cleanText,
  quoteFormula,
  escapeHtml,
  validateAndSanitize,
  isSubmitTimingInvalid,
  nextEnquiryId,
  firstBlankIdRow,
  findRecentDuplicate,
  parseJourneyDetails,
  initialNotificationState,
  shouldSendNotification,
  handleEnquiry,
  saveEnquiry,
  buildCustomerEmail,
  buildBusinessEmail,
  deliverNotifications,
  confirmSavedEnquiry,
  retryFailedNotifications,
  summariseLeads,
  preservedExistingHeaders,
  allHeaders,
};
