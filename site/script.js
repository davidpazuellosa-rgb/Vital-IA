const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const navLinks = document.querySelectorAll(".site-nav a");
const revealItems = document.querySelectorAll(".reveal");
const moreSectorsToggle = document.querySelector("#more-sectors-toggle");
const moreSectorsPanel = document.querySelector("#more-sectors-panel");

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
    siteNav.classList.toggle("is-open");
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    if (siteNav.classList.contains("is-open")) {
      siteNav.classList.remove("is-open");
      menuToggle?.setAttribute("aria-expanded", "false");
    }
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.2,
  }
);

revealItems.forEach((item) => revealObserver.observe(item));

if (moreSectorsToggle && moreSectorsPanel) {
  moreSectorsToggle.addEventListener("click", () => {
    const expanded = moreSectorsToggle.getAttribute("aria-expanded") === "true";
    const nextState = !expanded;

    moreSectorsToggle.setAttribute("aria-expanded", String(nextState));
    moreSectorsToggle.querySelector(".toggle-label").textContent = nextState ? "Ver menos" : "Ver mais";
    moreSectorsToggle.querySelector(".toggle-text").textContent = nextState
      ? "Recolha os setores complementares e volte à grade principal."
      : "Expanda para visualizar outras frentes de fornecimento e operação.";

    moreSectorsPanel.hidden = !nextState;

    if (nextState) {
      moreSectorsPanel.querySelectorAll(".reveal").forEach((item) => {
        if (!item.classList.contains("is-visible")) {
          revealObserver.observe(item);
        }
      });
      moreSectorsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}
