insert into public.shop_products (id, slug, body)
values (
  'placa-personalizavel',
  'placa-personalizavel',
  $product$
  {
    "id": "placa-personalizavel",
    "slug": "placa-personalizavel",
    "name": "Placa Personalizável",
    "description": "Placa redonda de madeira feita sob encomenda. Envie uma imagem de referência para a confecção.",
    "images": ["/referencia/placa-personalizavel.webp"],
    "categories": ["placa"],
    "price": 0,
    "comparePrice": null,
    "stock": null,
    "variantNames": [],
    "variants": [],
    "tags": ["new"],
    "active": true,
    "preview": "wooden-plaque",
    "customizablePlaque": true
  }
  $product$::jsonb
)
on conflict (slug) do nothing
returning id, slug, body->>'name' as name;
