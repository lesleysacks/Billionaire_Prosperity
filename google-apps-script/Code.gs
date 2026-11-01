/**
 * Billionaire Prosperity enquiry web app and private lead register.
 *
 * Paste this whole file into the Apps Script project bound to
 * "Billionaire Prosperity - Enquiry Register", then deploy as a web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * After deploying, run setupLeadManagement() once from the
 * Billionaire Prosperity menu (or the editor). That adds columns,
 * the private Dashboard tab, validations, and retry triggers.
 * Do not run it again only to change BUSINESS_EMAIL; the public
 * /exec URL uses the deployed version, while triggers use saved code.
 *
 * Keep this logic aligned with tests/enquiry-sheet-logic.js.
 *
 * Enquiries columns A–N are historical and must not be reordered:
 *   A Enquiry ID | B Date Received | C Customer Name | D Phone | E Email
 *   F Service | G Travel Date | H Passengers | I Customer Message
 *   J Source | K Status | L Follow-up Date | M Quoted Amount | N Notes
 * Appended:
 *   O Last Contact | P Booking Value
 *   Q Customer Email Status | R Business Email Status
 *   S Customer Email Sent At | T Business Email Sent At
 *   U Notify Attempts | V Notify Error
 */

const CONFIG = {
  SHEET_ID: "1F2hVNrAnCIa9PeO9e3bKT2e_LYNQ171Dvh0R2HTfL9E",
  SHEET_NAME: "Enquiries",
  DASHBOARD_NAME: "Dashboard",
  SHEET_URL: "https://docs.google.com/spreadsheets/d/1F2hVNrAnCIa9PeO9e3bKT2e_LYNQ171Dvh0R2HTfL9E/edit",
  TIMEZONE: "Africa/Johannesburg",
  BUSINESS_NAME: "Billionaire Prosperity",
  BUSINESS_EMAIL: "andremoses100.am@gmail.com",
  REQUIRED_BUSINESS_EMAIL: "andremoses100.am@gmail.com",
  BLOCKED_BUSINESS_RECIPIENTS: ["lesleysacks1@gmail.com"],
  BUSINESS_PHONE: "079 023 5061",
  BUSINESS_PHONE_ALT: "062 133 8497",
  WHATSAPP_DISPLAY: "+27 79 023 5061",
  ID_PREFIX: "BP-",
  ID_PAD: 4,
  STATUS_NEW: "New",
  SOURCE: "Website",
  LEAD_STATUSES: ["New", "Contacted", "Quoted", "Booked", "Closed"],
  NOTIFY_PENDING: "Pending",
  NOTIFY_SENT: "Sent",
  NOTIFY_FAILED: "Failed",
  NOTIFY_SKIPPED: "Skipped",
  MIN_ELAPSED_MS: 400,
  MAX_ELAPSED_MS: 7 * 24 * 60 * 60 * 1000,
  DUPLICATE_WINDOW_MS: 2 * 60 * 1000,
  LOCK_MS: 15000,
  NOTIFY_CLAIM_TTL_MS: 5 * 60 * 1000,
  ALLOWED_SERVICES: [
    "Airport Transfer",
    "Wine Tour",
    "Business Transport",
    "Private Tour",
    "Other",
    "airport-transfer",
    "wine-tour",
    "business-transport",
    "private-tour",
    "other",
  ],
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
    company: 80,
  },
  COL: {
    id: 1,
    received: 2,
    name: 3,
    phone: 4,
    email: 5,
    service: 6,
    travelDate: 7,
    passengers: 8,
    message: 9,
    source: 10,
    status: 11,
    followUp: 12,
    quotedAmount: 13,
    notes: 14,
    lastContact: 15,
    bookingValue: 16,
    customerNotify: 17,
    businessNotify: 18,
    customerNotifyAt: 19,
    businessNotifyAt: 20,
    notifyAttempts: 21,
    notifyError: 22,
  },
  HEADERS: [
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

function doGet() {
  return jsonOutput({ status: "ok", service: "enquiry" });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let saved = { status: "error", error: "server" };
  try {
    if (!lock.tryLock(CONFIG.LOCK_MS)) {
      logEvent("busy");
      return jsonOutput({ status: "error", error: "busy" });
    }
    saved = handleEnquiry(e);
    // Keep the script lock through send so the 5-minute trigger cannot also
    // claim the same Pending row before this execution writes Sent/Failed.
    if (saved && saved.status === "ok" && saved.id && !saved.duplicate) {
      try {
        deliverNotificationsForId(saved.id);
      } catch (notifyErr) {
        logEvent("notify_failed", saved.id);
      }
    }
  } catch (err) {
    logEvent("server");
    return jsonOutput({ status: "error", error: "server" });
  } finally {
    try {
      lock.releaseLock();
    } catch (releaseErr) {
      // Ignore unlock failures so the client still receives a response.
    }
  }

  if (saved && saved.status === "ok" && saved.id) {
    return jsonOutput({ status: "ok", id: saved.id, duplicate: Boolean(saved.duplicate) });
  }
  return jsonOutput({ status: "error", error: saved && saved.error ? saved.error : "server" });
}

function handleEnquiry(e) {
  const fields = readRequestFields(e);
  const honeypot = String(fields.company || "").trim();
  if (honeypot) {
    logEvent("spam");
    return { status: "error", error: "invalid" };
  }

  const now = new Date();
  if (isSubmitTimingInvalid(fields.started_at, now.getTime())) {
    logEvent("timing");
    return { status: "error", error: "invalid" };
  }

  const parsed = validateAndSanitize(fields, now);
  if (parsed.error) {
    logEvent("invalid");
    return { status: "error", error: "invalid" };
  }

  const sheet = openEnquiriesSheet();
  if (!sheet) {
    logEvent("config");
    return { status: "error", error: "config" };
  }

  ensureLeadColumns(sheet);
  const table = readIdTable(sheet);
  const duplicateId = findRecentDuplicate(table.rows, parsed.record, now.getTime());
  if (duplicateId) {
    logEvent("duplicate", duplicateId);
    return { status: "ok", id: duplicateId, duplicate: true };
  }

  const enquiryId = nextEnquiryId(table.ids);
  const row = firstBlankIdRow(table.ids);
  const values = [
    enquiryId,
    formatTimestamp(now),
    quoteFormula(parsed.record.name),
    quoteFormula(parsed.record.phone),
    quoteFormula(parsed.record.email),
    quoteFormula(parsed.record.service),
    parsed.record.travel_date,
    parsed.record.passengers,
    quoteFormula(parsed.record.message),
    parsed.record.source,
    CONFIG.STATUS_NEW,
  ];

  writeEnquiryRow(sheet, row, values);
  const notify = initialNotificationState(parsed.record.email);
  writeNotificationState(sheet, row, {
    customer: notify.customer,
    business: notify.business,
    customerAt: "",
    businessAt: "",
    attempts: 0,
    error: "",
  });
  SpreadsheetApp.flush();
  logEvent("saved", enquiryId);
  return { status: "ok", id: enquiryId, duplicate: false, row: row };
}

function openSpreadsheet() {
  try {
    return SpreadsheetApp.openById(CONFIG.SHEET_ID);
  } catch (err) {
    return null;
  }
}

function openEnquiriesSheet() {
  const ss = openSpreadsheet();
  return ss ? ss.getSheetByName(CONFIG.SHEET_NAME) : null;
}

function readRequestFields(e) {
  const fromParams = e && e.parameter ? e.parameter : {};
  let fromJson = {};
  const raw = e && e.postData ? e.postData.contents : "";
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        fromJson = parsed;
      }
    } catch (err) {
      // Form-encoded bodies are already in e.parameter.
    }
  }
  return Object.assign({}, fromParams, fromJson);
}

function validateAndSanitize(fields, now) {
  const name = cleanText(fields.name, CONFIG.LIMITS.name);
  const phone = cleanText(fields.phone, CONFIG.LIMITS.phone);
  const email = cleanText(fields.email, CONFIG.LIMITS.email).toLowerCase();
  const serviceRaw = cleanText(fields.service, CONFIG.LIMITS.service);
  const travelDate = cleanText(fields.travel_date || fields.date, CONFIG.LIMITS.travel_date);
  const passengers = cleanText(fields.passengers, CONFIG.LIMITS.passengers);
  const message = cleanMultiline(fields.message, CONFIG.LIMITS.message);

  if (name.length < 2) return { error: "name" };

  const digits = phone.replace(/\D/g, "");
  if (!phone || !/^[\d\s+()-]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
    return { error: "phone" };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "email" };

  const service = normalizeService(serviceRaw);
  if (!service) return { error: "service" };

  if (travelDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) return { error: "travel_date" };
    const today = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd");
    if (travelDate < today) return { error: "travel_date" };
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
      name: name,
      phone: phone,
      email: email,
      service: service,
      travel_date: travelDate,
      passengers: passengerValue,
      message: message,
      source: CONFIG.SOURCE,
    },
  };
}

function normalizeService(value) {
  if (!value) return "";
  if (CONFIG.SERVICE_LABELS[value]) return CONFIG.SERVICE_LABELS[value];
  const allowed = CONFIG.ALLOWED_SERVICES;
  for (let i = 0; i < allowed.length; i++) {
    if (allowed[i].toLowerCase() === value.toLowerCase()) {
      return CONFIG.SERVICE_LABELS[allowed[i]] || allowed[i];
    }
  }
  return "";
}

function cleanText(value, maxLen) {
  let text = String(value == null ? "" : value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > maxLen) text = text.slice(0, maxLen);
  return text;
}

function cleanMultiline(value, maxLen) {
  let text = String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  if (text.length > maxLen) text = text.slice(0, maxLen);
  return text;
}

function quoteFormula(value) {
  const text = String(value == null ? "" : value);
  if (/^[=+\-@|]/.test(text)) return "'" + text;
  return text;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEmail(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase();
}

function isBlockedBusinessRecipient(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const blocked = CONFIG.BLOCKED_BUSINESS_RECIPIENTS;
  for (let i = 0; i < blocked.length; i++) {
    if (normalizeEmail(blocked[i]) === normalized) return true;
  }
  return false;
}

function resolveBusinessRecipient() {
  const configured = normalizeEmail(CONFIG.BUSINESS_EMAIL);
  const required = normalizeEmail(CONFIG.REQUIRED_BUSINESS_EMAIL);
  if (!configured || !required) return "";
  if (configured !== required) return "";
  if (isBlockedBusinessRecipient(configured) || isBlockedBusinessRecipient(required)) return "";
  return required;
}

function resolveCustomerRecipient(lead) {
  return normalizeEmail(lead && lead.email);
}

function hasCopyRecipients(message) {
  if (!message) return false;
  return Boolean(message.cc || message.bcc || message.CC || message.Bcc || message.BCC);
}

function assertSafeOutgoingEmail(message, kind, lead) {
  if (!message || typeof message !== "object") {
    throw new Error("invalid_message");
  }
  if (hasCopyRecipients(message)) {
    throw new Error("copy_recipients_forbidden");
  }
  const to = normalizeEmail(message.to);
  if (kind === "customer") {
    const expected = resolveCustomerRecipient(lead);
    if (!expected) throw new Error("missing_customer_recipient");
    if (to !== expected) throw new Error("invalid_customer_recipient");
    return to;
  }
  if (kind === "business") {
    const expected = resolveBusinessRecipient();
    if (!expected || to !== expected) throw new Error("invalid_business_recipient");
    if (isBlockedBusinessRecipient(to)) throw new Error("blocked_business_recipient");
    return to;
  }
  throw new Error("unknown_email_kind");
}

function sendValidatedEmail(mailer, message, kind, lead) {
  const to = assertSafeOutgoingEmail(message, kind, lead);
  mailer.send({
    to: to,
    subject: message.subject,
    html: message.html,
    name: CONFIG.BUSINESS_NAME,
  });
}

function notificationClaimKey_(enquiryId, kind) {
  return "notify_claim_" + enquiryId + "_" + kind;
}

function tryClaimNotification_(enquiryId, kind, now) {
  if (!enquiryId || !kind) return false;
  try {
    const props = PropertiesService.getScriptProperties();
    const key = notificationClaimKey_(enquiryId, kind);
    const existing = props.getProperty(key);
    if (existing) {
      const claimedAt = Number(existing);
      if (isFinite(claimedAt) && now.getTime() - claimedAt < CONFIG.NOTIFY_CLAIM_TTL_MS) {
        return false;
      }
    }
    props.setProperty(key, String(now.getTime()));
    return true;
  } catch (err) {
    return true;
  }
}

function releaseNotificationClaim_(enquiryId, kind) {
  try {
    PropertiesService.getScriptProperties().deleteProperty(notificationClaimKey_(enquiryId, kind));
  } catch (err) {
    // Ignore claim cleanup failures.
  }
}

function isSubmitTimingInvalid(startedAt, nowMs) {
  if (startedAt == null || startedAt === "") return false;
  const started = Number(startedAt);
  if (!isFinite(started) || started <= 0) return true;
  if (started > nowMs + 5 * 60 * 1000) return true;
  if (nowMs - started < CONFIG.MIN_ELAPSED_MS) return true;
  if (nowMs - started > CONFIG.MAX_ELAPSED_MS) return true;
  return false;
}

function readIdTable(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const height = Math.max(lastRow - 1, 1);
  const values = lastRow < 2 ? [] : sheet.getRange(2, 1, height, 10).getValues();
  const ids = [];
  const rows = [];
  for (let i = 0; i < values.length; i++) {
    ids.push(values[i][0]);
    rows.push({
      row: i + 2,
      id: values[i][0],
      received: values[i][1],
      name: values[i][2],
      phone: values[i][3],
      service: values[i][5],
    });
  }
  return { ids: ids, rows: rows };
}

function nextEnquiryId(ids) {
  let max = 0;
  for (let i = 0; i < ids.length; i++) {
    const match = String(ids[i] || "")
      .trim()
      .match(/^BP-(\d+)$/i);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  const n = max + 1;
  const padded = String(n);
  const width = Math.max(CONFIG.ID_PAD, padded.length);
  return CONFIG.ID_PREFIX + padded.padStart(width, "0");
}

function firstBlankIdRow(ids) {
  for (let i = 0; i < ids.length; i++) {
    if (!String(ids[i] || "").trim()) return i + 2;
  }
  return ids.length + 2;
}

function findRecentDuplicate(rows, record, nowMs) {
  const name = String(record.name || "").toLowerCase();
  const phone = String(record.phone || "").replace(/\D/g, "");
  const service = String(record.service || "").toLowerCase();
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const id = String(row.id || "").trim();
    if (!id) continue;
    const rowName = String(row.name || "")
      .trim()
      .toLowerCase();
    const rowPhone = String(row.phone || "").replace(/\D/g, "");
    const rowService = String(row.service || "")
      .trim()
      .toLowerCase();
    if (rowName !== name || rowPhone !== phone || rowService !== service) continue;
    const receivedMs = receivedToMs(row.received);
    if (receivedMs && nowMs - receivedMs <= CONFIG.DUPLICATE_WINDOW_MS) return id;
  }
  return "";
}

function receivedToMs(value) {
  if (!value) return 0;
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value.getTime();
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return 0;
  const iso = match[1] + "-" + match[2] + "-" + match[3] + "T" + match[4] + ":" + match[5] + ":" + (match[6] || "00") + "+02:00";
  const date = new Date(iso);
  return isNaN(date.getTime()) ? 0 : date.getTime();
}

function writeEnquiryRow(sheet, row, values) {
  const maxRows = sheet.getMaxRows();
  if (row > maxRows) {
    sheet.appendRow(values);
    return;
  }
  sheet.getRange(row, 1, 1, values.length).setValues([values]);
}

function writeNotificationState(sheet, row, state) {
  sheet.getRange(row, CONFIG.COL.customerNotify, 1, 6).setValues([
    [
      state.customer,
      state.business,
      state.customerAt || "",
      state.businessAt || "",
      state.attempts || 0,
      state.error || "",
    ],
  ]);
}

function formatTimestamp(date) {
  return Utilities.formatDate(date, CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
}

function jsonOutput(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function logEvent(code, enquiryId) {
  const parts = ["enquiry", code];
  if (enquiryId) parts.push(enquiryId);
  console.log(parts.join(" "));
}

function initialNotificationState(email) {
  return {
    customer: String(email || "").trim() ? CONFIG.NOTIFY_PENDING : CONFIG.NOTIFY_SKIPPED,
    business: CONFIG.NOTIFY_PENDING,
    whatsapp: CONFIG.NOTIFY_SKIPPED,
  };
}

function parseJourneyDetails(message) {
  const text = String(message || "");
  const pickupMatch = text.match(/^Pickup:\s*(.+)$/m);
  const destinationMatch = text.match(/^Destination:\s*(.+)$/m);
  const notes = text
    .replace(/^Pickup:\s*.+$/m, "")
    .replace(/^Destination:\s*.+$/m, "")
    .trim();
  return {
    pickup: pickupMatch ? pickupMatch[1].trim() : "",
    destination: destinationMatch ? destinationMatch[1].trim() : "",
    notes: notes,
  };
}

function readLeadRow(sheet, row) {
  const values = sheet.getRange(row, 1, 1, CONFIG.HEADERS.length).getValues()[0];
  return {
    row: row,
    id: values[0],
    received: formatMaybeDate(values[1]),
    name: values[2],
    phone: values[3],
    email: values[4],
    service: values[5],
    travel_date: formatMaybeDate(values[6], true),
    passengers: values[7],
    message: values[8],
    source: values[9],
    status: values[10],
    customerNotify: values[16],
    businessNotify: values[17],
    customerNotifyAt: values[18],
    businessNotifyAt: values[19],
    notifyAttempts: values[20],
    notifyError: values[21],
  };
}

function formatMaybeDate(value, dateOnly) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, CONFIG.TIMEZONE, dateOnly ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm");
  }
  return String(value || "");
}

function findRowByEnquiryId(sheet, enquiryId) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  if (lastRow < 2) return 0;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || "").trim() === enquiryId) return i + 2;
  }
  return 0;
}

function defaultMailer() {
  return {
    send: function (message) {
      if (hasCopyRecipients(message)) {
        throw new Error("copy_recipients_forbidden");
      }
      MailApp.sendEmail({
        to: message.to,
        subject: message.subject,
        htmlBody: message.html,
        name: CONFIG.BUSINESS_NAME,
      });
    },
  };
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
  let rows = "";
  for (let i = 0; i < details.length; i++) {
    rows +=
      '<tr><td style="padding:6px 0;color:#675f56">' +
      escapeHtml(details[i][0]) +
      '</td><td style="padding:6px 0">' +
      escapeHtml(details[i][1]) +
      "</td></tr>";
  }
  const messageBlock = journey.notes
    ? '<p style="white-space:pre-wrap">' + escapeHtml(journey.notes) + "</p>"
    : "";
  return {
    to: resolveCustomerRecipient(lead),
    subject: CONFIG.BUSINESS_NAME + " — we received enquiry " + lead.id,
    html:
      '<div style="font-family:Georgia,serif;background:#faf7f1;padding:24px;color:#141312">' +
      '<h1 style="font-weight:500;color:#6b2131">' +
      escapeHtml(CONFIG.BUSINESS_NAME) +
      "</h1>" +
      "<p>Dear " +
      escapeHtml(lead.name) +
      ",</p>" +
      "<p>Thank you for your enquiry. We have received it and will reply to confirm availability and the details.</p>" +
      "<p><strong>Your enquiry is not a confirmed booking.</strong> Availability is subject to confirmation.</p>" +
      '<table style="width:100%;border-collapse:collapse">' +
      rows +
      "</table>" +
      messageBlock +
      "<p>You can reach us on " +
      escapeHtml(CONFIG.BUSINESS_PHONE) +
      ", " +
      escapeHtml(CONFIG.BUSINESS_PHONE_ALT) +
      ", WhatsApp " +
      escapeHtml(CONFIG.WHATSAPP_DISPLAY) +
      ", or " +
      escapeHtml(CONFIG.BUSINESS_EMAIL) +
      ".</p>" +
      "<p>Kind regards,<br>" +
      escapeHtml(CONFIG.BUSINESS_NAME) +
      "</p></div>",
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
  let rows = "";
  for (let i = 0; i < fields.length; i++) {
    rows +=
      '<tr><td style="padding:8px 0;font-size:14px;color:#675f56">' +
      escapeHtml(fields[i][0]) +
      '</td><td style="padding:8px 0;font-size:16px">' +
      escapeHtml(fields[i][1]) +
      "</td></tr>";
  }
  const notes = journey.notes
    ? '<p style="white-space:pre-wrap">' + escapeHtml(journey.notes) + "</p>"
    : "<p>No extra message.</p>";
  return {
    to: resolveBusinessRecipient(),
    subject: "New enquiry " + lead.id + " — " + lead.service,
    html:
      '<div style="font-family:Arial,sans-serif;background:#ffffff;padding:16px;color:#141312;max-width:640px">' +
      '<h1 style="font-size:22px;color:#6b2131">New enquiry</h1>' +
      '<table style="width:100%;border-collapse:collapse">' +
      rows +
      "</table>" +
      '<h2 style="font-size:16px">Customer message</h2>' +
      notes +
      '<p><a href="' +
      CONFIG.SHEET_URL +
      '">Open the enquiry register</a></p></div>',
  };
}

function shouldSendNotification(status) {
  return status === CONFIG.NOTIFY_PENDING || status === CONFIG.NOTIFY_FAILED;
}

function sendWhatsAppNotification() {
  logEvent("whatsapp_skipped");
  return { status: CONFIG.NOTIFY_SKIPPED, reason: "not_configured" };
}

function deliverNotificationsForId(enquiryId, mailer) {
  const sheet = openEnquiriesSheet();
  if (!sheet) return { status: "error", error: "config" };
  const row = findRowByEnquiryId(sheet, enquiryId);
  if (!row) return { status: "error", error: "missing" };
  return deliverNotificationsForRow(sheet, row, mailer || defaultMailer(), new Date());
}

function deliverNotificationsForRow(sheet, row, mailer, now) {
  const lead = readLeadRow(sheet, row);
  if (!String(lead.id || "").trim()) return { status: "error", error: "missing" };

  let customerStatus = String(lead.customerNotify || "");
  let businessStatus = String(lead.businessNotify || CONFIG.NOTIFY_PENDING);
  let customerAt = lead.customerNotifyAt || "";
  let businessAt = lead.businessNotifyAt || "";
  let errorCode = "";
  const hasCustomerEmail = Boolean(resolveCustomerRecipient(lead));

  if (!customerStatus) customerStatus = initialNotificationState(lead.email).customer;
  if (!hasCustomerEmail) customerStatus = CONFIG.NOTIFY_SKIPPED;

  const wantCustomer = hasCustomerEmail && shouldSendNotification(customerStatus);
  const wantBusiness = shouldSendNotification(businessStatus);
  const businessRecipient = resolveBusinessRecipient();
  const customerClaimed = wantCustomer && tryClaimNotification_(lead.id, "customer", now);
  const businessClaimed = wantBusiness && Boolean(businessRecipient) && tryClaimNotification_(lead.id, "business", now);

  if (!wantCustomer && !wantBusiness) {
    if (!hasCustomerEmail && String(lead.customerNotify || "") !== CONFIG.NOTIFY_SKIPPED) {
      writeNotificationState(sheet, row, {
        customer: CONFIG.NOTIFY_SKIPPED,
        business: businessStatus,
        customerAt: customerAt,
        businessAt: businessAt,
        attempts: lead.notifyAttempts || 0,
        error: lead.notifyError || "",
      });
      SpreadsheetApp.flush();
    }
    return { status: "ok", customer: customerStatus, business: businessStatus };
  }

  if (wantCustomer && !customerClaimed && (!wantBusiness || !businessClaimed)) {
    return { status: "busy", customer: customerStatus, business: businessStatus };
  }

  sendWhatsAppNotification();

  if (customerClaimed) {
    try {
      sendValidatedEmail(mailer, buildCustomerEmail(lead), "customer", lead);
      customerStatus = CONFIG.NOTIFY_SENT;
      customerAt = formatTimestamp(now);
    } catch (err) {
      customerStatus = CONFIG.NOTIFY_FAILED;
      errorCode = "customer_send_failed";
      releaseNotificationClaim_(lead.id, "customer");
      logEvent("customer_email_failed", lead.id);
    }
  }

  if (wantBusiness && !businessRecipient) {
    businessStatus = CONFIG.NOTIFY_FAILED;
    errorCode = errorCode ? errorCode + ",invalid_business_recipient" : "invalid_business_recipient";
    logEvent("business_email_blocked", lead.id);
  } else if (businessClaimed) {
    try {
      sendValidatedEmail(mailer, buildBusinessEmail(lead), "business", lead);
      businessStatus = CONFIG.NOTIFY_SENT;
      businessAt = formatTimestamp(now);
    } catch (err) {
      const code =
        err && (err.message === "invalid_business_recipient" || err.message === "blocked_business_recipient")
          ? "invalid_business_recipient"
          : "business_send_failed";
      businessStatus = CONFIG.NOTIFY_FAILED;
      errorCode = errorCode ? errorCode + "," + code : code;
      releaseNotificationClaim_(lead.id, "business");
      logEvent("business_email_failed", lead.id);
    }
  }

  writeNotificationState(sheet, row, {
    customer: customerStatus,
    business: businessStatus,
    customerAt: customerAt,
    businessAt: businessAt,
    attempts: Number(lead.notifyAttempts || 0) + 1,
    error: errorCode,
  });
  SpreadsheetApp.flush();
  return { status: "ok", customer: customerStatus, business: businessStatus };
}

function retryFailedNotifications() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_MS)) {
    logEvent("retry_busy");
    return;
  }
  try {
    processNotificationQueue_(true);
  } finally {
    lock.releaseLock();
  }
}

function processPendingNotifications() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_MS)) return;
  try {
    processNotificationQueue_(false);
  } finally {
    lock.releaseLock();
  }
}

function processNotificationQueue_(failedOnly) {
  const sheet = openEnquiriesSheet();
  if (!sheet) return;
  ensureLeadColumns(sheet);
  const lastRow = Math.max(sheet.getLastRow(), 1);
  if (lastRow < 2) return;
  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADERS.length).getValues();
  const mailer = defaultMailer();
  const now = new Date();
  for (let i = 0; i < values.length; i++) {
    const id = String(values[i][0] || "").trim();
    if (!id) continue;
    const customer = String(values[i][16] || "");
    const business = String(values[i][17] || "");
    const failed = customer === CONFIG.NOTIFY_FAILED || business === CONFIG.NOTIFY_FAILED;
    const pending = customer === CONFIG.NOTIFY_PENDING || business === CONFIG.NOTIFY_PENDING;
    if (failedOnly && !failed) continue;
    if (!failedOnly && !failed && !pending) continue;
    deliverNotificationsForRow(sheet, i + 2, mailer, now);
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Billionaire Prosperity")
    .addItem("Set up lead management", "setupLeadManagement")
    .addItem("Refresh dashboard", "refreshDashboard")
    .addItem("Retry failed email notifications", "retryFailedNotifications")
    .addToUi();
}

function ensureLeadColumns(sheet) {
  const needed = CONFIG.HEADERS.length;
  if (sheet.getMaxColumns() < needed) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), needed - sheet.getMaxColumns());
  }
  const existing = sheet.getRange(1, 1, 1, needed).getValues()[0];
  for (let i = 0; i < 14; i++) {
    if (!String(existing[i] || "").trim()) {
      sheet.getRange(1, i + 1).setValue(CONFIG.HEADERS[i]);
    }
  }
  for (let i = 14; i < needed; i++) {
    if (String(existing[i] || "").trim() !== CONFIG.HEADERS[i]) {
      sheet.getRange(1, i + 1).setValue(CONFIG.HEADERS[i]);
    }
  }
}

function setupLeadManagement() {
  const ss = openSpreadsheet();
  if (!ss) throw new Error("Spreadsheet not found");
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error("Enquiries tab not found");
  ensureLeadColumns(sheet);
  sheet.setFrozenRows(1);

  const last = Math.max(sheet.getMaxRows(), 2);
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.LEAD_STATUSES, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, CONFIG.COL.status, last - 1, 1).setDataValidation(statusRule);

  const notifyRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(
      [CONFIG.NOTIFY_PENDING, CONFIG.NOTIFY_SENT, CONFIG.NOTIFY_FAILED, CONFIG.NOTIFY_SKIPPED],
      true,
    )
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, CONFIG.COL.customerNotify, last - 1, 2).setDataValidation(notifyRule);

  sheet.getRange(2, CONFIG.COL.quotedAmount, last - 1, 1).setNumberFormat('"R"#,##0.00');
  sheet.getRange(2, CONFIG.COL.bookingValue, last - 1, 1).setNumberFormat('"R"#,##0.00');
  sheet.getRange(2, CONFIG.COL.followUp, last - 1, 1).setNumberFormat("yyyy-mm-dd");
  sheet.getRange(2, CONFIG.COL.lastContact, last - 1, 1).setNumberFormat("yyyy-mm-dd");

  sheet.clearConditionalFormatRules();
  const statusRange = sheet.getRange(2, CONFIG.COL.status, last - 1, 1);
  const colours = {
    New: ["#6b2131", "#f4efe6"],
    Contacted: ["#1d1b19", "#ddd5c8"],
    Quoted: ["#3d4f2a", "#e7eedc"],
    Booked: ["#1e3d2f", "#dce8e1"],
    Closed: ["#5c564e", "#eeeae3"],
  };
  const rules = [];
  const names = CONFIG.LEAD_STATUSES;
  for (let i = 0; i < names.length; i++) {
    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(names[i])
        .setBackground(colours[names[i]][1])
        .setFontColor(colours[names[i]][0])
        .setRanges([statusRange])
        .build(),
    );
  }
  sheet.setConditionalFormatRules(rules);

  setupDashboard(ss);
  installTriggers();
}

function dashboardFormulas() {
  const enq = CONFIG.SHEET_NAME;
  return [
    ["Billionaire Prosperity — Lead dashboard", ""],
    ["Private sheet. Figures count only rows with a BP enquiry ID. Quotes are not revenue.", ""],
    ["", ""],
    ["Overview", "Value"],
    ["Total enquiries", '=COUNTIF(' + enq + '!A2:A,"BP-*")'],
    ["New enquiries", '=COUNTIFS(' + enq + '!A2:A,"BP-*",' + enq + '!K2:K,"New")'],
    ["Contacted enquiries", '=COUNTIFS(' + enq + '!A2:A,"BP-*",' + enq + '!K2:K,"Contacted")'],
    ["Quotes sent", '=COUNTIFS(' + enq + '!A2:A,"BP-*",' + enq + '!K2:K,"Quoted")'],
    ["Confirmed bookings", '=COUNTIFS(' + enq + '!A2:A,"BP-*",' + enq + '!K2:K,"Booked")'],
    ["Closed enquiries", '=COUNTIFS(' + enq + '!A2:A,"BP-*",' + enq + '!K2:K,"Closed")'],
    ["Conversion rate", "=IF(B5=0,0,B9/B5)"],
    ["Total quoted value", '=SUMIF(' + enq + '!A2:A,"BP-*",' + enq + '!M2:M)'],
    ["Actual booking revenue", '=SUMIFS(' + enq + '!P2:P,' + enq + '!A2:A,"BP-*",' + enq + '!K2:K,"Booked")'],
    [
      "Outstanding follow-ups",
      '=COUNTIFS(' +
        enq +
        '!A2:A,"BP-*",' +
        enq +
        '!L2:L,"<>",' +
        enq +
        '!L2:L,"<="&TODAY(),' +
        enq +
        '!K2:K,"<>Booked",' +
        enq +
        '!K2:K,"<>Closed")',
    ],
    ["", ""],
    ["This month", "Value"],
    ["Monthly enquiry volume", '=SUMPRODUCT((LEFT(' + enq + '!A2:A,3)="BP-")*(LEFT(TEXT(' + enq + '!B2:B,"yyyy-mm"),7)=TEXT(TODAY(),"yyyy-mm")))'],
    ["Monthly confirmed bookings", '=SUMPRODUCT((LEFT(' + enq + '!A2:A,3)="BP-")*(' + enq + '!K2:K="Booked")*(LEFT(TEXT(' + enq + '!B2:B,"yyyy-mm"),7)=TEXT(TODAY(),"yyyy-mm")))'],
    ["Monthly booking revenue", '=SUMPRODUCT((LEFT(' + enq + '!A2:A,3)="BP-")*(' + enq + '!K2:K="Booked")*(LEFT(TEXT(' + enq + '!B2:B,"yyyy-mm"),7)=TEXT(TODAY(),"yyyy-mm"))*(' + enq + '!P2:P))'],
    ["", ""],
    ["Service breakdown", "Enquiries"],
    ["Airport Transfer", '=COUNTIFS(' + enq + '!A2:A,"BP-*",' + enq + '!F2:F,"Airport Transfer")'],
    ["Wine Tour", '=COUNTIFS(' + enq + '!A2:A,"BP-*",' + enq + '!F2:F,"Wine Tour")'],
    ["Business Transport", '=COUNTIFS(' + enq + '!A2:A,"BP-*",' + enq + '!F2:F,"Business Transport")'],
    ["Private Tour", '=COUNTIFS(' + enq + '!A2:A,"BP-*",' + enq + '!F2:F,"Private Tour")'],
    ["Other", '=COUNTIFS(' + enq + '!A2:A,"BP-*",' + enq + '!F2:F,"Other")'],
  ];
}

function setupDashboard(ss) {
  let dash = ss.getSheetByName(CONFIG.DASHBOARD_NAME);
  if (!dash) dash = ss.insertSheet(CONFIG.DASHBOARD_NAME, 0);
  dash.clear();
  const values = dashboardFormulas();
  dash.getRange(1, 1, values.length, 2).setValues(values);
  dash.getRange("A1:B1").merge();
  dash.getRange("A2:B2").merge();
  dash.getRange("A1").setFontSize(18).setFontColor("#6b2131");
  dash.getRange("A4:B4").setFontWeight("bold").setBackground("#6b2131").setFontColor("#f4efe6");
  dash.getRange("A16:B16").setFontWeight("bold").setBackground("#6b2131").setFontColor("#f4efe6");
  dash.getRange("A21:B21").setFontWeight("bold").setBackground("#6b2131").setFontColor("#f4efe6");
  dash.getRange("B11").setNumberFormat("0.0%");
  dash.getRange("B12:B13").setNumberFormat('"R"#,##0.00');
  dash.getRange("B19").setNumberFormat('"R"#,##0.00');
  dash.setColumnWidth(1, 280);
  dash.setColumnWidth(2, 160);
  dash.setFrozenRows(3);
  dash.getRange("A1:B26").setWrap(true);

  const charts = dash.getCharts();
  for (let i = 0; i < charts.length; i++) dash.removeChart(charts[i]);
  dash.insertChart(
    dash
      .newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(dash.getRange("A22:B26"))
      .setOption("title", "Enquiries by service")
      .setPosition(4, 4, 0, 0)
      .build(),
  );
}

function refreshDashboard() {
  const ss = openSpreadsheet();
  if (!ss) return;
  setupDashboard(ss);
}

function installTriggers() {
  const handlers = {
    processPendingNotifications: true,
  };
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (handlers[triggers[i].getHandlerFunction()]) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("processPendingNotifications").timeBased().everyMinutes(5).create();
}
