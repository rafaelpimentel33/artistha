import { canResetPassword, clearPasswordReset } from "../../../../lib/account-recovery";
import { newPasswordSchema } from "../../../../lib/account-validation";
import { getStoreAccount } from "../../../../lib/store-auth";
import { error, fromStore, json, readJson } from "../../../../lib/store-http";

export async function POST(request: Request) {
  if (!fromStore(request)) return error("Solicitação inválida.", 403);
  const account = await getStoreAccount();
  if (!account || !await canResetPassword(account.id)) return error("Solicite um novo link para redefinir sua senha.", 401);
  const body = await readJson(request, 4096);
  if ("response" in body) return body.response;
  const result = newPasswordSchema.safeParse(body.data);
  if (!result.success) return error(result.error.issues[0]?.message || "Confira a nova senha.");
  const { error: failure } = await account.db.auth.updateUser({ password: result.data.password });
  if (failure?.code === "same_password") return error("Escolha uma senha diferente da anterior.");
  if (failure?.code === "weak_password") return error("Escolha uma senha mais forte.");
  if (failure) return error("Não foi possível alterar a senha. Solicite outro link.", 503);

  await clearPasswordReset();
  await account.db.auth.signOut({ scope: "global" });
  return json({ ok: true });
}
