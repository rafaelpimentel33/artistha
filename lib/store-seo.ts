import "server-only";

import type { Metadata } from "next";
import { categoryHref, initialVariant, productHref, purchaseLimit, unitPrice, type Product, type StoreConfig } from "./store-model";

const defaultStoreUrl = "https://artistha-loja.vercel.app";
const sharingImage = "/referencia/artistha-mosaico-abertura.webp";

function canonicalBase() {
  try {
    const url = new URL(process.env.STORE_URL || defaultStoreUrl);
    if (url.protocol === "https:" && !url.username && !url.password) return new URL(url.origin);
  } catch {
    // A missing or invalid setting must not break the public pages.
  }
  return new URL(defaultStoreUrl);
}

export const storeUrl = canonicalBase();
export const storeDescription = "Placas, mandalas e retratos pintados à mão pela ArtisTha. Conheça as peças artesanais do ateliê e consulte encomendas.";
export const previewSite = process.env.VERCEL_ENV === "preview";
export const absoluteUrl = (path: string) => new URL(path, storeUrl).href;

export function indexableProduct(product: Product) {
  return product.active && !product.slug.startsWith("teste-");
}

export function hasIndexableProducts(products: Product[], category: string) {
  return products.some((product) => indexableProduct(product) && product.categories.includes(category));
}

function descriptionForSearch(text: string) {
  const description = text.replace(/\s+/g, " ").trim();
  if (description.length <= 160) return description;
  const excerpt = description.slice(0, 157);
  const boundary = excerpt.lastIndexOf(" ");
  return (boundary > 125 ? excerpt.slice(0, boundary) : excerpt) + "…";
}

export function storeMetadata(config: StoreConfig, options: {
  path: string; title: string; description: string; image?: string; imageAlt?: string; index?: boolean;
}): Metadata {
  const { path, title, image = sharingImage, imageAlt = `Arte da ${config.name}`, index = true } = options;
  const description = descriptionForSearch(options.description) || storeDescription;
  const url = absoluteUrl(path);
  const images = [{ url: absoluteUrl(image), alt: imageAlt }];
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: { index: index && !previewSite, follow: true },
    openGraph: { type: "website", locale: "pt_BR", siteName: config.name, title, description, url, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export function storeSchema(config: StoreConfig) {
  const url = absoluteUrl("/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": url + "#atelie", name: config.name, url,
        ...(config.logo ? { logo: absoluteUrl(config.logo) } : {}) },
      { "@type": "WebSite", name: config.name, url, inLanguage: "pt-BR", publisher: { "@id": url + "#atelie" } },
    ],
  };
}

export function productSchemaMarkup(product: Product, config: StoreConfig, requestedVariant?: string) {
  const path = productHref(product);
  const url = absoluteUrl(path);
  const images = product.images.map(absoluteUrl);
  const category = config.categories.find(({ id }) => product.categories.includes(id));
  const variant = initialVariant(product, requestedVariant);
  const price = unitPrice(product, variant);
  const offer = price > 0 ? {
    "@type": "Offer",
    price: price / 100,
    priceCurrency: "BRL",
    url: variant ? absoluteUrl(path + "?tamanho=" + encodeURIComponent(variant.id)) : url,
    availability: purchaseLimit(product, variant) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
  } : null;
  const crumbs = [
    { name: "Início", item: absoluteUrl("/") },
    { name: "Produtos", item: absoluteUrl("/produtos") },
    ...(category ? [{ name: category.name, item: absoluteUrl(categoryHref(category.id)) }] : []),
    { name: product.name, item: url },
  ];
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Product", name: product.name, description: product.description, url, image: images,
        brand: { "@type": "Brand", name: config.name }, ...(offer ? { offers: offer } : {}) },
      { "@type": "BreadcrumbList", itemListElement: crumbs.map((crumb, index) => ({
        "@type": "ListItem", position: index + 1, ...crumb,
      })) },
    ],
  };
}
