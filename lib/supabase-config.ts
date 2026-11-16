import "server-only";

export const MEDIA_BUCKET = "loja-artesanal-fotos";
export const PLAQUE_REFERENCE_BUCKET = "loja-placa-referencias";

export function supabaseAuthConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error("Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.");
  return { url, key };
}

export const authCookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

export function hasAuthCookie(cookies: Array<{ name: string }>) {
  return cookies.some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));
}
