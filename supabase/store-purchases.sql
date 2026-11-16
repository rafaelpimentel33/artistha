begin;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'shop_plaque_reference_delete') then
    create policy shop_plaque_reference_delete on storage.objects for delete to authenticated
    using (bucket_id = 'loja-placa-referencias' and (select shop_private.is_admin()));
  end if;
end;
$$;

-- Retire newsletter settings while preserving the order of the other sections.
update public.shop_config
set body = jsonb_set(body - 'newsletterTitle' - 'newsletterText', '{sections}', coalesce(body->'sections', '[]'::jsonb) - 'newsletter'),
    revision = revision + 1
where id = 1 and (body ?| array['newsletterTitle', 'newsletterText'] or body->'sections' ? 'newsletter');

do $$
begin
  if to_regclass('public.shop_subscribers') is not null then
    revoke all privileges on table public.shop_subscribers from public, anon, authenticated;
    revoke insert (email) on table public.shop_subscribers from public, anon, authenticated;
  end if;
end;
$$;

update public.shop_products
set body = body - 'quoteOnly', revision = revision + 1, updated_at = now()
where body ? 'quoteOnly';

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

commit;
