/**
 * Static site behaviour: menu, scroll header, reveal, image placeholders,
 * and the enquiry form.
 *
 * Client contact channels live here. Leave a value empty until it is real.
 * Phone, email and address text on the pages stays hidden until you also
 * fill the matching [data-contact] blocks in the HTML.
 */
const SITE = {
  name: "Billionaire Prosperity",
  /** International digits only. 0790235061 → 27790235061. */
  whatsapp: "27790235061",
  /** Enquiries address. Enables "Send via email" on the form. */
  email: "",
  /** Formspree / Basin / Getform URL. Empty keeps the WhatsApp / email handoff. */
  formEndpoint: "",
};

document.documentElement.classList.add("js");

function whatsappDigits() {
  const digits = String(SITE.whatsapp || "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : "";
}

function whatsappHref(message) {
  const digits = whatsappDigits();
  if (!digits) return "contact.html#whatsapp";
  const text = message || "Hello, I'd like to enquire about private transport.";
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function applyWhatsappLinks() {
  const digits = whatsappDigits();
  document.querySelectorAll("[data-wa]").forEach((el) => {
    const message = el.getAttribute("data-wa-message") || "";
    el.setAttribute("href", whatsappHref(message));
    if (digits) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
    }
  });

  const disabled = document.querySelector("[data-wa-disabled]");
  const live = document.querySelector("[data-wa-live]");
  if (disabled && live) {
    if (digits) {
      disabled.hidden = true;
      live.hidden = false;
    } else {
      disabled.hidden = false;
      live.hidden = true;
    }
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
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      toggle.focus();
    }
  });
  window.matchMedia("(min-width: 1100px)").addEventListener("change", (e) => {
    if (e.matches) setOpen(false);
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
  const waNumber = whatsappDigits();
  const emailTo = (SITE.email || "").trim();
  const business = SITE.name;

  const summary = form.querySelector("[data-summary]");
  const submit = form.querySelector("[data-submit]");
  const submitLabel = form.querySelector("[data-submit-label]");
  const result = document.querySelector("[data-result]");
  const resultTitle = result.querySelector("[data-result-title]");
  const resultText = result.querySelector("[data-result-text]");
  const handoff = result.querySelector("[data-handoff]");
  const sendWa = result.querySelector("[data-send-whatsapp]");
  const sendEmail = result.querySelector("[data-send-email]");
  const copyBtn = result.querySelector("[data-copy]");
  const copyLabel = result.querySelector("[data-copy-label]");
  const preview = result.querySelector("[data-preview]");
  const privacy = form.querySelector("[data-privacy]");

  if (privacy) {
    privacy.textContent = endpoint
      ? "Your details are only used to respond to your enquiry."
      : "This website doesn't store your details. We'll help you send your enquiry directly to us.";
  }

  const el = (name) => form.elements.namedItem(name);
  const dateInput = el("date");
  const serviceSelect = el("service");

  const today = (() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  dateInput.min = today;

  const preset = new URLSearchParams(window.location.search).get("service");
  if (preset && [...serviceSelect.options].some((o) => o.value === preset)) {
    serviceSelect.value = preset;
  }

  const validators = {
    name: (v) => (v.trim().length < 2 ? "Please enter your name." : ""),
    phone: (v) => {
      if (!v.trim()) return "Please enter a phone or WhatsApp number.";
      const digits = v.replace(/\D/g, "");
      if (!/^[\d\s+()-]+$/.test(v.trim()) || digits.length < 7 || digits.length > 15) {
        return "Please enter a valid phone number, e.g. +27 82 123 4567.";
      }
      return "";
    },
    email: (v) =>
      v.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
        ? "Please enter a valid email address."
        : "",
    service: (v) => (v ? "" : "Please choose a service."),
    date: (v) => (v && v < today ? "Please choose today or a future date." : ""),
    passengers: (v) => {
      if (!v) return "";
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 ? "" : "Please enter a whole number of passengers.";
    },
  };

  let attempted = false;
  const fieldNames = Object.keys(validators);

  const validateField = (name) => {
    const input = el(name);
    const message = validators[name](input.value);
    const error = form.querySelector(`[data-error-for="${name}"]`);
    input.setAttribute("aria-invalid", message ? "true" : "false");
    input.closest(".field")?.classList.toggle("has-error", Boolean(message));
    if (error) error.textContent = message;
    return !message;
  };

  fieldNames.forEach((name) => {
    const input = el(name);
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

  const buildMessage = () => {
    const data = new FormData(form);
    const get = (k) => String(data.get(k) ?? "").trim();
    const formattedDate = get("date")
      ? new Date(`${get("date")}T00:00:00`).toLocaleDateString("en-ZA", {
          weekday: "short",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";
    const rows = [
      ["Name", get("name")],
      ["Phone / WhatsApp", get("phone")],
      ["Email", get("email")],
      ["Service", serviceLabel()],
      ["Pickup location", get("pickup")],
      ["Destination", get("destination")],
      ["Travel date", formattedDate],
      ["Passengers", get("passengers")],
    ];
    const lines = rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
    const message = get("message");
    return [`Enquiry for ${business}`, "", ...lines, ...(message ? ["", "Message:", message] : [])].join("\n");
  };

  const showResult = (mode) => {
    const text = buildMessage();
    preview.value = text;

    if (mode === "sent") {
      resultTitle.textContent = "Thank you — your enquiry has been sent";
      resultText.textContent = "We'll get back to you using the details you provided.";
      handoff.hidden = true;
    } else {
      handoff.hidden = false;
      const channels = [];
      if (waNumber) {
        sendWa.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
        sendWa.hidden = false;
        channels.push("WhatsApp");
      } else {
        sendWa.hidden = true;
      }
      if (emailTo) {
        const subject = `Enquiry: ${serviceLabel()}`;
        sendEmail.href = `mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
        sendEmail.hidden = false;
        channels.push("email");
      } else {
        sendEmail.hidden = true;
      }

      if (mode === "failed") {
        resultTitle.textContent = "We couldn't send your enquiry";
        resultText.textContent = channels.length
          ? `Something went wrong on our side. Please send it via ${channels.join(" or ")} instead — your details are already filled in.`
          : "Something went wrong on our side. Please copy your enquiry below and try again shortly.";
      } else {
        resultTitle.textContent = "Your enquiry is ready to send";
        resultText.textContent = channels.length
          ? `This website doesn't store enquiries. Tap ${channels.join(" or ")} below to send it to us — your details are already filled in. It isn't sent until you do.`
          : "This website doesn't store enquiries, and our direct contact channels are still being set up. Copy your enquiry below so it's ready to send.";
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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    attempted = true;
    const results = fieldNames.map((n) => validateField(n));
    const firstInvalid = fieldNames.find((_, i) => !results[i]);
    summary.hidden = !firstInvalid;
    if (firstInvalid) {
      el(firstInvalid).focus();
      return;
    }

    if (!endpoint) {
      showResult("handoff");
      return;
    }

    if (el("company").value) return;

    submit.disabled = true;
    submitLabel.textContent = "Sending…";
    try {
      const data = new FormData(form);
      data.set("service", serviceLabel());
      const res = await fetch(endpoint, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      showResult("sent");
      form.reset();
      attempted = false;
    } catch {
      showResult("failed");
    } finally {
      submit.disabled = false;
      submitLabel.textContent = "Send Enquiry";
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
