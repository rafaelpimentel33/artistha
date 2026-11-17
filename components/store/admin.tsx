"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, ExternalLink, FileText, Image, Images, LayoutGrid, LockKeyhole, MessageCircle, Package, Palette, ReceiptText, Save, Settings2, ShoppingBag } from "lucide-react";
import { sendJson } from "../../lib/store-client";
import type { AdminData, AdminProduct, StoreConfig } from "../../lib/store-model";
import { newProduct, ProductEditor, ProductsTable } from "./admin-products";
import { Settings, type SettingTab, type UpdateConfig } from "./admin-settings";
import { SignOut } from "./account";
import { AdminOrders } from "./admin-orders";
import { AdminPlaqueReferences } from "./admin-plaque-references";

type Tab = SettingTab | "products" | "orders" | "plaque-references";
const tabs = [
  { id: "products", title: "Produtos", icon: Package },
  { id: "orders", title: "Pedidos", icon: ReceiptText },
  { id: "plaque-references", title: "Referências de placas", icon: Image },
  { id: "categories", title: "Categorias", icon: LayoutGrid },
  { id: "home", title: "Vitrine", icon: Images },
  { id: "identity", title: "Identidade", icon: Palette },
  { id: "checkout", title: "Checkout", icon: MessageCircle },
  { id: "pages", title: "Páginas e contato", icon: FileText },
] as const;

export function AdminSetup() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setBusy(true);
    try {
      await sendJson("/api/account/activate", { code });
      window.location.assign("/admin");
    } catch (failure) {
      setStatus((failure as Error).message);
      setBusy(false);
    }
  }
  return <main className="access-page"><div className="access-card">
    <LockKeyhole size={32} strokeWidth={1.5} />
    <h1>Ativação da loja</h1>
    <form className="access-form" onSubmit={activate}>
      <p>Use o código de ativação disponível no Vault do projeto Supabase para vincular esta conta ao painel.</p>
      <label className="field">Código de ativação<input type="password" autoComplete="off" maxLength={36} required value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <button className="button full" disabled={busy}>{busy ? "Ativando…" : "Ativar painel"}</button>
    </form>
    {status && <p className="form-error" role="alert">{status}</p>}
    <a className="text-link" href="/"><ArrowLeft size={17} /> Voltar à loja</a>
  </div></main>;
}

export function AdminAccessDenied() {
  const [failure, setFailure] = useState("");

  return <main className="access-page"><section className="access-card" aria-labelledby="admin-access-title">
    <LockKeyhole size={32} strokeWidth={1.5} aria-hidden="true" />
    <h1 id="admin-access-title">Acesso ao painel</h1>
    <p>Você está com uma conta de cliente. Para abrir o painel, entre com a conta administradora.</p>
    <SignOut label="Trocar de conta" returnTo="/conta?destino=admin" report={setFailure} />
    {failure && <p className="form-error" role="alert">{failure}</p>}
    <a className="text-link" href="/conta"><ArrowLeft size={17} aria-hidden="true" /> Minha conta</a>
  </section></main>;
}

export function Admin({ initial }: { initial: AdminData }) {
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState(initial.products);
  const [config, setConfig] = useState(initial.config);
  const [revision, setRevision] = useState(initial.revision);
  const [savedCategories, setSavedCategories] = useState(initial.config.categories);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", error: false });

  const update: UpdateConfig = (key, value) => {
    setConfig((previous) => ({ ...previous, [key]: typeof value === "function" ? value(previous[key]) : value }));
    setDirty(true);
    setFeedback({ message: "", error: false });
  };

  async function save() {
    setBusy(true);
    setFeedback({ message: "", error: false });
    try {
      const payload = { ...config, announcements: config.announcements.map((item) => item.trim()).filter(Boolean) };
      const data = await sendJson<{ config: StoreConfig; revision: number }>("/api/manage/settings", { config: payload, revision });
      setConfig(data.config);
      setRevision(data.revision);
      setSavedCategories(data.config.categories);
      setDirty(false);
      setFeedback({ message: "Alterações salvas na loja.", error: false });
    } catch (failure) { setFeedback({ message: (failure as Error).message, error: true }); }
    finally { setBusy(false); }
  }

  function select(tab: Tab) {
    setTab(tab);
    setEditing(null);
    setFeedback({ message: "", error: false });
    window.scrollTo({ top: 0 });
  }

  function open(product: AdminProduct) {
    setEditing(product);
    setFeedback({ message: "", error: false });
    window.scrollTo({ top: 0 });
  }

  function saved(product: AdminProduct) {
    setProducts((previous) => previous.some((item) => item.id === product.id) ? previous.map((item) => item.id === product.id ? product : item) : [product, ...previous]);
    setEditing(null);
    setFeedback({ message: "Produto salvo.", error: false });
    window.scrollTo({ top: 0 });
  }

  function removed(id: string) {
    setProducts((previous) => previous.filter((product) => product.id !== id));
    setEditing(null);
    setFeedback({ message: "Produto removido do catálogo.", error: false });
    window.scrollTo({ top: 0 });
  }

  const active = tabs.find((item) => item.id === tab);
  const settingsTab = tab !== "products" && tab !== "orders" && tab !== "plaque-references";
  const title = editing ? editing.name || "Novo produto" : active?.title;

  return <div className="admin-shell">
    <header className="admin-header">
      <span className="admin-brand"><ShoppingBag size={23} strokeWidth={1.55} /><span>{config.name}<small>Painel da loja</small></span></span>
      <div className="admin-header-actions">
        <a className="button button-outline small" href="/" target="_blank" rel="noopener noreferrer">Ver loja <ExternalLink size={15} /></a>
        <SignOut report={(message) => setFeedback({ message, error: true })} />
      </div>
    </header>
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <nav aria-label="Seções do painel">
          {tabs.map(({ id, title, icon: Icon }) => <button className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} type="button" key={id} disabled={busy} onClick={() => select(id)}><Icon size={19} strokeWidth={1.7} /> {title}</button>)}
        </nav>
      </aside>
      <main className="admin-main">
        <div className="admin-heading">
          <h1>{title}</h1>
          {settingsTab && <button className="button" disabled={busy || !dirty} onClick={save}><Save size={17} /> {busy ? "Salvando…" : "Salvar alterações"}</button>}
        </div>
        {feedback.message && <p className={`admin-feedback${feedback.error ? " form-error" : " success"}`} role={feedback.error ? "alert" : "status"}>{feedback.message}</p>}
        {!initial.config.whatsapp && !config.whatsapp && tab === "products" && !editing && <div className="admin-callout">
          <Settings2 size={21} strokeWidth={1.6} /><span>Adicione seu número para receber pedidos pelo WhatsApp.</span><button className="text-link" onClick={() => select("checkout")}>Configurar checkout</button>
        </div>}
        {tab === "products" && (editing
          ? <ProductEditor key={editing.id} product={editing} categories={savedCategories} storeColors={config} onSave={saved} onRemove={removed} onClose={() => setEditing(null)} />
          : <ProductsTable products={products} categories={savedCategories} open={open} create={() => open(newProduct())} />)}
        {settingsTab && <fieldset disabled={busy} className="bare-fieldset"><Settings tab={tab} config={config} products={products} update={update} /></fieldset>}
        {tab === "orders" && <AdminOrders />}
        {tab === "plaque-references" && <AdminPlaqueReferences />}
      </main>
    </div>
  </div>;
}
