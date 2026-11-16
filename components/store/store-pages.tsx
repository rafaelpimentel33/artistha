"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Camera, ChevronLeft, ChevronRight, Mail, MessageCircle, Pause, Play } from "lucide-react";
import { aboutPortrait } from "../../lib/about";
import { categoryHref, hasPlaquePreview, initialVariant, isPlaqueProduct, isSizeOption, money, normalize, plaqueSizes, productHref, productPrice, purchaseLimit, unitPrice, whatsappHref, type Category, type HomeSection, type Product, type StoreConfig, type Variant } from "../../lib/store-model";
import { PlaquePurchase } from "./plaque-reference";
import { ProductGallery } from "./product-gallery";
import { Arrows, Photo, ProductCard, ProductCardPrice, PurchaseAction } from "./store-ui";

type Add = (product: Product, variant?: Variant, quantity?: number, reference?: string) => void;

export function Hero({ config }: { config: StoreConfig }) {
  const slides = config.banners;
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [rotation, setRotation] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(true);
  const canRotate = config.bannerAuto && slides.length > 1;
  const rotating = canRotate && (rotation ?? !reducedMotion);
  const move = (step: number) => setIndex((current) => (current + step + slides.length) % slides.length);

  useEffect(() => {
    if (!canRotate) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, [canRotate]);

  useEffect(() => {
    if (!rotating || hovered) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % slides.length), 8500);
    return () => window.clearInterval(timer);
  }, [rotating, hovered, slides.length]);
  const slide = slides[index];
  if (!slide) return null;
  const desktop = slide.desktop || slide.mobile;
  const mobileLink = slide.mobileHref || slide.href;
  return <section className="hero" aria-label="Coleções da loja" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocus={(event) => { if (!event.target.closest(".banner-rotation")) setRotation(false); }}>
    <div className={`hero-image${slide.mobile ? " has-mobile-banner" : ""}`}>
      <picture>
        {slide.mobile && <source media="(max-width: 760px)" srcSet={slide.mobile} />}
        <img src={desktop} alt={slide.label} loading="lazy" decoding="async" />
      </picture>
      {slide.href && <a href={slide.href} className="hero-link hero-desktop" aria-label={slide.label} />}
      {mobileLink && <a href={mobileLink} className="hero-link hero-mobile" aria-label={slide.label} />}
    </div>
    <Arrows label="Banner" position={index + 1} total={slides.length} back={() => move(-1)} forward={() => move(1)} announce={!rotating || hovered}>
      {canRotate && <button className="icon-button banner-rotation" type="button"
        aria-label={rotating ? "Pausar banners" : "Reproduzir banners"} onClick={() => setRotation(!rotating)}>
        {rotating ? <Pause size={17} /> : <Play size={17} />}
      </button>}
    </Arrows>
  </section>;
}

function ProductRail({ title, products, add, config }: { title: string; products: Product[]; add: Add; config: StoreConfig }) {
  const [start, setStart] = useState(0);
  if (!products.length || !title) return null;
  const move = (step: number) => setStart((value) => (value + step + products.length) % products.length);
  const shown = Array.from({ length: Math.min(4, products.length) }, (_, offset) => products[(start + offset) % products.length]);
  return <section className="home-shell product-rail" aria-label={title}>
    <div className="home-section-heading">
      <h2>{title}</h2>
      <a href="/produtos" className="home-text-link">Ver todas as peças <ArrowUpRight size={17} aria-hidden="true" /></a>
    </div>
    <div className="product-grid rail-grid">{shown.map((product) => <ProductCard key={product.id} product={product} add={add} freeOver={config.freeOver} />)}</div>
    {products.length > shown.length &&
      <Arrows label="Produto" position={start + 1} total={products.length} back={() => move(-1)} forward={() => move(1)} />}
  </section>;
}

function HomeIntro({ config, product }: { config: StoreConfig; product?: Product }) {
  const round = product && hasPlaquePreview(product);
  const artwork = (round && product.plaque?.frontImage) || product?.images[0] || "/referencia/artistha-contato-pintura.webp";
  return <section className="home-shell home-intro" aria-labelledby="home-title">
    <div className="home-intro-copy">
      <h1 id="home-title">{config.introTitle || config.name}</h1>
      {config.introText && <p>{config.introText}</p>}
      <div className="home-intro-actions">
        <a className="button" href="/produtos">Explorar as peças <ArrowRight size={18} aria-hidden="true" /></a>
        <a className="home-text-link" href="/quem-somos">Conheça o ateliê <ArrowUpRight size={16} aria-hidden="true" /></a>
      </div>
    </div>
    <div className={`home-intro-art${round ? " home-intro-art-round" : ""}`}>
      {product
        ? <a className="home-intro-piece" href={productHref(product)} aria-label={`Ver a peça ${product.name}`}>
            <Photo src={artwork} eager />
            <span>{product.name} <ArrowUpRight size={18} aria-hidden="true" /></span>
          </a>
        : <Photo src={artwork} alt="Uma placa da ArtisTha sendo pintada à mão" eager />}
    </div>
  </section>;
}

function HomeCollections({ categories, products }: { categories: Category[]; products: Product[] }) {
  const cards = categories.flatMap((category) => {
    const product = products.find((item) => item.categories.includes(category.id) && item.images[0]);
    if (!product) return [];
    const picture = (hasPlaquePreview(product) && product.plaque?.frontImage) || product.images[0];
    return [{ category, picture }];
  }).slice(0, 3);
  if (!cards.length) return null;
  return <section className="home-shell home-collections" aria-labelledby="home-categories-title">
    <h2 id="home-categories-title">Explore por categoria</h2>
    <div className="home-collections-grid">
      {cards.map(({ category, picture }) => <a key={category.id} className="home-collection" href={categoryHref(category.id)}>
        <div className="home-collection-art"><Photo src={picture} /></div>
        <div className="home-collection-label"><h3>{category.name}</h3><ArrowUpRight size={19} aria-hidden="true" /></div>
      </a>)}
    </div>
  </section>;
}

export function Home({ config, products, add }: { config: StoreConfig; products: Product[]; add: Add }) {
  const rails = {
    new: products.filter((product) => product.tags.includes("new")),
    featured: products.filter((product) => product.tags.includes("featured")),
    sale: products.filter((product) => product.tags.includes("sale")),
  };
  const spotlight = products.find((product) => product.id === config.featuredId);
  const lead = [spotlight, ...products].find((product) => product?.images.length && productPrice(product).available)
    ?? products.find((product) => product.images.length);
  const sections: Record<HomeSection, ReactNode> = {
    intro: <><HomeIntro config={config} product={lead} /><HomeCollections categories={config.categories} products={products} /></>,
    new: <ProductRail title={config.railTitles.new} products={rails.new} config={config} add={add} />,
    featured: <ProductRail title={config.railTitles.featured} products={rails.featured} config={config} add={add} />,
    sale: <ProductRail title={config.railTitles.sale} products={rails.sale} config={config} add={add} />,
    materials: (config.materialsText || config.materialsTitle) && <section className="home-shell home-atelier">
      <Photo src="/referencia/thalia-retrato-faceless.webp" alt="Retrato ilustrado de quem faz a ArtisTha" />
      <div>
        {config.materialsTitle && <h2>{config.materialsTitle}</h2>}
        {config.materialsText && <p>{config.materialsText}</p>}
        <a href="/quem-somos" className="home-text-link">Quem faz a ArtisTha <ArrowUpRight size={17} aria-hidden="true" /></a>
      </div>
    </section>,
    spotlight: spotlight && <section className="wrap spotlight">
      <Gallery key={spotlight.id} product={spotlight} />
      <div className="spotlight-copy"><h2>{spotlight.name}</h2>{isPlaqueProduct(spotlight) ? <ProductCardPrice product={spotlight} /> : <ProductPurchase product={spotlight} add={add} />}<p className="long-copy">{spotlight.description}</p><a className="button small" href={productHref(spotlight)}>{isPlaqueProduct(spotlight) && productPrice(spotlight).available ? "Comprar" : "Ver detalhes"} <ArrowRight size={16} /></a></div>
    </section>,
    promo: (config.promoImage || config.promoText) && <section className="promo-section">
      {config.promoText && <h2 className="wrap">{config.promoText}</h2>}
      {config.promoImage && (config.promoHref ? <a href={config.promoHref}><Photo src={config.promoImage} alt="Destaque do ateliê" /></a> : <Photo src={config.promoImage} alt="Destaque do ateliê" />)}
    </section>,
  };

  return <>
    {!config.sections.includes("intro") && <h1 className="visually-hidden">{config.name}</h1>}
    <Hero config={config} />
    {config.sections.map((section) => <div key={section}>{sections[section]}</div>)}
  </>;
}

const perPage = 12;

export function matchingProducts(products: Product[], categories: Category[], query: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return products;
  const labels = new Map(categories.map((category) => [category.id, category.name]));
  return products.filter((product) => {
    const haystack = normalize([product.name, product.description, ...product.categories.map((category) => labels.get(category) || category)].join(" "));
    return words.every((word) => haystack.includes(word));
  });
}

export function Catalog({ config, products, category, search, add }: {
  config: StoreConfig; products: Product[]; category: string; search: string; add: Add;
}) {
  const [sort, setSort] = useState("default");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [option, setOption] = useState("");
  const [page, setPage] = useState(0);
  const group = config.categories.find((item) => item.id === category);
  const base = useMemo(() => matchingProducts(products.filter((product) => !group || product.categories.includes(group.id)), config.categories, search), [products, group, config.categories, search]);
  const optionValues = useMemo(() => {
    const options = new Map<string, string>();
    for (const product of base) {
      for (const [index, label] of product.variantNames.entries()) {
        const key = isSizeOption(label) ? "tamanho" : normalize(label);
        if (key !== "cor" && key !== "tamanho") continue;
        for (const value of new Set(product.variants.map((variant) => variant.values[index]).filter(Boolean))) {
          options.set(key + "|" + normalize(value), label + " · " + value);
        }
      }
    }
    return [...options].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [base]);
  const [optionName, optionValue] = option.split("|");
  const list = base.filter((product) => {
    if (onlyAvailable && !productPrice(product).available) return false;
    if (!option) return true;
    const index = product.variantNames.findIndex((name) => optionName === "tamanho" ? isSizeOption(name) : normalize(name) === optionName);
    return index >= 0 && product.variants.some((variant) => normalize(variant.values[index] || "") === optionValue && (!onlyAvailable || purchaseLimit(product, variant) > 0));
  });
  if (sort === "price-asc" || sort === "price-desc") {
    const direction = sort === "price-asc" ? 1 : -1;
    const prices = new Map(list.map((product) => [product.id, productPrice(product).min]));
    list.sort((a, b) => direction * ((prices.get(a.id) ?? 0) - (prices.get(b.id) ?? 0)));
  }
  if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  if (sort === "new") list.sort((a, b) => Number(b.tags.includes("new")) - Number(a.tags.includes("new")));
  const count = Math.ceil(list.length / perPage);
  const categoryUrl = (id: string) => {
    const href = id ? categoryHref(id) : "/produtos";
    return search ? href + (id ? "&" : "?") + "busca=" + encodeURIComponent(search) : href;
  };
  const goPage = (index: number) => {
    setPage(index);
    document.getElementById("catalog-results")?.scrollIntoView({ block: "start" });
  };

  return <div className="wrap catalog">
    <div className="breadcrumb"><a href="/">Início</a><ChevronRight size={13} /><a href="/produtos">Produtos</a>{group && <><ChevronRight size={13} /><span>{group.name}</span></>}</div>
    <h1>{search ? `Busca por “${search}”` : group?.name || "Produtos"}</h1>
    <div className="catalog-layout">
      <aside className="catalog-sidebar">
        <h2>Categorias</h2>
        <nav aria-label="Categorias de produtos">
          <a href={categoryUrl("")} aria-current={!group ? "page" : undefined}>Todos os produtos</a>
          {config.categories.map((item) => <a href={categoryUrl(item.id)} key={item.id} aria-current={group?.id === item.id ? "page" : undefined}>{item.name}</a>)}
        </nav>
      </aside>
      <section id="catalog-results" className="catalog-results" aria-label="Resultados">
        <div className="catalog-filters">
          <label className="category-mobile">Categoria<select value={group?.id || ""} onChange={(event) => { window.location.assign(categoryUrl(event.target.value)); }}><option value="">Todas</option>{config.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {optionValues.length > 0 && <label>Variação<select value={option} onChange={(event) => { setPage(0); setOption(event.target.value); }}><option value="">Todas</option>{optionValues.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
          <label>Ordenar por<select value={sort} onChange={(event) => { setPage(0); setSort(event.target.value); }}><option value="default">Relevância</option><option value="new">Lançamentos</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="name">Nome A–Z</option></select></label>
          <label className="check-inline"><input type="checkbox" checked={onlyAvailable} onChange={(event) => { setOnlyAvailable(event.target.checked); setPage(0); }} /> Disponíveis</label>
        </div>
        <p className={list.length ? "result-count" : "visually-hidden"} aria-live="polite">{list.length} {list.length === 1 ? "produto" : "produtos"}</p>
        {list.length ? <div className="product-grid catalog-grid">{list.slice(page * perPage, (page + 1) * perPage).map((product) => <ProductCard key={product.id} product={product} add={add} freeOver={config.freeOver} />)}</div>
          : <div className="empty-results"><h2>{products.length ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}</h2>{products.length > 0 && <a className="text-link" href="/produtos">Ver todos os produtos</a>}</div>}
        {count > 1 && <nav className="pagination" aria-label="Páginas de produtos">
          <button className="icon-button" aria-label="Página anterior" disabled={page === 0} onClick={() => goPage(page - 1)}><ChevronLeft size={18} /></button>
          <span>Página {page + 1} de {count}</span>
          <button className="icon-button" aria-label="Próxima página" disabled={page + 1 === count} onClick={() => goPage(page + 1)}><ChevronRight size={18} /></button>
        </nav>}
      </section>
    </div>
  </div>;
}

function Gallery({ product, eager = false }: { product: Product; eager?: boolean }) {
  const [image, setImage] = useState(0);
  const total = product.images.length;
  return <div className="gallery">
    <div className="gallery-main">
      <Photo src={product.images[image]} alt={product.name} eager={eager} />
      {total > 1 && <><button className="icon-button gallery-prev" aria-label="Foto anterior" onClick={() => setImage((image + total - 1) % total)}><ChevronLeft size={22} /></button>
        <button className="icon-button gallery-next" aria-label="Próxima foto" onClick={() => setImage((image + 1) % total)}><ChevronRight size={22} /></button></>}
    </div>
    {total > 1 && <div className="gallery-thumbnails" aria-label="Fotos do produto">{product.images.map((src, index) =>
      <button key={src + index} aria-label={`Foto ${index + 1}`} aria-pressed={image === index} onClick={() => setImage(index)}><Photo src={src} /></button>)}</div>}
  </div>;
}

function PurchasePrice({ product, selected }: { product: Product; selected?: Variant }) {
  const price = unitPrice(product, selected);
  return <div className="detail-price" aria-live="polite">{isPlaqueProduct(product) && price <= 0
    ? "Preço ainda não cadastrado"
    : <>{money(price)}{product.comparePrice && product.comparePrice > price && <del>{money(product.comparePrice)}</del>}</>}</div>;
}

const diameterFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function plaqueDiameter(product: Product, variant: Variant) {
  const size = variant.values[product.variantNames.findIndex(isSizeOption)];
  const label = size?.match(/(?:^|[·Ø]\s*)(\d+(?:[,.]\d+)?)\s*cm$/i);
  const diameter = label ? Number(label[1].replace(",", ".")) : plaqueSizes.find(({ id }) => id === variant.id)?.diameter;
  return diameter && Number.isFinite(diameter) ? diameter : undefined;
}

function plaqueScale(product: Product, selected?: Variant) {
  if (!selected) return 1;
  const diameter = plaqueDiameter(product, selected);
  if (!diameter) return 1;
  const largest = Math.max(diameter, ...product.variants.map((variant) => plaqueDiameter(product, variant) ?? 0));
  return Math.max(0.36, diameter / largest);
}

function useProductSelection(product: Product, initialSize?: string) {
  const [variantId, setVariantId] = useState(() => initialVariant(product, initialSize)?.id);
  const [quantity, setQuantity] = useState(1);
  const selected = product.variants.find((variant) => variant.id === variantId);
  const limit = product.variants.length && !selected ? 0 : purchaseLimit(product, selected);

  function select(variant: Variant) {
    setVariantId(variant.id);
    setQuantity(1);
  }

  return { selected, limit, quantity, setQuantity, select };
}

function VariantOptions({ product, selected, disabled = false, select }: { product: Product; selected?: Variant; disabled?: boolean; select: (option: Variant) => void }) {
  if (!product.variants.length) return null;
  const choices = selected?.values ?? [];
  return <div className="detail-options">
    {product.variantNames.map((name, index) => {
      const options = new Map<string, Variant>();
      for (const variant of product.variants) {
        const value = variant.values[index];
        if (!value || !variant.values.slice(0, index).every((part, position) => part === choices[position])) continue;
        const current = options.get(value);
        if (!current || (!purchaseLimit(product, current) && purchaseLimit(product, variant))) options.set(value, variant);
      }

      if (isSizeOption(name)) return <fieldset className="plaque-sizes" key={index} disabled={disabled}>
        <legend className="visually-hidden">{name}</legend>
        <div className="plaque-size-options">
          {[...options].map(([value, variant]) => {
            const short = value.match(/^(\d+(?:[,.]\d+)?)\s*(cm|mm|m)$/i);
            return <label key={value}>
              <input className="visually-hidden" type="radio" name={`size-${product.id}-${index}`}
                value={value} checked={choices[index] === value} onChange={() => select(variant)} />
              <span className={short ? "size-circle" : undefined}>
                {short ? <>{short[1]} <small>{short[2]}</small></> : value}
              </span>
            </label>;
          })}
        </div>
      </fieldset>;

      return <label key={index}>{name}<select value={choices[index] ?? ""} disabled={disabled} onChange={(event) => {
        const variant = options.get(event.target.value);
        if (variant) select(variant);
      }}>
        {[...options.keys()].map((value) => <option key={value}>{value}</option>)}
      </select></label>;
    })}
  </div>;
}

function ProductPurchase({ product, add }: { product: Product; add: Add }) {
  const { selected, limit, quantity, setQuantity, select } = useProductSelection(product);
  return <>
    <PurchasePrice product={product} selected={selected} />
    <VariantOptions product={product} selected={selected} select={select} />
    <PurchaseAction limit={limit} quantity={quantity} setQuantity={setQuantity} onBuy={() => add(product, selected, quantity)} />
  </>;
}

export function ProductPage({ product, products, config, add, signedIn = false, initialSize }: { product: Product; products: Product[]; config: StoreConfig; add: Add; signedIn?: boolean; initialSize?: string }) {
  const category = config.categories.find((item) => product.categories.includes(item.id));
  const { selected, limit, quantity, setQuantity, select } = useProductSelection(product, initialSize);
  const [uploading, setUploading] = useState(false);
  const plaque = isPlaqueProduct(product);
  const preview = hasPlaquePreview(product);
  const diameter = product.plaque?.diameter;
  const related = useMemo(() => products.filter((item) => item.active && item.id !== product.id).map((item) => ({
    item, rank: Number(productPrice(item).available) * 2 + Number(item.categories.some((id) => product.categories.includes(id))),
  })).sort((a, b) => b.rank - a.rank).slice(0, 3), [products, product.categories, product.id]);
  const details = <>
    <div className="detail-title">
      <h1 id="product-title">{product.name}</h1>
      <PurchasePrice product={product} selected={selected} />
    </div>
    <div className="detail-info">
      <VariantOptions product={product} selected={selected} select={select} disabled={uploading} />
      {(plaque || preview) && !product.variantNames.length && <p className="muted detail-diameter">
        {diameter ? `Diâmetro ${diameterFormat.format(diameter)} cm` : "Tamanho único"}
      </p>}
      {product.customizablePlaque === true
        ? <PlaquePurchase product={product} selected={selected} signedIn={signedIn} limit={limit} quantity={quantity}
          setQuantity={setQuantity} onUploadChange={setUploading} onBuy={(reference) => add(product, selected, quantity, reference)} />
        : <PurchaseAction limit={limit} quantity={quantity} setQuantity={setQuantity} label="Comprar" onBuy={() => add(product, selected, quantity)} />}
    </div>
  </>;
  return <div className="wrap detail-page">
    <nav className="breadcrumb" aria-label="Caminho do produto"><a href="/">Início</a><ChevronRight size={13} aria-hidden="true" /><a href="/produtos">Produtos</a>{category && <><ChevronRight size={13} aria-hidden="true" /><a href={categoryHref(category.id)}>{category.name}</a></>}<ChevronRight size={13} aria-hidden="true" /><span aria-current="page">{product.name}</span></nav>
    <div className="detail-layout">
      <ProductGallery product={product} scale={preview ? plaqueScale(product, selected) : 1} details={details}>
        {product.description && <section className="detail-description"><h2>Descrição</h2><p className="long-copy">{product.description}</p></section>}
      </ProductGallery>
    </div>
    {related.length > 0 && <section className="related-products" aria-labelledby="related-products-title">
      <h2 id="related-products-title">Outros produtos</h2>
      <div className="product-grid">{related.map(({ item }) => <ProductCard key={item.id} product={item} add={add} freeOver={config.freeOver} />)}</div>
    </section>}
  </div>;
}

export function AboutPage({ config }: { config: StoreConfig }) {
  const { aboutTitle, aboutText } = config;
  const paragraphs = aboutText.trim().split(/\r?\n\s*\r?\n/).filter(Boolean);
  return <article className="about-page">
    <div className="breadcrumb"><a href="/">Início</a><ChevronRight size={13} /><span>{aboutTitle}</span></div>
    <div className="about-layout">
      <h1>{aboutTitle === "Quem faz" ? <>Quem <em>faz</em></> : aboutTitle}</h1>
      <img className="about-portrait" {...aboutPortrait} fetchPriority="high" decoding="async" />
      <div className="about-copy">
        {paragraphs.map((paragraph, index) => <p className="long-copy" key={index}>{paragraph}</p>)}
        <a className="button" href="/produtos">Ver as peças <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
    </div>
  </article>;
}

export function ContactPage({ config: { whatsapp, contactEmail, instagram } }: { config: StoreConfig }) {
  return <article className="contact-page">
    <div className="breadcrumb"><a href="/">Início</a><ChevronRight size={13} aria-hidden="true" /><span>Contato</span></div>
    <div className="contact-layout">
      <div className="contact-copy">
        <h1>Vamos <em>conversar?</em></h1>
        <p className="contact-lead">Me conta o que você quer transformar em pintura.</p>
        <p className="contact-note">Se tiver uma foto de referência, pode mandar na conversa. Também estou por aqui para tirar dúvidas sobre encomendas e entregas.</p>
        <div className="contact-actions">
          {whatsapp && <a className="button" href={whatsappHref(whatsapp)} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={19} aria-hidden="true" /> Conversar no WhatsApp
          </a>}
          {(contactEmail || instagram) && <div className="contact-links">
            {contactEmail && <a className="text-link" href={`mailto:${contactEmail}`}>
              <Mail size={18} aria-hidden="true" /> <span>{contactEmail}</span>
            </a>}
            {instagram && <a className="text-link" href={`https://www.instagram.com/${instagram}/`} target="_blank" rel="noopener noreferrer">
              <Camera size={18} aria-hidden="true" /> Instagram
            </a>}
          </div>}
          {!whatsapp && !contactEmail && !instagram && <p className="muted">O atendimento está em configuração.</p>}
        </div>
      </div>
      <img className="contact-artwork" src="/referencia/artistha-contato-pintura.webp"
        alt="Ilustração de uma mão pintando folhas em uma placa redonda com duas pessoas e flores"
        width={896} height={896} fetchPriority="high" decoding="async" />
    </div>
  </article>;
}
