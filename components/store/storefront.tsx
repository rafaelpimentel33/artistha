"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Menu, MessageCircle, Search, ShoppingBag, UserRound } from "lucide-react";
import { categoryHref, getCartLines, lineKey, plaqueReferenceCode, privacyPath, productHref, purchaseLimit, stockKey, whatsappHref, type CartEntry, type Product, type StoreData, type Variant } from "../../lib/store-model";
import { buttonForeground, defaultProductBackgroundPattern, pageForeground, productPageColors } from "../../lib/store-theme";
import { AboutPage, Catalog, ContactPage, Home, matchingProducts, ProductPage } from "./store-pages";
import { Panel, Photo, ProductCardPrice } from "./store-ui";
import { StoreOpening } from "./store-opening";

export type StorePage = { kind: "home" } | { kind: "catalog"; category: string; search: string }
  | { kind: "product"; id: string; signedIn?: boolean; initialSize?: string }
  | { kind: "contact" | "about" | "privacy" };
const Cart = dynamic(() => import("./store-cart").then((module) => module.Cart), {
  loading: () => <p className="panel-scroll muted" role="status">Carregando carrinho…</p>,
});
const cartStorage = "loja-artesanal:cart:v1";
const footerTagline = "Onde o seu jeito vira Arte";
const navigation = [
  { url: "/", label: "Início" }, { url: "/produtos", label: "Produtos" }, { url: "/contato", label: "Contato" },
  { url: "/quem-somos", label: "Quem Faz" },
];

function localCart(): CartEntry[] | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(cartStorage) || "[]");
    if (!Array.isArray(saved)) return [];
    const entries = saved.filter((entry): entry is CartEntry => Boolean(entry) && typeof entry === "object" &&
      typeof entry.productId === "string" && (entry.variantId === null || typeof entry.variantId === "string") &&
      Number.isInteger(entry.quantity) && entry.quantity > 0 && entry.quantity <= 99 &&
      (entry.reference === undefined || (typeof entry.reference === "string" && plaqueReferenceCode.test(entry.reference)))).slice(0, 40);
    return [...new Map(entries.map(({ productId, variantId, quantity, reference }) => {
      const entry = { productId, variantId, quantity, reference };
      return [lineKey(entry), entry];
    })).values()];
  } catch { return null; }
}

export function Storefront({ config, products, page, children }: StoreData & { page: StorePage; children?: ReactNode }) {
  const [panel, setPanel] = useState<"cart" | "search" | "menu" | null>(null);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartTitle, setCartTitle] = useState("Seu carrinho");
  const [cartNotice, setCartNotice] = useState("");
  const [search, setSearch] = useState(page.kind === "catalog" ? page.search : "");
  const [compact, setCompact] = useState(false);
  const [failedLogo, setFailedLogo] = useState("");
  const logoTintId = useId();
  const footerTintId = useId();
  const storeStart = useRef<HTMLDivElement>(null);
  const brand = useRef<HTMLAnchorElement>(null);
  const inMemoryCart = useRef<CartEntry[]>([]);
  const cartWriteFailed = useRef(false);
  const handledOrders = useRef(new Set<string>());
  const logo = failedLogo === config.logo ? "" : config.logo;

  useEffect(() => {
    const image = brand.current?.querySelector("img");
    if (logo && image?.complete && !image.naturalWidth) setFailedLogo(logo);
  }, [logo]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("carrinho") === "1") {
      setPanel("cart");
      const url = new URL(window.location.href);
      url.searchParams.delete("carrinho");
      window.history.replaceState(window.history.state, "", url);
    }
    const restoreCart = () => {
      if (cartWriteFailed.current) return;
      inMemoryCart.current = localCart() ?? inMemoryCart.current;
      setCart(inMemoryCart.current);
    };
    const sync = (event: StorageEvent) => {
      if (event.key === cartStorage || event.key === null) restoreCart();
    };
    const shrink = () => setCompact((storeStart.current?.getBoundingClientRect().top ?? -window.scrollY) < -400);
    window.addEventListener("storage", sync);
    window.addEventListener("pageshow", restoreCart);
    window.addEventListener("scroll", shrink, { passive: true });
    window.addEventListener("resize", shrink);
    restoreCart();
    shrink();
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("pageshow", restoreCart);
      window.removeEventListener("scroll", shrink);
      window.removeEventListener("resize", shrink);
    };
  }, []);
  const lines = useMemo(() => getCartLines(products, cart), [products, cart]);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const results = useMemo(() => panel === "search" && search.trim()
    ? matchingProducts(products, config.categories, search).slice(0, 5) : [], [panel, search, products, config.categories]);
  const activeProduct = page.kind === "product" ? products.find((item) => item.id === page.id) : undefined;
  const contactLink = config.whatsapp ? whatsappHref(config.whatsapp) : "/contato";
  const footerPhrase = config.footerText?.trim() || "";
  const usesBrandSignature = !footerPhrase || footerPhrase === "Artesanato feito à mão."
    || footerPhrase.toLocaleLowerCase("pt-BR") === footerTagline.toLocaleLowerCase("pt-BR");
  const headingFont = { zilla: '"Zilla Slab", Georgia, serif', georgia: 'Georgia, serif', sans: 'var(--body-font)' }[config.headingFont];
  const isAbout = page.kind === "about";
  const isContact = page.kind === "contact";
  const isCatalog = page.kind === "catalog";
  const hasArtTheme = isAbout || isContact || isCatalog;
  const productColors = activeProduct ? productPageColors(config, activeProduct.theme) : undefined;
  const tintLogo = productColors && (activeProduct?.theme?.logo || productColors.logo !== config.accent);
  const tintFooter = productColors && (activeProduct?.theme?.footerText || activeProduct?.theme?.footerBackground);
  const currentNavHref = isAbout ? "/quem-somos" : isContact ? "/contato" : isCatalog ? "/produtos" : page.kind === "home" ? "/" : undefined;
  const theme = {
    "--accent": productColors?.buttons ?? config.accent,
    "--page": hasArtTheme ? undefined : productColors?.background ?? config.background,
    "--on-accent": productColors?.buttonText ?? buttonForeground(config.accent),
    "--ink": hasArtTheme ? undefined : productColors?.text ?? pageForeground(config.background),
    "--product-title": activeProduct?.theme?.text ?? (activeProduct ? productColors?.logo : undefined),
    "--product-header-background": productColors?.headerBackground,
    "--product-header-color": productColors?.logo,
    "--product-announcement-background": productColors?.announcementBackground,
    "--product-announcement-text": productColors?.announcementText,
    "--product-footer-background": productColors?.footerBackground,
    "--product-footer-text": productColors?.footerText,
    "--logo-tint": tintLogo ? `url("#${logoTintId}")` : undefined,
    "--footer-tint": tintFooter ? `url("#${footerTintId}")` : undefined,
    "--body-font": config.bodyFont === "outfit" ? '"Outfit", system-ui, sans-serif' : 'system-ui, sans-serif',
    "--heading-font": headingFont,
  } as CSSProperties;

  function openCart(notice = "") {
    setCartNotice(notice);
    setCartTitle("Seu carrinho");
    setPanel("cart");
  }

  function currentCart() {
    return (cartWriteFailed.current ? null : localCart()) ?? inMemoryCart.current;
  }

  function saveCart(entries: CartEntry[]) {
    inMemoryCart.current = entries;
    setCart(entries);
    try {
      localStorage.setItem(cartStorage, JSON.stringify(entries));
      cartWriteFailed.current = false;
    } catch {
      cartWriteFailed.current = true;
    }
  }

  function change(entry: CartEntry, value: number) {
    const key = lineKey(entry);
    const current = currentCart();
    const updated = value === 0 ? current.filter((item) => lineKey(item) !== key)
      : current.map((item) => lineKey(item) === key ? { ...item, quantity: value } : item);
    saveCart(updated);
    setCartNotice("");
  }

  function add(product: Product, variant?: Variant, quantity = 1, reference?: string) {
    const limit = purchaseLimit(product, variant);
    if (limit < 1) return;
    const lines = getCartLines(products, currentCart());
    const entry: CartEntry = { productId: product.id, variantId: variant?.id ?? null, quantity: Math.min(quantity, limit), reference };
    const key = lineKey(entry);
    const current = lines.find((item) => lineKey(item) === key);
    const used = lines.filter((item) => stockKey(item) === stockKey(entry)).reduce((total, item) => total + item.quantity, 0);
    const remaining = limit - used;
    if (remaining < 1) { openCart("A quantidade disponível dessa opção já está no carrinho."); return; }
    if (!current && lines.length >= 40) { openCart("O carrinho comporta até 40 itens diferentes por pedido."); return; }
    const added = Math.min(entry.quantity, remaining);
    const existing = lines.map(({ productId, variantId, quantity: savedQuantity, reference }) => ({ productId, variantId, quantity: savedQuantity, reference }));
    const next = current
      ? existing.map((item) => lineKey(item) === key ? { ...item, quantity: current.quantity + added } : item)
      : [...existing, { ...entry, quantity: added }];
    saveCart(next);
    openCart(added < quantity ? "Quantidade limitada à disponibilidade da peça." : "Produto adicionado ao carrinho.");
  }

  function removePurchased(key: string, entries: CartEntry[]) {
    if (handledOrders.current.has(key)) return;
    handledOrders.current.add(key);
    const quantities = new Map(entries.map((item) => [lineKey(item), item.quantity]));
    const current = currentCart();
    saveCart(current.map((item) => ({ ...item, quantity: item.quantity - (quantities.get(lineKey(item)) ?? 0) }))
      .filter((item) => item.quantity > 0));
  }

  return <div className={`store store-${page.kind}`} style={theme}>
    {productColors && (tintLogo || tintFooter) && <svg className="brand-filters" aria-hidden="true" focusable="false" width="0" height="0">
      <defs>
        {tintLogo && <filter id={logoTintId}><feFlood floodColor={productColors.logo} /><feComposite in2="SourceAlpha" operator="in" /></filter>}
        {tintFooter && <filter id={footerTintId}><feFlood floodColor={productColors.footerText} /><feComposite in2="SourceAlpha" operator="in" /></filter>}
      </defs>
    </svg>}
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    {page.kind === "home" && <>
      <StoreOpening name={config.name} logo={logo} brand={brand} />
      <div id="loja" className="store-start" ref={storeStart} tabIndex={-1} />
    </>}
    {config.announcements.length > 0 && <div className="announcement"><div className="announcement-inner">
      {config.announcements.map((item, index) => <span key={item + index}>{item}</span>)}
    </div></div>}
    <header className={`store-header${compact ? " compact" : ""}`}>
      <div className="wrap brand-row">
        <div className="brand-tools left-tools">
          <button className="icon-button mobile-menu-button" aria-label="Abrir menu" onClick={() => setPanel("menu")}><Menu size={24} strokeWidth={1.45} /></button>
          <button className="icon-button search-button" aria-label="Buscar produtos" onClick={() => setPanel("search")}><Search size={24} strokeWidth={1.4} /></button>
        </div>
        <a className="brand" ref={brand} href="/" aria-label={`${config.name} — Início`}>
          {logo ? <Photo src={logo} alt={config.name} eager onError={() => setFailedLogo(logo)} /> : <span>{config.name}</span>}
        </a>
        <div className="brand-tools right-tools">
          <a className="icon-button admin-icon" href="/conta" aria-label="Minha conta"><UserRound size={24} strokeWidth={1.45} /></a>
          <button className="icon-button bag-button" aria-label={`Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}`} onClick={() => openCart()}>
            <ShoppingBag size={23} strokeWidth={1.45} /><span aria-hidden="true">{count}</span>
          </button>
        </div>
      </div>
      <nav className="wrap main-nav" aria-label="Menu principal">
        {navigation.map(({ url, label }) => url === "/produtos" ? <div className="products-nav" key={url}>
          <a href={url} aria-current={url === currentNavHref ? "page" : undefined}>{label}</a>
          <div className="category-flyout"><a href="/produtos">Todos os produtos</a>
            {config.categories.map((item) => <a key={item.id} href={categoryHref(item.id)}>{item.name}</a>)}</div>
        </div> : <a href={url} key={url} aria-current={url === currentNavHref ? "page" : undefined}>{label}</a>)}
      </nav>
    </header>
    <main id="conteudo" tabIndex={-1} data-product-pattern={activeProduct ? activeProduct.backgroundPattern ?? defaultProductBackgroundPattern : undefined}>
      {page.kind === "home" && <Home config={config} products={products} add={add} />}
      {page.kind === "catalog" && <Catalog config={config} products={products} category={page.category} search={page.search} add={add} />}
      {page.kind === "product" && activeProduct && <ProductPage key={activeProduct.id} product={activeProduct} products={products} config={config} add={add} signedIn={page.signedIn} initialSize={page.initialSize} />}
      {page.kind === "about" && <AboutPage config={config} />}
      {page.kind === "contact" && <ContactPage config={config} />}
      {children}
    </main>
    <footer className="store-footer">
      <div className="wrap footer-inner">
        <a className="footer-brand" href="/" aria-label={`${config.name} — Início`}>
          {logo ? <Photo src={logo} /> : <span>{config.name}</span>}
          <span className="footer-copyright" aria-hidden="true">©</span>
        </a>
        {usesBrandSignature
          ? <img className="footer-signature" src="/referencia/artistha-assinatura-rodape.png" alt={footerTagline} width={163} height={59} loading="lazy" decoding="async" />
          : <p className="footer-phrase">{footerPhrase}</p>}
      </div>
      <nav className="wrap footer-links" aria-label="Informações da loja">
        <a href={privacyPath} aria-current={page.kind === "privacy" ? "page" : undefined}>Política de privacidade</a>
      </nav>
    </footer>
    {!isContact && <a className="contact-fab" href={contactLink} target={config.whatsapp ? "_blank" : undefined} rel={config.whatsapp ? "noopener noreferrer" : undefined} aria-label="Entre em contato">
      <span>Entre em contato</span><span><MessageCircle size={23} strokeWidth={1.8} /></span>
    </a>}
    {panel === "cart" && <Panel title={cartTitle} close={() => setPanel(null)} drawer>
      <Cart lines={lines} config={config} change={change} close={() => setPanel(null)} setTitle={setCartTitle} notice={cartNotice} onSaved={removePurchased} />
    </Panel>}
    {panel === "search" && <Panel title="Buscar produtos" close={() => setPanel(null)}>
      <form className="search-form" action="/produtos">
        <input aria-label="O que você procura?" name="busca" placeholder="O que você procura?" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={150} autoFocus />
        <button className="button" aria-label="Pesquisar"><Search size={20} /></button>
      </form>
      {search.trim() && <div className="search-results">
        {results.map((product) => <a href={productHref(product)} key={product.id}>
          <Photo src={product.images[0]} /><span>{product.name}<ProductCardPrice product={product} /></span><ArrowRight size={17} />
        </a>)}
        {!results.length && <p className="muted">Nenhum produto encontrado.</p>}
        {results.length > 0 && <a href={`/produtos?busca=${encodeURIComponent(search.trim())}`} className="text-link">Ver todos os resultados <ArrowRight size={17} /></a>}
      </div>}
    </Panel>}
    {panel === "menu" && <Panel title="Menu" close={() => setPanel(null)} drawer>
      <nav className="panel-scroll mobile-nav" aria-label="Menu móvel">
        {navigation.map(({ url, label }) => <a key={url} href={url} aria-current={url === currentNavHref ? "page" : undefined}>{label}</a>)}
        {config.categories.map((item) => <a key={item.id} href={categoryHref(item.id)} className="mobile-category">{item.name}</a>)}
        <a href="/conta">Minha conta</a>
      </nav>
    </Panel>}
  </div>;
}
