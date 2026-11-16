import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { storeAboutText } from "./about";
import { publicStoreClient } from "./supabase-public";
import { storeAuthClient } from "./store-auth";
import { homeSections, type AdminData, type AdminProduct, type HomeSection, type Product, type StoreConfig, type StoreData } from "./store-model";
import { emptyProfile, parseCustomerProfile, type CustomerProfile, type Order, type OrderStatus } from "./order-model";

type StoredConfig = {
  body: Omit<StoreConfig, "sections"> & {
    sections: string[]; newsletterTitle?: string; newsletterText?: string; returnsText?: string;
  };
  revision: number;
};
type StoredProduct = { body: Product; revision: number };
const batchSize = 400;
const orderFields = "id,number,created_at,status,name,customer_email,customer_phone,method,cep,note,lines,subtotal,freight,total";

async function readSettings(db: SupabaseClient) {
  const settings = await db.from("shop_config").select("body,revision").eq("id", 1).single<StoredConfig>();
  if (settings.error || !settings.data) throw new Error("A configuração da loja está indisponível.");
  const { sections, newsletterTitle: _newsletterTitle, newsletterText: _newsletterText, returnsText: _returnsText, ...body } = settings.data.body;
  const config = {
    ...body,
    aboutText: storeAboutText(body.aboutText),
    sections: sections.filter((section): section is HomeSection => homeSections.some((active) => active === section)),
  };
  return { config, revision: settings.data.revision };
}

async function readProducts(db: SupabaseClient): Promise<AdminProduct[]> {
  const products: AdminProduct[] = [];
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await db.from("shop_products").select("body,revision")
      .order("position", { ascending: true, nullsFirst: true }).order("updated_at", { ascending: false }).order("id")
      .range(offset, offset + batchSize - 1).returns<StoredProduct[]>();
    if (error) throw new Error("O catálogo da loja está indisponível.");
    products.push(...data.map((item) => ({ ...item.body, revision: item.revision })));
    if (data.length < batchSize) return products;
  }
}

export const readAdminData = cache(async (): Promise<AdminData> => {
  const db = await storeAuthClient();
  const [settings, products] = await Promise.all([readSettings(db), readProducts(db)]);
  return { ...settings, products };
});

export const readStoreConfig = cache(async () => {
  const { config } = await readSettings(publicStoreClient());
  return config;
});

export const readStoreData = cache(async (): Promise<StoreData> => {
  const [config, products] = await Promise.all([readStoreConfig(), readProducts(publicStoreClient())]);
  return {
    config,
    products: products.filter((product) => product.active).map(({ revision: _revision, ...product }) => publicProduct(product)),
  };
});

function publicProduct(product: Product): Product {
  const variants = product.variants.filter((variant) => variant.active);
  const stock = product.variants.length > 0 && variants.length === 0 ? 0 : product.stock;
  return { ...product, variants, stock };
}

export async function readStoreProduct(id: string) {
  const { data, error } = await publicStoreClient().from("shop_products").select("body").eq("id", id)
    .maybeSingle<Pick<StoredProduct, "body">>();
  if (error) throw new Error("O catálogo da loja está indisponível.");
  return data?.body.active ? publicProduct(data.body) : null;
}

export async function writeConfig(config: StoreConfig, revision: number) {
  const { data, error } = await (await storeAuthClient()).from("shop_config")
    .update({ body: config, revision: revision + 1 }).eq("id", 1).eq("revision", revision).select("id").maybeSingle();
  if (error) throw new Error("Não foi possível salvar a configuração da loja.");
  return data !== null;
}

export async function writeProduct(id: string, product: Product | null, revision: number) {
  const table = (await storeAuthClient()).from("shop_products");
  const stamp = new Date().toISOString();
  const result = !product
    ? await table.delete().eq("id", id).eq("revision", revision).select("id").maybeSingle()
    : revision === 0
      ? await table.insert({ id, slug: product.slug, body: product, revision: 1, updated_at: stamp }).select("id").single()
      : await table.update({ slug: product.slug, body: product, revision: revision + 1, updated_at: stamp })
        .eq("id", id).eq("revision", revision).select("id").maybeSingle();
  if (result.error?.code === "23505") return "duplicate";
  if (result.error) throw new Error("Não foi possível salvar o produto.");
  if (result.data) return "saved";
  if (product) return "stale";
  const existing = await table.select("id").eq("id", id).maybeSingle();
  if (existing.error) throw new Error("Não foi possível consultar o produto.");
  return existing.data ? "stale" : "missing";
}

export async function readProfile(db: SupabaseClient): Promise<CustomerProfile> {
  const { data, error } = await db.rpc("shop_customer_profile");
  if (error) throw new Error("Não foi possível carregar o cadastro.");
  return parseCustomerProfile(data) ?? emptyProfile;
}

export async function listOrders(db: SupabaseClient, customerId?: string, page = 0): Promise<{ orders: Order[]; hasMore: boolean }> {
  const limit = 30;
  const offset = page * limit;
  const query = db.from("shop_orders").select(orderFields).order("number", { ascending: false }).range(offset, offset + limit);
  const { data, error } = await (customerId ? query.eq("customer_id", customerId) : query).returns<Order[]>();
  if (error) throw new Error("Não foi possível carregar os pedidos.");
  return { orders: data.slice(0, limit), hasMore: data.length > limit };
}

export async function writeOrderStatus(id: string, status: OrderStatus) {
  const { data, error } = await (await storeAuthClient()).from("shop_orders").update({ status }).eq("id", id)
    .select(orderFields).maybeSingle<Order>();
  if (error) throw new Error("Não foi possível atualizar o pedido.");
  return data;
}
