begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('loja-placa-referencias', 'loja-placa-referencias', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from storage.buckets where id = 'loja-placa-referencias' and public = false
      and file_size_limit = 4194304 and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']
      and allowed_mime_types <@ array['image/jpeg', 'image/png', 'image/webp']
  ) then
    raise exception 'O armazenamento de referências da placa deve ser privado e aceitar apenas imagens de até 4 MB.';
  end if;
end;
$$;

drop policy if exists shop_plaque_reference_upload on storage.objects;
create policy shop_plaque_reference_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'loja-placa-referencias'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and name ~ '^[a-f0-9-]{36}/[a-zA-Z0-9_-]{1,120}/[a-zA-Z0-9_-]{1,120}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  and exists (
    select 1 from public.shop_products as product
    where product.id = split_part(storage.objects.name, '/', 2)
      and product.body->>'active' = 'true'
      and product.body->'customizablePlaque' = 'true'::jsonb
      and case
        when jsonb_array_length(product.body->'variants') = 0 then
          split_part(storage.objects.name, '/', 3) = 'padrao'
          and coalesce((product.body->>'stock')::int, 1) > 0
          and (product.body->>'price')::bigint > 0
        else exists (
          select 1 from jsonb_array_elements(product.body->'variants') as variant(body)
          where variant.body->>'id' = split_part(storage.objects.name, '/', 3) and variant.body->>'active' = 'true'
            and coalesce((variant.body->>'stock')::int, (product.body->>'stock')::int, 1) > 0
            and coalesce((variant.body->>'price')::bigint, (product.body->>'price')::bigint) > 0
        )
      end
  )
);

drop policy if exists shop_plaque_reference_read on storage.objects;
create policy shop_plaque_reference_read on storage.objects for select to authenticated
using (bucket_id = 'loja-placa-referencias' and (select shop_private.is_admin()));

create or replace function public.shop_list_plaque_references(p_page integer, p_search text)
returns table (path text, reference text, product text, option text, "createdAt" timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select object.name, split_part(object.name, '/', 4),
    coalesce(item.body->>'name', split_part(object.name, '/', 2)),
    coalesce(size.label, nullif(split_part(object.name, '/', 3), 'padrao'), ''), object.created_at
  from storage.objects as object
  left join public.shop_products as item on item.id = split_part(object.name, '/', 2)
  left join lateral (
    select string_agg(value, ' · ' order by position) as label
    from jsonb_array_elements(item.body->'variants') as variant(body)
    cross join lateral jsonb_array_elements_text(variant.body->'values') with ordinality as values_at(value, position)
    where variant.body->>'id' = split_part(object.name, '/', 3)
  ) as size on true
  where object.bucket_id = 'loja-placa-referencias' and (select shop_private.is_admin())
    and split_part(object.name, '/', 4) like coalesce(p_search, '') || '%'
  order by object.created_at desc, object.name desc
  limit 26 offset (greatest(0, least(coalesce(p_page, 0), 100000)) * 25)
$$;
revoke all on function public.shop_list_plaque_references(integer, text) from public, anon, authenticated;
grant execute on function public.shop_list_plaque_references(integer, text) to authenticated;

update public.shop_config
set body = jsonb_set(body, '{categories}', coalesce(body->'categories', '[]'::jsonb) || '[{"id":"placa","name":"Placa"}]'::jsonb),
    revision = revision + 1
where id = 1 and not coalesce(body->'categories' @> '[{"id":"placa"}]'::jsonb, false);

update public.shop_products
set body = jsonb_set(body, '{categories}', coalesce(body->'categories', '[]'::jsonb) || '["placa-redonda"]'::jsonb),
    revision = revision + 1, updated_at = now()
where body->>'preview' = 'wooden-plaque'
  and not coalesce(body->'categories' ?| array['placa', 'placa-redonda'], false)
  and exists (select 1 from public.shop_config where id = 1 and body->'categories' @> '[{"id":"placa-redonda"}]'::jsonb);

update public.shop_products
set body = jsonb_set(body, '{description}', to_jsonb(
      case when body->'categories' ? 'placa' then 'Placa redonda de madeira feita sob encomenda. Envie uma imagem de referência para a confecção.'
      else 'Placa redonda de madeira feita sob encomenda. Escolha o diâmetro e envie uma imagem de referência para a confecção.' end)),
    revision = revision + 1, updated_at = now()
where slug = 'placa-personalizavel'
  and body->>'description' = 'Placa redonda de madeira feita sob encomenda. Escolha o tamanho e veja como sua arte fica na frente e no verso com a prévia em 3D.';

update public.shop_products
set body = body || '{"customizablePlaque":true}'::jsonb, revision = revision + 1, updated_at = now()
where id = 'placa-personalizavel' and not (body ? 'customizablePlaque');

commit;
