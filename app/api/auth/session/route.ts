import { accountActionSchema, loginEmail } from "../../../../lib/account-validation";
import { clearPasswordReset } from "../../../../lib/account-recovery";
import { storeAuthClient } from "../../../../lib/store-auth";
import { error, fromStore, json, readJson } from "../../../../lib/store-http";
import { absoluteUrl } from "../../../../lib/store-seo";

export async function POST(request: Request) {
  if (!fromStore(request)) return error("Solicitação inválida.", 403);
  const body = await readJson(request, 4096);
  if ("response" in body) return body.response;
  const parsed = accountActionSchema.safeParse(body.data);
  if (!parsed.success) return error(parsed.error.issues[0]?.message || "Confira os dados de acesso.");

  const action = parsed.data;
  const client = await storeAuthClient();
  const auth = client.auth;
  if (action.mode === "login") {
    const email = loginEmail(action.identifier || action.username || "");
    if (!email) return error("Informe um e-mail ou usuário válido.");
    const { error: failure } = await auth.signInWithPassword({ email, password: action.password });
    if (failure?.status === 429) return error("Aguarde antes de tentar novamente.", 429);
    if (failure?.code === "email_not_confirmed") return error("Confirme seu e-mail antes de entrar.", 403);
    if (failure) return error("E-mail, usuário ou senha inválidos.", 401);
    await clearPasswordReset();
    return json({ ok: true });
  }

  const redirect = absoluteUrl("/auth/confirm");
  if (action.mode === "register") {
    const { data, error: failure } = await auth.signUp({
      email: action.email, password: action.password, options: { emailRedirectTo: redirect },
    });
    if (data.session) {
      await auth.signOut({ scope: "local" });
      return error("A confirmação de e-mail está indisponível no momento.", 503);
    }
    if (!failure || ["user_already_exists", "email_exists"].includes(failure.code ?? "")) return json({ ok: true });
    return mailError(failure);
  }

  const { error: failure } = action.mode === "resend"
    ? await auth.resend({ email: action.email, type: "signup", options: { emailRedirectTo: redirect } })
    : await auth.resetPasswordForEmail(action.email, { redirectTo: redirect });
  if (!failure || failure.code === "user_not_found") return json({ ok: true });
  return mailError(failure);
}

function mailError(failure: { status?: number; code?: string }) {
  if (failure.status === 429) return error("Aguarde alguns minutos antes de solicitar outro e-mail.", 429);
  if (failure.code === "weak_password") return error("Escolha uma senha mais forte.", 400);
  return error("O envio de e-mails está indisponível. Tente novamente mais tarde.", 503);
}
