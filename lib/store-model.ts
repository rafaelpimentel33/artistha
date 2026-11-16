import type { ProductBackgroundPattern, ProductTheme } from "./store-theme";

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const PLAQUE_CATEGORY = "placa";
export const ROUND_PLAQUE_CATEGORY = "placa-redonda";
export const PLAQUE_REFERENCE_LIMIT = MAX_PHOTO_BYTES;
export const PLAQUE_REFERENCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const plaqueReferenceCode = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export type PlaqueDesign = { frontImage: string; backColor: string; edgeColor: string; fit: "cover" | "contain"; diameter?: number };
export const defaultPlaqueDesign: PlaqueDesign = { frontImage: "", backColor: "#c9915a", edgeColor: "#8f603b", fit: "cover" };

export const homeSections = ["intro", "new", "featured", "materials", "spotlight", "promo", "sale"] as const;
export type HomeSection = typeof homeSections[number];
export type Rail = "new" | "featured" | "sale";

export type Category = { id: string; name: string };
export type Slide = { id: string; label: string; desktop: string; mobile: string; href: string; mobileHref: string };
export type Variant = { id: string; values: string[]; price: number | null; stock: number | null; active: boolean };

export type Product = {
  id: string;
  slug: string;
  name: string;
  categories: string[];
  description: string;
  images: string[];
  price: number;
  comparePrice: number | null;
  stock: number | null;
  variantNames: string[];
  variants: Variant[];
  tags: Rail[];
  active: boolean;
  preview?: "wooden-plaque";
  showPlaquePreview?: boolean;
  customizablePlaque?: boolean;
  plaque?: PlaqueDesign;
  theme?: ProductTheme;
  backgroundPattern?: ProductBackgroundPattern;
};

export function isRoundPlaque(product: Pick<Product, "categories" | "preview">) {
  return product.categories.includes(PLAQUE_CATEGORY) || product.categories.includes(ROUND_PLAQUE_CATEGORY) || product.preview === "wooden-plaque";
}

export function hasPlaquePreview(product: Pick<Product, "categories" | "preview" | "showPlaquePreview">) {
  return product.showPlaquePreview ?? isRoundPlaque(product);
}

export function isPlaqueProduct(product: Pick<Product, "categories" | "preview" | "customizablePlaque">) {
  return product.customizablePlaque === true || isRoundPlaque(product);
}

export function plaqueDesign(product: Pick<Product, "categories" | "images" | "plaque" | "showPlaquePreview">): PlaqueDesign {
  const design = product.plaque ?? defaultPlaqueDesign;
  if (design.frontImage || (!product.categories.includes(PLAQUE_CATEGORY) && !product.showPlaquePreview)) return design;
  return { ...design, frontImage: product.images[0] ?? "" };
}

export const plaqueSizes = [
  { id: "pequeno", label: "Pequeno · Ø 20 cm", diameter: 20, scale: 1 / 3 },
  { id: "medio", label: "Médio · Ø 40 cm", diameter: 40, scale: 2 / 3 },
  { id: "grande", label: "Grande · Ø 60 cm", diameter: 60, scale: 1 },
];

export function newPlaqueVariants(): Variant[] {
  return plaqueSizes.map(({ id, label }) => ({ id, values: [label], price: null, stock: null, active: true }));
}

export type StoreConfig = {
  name: string;
  logo: string;
  announcements: string[];
  accent: string;
  background: string;
  headingFont: "zilla" | "georgia" | "sans";
  bodyFont: "outfit" | "system";
  banners: Slide[];
  bannerAuto: boolean;
  introTitle: string;
  introText: string;
  materialsTitle: string;
  materialsText: string;
  promoImage: string;
  promoHref: string;
  promoText: string;
  railTitles: Record<Rail, string>;
  featuredId: string;
  categories: Category[];
  sections: HomeSection[];
  whatsapp: string;
  contactEmail: string;
  instagram: string;
  checkoutGreeting: string;
  delivery: boolean;
  pickup: boolean;
  shippingType: "quote" | "flat";
  shippingCost: number;
  freeOver: number | null;
  aboutTitle: string;
  aboutText: string;
  privacyController?: string;
  privacyEmail?: string;
  footerText: string;
};

export type StoreData = { config: StoreConfig; products: Product[] };
export type AdminProduct = Product & { revision: number };
export type AdminData = { config: StoreConfig; revision: number; products: AdminProduct[] };
export type CartEntry = { productId: string; variantId: string | null; quantity: number; reference?: string };
export type CartLine = CartEntry & { name: string; slug: string; image: string; option: string; price: number; limit: number };
export type Fulfillment = "delivery" | "pickup";
export type Checkout = { name: string; method: Fulfillment; cep: string; note: string; entries: CartEntry[] };

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (cents: number) => brl.format(cents / 100);

export function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function isSizeOption(name: string) {
  const label = normalize(name);
  return label === "tamanho" || label === "diametro";
}

export function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100).replace(/-+$/g, "");
}

export function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (!value.trim().startsWith("+") && [10, 11].includes(digits.length)) return "55" + digits;
  return digits;
}

export const productHref = (product: Pick<Product, "slug">) => "/produtos/" + product.slug;
export const categoryHref = (id: string) => "/produtos?categoria=" + encodeURIComponent(id);
export const privacyPath = "/privacidade";
export const whatsappHref = (phone: string, message = "") => "https://wa.me/" + phone + (message ? "?text=" + encodeURIComponent(message) : "");
export const stockKey = ({ productId, variantId }: Pick<CartEntry, "productId" | "variantId">) => `${productId}:${variantId ?? ""}`;
export const lineKey = (line: Pick<CartEntry, "productId" | "variantId" | "reference">) => `${stockKey(line)}${line.reference ? `:${line.reference}` : ""}`;

export function variantLabel(product: Product, variant: Variant) {
  return variant.values.map((value, index) => `${product.variantNames[index] || "Opção"}: ${value}`).join(" · ");
}

export function stockLimit(product: Product, variant?: Variant) {
  if (!product.active || variant?.active === false) return 0;
  return Math.min(99, variant?.stock ?? product.stock ?? 99);
}

export const unitPrice = (product: Product, variant?: Variant) => variant?.price ?? product.price;

export function purchaseLimit(product: Product, variant?: Variant) {
  return isPlaqueProduct(product) && unitPrice(product, variant) <= 0 ? 0 : stockLimit(product, variant);
}

export function initialVariant(product: Product, requestedId?: string) {
  const requested = product.variants.find((variant) => variant.id === requestedId);
  if (requested) return requested;
  const buyable = product.variants.filter((variant) => purchaseLimit(product, variant) > 0);
  const legacyLarge = isRoundPlaque(product) ? buyable.find((variant) => variant.id === "grande") : undefined;
  return legacyLarge ?? buyable[0] ?? product.variants[0];
}

export function productPrice(product: Product) {
  if (!product.variants.length) {
    return { min: product.price, varies: false, available: purchaseLimit(product) > 0 };
  }
  const buyable = product.variants.filter((variant) => purchaseLimit(product, variant) > 0);
  const priced = buyable.length || !isPlaqueProduct(product) ? buyable : product.variants.filter((variant) => variant.active && unitPrice(product, variant) > 0);
  const prices = priced.map((variant) => unitPrice(product, variant));
  const min = prices.length ? Math.min(...prices) : product.price;
  return { min, varies: prices.some((price) => price !== min), available: buyable.length > 0 };
}

export function getCartLines(products: Product[], entries: CartEntry[]) {
  const lookup = new Map(products.map((product) => [product.id, product]));
  const counts = new Map<string, number>();
  const lines: CartLine[] = [];
  for (const entry of entries) {
    const product = lookup.get(entry.productId);
    if (!product) continue;
    const variant = product.variants.find((option) => option.id === entry.variantId);
    if (product.variants.length ? !variant : entry.variantId !== null) continue;
    const limit = purchaseLimit(product, variant);
    const key = stockKey(entry);
    const used = counts.get(key) ?? 0;
    const quantity = Math.min(entry.quantity, limit - used);
    if (quantity < 1) continue;
    counts.set(key, used + quantity);
    lines.push({
      ...entry, quantity, name: product.name, slug: product.slug,
      image: product.images[0] || "", option: variant ? variantLabel(product, variant) : "",
      price: unitPrice(product, variant), limit,
    });
  }
  return lines.map((line) => ({ ...line, limit: line.limit - (counts.get(stockKey(line)) ?? 0) + line.quantity }));
}

export function shipping(config: StoreConfig, subtotal: number, method: Fulfillment) {
  if (method === "pickup" || (config.freeOver !== null && subtotal >= config.freeOver)) return 0;
  return config.shippingType === "flat" ? config.shippingCost : null;
}

export function checkoutMessage(config: StoreConfig, order: Omit<Checkout, "entries">, lines: Pick<CartLine, "name" | "option" | "quantity" | "price" | "reference">[], savedFreight?: number | null) {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const freight = savedFreight === undefined ? shipping(config, subtotal, order.method) : savedFreight;
  const postal = order.cep.replace(/\D/g, "");
  const output = [
    config.checkoutGreeting, "", `*Nome:* ${order.name}`, "", "*Produtos*",
    ...lines.map((line) => `• ${line.quantity}× ${line.name}${line.option ? ` (${line.option})` : ""} — ${money(line.price * line.quantity)}${line.reference ? `\n  Referência: ${line.reference}` : ""}`),
    "", `*Subtotal:* ${money(subtotal)}`,
    order.method === "delivery" ? `*Entrega:* CEP ${postal.slice(0, 5)}-${postal.slice(5)}` : "*Retirada:* combinar com a loja",
    ...(order.method === "delivery" ? [`*Frete:* ${freight === null ? "A combinar" : freight === 0 ? "Grátis" : money(freight)}`] : []),
    ...(freight !== null ? [`*Total:* ${money(subtotal + freight)}`] : []),
    ...(order.note ? ["", `*Observações:* ${order.note}`] : []),
  ];
  return output.join("\n");
}

