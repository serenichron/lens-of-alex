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

// Lightweight contact form feedback (no backend wired yet)
const form = document.querySelector('form[action="#"]');
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = "Mulțumesc! Te contactez curând.";
    btn.setAttribute("disabled", "true");
    form.reset();
    setTimeout(() => {
      btn.textContent = original;
      btn.removeAttribute("disabled");
    }, 4000);
  });
}
