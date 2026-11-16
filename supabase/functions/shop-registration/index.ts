import { createClient } from "npm:@supabase/supabase-js@2.119.0";

function response(status: number, data: Record<string, unknown>) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response(405, {});
  const key = request.headers.get("x-shop-registration-key") ?? "";
  if (!/^[a-f0-9]{64}$/.test(key)) return response(401, {});
  const body = await request.json().catch(() => null);
  if (!body || !["register", "initialize"].includes(body.action)) return response(400, {});
  const backend = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
  const hash = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const { data: allowed, error } = await backend.rpc("shop_registration_gate", { p_digest: hash, p_count: body.action === "register" });
  if (error || !allowed) return response(429, { error: "Tente novamente em instantes." });

  if (body.action === "initialize") {
    const bucket = "loja-artesanal-fotos";
    const existing = await backend.storage.getBucket(bucket);
    if (existing.data) return response(existing.data.public ? 200 : 409, { ready: existing.data.public });
    const created = await backend.storage.createBucket(bucket, {
      public: true, fileSizeLimit: 4 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    return response(created.error ? 503 : 201, { ready: !created.error });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(username) || password.length < 10 || password.length > 72) {
    return response(400, { error: "Confira o usuário e a senha." });
  }
  const email = "shop-" + username + "@accounts.example.com";
  const created = await backend.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { shop_username: username },
  });
  if (created.error) {
    if (["email_exists","user_already_exists"].includes(created.error.code ?? "")) {
      return response(409, { error: "Este nome de usuário já está em uso." });
    }
    return response(503, { error: "Não foi possível criar a conta. Tente novamente." });
  }
  return response(201, { ok: true });
});
