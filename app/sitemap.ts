import type { MetadataRoute } from "next";
import { readStoreData } from "../lib/store-db";
import { categoryHref, privacyPath, productHref } from "../lib/store-model";
import { absoluteUrl, hasIndexableProducts, indexableProduct, previewSite } from "../lib/store-seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (previewSite) return [];
  const { config, products } = await readStoreData();
  const paths = ["/", "/produtos", "/quem-somos", "/contato", privacyPath];
  for (const category of config.categories) {
    if (hasIndexableProducts(products, category.id)) paths.push(categoryHref(category.id));
  }
  for (const product of products.filter(indexableProduct)) paths.push(productHref(product));
  return paths.map((path) => ({ url: absoluteUrl(path) }));
}
