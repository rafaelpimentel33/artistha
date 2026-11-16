import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { authCookieOptions } from "./supabase-config";

const recoveryCookie = "artistha-recovery";
const recoverySeconds = 15 * 60;

function recoverySignature(id: string, expires: number) {
  const key = process.env.SHOP_REGISTRATION_KEY;
  return key ? createHmac("sha256", key).update(`artistha-password-reset:v1:${id}:${expires}`).digest("hex") : "";
}

export async function grantPasswordReset(id: string) {
  const expires = Math.floor(Date.now() / 1000) + recoverySeconds;
  const signature = recoverySignature(id, expires);
  if (!signature) return false;
  (await cookies()).set(recoveryCookie, `${expires}.${signature}`, { ...authCookieOptions, maxAge: recoverySeconds });
  return true;
}

export async function canResetPassword(id: string) {
  const ticket = (await cookies()).get(recoveryCookie)?.value;
  const match = /^(\d{1,12})\.([a-f0-9]{64})$/.exec(ticket ?? "");
  if (!match || Number(match[1]) <= Date.now() / 1000) return false;
  const expected = recoverySignature(id, Number(match[1]));
  return Boolean(expected) && timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(match[2], "hex"));
}

export async function clearPasswordReset() {
  (await cookies()).delete(recoveryCookie);
}
