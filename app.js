import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  supabaseConfigured
} from "./supabase.js";

const FACEBOOK =
  "https://www.facebook.com/profile.php?id=100081192944434";

const grid = document.querySelector("#catalogueGrid");
const search = document.querySelector("#searchInput");
const masterFilter = document.querySelector("#masterFilter");
const cat = document.querySelector("#categoryFilter");
const status = document.querySelector("#statusFilter");
const count = document.querySelector("#resultCount");
const empty = document.querySelector("#emptyState");
const modal = document.querySelector("#detailModal");
const content = document.querySelector("#modalContent");
const nav = document.querySelector("#mainNav");
const menu = document.querySelector("#menuToggle");

let items = [];
let activeSpeciality = "";
let previousFocus = null;
const PAGE_SIZE = 12;
let currentPage = 1;

// Public catalogue controls and compact mobile cards.
const catalogueStyles = document.createElement("style");
catalogueStyles.textContent = `
  .catalogue-pagination{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:9px;margin:32px 0 0}
  .catalogue-pagination button{border:1px solid #c7a96b;background:#fcfaf4;color:#164737;padding:10px 13px;min-height:42px;font:600 12px "DM Sans",sans-serif;cursor:pointer}
  .catalogue-pagination button[aria-current="page"]{background:#164737;color:#fff}
  .catalogue-pagination button:disabled{opacity:.4;cursor:not-allowed}
  .catalogue-pagination .page-summary{font-size:12px;color:#68776d;margin:0 6px}
  @media(max-width:600px){
    #catalogueGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    #catalogueGrid .card-image{height:auto;aspect-ratio:1/1.15}
    #catalogueGrid .card-image img{padding:5px}
    #catalogueGrid .card-body{padding:11px 9px}
    #catalogueGrid .card-body h3{font-size:15px;line-height:1.35;margin:6px 0}
    #catalogueGrid .card-kicker{font-size:8px;line-height:1.35}
    #catalogueGrid .card-body p{font-size:10px;line-height:1.5;margin-bottom:9px}
    #catalogueGrid .card-bottom{font-size:10px;gap:5px;align-items:flex-start;flex-direction:column;padding-top:8px}
    #catalogueGrid .status{font-size:8px;padding:3px 5px}
    .catalogue-pagination{gap:5px}
    .catalogue-pagination button{padding:8px 10px}
  }
`;
document.head.append(catalogueStyles);

const pagination = document.createElement("nav");
pagination.className = "catalogue-pagination";
pagination.setAttribute("aria-label", "Catalogue pages");
grid.insertAdjacentElement("afterend", pagination);

function renderPagination(total) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) { pagination.innerHTML = ""; return; }
  const visible = new Set([1, pages, currentPage-1, currentPage, currentPage+1]);
  const pageButtons = [...visible].filter(n => n>=1 && n<=pages).sort((a,b)=>a-b);
  let middle = "";
  let prior = 0;
  for (const page of pageButtons) {
    if (page-prior>1) middle += '<span aria-hidden="true">…</span>';
    middle += `<button type="button" data-page="${page}" ${page===currentPage?'aria-current="page"':''} aria-label="Page ${page}">${page}</button>`;
    prior = page;
  }
  pagination.innerHTML = `
    <button type="button" data-page="${currentPage-1}" ${currentPage===1?'disabled':''}>← Previous</button>
    ${middle}
    <button type="button" data-page="${currentPage+1}" ${currentPage===pages?'disabled':''}>Next →</button>
    <span class="page-summary">Page ${currentPage} of ${pages}</span>
  `;
}
pagination.addEventListener("click", event => {
  const button = event.target.closest("button[data-page]");
  if (!button || button.disabled) return;
  currentPage = Number(button.dataset.page);
  render();
  document.querySelector("#catalogue").scrollIntoView({behavior:"smooth",block:"start"});
});

document.querySelector("#year").textContent =
  new Date().getFullYear();

// Update the existing Facebook links throughout the homepage.
document.querySelectorAll('a[href*="facebook.com"]').forEach(link => {
  link.href = FACEBOOK;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
});

menu.setAttribute("aria-expanded", "false");
menu.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menu.setAttribute("aria-expanded", String(open));
});

nav.addEventListener("click", event => {
  if (!event.target.closest("a")) return;
  nav.classList.remove("open");
  menu.setAttribute("aria-expanded", "false");
});

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u0E00-\u0E7F]+/g, " ")
    .trim();
}

function masterName(item) {
  return item.master || item.ajarn || "";
}

function priceLabel(item) {
  return item.price_mode === "pm" || item.price == null
    ? "PM FOR PRICE"
    : `S$${Number(item.price).toFixed(2)}`;
}

function statusLabel(item) {
  return item.status === "sold"
    ? "Past collection"
    : item.status || "available";
}

function safeImage(value) {
  try {
    const url = new URL(value, window.location.href);
    return ["https:", "http:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function imageUrls(item) {
  return Array.isArray(item.images)
    ? item.images.map(safeImage).filter(Boolean)
    : [];
}

function matchesSpeciality(item) {
  if (!activeSpeciality) return true;

  const master = normalize(masterName(item));
  const title = normalize(item.name);
  const masterAndTitle = `${master} ${title}`;
  const allText = normalize([
    masterName(item),
    item.name,
    item.category,
    item.description
  ].join(" "));

  const containsWord = word =>
    new RegExp(`\\b${word}\\b`).test(masterAndTitle);

  if (activeSpeciality === "meng") {
    return containsWord("meng");
  }

  if (activeSpeciality === "perm") {
    return containsWord("perm") || containsWord("pern");
  }

  if (activeSpeciality === "put") {
    return containsWord("put");
  }

  if (activeSpeciality === "maha") {
    return /\bmaha\s+(seneh|saneh|sanaeh)\b/.test(allText) ||
      /\bold\s*school\b/.test(allText);
  }

  return true;
}

const specialityNames = {
  meng: "Ajarn Meng",
  perm: "Ajarn Perm Prai Dam",
  put: "Ajarn Put",
  maha: "Maha Seneh & old-school pieces"
};

// Connect the four existing Explore pieces buttons.
const specialityKeys = ["meng", "perm", "put", "maha"];

document.querySelectorAll(".speciality-card .text-link")
  .forEach((link, index) => {
    const key = specialityKeys[index];
    if (!key) return;

    link.addEventListener("click", () => {
      activeSpeciality = key;
      search.value = "";
      cat.value = "";
      status.value = "";
      currentPage = 1;
      render();
    });
  });

// A visible way to clear the selected master or category.
const reset = document.createElement("button");
reset.type = "button";
reset.className = "text-link";
reset.textContent = "Clear filters · Show all";
reset.className = "clear-filters";
reset.hidden = true;
reset.style.cssText =
  "cursor:pointer;background:transparent;border:0;" +
  "font:inherit;color:inherit;margin-left:12px;";

count.insertAdjacentElement("afterend", reset);

reset.addEventListener("click", () => {
  activeSpeciality = "";
  masterFilter.value = "";
  search.value = "";
  cat.value = "";
  status.value = "";
  currentPage = 1;
  render();
});

function render() {
  const query = normalize(search.value);

  const list = items.filter(item => {
    const text = normalize([
      item.name,
      masterName(item),
      item.description,
      item.category
    ].join(" "));

    return (!query || text.includes(query)) &&
      (!masterFilter.value || normalize(masterName(item)) === masterFilter.value) &&
      (!cat.value || item.category === cat.value) &&
      (!status.value || item.status === status.value) &&
      matchesSpeciality(item);
  });

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), pages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = list.slice(start, start + PAGE_SIZE);

  count.textContent =
    `${list.length} ${list.length === 1 ? "piece" : "pieces"}` +
    (activeSpeciality
      ? ` · ${specialityNames[activeSpeciality]}`
      : "");

  reset.hidden = !(
    activeSpeciality || masterFilter.value || search.value || cat.value || status.value
  );

  empty.textContent =
    "No pieces match this selection. Try Show all pieces.";

  empty.hidden = list.length > 0;

  grid.innerHTML = visible.map(item => {
    const images = imageUrls(item);

    return `
      <article class="amulet-card"
        data-id="${esc(item.id)}"
        tabindex="0"
        role="button"
        aria-label="View ${esc(item.name)}">
        <div class="card-image">
          ${images[0]
            ? `<img src="${esc(images[0])}"
                alt="${esc(item.name)}" loading="lazy">`
            : '<span class="image-placeholder">๙</span>'}
        </div>
        <div class="card-body">
          <div class="card-kicker">
            ${esc(masterName(item) ||
              item.category || "Praiseneh888 collection")}
          </div>
          <h3>${esc(item.name)}</h3>
          <p>${esc(item.description ||
            "Discover this piece from the Praiseneh888 collection.")}</p>
          <div class="card-bottom">
            <span class="price">${esc(priceLabel(item))}</span>
            <span class="status ${esc(item.status || "available")}">
              ${esc(statusLabel(item))}
            </span>
          </div>
        </div>
      </article>`;
  }).join("");
  renderPagination(list.length);
}

[search, masterFilter, cat, status].forEach(element => {
  element.addEventListener("input", () => { currentPage = 1; render(); });
});

function openDetails(card) {
  const item = items.find(value =>
    String(value.id) === card.dataset.id
  );
  if (!item) return;

  previousFocus = document.activeElement;
  const images = imageUrls(item);

  content.innerHTML = `
    <div class="modal-detail">
      <div>
        ${images.map(url => `
          <img src="${esc(url)}" alt="${esc(item.name)}">
        `).join("") ||
          '<div class="image-placeholder">๙</div>'}
      </div>
      <div>
        <p class="eyebrow">
          ${esc(masterName(item) || item.category || "PRAISENEH888")}
        </p>
        <h2 id="detailTitle">${esc(item.name)}</h2>
        <p style="white-space:pre-wrap">${esc(item.description || "")}</p>
        <p class="price">${esc(priceLabel(item))}</p>
        <span class="status ${esc(item.status || "available")}">
          ${esc(statusLabel(item))}
        </span>
        <p>
          <a class="primary-button"
            href="${FACEBOOK}"
            target="_blank"
            rel="noopener noreferrer">
            Enquire on Facebook ↗
          </a>
        </p>
        <p style="font-size:13px">
          Facebook login may be required.
          Please mention this piece: <strong>${esc(item.name)}</strong>.
        </p>
      </div>
    </div>`;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "detailTitle");
  document.body.style.overflow = "hidden";
  modal.querySelector(".modal-close").focus();
  const detailUrl = new URL(window.location.href);
  detailUrl.searchParams.set("item", item.id);
  history.replaceState(null, "", detailUrl);
  addShareButtons();
}

function closeDetails() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  previousFocus?.focus();
  const detailUrl = new URL(window.location.href);
  detailUrl.searchParams.delete("item");
  history.replaceState(null, "", detailUrl);
}

grid.addEventListener("click", event => {
  const card = event.target.closest(".amulet-card");
  if (card) openDetails(card);
});

grid.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".amulet-card");
  if (!card) return;
  event.preventDefault();
  openDetails(card);
});

document.querySelectorAll("[data-close]").forEach(element => {
  element.addEventListener("click", closeDetails);
});

document.addEventListener("keydown", event => {
  if (!modal.classList.contains("open")) return;

  if (event.key === "Escape") {
    closeDetails();
    return;
  }

  if (event.key === "Tab") {
    const focusable = [...modal.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex="0"]'
    )];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey &&
      document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});

async function loadItems() {
  try {
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await db
      .from("amulets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    items = data || [];
    const sharedId = new URL(window.location.href).searchParams.get("item");

    const categories = [...new Set(
      items.map(item => item.category).filter(Boolean)
    )].sort();

    cat.innerHTML = '<option value="">All categories</option>' +
      categories.map(category =>
        `<option value="${esc(category)}">${esc(category)}</option>`
      ).join("");

    const masters = new Map();
    items.forEach(item => { const name = masterName(item).trim(); if (name) masters.set(normalize(name), name); });
    masterFilter.innerHTML = '<option value="">All masters</option>' + [...masters].sort((a,b)=>a[1].localeCompare(b[1])).map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join("");
    render();
    // A direct shared link works even when the listing is on another page.
    const shared = items.find(item => String(item.id) === sharedId);
    if (shared) openDetails({dataset:{id:String(shared.id)}});
  } catch (error) {
    grid.innerHTML =
      '<div class="loading">The catalogue is temporarily unavailable. ' +
      'Please refresh or contact us on Facebook.</div>';
    count.textContent = "Unable to load collection";
    empty.hidden = true;
    console.error(error);
  }
}

if (supabaseConfigured) {
  loadItems();
} else {
  grid.innerHTML =
    '<div class="loading">Catalogue setup is not connected yet. ' +
    'Please check back soon.</div>';
}
// Share individual amulet listings.
function listingUrl(id) {
  const url = new URL(window.location.href);
  url.searchParams.set("item", id);
  url.hash = "";
  return url.href;
}

async function copyListingLink(url, button) {
  try {
    await navigator.clipboard.writeText(url);
    button.textContent = "Link copied ✓";
  } catch {
    window.prompt("Copy this listing link:", url);
  }
}

function addShareButtons() {
  if (!modal.classList.contains("open")) return;
  if (content.querySelector("#listingShareTools")) return;

  const id = new URL(window.location.href).searchParams.get("item");
  const item = items.find(value => String(value.id) === id);
  if (!item) return;

  const container = document.createElement("div");
  container.id = "listingShareTools";
  container.style.cssText =
    "display:flex;flex-wrap:wrap;gap:12px;margin-top:18px;";

  const shareButton = document.createElement("button");
  shareButton.type = "button";
  shareButton.className = "primary-button";
  shareButton.textContent = "Share this piece ↗";
  shareButton.style.cursor = "pointer";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "primary-button";
  copyButton.textContent = "Copy link";
  copyButton.style.cursor = "pointer";

  const url = listingUrl(item.id);

  shareButton.addEventListener("click", async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${item.name} | Praiseneh888`,
          text: `View ${item.name} at Praiseneh888`,
          url
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          await copyListingLink(url, shareButton);
        }
      }
    } else {
      await copyListingLink(url, shareButton);
    }
  });

  copyButton.addEventListener("click", () => {
    copyListingLink(url, copyButton);
  });

  container.append(shareButton, copyButton);
  content.querySelector(".modal-detail > div:last-child")
    ?.append(container);
}

