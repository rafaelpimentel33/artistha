import "server-only";

import { storeAuthClient } from "./store-auth";
import type { PlaqueReferenceItem } from "./plaque-reference-model";
import { PLAQUE_REFERENCE_BUCKET } from "./supabase-config";

export async function listPlaqueReferences(page: number, search: string) {
  const db = await storeAuthClient();
  const { data, error } = await db.rpc("shop_list_plaque_references", { p_page: page, p_search: search });
  if (error) throw new Error("Não foi possível carregar as referências.");
  const items = (data ?? []) as PlaqueReferenceItem[];
  return { items: items.slice(0, 25), hasMore: items.length > 25 };
}

export async function plaqueReferenceDownload(path: string) {
  const db = await storeAuthClient();
  const bucket = db.storage.from(PLAQUE_REFERENCE_BUCKET);
  const info = await bucket.info(path);
  if (info.error || !info.data) return null;
  const extension = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[info.data.contentType ?? ""];
  const name = `referencia-${path.split("/").at(-1)}${extension ? `.${extension}` : ""}`;
  const { data, error } = await bucket.createSignedUrl(path, 60, { download: name });
  if (error || !data) return null;
  return data.signedUrl;
}

export async function deletePlaqueReference(path: string) {
  const db = await storeAuthClient();
  const { error } = await db.storage.from(PLAQUE_REFERENCE_BUCKET).remove([path]);
  return !error;
}
