import { publicStoreClient } from "../../../../lib/supabase-public";
import { MEDIA_BUCKET } from "../../../../lib/supabase-config";

const mediaTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const match = /^[a-f0-9-]{36}\.(jpg|png|webp)$/.exec(key);
  if (!match) return new Response(null, { status: 404 });
  const mediaType = mediaTypes[match[1] as keyof typeof mediaTypes];
  const { data } = publicStoreClient().storage.from(MEDIA_BUCKET).getPublicUrl(key);
  const image = await fetch(data.publicUrl, {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!image?.ok || !image.body || image.headers.get("content-type")?.split(";")[0] !== mediaType) {
    return new Response(null, { status: image?.status === 404 ? 404 : 502, headers: { "Cache-Control": "no-store" } });
  }

  return new Response(image.body, {
    headers: {
      "Content-Type": mediaType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
