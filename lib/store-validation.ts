import { z } from "zod";
import { validCpf } from "./account-model";
import { homeSections, phoneDigits, plaqueReferenceCode } from "./store-model";
import { productBackgroundPatterns, productColorFields } from "./store-theme";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
const id = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);
const moneyCents = z.number().int().min(0).max(99_999_999);
const stock = z.number().int().min(0).max(999_999).nullable();
const copy = (max: number) => z.string().trim().max(max);
const required = (max: number) => copy(max).min(1);
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const email = z.union([z.string().trim().max(180).pipe(z.email()), z.literal("")]);
const rail = z.enum(["new", "featured", "sale"]);
const image = z.string().trim().max(2048).refine((value) => {
  if (value === "") return true;
  if (/^\/(referencia|api\/media)\/[a-z0-9_.-]+$/i.test(value)) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Use um link HTTPS ou envie uma imagem.");
const link = z.string().trim().max(2048).refine((value) => {
  if (value === "" || /^\/(?!\/)[^\\\s]*$/.test(value)) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Informe um caminho da loja ou um link HTTPS.");

export const configSchema = z.object({
  name: required(100), logo: image, accent: hex, background: hex,
  headingFont: z.enum(["zilla", "georgia", "sans"]), bodyFont: z.enum(["outfit", "system"]),
  announcements: z.array(required(120)).max(6),
  banners: z.array(z.object({ id, label: required(160), desktop: image, mobile: image, href: link, mobileHref: link })).max(10),
  bannerAuto: z.boolean(),
  introTitle: copy(160), introText: copy(400), materialsTitle: copy(160), materialsText: copy(400),
  promoImage: image, promoHref: link, promoText: copy(600),
  railTitles: z.object({ new: copy(70), featured: copy(70), sale: copy(70) }),
  featuredId: z.union([id, z.literal("")]),
  categories: z.array(z.object({ id: slug, name: required(100) })).max(80),
  sections: z.array(z.enum(homeSections)).max(homeSections.length),
  whatsapp: copy(32).transform(phoneDigits).refine((phone) => !phone || /^[1-9][0-9]{9,14}$/.test(phone), "Informe um número de WhatsApp válido com DDD."),
  contactEmail: email,
  instagram: z.string().trim().max(50).regex(/^@?[a-zA-Z0-9_.]*$/).transform((name) => name.replace(/^@/, "")),
  checkoutGreeting: required(400),
  delivery: z.boolean(), pickup: z.boolean(),
  shippingType: z.enum(["quote", "flat"]), shippingCost: moneyCents, freeOver: moneyCents.nullable(),
  aboutTitle: required(100), aboutText: copy(6000),
  privacyController: copy(160).optional(), privacyEmail: email.optional(),
  footerText: copy(280),
}).superRefine((value, context) => {
  if (!value.delivery && !value.pickup) context.addIssue({ code: "custom", path: ["delivery"], message: "Ative entrega, retirada ou as duas opções." });
  if (new Set(value.categories.map((category) => category.id)).size !== value.categories.length) {
    context.addIssue({ code: "custom", path: ["categories"], message: "Use um nome diferente para cada categoria." });
  }
  if (new Set(value.sections).size !== value.sections.length || new Set(value.banners.map((banner) => banner.id)).size !== value.banners.length) {
    context.addIssue({ code: "custom", path: ["sections"], message: "Há itens repetidos na configuração." });
  }
  if (value.banners.some((slide) => !slide.desktop && !slide.mobile)) {
    context.addIssue({ code: "custom", path: ["banners"], message: "Adicione pelo menos uma imagem a cada banner." });
  }
});

export const productSchema = z.object({
  id, slug, name: required(150), categories: z.array(slug).max(30), description: copy(7000),
  images: z.array(image.refine(Boolean)).max(12), price: moneyCents, comparePrice: moneyCents.nullable(), stock,
  variantNames: z.array(required(50)).max(3),
  variants: z.array(z.object({ id, values: z.array(required(120)).min(1).max(3), price: moneyCents.nullable(), stock, active: z.boolean() })).max(250),
  tags: z.array(rail).max(3), active: z.boolean(),
  preview: z.literal("wooden-plaque").optional(),
  showPlaquePreview: z.boolean().optional(),
  customizablePlaque: z.boolean().optional(),
  theme: z.partialRecord(z.enum(productColorFields.map(({ key }) => key)), hex).optional(),
  backgroundPattern: z.enum(productBackgroundPatterns.map(({ value }) => value)).optional(),
  plaque: z.object({
    frontImage: image, backColor: hex, edgeColor: hex, fit: z.enum(["cover", "contain"]),
    diameter: z.number().positive("Informe um diâmetro maior que zero.").optional(),
  }).optional(),
}).superRefine((product, context) => {
  if (product.comparePrice !== null && product.comparePrice <= product.price) {
    context.addIssue({ code: "custom", path: ["comparePrice"], message: "O preço anterior precisa ser maior que o atual." });
  }
  if (product.variants.some((variant) => variant.values.length !== product.variantNames.length)) {
    context.addIssue({ code: "custom", path: ["variants"], message: "Preencha todos os campos de cada variação." });
  }
  const names = new Set(product.variants.map((variant) => variant.values.map((value) => value.toLowerCase()).join("\u0000")));
  if (names.size !== product.variants.length || new Set(product.variants.map((variant) => variant.id)).size !== product.variants.length) {
    context.addIssue({ code: "custom", path: ["variants"], message: "Cada combinação de variação deve ser única." });
  }
});

export const revision = z.number().int().min(0);
export const profileSchema = z.object({
  name: copy(100),
  email,
  phone: z.string().trim().regex(/^[0-9+() -]{0,24}$/),
  cep: copy(9).transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 0 || value.length === 8, "Informe um CEP de 8 dígitos."),
  cpf: copy(14).regex(/^(?:[0-9]{11}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})?$/, "Informe um CPF válido.")
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => !value || validCpf(value), "Informe um CPF válido.").optional(),
});

export const checkoutSchema = z.object({
  name: required(100), method: z.enum(["delivery", "pickup"]),
  cep: copy(9), note: copy(500),
  entries: z.array(z.object({ productId: id, variantId: id.nullable(), quantity: z.number().int().min(1).max(99), reference: z.string().regex(plaqueReferenceCode).optional() })).min(1).max(40),
}).superRefine((checkout, context) => {
  if (checkout.method === "delivery" && !/^\d{5}-?\d{3}$/.test(checkout.cep)) {
    context.addIssue({ code: "custom", path: ["cep"], message: "Informe um CEP com 8 dígitos." });
  }
});
