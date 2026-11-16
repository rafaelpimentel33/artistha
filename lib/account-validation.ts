import { z } from "zod";
import { legacyEmailDomain } from "./account-model";

const accountEmail = z.string().trim().toLowerCase().max(180)
  .pipe(z.email({ error: "Informe um e-mail válido." }))
  .refine((email) => !email.endsWith("@" + legacyEmailDomain), "Informe um e-mail que você possa acessar.");

export const accountPassword = z.string().min(10, "Use uma senha com pelo menos 10 caracteres.")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Escolha uma senha mais curta.");

export const newPasswordSchema = z.object({ password: accountPassword, passwordConfirmation: z.string().max(72) })
  .refine(({ password, passwordConfirmation }) => password === passwordConfirmation, {
    path: ["passwordConfirmation"], message: "As senhas precisam ser iguais.",
  });

const login = z.object({
  mode: z.literal("login"),
  identifier: z.string().trim().toLowerCase().min(3).max(180).optional(),
  username: z.string().trim().toLowerCase().min(3).max(24).optional(),
  password: accountPassword,
}).refine((value) => Boolean(value.identifier || value.username), "Informe seu e-mail ou usuário.");

const register = z.object({
  mode: z.literal("register"),
  email: accountEmail, emailConfirmation: accountEmail,
  password: accountPassword, passwordConfirmation: z.string().max(72),
}).superRefine((value, ctx) => {
  if (value.email !== value.emailConfirmation) {
    ctx.addIssue({ code: "custom", path: ["emailConfirmation"], message: "Os e-mails precisam ser iguais." });
  }
  if (value.password !== value.passwordConfirmation) {
    ctx.addIssue({ code: "custom", path: ["passwordConfirmation"], message: "As senhas precisam ser iguais." });
  }
});

export const accountActionSchema = z.discriminatedUnion("mode", [
  login,
  register,
  z.object({ mode: z.literal("resend"), email: accountEmail }),
  z.object({ mode: z.literal("recovery"), email: accountEmail }),
]);

export function loginEmail(identifier: string) {
  if (/^[a-z0-9][a-z0-9_-]{2,23}$/.test(identifier)) return legacyAccountEmail(identifier);
  const result = accountEmail.safeParse(identifier);
  return result.success ? result.data : null;
}

export const legacyAccountEmail = (username: string) => "shop-" + username + "@" + legacyEmailDomain;
