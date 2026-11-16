export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: {
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow",
  } });
}

export function error(message: string, status = 400) {
  return json({ error: message }, status);
}

export function fromStore(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function readJson(
  request: Request,
  maxBytes: number,
  tooLarge = "Os dados enviados são grandes demais.",
): Promise<{ data: unknown } | { response: Response }> {
  if (Number(request.headers.get("content-length")) > maxBytes) return { response: error(tooLarge, 413) };
  const reader = request.body?.getReader();
  if (!reader) return { response: error("Solicitação inválida.") };

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => {});
        return { response: error(tooLarge, 413) };
      }
      text += decoder.decode(value, { stream: true });
    }
    return { data: JSON.parse(text + decoder.decode()) as unknown };
  } catch {
    void reader.cancel().catch(() => {});
    return { response: error("Solicitação inválida.") };
  } finally {
    reader.releaseLock();
  }
}

export function imageKind(bytes: Uint8Array) {
  const first = (...prefix: number[]) => prefix.every((value, index) => bytes[index] === value);
  if (first(0xff, 0xd8, 0xff)) return { extension: "jpg", type: "image/jpeg" };
  if (first(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { extension: "png", type: "image/png" };
  if (first(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    return { extension: "webp", type: "image/webp" };
  }
  return null;
}
