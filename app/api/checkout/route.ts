import { z } from "zod";
import { getStoreAccount } from "../../../lib/store-auth";
import { readProfile, readStoreConfig } from "../../../lib/store-db";
import { error, fromStore, json, readJson } from "../../../lib/store-http";
import { checkoutMessage, whatsappHref } from "../../../lib/store-model";
import { checkoutSchema } from "../../../lib/store-validation";
import type { Order } from "../../../lib/order-model";

const requestSchema = z.object({
  key: z.uuid(),
  checkout: checkoutSchema,
  subtotal: z.number().int().nonnegative(),
  freight: z.number().int().nonnegative().nullable(),
});

export async function POST(request: Request) {
  if (!fromStore(request)) return error("Solicitação inválida.", 403);
  const account = await getStoreAccount();
  if (!account) return error("Entre na sua conta para salvar o pedido.", 401);
  const body = await readJson(request, 30_000, "O pedido é grande demais.");
  if ("response" in body) return body.response;
  const result = requestSchema.safeParse(body.data);
  if (!result.success) return error(result.error.issues[0]?.message || "Confira os dados do pedido.");
  if (account.email && !(await readProfile(account.db)).name.trim()) return error("Complete o cadastro na página Minha conta.", 428);
  const config = await readStoreConfig().catch(() => null);
  if (!config) return error("A configuração da loja está indisponível. Tente novamente.", 503);
  const { checkout, key, subtotal, freight } = result.data;
  const saved = await account.db.rpc("shop_place_order", {
    p_key: key, p_name: checkout.name, p_method: checkout.method, p_cep: checkout.cep, p_note: checkout.note,
    p_entries: checkout.entries, p_subtotal: subtotal, p_freight: freight,
  }).single<Order>();
  if (saved.error?.message === "shop_reference_unavailable") return error("A imagem de referência ficou indisponível. Remova o item do carrinho e adicione a placa novamente.", 409);
  if (saved.error?.message === "shop_changed") return error("O catálogo ou o frete mudou. Atualize a página e revise o pedido.", 409);
  if (saved.error?.message === "shop_invalid_order") return error("Confira os itens e os dados do pedido.");
  if (saved.error || !saved.data) return error("Não foi possível salvar o pedido. Tente novamente.", 503);
  const order = saved.data;
  const message = `*Pedido nº ${order.number}*\n\n` + checkoutMessage(config, order, order.lines, order.freight);
  return json({ number: order.number, url: config.whatsapp ? whatsappHref(config.whatsapp, message) : "", message }, 201);
}
