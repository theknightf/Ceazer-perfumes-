-- Shipping rates per Egyptian governorate, and shipping on orders.
-- Fees and delivery windows are NOT pre-filled: every governorate starts inactive with a 0 fee.
-- Set them in the admin dashboard. While no governorate is active, checkout skips the governorate step.

create table governorates (
  id                 smallint primary key,
  name_en            text not null,
  name_ar            text not null,
  zone               text not null check (zone in ('greater_cairo','alexandria','delta','canal','upper_egypt','frontier')),
  shipping_fee_egp   numeric(10,2) not null default 0 check (shipping_fee_egp >= 0),
  delivery_window_en text,
  delivery_window_ar text,
  is_active          boolean not null default false,
  sort_order         smallint not null,
  updated_at         timestamptz not null default now()
);

alter table governorates enable row level security;
create policy "read governorates"         on governorates for select using (is_active or is_admin());
create policy "admin insert governorates" on governorates for insert with check (is_admin());
create policy "admin update governorates" on governorates for update using (is_admin()) with check (is_admin());
create policy "admin delete governorates" on governorates for delete using (is_admin());
create trigger governorates_touch before update on governorates for each row execute function touch_updated_at();

insert into governorates (id, name_en, name_ar, zone, sort_order) values
(1,'Cairo','القاهرة','greater_cairo',1),(2,'Giza','الجيزة','greater_cairo',2),(3,'Alexandria','الإسكندرية','alexandria',3),
(4,'Qalyubia','القليوبية','greater_cairo',4),(5,'Sharqia','الشرقية','delta',5),(6,'Dakahlia','الدقهلية','delta',6),
(7,'Gharbia','الغربية','delta',7),(8,'Menofia','المنوفية','delta',8),(9,'Damietta','دمياط','delta',9),
(10,'Port Said','بورسعيد','canal',10),(11,'Ismailia','الإسماعيلية','canal',11),(12,'Suez','السويس','canal',12),
(13,'Beheira','البحيرة','delta',13),(14,'Kafr El Sheikh','كفر الشيخ','delta',14),(15,'Matrouh','مطروح','frontier',15),
(16,'North Sinai','شمال سيناء','frontier',16),(17,'South Sinai','جنوب سيناء','frontier',17),(18,'Faiyum','الفيوم','upper_egypt',18),
(19,'Beni Suef','بني سويف','upper_egypt',19),(20,'Minya','المنيا','upper_egypt',20),(21,'Asyut','أسيوط','upper_egypt',21),
(22,'Sohag','سوهاج','upper_egypt',22),(23,'Qena','قنا','upper_egypt',23),(24,'Luxor','الأقصر','upper_egypt',24),
(25,'Aswan','أسوان','upper_egypt',25),(26,'Red Sea','البحر الأحمر','frontier',26),(27,'New Valley','الوادي الجديد','frontier',27);

alter table orders
  add column governorate_id smallint references governorates,
  add column subtotal_egp   numeric(10,2) not null default 0,
  add column shipping_egp   numeric(10,2) not null default 0;
create index on orders (governorate_id);

-- place_order now also takes the governorate. The server looks up the fee; the browser never sends a price.
drop function place_order(text, text, text, jsonb);
create function place_order(p_name text, p_phone text, p_address text, p_items jsonb, p_governorate smallint default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_order bigint; v_sub numeric := 0; v_ship numeric := 0; it jsonb; prod products; g governorates; v_qty int;
begin
  if length(trim(coalesce(p_name, ''))) < 2 or length(p_name) > 120 then raise exception 'Invalid name'; end if;
  if p_phone !~ '^[0-9+ ()-]{8,20}$' then raise exception 'Invalid phone number'; end if;
  if length(trim(coalesce(p_address, ''))) < 6 or length(p_address) > 500 then raise exception 'Invalid address'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Invalid items'; end if;

  if exists (select 1 from governorates where is_active) then
    select * into g from governorates where id = p_governorate and is_active;
    if not found then raise exception 'Please choose a delivery governorate'; end if;
    v_ship := g.shipping_fee_egp;
  end if;

  insert into orders (user_id, customer_name, phone, address, governorate_id, shipping_egp)
  values (auth.uid(), trim(p_name), trim(p_phone), trim(p_address), g.id, v_ship) returning id into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'Invalid quantity'; end if;
    select * into prod from products where id = (it->>'product_id')::bigint for update;
    if not found or prod.status <> 'published' then raise exception 'Product unavailable'; end if;
    if prod.stock is not null then
      if prod.stock < v_qty then raise exception 'Not enough stock for %', prod.name_en; end if;
      update products set stock = stock - v_qty where id = prod.id;
      insert into stock_movements (product_id, delta, reason, order_id) values (prod.id, -v_qty, 'order', v_order);
    end if;
    insert into order_items (order_id, product_id, qty, unit_price_egp) values (v_order, prod.id, v_qty, prod.price_egp);
    v_sub := v_sub + prod.price_egp * v_qty;
  end loop;

  update orders set subtotal_egp = v_sub, total_egp = v_sub + v_ship where id = v_order;
  return v_order;
end $$;

revoke all on function place_order(text, text, text, jsonb, smallint) from public, anon, authenticated;
grant execute on function place_order(text, text, text, jsonb, smallint) to anon, authenticated;
