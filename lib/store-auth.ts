import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { legacyEmailDomain } from "./account-model";
import { legacyAccountEmail } from "./account-validation";
import { authCookieOptions, hasAuthCookie, supabaseAuthConfig } from "./supabase-config";

export async function storeAuthClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseAuthConfig();
  return createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values) cookieStore.set(name, value, options);
        } catch {
          // Server Components read the refreshed cookies set by the proxy.
        }
      },
    },
  });
}

export async function getStoreAccount() {
  if (!hasAuthCookie((await cookies()).getAll())) return null;
  const db = await storeAuthClient();
  const { data, error } = await db.auth.getUser();
  const user = data.user;
  if (error || !user?.email_confirmed_at || !user.email) return null;
  if (user.email.endsWith("@" + legacyEmailDomain)) {
    const username = user.user_metadata?.shop_username;
    if (typeof username !== "string" || user.email !== legacyAccountEmail(username)) return null;
    return { id: user.id, label: username, email: null, db };
  }
  return { id: user.id, label: user.email, email: user.email, db };
}

export async function getAdminAccess(): Promise<"admin" | "signin" | "denied" | "setup"> {
  const account = await getStoreAccount();
  if (!account) return "signin";
  const { data, error } = await account.db.rpc("shop_admin_state");
  if (error) throw new Error("Não foi possível verificar o acesso ao painel.");
  return data === "admin" || data === "setup" ? data : "denied";
}
