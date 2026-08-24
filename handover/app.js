const TABS = ["overview", "configuration", "deployment", "access", "notes"];

function showTab(id) {
  const next = TABS.includes(id) ? id : "overview";
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.setAttribute("aria-selected", button.dataset.tab === next ? "true" : "false");
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === next);
  });
  if (location.hash.replace("#", "") !== next) {
    history.replaceState(null, "", `#${next}`);
  }
}

function init() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
  });
  showTab(location.hash.replace("#", "") || "overview");
  window.addEventListener("hashchange", () => {
    showTab(location.hash.replace("#", "") || "overview");
  });
}

document.addEventListener("DOMContentLoaded", init);
