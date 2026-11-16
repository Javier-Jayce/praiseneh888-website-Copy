
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  supabaseConfigured
} from "./supabase.js";

// ==========================================
// 1. INITIAL SETUP
// ==========================================

const $ = id => document.getElementById(id);

const loginPanel = $("loginPanel");
const dashboard = $("dashboard");

const loginForm = $("loginForm");
const amuletForm = $("amuletForm");

const saveButton = $("saveButton");
const adminItems = $("adminItems");

let db = null;
let items = [];
let currentUserId = null;

// Create photo preview area without changing admin.html.
const photoPreview = document.createElement("div");

photoPreview.id = "photoPreview";
photoPreview.style.cssText = `
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  margin-top:12px;
`;

$("photos").closest("label").after(photoPreview);

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================

function msg(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

function imageList(item) {
  return Array.isArray(item?.images)
    ? item.images.filter(url =>
        typeof url === "string" &&
        /^https?:\/\//i.test(url)
      )
    : [];
}

function setSaving(saving) {
  saveButton.disabled = saving;
  saveButton.textContent = saving
    ? "Saving..."
    : "Save piece";
}

function formatPrice(item) {
  if (item.price_mode === "pm") {
    return "PM FOR PRICE";
  }

  return item.price != null
    ? `S$${Number(item.price).toFixed(2)}`
    : "No price";
}

// ==========================================
// 3. SUPABASE INITIALIZATION
// ==========================================

if (!supabaseConfigured) {
  msg(
    "loginMessage",
    "Supabase is not configured. Please check supabase.js."
  );
} else {
  db = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  initializeAuth();
}

// ==========================================
// 4. AUTHENTICATION
// ==========================================

async function initializeAuth() {

  const { data, error } = await db.auth.getSession();

  if (error) {
    msg("loginMessage", error.message);
    return;
  }

  await showSession(data.session);

  db.auth.onAuthStateChange((event, session) => {

    if (event === "TOKEN_REFRESHED") return;

    showSession(session);

  });
}

async function showSession(session) {

  const loggedIn = !!session;

  loginPanel.hidden = loggedIn;
  dashboard.hidden = !loggedIn;

  if (!loggedIn) {
    currentUserId = null;
    items = [];
    return;
  }

  const userId = session.user.id;

  if (currentUserId !== userId) {
    currentUserId = userId;
    await loadItems();
  }
}

// ==========================================
// 5. LOGIN
// ==========================================

loginForm.addEventListener("submit", async event => {

  event.preventDefault();

  if (!db) return;

  msg("loginMessage", "Signing in...");

  const email = $("email").value.trim();
  const password = $("password").value;

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    msg("loginMessage", error.message);
  } else {
    msg("loginMessage", "");
  }

});

// ==========================================
// 6. LOGOUT
// ==========================================

$("signOut").addEventListener("click", async () => {

  if (!db) return;

  const { error } = await db.auth.signOut();

  if (error) {
    msg("editorMessage", error.message);
  }

});

// ==========================================
// 7. LOAD EXISTING AMULETS
// ==========================================

async function loadItems() {

  if (!db) return;

  msg("editorMessage", "Loading listings...");

  const { data, error } = await db
    .from("amulets")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {
    msg("editorMessage", "Unable to load listings: " + error.message);
    return;
  }

  items = data || [];

  renderList();

  msg("editorMessage", "");

}

// ==========================================
// 8. DISPLAY EXISTING LISTINGS
// ==========================================

function renderList() {

  $("adminCount").textContent =
    `${items.length} listings`;

  if (!items.length) {
    adminItems.innerHTML = `
      <p class="muted">
        No listings yet. Add your first piece.
      </p>
    `;
    return;
  }

  adminItems.innerHTML = items.map(item => {

    const images = imageList(item);

    return `
      <div class="admin-item">

        ${
          images[0]
            ? `
              <img
                class="admin-thumb"
                src="${esc(images[0])}"
                alt="${esc(item.name)}"
                loading="lazy">
            `
            : `
              <div class="admin-thumb">
                ๙
              </div>
            `
        }

        <div class="admin-item-info">

          <strong>${esc(item.name)}</strong>

          <small>
            ${esc(item.master || "Unknown master")}
            · ${esc(item.status || "available")}
            · ${esc(formatPrice(item))}
          </small>

          <small>
            ${images.length} photo(s)
          </small>

        </div>

        <div class="admin-actions">

          <button
            type="button"
            data-edit="${esc(item.id)}">
            Edit
          </button>

          <button
            type="button"
            data-delete="${esc(item.id)}">
            Delete
          </button>

        </div>

      </div>
    `;

  }).join("");

}

// ==========================================
// 9. PHOTO PREVIEW
// ==========================================

function showPhotoPreview(existingImages = []) {

  photoPreview.innerHTML = "";

  existingImages.forEach(url => {

    const img = document.createElement("img");

    img.src = url;
    img.alt = "Existing amulet photo";

    img.style.cssText = `
      width:85px;
      height:85px;
      object-fit:cover;
      border-radius:8px;
      border:1px solid #ccc;
    `;

    photoPreview.appendChild(img);

  });

  const files = $("photos").files;

  Array.from(files).forEach(file => {

    if (!file.type.startsWith("image/")) return;

    const img = document.createElement("img");

    img.src = URL.createObjectURL(file);
    img.alt = "New photo preview";

    img.style.cssText = `
      width:85px;
      height:85px;
      object-fit:cover;
      border-radius:8px;
      border:2px solid #b99755;
    `;

    photoPreview.appendChild(img);

  });

}

$("photos").addEventListener("change", () => {

  const id = $("itemId").value;

  const existing = items.find(item =>
    String(item.id) === String(id)
  );

  showPhotoPreview(imageList(existing));

});

// ==========================================
// 10. EDIT EXISTING LISTING
// ==========================================

adminItems.addEventListener("click", async event => {

  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");

  if (editButton) {

    const id = editButton.dataset.edit;

    const item = items.find(x =>
      String(x.id) === String(id)
    );

    if (!item) return;

    $("itemId").value = item.id;
    $("itemName").value = item.name || "";
    $("master").value = item.master || item.ajarn || "";
    $("category").value = item.category || "";
    $("description").value = item.description || "";

    $("priceMode").value = item.price_mode || "pm";

    $("price").value = item.price ?? "";

    $("status").value = item.status || "available";

    $("photos").value = "";

    $("formHeading").textContent = "Edit a piece";

    showPhotoPreview(imageList(item));

    msg(
      "editorMessage",
      "Editing: " + item.name
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    return;
  }

  if (deleteButton) {

    const id = deleteButton.dataset.delete;

    const item = items.find(x =>
      String(x.id) === String(id)
    );

    if (!item) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${item.name}"?`
    );

    if (!confirmed) return;

    msg("editorMessage", "Deleting listing...");

    const { error } = await db
      .from("amulets")
      .delete()
      .eq("id", id);

    if (error) {

      msg("editorMessage", error.message);

      return;

    }

    msg("editorMessage", "Listing deleted successfully.");

    if ($("itemId").value === String(id)) {
      clearForm();
    }

    await loadItems();

  }

});

// ==========================================
// 11. CLEAR FORM
// ==========================================

function clearForm() {

  amuletForm.reset();

  $("itemId").value = "";

  $("formHeading").textContent = "Add a piece";

  $("photos").value = "";

  photoPreview.innerHTML = "";

  msg("editorMessage", "");

}

$("clearForm").addEventListener("click", clearForm);

// ==========================================
// 12. UPLOAD PHOTOS TO SUPABASE
// ==========================================

async function uploadPhotos(files) {

  const uploadedUrls = [];
  const uploadedPaths = [];

  for (const file of files) {

    if (!file.type.startsWith("image/")) {
      throw new Error(
        `${file.name} is not a valid image file.`
      );
    }

    const extension =
      file.name.split(".").pop().replace(/[^a-zA-Z0-9]/g, "") ||
      "jpg";

    const path =
      `${crypto.randomUUID()}.${extension}`;

    const { error } = await db.storage
      .from("amulet-photos")
      .upload(path, file, {
        upsert: false,
        contentType: file.type
      });

    if (error) {
      throw error;
    }

    const { data } = db.storage
      .from("amulet-photos")
      .getPublicUrl(path);

    if (!data?.publicUrl) {
      throw new Error(
        "Unable to generate the public image URL."
      );
    }

    uploadedUrls.push(data.publicUrl);

    uploadedPaths.push(path);

  }

  return {
    uploadedUrls,
    uploadedPaths
  };

}

// ==========================================
// 13. SAVE OR UPDATE LISTING
// ==========================================

amuletForm.addEventListener("submit", async event => {

  event.preventDefault();

  if (!db) {
    msg("editorMessage", "Supabase is not connected.");
    return;
  }

  setSaving(true);

  msg("editorMessage", "Preparing your listing...");

  const uploadedPaths = [];

  try {

    const id = $("itemId").value;

    const oldItem = items.find(item =>
      String(item.id) === String(id)
    );

    // Preserve existing images.
    const existingImages = imageList(oldItem);

    // Upload newly selected photos.
    const files = Array.from($("photos").files);

    let newImages = [];

    if (files.length > 0) {

      msg(
        "editorMessage",
        `Uploading ${files.length} photo(s)...`
      );

      const result = await uploadPhotos(files);

      newImages = result.uploadedUrls;

      uploadedPaths.push(...result.uploadedPaths);

    }

    // Combine old and new photos.
    const allImages = [
      ...existingImages,
      ...newImages
    ];

    const priceMode = $("priceMode").value;

    const priceValue = $("price").value;

    const payload = {

      name: $("itemName").value.trim(),

      master: $("master").value.trim(),

      category: $("category").value.trim(),

      description: $("description").value.trim(),

      price_mode: priceMode,

      price: priceMode === "pm" || priceValue === ""
        ? null
        : Number(priceValue),

      status: $("status").value,

      images: allImages

    };

    if (!payload.name) {
      throw new Error("Please enter an amulet name.");
    }

    if (
      payload.price !== null &&
      (!Number.isFinite(payload.price) || payload.price < 0)
    ) {
      throw new Error("Please enter a valid price.");
    }

    msg(
      "editorMessage",
      "Saving listing to database..."
    );

    let result;

    if (id) {

      result = await db
        .from("amulets")
        .update(payload)
        .eq("id", id);

    } else {

      result = await db
        .from("amulets")
        .insert(payload);

    }

    if (result.error) {
      throw result.error;
    }

    msg(
      "editorMessage",
      "Successfully saved your amulet!"
    );

    clearForm();

    await loadItems();

  } catch (error) {

    console.error("Admin save error:", error);

    // Clean up newly uploaded images if database save fails.
    if (uploadedPaths.length > 0) {

      const { error: cleanupError } = await db.storage
        .from("amulet-photos")
        .remove(uploadedPaths);

      if (cleanupError) {
        console.error("Image cleanup error:", cleanupError);
      }

    }

    msg(
      "editorMessage",
      "Error: " + (error.message || "Unable to save listing.")
    );

  } finally {

    setSaving(false);

  }

});

// ==========================================
// 14. INITIAL PHOTO PREVIEW
// ==========================================

showPhotoPreview();

