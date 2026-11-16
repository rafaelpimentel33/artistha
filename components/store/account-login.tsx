"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Eye, EyeOff, MailCheck } from "lucide-react";
import { sendJson } from "../../lib/store-client";
import { privacyPath } from "../../lib/store-model";

type Brand = { name: string; logo: string };
type Destination = "account" | "admin" | "checkout";
type Mode = "login" | "register" | "resend" | "recovery";
type Feedback = { text: string; error: boolean };

function AccountEntry({ brand, title, children, back = "/" }: {
  brand: Brand; title: string; children: ReactNode; back?: string;
}) {
  return <main className="access-page account-entry-page">
    <section className="account-entry" aria-labelledby="account-entry-title">
      <div className="account-entry-art">
        <a href="/" className="account-entry-mark" aria-label={`${brand.name} — início`}>
          {brand.logo ? <img src={brand.logo} alt={brand.name} /> : <span>{brand.name}</span>}
        </a>
      </div>
      <div className="account-entry-content">
        <a className="text-link account-entry-back" href={back}><ArrowLeft size={16} aria-hidden="true" />{back === "/conta" ? "Voltar para entrar" : "Voltar à loja"}</a>
        <h1 id="account-entry-title">{title}</h1>
        {children}
      </div>
    </section>
  </main>;
}

function PasswordField({ label, value, change, current = false }: {
  label: string; value: string; change: (value: string) => void; current?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const fieldName = label.startsWith("Confirme") ? "confirmação da senha" : label.toLowerCase();
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <span className="account-password">
      <input id={id} required type={visible ? "text" : "password"} minLength={current ? undefined : 10} maxLength={72}
        autoComplete={current ? "current-password" : "new-password"} value={value} onChange={(event) => change(event.target.value)} />
      <button type="button" className="icon-button" aria-label={`${visible ? "Ocultar" : "Mostrar"} ${fieldName}`} aria-controls={id}
        onClick={() => setVisible(!visible)}>
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </span>
  </div>;
}

const notices: Record<string, string> = {
  confirmado: "E-mail confirmado. Entre para acessar sua conta.",
  link: "Se você abriu o link em outro navegador, tente entrar com seu e-mail e senha. Se o link expirou, solicite outro.",
  senha: "Senha alterada. Entre com a nova senha.",
};

export function AccountLogin({ brand, destination, productReturn, notice, startRecovery = false }: {
  brand: Brand; destination: Destination; productReturn?: string; notice?: string; startRecovery?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(startRecovery ? "recovery" : "login");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(
    notice && Object.hasOwn(notices, notice) ? { text: notices[notice], error: false } : null,
  );
  const [waiting, setWaiting] = useState<"confirmation" | "recovery" | null>(null);
  const registration = mode === "register";
  const login = mode === "login";

  function changeMode(next: Mode) {
    if (next === "login" && email) setIdentifier(email);
    if (mode === "login" && identifier.includes("@")) setEmail(identifier);
    setMode(next);
    setPassword("");
    setPasswordConfirmation("");
    setEmailConfirmation("");
    setFeedback(null);
    setWaiting(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const data = login ? { mode, identifier, password }
        : registration ? { mode, email, emailConfirmation, password, passwordConfirmation } : { mode, email };
      await sendJson("/api/auth/session", data);
      if (login) {
        window.location.assign(productReturn ?? (destination === "admin" ? "/admin" : destination === "checkout" ? "/produtos?carrinho=1" : "/conta"));
        return;
      }
      setPassword("");
      setPasswordConfirmation("");
      setWaiting(mode === "recovery" ? "recovery" : "confirmation");
    } catch (failure) {
      setFeedback({ text: (failure as Error).message, error: true });
    } finally { setBusy(false); }
  }

  const title = waiting === "confirmation" ? "Confirme seu e-mail" : waiting === "recovery" ? "Confira seu e-mail"
    : registration ? "Criar conta" : mode === "recovery" ? "Recuperar senha" : mode === "resend" ? "Reenviar confirmação" : "Minha conta";
  return <AccountEntry brand={brand} title={title} back={productReturn}>
    {waiting ? <>
      <div className="account-email-status" role="status">
        <MailCheck size={24} aria-hidden="true" />
        <p>{waiting === "confirmation"
          ? "Confira a caixa de entrada e o spam. Abra o link para confirmar o e-mail e preencher seus dados."
          : "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Abra-o neste navegador."}</p>
      </div>
      <button className="button button-outline" onClick={() => changeMode(waiting === "confirmation" ? "resend" : "recovery")}>
        {waiting === "confirmation" ? "Reenviar confirmação" : "Solicitar outro link"}
      </button>
      <button className="text-link" onClick={() => changeMode("login")}>Voltar para entrar</button>
    </> : <>
      {(login || registration) && <div className="account-entry-modes" aria-label="Acesso à conta" role="group">
        <button type="button" aria-pressed={login} onClick={() => changeMode("login")} disabled={busy}>Entrar</button>
        <button type="button" aria-pressed={registration} onClick={() => changeMode("register")} disabled={busy}>Criar conta</button>
      </div>}
      <p className="muted">{registration ? "Confirme seu e-mail para completar o cadastro com nome, CPF e telefone."
        : login ? (productReturn ? "Entre para anexar a referência da sua placa." : "Acesse seus dados e acompanhe seus pedidos.")
        : mode === "recovery" ? "Informe o e-mail confirmado no cadastro." : "Informe o e-mail usado para criar a conta."}</p>
      <form className="access-form" onSubmit={submit}>
        <fieldset className="bare-fieldset account-entry-fields" disabled={busy}>
          {login ? <label className="field">E-mail ou usuário<input required minLength={3} maxLength={180}
            autoCapitalize="none" autoComplete="username" spellCheck={false} value={identifier}
            onChange={(event) => setIdentifier(event.target.value)} /></label> :
            <label className="field">E-mail<input required type="email" maxLength={180} autoComplete="email"
              value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
          {registration && <label className="field">Confirme o e-mail<input required type="email" maxLength={180}
            autoComplete="off" value={emailConfirmation} onChange={(event) => setEmailConfirmation(event.target.value)} /></label>}
          {(login || registration) && <PasswordField key={mode} label="Senha" value={password} change={setPassword} current={login} />}
          {registration && <>
            <PasswordField label="Confirme a senha" value={passwordConfirmation} change={setPasswordConfirmation} />
            <p className="muted">Use pelo menos 10 caracteres.</p>
          </>}
          <button className="button full">{busy ? "Aguarde…" : login ? "Entrar" : registration ? "Enviar confirmação"
            : mode === "recovery" ? "Enviar link" : "Reenviar e-mail"}</button>
        </fieldset>
      </form>
      {feedback && <p className={feedback.error ? "form-error" : ""} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
      {login ? <div className="account-entry-links">
        <button className="text-link" onClick={() => changeMode("recovery")} disabled={busy}>Esqueci a senha</button>
        <button className="text-link" onClick={() => changeMode("resend")} disabled={busy}>Reenviar confirmação</button>
      </div> : !registration && <button className="text-link" onClick={() => changeMode("login")} disabled={busy}>Voltar para entrar</button>}
      <p className="muted privacy-note"><a href={privacyPath} target="_blank" rel="noopener">Política de privacidade</a></p>
    </>}
  </AccountEntry>;
}

export function ResetPassword({ brand }: { brand: Brand }) {
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await sendJson("/api/auth/reset-password", { password, passwordConfirmation });
      window.location.assign("/conta?aviso=senha");
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  }

  return <AccountEntry brand={brand} title="Redefinir senha" back="/conta">
    <form className="access-form" onSubmit={submit}>
      <fieldset className="bare-fieldset account-entry-fields" disabled={busy}>
        <PasswordField label="Nova senha" value={password} change={setPassword} />
        <PasswordField label="Confirme a nova senha" value={passwordConfirmation} change={setPasswordConfirmation} />
        <p className="muted">Use pelo menos 10 caracteres.</p>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="button full">{busy ? "Salvando…" : "Salvar nova senha"}</button>
      </fieldset>
    </form>
  </AccountEntry>;
}
