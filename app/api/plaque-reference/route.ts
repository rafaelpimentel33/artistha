import { z } from "zod";
import { getStoreAccount } from "../../../lib/store-auth";
import { readStoreProduct } from "../../../lib/store-db";
import { error, fromStore, imageKind, json } from "../../../lib/store-http";
import { PLAQUE_REFERENCE_LIMIT, purchaseLimit } from "../../../lib/store-model";
import { PLAQUE_REFERENCE_BUCKET } from "../../../lib/supabase-config";

const fields = z.object({
  productId: z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/),
  variantId: z.string().regex(/^[a-zA-Z0-9_-]{0,120}$/),
  key: z.uuid().transform((key) => key.toLowerCase()),
});

export async function POST(request: Request) {
  if (!fromStore(request)) return error("Solicitação inválida.", 403);
  if (Number(request.headers.get("content-length") || 0) > PLAQUE_REFERENCE_LIMIT + 20_000) return error("A imagem deve ter até 4 MB.", 413);
  const account = await getStoreAccount();
  if (!account) return error("Entre na sua conta para enviar a imagem de referência.", 401);

  const data = await request.formData().catch(() => null);
  if (!data) return error("Confira a imagem de referência.");
  const details = fields.safeParse({ productId: data.get("productId"), variantId: data.get("variantId"), key: data.get("key") });
  const images = data.getAll("image");
  const file = images[0];
  if (!details.success || images.length !== 1 || !(file instanceof File) || !file.size || file.size > PLAQUE_REFERENCE_LIMIT) {
    return error("Envie uma imagem PNG, JPG ou WebP de até 4 MB.");
  }
  const kind = imageKind(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!kind) return error("Escolha uma imagem PNG, JPG ou WebP.");

  const { productId, variantId, key } = details.data;
  const product = await readStoreProduct(productId).catch(() => undefined);
  if (product === undefined) return error("O catálogo da loja está indisponível. Tente novamente.", 503);
  if (product?.customizablePlaque !== true) return error("O envio de referência não está disponível para este produto.", 404);
  const variant = product.variants.find((item) => item.id === variantId);
  if (purchaseLimit(product, variant) < 1 || (product.variants.length ? !variant : Boolean(variantId))) {
    return error(product.variants.length ? "Selecione um tamanho disponível." : "Placa indisponível.", 409);
  }

  const path = `${account.id}/${product.id}/${variant?.id ?? "padrao"}/${key}`;
  const result = await account.db.storage.from(PLAQUE_REFERENCE_BUCKET).upload(path, await file.arrayBuffer(), {
    contentType: kind.type, cacheControl: "0", upsert: false,
  });
  if (result.error && result.error.status !== 409 && !["409", "KeyAlreadyExists", "ResourceAlreadyExists"].includes(result.error.statusCode ?? "")) {
    return error("Não foi possível enviar a imagem. Tente novamente.", 503);
  }
  return json({ reference: key }, result.error ? 200 : 201);
}
