/* CAEZAR admin dashboard.
   Cloud mode (config.js filled): Supabase login + database + image storage + orders.
   Preview mode (config.js empty): everything lives in localStorage ("czProducts"), no login.
   Reuses DEFAULT_PRODUCTS, normalize, PRODUCTS, $, $$ and toast from app.js, and sb/cloud from db.js. */
const KEY = "czProducts";
const LOW_STOCK = 5;
const MAX_IMAGES = 6;
let list = [];
let editingId = null;
let draftImages = [];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATUS_LABEL = { published: "Published", draft: "Draft", out_of_stock: "Out of stock" };
const egp = (n) => `${Number(n).toLocaleString("en-US")} EGP`;
const soldOut = (p) => p.status === "out_of_stock" || p.stock === 0;
const cover = (p) => (p.images && p.images[0]) || p.img || FALLBACK_IMG;
const F = (id) => $("#" + id);
const csv = (s) => s.split(/[,،]/).map((x) => x.trim()).filter(Boolean);
const slugify = (s) => (s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product") + "-" + Math.random().toString(36).slice(2, 6);
const failMsg = (e) => (e && e.message) || "Something went wrong";

/* ---------- data access (local preview or Supabase) ---------- */
function persistLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
  catch { toast("Could not save: browser storage is full. Remove or shrink some images."); return false; }
}
const nextLocalId = () => Math.max(0, ...list.map((p) => p.id)) + 1;

let localLoaded = false;
async function loadList() {
  if (cloud) { list = await fetchProducts(); return; }
  if (!localLoaded) { list = PRODUCTS.map((p) => ({ ...p })); localLoaded = true; } // afterwards `list` is the source of truth
}

async function dataUrlToBlob(u) { return (await fetch(u)).blob(); }

async function saveProduct(prod, old) {
  if (!cloud) {
    const prev = [...list];
    if (old) list = list.map((p) => (p.id === old.id ? { ...prod, id: old.id } : p));
    else list.push({ ...prod, id: nextLocalId() });
    if (!persistLocal()) { list = prev; throw new Error("storage"); }
    return;
  }
  const row = productToRow(prod);
  let id = old ? old.id : null;
  if (old) {
    const { error } = await sb.from("products").update(row).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await sb.from("products").insert(row).select("id").single();
    if (error) throw error;
    id = data.id;
  }
  // images: upload new ones, keep existing paths, rewrite the rows in order
  const keep = [];
  for (const [i, u] of prod.images.entries()) {
    if (u.startsWith("data:")) {
      const path = `${id}/${Date.now()}-${i}.jpg`;
      const { error } = await sb.storage.from(BUCKET).upload(path, await dataUrlToBlob(u), { contentType: "image/jpeg" });
      if (error) throw error;
      keep.push(path);
    } else { const p = imagePath(u); if (p) keep.push(p); }
  }
  const { data: oldRows } = await sb.from("product_images").select("path").eq("product_id", id);
  await sb.from("product_images").delete().eq("product_id", id);
  if (keep.length) {
    const { error } = await sb.from("product_images").insert(keep.map((path, position) => ({ product_id: id, path, position })));
    if (error) throw error;
  }
  const stale = (oldRows || []).map((r) => r.path).filter((p) => !keep.includes(p));
  if (stale.length) await sb.storage.from(BUCKET).remove(stale);
}

async function deleteProduct(p) {
  if (!cloud) { list = list.filter((x) => x.id !== p.id); persistLocal(); return; }
  const { data: imgs } = await sb.from("product_images").select("path").eq("product_id", p.id);
  const { error } = await sb.from("products").delete().eq("id", p.id);
  if (error) throw new Error(/foreign key|violates/i.test(error.message) ? "This product has orders and cannot be deleted. Set it to Draft instead." : error.message);
  if (imgs && imgs.length) await sb.storage.from(BUCKET).remove(imgs.map((r) => r.path));
}

async function changeStock(p, delta) {
  if (!cloud) { p.stock = Math.max(0, p.stock + delta); persistLocal(); return; }
  const { error } = await sb.rpc("adjust_stock", { p_product: p.id, p_delta: delta, p_reason: "adjustment" });
  if (error) throw error;
}

/* ---------- dashboard ---------- */
function renderStats() {
  const tracked = list.filter((p) => p.stock !== null);
  const low = list.filter((p) => p.stock !== null && p.stock > 0 && p.stock <= LOW_STOCK).length;
  const value = tracked.reduce((s, p) => s + p.price * p.stock, 0);
  const cards = [
    ["Products", list.length, ""],
    ["Published", list.filter((p) => p.status === "published").length, ""],
    ["Drafts", list.filter((p) => p.status === "draft").length, ""],
    ["Low stock", low, low ? "warn" : ""],
    ["Out of stock", list.filter(soldOut).length, list.some(soldOut) ? "warn" : ""],
    ["Stock value", egp(value), ""],
  ];
  $("#stats").innerHTML = cards.map(([l, v, c]) => `<div class="stat ${c}"><span>${l}</span><b>${v}</b></div>`).join("");
}

function renderRows() {
  const q = $("#q").value.trim().toLowerCase(), fs = $("#fs").value;
  const rows = list.filter((p) => (!fs || p.status === fs) && (!q || [p.name.en, p.name.ar, p.scent].join(" ").toLowerCase().includes(q)));
  $("#none").hidden = rows.length > 0;
  $("#rows").innerHTML = rows.map((p) => {
    const stock = p.stock === null
      ? `<span class="muted">Not tracked</span>`
      : `<span class="stk"><button type="button" data-stk="-1" data-id="${p.id}" aria-label="Decrease stock of ${esc(p.name.en)}">−</button><output class="${p.stock <= LOW_STOCK ? "low" : ""}">${p.stock}</output><button type="button" data-stk="1" data-id="${p.id}" aria-label="Increase stock of ${esc(p.name.en)}">+</button></span>`;
    return `<tr>
      <td><div class="pcell"><img src="${esc(cover(p))}" alt="" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'"><div><b>${esc(p.name.en)}</b><small>${esc(p.name.ar)}</small></div></div></td>
      <td>${esc(p.scent) || '<span class="muted">—</span>'}</td>
      <td>${esc(p.size.en)}</td>
      <td>${egp(p.price)}</td>
      <td>${stock}</td>
      <td><span class="pill ${p.status}">${STATUS_LABEL[p.status]}</span></td>
      <td><div class="acts"><button type="button" data-act="edit" data-id="${p.id}">Edit</button><button type="button" data-act="dup" data-id="${p.id}">Copy</button><button type="button" class="del" data-act="del" data-id="${p.id}">Delete</button></div></td></tr>`;
  }).join("");
}
const render = () => { renderStats(); renderRows(); };
async function refresh() { try { await loadList(); } catch (e) { toast(failMsg(e)); } render(); }

$("#rows").addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const p = list.find((x) => x.id === +b.dataset.id); if (!p) return;
  try {
    if (b.dataset.stk) { await changeStock(p, +b.dataset.stk); await refresh(); }
    else if (b.dataset.act === "edit") openEditor(p);
    else if (b.dataset.act === "dup") {
      const copy = { ...p, name: { en: p.name.en + " (copy)", ar: p.name.ar }, status: "draft", slug: slugify(p.name.en), images: cloud ? [] : [...p.images], sizeLabel: p.sizeLabel || (/^\d+ ml$/.test(p.size.en) ? null : p.size.en) };
      await saveProduct(copy, null); await refresh(); toast("Duplicated as draft" + (cloud ? " (images not copied)" : ""));
    } else if (b.dataset.act === "del" && confirm(`Delete "${p.name.en}"? This cannot be undone.`)) {
      await deleteProduct(p); await refresh(); toast("Product deleted");
    }
  } catch (err) { toast(failMsg(err)); }
});
$("#q").oninput = $("#fs").onchange = renderRows;

/* ---------- editor ---------- */
function openEditor(p) {
  editingId = p ? p.id : null;
  $("#edT").textContent = p ? "Edit product" : "Add product";
  const sizeMatch = p && /^(\d+) ml$/.exec(p.size.en);
  F("nameEn").value = p ? p.name.en : ""; F("nameAr").value = p ? p.name.ar : "";
  F("scent").value = p ? p.scent : ""; F("status").value = p ? p.status : "draft";
  F("descEn").value = p ? p.desc.en : ""; F("descAr").value = p ? p.desc.ar : "";
  F("volume").value = p ? (p.volume ?? (sizeMatch ? sizeMatch[1] : "")) : "";
  F("sizeLabel").value = p && !sizeMatch && p.size.en !== "—" ? p.size.en : "";
  F("price").value = p ? p.price : ""; F("stock").value = p && p.stock !== null ? p.stock : "";
  for (const k of ["top", "heart", "base"]) {
    F(k + "En").value = p ? p.notes[k].en.join(", ") : ""; F(k + "Ar").value = p ? p.notes[k].ar.join("، ") : "";
  }
  draftImages = p ? p.images.filter((u) => u && !(cloud && !imagePath(u))) : []; // hide the placeholder photo in cloud mode
  renderGallery(); clearErrors();
  $("#editor").classList.add("open"); $("#editor").setAttribute("aria-hidden", "false"); $("#ov").classList.add("open");
  document.body.style.overflow = "hidden";
  setTimeout(() => F("nameEn").focus(), 350);
}
function closeEditor() {
  $("#editor").classList.remove("open"); $("#editor").setAttribute("aria-hidden", "true"); $("#ov").classList.remove("open");
  document.body.style.overflow = "";
}
$("#newBtn").onclick = () => openEditor(null);
$("#closeBtn").onclick = $("#cancelBtn").onclick = $("#ov").onclick = closeEditor;
addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#editor").classList.contains("open")) closeEditor(); });
function clearErrors() { $("#err").hidden = true; $$("#form .in").forEach((i) => i.removeAttribute("aria-invalid")); }

$("#form").addEventListener("submit", async (e) => {
  e.preventDefault(); clearErrors();
  const problems = [];
  const bad = (id, msg) => { F(id).setAttribute("aria-invalid", "true"); problems.push(msg); };
  const name = F("nameEn").value.trim(), price = Number(F("price").value);
  const stockRaw = F("stock").value.trim(), stock = stockRaw === "" ? null : Number(stockRaw);
  if (!name) bad("nameEn", "English name is required.");
  if (F("price").value === "" || !(price >= 0)) bad("price", "Enter a valid price (0 or more).");
  if (stock !== null && !(Number.isInteger(stock) && stock >= 0)) bad("stock", "Stock must be a whole number, or blank if not tracked.");
  const vol = F("volume").value.trim() ? Number(F("volume").value) : null, label = F("sizeLabel").value.trim();
  if (vol !== null && !(vol > 0)) bad("volume", "Volume must be above 0.");
  if (problems.length) { const el = $("#err"); el.textContent = problems.join(" "); el.hidden = false; $("[aria-invalid]")?.focus(); return; }

  const old = list.find((p) => p.id === editingId);
  const size = label ? { en: label, ar: label.replace(/ml/gi, "مل") } : vol ? { en: `${vol} ml`, ar: `${vol} مل` } : { en: "—", ar: "—" };
  const notes = {};
  for (const k of ["top", "heart", "base"]) notes[k] = { en: csv(F(k + "En").value), ar: csv(F(k + "Ar").value) };
  const prod = {
    ...(old || {}),
    slug: old ? old.slug : slugify(name),
    name: { en: name, ar: F("nameAr").value.trim() || name },
    desc: { en: F("descEn").value.trim(), ar: F("descAr").value.trim() || F("descEn").value.trim() },
    scent: F("scent").value.trim(), status: F("status").value,
    price, stock, volume: vol, size, sizeLabel: label || null, notes,
    badge: old ? old.badge : { en: "New", ar: "جديد" },
    images: [...draftImages],
    img: draftImages[0] && !draftImages[0].startsWith("data:") ? draftImages[0] : (old && old.img) || FALLBACK_IMG,
  };
  const submit = $("#form button[type=submit]"); submit.disabled = true; submit.textContent = "Saving…";
  try {
    await saveProduct(prod, old);
    closeEditor(); await refresh(); toast(old ? "Product updated" : "Product added");
  } catch (err) {
    if (err.message !== "storage") { const el = $("#err"); el.textContent = failMsg(err); el.hidden = false; }
  } finally { submit.disabled = false; submit.textContent = "Save product"; }
});

/* ---------- images ---------- */
function shrink(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const r = Math.min(1, 900 / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(file.name)); };
    img.src = url;
  });
}
async function addFiles(files) {
  const imgs = [...files].filter((f) => f.type.startsWith("image/"));
  const room = MAX_IMAGES - draftImages.length;
  if (imgs.length > room) toast(`Up to ${MAX_IMAGES} images per product`);
  for (const f of imgs.slice(0, Math.max(0, room))) {
    try { draftImages.push(await shrink(f)); } catch (e) { toast(`Could not read ${e.message}`); }
  }
  renderGallery();
}
function renderGallery() {
  $("#gal").innerHTML = draftImages.map((u, i) => `<figure><img src="${esc(u)}" alt="Image ${i + 1}">${i === 0 ? '<span class="cover">COVER</span>' : ""}
    <div class="gb">${i > 0 ? `<button type="button" data-g="cover" data-i="${i}">Cover</button>` : ""}<button type="button" data-g="rm" data-i="${i}">Remove</button></div></figure>`).join("");
}
$("#gal").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return; const i = +b.dataset.i;
  if (b.dataset.g === "rm") draftImages.splice(i, 1);
  else draftImages.unshift(...draftImages.splice(i, 1));
  renderGallery();
});
const drop = $("#drop");
drop.onclick = () => F("files").click();
drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); F("files").click(); } };
F("files").onchange = (e) => { addFiles(e.target.files); e.target.value = ""; };
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

/* ---------- export / import / reset (preview mode; export works in both) ---------- */
$("#exportBtn").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(list, null, 2)], { type: "application/json" }));
  a.download = "caezar-products.json"; a.click(); URL.revokeObjectURL(a.href);
};
F("importFile").onchange = async (e) => {
  const file = e.target.files[0]; e.target.value = ""; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data) || data.some((p) => !p || !p.name || typeof p.price !== "number" || !p.size || !p.notes)) throw new Error("bad shape");
    if (!confirm(`Replace all ${list.length} products with ${data.length} from this file?`)) return;
    const prev = list; list = data.map(normalize);
    if (!persistLocal()) { list = prev; return; }
    render(); toast("Products imported");
  } catch { toast("That file is not a valid products export"); }
};
$("#resetBtn").onclick = () => {
  if (!confirm("Reset all products to the original 5? Your edits will be lost.")) return;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  list = DEFAULT_PRODUCTS.map(normalize); render(); toast("Reset to defaults");
};

/* ---------- orders (cloud mode) ---------- */
const ORDER_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
async function loadOrders() {
  const { data, error } = await sb.from("orders").select("*, governorates(name_en), order_items(qty, unit_price_egp, products(name_en))").order("created_at", { ascending: false }).limit(100);
  if (error) return toast(failMsg(error));
  $("#orderRows").innerHTML = data.map((o) => `<tr>
    <td>#${o.id}<br><small class="muted">${esc(new Date(o.created_at).toLocaleString())}</small></td>
    <td>${esc(o.customer_name)}<br><small class="muted">${esc(o.phone)}</small></td>
    <td>${esc(o.address)}${o.governorates ? `<br><small class="muted">${esc(o.governorates.name_en)}</small>` : ""}</td>
    <td>${o.order_items.map((i) => `${i.qty} × ${esc(i.products ? i.products.name_en : "?")}`).join("<br>")}</td>
    <td>${egp(o.total_egp)}${Number(o.shipping_egp) ? `<br><small class="muted">incl. ${egp(o.shipping_egp)} shipping</small>` : ""}</td>
    <td><select class="in" data-order="${o.id}" data-was="${o.status}" aria-label="Status of order ${o.id}">${ORDER_STATUSES.map((s) => `<option value="${s}"${s === o.status ? " selected" : ""}>${s}</option>`).join("")}</select></td></tr>`).join("");
  $("#noOrders").hidden = data.length > 0;
}
$("#orderRows").addEventListener("change", async (e) => {
  const sel = e.target.closest("select[data-order]"); if (!sel) return;
  const id = +sel.dataset.order;
  const { error } = await sb.from("orders").update({ status: sel.value }).eq("id", id);
  if (error) { sel.value = sel.dataset.was; return toast(failMsg(error)); }
  if (sel.value === "cancelled") {
    const r = await sb.rpc("restock_cancelled_order", { p_order: id });
    if (r.error) toast(failMsg(r.error)); else { toast("Order cancelled, stock restored"); await refresh(); }
  } else toast("Order updated");
  sel.dataset.was = sel.value;
});

/* ---------- shipping rates ---------- */
let ship = [];
const shipDirty = new Set();
const zoneLabel = (z) => ZONES[z].en;
Object.entries(ZONES).forEach(([k, v]) => $("#bZone").insertAdjacentHTML("beforeend", `<option value="${k}">${v.en}</option>`));

async function loadShip() {
  try { ship = cloud ? await fetchShipping() : loadLocalShipping(); } catch (e) { ship = defaultShipping(); toast(failMsg(e)); }
  shipDirty.clear(); renderShip();
}
function shipState() {
  const n = shipDirty.size;
  $("#shipSave").disabled = n === 0;
  $("#shipState").textContent = n ? `${n} unsaved change${n > 1 ? "s" : ""}` : "All changes saved";
}
function renderShip() {
  $("#shipRows").innerHTML = ship.map((g) => `<tr data-id="${g.id}" class="${shipDirty.has(g.id) ? "dirty" : ""}">
    <td><b>${esc(g.en)}</b><br><small dir="rtl" class="muted">${esc(g.ar)}</small></td>
    <td>${zoneLabel(g.zone)}</td>
    <td><input class="in fee" type="number" min="0" step="1" inputmode="numeric" data-f="fee" value="${g.fee}" aria-label="Shipping fee for ${esc(g.en)} in EGP"></td>
    <td><div class="win"><input class="in" data-f="winEn" value="${esc(g.winEn)}" placeholder="1–2 Days" aria-label="Delivery window for ${esc(g.en)} in English"><input class="in" dir="rtl" data-f="winAr" value="${esc(g.winAr)}" placeholder="١–٢ يوم" aria-label="مدة التوصيل إلى ${esc(g.ar)}"></div></td>
    <td><label class="switch"><input type="checkbox" role="switch" data-f="active" ${g.active ? "checked" : ""} aria-label="Active: ${esc(g.en)}"><span></span></label></td></tr>`).join("");
  shipState();
}
$("#shipRows").addEventListener("input", (e) => {
  const el = e.target.closest("[data-f]"); if (!el) return;
  const tr = el.closest("tr"), g = ship.find((x) => x.id === +tr.dataset.id), f = el.dataset.f;
  g[f] = f === "active" ? el.checked : f === "fee" ? (el.value === "" ? 0 : Number(el.value)) : el.value;
  shipDirty.add(g.id); tr.classList.add("dirty"); shipState();
});
$("#bApply").onclick = () => {
  const zone = $("#bZone").value, feeRaw = $("#bFee").value.trim(), we = $("#bWinEn").value.trim(), wa = $("#bWinAr").value.trim(), act = $("#bActive").value;
  if (feeRaw !== "" && !(Number(feeRaw) >= 0)) return toast("Fee must be 0 or more");
  if (feeRaw === "" && !we && !wa && act === "") return toast("Enter a fee, a window or a status to apply");
  const targets = ship.filter((g) => !zone || g.zone === zone);
  targets.forEach((g) => {
    if (feeRaw !== "") g.fee = Number(feeRaw);
    if (we) g.winEn = we;
    if (wa) g.winAr = wa;
    if (act !== "") g.active = act === "1";
    shipDirty.add(g.id);
  });
  renderShip(); toast(`Applied to ${targets.length} governorates. Click Save changes to keep them.`);
};
$("#shipSave").onclick = async () => {
  const rows = ship.filter((g) => shipDirty.has(g.id));
  if (rows.some((g) => !(g.fee >= 0))) return toast("Every fee must be 0 or more");
  const freeActive = ship.filter((g) => g.active && g.fee === 0).length;
  if (freeActive && !confirm(`${freeActive} active governorate${freeActive > 1 ? "s have" : " has"} a 0 EGP fee, so shipping will be free there. Save anyway?`)) return;
  const btn = $("#shipSave"); btn.disabled = true; btn.textContent = "Saving…";
  try {
    if (cloud) {
      const { error } = await sb.from("governorates").upsert(rows.map((g) => ({ id: g.id, name_en: g.en, name_ar: g.ar, zone: g.zone, shipping_fee_egp: g.fee, delivery_window_en: g.winEn || null, delivery_window_ar: g.winAr || null, is_active: g.active, sort_order: g.id })));
      if (error) throw error;
    } else {
      localStorage.setItem("czShipping", JSON.stringify(ship));
    }
    shipDirty.clear(); renderShip(); toast(`Shipping rates saved (${rows.length} updated)`);
  } catch (e) { toast(failMsg(e)); }
  finally { btn.textContent = "Save changes"; shipState(); }
};

/* ---------- login gate (cloud mode) ---------- */
function showLogin(msg) {
  let el = $("#login");
  if (!el) {
    el = document.createElement("div"); el.id = "login"; el.className = "login";
    el.innerHTML = `<form id="loginForm"><h1>CAEZAR Admin</h1>
      <label>Email<input class="in" id="lEmail" type="email" autocomplete="username" required></label>
      <label>Password<input class="in" id="lPass" type="password" autocomplete="current-password" required></label>
      <p class="err" id="lErr" role="alert" hidden></p>
      <button class="btn btn-gold" type="submit">Sign in</button></form>`;
    document.body.appendChild(el);
    $("#loginForm").onsubmit = async (e) => {
      e.preventDefault();
      const { error } = await sb.auth.signInWithPassword({ email: $("#lEmail").value.trim(), password: $("#lPass").value });
      if (error) return showLogin("Wrong email or password.");
      start();
    };
  }
  const err = $("#lErr"); err.hidden = !msg; err.textContent = msg || "";
}
async function isAdmin() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data } = await sb.from("profiles").select("role").eq("id", user.id).single();
  return !!data && data.role === "admin";
}

async function start() {
  if (cloud) {
    if (!(await isAdmin())) {
      const { data: { session } } = await sb.auth.getSession();
      if (session) { await sb.auth.signOut(); return showLogin("This account does not have admin access."); }
      return showLogin();
    }
    $("#login")?.remove();
    $("#ordersSec").hidden = false; $("#signOut").hidden = false;
    $("#importFile").previousElementSibling.hidden = true; $("#resetBtn").hidden = true; // preview-only tools
    $("#modeNote").innerHTML = "<b>Live mode.</b> Connected to Supabase. Changes are saved to the shared database.";
    loadOrders();
  }
  await refresh();
  await loadShip();
}
$("#signOut").onclick = async () => { await sb.auth.signOut(); location.reload(); };
start();
