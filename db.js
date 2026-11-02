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
