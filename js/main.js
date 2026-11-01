/**
 * Static site behaviour: menu, scroll header, reveal, image placeholders,
 * and the enquiry form.
 *
 * WhatsApp uses the published mobile number. Email uses the address already
 * shown in the site footer. The enquiry form posts to the Google Apps Script
 * web app, which writes confirmed rows to the Enquiries sheet.
 */
const SITE = {
  name: "Billionaire Prosperity",
  /** International digits only, no plus sign. 079 023 5061 → 27790235061. */
  whatsapp: "27790235061",
  /** Published enquiries address. Enables the email handoff; it does not send mail by itself. */
  email: "andremoses100.am@gmail.com",
  /** Google Apps Script web app. Public by design; it is not a secret. */
  formEndpoint:
    "https://script.google.com/macros/s/AKfycbzZxz8HFsoFdJ6IRf3jJ87xUn8vtuT0HeSyCJF_Opb3SyE7TQj2VSgo1jPQemOg71FWPw/exec",
};

const DEFAULT_WHATSAPP_TEXT = "Hello, I'd like to enquire about private transport.";

function whatsappDigits(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : "";
}

function whatsappLink(number, message) {
  const digits = whatsappDigits(number);
  if (!digits) return "";
  const text = String(message ?? "").trim() || DEFAULT_WHATSAPP_TEXT;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function mailtoLink(address, subject, body) {
  const email = String(address ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "";
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function cleanQueryText(value, maxLen) {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > maxLen || /[<>]/.test(cleaned)) return "";
  return cleaned;
}

function resolveServiceValue(raw, allowed) {
  const value = cleanQueryText(raw, 40);
  if (!value || !Array.isArray(allowed) || !allowed.includes(value)) return "";
  return value;
}

function vehicleEnquiryNote(raw) {
  const name = cleanQueryText(raw, 80);
  return name ? `I would like to enquire about the ${name}.` : "";
}

function validateEnquiry(values, today) {
  const name = String(values.name ?? "");
  const phone = String(values.phone ?? "");
  const email = String(values.email ?? "");
  const service = String(values.service ?? "");
  const date = String(values.date ?? "");
  const passengers = String(values.passengers ?? "");
  const errors = {
    name: name.trim().length < 2 ? "Please enter your name." : "",
    phone: "",
    email: "",
    service: service ? "" : "Please choose a service.",
    date: date && date < today ? "Please choose today or a future date." : "",
    passengers: "",
  };

  if (!phone.trim()) {
    errors.phone = "Please enter a phone or WhatsApp number.";
  } else {
    const digits = phone.replace(/\D/g, "");
    if (!/^[\d\s+()-]+$/.test(phone.trim()) || digits.length < 7 || digits.length > 15) {
      errors.phone = "Please enter a valid phone number, e.g. +27 82 123 4567.";
    }
  }

  if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  if (passengers) {
    const count = Number(passengers);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      errors.passengers = "Please enter a whole number of passengers between 1 and 50.";
    }
  }

  return errors;
}

function formatTravelDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildEnquiryMessage(fields, businessName) {
  const rows = [
    ["Name", fields.name],
    ["Phone / WhatsApp", fields.phone],
    ["Email", fields.email],
    ["Service", fields.serviceLabel],
    ["Pickup location", fields.pickup],
    ["Destination", fields.destination],
    ["Travel date", fields.dateLabel],
    ["Passengers", fields.passengers],
  ];
  const lines = rows
    .filter(([, value]) => String(value ?? "").trim())
    .map(([label, value]) => `${label}: ${String(value).trim()}`);
  const message = String(fields.message ?? "").trim();
  return [`Enquiry for ${businessName}`, "", ...lines, ...(message ? ["", "Message:", message] : [])].join("\n");
}

function isHoneypotFilled(value) {
  return Boolean(String(value ?? "").trim());
}

function isSubmitTimingInvalid(startedAt, now = Date.now()) {
  if (startedAt == null || startedAt === "") return false;
  const started = Number(startedAt);
  if (!Number.isFinite(started) || started <= 0) return true;
  if (started > now + 5 * 60 * 1000) return true;
  if (now - started < 400) return true;
  if (now - started > 7 * 24 * 60 * 60 * 1000) return true;
  return false;
}

function createSubmitGuard() {
  let busy = false;
  return {
    begin() {
      if (busy) return false;
      busy = true;
      return true;
    },
    end() {
      busy = false;
    },
    isBusy() {
      return busy;
    },
  };
}

function buildEnquiryPayload(fields) {
  const pickup = String(fields.pickup ?? "").trim();
  const destination = String(fields.destination ?? "").trim();
  const userMessage = String(fields.message ?? "").trim();
  const messageParts = [];
  if (pickup) messageParts.push(`Pickup: ${pickup}`);
  if (destination) messageParts.push(`Destination: ${destination}`);
  if (userMessage) {
    if (messageParts.length) messageParts.push("", userMessage);
    else messageParts.push(userMessage);
  }

  return {
    name: String(fields.name ?? "").trim(),
    phone: String(fields.phone ?? "").trim(),
    email: String(fields.email ?? "").trim(),
    service: String(fields.serviceLabel ?? fields.service ?? "").trim(),
    travel_date: String(fields.date ?? fields.travel_date ?? "").trim(),
    passengers: String(fields.passengers ?? "").trim(),
    message: messageParts.join("\n"),
    source: "Website",
    company: String(fields.company ?? ""),
    started_at: String(fields.startedAt ?? fields.started_at ?? ""),
  };
}

function encodeEnquiryBody(payload) {
  const body = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    body.set(key, String(value ?? ""));
  });
  return body.toString();
}

function parseEnquiryResponse(text, httpOk, responseType) {
  if (responseType === "opaque" || responseType === "error") {
    return { ok: false, error: "opaque" };
  }
  if (!httpOk) return { ok: false, error: "http" };
  const raw = String(text ?? "").trim();
  if (!raw) return { ok: false, error: "empty" };
  try {
    const data = JSON.parse(raw);
    const id = data && typeof data.id === "string" ? data.id.trim() : "";
    if (data && data.status === "ok" && /^BP-\d{4,}$/.test(id)) {
      return { ok: true, id, duplicate: Boolean(data.duplicate) };
    }
    return { ok: false, error: (data && data.error) || "invalid" };
  } catch {
    return { ok: false, error: "parse" };
  }
}

async function submitEnquiry(endpoint, payload, fetchFn = fetch) {
  const url = String(endpoint ?? "").trim();
  if (!url) return { ok: false, error: "config" };

  const response = await fetchFn(url, {
    method: "POST",
    mode: "cors",
    redirect: "follow",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: encodeEnquiryBody(payload),
  });

  const type = response && response.type ? response.type : "";
  if (type === "opaque") return { ok: false, error: "opaque" };

  const httpOk = Boolean(response && response.ok);
  let text = "";
  try {
    text = response && typeof response.text === "function" ? await response.text() : "";
  } catch {
    return { ok: false, error: "empty" };
  }
  return parseEnquiryResponse(text, httpOk, type);
}

const enquiryApi = {
  SITE,
  whatsappDigits,
  whatsappLink,
  mailtoLink,
  cleanQueryText,
  resolveServiceValue,
  vehicleEnquiryNote,
  validateEnquiry,
  formatTravelDate,
  buildEnquiryMessage,
  isHoneypotFilled,
  isSubmitTimingInvalid,
  createSubmitGuard,
  buildEnquiryPayload,
  encodeEnquiryBody,
  parseEnquiryResponse,
  submitEnquiry,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = enquiryApi;
}

function bootSite() {
  if (typeof document === "undefined") return;

  document.documentElement.classList.add("js");

  function applyWhatsappLinks() {
    const digits = whatsappDigits(SITE.whatsapp);
    document.querySelectorAll("[data-wa]").forEach((el) => {
      const message = el.getAttribute("data-wa-message") || "";
      const href = whatsappLink(SITE.whatsapp, message);
      el.setAttribute("href", href || "contact.html#whatsapp");
      if (digits && href) {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      } else {
        el.removeAttribute("target");
      }
    });

    const disabled = document.querySelector("[data-wa-disabled]");
    const live = document.querySelector("[data-wa-live]");
    if (disabled && live) {
      disabled.hidden = Boolean(digits);
      live.hidden = !digits;
    }
  }

  function initHeader() {
    const header = document.querySelector("[data-header]");
    const toggle = document.querySelector("[data-menu-toggle]");
    const panel = document.querySelector("[data-mobile-nav]");
    const label = document.querySelector("[data-menu-label]");

    if (header) {
      const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    if (!header || !toggle || !panel) return;

    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      if (label) label.textContent = open ? "Close menu" : "Open menu";
      header.classList.toggle("is-open", open);
      document.body.classList.toggle("nav-open", open);
      if (open) {
        panel.hidden = false;
        requestAnimationFrame(() => panel.classList.add("is-visible"));
      } else {
        panel.classList.remove("is-visible");
        panel.hidden = true;
      }
    };

    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    panel.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia("(min-width: 1100px)").addEventListener("change", (event) => {
      if (event.matches) setOpen(false);
    });
  }

  function initReveal() {
    const targets = document.querySelectorAll("[data-reveal]");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    targets.forEach((el) => io.observe(el));
  }

  function initPhotos() {
    document.querySelectorAll(".media img").forEach((img) => {
      const frame = img.parentElement;
      if (!frame) return;
      const show = () => frame.classList.remove("is-missing");
      const markMissing = () => {
        frame.classList.add("is-missing");
        const alt = img.getAttribute("alt");
        img.remove();
        const placeholder = frame.querySelector(".media__placeholder");
        if (placeholder) {
          placeholder.removeAttribute("aria-hidden");
          if (alt) {
            placeholder.setAttribute("role", "img");
            placeholder.setAttribute("aria-label", alt);
          }
        }
      };
      if (img.complete && img.naturalWidth > 0) show();
      else if (img.complete && img.naturalWidth === 0) markMissing();
      else {
        img.addEventListener("load", show);
        img.addEventListener("error", markMissing);
      }
    });
  }

  function initForm() {
    const form = document.querySelector("[data-enquiry-form]");
    if (!form) return;

    const endpoint = (SITE.formEndpoint || "").trim();
    const waNumber = whatsappDigits(SITE.whatsapp);
    const emailTo = (SITE.email || "").trim();
    const business = SITE.name;
    const summary = form.querySelector("[data-summary]");
    const submit = form.querySelector("[data-submit]");
    const submitLabel = form.querySelector("[data-submit-label]");
    const result = document.querySelector("[data-result]");
    if (!summary || !submit || !submitLabel || !result) return;

    const resultTitle = result.querySelector("[data-result-title]");
    const resultText = result.querySelector("[data-result-text]");
    const handoff = result.querySelector("[data-handoff]");
    const sendWa = result.querySelector("[data-send-whatsapp]");
    const sendEmail = result.querySelector("[data-send-email]");
    const copyBtn = result.querySelector("[data-copy]");
    const copyLabel = result.querySelector("[data-copy-label]");
    const preview = result.querySelector("[data-preview]");
    const privacy = form.querySelector("[data-privacy]");
    if (!resultTitle || !resultText || !handoff || !sendWa || !sendEmail || !copyBtn || !copyLabel || !preview) return;

    const readyLabel = endpoint ? "Send enquiry" : waNumber ? "Prepare WhatsApp enquiry" : "Prepare enquiry";
    submitLabel.textContent = readyLabel;

    if (privacy) {
      privacy.textContent = endpoint
        ? "Your details are only used to respond to your enquiry. Availability is subject to confirmation. A request is not a confirmed booking."
        : "This page does not store your details or send the enquiry. WhatsApp or email opens only after you choose it, and nothing is delivered until you confirm it there. Availability is subject to confirmation. A request is not a confirmed booking.";
    }

    let formStartedAt = Date.now();

    const field = (name) => form.elements.namedItem(name);
    const dateInput = field("date");
    const serviceSelect = field("service");
    const messageInput = field("message");
    if (!dateInput || !serviceSelect || !messageInput) return;

    const today = (() => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    })();
    dateInput.min = today;

    const allowedServices = [...serviceSelect.options].map((option) => option.value).filter(Boolean);
    const params = new URLSearchParams(window.location.search);
    const preset = resolveServiceValue(params.get("service"), allowedServices);
    const presetNote = form.querySelector("[data-service-preset]");
    if (preset) {
      serviceSelect.value = preset;
      if (presetNote) {
        const label = serviceSelect.selectedOptions[0]?.textContent?.trim() || "This service";
        presetNote.hidden = false;
        presetNote.textContent = `${label} is selected from the page you came from. You can change it before you continue.`;
      }
    }

    const vehicleNote = vehicleEnquiryNote(params.get("vehicle"));
    if (vehicleNote && !messageInput.value.trim()) messageInput.value = vehicleNote;

    if ((preset || vehicleNote) && window.location.hash !== "#whatsapp") {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.requestAnimationFrame(() => {
        form.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      });
    }

    const fieldNames = ["name", "phone", "email", "service", "date", "passengers"];
    let attempted = false;

    const validateField = (name) => {
      const input = field(name);
      if (!input) return true;
      const values = {
        name: field("name").value,
        phone: field("phone").value,
        email: field("email").value,
        service: field("service").value,
        date: field("date").value,
        passengers: field("passengers").value,
      };
      const message = validateEnquiry(values, today)[name] || "";
      const error = form.querySelector(`[data-error-for="${name}"]`);
      input.setAttribute("aria-invalid", message ? "true" : "false");
      input.closest(".field")?.classList.toggle("has-error", Boolean(message));
      if (error) error.textContent = message;
      return !message;
    };

    fieldNames.forEach((name) => {
      const input = field(name);
      if (!input) return;
      const handler = () => {
        if (attempted || input.getAttribute("aria-invalid") === "true") validateField(name);
      };
      input.addEventListener("input", handler);
      input.addEventListener("change", handler);
      input.addEventListener("blur", () => {
        if (input.value) validateField(name);
      });
    });

    const serviceLabel = () => serviceSelect.selectedOptions[0]?.textContent?.trim() ?? "";

    const currentMessage = () => {
      const data = new FormData(form);
      const get = (key) => String(data.get(key) ?? "").trim();
      return buildEnquiryMessage(
        {
          name: get("name"),
          phone: get("phone"),
          email: get("email"),
          serviceLabel: serviceLabel(),
          pickup: get("pickup"),
          destination: get("destination"),
          dateLabel: formatTravelDate(get("date")),
          passengers: get("passengers"),
          message: get("message"),
        },
        business,
      );
    };

    const showResult = (mode, extra) => {
      const text = currentMessage();
      preview.value = text;
      result.classList.toggle("is-sent", mode === "sent");
      result.classList.toggle("is-handoff", mode !== "sent");

      if (mode === "sent") {
        resultTitle.textContent = "Thank you — your enquiry has been sent";
        resultText.textContent = extra && extra.enquiryId
          ? `Your enquiry number is ${extra.enquiryId}. We'll get back to you using the details you provided. Availability is subject to confirmation. A request is not a confirmed booking.`
          : "We'll get back to you using the details you provided. Availability is subject to confirmation. A request is not a confirmed booking.";
        handoff.hidden = true;
      } else {
        handoff.hidden = false;
        const channels = [];
        const waHref = whatsappLink(waNumber, text);
        if (waHref) {
          sendWa.href = waHref;
          sendWa.hidden = false;
          channels.push("WhatsApp");
        } else {
          sendWa.hidden = true;
          sendWa.removeAttribute("href");
        }

        const subject = `Enquiry: ${serviceLabel() || "Private transport"}`;
        const emailHref = mailtoLink(emailTo, subject, text);
        if (emailHref) {
          sendEmail.href = emailHref;
          sendEmail.hidden = false;
          channels.push("email");
        } else {
          sendEmail.hidden = true;
          sendEmail.removeAttribute("href");
        }

        const channelText = channels.join(" or ");
        if (mode === "failed") {
          resultTitle.textContent = "We couldn't send your enquiry";
          resultText.textContent = channels.length
            ? `Something went wrong on our side. Please send it via ${channelText} instead. Your details are filled in, and nothing is delivered until you confirm it there.`
            : "Something went wrong on our side. Please copy your enquiry below and try again shortly.";
        } else {
          resultTitle.textContent = "Your enquiry is ready to send";
          resultText.textContent = channels.length
            ? `Nothing has been sent yet. This website does not store enquiries. Continue with ${channelText} and confirm the message there. Availability is subject to confirmation. A request is not a confirmed booking.`
            : "This website does not store enquiries, and a direct contact channel is not available yet. Copy your enquiry below so you can send it once a channel is confirmed. Availability is subject to confirmation. A request is not a confirmed booking.";
        }
      }

      result.hidden = false;
      result.focus({ preventScroll: true });
      result.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    };

    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(preview.value);
        copyLabel.textContent = "Copied";
      } catch {
        preview.focus();
        preview.select();
        copyLabel.textContent = "Text selected — copy it manually";
      }
      window.setTimeout(() => {
        copyLabel.textContent = "Copy enquiry";
      }, 2000);
    });

    const submitGuard = createSubmitGuard();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!submitGuard.begin()) return;
      attempted = true;
      const results = fieldNames.map((name) => validateField(name));
      const firstInvalid = fieldNames.find((_, index) => !results[index]);
      summary.hidden = !firstInvalid;
      if (firstInvalid) {
        submitGuard.end();
        field(firstInvalid)?.focus();
        return;
      }

      submit.disabled = true;
      submit.setAttribute("aria-busy", "true");
      submitLabel.textContent = endpoint ? "Sending…" : "Preparing…";
      result.hidden = true;
      try {
        if (!endpoint) {
          showResult("handoff");
          return;
        }

        const data = new FormData(form);
        const get = (key) => String(data.get(key) ?? "");
        const payload = buildEnquiryPayload({
          name: get("name"),
          phone: get("phone"),
          email: get("email"),
          serviceLabel: serviceLabel(),
          pickup: get("pickup"),
          destination: get("destination"),
          date: get("date"),
          passengers: get("passengers"),
          message: get("message"),
          company: get("company"),
          startedAt: String(formStartedAt),
        });

        if (isHoneypotFilled(payload.company) || isSubmitTimingInvalid(payload.started_at)) {
          showResult("failed");
          return;
        }

        const outcome = await submitEnquiry(endpoint, payload);
        if (!outcome.ok || !outcome.id) {
          showResult("failed");
          return;
        }

        showResult("sent", { enquiryId: outcome.id });
        form.reset();
        attempted = false;
        dateInput.min = today;
        formStartedAt = Date.now();
      } catch {
        showResult("failed");
      } finally {
        submitGuard.end();
        submit.disabled = false;
        submit.removeAttribute("aria-busy");
        submitLabel.textContent = readyLabel;
      }
    });
  }

  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  applyWhatsappLinks();
  initHeader();
  initReveal();
  initPhotos();
  initForm();
}

bootSite();
