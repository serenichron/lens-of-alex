// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Active nav link based on section in view
const navLinks = document.querySelectorAll('.site-nav .nav-link[href^="#"]');
const sections = [...navLinks]
  .map(a => document.querySelector(a.getAttribute("href")))
  .filter(Boolean);

const activate = (id) => {
  navLinks.forEach(a => {
    a.classList.toggle("active", a.getAttribute("href") === `#${id}`);
  });
};

if ("IntersectionObserver" in window && sections.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) activate(e.target.id); });
  }, { rootMargin: "-40% 0px -55% 0px", threshold: 0 });
  sections.forEach(s => io.observe(s));
}

// =============================================================
// Portfolio loading overlay
// Covers the page with a spinner + progress counter until every
// gallery image has finished loading. Hides the masonry-reflow
// chaos while images arrive at different times.
// =============================================================
(function () {
  const grid = document.querySelector(".portfolio-cluster-grid");
  if (!grid) return;
  const imgs = Array.from(grid.querySelectorAll("img"));
  if (imgs.length <= 24) return; // small galleries: no overlay needed

  // Force eager load — overlay would otherwise wait forever for
  // lazy images that never enter the (covered) viewport.
  imgs.forEach((img) => {
    if (img.loading === "lazy") img.loading = "eager";
  });

  const overlay = document.createElement("div");
  overlay.className = "portfolio-loader";
  overlay.innerHTML =
    '<div class="portfolio-loader-spinner" aria-hidden="true"></div>' +
    '<div class="portfolio-loader-text">Se încarcă portofoliul</div>' +
    '<div class="portfolio-loader-progress">0 / ' + imgs.length + '</div>';
  document.body.appendChild(overlay);

  const total = imgs.length;
  let loaded = 0;
  const progressEl = overlay.querySelector(".portfolio-loader-progress");

  const tick = () => {
    loaded++;
    progressEl.textContent = loaded + " / " + total;
    if (loaded >= total) finish();
  };

  const finish = () => {
    overlay.classList.add("done");
    setTimeout(() => overlay.remove(), 500);
  };

  imgs.forEach((img) => {
    if (img.complete && img.naturalWidth > 0) {
      tick();
    } else {
      img.addEventListener("load", tick, { once: true });
      img.addEventListener("error", tick, { once: true });
    }
  });

  // Fallback: if anything hangs, reveal anyway after 60s
  setTimeout(() => {
    if (!overlay.classList.contains("done")) finish();
  }, 60000);
})();

// =============================================================
// Lightbox — click any gallery image to view full-size with
// dark overlay, prev/next nav, close button, keyboard support.
// =============================================================
(function () {
  const gallerySelector =
    ".portfolio-cluster-grid, .svc-gallery, .portfolio-grid";

  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Vizualizator imagini");
  const iconClose =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
  const iconPrev =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
  const iconNext =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

  lb.innerHTML =
    '<button class="lightbox-close" type="button" aria-label="Închide">' + iconClose + '</button>' +
    '<button class="lightbox-prev" type="button" aria-label="Imaginea anterioară">' + iconPrev + '</button>' +
    '<img class="lightbox-image" alt="">' +
    '<button class="lightbox-next" type="button" aria-label="Imaginea următoare">' + iconNext + '</button>' +
    '<div class="lightbox-counter"></div>';
  document.body.appendChild(lb);

  const lbImg = lb.querySelector(".lightbox-image");
  const lbCounter = lb.querySelector(".lightbox-counter");
  const lbClose = lb.querySelector(".lightbox-close");
  const lbPrev = lb.querySelector(".lightbox-prev");
  const lbNext = lb.querySelector(".lightbox-next");

  let images = [];
  let index = 0;

  const update = () => {
    const src = images[index];
    lbImg.src = src.src;
    lbImg.alt = src.alt;
    lbCounter.textContent = index + 1 + " / " + images.length;
  };

  const open = (gallery, clickedImg) => {
    images = Array.from(gallery.querySelectorAll("img")).map((img) => ({
      src: img.currentSrc || img.src,
      alt: img.alt || "",
      el: img,
    }));
    index = images.findIndex((i) => i.el === clickedImg);
    if (index < 0) index = 0;
    update();
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
  };

  const close = () => {
    lb.classList.remove("open");
    document.body.style.overflow = "";
    // Don't blank src immediately — keeps cache warm if user reopens
  };

  const next = () => {
    index = (index + 1) % images.length;
    update();
  };
  const prev = () => {
    index = (index - 1 + images.length) % images.length;
    update();
  };

  // Click on any gallery image opens lightbox
  document.addEventListener("click", (e) => {
    const img = e.target.closest("img");
    if (!img) return;
    const gallery = img.closest(gallerySelector);
    if (!gallery) return;
    e.preventDefault();
    open(gallery, img);
  });

  // Lightbox controls
  lbClose.addEventListener("click", close);
  lbPrev.addEventListener("click", prev);
  lbNext.addEventListener("click", next);

  // Click on the dark backdrop closes (but not on image or buttons)
  lb.addEventListener("click", (e) => {
    if (e.target === lb) close();
  });

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
  });
})();

