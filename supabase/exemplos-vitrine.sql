begin;

with examples(position, slug, title, category, image, price, rail, page, accent, model, description) as (
  values
    (31, 'teste-mandala-mare-de-coral', 'Mandala Maré de Coral', 'mandalas', '/referencia/artistha-mandala-azul.webp', 29000, 'featured', '#f1ddd9', '#782c47', true, 'Pétalas em azul profundo e coral se alternam em camadas de pequenos pontos e flores.'),
    (32, 'teste-placa-lacos', 'Placa Laços', 'placa', '/referencia/artistha-contato-pintura.webp', 23000, 'featured', '#f4dfba', '#315545', false, 'Duas figuras sem traços faciais entre folhagens e flores claras, em um estudo sobre amizade.'),
    (33, 'teste-quadro-jardim-de-afetos', 'Quadro Jardim de Afetos', 'quadro', '/referencia/artistha-teste-jardim-de-afetos.webp', 32000, 'featured', '#f1d5cd', '#773f38', false, 'Retrato ilustrado de mãe e filha, com detalhes em coral e uma moldura em tom de madeira clara.'),
    (34, 'teste-mandala-raiz-verde', 'Mandala Raiz Verde', 'mandalas', '/referencia/artistha-teste-raiz-verde.webp', 27000, 'new', '#e3e6d1', '#365641', true, 'Uma mandala botânica em verde-sálvia, azul-petróleo e ocre, com desenho inspirado em folhas e sementes.'),
    (35, 'teste-mandala-sol-de-barro', 'Mandala Sol de Barro', 'mandalas', '/referencia/artistha-teste-sol-de-barro.webp', 28000, 'new', '#f4dec6', '#8c422a', false, 'Tons de terracota, ocre e marfim formam um sol pintado sobre a placa circular.'),
    (36, 'teste-placa-passaros-do-jardim', 'Placa Pássaros do Jardim', 'placa', '/referencia/artistha-teste-passaros-do-jardim.webp', 26000, 'new', '#dce5de', '#274e52', false, 'Pássaros em tons quentes entre folhas azuladas e flores sobre um fundo azul-noite.')
)
insert into public.shop_products (id, slug, position, body)
select slug, slug, position,
  jsonb_build_object(
    'id', slug, 'slug', slug, 'name', title || ' (teste)', 'categories', jsonb_build_array(category),
    'description', description || E'\n\nProduto de teste da vitrine. A imagem e o valor são demonstrativos.',
    'images', jsonb_build_array(image), 'price', price, 'comparePrice', null, 'stock', 0,
    'tags', jsonb_build_array(rail), 'active', true, 'showPlaquePreview', model, 'customizablePlaque', false,
    'backgroundPattern', 'floral', 'theme', jsonb_build_object('background', page, 'buttons', accent),
    'variantNames', case when model then '["Tamanho"]'::jsonb else '[]'::jsonb end,
    'variants', case when model then jsonb_build_array(
      jsonb_build_object('id', '30-cm', 'values', jsonb_build_array('30 cm'), 'price', price, 'stock', 0, 'active', true),
      jsonb_build_object('id', '40-cm', 'values', jsonb_build_array('40 cm'), 'price', price + 8000, 'stock', 0, 'active', true)
    ) else '[]'::jsonb end
  ) || case when model then jsonb_build_object('plaque', jsonb_build_object(
    'frontImage', image, 'backColor', '#9d603c', 'edgeColor', '#704329', 'fit', 'contain'
  )) else '{}'::jsonb end
from examples
on conflict do nothing;

update public.shop_config
set body = body || jsonb_build_object(
  'introTitle', 'Arte feita à mão para a sua casa.',
  'introText', 'Placas, mandalas e retratos ilustrados em cores que dão personalidade ao seu espaço.',
  'sections', '["intro", "featured", "new", "materials"]'::jsonb,
  'materialsTitle', 'Da inspiração à última pincelada',
  'materialsText', 'Cada peça nasce de um desenho e ganha cor aos poucos. Conheça a pessoa e as histórias por trás da ArtisTha.',
  'railTitles', body->'railTitles' || '{"featured":"Peças em destaque","new":"Estudos do ateliê"}'::jsonb
), revision = revision + 1
where id = 1
  and body->>'introTitle' = 'Produtos 100% artesanais'
  and body->'sections' = '["intro", "featured"]'::jsonb;

commit;
