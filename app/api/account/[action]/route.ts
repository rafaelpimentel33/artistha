import { z } from "zod";
import { getStoreAccount } from "../../../../lib/store-auth";
import { readProfile } from "../../../../lib/store-db";
import { error, fromStore, json, readJson } from "../../../../lib/store-http";
import { profileSchema } from "../../../../lib/store-validation";
import { parseCustomerProfile } from "../../../../lib/order-model";

type Context = { params: Promise<{ action: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { action } = await params;
  if (action !== "profile") return error("Página indisponível.", 404);
  const account = await getStoreAccount();
  if (!account) return error("Entre na sua conta.", 401);
  const profile = await readProfile(account.db);
  if (account.email && !profile.name.trim()) return error("Complete seu cadastro para continuar.", 428);
  return json({ profile });
}

export async function POST(request: Request, { params }: Context) {
  if (!fromStore(request)) return error("Solicitação inválida.", 403);
  const account = await getStoreAccount();
  if (!account) return error("Entre na sua conta.", 401);
  const { action } = await params;
  const body = await readJson(request, 8192);
  if ("response" in body) return body.response;
  const { data: payload } = body;
  if (action === "activate") {
    const result = z.object({ code: z.string().trim().pipe(z.uuid()) }).safeParse(payload);
    if (!result.success) return error("Confira o código de ativação.");
    const { data, error: failure } = await account.db.rpc("shop_activate_owner", { p_code: result.data.code });
    if (failure) return error("Não foi possível ativar o painel.", 503);
    if (data !== true) return error("Código inválido ou painel já ativado.", 409);
    return json({ ok: true });
  }
  if (action === "profile") {
    const result = profileSchema.safeParse(payload);
    if (!result.success) return error(result.error.issues[0]?.message || "Confira seus dados.");
    const { name, email, phone, cep, cpf } = result.data;
    if (account.email && name.length < 2) return error("Informe seu nome completo.");
    const { data, error: failure } = await account.db.rpc("shop_save_customer_profile", {
      p_name: name, p_email: email, p_phone: phone, p_cep: cep, p_cpf: cpf || null,
    });
    if (failure?.message === "cpf_em_uso") return error("Este CPF já está associado a outra conta. Fale com a loja se precisar de ajuda.", 409);
    if (failure?.message === "invalid_cpf") return error("Informe um CPF válido.");
    if (failure?.message === "invalid_profile") return error("Confira os dados do cadastro.");
    const profile = parseCustomerProfile(data);
    if (failure || !profile) return error("Não foi possível salvar seu cadastro.", 503);
    return json({ profile });
  }
  return error("Página indisponível.", 404);
}
