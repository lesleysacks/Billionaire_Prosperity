/**
 * Billionaire Prosperity enquiry web app.
 *
 * Paste this file into the Apps Script project bound to
 * "Billionaire Prosperity - Enquiry Register", then deploy as a web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Keep this logic aligned with tests/enquiry-sheet-logic.js.
 *
 * Sheet tab: Enquiries
 * Columns (unchanged):
 *   A Enquiry ID | B Date Received | C Customer Name | D Phone | E Email
 *   F Service | G Travel Date | H Passengers | I Customer Message
 *   J Source | K Status | L Follow-up Date | M Quoted Amount | N Notes
 */

const CONFIG = {
  SHEET_ID: "1F2hVNrAnCIa9PeO9e3bKT2e_LYNQ171Dvh0R2HTfL9E",
  SHEET_NAME: "Enquiries",
  TIMEZONE: "Africa/Johannesburg",
  ID_PREFIX: "BP-",
  ID_PAD: 4,
  STATUS_NEW: "New",
  SOURCE: "Website",
  MIN_ELAPSED_MS: 400,
  MAX_ELAPSED_MS: 7 * 24 * 60 * 60 * 1000,
  DUPLICATE_WINDOW_MS: 2 * 60 * 1000,
  LOCK_MS: 15000,
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
};

function doGet() {
  return jsonOutput({ status: "ok", service: "enquiry" });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(CONFIG.LOCK_MS)) {
      logEvent("busy");
      return jsonOutput({ status: "error", error: "busy" });
    }
    return jsonOutput(handleEnquiry(e));
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
  SpreadsheetApp.flush();
  logEvent("saved", enquiryId);
  return { status: "ok", id: enquiryId };
}

function openEnquiriesSheet() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    return ss.getSheetByName(CONFIG.SHEET_NAME);
  } catch (err) {
    return null;
  }
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
