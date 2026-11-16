import { storeAuthClient } from "../../../../lib/store-auth";
import { clearPasswordReset } from "../../../../lib/account-recovery";
import { error, fromStore, json } from "../../../../lib/store-http";

export async function POST(request: Request) {
  if (!fromStore(request)) return error("Solicitação inválida.", 403);
  const auth = await storeAuthClient();
  const { error: failure } = await auth.auth.signOut({ scope: "local" });
  if (failure) return error("Não foi possível encerrar a sessão. Tente novamente.", 503);
  await clearPasswordReset();
  return json({ ok: true });
}
