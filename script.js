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
let autoScrollRequested = false;
let autoScrollReady = false;
let autoScrollActive = false;
let autoScrollFrame = 0;
let autoScrollLastFrame = 0;
let autoScrollResumeTimer = 0;

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

function handleForm(form, storageKey, successSelector) {
  form.addEventListener("submit", (event) => {
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

    window.setTimeout(() => {
      const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
      existing.push({ ...data, createdAt: new Date().toISOString() });
      localStorage.setItem(storageKey, JSON.stringify(existing));
      submit.textContent = originalText;
      submit.disabled = false;
      form.hidden = true;
      form.closest(".modal-panel").querySelector(successSelector).hidden = false;
    }, reduceMotion ? 100 : 650);
  });
}

const rsvpForm = document.querySelector("[data-rsvp-form]");
const wishesForm = document.querySelector("[data-wishes-form]");
if (rsvpForm) handleForm(rsvpForm, "wedding-rsvp-preview", "[data-rsvp-success]");
if (wishesForm) handleForm(wishesForm, "wedding-wishes-preview", "[data-wishes-success]");

const galleryImages = [
  { src: "assets/gallery-wide.jpg", alt: "Phan Vũ hôn Quỳnh Như bên bờ biển" },
  { src: "assets/gallery-facing.jpg", alt: "Phan Vũ và Quỳnh Như nhìn nhau bên bờ biển" },
  { src: "assets/gallery-kiss.jpg", alt: "Phan Vũ và Quỳnh Như trao nhau nụ hôn" },
];

const gallery = document.querySelector("[data-gallery]");
const carouselImage = document.querySelector("[data-carousel-image]");
const carouselCurrent = document.querySelector("[data-carousel-current]");
const carouselThumbnails = [...document.querySelectorAll("[data-carousel-index]")];
let carouselIndex = 0;
let carouselPointerStart = null;

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
  });
}

gallery?.querySelector("[data-carousel-previous]").addEventListener("click", () => showCarouselImage(carouselIndex - 1));
gallery?.querySelector("[data-carousel-next]").addEventListener("click", () => showCarouselImage(carouselIndex + 1));
gallery?.querySelector("[data-carousel-open]").addEventListener("click", (event) => openLightbox(carouselIndex, event.currentTarget));
carouselThumbnails.forEach((thumbnail) => {
  thumbnail.addEventListener("click", () => showCarouselImage(Number(thumbnail.dataset.carouselIndex)));
});
gallery?.addEventListener("pointerdown", (event) => {
  carouselPointerStart = event.clientX;
});
gallery?.addEventListener("pointerup", (event) => {
  if (carouselPointerStart === null) return;
  const distance = event.clientX - carouselPointerStart;
  carouselPointerStart = null;
  if (Math.abs(distance) < 45) return;
  showCarouselImage(carouselIndex + (distance < 0 ? 1 : -1));
});
gallery?.addEventListener("pointercancel", () => {
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