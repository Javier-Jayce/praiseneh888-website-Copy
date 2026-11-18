import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "./supabase.js";

const $ = id => document.getElementById(id);
const PAGE_SIZE = 10;
const BUCKET = "amulet-photos";
let db = null;
let items = [];
let page = 1;
let currentUserId = null;
let previewObjectUrls = [];
let busy = false;

function message(id, value) { $(id).textContent = value; }
function escapeHtml(value = "") {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}
function imagesOf(item) {
  return Array.isArray(item?.images)
    ? item.images.filter(s => typeof s === "string" && /^https?:\/\//i.test(s))
    : [];
}
function priceText(item) {
  return item.price_mode === "pm" || item.price == null
    ? "PM FOR PRICE" : `S$${Number(item.price).toFixed(2)}`;
}
function setBusy(value) {
  busy = value;
  $("saveButton").disabled = value;
  $("saveButton").textContent = value ? "Saving..." : "Save piece";
}
function clearPreview() {
  previewObjectUrls.forEach(url => URL.revokeObjectURL(url));
  previewObjectUrls = [];
  $("photoPreview").replaceChildren();
}
function previewPhotos(existing = []) {
  clearPreview();
  for (const url of existing) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Existing amulet photo";
    $("photoPreview").append(img);
  }
  for (const file of $("photos").files) {
    if (!file.type.startsWith("image/")) continue;
    const url = URL.createObjectURL(file);
    previewObjectUrls.push(url);
    const img = document.createElement("img");
    img.src = url;
    img.alt = "New photo to upload";
    img.style.borderColor = "#b99755";
    $("photoPreview").append(img);
  }
}
function clearForm() {
  $("amuletForm").reset();
  $("itemId").value = "";
  $("description").value = ""; // Always start with truly empty textarea.
  $("formHeading").textContent = "Add a piece";
  clearPreview();
  message("editorMessage", "");
}

function filteredItems() {
  const query = $("adminSearch").value.toLocaleLowerCase().trim();
  const status = $("adminStatus").value;
  return items.filter(item => {
    if (status && item.status !== status) return false;
    if (!query) return true;
    return [item.name, item.master, item.ajarn, item.category, item.description]
      .some(value => String(value ?? "").toLocaleLowerCase().includes(query));
  });
}
function renderList() {
  const filtered = filteredItems();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  page = Math.min(Math.max(page, 1), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  $("adminCount").textContent = `${filtered.length} of ${items.length} listings`;
  $("adminItems").innerHTML = visible.map(item => {
    const firstImage = imagesOf(item)[0];
    return `<article class="admin-item">
      ${firstImage ? `<img class="admin-thumb" src="${escapeHtml(firstImage)}" alt="" loading="lazy">` : `<div class="admin-thumb" aria-hidden="true">๙</div>`}
      <div class="admin-item-info">
        <strong>${escapeHtml(item.name || "Untitled")}</strong>
        <small>${escapeHtml(item.master || item.ajarn || "")}</small>
        <small>${escapeHtml(item.status || "available")} · ${escapeHtml(priceText(item))} · ${imagesOf(item).length} photo(s)</small>
      </div>
      <div class="admin-actions">
        <button type="button" data-edit="${escapeHtml(item.id)}">Edit</button>
        <button type="button" data-delete="${escapeHtml(item.id)}">Delete</button>
      </div>
    </article>`;
  }).join("") || '<p class="muted">No amulets match your search.</p>';
  $("adminPagination").hidden = filtered.length <= PAGE_SIZE;
  $("pageInfo").textContent = `Page ${page} of ${totalPages}`;
  $("prevPage").disabled = page === 1;
  $("nextPage").disabled = page === totalPages;
}
async function loadItems() {
  if (!db) return;
  // Supabase PostgREST defaults to a maximum of 1,000 rows per request.
  // Fetch all batches so pagination/search includes older amulets too.
  const loaded = [];
  let offset = 0;
  const batchSize = 500;
  while (true) {
    const { data, error } = await db.from("amulets")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + batchSize - 1);
    if (error) throw error;
    loaded.push(...(data || []));
    if (!data || data.length < batchSize) break;
    offset += batchSize;
  }
  items = loaded;
  renderList();
}
async function showSession(session) {
  const signedIn = Boolean(session);
  $("loginPanel").hidden = signedIn;
  $("dashboard").hidden = !signedIn;
  if (!signedIn) {
    currentUserId = null;
    items = [];
    clearForm();
    return;
  }
  if (session.user.id === currentUserId) return;
  currentUserId = session.user.id;
  try {
    await loadItems();
  } catch (error) {
    message("editorMessage", `Unable to load listings: ${error.message}`);
  }
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!db) return;
  message("loginMessage", "Signing in...");
  const { error } = await db.auth.signInWithPassword({
    email: $("email").value.trim(), password: $("password").value
  });
  message("loginMessage", error?.message || "");
});
$("signOut").addEventListener("click", async () => {
  if (!db) return;
  const { error } = await db.auth.signOut();
  if (error) message("editorMessage", error.message);
});
$("adminSearch").addEventListener("input", () => { page = 1; renderList(); });
$("adminStatus").addEventListener("change", () => { page = 1; renderList(); });
$("prevPage").addEventListener("click", () => { if (page > 1) { page--; renderList(); } });
$("nextPage").addEventListener("click", () => {
  if (page * PAGE_SIZE < filteredItems().length) { page++; renderList(); }
});
$("clearForm").addEventListener("click", clearForm);
$("photos").addEventListener("change", () => {
  const current = items.find(x => String(x.id) === $("itemId").value);
  previewPhotos(imagesOf(current));
});

$("adminItems").addEventListener("click", async event => {
  if (busy) return;
  const edit = event.target.closest("button[data-edit]");
  const del = event.target.closest("button[data-delete]");
  if (!edit && !del) return;
  const id = (edit || del).dataset[edit ? "edit" : "delete"];
  const item = items.find(x => String(x.id) === id);
  if (!item) return;
  if (edit) {
    $("itemId").value = item.id;
    $("itemName").value = item.name || "";
    $("master").value = item.master || item.ajarn || "";
    $("category").value = item.category || "";
    $("description").value = String(item.description || "").trim();
    $("priceMode").value = item.price_mode || "pm";
    $("price").value = item.price ?? "";
    $("status").value = item.status || "available";
    $("photos").value = "";
    $("formHeading").textContent = "Edit a piece";
    previewPhotos(imagesOf(item));
    message("editorMessage", `Editing: ${item.name}`);
    $("itemName").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (!window.confirm(`Delete "${item.name}"? This removes the listing (not the stored photos).`)) return;
  message("editorMessage", "Deleting listing...");
  const { data, error } = await db.from("amulets").delete().eq("id", id).select("id");
  if (error || !data?.length) {
    message("editorMessage", error?.message || "Delete was not allowed. Check your Supabase permissions.");
    return;
  }
  if ($("itemId").value === id) clearForm();
  try {
    await loadItems();
    message("editorMessage", "Listing deleted.");
  } catch (loadError) {
    message("editorMessage", `Deleted, but refresh failed: ${loadError.message}`);
  }
});

$("amuletForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!db || busy) return;
  const id = $("itemId").value;
  const existing = items.find(item => String(item.id) === id);
  const files = Array.from($("photos").files);
  const uploadedPaths = [];
  let saved = false;
  setBusy(true);
  try {
    const name = $("itemName").value.trim();
    if (!name) throw new Error("Please enter an amulet name.");
    const priceMode = $("priceMode").value;
    const priceRaw = $("price").value.trim();
    const price = priceMode === "pm" || priceRaw === "" ? null : Number(priceRaw);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      throw new Error("Please enter a valid price.");
    }
    const urls = [...imagesOf(existing)];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
      message("editorMessage", `Uploading photo ${i + 1} of ${files.length}...`);
      const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from(BUCKET).upload(path, file, {
        upsert: false, contentType: file.type
      });
      if (error) throw error;
      uploadedPaths.push(path); // Record immediately so partial uploads can be cleaned up.
      const { data } = db.storage.from(BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("Unable to obtain image URL.");
      urls.push(data.publicUrl);
    }
    const payload = {
      name,
      master: $("master").value.trim(),
      category: $("category").value.trim(),
      description: $("description").value.trim(),
      price_mode: priceMode,
      price,
      status: $("status").value,
      images: urls
    };
    message("editorMessage", "Saving listing...");
    const result = id
      ? await db.from("amulets").update(payload).eq("id", id).select("id")
      : await db.from("amulets").insert(payload).select("id");
    if (result.error) throw result.error;
    if (!result.data?.length) throw new Error("No listing was saved. Check the Supabase permissions.");
    saved = true;
    clearForm();
    page = 1;
    try {
      await loadItems();
      message("editorMessage", "Piece saved successfully.");
    } catch (refreshError) {
      message("editorMessage", `Piece saved, but refresh failed: ${refreshError.message}`);
    }
  } catch (error) {
    if (!saved && uploadedPaths.length) {
      const { error: cleanupError } = await db.storage.from(BUCKET).remove(uploadedPaths);
      if (cleanupError) console.error("Could not clean up unsaved photos:", cleanupError);
    }
    console.error("Save error:", error);
    message("editorMessage", `Error: ${error.message || "Unable to save."}`);
  } finally {
    setBusy(false);
  }
});

if (!supabaseConfigured) {
  message("loginMessage", "Supabase configuration is missing in supabase.js.");
} else {
  db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  db.auth.onAuthStateChange((_event, session) => {
    // Do not run awaited Supabase queries directly in this auth callback.
    setTimeout(() => { void showSession(session); }, 0);
  });
  db.auth.getSession().then(({ data, error }) => {
    if (error) message("loginMessage", error.message);
    else void showSession(data.session);
  });
}
