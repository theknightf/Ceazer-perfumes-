/* Supabase data layer. If config.js is empty, `cloud` is false and the site keeps using
   the local preview mode (localStorage) so nothing breaks before the backend exists. */
const CFG = window.CAEZAR_CONFIG || {};
const cloud = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
const sb = cloud ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;
const BUCKET = "product-images";

const imageUrl = (path) => sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
const imagePath = (url) => { const i = url.indexOf(`/${BUCKET}/`); return i < 0 ? null : decodeURIComponent(url.slice(i + BUCKET.length + 2).split("?")[0]); };

function rowToProduct(r) {
  const imgs = (r.product_images || []).slice().sort((a, b) => a.position - b.position).map((i) => imageUrl(i.path));
  const label = r.size_label;
  const size = label ? { en: label, ar: label.replace(/ml/gi, "مل") } : r.volume_ml ? { en: `${r.volume_ml} ml`, ar: `${r.volume_ml} مل` } : { en: "—", ar: "—" };
  return {
    id: r.id, slug: r.slug, price: Number(r.price_egp), stock: r.stock, status: r.status, scent: r.scent_type || "",
    volume: r.volume_ml, size,
    name: { en: r.name_en, ar: r.name_ar || r.name_en },
    desc: { en: r.description_en || "", ar: r.description_ar || r.description_en || "" },
    badge: { en: r.badge_en || "New", ar: r.badge_ar || "جديد" },
    notes: r.notes,
    images: imgs.length ? imgs : ["images/hero.webp"], img: imgs[0] || "images/hero.webp",
  };
}
function productToRow(p) {
  return {
    slug: p.slug, name_en: p.name.en, name_ar: p.name.ar, description_en: p.desc.en, description_ar: p.desc.ar,
    scent_type: p.scent || null, volume_ml: p.volume, size_label: p.sizeLabel || null, price_egp: p.price,
    stock: p.stock, status: p.status, badge_en: p.badge.en, badge_ar: p.badge.ar, notes: p.notes,
  };
}
async function fetchProducts() {
  const { data, error } = await sb.from("products").select("*, product_images(path, position)").order("id");
  if (error) throw error;
  return data.map(rowToProduct);
}

/* ---------- shipping: the 27 governorates (same ids and order as the `governorates` table) ---------- */
const ZONES = {
  greater_cairo: { en: "Greater Cairo", ar: "القاهرة الكبرى" },
  alexandria: { en: "Alexandria", ar: "الإسكندرية" },
  delta: { en: "Delta", ar: "الدلتا" },
  canal: { en: "Canal", ar: "القناة" },
  upper_egypt: { en: "Upper Egypt", ar: "الصعيد" },
  frontier: { en: "Frontier & Red Sea", ar: "المحافظات الحدودية والبحر الأحمر" },
};
const GOVERNORATES = [
  [1, "Cairo", "القاهرة", "greater_cairo"], [2, "Giza", "الجيزة", "greater_cairo"], [3, "Alexandria", "الإسكندرية", "alexandria"],
  [4, "Qalyubia", "القليوبية", "greater_cairo"], [5, "Sharqia", "الشرقية", "delta"], [6, "Dakahlia", "الدقهلية", "delta"],
  [7, "Gharbia", "الغربية", "delta"], [8, "Menofia", "المنوفية", "delta"], [9, "Damietta", "دمياط", "delta"],
  [10, "Port Said", "بورسعيد", "canal"], [11, "Ismailia", "الإسماعيلية", "canal"], [12, "Suez", "السويس", "canal"],
  [13, "Beheira", "البحيرة", "delta"], [14, "Kafr El Sheikh", "كفر الشيخ", "delta"], [15, "Matrouh", "مطروح", "frontier"],
  [16, "North Sinai", "شمال سيناء", "frontier"], [17, "South Sinai", "جنوب سيناء", "frontier"], [18, "Faiyum", "الفيوم", "upper_egypt"],
  [19, "Beni Suef", "بني سويف", "upper_egypt"], [20, "Minya", "المنيا", "upper_egypt"], [21, "Asyut", "أسيوط", "upper_egypt"],
  [22, "Sohag", "سوهاج", "upper_egypt"], [23, "Qena", "قنا", "upper_egypt"], [24, "Luxor", "الأقصر", "upper_egypt"],
  [25, "Aswan", "أسوان", "upper_egypt"], [26, "Red Sea", "البحر الأحمر", "frontier"], [27, "New Valley", "الوادي الجديد", "frontier"],
].map(([id, en, ar, zone]) => ({ id, en, ar, zone }));

// Fees and delivery windows are never pre-filled: every governorate starts inactive at 0 EGP.
const defaultShipping = () => GOVERNORATES.map((g) => ({ ...g, fee: 0, winEn: "", winAr: "", active: false }));

async function fetchShipping() {
  const { data, error } = await sb.from("governorates").select("*").order("sort_order");
  if (error) throw error;
  return data.map((r) => ({ id: r.id, en: r.name_en, ar: r.name_ar, zone: r.zone, fee: Number(r.shipping_fee_egp), winEn: r.delivery_window_en || "", winAr: r.delivery_window_ar || "", active: r.is_active }));
}
function loadLocalShipping() {
  try {
    const saved = JSON.parse(localStorage.getItem("czShipping") || "null");
    if (Array.isArray(saved)) return defaultShipping().map((d) => ({ ...d, ...(saved.find((s) => s.id === d.id) || {}) }));
  } catch { /* use defaults */ }
  return defaultShipping();
}
