"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, MessageCircle, Package, ShoppingBag, Trash2, Truck } from "lucide-react";
import { sendJson } from "../../lib/store-client";
import { checkoutMessage, lineKey, money, privacyPath, shipping, type CartEntry, type CartLine, type Checkout, type Fulfillment, type StoreConfig } from "../../lib/store-model";
import type { CustomerProfile } from "../../lib/order-model";
import { Photo, Quantity } from "./store-ui";

type Props = {
  lines: CartLine[];
  config: StoreConfig;
  change: (entry: CartEntry, quantity: number) => void;
  close: () => void;
  setTitle: (title: string) => void;
  notice: string;
  onSaved: (key: string, entries: CartEntry[]) => void;
};

type CheckoutRequest = { checkout: Checkout; subtotal: number; freight: number | null };
type Draft = CheckoutRequest & { key: string; message: string };
const checkoutAttempt = "artistha:checkout-attempt:v1";

function orderKey(fingerprint: string) {
  try {
    const previous = JSON.parse(sessionStorage.getItem(checkoutAttempt) ?? "null") as { fingerprint?: string; key?: string } | null;
    if (previous?.fingerprint === fingerprint && typeof previous.key === "string") return previous.key;
  } catch { /* Storage can be unavailable or contain invalid data. */ }
  const key = crypto.randomUUID();
  try { sessionStorage.setItem(checkoutAttempt, JSON.stringify({ fingerprint, key })); } catch { /* Use the key for the current draft. */ }
  return key;
}

export function Cart({ lines, config, change, close, setTitle, notice, onSaved }: Props) {
  const [stage, setStage] = useState<"cart" | "checkout" | "review" | "saved">("cart");
  const [method, setMethod] = useState<Fulfillment>(config.delivery ? "delivery" : "pickup");
  const [name, setName] = useState("");
  const [cep, setCep] = useState("");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<{ number: number; url: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const saving = useRef(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const freight = shipping(config, subtotal, method);

  function show(next: typeof stage) {
    setStatus("");
    setStage(next);
    setTitle(next === "cart" ? "Seu carrinho" : next === "checkout" ? "Dados do pedido" : next === "review" ? "Revise o pedido" : "Pedido salvo");
  }

  async function startCheckout() {
    setBusy(true);
    setStatus("");
    try {
      const result = await fetch("/api/account/profile", { cache: "no-store" });
      if (result.status === 401 || result.status === 428) { window.location.assign("/conta?destino=checkout"); return; }
      if (!result.ok) throw new Error("Não foi possível carregar seus dados.");
      const { profile } = await result.json() as { profile: CustomerProfile };
      setName((value) => value || profile.name);
      setCep((value) => value || profile.cep);
      show("checkout");
    } catch (failure) { setStatus((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) { setStatus("Informe seu nome."); return; }
    const postalCode = method === "delivery" ? cep.replace(/\D/g, "") : "";
    if (method === "delivery" && postalCode.length !== 8) { setStatus("Informe um CEP com 8 dígitos."); return; }
    if (!lines.length) { setStatus("Adicione um produto ao carrinho."); return; }
    const checkout: Checkout = { name: cleanName, method, cep: postalCode, note: note.trim(),
      entries: lines.map(({ productId, variantId, quantity, reference }) => ({ productId, variantId, quantity, reference })) };
    const payload = { checkout, subtotal, freight };
    setBusy(true);
    setStatus("");
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      const fingerprint = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
      if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: orderKey(fingerprint) };
      setDraft({ ...payload, key: attempt.current.key, message: checkoutMessage(config, checkout, lines) });
      show("review");
    } catch { setStatus("Não foi possível preparar o pedido. Tente novamente."); }
    finally { setBusy(false); }
  }

  async function saveOrder() {
    if (!draft || saving.current) return;
    saving.current = true;
    setStatus("");
    setBusy(true);
    try {
      const data = await sendJson<{ number: number; url: string; message: string }>("/api/checkout", {
        key: draft.key, checkout: draft.checkout, subtotal: draft.subtotal, freight: draft.freight,
      });
      setSaved(data);
      show("saved");
      onSaved(draft.key, draft.checkout.entries);
      attempt.current = null;
      try { sessionStorage.removeItem(checkoutAttempt); } catch { /* The order was already saved. */ }
    } catch (failure) { setStatus((failure as Error).message); }
    finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function copyMessage() {
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(saved.message);
      setCopied(true);
    } catch {
      setStatus("Selecione o resumo acima e copie o texto.");
    }
  }

  if (stage === "saved" && saved) {
    return <div className="panel-scroll checkout-form">
      <p className="muted">Pedido nº {saved.number} salvo no seu histórico.</p>
      <label className="field">Resumo do pedido<textarea className="order-message" rows={10} value={saved.message} readOnly /></label>
      {saved.url && <a className="button full" href={saved.url} target="_blank" rel="noopener noreferrer"><MessageCircle size={19} /> Abrir WhatsApp</a>}
      <button className="button button-outline full" onClick={copyMessage}>{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? "Resumo copiado" : "Copiar resumo"}</button>
      <a className="text-link" href="/conta">Ver meus pedidos <ArrowRight size={16} /></a>
      {status && <p role="alert" className="form-error">{status}</p>}
    </div>;
  }

  if (stage === "review" && draft) {
    return <div className="panel-scroll checkout-form">
      <button className="text-link back-button" disabled={busy} onClick={() => show("checkout")}><ArrowLeft size={17} /> Editar dados</button>
      <label className="field">Resumo do pedido<textarea className="order-message" rows={11} value={draft.message} readOnly /></label>
      <button className="button full" disabled={busy} onClick={saveOrder}>{busy ? "Salvando…" : "Salvar pedido"} <ArrowRight size={18} /></button>
      {config.whatsapp && <p className="muted">Depois de salvar, você poderá enviar o pedido pelo WhatsApp.</p>}
      {status && <p role="alert" className="form-error">{status}</p>}
    </div>;
  }

  if (!lines.length) {
    return <div className="empty-cart"><ShoppingBag size={39} strokeWidth={1.25} /><h3>Seu carrinho está vazio</h3><p>Encontre uma peça para sua casa ou para presentear.</p><button className="button" onClick={close}>Continuar na loja</button></div>;
  }

  if (stage === "checkout") {
    return <form className="panel-scroll checkout-form" onSubmit={prepare}>
      <button type="button" className="text-link back-button" onClick={() => show("cart")}><ArrowLeft size={17} /> Voltar ao carrinho</button>
      <label className="field">Seu nome<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
      <fieldset className="delivery-options">
        <legend>Como deseja receber?</legend>
        {config.delivery && <label className={method === "delivery" ? "chosen" : ""}><input type="radio" name="delivery" checked={method === "delivery"} onChange={() => setMethod("delivery")} /><Truck size={18} /> Entrega</label>}
        {config.pickup && <label className={method === "pickup" ? "chosen" : ""}><input type="radio" name="delivery" checked={method === "pickup"} onChange={() => setMethod("pickup")} /><Package size={18} /> Retirada</label>}
      </fieldset>
      {method === "delivery" && <label className="field">CEP<input autoComplete="postal-code" inputMode="numeric" placeholder="00000-000" value={cep} onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
        setCep(digits.length > 5 ? digits.slice(0, 5) + "-" + digits.slice(5) : digits);
      }} required /></label>}
      <label className="field">Observações <span className="muted">(opcional)</span><textarea value={note} rows={3} maxLength={500} onChange={(event) => setNote(event.target.value)} /></label>
      <div className="checkout-totals">
        <div><span>Subtotal</span><span>{money(subtotal)}</span></div>
        {method === "delivery" && <div><span>Frete</span><span>{freight === null ? "A combinar" : freight === 0 ? "Grátis" : money(freight)}</span></div>}
        {freight !== null && <div className="total-line"><strong>Total</strong><strong>{money(subtotal + freight)}</strong></div>}
      </div>
      {status && <p className="form-error" role="alert">{status}</p>}
      <p className="muted privacy-note">Usamos esses dados para preparar seu pedido. <a href={privacyPath} target="_blank" rel="noopener">Política de privacidade</a>.</p>
      <button className="button full" disabled={busy}>{busy ? "Preparando…" : "Revisar pedido"} <ArrowRight size={18} /></button>
    </form>;
  }

  return <>
    {notice && <div className="cart-notice" role="status">{notice}</div>}
    <div className="panel-scroll cart-list">
      {lines.map((line) => <article className="cart-item" key={lineKey(line)}>
        <a className="cart-photo" href={"/produtos/" + line.slug}><Photo src={line.image} alt={line.name} /></a>
        <div className="cart-item-info">
          <a href={"/produtos/" + line.slug}>{line.name}</a>
          {line.option && <p>{line.option}</p>}
          {line.reference && <p>Imagem de referência anexada</p>}
          <strong>{money(line.price * line.quantity)}</strong>
          <Quantity count={line.quantity} max={line.limit} onChange={(value) => change(line, value)} />
        </div>
        <button className="icon-button cart-remove" aria-label={`Remover ${line.name}`} onClick={() => change(line, 0)}><Trash2 size={17} strokeWidth={1.5} /></button>
      </article>)}
    </div>
    <div className="cart-bottom">
      <div className="total-line"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
      {config.delivery && <p className="muted">{config.freeOver !== null && subtotal >= config.freeOver ? "Seu pedido tem frete grátis." : "O frete será exibido na próxima etapa."}</p>}
      {status && <p role="alert" className="form-error">{status}</p>}
      <button className="button full" disabled={busy} onClick={startCheckout}>{busy ? "Carregando…" : "Finalizar pedido"} <ArrowRight size={18} /></button>
      <button className="text-link keep-shopping" onClick={close}>Continuar na loja</button>
    </div>
  </>;
}
