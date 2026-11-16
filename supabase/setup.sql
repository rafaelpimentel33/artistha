begin;
set local standard_conforming_strings = on;

create schema if not exists shop_private;
revoke all on schema shop_private from public, anon, authenticated;
grant usage on schema shop_private to authenticated;

create table shop_private.owner (singleton boolean primary key default true check (singleton), user_id uuid not null references auth.users(id) on delete restrict);
create table shop_private.registration_config (singleton boolean primary key default true check (singleton), secret_hash text not null check (secret_hash ~ '^[a-f0-9]{64}$'));
create table shop_private.registration_quota (bucket timestamptz primary key, attempts integer not null);

create table public.shop_config (
  id smallint primary key check (id = 1),
  body jsonb not null check (jsonb_typeof(body) = 'object'),
  revision integer not null default 1 check (revision > 0)
);

create table public.shop_products (
  id text primary key,
  slug text not null unique,
  body jsonb not null check (jsonb_typeof(body) = 'object'),
  revision integer not null default 1 check (revision > 0),
  position integer,
  updated_at timestamptz not null default now()
);
create index shop_products_order on public.shop_products (position asc nulls first, updated_at desc, id);

create table public.shop_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  name text not null default '' check (length(name) <= 100),
  email text not null default '' check (length(email) <= 180),
  phone text not null default '' check (length(phone) <= 24),
  cep text not null default '' check (cep ~ '^([0-9]{8})?$')
);

create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  customer_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled')),
  name text not null, method text not null check (method in ('delivery','pickup')),
  cep text not null, note text not null,
  lines jsonb not null check (jsonb_typeof(lines) = 'array'),
  subtotal bigint not null check (subtotal >= 0),
  freight bigint check (freight >= 0),
  total bigint check (total >= 0),
  unique (customer_id, idempotency_key)
);
create index shop_orders_customer on public.shop_orders (customer_id, created_at desc);

create function shop_private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from shop_private.owner where user_id = (select auth.uid())) $$;
revoke all on function shop_private.is_admin() from public;
grant execute on function shop_private.is_admin() to authenticated;

create function public.shop_admin_state() returns text
language sql stable security definer set search_path = ''
as $$
  select case when (select auth.uid()) is null then 'signin'
              when shop_private.is_admin() then 'admin'
              when exists (select 1 from shop_private.owner) then 'denied'
              else 'setup' end
$$;
revoke all on function public.shop_admin_state() from public;
grant execute on function public.shop_admin_state() to authenticated;

create extension if not exists supabase_vault with schema vault;
select vault.create_secret(gen_random_uuid()::text, 'loja_codigo_ativacao', 'Código de uso único para vincular a primeira conta administradora da loja.');

create function public.shop_activate_owner(p_code text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  code text;
begin
  if owner_id is null or p_code is null or length(p_code) <> 36 then return false; end if;
  select decrypted_secret into code from vault.decrypted_secrets where name = 'loja_codigo_ativacao';
  if code is distinct from lower(btrim(p_code)) then return false; end if;
  insert into shop_private.owner(user_id) values (owner_id) on conflict do nothing;
  return found;
end
$$;
revoke all on function public.shop_activate_owner(text) from public;
grant execute on function public.shop_activate_owner(text) to authenticated;

create function public.shop_registration_gate(p_digest text, p_count boolean) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  slot timestamptz := date_trunc('minute', clock_timestamp());
  used integer;
begin
  if p_digest is null or not exists (select 1 from shop_private.registration_config where secret_hash = p_digest) then return false; end if;
  if not p_count then return true; end if;
  delete from shop_private.registration_quota where bucket < slot - interval '2 minutes';
  insert into shop_private.registration_quota (bucket, attempts) values (slot, 1)
  on conflict (bucket) do update set attempts = shop_private.registration_quota.attempts + 1
    where shop_private.registration_quota.attempts < 30 returning attempts into used;
  return used is not null;
end
$$;
revoke all on function public.shop_registration_gate(text, boolean) from public, anon, authenticated;
grant execute on function public.shop_registration_gate(text, boolean) to service_role;

alter table public.shop_config enable row level security;
alter table public.shop_products enable row level security;
alter table public.shop_profiles enable row level security;
alter table public.shop_orders enable row level security;

revoke all on table public.shop_config, public.shop_products, public.shop_profiles, public.shop_orders from public, anon, authenticated;
grant select on table public.shop_config, public.shop_products to anon, authenticated;
grant update on public.shop_config to authenticated;
grant insert, update, delete on public.shop_products to authenticated;
grant select, insert, update on public.shop_profiles to authenticated;
grant select on public.shop_orders to authenticated;
grant update(status) on public.shop_orders to authenticated;

create policy shop_config_read on public.shop_config for select to anon, authenticated using (true);
create policy shop_config_write on public.shop_config for update to authenticated using ((select shop_private.is_admin())) with check ((select shop_private.is_admin()));
create policy shop_products_read on public.shop_products for select to anon, authenticated using (body->>'active' = 'true');
create policy shop_products_manage on public.shop_products for all to authenticated using ((select shop_private.is_admin())) with check ((select shop_private.is_admin()));
create policy shop_profiles_own on public.shop_profiles for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy shop_orders_read on public.shop_orders for select to authenticated using (customer_id = (select auth.uid()) or (select shop_private.is_admin()));
create policy shop_orders_update on public.shop_orders for update to authenticated using ((select shop_private.is_admin())) with check ((select shop_private.is_admin()));
create policy shop_media_insert on storage.objects for insert to authenticated
with check (bucket_id = 'loja-artesanal-fotos' and (select shop_private.is_admin()));

create function public.shop_place_order(
  p_key uuid, p_name text, p_method text, p_cep text, p_note text,
  p_entries jsonb, p_subtotal bigint, p_freight bigint
) returns public.shop_orders
language plpgsql security definer set search_path = ''
as $$
declare
  customer uuid := auth.uid();
  existing public.shop_orders;
  config jsonb;
  entry jsonb;
  product jsonb;
  variant jsonb;
  entry_key text;
  seen text[] := '{}';
  quantity integer;
  unit_price bigint;
  stock integer;
  label text;
  amount bigint := 0;
  shipping bigint;
  entries jsonb := '[]';
  postal text := regexp_replace(coalesce(p_cep, ''), '[^0-9]', '', 'g');
begin
  if customer is null or p_key is null then raise exception 'shop_signin'; end if;
  select * into existing from public.shop_orders where customer_id = customer and idempotency_key = p_key;
  if found then return existing; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 100 or char_length(coalesce(p_note, '')) > 500
     or p_method is null or p_method not in ('delivery','pickup') or (p_method = 'delivery' and length(postal) <> 8)
     or p_entries is null or jsonb_typeof(p_entries) <> 'array' then raise exception 'shop_invalid_order'; end if;
  if jsonb_array_length(p_entries) not between 1 and 40 then raise exception 'shop_invalid_order'; end if;

  select body into config from public.shop_config where id = 1;
  if config is null or not coalesce((config->>p_method)::boolean, false) then raise exception 'shop_changed'; end if;

  for entry in select value from jsonb_array_elements(p_entries) loop
    if coalesce(entry->>'productId','') !~ '^[a-zA-Z0-9_-]{1,120}$'
       or coalesce(entry->>'quantity','') !~ '^[1-9][0-9]?$' then raise exception 'shop_invalid_order'; end if;
    entry_key := (entry->>'productId') || ':' || coalesce(entry->>'variantId','');
    if entry_key = any(seen) then raise exception 'shop_invalid_order'; end if;
    seen := array_append(seen, entry_key);
    quantity := (entry->>'quantity')::integer;

    select body into product from public.shop_products where id = entry->>'productId' and body->>'active' = 'true';
    if not found then raise exception 'shop_changed'; end if;

    variant := null;
    label := '';
    if jsonb_array_length(coalesce(product->'variants', '[]'::jsonb)) > 0 then
      select value into variant from jsonb_array_elements(product->'variants')
        where value->>'id' = entry->>'variantId' and value->>'active' = 'true';
      if not found then raise exception 'shop_changed'; end if;
      select coalesce(string_agg(coalesce(product->'variantNames'->((n - 1)::int) #>> '{}', 'Opção') || ': ' || value, ' · ' order by n), '')
        into label from jsonb_array_elements_text(variant->'values') with ordinality as options(value, n);
    elsif entry->>'variantId' is not null then raise exception 'shop_changed';
    end if;
    stock := least(99, coalesce((variant->>'stock')::integer, (product->>'stock')::integer, 99));
    if stock < quantity then raise exception 'shop_changed'; end if;
    unit_price := coalesce((variant->>'price')::bigint, (product->>'price')::bigint);
    amount := amount + unit_price * quantity;
    entries := entries || jsonb_build_array(jsonb_build_object(
      'name', product->>'name', 'option', label, 'quantity', quantity, 'price', unit_price
    ));
  end loop;

  shipping := case when p_method = 'pickup' or amount >= (config->>'freeOver')::bigint then 0
                   when config->>'shippingType' = 'flat' then (config->>'shippingCost')::bigint
                   else null end;
  if amount is distinct from p_subtotal or shipping is distinct from p_freight then raise exception 'shop_changed'; end if;
  insert into public.shop_orders (customer_id, idempotency_key, name, method, cep, note, lines, subtotal, freight, total)
    values (customer, p_key, btrim(p_name), p_method, case when p_method = 'pickup' then '' else postal end,
            coalesce(btrim(p_note), ''), entries, amount, shipping, amount + shipping)
    on conflict (customer_id, idempotency_key) do nothing returning * into existing;
  if not found then
    select * into existing from public.shop_orders where customer_id = customer and idempotency_key = p_key;
  end if;
  return existing;
end
$$;
revoke all on function public.shop_place_order(uuid,text,text,text,text,jsonb,bigint,bigint) from public;
grant execute on function public.shop_place_order(uuid,text,text,text,text,jsonb,bigint,bigint) to authenticated;

insert into public.shop_config (id, body) values (1, '{"name":"ArtisTha","logo":"","accent":"#a65d2b","background":"#ffffff","headingFont":"zilla","bodyFont":"outfit","announcements":["Peças artesanais sob encomenda","Pedidos pelo WhatsApp","Enviamos para todo o Brasil"],"banners":[],"bannerAuto":true,"introTitle":"Produtos 100% artesanais","introText":"Todas as peças são feitas sob encomenda.","materialsTitle":"Materiais sustentáveis","materialsText":"Fibras, madeira e cerâmica ganham novas formas em peças feitas à mão.","railTitles":{"new":"Lançamentos","featured":"Destaques","sale":"Ofertas"},"featuredId":"","categories":[{"id":"colecao-ano-novo","name":"Coleção Ano Novo"},{"id":"ceramicas","name":"Cerâmicas"},{"id":"moda-praia","name":"Moda Praia"},{"id":"paineis","name":"Painéis de Macramê"},{"id":"croche","name":"Crochê"},{"id":"colecao-deusas-do-tempo1","name":"Coleção Deusas do Tempo"},{"id":"luminarias","name":"Luminárias"},{"id":"arte-e-decoracao","name":"Arte e Decoração"},{"id":"almofadas","name":"Almofadas"},{"id":"prateleiras","name":"Prateleiras"},{"id":"infantil","name":"Infantil"},{"id":"bolsas","name":"Bolsas"},{"id":"lembrancinhas","name":"Lembrancinhas"}],"sections":["intro","new","featured","materials","spotlight","promo","sale"],"promoImage":"","promoHref":"/produtos","promoText":"Arte feita à mão para levar textura, luz e afeto à sua casa.","whatsapp":"","contactEmail":"","instagram":"","checkoutGreeting":"Olá! Gostaria de fazer este pedido pelo site.","delivery":true,"pickup":true,"shippingType":"quote","shippingCost":0,"freeOver":null,"aboutTitle":"Quem faz","aboutText":"Uma vitrine de artesanato brasileiro, com peças em cerâmica, macramê e crochê.\\n\\nEntre fios, barro e madeira, cada peça ganha forma à mão. As encomendas podem incluir escolhas de tamanho, cor e acabamento, conforme o produto.","returnsText":"Entre em contato com a loja para tratar de trocas ou devoluções. Informe os itens do pedido e a data da compra para facilitar o atendimento.","footerText":"Artesanato feito à mão."}'::jsonb);

commit;

begin;

alter table public.shop_orders add column customer_email text not null default '', add column customer_phone text not null default '';
alter table shop_private.owner enable row level security;
alter table shop_private.registration_config enable row level security;
alter table shop_private.registration_quota enable row level security;
grant usage on schema shop_private to service_role;

alter function public.shop_admin_state() set schema shop_private;
alter function public.shop_activate_owner(text) set schema shop_private;
alter function public.shop_registration_gate(text,boolean) set schema shop_private;
alter function public.shop_place_order(uuid,text,text,text,text,jsonb,bigint,bigint) set schema shop_private;

create or replace function shop_private.shop_place_order(
  p_key uuid, p_name text, p_method text, p_cep text, p_note text,
  p_entries jsonb, p_subtotal bigint, p_freight bigint
) returns public.shop_orders
language plpgsql security definer set search_path = ''
as $$
declare
  customer uuid := auth.uid();
  existing public.shop_orders;
  contact public.shop_profiles;
  config jsonb;
  entry jsonb;
  product jsonb;
  variant jsonb;
  entry_key text;
  inventory_key text;
  quantities jsonb := '{}';
  reference_code text;
  reference_path text;
  customizable_plaque boolean;
  plaque_product boolean;
  seen text[] := '{}';
  quantity integer;
  unit_price bigint;
  stock integer;
  label text;
  amount bigint := 0;
  shipping bigint;
  entries jsonb := '[]';
  postal text := regexp_replace(coalesce(p_cep, ''), '[^0-9]', '', 'g');
begin
  if customer is null or p_key is null then raise exception 'shop_signin'; end if;
  select * into existing from public.shop_orders where customer_id = customer and idempotency_key = p_key;
  if found then return existing; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 100 or char_length(coalesce(p_note, '')) > 500
     or p_method is null or p_method not in ('delivery','pickup') or (p_method = 'delivery' and length(postal) <> 8)
     or p_entries is null or jsonb_typeof(p_entries) <> 'array' then raise exception 'shop_invalid_order'; end if;
  if jsonb_array_length(p_entries) not between 1 and 40 then raise exception 'shop_invalid_order'; end if;

  select body into config from public.shop_config where id = 1;
  if config is null or not coalesce((config->>p_method)::boolean, false) then raise exception 'shop_changed'; end if;

  for entry in select value from jsonb_array_elements(p_entries) loop
    if coalesce(entry->>'productId','') !~ '^[a-zA-Z0-9_-]{1,120}$'
       or coalesce(entry->>'quantity','') !~ '^[1-9][0-9]?$' then raise exception 'shop_invalid_order'; end if;
    reference_code := entry->>'reference';
    if reference_code is not null and reference_code !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
      then raise exception 'shop_invalid_order'; end if;
    inventory_key := (entry->>'productId') || ':' || coalesce(entry->>'variantId','');
    entry_key := inventory_key || ':' || coalesce(reference_code, '');
    if entry_key = any(seen) then raise exception 'shop_invalid_order'; end if;
    seen := array_append(seen, entry_key);
    quantity := (entry->>'quantity')::integer;

    select body into product from public.shop_products where id = entry->>'productId' and body->>'active' = 'true';
    if not found then raise exception 'shop_changed'; end if;

    customizable_plaque := (product->'customizablePlaque') is not distinct from 'true'::jsonb;
    plaque_product := customizable_plaque or coalesce(product->'categories' ?| array['placa', 'placa-redonda'], false)
      or coalesce(product->>'preview' = 'wooden-plaque', false);
    variant := null;
    label := '';
    if jsonb_array_length(coalesce(product->'variants', '[]'::jsonb)) > 0 then
      select value into variant from jsonb_array_elements(product->'variants')
        where value->>'id' = entry->>'variantId' and value->>'active' = 'true';
      if not found then raise exception 'shop_changed'; end if;
      select coalesce(string_agg(coalesce(product->'variantNames'->>((n - 1)::int), 'Opção') || ': ' || value, ' · ' order by n), '')
        into label from jsonb_array_elements_text(variant->'values') with ordinality as options(value, n);
    elsif entry->>'variantId' is not null then raise exception 'shop_changed';
    end if;
    stock := least(99, coalesce((variant->>'stock')::integer, (product->>'stock')::integer, 99));
    quantities := jsonb_set(quantities, array[inventory_key], to_jsonb(coalesce((quantities->>inventory_key)::int, 0) + quantity));
    if stock < (quantities->>inventory_key)::int then raise exception 'shop_changed'; end if;
    unit_price := coalesce((variant->>'price')::bigint, (product->>'price')::bigint);
    if unit_price is null or unit_price < 0 or (plaque_product and unit_price = 0) then raise exception 'shop_changed'; end if;

    if reference_code is not null then
      if not customizable_plaque then raise exception 'shop_reference_unavailable'; end if;
      reference_path := customer::text || '/' || (entry->>'productId') || '/' || coalesce(variant->>'id', 'padrao') || '/' || reference_code;
      if not exists (select 1 from storage.objects as reference
                     where reference.bucket_id = 'loja-placa-referencias' and reference.name = reference_path)
        then raise exception 'shop_reference_unavailable'; end if;
    end if;
    amount := amount + unit_price * quantity;
    entries := entries || jsonb_build_array(jsonb_build_object(
      'name', product->>'name', 'option', label, 'quantity', quantity, 'price', unit_price
    ) || case when reference_code is null then '{}'::jsonb else jsonb_build_object('reference', reference_code) end);
  end loop;

  shipping := case when p_method = 'pickup' or amount >= (config->>'freeOver')::bigint then 0
                   when config->>'shippingType' = 'flat' then (config->>'shippingCost')::bigint
                   else null end;
  if amount is distinct from p_subtotal or shipping is distinct from p_freight then raise exception 'shop_changed'; end if;
  select * into contact from public.shop_profiles where user_id = customer;
  insert into public.shop_orders (customer_id, idempotency_key, name, method, cep, note, lines, subtotal, freight, total, customer_email, customer_phone)
    values (customer, p_key, btrim(p_name), p_method, case when p_method = 'pickup' then '' else postal end,
            coalesce(btrim(p_note), ''), entries, amount, shipping, amount + shipping, coalesce(contact.email, ''), coalesce(contact.phone, ''))
    on conflict (customer_id, idempotency_key) do nothing returning * into existing;
  if not found then
    select * into existing from public.shop_orders where customer_id = customer and idempotency_key = p_key;
  end if;
  return existing;
end
$$;
create function public.shop_admin_state() returns text
language sql stable security invoker set search_path = ''
as $$ select shop_private.shop_admin_state() $$;
revoke all on function public.shop_admin_state() from public, anon;
grant execute on function public.shop_admin_state() to authenticated;

create function public.shop_activate_owner(p_code text) returns boolean
language sql security invoker set search_path = ''
as $$ select shop_private.shop_activate_owner(p_code) $$;
revoke all on function public.shop_activate_owner(text) from public, anon;
grant execute on function public.shop_activate_owner(text) to authenticated;

create function public.shop_registration_gate(p_digest text, p_count boolean) returns boolean
language sql security invoker set search_path = ''
as $$ select shop_private.shop_registration_gate(p_digest, p_count) $$;
revoke all on function public.shop_registration_gate(text,boolean) from public, anon, authenticated;
grant execute on function public.shop_registration_gate(text,boolean) to service_role;

create function public.shop_place_order(
  p_key uuid, p_name text, p_method text, p_cep text, p_note text, p_entries jsonb, p_subtotal bigint, p_freight bigint
) returns public.shop_orders
language sql security invoker set search_path = ''
as $$
  select shop_private.shop_place_order(p_key,p_name,p_method,p_cep,p_note,p_entries,p_subtotal,p_freight)
$$;
revoke all on function public.shop_place_order(uuid,text,text,text,text,jsonb,bigint,bigint) from public, anon;
grant execute on function public.shop_place_order(uuid,text,text,text,text,jsonb,bigint,bigint) to authenticated;

commit;
