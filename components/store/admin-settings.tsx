"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { homeSections, slugify, type AdminProduct, type HomeSection, type Slide, type StoreConfig } from "../../lib/store-model";
import { Area, Field, MediaField, Numeric, OrderButtons, reorder, SettingsBox, Text, Toggle } from "./admin-fields";

export type SettingTab = "categories" | "home" | "identity" | "checkout" | "pages";
export type UpdateConfig = <K extends keyof StoreConfig>(key: K, value: StoreConfig[K] | ((previous: StoreConfig[K]) => StoreConfig[K])) => void;
const sectionLabels: Record<HomeSection, string> = { intro: "Apresentação", new: "Lançamentos", featured: "Destaques", materials: "Materiais", spotlight: "Produto em evidência", promo: "Banner secundário", sale: "Ofertas" };

function Categories({ config, update }: { config: StoreConfig; update: UpdateConfig }) {
  const [name, setName] = useState("");
  const [warning, setWarning] = useState("");
  function add() {
    const id = slugify(name);
    if (!id) return;
    if (config.categories.some((category) => category.id === id)) { setWarning("Já existe uma categoria com esse endereço."); return; }
    update("categories", [...config.categories, { id, name: name.trim() }]);
    setName("");
    setWarning("");
  }
  return <SettingsBox title="Categorias do catálogo" help="A ordem abaixo aparece no menu e nos filtros da loja.">
    <div className="admin-stack">
      {config.categories.map((category, index) => <div className="category-edit" key={category.id}>
        <Text label="Nome da categoria" value={category.name} onChange={(name) => update("categories", config.categories.map((item) => item.id === category.id ? { ...item, name } : item))} />
        <OrderButtons label={category.name} up={index > 0 ? () => update("categories", reorder(config.categories, index, -1)) : undefined}
          down={index < config.categories.length - 1 ? () => update("categories", reorder(config.categories, index, 1)) : undefined} />
        <button type="button" className="icon-button danger" aria-label={`Remover categoria ${category.name}`} onClick={() => update("categories", config.categories.filter((item) => item.id !== category.id))}><Trash2 size={18} /></button>
      </div>)}
      <div className="admin-inline">
        <Text label="Nova categoria" value={name} onChange={setName} placeholder="Ex. Decoração" />
        <button className="button button-outline" type="button" disabled={!slugify(name) || config.categories.length >= 80} onClick={add}><Plus size={18} /> Adicionar</button>
      </div>
      {warning && <p className="form-error" role="alert">{warning}</p>}
    </div>
  </SettingsBox>;
}

function Banners({ config, update }: { config: StoreConfig; update: UpdateConfig }) {
  function edit(id: string, change: Partial<Slide>) {
    update("banners", (previous) => previous.map((item) => item.id === id ? { ...item, ...change } : item));
  }
  return <SettingsBox title="Carrossel de abertura" help="Use imagens horizontais de 1920 × 900 no computador e verticais de 820 × 1000 no celular.">
    <Toggle label="Alternar banners automaticamente" checked={config.bannerAuto} onChange={(value) => update("bannerAuto", value)} />
    <div className="admin-stack banners-edit">
      {config.banners.map((slide, index) => <div className="admin-subbox" key={slide.id}>
        <div className="subbox-top"><h3>Banner {index + 1}</h3>
          <OrderButtons label={`banner ${index + 1}`} up={index > 0 ? () => update("banners", reorder(config.banners, index, -1)) : undefined}
            down={index < config.banners.length - 1 ? () => update("banners", reorder(config.banners, index, 1)) : undefined} />
          <button type="button" className="icon-button danger" aria-label={`Remover banner ${index + 1}`} onClick={() => update("banners", config.banners.filter((item) => item.id !== slide.id))}><Trash2 size={18} /></button>
        </div>
        <Text label="Descrição da imagem" value={slide.label} onChange={(label) => edit(slide.id, { label })} />
        <div className="admin-grid">
          <MediaField label="Foto para computador" value={slide.desktop} onChange={(desktop) => edit(slide.id, { desktop })} />
          <MediaField label="Foto para celular" value={slide.mobile} onChange={(mobile) => edit(slide.id, { mobile })} />
          <Text label="Link do banner" value={slide.href} onChange={(href) => edit(slide.id, { href })} placeholder="/produtos" />
          <Text label="Link no celular (opcional)" value={slide.mobileHref} onChange={(mobileHref) => edit(slide.id, { mobileHref })} />
        </div>
      </div>)}
      <button type="button" className="button button-outline" disabled={config.banners.length >= 10} onClick={() => update("banners", [...config.banners, { id: crypto.randomUUID(), label: "", desktop: "", mobile: "", href: "/produtos", mobileHref: "" }])}><Plus size={17} /> Novo banner</button>
    </div>
  </SettingsBox>;
}

export function Settings({ tab, config, products, update }: { tab: SettingTab; config: StoreConfig; products: AdminProduct[]; update: UpdateConfig }) {
  if (tab === "categories") return <Categories config={config} update={update} />;
  if (tab === "home") return <div className="admin-stack">
    <SettingsBox title="Seções da página inicial" help="Ative as seções e use as setas para mudar a ordem.">
      <div className="sections-editor">
        {[...config.sections, ...homeSections.filter((section) => !config.sections.includes(section))].map((section, index) => {
          const visible = config.sections.includes(section);
          return <div key={section}><Toggle label={sectionLabels[section]} checked={visible} onChange={(checked) => update("sections", checked ? [...config.sections, section] : config.sections.filter((item) => item !== section))} />
            {visible && <OrderButtons label={sectionLabels[section]} up={index > 0 ? () => update("sections", reorder(config.sections, index, -1)) : undefined} down={index < config.sections.length - 1 ? () => update("sections", reorder(config.sections, index, 1)) : undefined} />}</div>;
        })}
      </div>
    </SettingsBox>
    <Banners config={config} update={update} />
    <SettingsBox title="Textos e destaques">
      <div className="admin-grid">
        <Text label="Título de apresentação" value={config.introTitle} onChange={(value) => update("introTitle", value)} />
        <Text label="Frase de apresentação" value={config.introText} onChange={(value) => update("introText", value)} />
        <Text label="Título sobre materiais" value={config.materialsTitle} onChange={(value) => update("materialsTitle", value)} />
        <Text label="Frase sobre materiais" value={config.materialsText} onChange={(value) => update("materialsText", value)} />
        {(["new", "featured", "sale"] as const).map((rail) => <Text key={rail} label={`Título da seção ${sectionLabels[rail].toLowerCase()}`} value={config.railTitles[rail]} onChange={(value) => update("railTitles", { ...config.railTitles, [rail]: value })} />)}
        <Field label="Produto em evidência"><select value={config.featuredId} onChange={(event) => update("featuredId", event.target.value)}><option value="">Nenhum</option>{products.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Area label="Texto acima do banner secundário" value={config.promoText} onChange={(value) => update("promoText", value)} rows={2} />
        <Text label="Link do banner secundário" value={config.promoHref} onChange={(value) => update("promoHref", value)} />
      </div>
      <MediaField label="Imagem do banner secundário" value={config.promoImage} onChange={(value) => update("promoImage", value)} />
    </SettingsBox>
  </div>;
  if (tab === "identity") return <div className="admin-stack">
    <SettingsBox title="Marca">
      <div className="admin-grid"><Text label="Nome da loja" value={config.name} onChange={(value) => update("name", value)} required />
        <Text label="Frase no rodapé" value={config.footerText} onChange={(value) => update("footerText", value)} /></div>
      <MediaField label="Logo da loja" value={config.logo} onChange={(value) => update("logo", value)} />
      <p className="muted">Ao deixar a imagem vazia, o cabeçalho usa o nome da loja.</p>
    </SettingsBox>
    <SettingsBox title="Cores e tipografia">
      <div className="admin-grid">
        <Field label="Cor principal"><input type="color" value={config.accent} onChange={(event) => update("accent", event.target.value)} /></Field>
        <Field label="Cor de fundo"><input type="color" value={config.background} onChange={(event) => update("background", event.target.value)} /></Field>
        <Field label="Fonte dos títulos"><select value={config.headingFont} onChange={(event) => update("headingFont", event.target.value as StoreConfig["headingFont"])}><option value="zilla">Zilla Slab</option><option value="georgia">Georgia</option><option value="sans">Mesma do texto</option></select></Field>
        <Field label="Fonte dos textos"><select value={config.bodyFont} onChange={(event) => update("bodyFont", event.target.value as StoreConfig["bodyFont"])}><option value="outfit">Outfit</option><option value="system">Fonte do sistema</option></select></Field>
      </div>
    </SettingsBox>
    <SettingsBox title="Barra de avisos" help="Adicione um aviso por linha."><Area label="Avisos do cabeçalho" value={config.announcements.join("\n")} onChange={(value) => update("announcements", value.split("\n"))} /></SettingsBox>
  </div>;
  if (tab === "checkout") return <div className="admin-stack">
    <SettingsBox title="Pedidos pelo WhatsApp" help="O comprador revisa os itens, abre a conversa e envia a mensagem pelo WhatsApp.">
      <Text label="Número do WhatsApp" value={config.whatsapp} onChange={(value) => update("whatsapp", value)} placeholder="Ex. +55 11 99999-9999" />
      <Area label="Abertura da mensagem" value={config.checkoutGreeting} onChange={(value) => update("checkoutGreeting", value)} />
    </SettingsBox>
    <SettingsBox title="Entrega e retirada">
      <div className="admin-checks"><Toggle label="Oferecer entrega" checked={config.delivery} onChange={(value) => update("delivery", value)} /><Toggle label="Oferecer retirada" checked={config.pickup} onChange={(value) => update("pickup", value)} /></div>
      {config.delivery && <div className="admin-grid">
        <Field label="Modo de frete"><select value={config.shippingType} onChange={(event) => update("shippingType", event.target.value as StoreConfig["shippingType"])}><option value="quote">Combinar no WhatsApp</option><option value="flat">Valor fixo</option></select></Field>
        {config.shippingType === "flat" && <Numeric label="Frete fixo (R$)" value={config.shippingCost} currency onChange={(value) => update("shippingCost", value ?? 0)} />}
        <Numeric label="Frete grátis a partir de (R$)" placeholder="Deixe em branco para desativar" value={config.freeOver} currency nullable onChange={(value) => update("freeOver", value)} />
      </div>}
    </SettingsBox>
  </div>;
  return <div className="admin-stack">
    <SettingsBox title="Quem faz"><Text label="Título da página" value={config.aboutTitle} onChange={(value) => update("aboutTitle", value)} required /><Area label="Apresentação" value={config.aboutText} onChange={(value) => update("aboutText", value)} rows={6} /></SettingsBox>
    <SettingsBox title="Canais de contato">
      <div className="admin-grid"><Text label="E-mail de atendimento" value={config.contactEmail} onChange={(value) => update("contactEmail", value)} /><Text label="Usuário do Instagram" value={config.instagram} onChange={(value) => update("instagram", value)} placeholder="@sualoja" /></div>
    </SettingsBox>
    <SettingsBox title="Privacidade" help="Esses dados aparecem na política pública. O canal usa o e-mail de atendimento ou o WhatsApp da loja se o e-mail de privacidade estiver vazio.">
      <div className="admin-grid">
        <Text label="Nome ou razão social do responsável pelos dados" value={config.privacyController ?? ""} onChange={(value) => update("privacyController", value)} />
        <Text label="E-mail de privacidade" value={config.privacyEmail ?? ""} onChange={(value) => update("privacyEmail", value)} />
      </div>
    </SettingsBox>
  </div>;
}
