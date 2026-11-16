import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PrivacyPage } from "../../../components/store/privacy-page";
import { Storefront, type StorePage } from "../../../components/store/storefront";
import { getStoreAccount } from "../../../lib/store-auth";
import { readStoreData } from "../../../lib/store-db";
import { categoryHref, privacyPath, productHref, type StoreData } from "../../../lib/store-model";
import { hasIndexableProducts, indexableProduct, productSchemaMarkup, storeMetadata, storeSchema } from "../../../lib/store-seo";

export const dynamic = "force-dynamic";

type Query = { categoria?: string | string[]; busca?: string | string[]; tamanho?: string | string[] };
type Props = { params: Promise<{ path?: string[] }>; searchParams: Promise<Query> };

const single = (value: string | string[] | undefined) => typeof value === "string" ? value.slice(0, 150) : "";

function resolvePage(path: string[], query: Query, { config, products }: StoreData): StorePage | null {
  const [segment, slug] = path;
  if (!path.length) return { kind: "home" };
  if (segment === "produtos" && path.length === 2) {
    const product = products.find((item) => item.slug === slug);
    return product ? { kind: "product", id: product.id, initialSize: single(query.tamanho) } : null;
  }
  if (path.length !== 1) return null;
  if (segment === "contato") return { kind: "contact" };
  if (segment === "quem-somos") return { kind: "about" };
  if ("/" + segment === privacyPath) return { kind: "privacy" };
  const id = segment === "produtos" ? single(query.categoria) : segment;
  const category = config.categories.find((entry) => entry.id === id);
  if (segment !== "produtos" && !category) return null;
  return { kind: "catalog", category: category?.id ?? "", search: single(query.busca) };
}

async function readRequestedPage({ params, searchParams }: Props) {
  const [{ path = [] }, query, data] = await Promise.all([params, searchParams, readStoreData()]);
  return { data, page: resolvePage(path, query, data) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { data: { config, products }, page } = await readRequestedPage(props);
  const name = config.name;
  if (!page) return { title: "Página indisponível", robots: { index: false, follow: false } };
  switch (page.kind) {
    case "home":
      return storeMetadata(config, {
        path: "/", title: `${name} | Placas, mandalas e retratos artesanais`, description: config.introText,
      });
    case "catalog": {
      const category = config.categories.find(({ id }) => id === page.category);
      const title = category?.name ?? "Produtos artesanais";
      return storeMetadata(config, {
        path: category ? categoryHref(category.id) : "/produtos",
        title: `${page.search.trim() ? "Busca" : title} | ${name}`,
        description: category ? `Explore a categoria ${category.name} e descubra as peças pintadas à mão na ${name}.`
          : `Conheça as placas decorativas, mandalas e retratos pintados à mão no ateliê ${name}.`,
        index: !page.search.trim() && (!category || hasIndexableProducts(products, category.id)),
      });
    }
    case "product": {
      const product = products.find(({ id }) => id === page.id);
      if (!product) notFound();
      return storeMetadata(config, {
        path: productHref(product), title: `${product.name} | ${name}`, description: product.description,
        image: product.images[0], imageAlt: product.name, index: indexableProduct(product),
      });
    }
    case "contact":
      return storeMetadata(config, {
        path: "/contato", title: `Contato | ${name}`,
        description: `Fale com a ${name} sobre peças pintadas à mão, encomendas personalizadas e entregas.`,
      });
    case "about":
      return storeMetadata(config, {
        path: "/quem-somos", title: `${config.aboutTitle} | ${name}`, description: config.aboutText,
      });
    case "privacy":
      return storeMetadata(config, {
        path: privacyPath, title: `Política de privacidade | ${name}`,
        description: `Saiba como a ${name} trata dados de contas, pedidos, referências de encomendas e cookies.`,
      });
  }
}

export default async function StorePageRoute(props: Props) {
  const { data, page } = await readRequestedPage(props);
  if (!page) notFound();
  const { products, config } = data;
  const product = page.kind === "product" ? products.find(({ id }) => id === page.id) : undefined;
  if (page.kind === "product" && product?.customizablePlaque) {
    page.signedIn = Boolean(await getStoreAccount());
  }
  const structuredData = page.kind === "home" ? storeSchema(config)
    : page.kind === "product" && product && indexableProduct(product) ? productSchemaMarkup(product, config, page.initialSize) : null;
  return <>
    {structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{
      __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
    }} />}
    <Storefront config={config} products={products} page={page}>
      {page.kind === "privacy" && <PrivacyPage config={config} />}
    </Storefront>
  </>;
}
