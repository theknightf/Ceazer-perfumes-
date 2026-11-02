# CAEZAR PERFUMES: Backend & Production Plan

The storefront and `admin.html` currently run in **preview mode**: products live in the browser's `localStorage`, so edits show instantly on the same device but are not shared, not backed up, and `admin.html` has **no login**. Anyone who knows the URL can open it, and its changes affect only their own browser. Do not treat it as secure until the steps below are done.

## 0. Go live in 6 steps (the code is already written)

The Supabase integration is built: `supabase/migrations/001_init.sql` (tables, security rules, order and stock functions, image bucket, seed data), `db.js` (data layer), `config.js` (your keys), checkout that creates real orders, and an admin with login, image storage and an orders screen. **The SQL in sections 2 to 4 below is explanatory. The migration file is the version to run.**

1. ~~Create a project~~ Done: project `caezar-perfumes` (eu-central-1) already exists.
2. ~~Run the migration~~ Done: applied, with the 5 products and the `product-images` bucket.
3. Authentication > Users > Add user (email + password, auto-confirm). This is your admin account.
4. Make it admin in the SQL Editor (replace the email):
   `update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');`
5. ~~Keys~~ Done: `config.js` already holds the project URL and anon key.
6. Authentication > Sign In / Providers: turn **off** new user sign-ups (only you need an account), then redeploy to Netlify.

Then open `admin.html` and sign in. The page switches to Live mode. Orders placed on the storefront appear under Orders, and setting an order to cancelled puts its stock back. Until `config.js` is filled, the site keeps working in local preview mode.

**Known limits of this version:** payment is still WhatsApp / cash on delivery (no card gateway); customers cannot look up their own order status; "Copy" in the admin does not copy images; there is no email or WhatsApp alert for new orders.

---

## 1. Recommended stack

**Supabase (PostgreSQL + Auth + Storage + Row Level Security).**

| Need | Why Supabase fits |
|---|---|
| Products, orders, stock are relational | PostgreSQL with constraints and transactions |
| Admin vs customer | Built-in Auth plus RLS policies enforced in the database |
| Product images | Storage buckets with a CDN, no separate S3/Cloudinary account |
| Static site on Netlify | The browser talks to Supabase directly (`@supabase/supabase-js`), no server to run |
| Live stock/order updates | Realtime subscriptions on tables |

Alternatives: **Firebase** (Firestore + Auth + Storage) is fine, but atomic stock decrements and order reporting are clumsier. **MongoDB** needs you to host an API server as well. For a small shop on Netlify, Supabase is the shortest path.

Image storage: Supabase Storage is enough. Use **Cloudinary** instead if you want automatic resizing, WebP/AVIF conversion and cropping on the fly.

## 2. Database schema (PostgreSQL)

```sql
create type product_status as enum ('published', 'draft', 'out_of_stock');

create table profiles (
  id         uuid primary key references auth.users on delete cascade,
  role       text not null default 'customer' check (role in ('customer', 'admin')),
  full_name  text,
  phone      text,
  created_at timestamptz not null default now()
);

create table products (
  id             bigint generated always as identity primary key,
  slug           text unique not null,
  name_en        text not null,
  name_ar        text,
  description_en text,
  description_ar text,
  scent_type     text,
  volume_ml      int check (volume_ml > 0),
  size_label     text,                                  -- e.g. '3 × 50 ml' for sets
  price_egp      numeric(10,2) not null check (price_egp >= 0),
  stock          int check (stock >= 0),                -- null = not tracked
  status         product_status not null default 'draft',
  badge_en       text,
  badge_ar       text,
  notes          jsonb not null default
    '{"top":{"en":[],"ar":[]},"heart":{"en":[],"ar":[]},"base":{"en":[],"ar":[]}}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table product_images (
  id         bigint generated always as identity primary key,
  product_id bigint not null references products on delete cascade,
  path       text not null,                             -- path inside the storage bucket
  position   int not null default 0                     -- 0 = cover
);

create table orders (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users,             -- null for guest checkout
  customer_name text not null,
  phone         text not null,
  address       text not null,
  status        text not null default 'pending'
    check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  total_egp     numeric(10,2) not null,
  created_at    timestamptz not null default now()
);

create table order_items (
  id             bigint generated always as identity primary key,
  order_id       bigint not null references orders on delete cascade,
  product_id     bigint not null references products,
  qty            int not null check (qty > 0),
  unit_price_egp numeric(10,2) not null                 -- price at time of purchase
);

create table stock_movements (                          -- audit trail for every stock change
  id         bigint generated always as identity primary key,
  product_id bigint not null references products,
  delta      int not null,
  reason     text not null check (reason in ('order','restock','adjustment','cancel')),
  order_id   bigint references orders,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

create index on products (status);
create index on product_images (product_id, position);
create index on order_items (order_id);
```

## 3. Authentication & role-based access (RBAC)

- **Auth:** Supabase Auth (email + password, optional magic link). Customers can browse and order without an account at first.
- **Roles:** stored in `profiles.role`. Promote your own account to admin by hand in the SQL editor. **Never** let the browser set a role.
- **Enforcement is in the database (RLS), not in the admin page.** Hiding the admin page is not security.

```sql
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

alter table products        enable row level security;
alter table product_images  enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table stock_movements enable row level security;
alter table profiles        enable row level security;

-- Public storefront: only non-draft products and their images
create policy "public read products" on products for select using (status <> 'draft' or is_admin());
create policy "admin write products" on products for all using (is_admin()) with check (is_admin());
create policy "public read images" on product_images for select
  using (exists (select 1 from products p where p.id = product_id and (p.status <> 'draft' or is_admin())));
create policy "admin write images" on product_images for all using (is_admin()) with check (is_admin());

-- Orders: customers see their own, admins see all. Customers do NOT insert directly (see place_order below).
create policy "own orders" on orders for select using (user_id = auth.uid() or is_admin());
create policy "admin update orders" on orders for update using (is_admin());
create policy "own order items" on order_items for select
  using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_admin())));
create policy "admin stock log" on stock_movements for all using (is_admin()) with check (is_admin());

-- Profiles: read/update yourself, but the role column must never be changed by the user
create policy "own profile read" on profiles for select using (id = auth.uid() or is_admin());
create policy "own profile update" on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = my_role());  -- my_role() is a security-definer helper; a subquery on profiles here would recurse
```

Storage: create a public-read bucket `product-images`, with insert/update/delete allowed only when `is_admin()`.

## 4. API endpoints

Supabase auto-generates REST (PostgREST) for the tables above. You only write custom functions for operations that must be atomic or must not trust the client.

| Operation | Endpoint (REST) | Who |
|---|---|---|
| List published products | `GET /rest/v1/products?status=neq.draft&select=*,product_images(*)` | Public |
| Get one product | `GET /rest/v1/products?slug=eq.{slug}&select=*,product_images(*)` | Public |
| Create product | `POST /rest/v1/products` | Admin |
| Update product | `PATCH /rest/v1/products?id=eq.{id}` | Admin |
| Delete product | `DELETE /rest/v1/products?id=eq.{id}` | Admin |
| Upload image | `POST /storage/v1/object/product-images/{productId}/{file}` then insert a `product_images` row | Admin |
| Reorder / set cover | `PATCH /rest/v1/product_images?id=eq.{id}` (`position`) | Admin |
| Adjust stock | `POST /rest/v1/rpc/adjust_stock` `{product_id, delta, reason}` | Admin |
| Place order | `POST /rest/v1/rpc/place_order` `{customer, items[]}` | Public / customer |
| List orders | `GET /rest/v1/orders?select=*,order_items(*)` | Customer (own) / Admin (all) |
| Update order status | `PATCH /rest/v1/orders?id=eq.{id}` | Admin |

Order placement must be a database function so the **server** recomputes prices and decrements stock in one transaction. Never trust a price or total sent from the browser.

```sql
create or replace function place_order(p_name text, p_phone text, p_address text, p_items jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_order bigint; v_total numeric := 0; it jsonb; prod products;
begin
  insert into orders (user_id, customer_name, phone, address, total_egp)
  values (auth.uid(), p_name, p_phone, p_address, 0) returning id into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from products where id = (it->>'product_id')::bigint for update;
    if not found or prod.status <> 'published' then raise exception 'Product unavailable'; end if;
    if prod.stock is not null then
      if prod.stock < (it->>'qty')::int then raise exception 'Not enough stock for %', prod.name_en; end if;
      update products set stock = stock - (it->>'qty')::int where id = prod.id;
      insert into stock_movements (product_id, delta, reason, order_id)
        values (prod.id, -(it->>'qty')::int, 'order', v_order);
    end if;
    insert into order_items (order_id, product_id, qty, unit_price_egp)
      values (v_order, prod.id, (it->>'qty')::int, prod.price_egp);
    v_total := v_total + prod.price_egp * (it->>'qty')::int;
  end loop;

  update orders set total_egp = v_total where id = v_order;
  return v_order;
end $$;
```

## 5. Migration path from this prototype

1. Create a Supabase project, run the SQL above, create the `product-images` bucket.
2. Add `supabase-js` via CDN and replace `loadProducts()` in `app.js` with a `select` on `products`.
3. In `admin.js`, replace `persist()` and the list mutations with insert/update/delete calls, and the image resize step with a Storage upload.
4. Add a login screen to `admin.html` and check the session plus role before showing anything.
5. Put the Supabase URL and the **anon** key in the frontend (this is safe because RLS protects the data). The **service_role** key must never go in frontend code.
6. Import the 5 existing products from the Export JSON button into the `products` table.

## 6. Missing pieces and next iteration

**Must have before real sales**
- **Real authentication** on the admin (currently none).
- **Server-side order creation** with the `place_order` function, so prices and stock cannot be tampered with. Today the cart sends an order by WhatsApp message and does not reduce stock.
- **Payment:** for Egypt, evaluate **Paymob**, **Fawry**, **Kashier** or cash on delivery. Card payments need a server-side webhook to confirm payment. Do not mark an order as paid from the browser.
- **Order tracking:** statuses (pending, confirmed, shipped, delivered), an admin orders screen, and a customer order-status page.
- **Delivery data:** address, governorate, shipping fee by region, and phone validation (Egyptian numbers).

**Should have**
- **Admin orders & customers screens** with filters, plus a low-stock alert (email/WhatsApp when stock is at or below 5).
- **Image optimization:** serve WebP at multiple sizes (Cloudinary or Supabase image transforms). The current JPEG data URLs are fine for preview only.
- **Real-time sync:** subscribe the storefront to `products` changes so sold-out status updates without refresh.
- **Backups and audit log:** daily database backup and a record of who changed prices and stock.
- **Legal and trust pages:** privacy policy, returns/refund policy, terms. Required by most payment providers.
- **SEO and sharing:** per-product meta tags and Open Graph images (needs pre-rendering or an edge function), `sitemap.xml`, and analytics.
- **Accessibility audit** with a screen reader, and an Arabic copy review by a native speaker.

**Nice to have**
- Discount codes, product reviews, wishlist, back-in-stock email, a loyalty program, and a bundles builder for the gift sets.
