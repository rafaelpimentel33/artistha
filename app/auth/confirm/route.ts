import { clearPasswordReset, grantPasswordReset } from "../../../lib/account-recovery";
import { storeAuthClient } from "../../../lib/store-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const flowId = url.searchParams.get("sb_flow_id");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const client = await storeAuthClient();
  await clearPasswordReset();
  const confirmation = tokenHash && tokenHash.length <= 512 && (type === "email" || type === "signup" || type === "recovery")
    ? await client.auth.verifyOtp({ token_hash: tokenHash, type })
    : null;
  const exchange = !confirmation && code && code.length <= 240
    ? await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
    : null;
  const user = confirmation?.data.user ?? exchange?.data.user;
  const exchangeData = exchange?.data;
  const recovered = confirmation ? type === "recovery"
    : exchangeData && "redirectType" in exchangeData && exchangeData.redirectType === "recovery";
  let target = "/conta?aviso=link";
  if (user?.email_confirmed_at) {
    if (!recovered) target = "/conta?aviso=confirmado";
    else if (await grantPasswordReset(user.id)) target = "/conta/redefinir-senha";
  }
  return new Response(null, {
    status: 303,
    headers: { Location: target, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" },
  });
}
