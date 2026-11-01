/**
 * Node-testable copy of the enquiry sheet write rules in
 * google-apps-script/Code.gs. Keep the two files aligned.
 */

const CONFIG = {
  ID_PREFIX: "BP-",
  ID_PAD: 4,
  SOURCE: "Website",
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
  };
}

module.exports = {
  CONFIG,
  readRequestFields,
  cleanText,
  quoteFormula,
  validateAndSanitize,
  isSubmitTimingInvalid,
  nextEnquiryId,
  firstBlankIdRow,
  findRecentDuplicate,
  handleEnquiry,
};
