"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ImageOff, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { isPlaqueProduct, money, productHref, productPrice, type Product } from "../../lib/store-model";

export function Photo({ src, alt = "", className = "", eager = false, onError }: { src?: string; alt?: string; className?: string; eager?: boolean; onError?: () => void }) {
  if (src) return <img src={src} alt={alt} className={className} loading={eager ? "eager" : "lazy"} decoding="async" onError={onError} />;
  return <span className={`photo-placeholder ${className}`} aria-hidden="true"><ImageOff size={28} strokeWidth={1.25} /></span>;
}

export function Quantity({ count, max, onChange, disabled = false }: { count: number; max: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <div className="quantity">
    <button aria-label="Diminuir quantidade" type="button" disabled={disabled || count <= 1} onClick={() => onChange(count - 1)}><Minus size={15} /></button>
    <output aria-label="Quantidade">{count}</output>
    <button aria-label="Aumentar quantidade" type="button" disabled={disabled || count >= max} onClick={() => onChange(count + 1)}><Plus size={15} /></button>
  </div>;
}

export function PurchaseAction({ limit, quantity, setQuantity, onBuy, label = "Adicionar ao carrinho", busy = false }: {
  limit: number; quantity: number; setQuantity: (quantity: number) => void; onBuy: () => void; label?: string; busy?: boolean;
}) {
  return <div className="purchase-actions">
    {limit > 0 && <Quantity count={quantity} max={limit} onChange={setQuantity} disabled={busy} />}
    <button className="button" type="button" disabled={limit < 1 || busy} onClick={onBuy}><ShoppingBag size={18} strokeWidth={1.55} /> {limit > 0 ? label : "Indisponível"}</button>
  </div>;
}

export function Panel({ title, children, close, drawer = false }: { title: string; children: ReactNode; close: () => void; drawer?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => { if (node?.open) node.close(); };
  }, []);
  return <dialog
    ref={dialog} className={drawer ? "panel panel-drawer" : "panel"} aria-labelledby={id}
    onCancel={(event) => { event.preventDefault(); close(); }}
    onClick={(event) => { if (event.currentTarget === event.target) close(); }}
  >
    <div className="panel-content">
      <div className="panel-title"><h2 id={id}>{title}</h2><button className="icon-button" aria-label="Fechar" onClick={close}><X size={23} strokeWidth={1.5} /></button></div>
      {children}
    </div>
  </dialog>;
}

export function Arrows({ position, total, back, forward, label, announce = true, children }: {
  position: number; total: number; back: () => void; forward: () => void; label: string; announce?: boolean; children?: ReactNode;
}) {
  if (total < 2) return null;
  return <div className="arrows" role="group" aria-label={label}>
    {children}
    <button type="button" aria-label={`${label} anterior`} className="icon-button" onClick={back}><ArrowLeft size={19} strokeWidth={1.45} /></button>
    <span aria-live={announce ? "polite" : "off"}>{position} / {total}</span>
    <button type="button" aria-label={`Próximo ${label.toLowerCase()}`} className="icon-button" onClick={forward}><ArrowRight size={19} strokeWidth={1.45} /></button>
  </div>;
}

export function ProductCardPrice({ product, pricing = productPrice(product) }: { product: Product; pricing?: ReturnType<typeof productPrice> }) {
  const { min, varies } = pricing;
  if (isPlaqueProduct(product) && min <= 0) return <span className="card-price">Preço ainda não cadastrado</span>;
  const comparison = product.comparePrice && product.comparePrice > min && !varies ? product.comparePrice : null;
  return <span className="card-price">{varies && <span>A partir de </span>}<span>{money(min)}</span>{comparison && <del>{money(comparison)}</del>}</span>;
}

export function ProductCard({ product, add, freeOver }: { product: Product; add: (product: Product) => void; freeOver: number | null }) {
  const pricing = productPrice(product);
  const { min, varies, available } = pricing;
  const comparison = product.comparePrice && product.comparePrice > min && !varies ? product.comparePrice : null;
  const discount = comparison ? Math.round(100 * (1 - min / comparison)) : 0;
  return <article className="product-card">
    <a className="card-image" href={productHref(product)} aria-label={product.name}>
      <Photo src={product.images[0]} alt={product.name} />
      <div className="card-badges">
        {!available && <span className="badge">{isPlaqueProduct(product) && min <= 0 ? "Indisponível" : "Esgotado"}</span>}
        {available && discount > 0 && <span className="badge badge-sale">{discount}% OFF</span>}
        {available && freeOver !== null && min >= freeOver && <span className="badge">Frete grátis</span>}
      </div>
    </a>
    <a className="product-name" href={productHref(product)}>{product.name}</a>
    <ProductCardPrice product={product} pricing={pricing} />
    {available && !isPlaqueProduct(product) && !product.variants.length
      ? <button className="button small product-buy" type="button" onClick={() => add(product)} aria-label={`Comprar ${product.name}`}>Comprar <ShoppingBag size={14} strokeWidth={1.65} /></button>
      : <a className={`button small product-buy${available ? "" : " button-outline"}`} href={productHref(product)}>{available ? "Comprar" : "Ver detalhes"}{available && <ShoppingBag size={14} strokeWidth={1.65} />}</a>}
  </article>;
}
