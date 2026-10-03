const body = document.body;
const intro = document.querySelector("[data-intro]");
const openInvitationButton = document.querySelector("[data-open-invitation]");
const weddingMusic = document.querySelector("[data-wedding-music]");
const musicToggle = document.querySelector("[data-music-toggle]");
const musicToggleLabel = document.querySelector("[data-music-toggle-label]");
const musicStartSeconds = 20;
let skipIntroWhenMetadataLoads = false;
const main = document.querySelector("#main-content");
const heroTitle = document.querySelector("#hero-title");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const RSVP_SHEETS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzJAVL7HEtQYlOqZNUy-aAK7STp4eqWeczwQoUv0LGr2Xd7oTFzfDfKgg-8F-j8vlIP6g/exec";
const invitationSalutation = document.querySelector("[data-invitation-salutation]");
const invitationGuest = document.querySelector("[data-invitation-guest]");
let autoScrollRequested = false;
let autoScrollReady = false;
let autoScrollActive = false;
let autoScrollFrame = 0;
let autoScrollLastFrame = 0;
let autoScrollResumeTimer = 0;

async function loadPersonalizedInvitation() {
  const guestCode = new URLSearchParams(window.location.search).get("guest")?.trim();
  if (!guestCode || !invitationSalutation || !invitationGuest) return;

  try {
    const response = await fetch(`${RSVP_SHEETS_ENDPOINT}?action=guest&code=${encodeURIComponent(guestCode)}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (!data.ok || !data.guest) return;
    invitationSalutation.textContent = data.guest.salutation || "TRÂN TRỌNG KÍNH MỜI";
    invitationGuest.textContent = data.guest.name || "Quý Khách";
  } catch (_) {
    // The generic invitation remains visible when the personal link cannot be loaded.
  }
}

loadPersonalizedInvitation();

function scheduleAutoScrollResume(delay = 4000) {
  window.clearTimeout(autoScrollResumeTimer);
  if (!autoScrollRequested) return;
  autoScrollResumeTimer = window.setTimeout(() => {
    autoScrollResumeTimer = 0;
    startAutoScroll();
  }, delay);
}

function pauseAutoScroll(resumeDelay = 4000) {
  if (!autoScrollRequested) return;
  autoScrollActive = false;
  autoScrollLastFrame = 0;
  window.cancelAnimationFrame(autoScrollFrame);
  window.clearTimeout(autoScrollResumeTimer);
  autoScrollResumeTimer = 0;
  if (resumeDelay !== null) scheduleAutoScrollResume(resumeDelay);
}

function finishAutoScroll() {
  autoScrollRequested = false;
  autoScrollActive = false;
  autoScrollLastFrame = 0;
  window.cancelAnimationFrame(autoScrollFrame);
  window.clearTimeout(autoScrollResumeTimer);
  autoScrollResumeTimer = 0;
}

function advanceAutoScroll(timestamp) {
  if (!autoScrollActive) return;
  const lastFrame = autoScrollLastFrame || timestamp;
  const elapsed = Math.min(timestamp - lastFrame, 50);
  const scrollingElement = document.scrollingElement;
  const maxScroll = scrollingElement.scrollHeight - window.innerHeight;
  autoScrollLastFrame = timestamp;
  scrollingElement.scrollTop = Math.min(maxScroll, scrollingElement.scrollTop + elapsed * 0.045);

  if (scrollingElement.scrollTop >= maxScroll) {
    finishAutoScroll();
    return;
  }
  autoScrollFrame = window.requestAnimationFrame(advanceAutoScroll);
}

function startAutoScroll() {
  if (reduceMotion || !autoScrollRequested || !autoScrollReady || autoScrollActive || autoScrollResumeTimer || document.hidden || body.classList.contains("modal-open")) return;
  autoScrollActive = true;
  autoScrollLastFrame = 0;
  autoScrollFrame = window.requestAnimationFrame(advanceAutoScroll);
}

const pauseAutoScrollForActivity = () => pauseAutoScroll();
window.addEventListener("wheel", pauseAutoScrollForActivity, { passive: true });
window.addEventListener("touchstart", pauseAutoScrollForActivity, { passive: true });
window.addEventListener("touchmove", pauseAutoScrollForActivity, { passive: true });
window.addEventListener("pointerdown", pauseAutoScrollForActivity, { passive: true });
window.addEventListener("pointermove", pauseAutoScrollForActivity, { passive: true });
window.addEventListener("mouseout", (event) => {
  if (!event.relatedTarget) pauseAutoScroll(700);
});
window.addEventListener("blur", () => pauseAutoScroll(null));
window.addEventListener("focus", () => scheduleAutoScrollResume(700));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseAutoScroll(null);
  else scheduleAutoScrollResume(700);
});

function seekPastMusicIntro() {
  if (!weddingMusic || !Number.isFinite(weddingMusic.duration)) return;
  weddingMusic.currentTime = weddingMusic.duration > musicStartSeconds
    ? musicStartSeconds
    : 0;
}

function enterInvitation() {
  if (!intro || intro.classList.contains("is-opening")) return;
  autoScrollRequested = !reduceMotion;
  if (weddingMusic) {
    if (weddingMusic.readyState >= HTMLMediaElement.HAVE_METADATA) seekPastMusicIntro();
    else skipIntroWhenMetadataLoads = true;
    weddingMusic.play().catch(() => {});
  }
  intro.classList.add("is-opening");
  body.classList.add("invitation-revealing");
  openInvitationButton.disabled = true;
  sessionStorage.setItem("weddingInvitationOpened", "true");

  window.setTimeout(() => {
    intro.classList.add("is-complete");
  }, reduceMotion ? 0 : 520);

  window.setTimeout(() => {
    intro.setAttribute("aria-hidden", "true");
    body.classList.remove("intro-active");
    body.classList.remove("invitation-revealing");
    (heroTitle || main).focus({ preventScroll: true });
    autoScrollReady = true;
    startAutoScroll();
  }, reduceMotion ? 180 : 1040);
}

if (openInvitationButton) openInvitationButton.addEventListener("click", enterInvitation);

if (weddingMusic && musicToggle) {
  weddingMusic.addEventListener("loadedmetadata", () => {
    if (!skipIntroWhenMetadataLoads) return;
    skipIntroWhenMetadataLoads = false;
    seekPastMusicIntro();
  });
  weddingMusic.addEventListener("ended", () => {
    seekPastMusicIntro();
    weddingMusic.play().catch(() => {});
  });
  weddingMusic.addEventListener("playing", () => {
    musicToggle.hidden = false;
    musicToggle.setAttribute("aria-label", "Tắt nhạc");
    if (musicToggleLabel) musicToggleLabel.textContent = "Tắt nhạc";
  });
  weddingMusic.addEventListener("pause", () => {
    musicToggle.setAttribute("aria-label", "Bật nhạc");
    if (musicToggleLabel) musicToggleLabel.textContent = "Bật nhạc";
  });
  musicToggle.addEventListener("click", () => {
    if (weddingMusic.paused) weddingMusic.play().catch(() => {});
    else weddingMusic.pause();
  });
}

// Keep the opening experience available on a fresh tab, but do not replay it on accidental refresh.
if (sessionStorage.getItem("weddingInvitationOpened") === "true") {
  intro?.classList.add("is-complete");
  intro?.setAttribute("aria-hidden", "true");
  body.classList.remove("intro-active");
  body.classList.remove("invitation-revealing");
}

const revealItems = document.querySelectorAll("[data-reveal]");
if (reduceMotion || !("IntersectionObserver" in window)) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -5%" },
  );

  revealItems.forEach((item) => revealObserver.observe(item));
}

let activeModal = null;
let modalTrigger = null;

function getFocusable(container) {
  return [...container.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
}

function openModal(modal, trigger) {
  if (!modal) return;
  activeModal = modal;
  modalTrigger = trigger;
  modal.hidden = false;
  body.classList.add("modal-open");
  requestAnimationFrame(() => modal.querySelector(".modal-panel")?.focus());
}

function closeModal(modal = activeModal) {
  if (!modal) return;
  modal.hidden = true;
  body.classList.remove("modal-open");
  scheduleAutoScrollResume(700);
  activeModal = null;
  modalTrigger?.focus();
  modalTrigger = null;
}

document.querySelectorAll("[data-open-modal]").forEach((button) => {
  button.addEventListener("click", () => openModal(document.getElementById(button.dataset.openModal), button));
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => closeModal(button.closest(".modal")));
});

document.querySelectorAll('.attendance-field input[name="attendance"]').forEach((input) => {
  input.addEventListener("change", () => {
    const guestCount = input.closest("form").querySelector(".guest-count");
    guestCount.hidden = input.value !== "yes";
  });
});

function validateForm(form) {
  let valid = true;
  form.querySelectorAll(".field").forEach((field) => {
    field.classList.remove("is-invalid");
    const error = field.querySelector(".field-error");
    if (error) error.textContent = "";
  });

  form.querySelectorAll("input:not([type='radio'])[required], textarea[required]").forEach((input) => {
    const tooShort = input.minLength > 0 && input.value.trim().length < input.minLength;
    if (!input.value.trim() || tooShort) {
      valid = false;
      const field = input.closest(".field");
      field.classList.add("is-invalid");
      field.querySelector(".field-error").textContent = input.name === "message" ? "Vui lòng nhập lời chúc của bạn." : "Vui lòng nhập tên của bạn.";
    }
  });

  const radioGroup = form.querySelector('input[name="attendance"]');
  if (radioGroup && !form.querySelector('input[name="attendance"]:checked')) {
    valid = false;
    const field = radioGroup.closest(".field");
    field.classList.add("is-invalid");
    field.querySelector(".field-error").textContent = "Vui lòng chọn bạn có thể tham dự hay không.";
  }

  return valid;
}

async function sendToGoogleSheets(type, data) {
  if (!RSVP_SHEETS_ENDPOINT) {
    throw new Error("Biểu mẫu chưa được kết nối với Google Sheets.");
  }

  const payload = { ...data, type };
  if (type === "rsvp" && data.attendance !== "yes") payload.guestCount = "";

  await fetch(RSVP_SHEETS_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}

function handleForm(form, storageKey, successSelector, submitData = null) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateForm(form)) {
      form.querySelector(".is-invalid input, .is-invalid textarea")?.focus();
      return;
    }

    const submit = form.querySelector(".form-submit");
    const originalText = submit.textContent;
    submit.disabled = true;
    submit.textContent = "ĐANG GỬI...";
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      if (submitData) await submitData(data);
      if (storageKey) {
        const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
        existing.push({ ...data, createdAt: new Date().toISOString() });
        localStorage.setItem(storageKey, JSON.stringify(existing));
      }
      submit.textContent = originalText;
      submit.disabled = false;
      form.hidden = true;
      form.closest(".modal-panel").querySelector(successSelector).hidden = false;
    } catch (error) {
      submit.textContent = originalText;
      submit.disabled = false;
      const note = form.querySelector(".form-note");
      if (note) note.textContent = error.message || "Không gửi được xác nhận. Vui lòng thử lại.";
    }
  });
}

const rsvpForm = document.querySelector("[data-rsvp-form]");
const wishesForm = document.querySelector("[data-wishes-form]");
if (rsvpForm) handleForm(rsvpForm, null, "[data-rsvp-success]", (data) => sendToGoogleSheets("rsvp", data));
if (wishesForm) handleForm(wishesForm, null, "[data-wishes-success]", async (data) => { await sendToGoogleSheets("wish", data); window.setTimeout(loadGuestbook, 1200); });

const galleryImages = [
  { src: "assets/cuoi-1.jpg", alt: "Ảnh cưới 1 của Phan Vũ và Quỳnh Như" },
  { src: "assets/cuoi-2.jpg", alt: "Ảnh cưới 2 của Phan Vũ và Quỳnh Như" },
  { src: "assets/cuoi-3.jpg", alt: "Ảnh cưới 3 của Phan Vũ và Quỳnh Như" },
  { src: "assets/cuoi-4.jpg", alt: "Ảnh cưới 4 của Phan Vũ và Quỳnh Như" },
  { src: "assets/cuoi-5.jpg", alt: "Ảnh cưới 5 của Phan Vũ và Quỳnh Như" },
  { src: "assets/cuoi-6.jpg", alt: "Ảnh cưới 6 của Phan Vũ và Quỳnh Như" },
  { src: "assets/cuoi-7.jpg", alt: "Ảnh cưới 7 của Phan Vũ và Quỳnh Như" },
  { src: "assets/cuoi-8.jpg", alt: "Ảnh cưới 8 của Phan Vũ và Quỳnh Như" },
  { src: "assets/cuoi-9.jpg", alt: "Ảnh cưới 9 của Phan Vũ và Quỳnh Như" },
];

const gallery = document.querySelector("[data-gallery]");
const carouselImage = document.querySelector("[data-carousel-image]");
const carouselCurrent = document.querySelector("[data-carousel-current]");
const carouselTotal = document.querySelector("[data-carousel-total]");
const carouselStage = gallery?.querySelector(".carousel-stage");
const carouselThumbnailStrip = gallery?.querySelector(".carousel-thumbnails");
const carouselThumbnails = [...document.querySelectorAll("[data-carousel-index]")];
let carouselIndex = 0;
let carouselPointerStart = null;
carouselTotal.textContent = String(galleryImages.length).padStart(2, "0");

function showCarouselImage(index) {
  carouselIndex = (index + galleryImages.length) % galleryImages.length;
  const image = galleryImages[carouselIndex];
  carouselImage.src = image.src;
  carouselImage.alt = image.alt;
  carouselCurrent.textContent = String(carouselIndex + 1).padStart(2, "0");
  carouselThumbnails.forEach((thumbnail, thumbnailIndex) => {
    const active = thumbnailIndex === carouselIndex;
    thumbnail.classList.toggle("is-active", active);
    thumbnail.setAttribute("aria-pressed", String(active));
    if (active && carouselThumbnailStrip) {
      const stripBounds = carouselThumbnailStrip.getBoundingClientRect();
      const thumbnailBounds = thumbnail.getBoundingClientRect();
      const scrollDelta = thumbnailBounds.left < stripBounds.left
        ? thumbnailBounds.left - stripBounds.left
        : thumbnailBounds.right > stripBounds.right
          ? thumbnailBounds.right - stripBounds.right
          : 0;
      if (scrollDelta) carouselThumbnailStrip.scrollBy({ left: scrollDelta, behavior: reduceMotion ? "auto" : "smooth" });
    }
  });
}

gallery?.querySelector("[data-carousel-previous]").addEventListener("click", () => showCarouselImage(carouselIndex - 1));
gallery?.querySelector("[data-carousel-next]").addEventListener("click", () => showCarouselImage(carouselIndex + 1));
gallery?.querySelector("[data-carousel-open]").addEventListener("click", (event) => openLightbox(carouselIndex, event.currentTarget));
carouselThumbnails.forEach((thumbnail) => {
  thumbnail.addEventListener("click", () => showCarouselImage(Number(thumbnail.dataset.carouselIndex)));
});
carouselStage?.addEventListener("pointerdown", (event) => {
  carouselPointerStart = event.clientX;
});
carouselStage?.addEventListener("pointerup", (event) => {
  if (carouselPointerStart === null) return;
  const distance = event.clientX - carouselPointerStart;
  carouselPointerStart = null;
  if (Math.abs(distance) < 45) return;
  showCarouselImage(carouselIndex + (distance < 0 ? 1 : -1));
});
carouselStage?.addEventListener("pointercancel", () => {
  carouselPointerStart = null;
});
gallery?.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") showCarouselImage(carouselIndex - 1);
  if (event.key === "ArrowRight") showCarouselImage(carouselIndex + 1);
});

const lightbox = document.querySelector("[data-lightbox]");
const lightboxImage = document.querySelector("[data-lightbox-image]");
const lightboxCaption = document.querySelector("[data-lightbox-caption]");
let lightboxIndex = 0;
let lightboxTrigger = null;

function showLightboxImage(index) {
  lightboxIndex = (index + galleryImages.length) % galleryImages.length;
  const image = galleryImages[lightboxIndex];
  lightboxImage.src = image.src;
  lightboxImage.alt = image.alt;
  lightboxCaption.textContent = `${lightboxIndex + 1} / ${galleryImages.length} - ${image.alt}`;
}

function openLightbox(index, trigger) {
  lightboxTrigger = trigger;
  showLightboxImage(index);
  lightbox.hidden = false;
  body.classList.add("modal-open");
  lightbox.querySelector(".lightbox-close").focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  body.classList.remove("modal-open");
  scheduleAutoScrollResume(700);
  lightboxTrigger?.focus();
}

document.querySelectorAll("[data-close-lightbox]").forEach((button) => {
  button.addEventListener("click", closeLightbox);
});
document.querySelector("[data-lightbox-prev]")?.addEventListener("click", () => showLightboxImage(lightboxIndex - 1));
document.querySelector("[data-lightbox-next]")?.addEventListener("click", () => showLightboxImage(lightboxIndex + 1));

document.addEventListener("keydown", (event) => {
  if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Escape"].includes(event.key)) {
    pauseAutoScroll();
  }

  if (event.key === "Escape") {
    if (!lightbox.hidden) closeLightbox();
    else if (activeModal) closeModal();
  }

  if (!lightbox.hidden && event.key === "ArrowLeft") showLightboxImage(lightboxIndex - 1);
  if (!lightbox.hidden && event.key === "ArrowRight") showLightboxImage(lightboxIndex + 1);

  const container = activeModal || (!lightbox.hidden ? lightbox : null);
  if (!container || event.key !== "Tab") return;
  const focusable = getFocusable(container);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

const guestbookList = document.querySelector("[data-guestbook-list]");
const guestbookStatus = document.querySelector("[data-guestbook-status]");
const guestbookViewport = document.querySelector("[data-guestbook-viewport]");
let guestbookPaused = false;
let displayedWishKeys = new Set();

function formatWishDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function createWishEntry(wish) {
  const entry = document.createElement("article");
  entry.className = "guestbook-entry";
  const meta = document.createElement("div");
  meta.className = "guestbook-entry__meta";
  const name = document.createElement("strong");
  name.textContent = wish.name || "Khách mời thân thương";
  meta.append(name);
  const date = formatWishDate(wish.createdAt);
  if (date) {
    const time = document.createElement("time");
    time.textContent = date;
    meta.append(time);
  }
  const message = document.createElement("p");
  message.textContent = wish.message || "";
  entry.append(meta, message);
  return entry;
}

function wishKey(wish) {
  return `${wish.createdAt || ""}|${wish.name || ""}|${wish.message || ""}`;
}

function scrollGuestbookToLatest(smooth = false) {
  if (!guestbookViewport || guestbookPaused) return;
  const behavior = smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto";
  guestbookViewport.scrollTo({ top: guestbookViewport.scrollHeight, behavior });
}

async function loadGuestbook(isRefresh = false) {
  if (!guestbookList || !guestbookStatus) return;
  if (!isRefresh) guestbookStatus.textContent = "Đang tải lời chúc…";
  try {
    const response = await fetch(`${RSVP_SHEETS_ENDPOINT}?action=wishes`, { cache: "no-store" });
    if (!response.ok) throw new Error("Không tải được lời chúc.");
    const data = await response.json();
    const wishes = Array.isArray(data.wishes) ? data.wishes : [];
    if (!wishes.length) {
      guestbookList.replaceChildren();
      displayedWishKeys = new Set();
      const empty = document.createElement("p");
      empty.className = "guestbook__empty";
      empty.textContent = "Những lời chúc đầu tiên sẽ được lưu tại đây.";
      guestbookList.append(empty);
      guestbookStatus.textContent = "";
      return;
    }
    const nextWishKeys = new Set(wishes.map(wishKey));
    const hasNewWish = isRefresh && wishes.some((wish) => !displayedWishKeys.has(wishKey(wish)));
    if (isRefresh && !hasNewWish) {
      guestbookStatus.textContent = `${wishes.length} lời chúc mới nhất`;
      return;
    }
    const previousScrollTop = guestbookViewport.scrollTop;
    guestbookList.replaceChildren();
    wishes.forEach((wish) => guestbookList.append(createWishEntry(wish)));
    displayedWishKeys = nextWishKeys;
    guestbookStatus.textContent = `${wishes.length} lời chúc mới nhất`;
    requestAnimationFrame(() => {
      if (guestbookPaused) guestbookViewport.scrollTop = previousScrollTop;
      else scrollGuestbookToLatest(hasNewWish);
    });
  } catch (error) {
    guestbookList.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "guestbook__empty";
    empty.textContent = "Chưa thể tải lời chúc. Vui lòng thử lại sau.";
    guestbookList.append(empty);
    guestbookStatus.textContent = "";
  }
}

if (guestbookViewport) {
  ["pointerenter", "touchstart"].forEach((eventName) => guestbookViewport.addEventListener(eventName, () => { guestbookPaused = true; }, { passive: true }));
  ["pointerleave", "touchend", "touchcancel"].forEach((eventName) => guestbookViewport.addEventListener(eventName, () => { guestbookPaused = false; scrollGuestbookToLatest(); }, { passive: true }));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scrollGuestbookToLatest(); });
  loadGuestbook();
  window.setInterval(() => loadGuestbook(true), 15000);
}
