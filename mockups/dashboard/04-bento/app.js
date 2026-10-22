// Sidebar behaviour for the Bento mockup.
// Desktop: the collapse button toggles an icon-only rail (remembered per browser).
// Mobile: the menu button slides the full sidebar in over the page.

const shell = document.getElementById("shell");
const collapseBtn = document.getElementById("collapse-btn");
const menuBtn = document.getElementById("menu-btn");
const scrim = document.getElementById("scrim");

const STORAGE_KEY = "botv3-sidebar-collapsed";

function setCollapsed(collapsed) {
  shell.classList.toggle("is-collapsed", collapsed);
  collapseBtn.setAttribute("aria-expanded", String(!collapsed));
  collapseBtn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // storage blocked: state just won't persist
  }
}

try {
  if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
} catch {
  // ignore
}

collapseBtn.addEventListener("click", () => {
  setCollapsed(!shell.classList.contains("is-collapsed"));
});

menuBtn.addEventListener("click", () => shell.classList.add("is-open"));
scrim.addEventListener("click", () => shell.classList.remove("is-open"));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") shell.classList.remove("is-open");
  if (e.key === "[" && !e.target.closest("input")) {
    setCollapsed(!shell.classList.contains("is-collapsed"));
  }
});
