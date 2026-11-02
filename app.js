/* CAEZAR PERFUMES: shared data, i18n, cart, and page logic */
const PHONE = "201108077464";
const FALLBACK_IMG = "images/hero.webp";

const DEFAULT_PRODUCTS = [
  { id: 1, price: 250, img: "images/p1.png",
    name: { ar: "عطر Caezar Red", en: "Caezar Red" },
    size: { ar: "50 مل", en: "50 ml" },
    badge: { ar: "عطر رجالي", en: "Signature" },
    desc: { ar: "زجاجة حمراء فاخرة بتركيز عطري فواح وثبات قوي يناسب جميع الأوقات.", en: "A garnet-red flacon with a rich, long-lasting extrait concentration for every occasion." },
    notes: { top: { ar: ["برغموت", "فلفل وردي"], en: ["Bergamot", "Pink pepper"] }, heart: { ar: ["لافندر", "ورد"], en: ["Lavender", "Rose"] }, base: { ar: ["عنبر", "خشب الصندل"], en: ["Amber", "Sandalwood"] } } },
  { id: 2, price: 450, img: "images/p2.png",
    name: { ar: "عطر Caezar Black", en: "Caezar Black" },
    size: { ar: "100 مل", en: "100 ml" },
    badge: { ar: "حجم كبير", en: "Grand 100 ml" },
    desc: { ar: "زجاجة سوداء بنقش محفور ورائحة عميقة تعكس الجاذبية والقوة.", en: "A black engraved flacon with a deep, magnetic scent that commands the room." },
    notes: { top: { ar: ["ليمون", "هيل"], en: ["Lemon", "Cardamom"] }, heart: { ar: ["عود", "جلد"], en: ["Oud", "Leather"] }, base: { ar: ["مسك", "باتشولي"], en: ["Musk", "Patchouli"] } } },
  { id: 3, price: 650, img: "images/p3.png",
    name: { ar: "مجموعة الهدايا الثلاثية", en: "Trio Gift Set" },
    size: { ar: "3 زجاجات × 50 مل", en: "3 × 50 ml" },
    badge: { ar: "عرض هدايا", en: "Gift set" },
    desc: { ar: "علبة سوداء تحتوي على 3 عطور رجالية مختلفة حجم 50 مل لإهداء استثنائي.", en: "A black gift box holding three distinct 50 ml men's fragrances, made for gifting." },
    notes: { top: { ar: ["حمضيات", "نعناع"], en: ["Citrus", "Mint"] }, heart: { ar: ["توابل", "أخشاب"], en: ["Spices", "Woods"] }, base: { ar: ["عنبر", "فانيليا"], en: ["Amber", "Vanilla"] } } },
  { id: 4, price: 1100, img: "images/p4.png",
    name: { ar: "المجموعة الثلاثية الكبرى", en: "Grand Trio Collection" },
    size: { ar: "3 زجاجات × 100 مل", en: "3 × 100 ml" },
    badge: { ar: "توفير", en: "Best value" },
    desc: { ar: "عرض التوفير الملكي: 3 زجاجات فاخرة بحجم 100 مل وتنوع عطري ساحر.", en: "The royal saving: three 100 ml flacons with a captivating range of scents." },
    notes: { top: { ar: ["برتقال", "زنجبيل"], en: ["Orange", "Ginger"] }, heart: { ar: ["ياسمين", "عود"], en: ["Jasmine", "Oud"] }, base: { ar: ["مسك", "خشب الأرز"], en: ["Musk", "Cedar"] } } },
  { id: 5, price: 1000, img: "images/p5.png",
    name: { ar: "المجموعة الملكية", en: "Royal Collection" },
    size: { ar: "5 زجاجات × 50 مل", en: "5 × 50 ml" },
    badge: { ar: "5 زجاجات", en: "Set of five" },
    desc: { ar: "مجموعة متكاملة من 5 زجاجات بحجم 50 مل بتشكيلة روائح تناسب كل المناسبات.", en: "Five 50 ml bottles with a scent for every occasion, in one collection." },
    notes: { top: { ar: ["تفاح", "بهارات"], en: ["Apple", "Spices"] }, heart: { ar: ["زعفران", "ورد"], en: ["Saffron", "Rose"] }, base: { ar: ["عنبر", "جلد"], en: ["Amber", "Leather"] } } },
];

/* Products come from the admin dashboard (localStorage) when present, else the defaults above.
   stock: null = not tracked. status: published | draft | out_of_stock. */
function normalize(p) {
  return { scent: "", stock: null, status: "published", ...p, images: p.images && p.images.length ? p.images : [p.img] };
}
function loadProducts() {
  try { const raw = localStorage.getItem("czProducts"); if (raw) return JSON.parse(raw).map(normalize); } catch { /* fall through */ }
  return DEFAULT_PRODUCTS.map(normalize);
}
const PRODUCTS = cloud ? [] : loadProducts(); // cloud mode fills this from Supabase after load
let productsReady = !cloud;
const isSoldOut = (p) => p.status === "out_of_stock" || p.stock === 0;
const live = () => PRODUCTS.filter((p) => p.status !== "draft");

const T = {
  ar: {
    nav_collection: "التشكيلة", nav_notes: "هرم العطر", nav_finder: "اختر عطرك", nav_story: "قصتنا",
    hero_sub: "PERFUMES", hero_tag: "القــوة في كــل قطــرة", hero_copy: "عطور فاخرة بأعلى تركيز من الزيوت العطرية، ثبات يدوم وفوحان يفرض حضورك.",
    cta_explore: "اكتشف التشكيلة", cta_wa: "اطلب عبر واتساب",
    marquee: ["Extrait de Parfum", "50 مل", "100 مل", "مجموعات الهدايا", "القوة في كل قطرة"],
    col_eyebrow: "التشكيلة", col_title: "اخـتر عطـرك أو مجمـوعتك", col_lead: "من الزجاجة الواحدة إلى المجموعات الملكية، كل عطر بتوقيع CAEZAR.",
    add: "أضف للسلة", view: "التفاصيل", order_wa: "اطلب واتساب", currency: "ج.م", egp: "جنيه",
    notes_eyebrow: "هرم العطر", notes_title: "طبـقات الرائـحة", notes_lead: "اختر العطر ثم المس كل طبقة لتعرف مكوناتها.",
    top: "القمة", heart: "القلب", base: "القاعدة",
    top_hint: "أول انطباع، يظهر في الدقائق الأولى.", heart_hint: "شخصية العطر، تظهر بعد دقائق وتستمر ساعات.", base_hint: "الأثر الأخير، يبقى على الجلد لساعات طويلة.",
    sample: "مكونات تجريبية: سيتم استبدالها بالمكونات الفعلية",
    quiz_eyebrow: "اختر عطرك", quiz_title: "ما العطر المناسب لك؟", quiz_lead: "أربعة أسئلة سريعة وسنرشح لك العطر الأنسب.",
    quiz_start: "ابدأ الاختبار", quiz_again: "أعد الاختبار", quiz_result: "ترشيحنا لك",
    story_eyebrow: "قصتنا", story_title: "القــوة في كــل قطــرة",
    story_p1: "CAEZAR علامة عطور رجالية مستوحاة من الهيبة والأناقة. كل زجاجة مصممة لتبقى في الذاكرة.",
    story_p2: "نختار الزيوت العطرية بعناية ونقدمها في تغليف يليق بالإهداء.",
    st1: "تركيز Extrait", st2: "أحجام", st3: "توصيل للباب",
    gifts_title: "مجموعات الهدايا", gifts_lead: "علب سوداء فاخرة، جاهزة للإهداء.", gifts_cta: "شاهد المجموعات",
    contact_title: "حابب تطلب أو تستفسر؟", contact_lead: "فريق CAEZAR يرد عليك ويؤكد الطلب ويوصله لحد باب البيت.", contact_cta: "تحدث معنا: 01108077464",
    rights: "جميع الحقوق محفوظة © 2026",
    cart: "سلة الطلبات", total: "إجمالي الطلب", empty: "السلة فارغة حالياً", checkout: "إرسال الطلب عبر واتساب",
    added: "تمت الإضافة إلى السلة", cart_empty_toast: "أضف عطراً إلى السلة أولاً",
    home: "الرئيسية", qty: "الكمية", also: "قد يعجبك أيضاً", notfound: "المنتج غير موجود",
    perk1: "توصيل لجميع المحافظات", perk2: "تغليف فاخر جاهز للإهداء", perk3: "تأكيد الطلب عبر واتساب",
    lang_btn: "EN", co_name: "الاسم", co_phone: "رقم الهاتف", co_addr: "العنوان بالتفصيل", order_no: "رقم الطلب", co_invalid: "من فضلك أدخل الاسم ورقم الهاتف والعنوان", co_fail: "تعذر إتمام الطلب، حاول مرة أخرى", soldout: "نفد المخزون", soldout_toast: "هذا المنتج غير متوفر حالياً",
    wa_hello: "مرحباً CAEZAR PERFUMES 👋\nأود طلب المنتجات التالية:\n\n", wa_count: "العدد", wa_price: "السعر", wa_total: "إجمالي الطلب", wa_footer: "يرجى تأكيد الطلب وتحديد عنوان التسليم.",
    wa_single: (n, s, p) => `السلام عليكم، أريد طلب ${n} (${s}) بسعر ${p} جنيه.`,
    wa_quiz: (n) => `السلام عليكم، رشح لي الاختبار عطر ${n} وأريد الاستفسار عنه.`,
    quiz: [
      { q: "متى ستستخدم العطر غالباً؟", o: [["للعمل والنهار", { 1: 2, 2: 0 }], ["للسهرات والمناسبات", { 2: 2, 1: 1 }], ["للاستخدام اليومي", { 1: 2 }], ["للإهداء", { 3: 2, 5: 1 }]] },
      { q: "ما الفصل المفضل لديك؟", o: [["الصيف", { 1: 2 }], ["الشتاء", { 2: 2 }], ["الخريف والربيع", { 1: 1, 2: 1 }], ["كل الفصول", { 4: 1, 5: 1, 3: 1 }]] },
      { q: "ما قوة الفوحان التي تفضلها؟", o: [["هادئة وراقية", { 1: 2 }], ["متوسطة", { 1: 1, 2: 1 }], ["قوية وجريئة", { 2: 2 }], ["أريد أكثر من عطر", { 4: 2, 5: 2, 3: 1 }]] },
      { q: "لمن العطر؟", o: [["لي", { 1: 1, 2: 1 }], ["هدية لشخص عزيز", { 3: 3 }], ["لي ولعائلتي", { 4: 3 }], ["تشكيلة متنوعة", { 5: 3 }]] },
    ],
  },
  en: {
    nav_collection: "Collection", nav_notes: "Notes", nav_finder: "Scent finder", nav_story: "Story",
    hero_sub: "PERFUMES", hero_tag: "Power in every drop", hero_copy: "Luxury fragrances with the highest oil concentration. Lasting depth and a presence that fills the room.",
    cta_explore: "Explore the collection", cta_wa: "Order on WhatsApp",
    marquee: ["Extrait de Parfum", "50 ml", "100 ml", "Gift sets", "Power in every drop"],
    col_eyebrow: "The Collection", col_title: "Choose your scent", col_lead: "From a single flacon to royal sets, every fragrance carries the CAEZAR signature.",
    add: "Add to cart", view: "Details", order_wa: "Order on WhatsApp", currency: "EGP", egp: "EGP",
    notes_eyebrow: "Fragrance notes", notes_title: "The layers of scent", notes_lead: "Pick a fragrance, then touch each layer to reveal its notes.",
    top: "Top", heart: "Heart", base: "Base",
    top_hint: "The first impression, felt in the opening minutes.", heart_hint: "The character of the scent, emerging after minutes and lasting for hours.", base_hint: "The final trail, staying on skin for hours.",
    sample: "Sample notes: to be replaced with the real notes",
    quiz_eyebrow: "Scent finder", quiz_title: "Which scent is yours?", quiz_lead: "Four quick questions and we'll suggest the best match.",
    quiz_start: "Start the quiz", quiz_again: "Retake the quiz", quiz_result: "Our pick for you",
    story_eyebrow: "Our story", story_title: "Power in every drop",
    story_p1: "CAEZAR is a men's fragrance house inspired by presence and elegance. Every bottle is made to be remembered.",
    story_p2: "We choose our oils with care and present them in packaging worthy of a gift.",
    st1: "Extrait strength", st2: "Sizes", st3: "Doorstep delivery",
    gifts_title: "Gift sets", gifts_lead: "Luxurious black boxes, ready to give.", gifts_cta: "View the sets",
    contact_title: "Want to order or ask something?", contact_lead: "The CAEZAR team will reply, confirm your order and deliver to your door.", contact_cta: "Chat with us: 01108077464",
    rights: "All rights reserved © 2026",
    cart: "Your order", total: "Order total", empty: "Your cart is empty", checkout: "Send order via WhatsApp",
    added: "Added to cart", cart_empty_toast: "Add a fragrance to your cart first",
    home: "Home", qty: "Quantity", also: "You may also like", notfound: "Product not found",
    perk1: "Delivery across Egypt", perk2: "Luxury gift-ready packaging", perk3: "Order confirmed via WhatsApp",
    lang_btn: "عربي", co_name: "Full name", co_phone: "Phone number", co_addr: "Delivery address", order_no: "Order", co_invalid: "Please enter your name, phone and address", co_fail: "Could not place the order, please try again", soldout: "Sold out", soldout_toast: "This product is currently unavailable",
    wa_hello: "Hello CAEZAR PERFUMES 👋\nI'd like to order the following:\n\n", wa_count: "Qty", wa_price: "Price", wa_total: "Order total", wa_footer: "Please confirm the order and delivery address.",
    wa_single: (n, s, p) => `Hello, I'd like to order ${n} (${s}) for ${p} EGP.`,
    wa_quiz: (n) => `Hello, the scent quiz recommended ${n} and I'd like to know more.`,
    quiz: [
      { q: "When will you wear it most?", o: [["Work and daytime", { 1: 2 }], ["Evenings and events", { 2: 2, 1: 1 }], ["Everyday", { 1: 2 }], ["As a gift", { 3: 2, 5: 1 }]] },
      { q: "Your favourite season?", o: [["Summer", { 1: 2 }], ["Winter", { 2: 2 }], ["Spring and autumn", { 1: 1, 2: 1 }], ["All year", { 4: 1, 5: 1, 3: 1 }]] },
      { q: "How strong a trail do you like?", o: [["Soft and refined", { 1: 2 }], ["Moderate", { 1: 1, 2: 1 }], ["Bold and strong", { 2: 2 }], ["I want more than one", { 4: 2, 5: 2, 3: 1 }]] },
      { q: "Who is it for?", o: [["Me", { 1: 1, 2: 1 }], ["A gift for someone", { 3: 3 }], ["Me and my family", { 4: 3 }], ["A varied selection", { 5: 3 }]] },
    ],
  },
};

/* ---------- state ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};
let lang = store.get("czLang", "ar");
let cart = store.get("czCart", []);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const t = (k) => T[lang][k];
const pById = (id) => PRODUCTS.find((p) => p.id === +id);
const money = (n) => `${n.toLocaleString("en-US")} ${t("egp")}`;
const imgTag = (p, cls = "", alt = "") => `<img src="${(p.images && p.images[0]) || p.img}" alt="${alt || p.name[lang]}" class="${cls}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">`;

const MONO = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="#e8c9a0" stroke-width="1"/><path d="M12 14h13l-9 12h13M10 22l14-12" fill="none" stroke="#e8c9a0" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON = {
  bag: `<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 016 0v2"/></svg>`,
  menu: `<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  close: `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  wa: `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 00-8.5 15.2L2 22l4.9-1.5A10 10 0 1012 2zm5.2 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.9-4.5-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.300 2.400 1.500.3.1.5.1.6-.1l.9-1c.2-.2.4-.2.6-.1l1.900.9c.3.1.5.2.5.3.1.100.1.600-.1 1.200z"/></svg>`,
};

/* ---------- shell: header, footer, cart ---------- */
function buildShell() {
  const home = location.pathname.endsWith("product.html") ? "index.html" : "";
  $("#site-header").innerHTML = `
    <header class="header" id="header">
      <div class="wrap bar">
        <a class="brand" href="index.html" aria-label="CAEZAR PERFUMES">${MONO}<span><b>CAEZAR</b><small>PERFUMES</small></span></a>
        <nav class="nav" aria-label="Main">
          <a href="${home}#collection" data-i18n="nav_collection"></a>
          <a href="${home}#notes" data-i18n="nav_notes"></a>
          <a href="${home}#finder" data-i18n="nav_finder"></a>
          <a href="${home}#story" data-i18n="nav_story"></a>
        </nav>
        <div class="tools">
          <button class="icon-btn lang-btn" id="langBtn" type="button" aria-label="Language"></button>
          <button class="icon-btn" id="cartBtn" type="button" aria-label="Cart">${ICON.bag}<span class="badge-count" id="cartCount">0</span></button>
          <button class="icon-btn burger" id="burger" type="button" aria-label="Menu" aria-expanded="false">${ICON.menu}</button>
        </div>
      </div>
      <nav class="mobile-nav" id="mobileNav" aria-label="Mobile">
        <a href="${home}#collection" data-i18n="nav_collection"></a>
        <a href="${home}#notes" data-i18n="nav_notes"></a>
        <a href="${home}#finder" data-i18n="nav_finder"></a>
        <a href="${home}#story" data-i18n="nav_story"></a>
      </nav>
    </header>`;
  $("#site-footer").innerHTML = `
    <footer class="footer"><div class="wrap">
      <div><b>CAEZAR</b> &nbsp;<span data-i18n="rights"></span></div>
      <nav aria-label="Footer"><a href="index.html" data-i18n="home"></a><a href="${home}#collection" data-i18n="nav_collection"></a><a href="https://wa.me/${PHONE}" target="_blank" rel="noopener">WhatsApp</a></nav>
    </div></footer>
    <div class="overlay" id="overlay"></div>
    <aside class="drawer" id="drawer" aria-label="Cart" aria-hidden="true">
      <header><h2 data-i18n="cart"></h2><button class="icon-btn" id="drawerClose" type="button" aria-label="Close">${ICON.close}</button></header>
      <div class="items" id="cartItems"></div>
      <footer><div class="co" id="coFields" hidden><input id="coName" autocomplete="name" data-ph="co_name"><input id="coPhone" type="tel" autocomplete="tel" inputmode="tel" data-ph="co_phone"><textarea id="coAddr" rows="2" autocomplete="street-address" data-ph="co_addr"></textarea></div><div class="total"><span data-i18n="total"></span><b id="cartTotal"></b></div>
        <button class="btn btn-wa" id="checkout" type="button">${ICON.wa.replace("<svg", '<svg width="18" height="18" fill="currentColor"')}<span data-i18n="checkout"></span></button></footer>
    </aside>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>`;

  const header = $("#header");
  const onScroll = () => header.classList.toggle("scrolled", scrollY > 30);
  onScroll(); addEventListener("scroll", onScroll, { passive: true });
  $("#langBtn").onclick = () => setLang(lang === "ar" ? "en" : "ar");
  $("#burger").onclick = (e) => { const o = $("#mobileNav").classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", o); };
  $$("#mobileNav a").forEach((a) => (a.onclick = () => $("#mobileNav").classList.remove("open")));
  $("#cartBtn").onclick = () => toggleDrawer(true);
  $("#drawerClose").onclick = $("#overlay").onclick = () => toggleDrawer(false);
  $("#checkout").onclick = checkout;
  $("#coFields").hidden = !cloud;
  addEventListener("keydown", (e) => { if (e.key === "Escape") toggleDrawer(false); });
}

function toggleDrawer(open) {
  $("#drawer").classList.toggle("open", open);
  $("#overlay").classList.toggle("open", open);
  $("#drawer").setAttribute("aria-hidden", !open);
  document.body.style.overflow = open ? "hidden" : "";
}

function toast(msg) {
  const el = $("#toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(toast.id); toast.id = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ---------- cart ---------- */
function saveCart() { store.set("czCart", cart); renderCart(); }
function addToCart(id, n = 1) {
  const prod = pById(id);
  if (!prod || isSoldOut(prod)) return toast(t("soldout_toast"));
  const line = cart.find((l) => l.id === id);
  line ? (line.qty += n) : cart.push({ id, qty: n });
  saveCart(); toast(`${t("added")}: ${pById(id).name[lang]}`);
}
function changeQty(id, d) {
  const line = cart.find((l) => l.id === id); if (!line) return;
  line.qty += d; if (line.qty <= 0) cart = cart.filter((l) => l.id !== id);
  saveCart();
}
function renderCart() {
  if (productsReady) cart = cart.filter((l) => pById(l.id));
  $("#cartCount").textContent = cart.reduce((s, l) => s + l.qty, 0);
  const box = $("#cartItems");
  if (!cart.length) { box.innerHTML = `<div class="empty">${t("empty")}</div>`; $("#cartTotal").textContent = money(0); return; }
  let total = 0;
  box.innerHTML = cart.filter((l) => pById(l.id)).map((l) => {
    const p = pById(l.id); total += p.price * l.qty;
    return `<div class="line">${imgTag(p)}<div><h4>${p.name[lang]}</h4><small>${money(p.price)} × ${l.qty}</small></div>
      <div class="qty"><button type="button" data-d="-1" data-id="${p.id}" aria-label="-">−</button><output>${l.qty}</output><button type="button" data-d="1" data-id="${p.id}" aria-label="+">+</button></div></div>`;
  }).join("");
  $("#cartTotal").textContent = money(total);
  $$("#cartItems .qty button").forEach((b) => (b.onclick = () => changeQty(+b.dataset.id, +b.dataset.d)));
}
async function checkout() {
  if (!cart.length) return toast(t("cart_empty_toast"));
  let orderNo = null, win = null;
  if (cloud) {
    const name = $("#coName").value.trim(), phone = $("#coPhone").value.trim(), addr = $("#coAddr").value.trim();
    if (name.length < 2 || !/^[0-9+ ()-]{8,20}$/.test(phone) || addr.length < 6) return toast(t("co_invalid"));
    win = window.open("", "_blank"); // opened now so the popup blocker allows it after the network call
    if (win) win.opener = null;
    const btn = $("#checkout"); btn.disabled = true;
    const { data, error } = await sb.rpc("place_order", { p_name: name, p_phone: phone, p_address: addr, p_items: cart.map((l) => ({ product_id: l.id, qty: l.qty })) });
    btn.disabled = false;
    if (error) { if (win) win.close(); return toast(/stock|unavailable/i.test(error.message) ? error.message : t("co_fail")); }
    orderNo = data;
  }
  let total = 0, msg = t("wa_hello") + (orderNo ? `${t("order_no")} #${orderNo}\n\n` : "");
  cart.forEach((l, i) => {
    const p = pById(l.id), sub = p.price * l.qty; total += sub;
    msg += `${i + 1}. *${p.name[lang]}* (${p.size[lang]})\n   ${t("wa_count")}: ${l.qty}\n   ${t("wa_price")}: ${sub} ${t("egp")}\n\n`;
  });
  msg += `*${t("wa_total")}:* ${total} ${t("egp")}\n\n${t("wa_footer")}`;
  const url = `https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}`;
  if (orderNo) { cart = []; saveCart(); toggleDrawer(false); toast(`${t("order_no")} #${orderNo}`); }
  win ? (win.location = url) : window.open(url, "_blank", "noopener");
}
const waLink = (text) => `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;

/* ---------- i18n ---------- */
function setLang(l) {
  lang = l; store.set("czLang", l);
  document.documentElement.lang = l; document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  $$("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $("#langBtn").textContent = t("lang_btn");
  $$("[data-ph]").forEach((el) => (el.placeholder = t(el.dataset.ph)));
  renderCart();
  PAGE.render && PAGE.render();
  observeReveal();
}

/* ---------- reveal ---------- */
let io;
function observeReveal() {
  io = io || new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
  $$(".reveal:not(.in)").forEach((el) => io.observe(el));
}

/* ---------- notes pyramid (shared by home + product page) ---------- */
function pyramidHTML(id) {
  const p = pById(id);
  return `<div class="pyramid" role="group" aria-label="${t("notes_title")}">
      ${["top", "heart", "base"].map((k, i) => `<button type="button" class="layer l${i + 1}${k === "top" ? " active" : ""}" data-layer="${k}" aria-pressed="${k === "top"}"><span>${t(k)}</span></button>`).join("")}
    </div>`;
}
function wirePyramid(root, getId) {
  const show = (k) => {
    const p = pById(getId());
    $$(".layer", root).forEach((b) => { const on = b.dataset.layer === k; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
    $(".note-panel", root).innerHTML = `<h3>${t(k)}</h3><p class="hint">${t(k + "_hint")}</p>
      <ul class="note-list">${p.notes[k][lang].map((n) => `<li>${n}</li>`).join("")}</ul><span class="sample">${t("sample")}</span>`;
  };
  $$(".layer", root).forEach((b) => (b.onclick = () => show(b.dataset.layer)));
  show("top");
}

/* ---------- product card ---------- */
function cardHTML(p) {
  return `<article class="card reveal">
    <a class="media" href="product.html?id=${p.id}" aria-label="${p.name[lang]}">${imgTag(p)}<span class="chip">${isSoldOut(p) ? t("soldout") : p.badge[lang]}</span></a>
    <div class="body"><h3><a href="product.html?id=${p.id}">${p.name[lang]}</a></h3><span class="size">${p.size[lang]}</span>
      <p class="desc">${p.desc[lang]}</p>
      <div class="row"><span class="price">${p.price.toLocaleString("en-US")}<small>${t("egp")}</small></span></div>
      <div class="actions">
        <button class="btn btn-ghost btn-sm" type="button" data-add="${p.id}"${isSoldOut(p) ? " disabled" : ""}>${t("add")}</button>
        <a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="${waLink(T[lang].wa_single(p.name[lang], p.size[lang], p.price))}">${t("order_wa")}</a>
      </div></div></article>`;
}
function wireAdd(root = document) { $$("[data-add]", root).forEach((b) => (b.onclick = () => addToCart(+b.dataset.add))); }

/* ---------- pages ---------- */
const PAGE = {};

PAGE.home = () => {
  let noteId = null, qi = -1, scores = {};
  const marquee = () => { const items = T[lang].marquee.map((m) => `<span>${m}</span>`).join(""); $("#marqueeTrack").innerHTML = items + items; };
  const renderQuiz = () => {
    const box = $("#quizBox"), qs = T[lang].quiz;
    if (qi === -1) { box.innerHTML = `<p class="center"><button class="btn btn-gold" id="qStart" type="button">${t("quiz_start")}</button></p>`; $("#qStart").onclick = () => { qi = 0; scores = {}; renderQuiz(); }; return; }
    if (qi >= qs.length) {
      const ok = live().filter((x) => !isSoldOut(x)).map((x) => x.id);
      const best = +Object.entries(scores).filter(([k]) => ok.includes(+k)).sort((a, b) => b[1] - a[1])[0]?.[0] || ok[0] || live()[0].id, p = pById(best);
      box.innerHTML = `<div class="progress"><i style="width:100%"></i></div><div class="result">${imgTag(p)}<div>
        <span class="eyebrow">${t("quiz_result")}</span><h3>${p.name[lang]}</h3><div class="price">${money(p.price)}</div><p class="lead">${p.desc[lang]}</p>
        <div class="cta-row"><button class="btn btn-gold btn-sm" type="button" id="qAdd">${t("add")}</button>
        <a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="${waLink(T[lang].wa_quiz(p.name[lang]))}">${t("order_wa")}</a>
        <button class="btn btn-ghost btn-sm" type="button" id="qAgain">${t("quiz_again")}</button></div></div></div>`;
      $("#qAdd").onclick = () => addToCart(best); $("#qAgain").onclick = () => { qi = -1; renderQuiz(); }; return;
    }
    const q = qs[qi];
    box.innerHTML = `<div class="progress"><i style="width:${(qi / qs.length) * 100}%"></i></div><h3 class="q-title">${q.q}</h3>
      <div class="opts">${q.o.map((o, i) => `<button class="opt" type="button" data-i="${i}">${o[0]}</button>`).join("")}</div>`;
    $$(".opt", box).forEach((b) => (b.onclick = () => { Object.entries(q.o[+b.dataset.i][1]).forEach(([k, v]) => (scores[k] = (scores[k] || 0) + v)); qi++; renderQuiz(); }));
  };
  PAGE.render = () => {
    if (!productsReady) return;
    if (noteId == null || !pById(noteId)) noteId = live()[0] ? live()[0].id : null;
    if (noteId == null) return;
    marquee();
    $("#grid").innerHTML = live().map(cardHTML).join(""); wireAdd($("#grid"));
    $("#tabs").innerHTML = live().map((p) => `<button class="tab" role="tab" type="button" data-id="${p.id}" aria-selected="${p.id === noteId}">${p.name[lang]}</button>`).join("");
    $$("#tabs .tab").forEach((b) => (b.onclick = () => { noteId = +b.dataset.id; PAGE.render(); }));
    $("#pyramidBox").innerHTML = pyramidHTML(noteId) + "";
    wirePyramid($("#notesRoot"), () => noteId);
    renderQuiz();
    $("#waHero").href = waLink(lang === "ar" ? "السلام عليكم، حابب أستفسر عن عطور CAEZAR" : "Hello, I'd like to ask about CAEZAR perfumes");
    $("#waContact").href = waLink(lang === "ar" ? "السلام عليكم، أريد الاستفسار عن العطور" : "Hello, I'd like to ask about your perfumes");
  };

  // hero parallax + droplets
  const img = $(".hero-media img"), reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) addEventListener("scroll", () => { if (scrollY < innerHeight * 1.2) img.style.transform = `translateY(${scrollY * 0.14}px) scale(1.02)`; }, { passive: true });
  $(".drops").innerHTML = Array.from({ length: 14 }, (_, i) => {
    const s = 4 + ((i * 7) % 10), l = 8 + ((i * 53) % 84), tp = 10 + ((i * 37) % 78), d = ((i * 13) % 70) / 10, dur = 5 + (i % 5);
    return `<span style="width:${s}px;height:${s}px;inset-inline-start:${l}%;top:${tp}%;animation-delay:-${d}s;animation-duration:${dur}s"></span>`;
  }).join("");
};

PAGE.product = () => {
  const id = +new URLSearchParams(location.search).get("id") || 1;
  let qty = 1;
  PAGE.render = () => {
    if (!productsReady) return;
    const p = pById(id), root = $("#pdp");
    if (!p || p.status === "draft") { root.innerHTML = `<div class="wrap center section"><h1 class="h2">${t("notfound")}</h1><a class="btn btn-gold" href="index.html">${t("home")}</a></div>`; return; }
    document.title = `${p.name[lang]} | CAEZAR PERFUMES`;
    const others = live().filter((x) => x.id !== id).slice(0, 3);
    root.innerHTML = `<div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">${t("home")}</a> / <a href="index.html#collection">${t("nav_collection")}</a> / ${p.name[lang]}</nav>
      <div class="pdp-grid">
        <div class="gallery"><div class="zoom" id="zoom">${imgTag(p, "", p.name[lang]).replace('loading="lazy"', "")}</div>${p.images.length > 1 ? `<div class="thumbs">${p.images.map((u, i) => `<button type="button" data-i="${i}" aria-label="Image ${i + 1}"><img src="${u}" alt=""></button>`).join("")}</div>` : ""}</div>
        <div>
          <span class="eyebrow">${isSoldOut(p) ? t("soldout") : p.badge[lang]} · ${p.size[lang]}${p.scent ? " · " + p.scent : ""}</span>
          <h1>${p.name[lang]}</h1><div class="rule"></div>
          <span class="price">${p.price.toLocaleString("en-US")}<small>${t("egp")}</small></span>
          <p class="lead">${p.desc[lang]}</p>
          <div class="buy">
            <div class="qty" aria-label="${t("qty")}"><button type="button" id="minus" aria-label="-">−</button><output id="qv">${qty}</output><button type="button" id="plus" aria-label="+">+</button></div>
            <button class="btn btn-gold" type="button" id="addBtn"${isSoldOut(p) ? " disabled" : ""}>${t("add")}</button>
            <a class="btn btn-wa" id="waBtn" target="_blank" rel="noopener" href="#">${t("order_wa")}</a>
          </div>
          <ul class="perks"><li>${t("perk1")}</li><li>${t("perk2")}</li><li>${t("perk3")}</li></ul>
        </div>
      </div>
      <section class="pdp-notes" aria-labelledby="nt"><div class="center"><span class="eyebrow">${t("notes_eyebrow")}</span><h2 class="h2" id="nt">${t("notes_title")}</h2><div class="rule"></div></div>
        <div class="notes-grid" id="pNotes"><div>${pyramidHTML(id)}</div><div class="note-panel" aria-live="polite"></div></div></section>
      <section class="section" aria-labelledby="al"><div class="center"><h2 class="h2" id="al">${t("also")}</h2><div class="rule"></div></div>
        <div class="grid" id="alsoGrid">${others.map(cardHTML).join("")}</div></section></div>`;
    wirePyramid($("#pNotes"), () => id); wireAdd(root);
    const upd = () => { $("#qv").textContent = qty; $("#waBtn").href = waLink(lang === "ar" ? `السلام عليكم، أريد طلب ${qty} × ${p.name[lang]} (${p.size[lang]}) بإجمالي ${p.price * qty} جنيه.` : `Hello, I'd like to order ${qty} × ${p.name[lang]} (${p.size[lang]}), total ${p.price * qty} EGP.`); };
    $("#minus").onclick = () => { qty = Math.max(1, qty - 1); upd(); };
    $("#plus").onclick = () => { qty = Math.min(20, qty + 1); upd(); };
    $("#addBtn").onclick = () => addToCart(id, qty);
    upd();
    const z = $("#zoom"), zi = $("img", z);
    z.onmousemove = (e) => { const r = z.getBoundingClientRect(); zi.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`; zi.style.transform = "scale(1.7)"; };
    z.onmouseleave = () => (zi.style.transform = "");
    $$(".thumbs button", root).forEach((b) => (b.onclick = () => (zi.src = p.images[+b.dataset.i])));
  };
};

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  if (!$("#site-header")) return; // admin page reuses this file for data only
  buildShell();
  (document.body.dataset.page === "product" ? PAGE.product : PAGE.home)();
  setLang(lang);
  if (cloud) {
    fetchProducts()
      .then((rows) => rows, () => DEFAULT_PRODUCTS.map(normalize)) // backend unreachable: show the built-in catalogue
      .then((rows) => { PRODUCTS.splice(0, PRODUCTS.length, ...rows); productsReady = true; renderCart(); PAGE.render(); observeReveal(); });
  }
});
