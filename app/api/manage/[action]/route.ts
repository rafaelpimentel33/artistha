import { z } from "zod";
import { getAdminAccess, storeAuthClient } from "../../../../lib/store-auth";
import { MEDIA_BUCKET } from "../../../../lib/supabase-config";
import { deletePlaqueReference, listPlaqueReferences, plaqueReferenceDownload } from "../../../../lib/plaque-reference-db";
import { deleteOrder, listOrders, readStoreConfig, writeConfig, writeOrderStatus, writeProduct } from "../../../../lib/store-db";
import { error, fromStore, imageKind, json, readJson } from "../../../../lib/store-http";
import { defaultPlaqueDesign, hasPlaquePreview, MAX_PHOTO_BYTES } from "../../../../lib/store-model";
import { configSchema, productSchema, revision } from "../../../../lib/store-validation";

type Context = { params: Promise<{ action: string }> };
const changeProduct = z.object({ product: productSchema, revision });
const removeProduct = z.object({ id: z.string().min(1).max(120), revision });
const referencePath = /^[a-f0-9-]{36}\/[a-zA-Z0-9_-]{1,120}\/[a-zA-Z0-9_-]{1,120}\/[a-f0-9-]{36}$/i;

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: Context) {
  const { action } = await params;
  if (await getAdminAccess() !== "admin") return error("Entre com a conta administradora.", 403);
  if (action === "plaque-references") {
    const query = new URL(request.url).searchParams;
    const page = z.coerce.number().int().min(0).max(100000).safeParse(query.get("page") ?? 0);
    const search = (query.get("busca") ?? "").trim().toLowerCase();
    if (!page.success || !/^[a-f0-9-]{0,36}$/.test(search)) return error("Confira o código da referência.");
    return json(await listPlaqueReferences(page.data, search));
  }
  if (action === "plaque-reference-download") {
    const path = new URL(request.url).searchParams.get("path") ?? "";
    if (!referencePath.test(path)) return error("Imagem indisponível.", 404);
    const url = await plaqueReferenceDownload(path);
    if (!url) return error("Imagem indisponível.", 404);
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  }
  if (action === "orders") {
    const page = z.coerce.number().int().min(0).max(100000).safeParse(new URL(request.url).searchParams.get("page") ?? 0);
    if (!page.success) return error("Página inválida.");
    return json(await listOrders(await storeAuthClient(), undefined, page.data));
  }
  return error("Página indisponível.", 404);
}

export async function POST(request: Request, { params }: Context) {
  if (!fromStore(request)) return error("Solicitação inválida.", 403);
  const access = await getAdminAccess();
  if (access !== "admin") return error("Entre com a conta administradora.", access === "signin" ? 401 : 403);
  const { action } = await params;

  if (action === "photo") {
    if (Number(request.headers.get("content-length") || 0) > MAX_PHOTO_BYTES + 20_000) return error("O arquivo deve ter até 4 MB.", 413);
    const data = await request.formData().catch(() => null);
    const images = data?.getAll("image") ?? [];
    const file = images[0];
    if (images.length !== 1 || !(file instanceof File) || file.size === 0 || file.size > MAX_PHOTO_BYTES) return error("Escolha uma imagem de até 4 MB.");
    const bytes = await file.arrayBuffer();
    const kind = imageKind(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 16)));
    if (!kind) return error("Use uma imagem JPG, PNG ou WebP.");
    const key = crypto.randomUUID() + "." + kind.extension;
    const { error: failure } = await (await storeAuthClient()).storage.from(MEDIA_BUCKET)
      .upload(key, bytes, { contentType: kind.type, cacheControl: "31536000", upsert: false });
    if (failure) return error("Não foi possível salvar a foto. Tente novamente.", 503);
    return json({ url: "/api/media/" + key }, 201);
  }

  const body = await readJson(request, 512_000);
  if ("response" in body) return body.response;
  const { data: payload } = body;

  if (action === "settings") {
    const result = z.object({ config: configSchema, revision }).safeParse(payload);
    if (!result.success) return error(result.error.issues[0]?.message || "Revise os campos da loja.");
    const saved = await writeConfig(result.data.config, result.data.revision);
    return saved ? json({ config: result.data.config, revision: result.data.revision + 1 }) : error("As configurações mudaram em outra aba. Recarregue o painel.", 409);
  }

  if (action === "product") {
    const result = changeProduct.safeParse(payload);
    if (!result.success) return error(result.error.issues[0]?.message || "Revise os dados do produto.");
    const { product: submitted, revision } = result.data;
    const product = hasPlaquePreview(submitted) && !submitted.plaque
      ? { ...submitted, plaque: defaultPlaqueDesign }
      : submitted;
    const { categories } = await readStoreConfig();
    const categoryIds = new Set(categories.map(({ id }) => id));
    if (product.categories.some((id) => !categoryIds.has(id))) {
      return error("Selecione categorias disponíveis na loja.");
    }
    const saved = await writeProduct(product.id, product, revision);
    if (saved === "duplicate") return error("Já existe um produto com esse endereço.", 409);
    return saved === "saved" ? json({ product: { ...product, revision: revision + 1 } }) : error("O catálogo mudou em outra aba. Recarregue o painel.", 409);
  }

  if (action === "remove-product") {
    const result = removeProduct.safeParse(payload);
    if (!result.success) return error("Selecione um produto.");
    const saved = await writeProduct(result.data.id, null, result.data.revision);
    if (saved === "missing") return error("Produto indisponível.", 404);
    return saved === "saved" ? json({ ok: true }) : error("O catálogo mudou em outra aba. Recarregue o painel.", 409);
  }

  if (action === "order-status") {
    const result = z.object({ id: z.uuid(), status: z.enum(["pending", "confirmed", "completed", "cancelled"]) }).safeParse(payload);
    if (!result.success) return error("Confira os dados do pedido.");
    const order = await writeOrderStatus(result.data.id, result.data.status);
    return order ? json({ order }) : error("Pedido indisponível.", 404);
  }

  if (action === "remove-order") {
    const result = z.object({ id: z.uuid() }).safeParse(payload);
    if (!result.success) return error("Selecione um pedido.");
    const deleted = await deleteOrder(result.data.id);
    return deleted === null ? error("Não foi possível apagar o pedido. Tente novamente.", 503) : json({ deleted });
  }

  if (action === "remove-plaque-reference") {
    const result = z.object({ path: z.string().regex(referencePath) }).safeParse(payload);
    if (!result.success) return error("Imagem indisponível.", 404);
    return await deletePlaqueReference(result.data.path) ? json({ ok: true }) : error("Não foi possível apagar a referência. Tente novamente.", 503);
  }

  return error("Página indisponível.", 404);
}
