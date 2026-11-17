"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, BadgeCheck, LogOut, Package, Save } from "lucide-react";
import { cpfMask, formatCpf } from "../../lib/account-model";
import { sendJson } from "../../lib/store-client";
import { money, privacyPath } from "../../lib/store-model";
import { orderStatus, type CustomerProfile, type Order } from "../../lib/order-model";

export function SignOut({ report, label = "Sair", returnTo = "/conta" }: {
  report: (message: string) => void;
  label?: string;
  returnTo?: "/conta" | "/conta?destino=admin";
}) {
  const [busy, setBusy] = useState(false);
  async function exit() {
    setBusy(true);
    try {
      await sendJson("/api/auth/signout", {});
      window.location.assign(returnTo);
    } catch (failure) {
      report((failure as Error).message);
      setBusy(false);
    }
  }
  return <button type="button" className="button button-outline small" onClick={exit} disabled={busy}>
    <LogOut size={16} aria-hidden="true" /> {busy ? "Saindo…" : label}
  </button>;
}

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function OrderDetails({ order, admin = false }: { order: Order; admin?: boolean }) {
  return <details className="account-order">
    <summary><span><strong>Pedido nº {order.number}</strong><small>{date.format(new Date(order.created_at))}</small></span><span className="pill">{orderStatus[order.status]}</span></summary>
    <div className="order-items">
      {admin && <p className="muted">Cliente · {order.name}</p>}
      {admin && (order.customer_email || order.customer_phone) && <p className="muted">{[order.customer_email, order.customer_phone].filter(Boolean).join(" · ")}</p>}
      {order.lines.map((line, index) => <div key={index}><span>{line.quantity} × {line.name}{line.option && <small>{line.option}</small>}{line.reference && <small>Referência {line.reference}</small>}</span><strong>{money(line.price * line.quantity)}</strong></div>)}
      <div><span>Subtotal</span><strong>{money(order.subtotal)}</strong></div>
      <div><span>{order.method === "delivery" ? "Frete" : "Retirada"}</span><span>{order.freight === null ? "A combinar" : money(order.freight)}</span></div>
      {order.total !== null && <div><strong>Total</strong><strong>{money(order.total)}</strong></div>}
      {order.cep && <p className="muted">CEP {order.cep.slice(0, 5)}-{order.cep.slice(5)}</p>}
      {order.note && <p className="muted">{order.note}</p>}
    </div>
  </details>;
}

export function CustomerAccount({ label, verifiedEmail, initial, orders, page, hasMore, destination, justConfirmed }: {
  label: string; verifiedEmail: string | null; initial: CustomerProfile; orders: Order[]; page: number; hasMore: boolean;
  destination: "account" | "checkout"; justConfirmed: boolean;
}) {
  const [profile, setProfile] = useState(initial);
  const [cpf, setCpf] = useState("");
  const [needsName, setNeedsName] = useState(Boolean(verifiedEmail && !initial.name.trim()));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ message: "", error: false });
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus({ message: "", error: false });
    try {
      const data = await sendJson<{ profile: CustomerProfile }>("/api/account/profile", { ...profile, cpf });
      setProfile(data.profile);
      setCpf("");
      if (needsName && destination === "checkout") {
        window.location.assign("/produtos?carrinho=1");
        return;
      }
      setNeedsName(false);
      setStatus({ message: "Dados salvos.", error: false });
    } catch (failure) { setStatus({ message: (failure as Error).message, error: true }); }
    finally { setBusy(false); }
  }
  return <main className="customer-area">
    <div className="wrap account-wrap">
      <div className="account-header"><div><a className="text-link" href="/"><ArrowLeft size={16} aria-hidden="true" /> Voltar à loja</a><h1>Minha conta</h1><p className="muted">{label}</p></div>
        <SignOut report={(message) => setStatus({ message, error: true })} /></div>
      {justConfirmed && verifiedEmail && <p className="account-verified" role="status"><BadgeCheck size={18} aria-hidden="true" /> E-mail confirmado.</p>}
      {destination === "checkout" && !needsName && <a className="button button-outline" href="/produtos?carrinho=1">Voltar ao carrinho</a>}
      <div className="account-grid">
        <section className="admin-box">
          <header><h2>{needsName ? "Complete seu cadastro" : "Meus dados"}</h2></header>
          <form className="admin-stack" onSubmit={save}>
            <fieldset className="bare-fieldset admin-stack" disabled={busy}>
              <label className="field">Nome completo<input autoComplete="name" required={Boolean(verifiedEmail)} minLength={verifiedEmail ? 2 : undefined}
                maxLength={100} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
              <label className="field">{verifiedEmail ? "E-mail confirmado" : "E-mail de contato"}<input type="email" autoComplete="email" maxLength={180}
                readOnly={Boolean(verifiedEmail)} value={verifiedEmail ?? profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
              <label className="field">CPF (opcional)<input inputMode="numeric" autoComplete="off" placeholder={profile.cpfLastDigits ? cpfMask(profile.cpfLastDigits) : "000.000.000-00"}
                maxLength={14} value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} aria-describedby="account-cpf-hint" /></label>
              <p className="muted" id="account-cpf-hint">{profile.cpfLastDigits
                ? `CPF cadastrado com final ${profile.cpfLastDigits}. Preencha o campo se quiser corrigir.`
                : "O CPF ajuda a evitar cadastros duplicados. Guardamos um código protegido e os dois últimos dígitos."}</p>
              <label className="field">Celular com DDD (opcional)<input type="tel" autoComplete="tel" placeholder="(00) 00000-0000"
                maxLength={24} value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
              <label className="field">CEP (opcional)<input inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9}
                value={profile.cep} onChange={(event) => setProfile({ ...profile, cep: event.target.value })} /></label>
              <button className="button"><Save size={17} aria-hidden="true" /> {busy ? "Salvando…" : needsName ? "Salvar cadastro" : "Salvar meus dados"}</button>
            </fieldset>
            <p className="muted privacy-note"><a href={privacyPath} target="_blank" rel="noopener">Política de privacidade</a></p>
          </form>
          {status.message && <p className={status.error ? "form-error" : ""} role={status.error ? "alert" : "status"}>{status.message}</p>}
        </section>
        <section className="admin-box">
          <header><h2>Meus pedidos</h2></header>
          {orders.length ? orders.map((order) => <OrderDetails key={order.id} order={order} />)
            : <p className="muted"><Package size={19} /> Seus pedidos aparecerão aqui depois de salvos.</p>}
          {(page > 0 || hasMore) && <nav className="account-pagination" aria-label="Páginas do histórico">
            {page > 0 && <a className="text-link" href={`/conta?pagina=${page - 1}`}>Anterior</a>}
            {hasMore && <a className="text-link" href={`/conta?pagina=${page + 1}`}>Mais pedidos</a>}
          </nav>}
        </section>
      </div>
    </div>
  </main>;
}
