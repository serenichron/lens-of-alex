// Footer year — defensive: not every page has the element, and a TypeError
// here would kill every script below (lightbox, portfolio loader, nav state).
(function () {
  const el = document.getElementById("year");
  if (el) el.textContent = new Date().getFullYear();
})();

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

// =============================================================
// Portfolio masonry
// CSS Grid with JS placing every photo explicitly. Photos drop
// into the shortest column, so single tiles never gap. A landscape
// photo is promoted to a 2-column-wide tile on a cadence (~every
// 6–8). A wide tile must start below the taller of the two columns
// it bridges — the gap that leaves in the shorter column is closed
// by growing the photo directly above it, which object-fit: cover
// zooms in slightly. Result: a gap-free layout. A wide tile is
// skipped if closing its gap would need more than a modest zoom.
// Manual override: data-wide="true" / "false" on a <figure>.
// =============================================================
(function () {
  const grids = document.querySelectorAll(".portfolio-cluster-grid");
  if (!grids.length) return;

  const GUTTER = 8;               // px — gap between tiles
  const WIDE_CADENCE = [6, 7, 8]; // earliest a new wide tile may appear
  const LANDSCAPE_RATIO = 1.25;   // width/height at/above this = landscape
  const MAX_FILL_ZOOM = 0.3;      // a gap-fill photo may be zoomed at most this much

  const ratioOf = (img) => {
    if (img && img.naturalWidth && img.naturalHeight)
      return img.naturalWidth / img.naturalHeight;
    const w = parseFloat(img && img.getAttribute("width"));
    const h = parseFloat(img && img.getAttribute("height"));
    return w && h ? w / h : 0.8; // unknown → assume portrait
  };

  function layoutGrid(grid) {
    const figures = Array.from(grid.children);
    if (!figures.length) return;

    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    const colW = (grid.clientWidth - (cols - 1) * GUTTER) / cols;

    const bottom = new Array(cols).fill(0);     // running bottom edge, px
    const lastFig = new Array(cols).fill(null); // last photo placed per column
    const lastH = new Array(cols).fill(0);      // its current height
    const lastWide = new Array(cols).fill(false);
    let since = 0;   // photos placed since the last wide tile
    let wideN = 0;   // wide tiles placed so far (cycles the cadence)

    // write a figure's column + row placement and its photo height
    const apply = (fig, col, span, y, h) => {
      const img = fig.querySelector("img");
      if (img) img.style.height = h + "px";
      fig.style.gridColumnStart = col + 1;
      fig.style.gridColumnEnd = "span " + span;
      fig.style.gridRowStart = Math.round(y) + 1;
      fig.style.gridRowEnd = "span " + (h + GUTTER);
    };

    // grow column c's last photo by d px to swallow a gap (object-fit crops it)
    const fill = (c, d) => {
      if (d <= 0) return true;
      if (!lastFig[c] || lastWide[c]) return false;
      const top = bottom[c] - lastH[c] - GUTTER;
      lastH[c] += d;
      apply(lastFig[c], c, 1, top, lastH[c]);
      bottom[c] += d;
      return true;
    };

    // adjacent column pair whose heights are closest
    const bestPair = () => {
      let p = 0, d = Infinity;
      for (let c = 0; c < cols - 1; c++) {
        const diff = Math.abs(bottom[c] - bottom[c + 1]);
        if (diff < d) { d = diff; p = c; }
      }
      return { p, d };
    };

    figures.forEach((fig) => {
      const ratio = ratioOf(fig.querySelector("img"));
      const manual = fig.dataset.wide;

      // ---- decide: single column or 2-column-wide ----
      let goWide = false, pair = 0;
      if (cols >= 2 && manual === "true") {
        goWide = true; pair = bestPair().p;
      } else if (manual !== "false" && cols >= 2 && ratio >= LANDSCAPE_RATIO) {
        const target = WIDE_CADENCE[wideN % WIDE_CADENCE.length];
        if (since + 1 >= target) {
          const bp = bestPair();
          const lo = bottom[bp.p] <= bottom[bp.p + 1] ? bp.p : bp.p + 1;
          // go wide only if the gap closes with a modest zoom
          if (bp.d === 0 ||
              (lastFig[lo] && !lastWide[lo] && bp.d <= MAX_FILL_ZOOM * lastH[lo])) {
            goWide = true; pair = bp.p;
          }
        }
      }

      // ---- place it ----
      if (goWide) {
        const tall = Math.max(bottom[pair], bottom[pair + 1]);
        fill(pair, tall - bottom[pair]);          // close the gap in the
        fill(pair + 1, tall - bottom[pair + 1]);  // shorter column
        const h = Math.ceil((2 * colW + GUTTER) / ratio);
        apply(fig, pair, 2, tall, h);
        const nb = tall + h + GUTTER;
        bottom[pair] = bottom[pair + 1] = nb;
        lastFig[pair] = lastFig[pair + 1] = fig;
        lastH[pair] = lastH[pair + 1] = h;
        lastWide[pair] = lastWide[pair + 1] = true;
        since = 0; wideN++;
      } else {
        let col = 0;
        for (let c = 1; c < cols; c++) if (bottom[c] < bottom[col]) col = c;
        const h = Math.ceil(colW / ratio);
        apply(fig, col, 1, bottom[col], h);
        bottom[col] += h + GUTTER;
        lastFig[col] = fig; lastH[col] = h; lastWide[col] = false;
        since++;
      }
    });
  }

  let queued = false;
  function relayout() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      grids.forEach(layoutGrid);
    });
  }

  relayout(); // first pass with whatever is known so far
  grids.forEach((grid) => {
    grid.querySelectorAll("img").forEach((img) => {
      if (img.complete) return;
      img.addEventListener("load", relayout, { once: true });
      img.addEventListener("error", relayout, { once: true });
    });
  });
  window.addEventListener("load", relayout); // final pass once everything is in

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(relayout, 150);
  });
})();

