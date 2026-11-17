"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Plus, Save, Search, Trash2 } from "lucide-react";
import { sendJson } from "../../lib/store-client";
import { defaultPlaqueDesign, hasPlaquePreview, isPlaqueProduct, isRoundPlaque, isSizeOption, money, newPlaqueVariants, normalize, PLAQUE_CATEGORY, plaqueDesign, productHref, productPrice, ROUND_PLAQUE_CATEGORY, slugify, type AdminProduct, type Category, type PlaqueDesign, type Product, type Rail, type Variant } from "../../lib/store-model";
import { defaultProductBackgroundPattern, productBackgroundPatterns, productColorFields, productPageColors, type ProductColor, type StoreColors } from "../../lib/store-theme";
import { Area, Field, MediaField, Numeric, OrderButtons, reorder, SettingsBox, Text, Toggle } from "./admin-fields";
import { Photo } from "./store-ui";
import { WoodenPlaque } from "./wooden-plaque";

function changeProductCategory(product: AdminProduct, id: string, checked: boolean): AdminProduct {
  const categories = checked ? [...product.categories, id] : product.categories.filter((category) => category !== id);
  const next = { ...product, categories };
  if (!checked && (id === PLAQUE_CATEGORY || id === ROUND_PLAQUE_CATEGORY) && !isRoundPlaque({ categories })) {
    return { ...next, preview: undefined };
  }
  if (checked && id === ROUND_PLAQUE_CATEGORY && !categories.includes(PLAQUE_CATEGORY) && !product.variantNames.length) {
    return { ...next, variantNames: ["Tamanho"], variants: newPlaqueVariants() };
  }
  return next;
}

export function newProduct(category = ""): AdminProduct {
  const product: AdminProduct = { id: crypto.randomUUID(), slug: "", name: "", description: "", categories: [], images: [], price: 0, comparePrice: null, stock: null, variantNames: [], variants: [], tags: [], active: true, revision: 0 };
  return category ? changeProductCategory(product, category, true) : product;
}

const uncategorizedFilter = "_";

export function ProductsTable({ products, categories, categoryFilter, onCategoryChange, open, create }: {
  products: AdminProduct[]; categories: Category[]; categoryFilter: string; onCategoryChange: (id: string) => void;
  open: (item: AdminProduct) => void; create: (category: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const categoryIds = new Set(categories.map(({ id }) => id));
  const selectedCategory = categoryIds.has(categoryFilter) ? categoryFilter : "";
  const uncategorizedOnly = categoryFilter === uncategorizedFilter;
  const searchTerm = normalize(search);
  const filtered = products.filter((product) => {
    if (!normalize(product.name).includes(searchTerm)) return false;
    if (uncategorizedOnly) return !product.categories.some((id) => categoryIds.has(id));
    return !selectedCategory || product.categories.includes(selectedCategory);
  });
  const perPage = 20;
  const pages = Math.ceil(filtered.length / perPage);
  return <div className="admin-box">
    <div className="admin-list-tools">
      <label className="admin-search"><Search size={18} aria-hidden="true" /><input aria-label="Buscar no catálogo" placeholder="Buscar no catálogo" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></label>
      <Field label="Categoria">
        <select value={uncategorizedOnly ? uncategorizedFilter : selectedCategory}
          onChange={(event) => { onCategoryChange(event.target.value); setPage(0); }}>
          <option value="">Todas as categorias</option>
          {categories.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          <option value={uncategorizedFilter}>Sem categoria</option>
        </select>
      </Field>
      <button className="button" type="button" onClick={() => create(selectedCategory)}><Plus size={18} aria-hidden="true" /> Novo produto</button>
    </div>
    <p className="admin-count">{filtered.length} {filtered.length === 1 ? "produto" : "produtos"}</p>
    <div className="admin-table">
      {filtered.slice(page * perPage, (page + 1) * perPage).map((product) => {
        const price = productPrice(product);
        return <button className="admin-product-row" key={product.id} onClick={() => open(product)}>
          <span className="admin-product-photo"><Photo src={product.images[0]} /></span>
          <span><strong>{product.name}</strong><small>{categories.filter((category) => product.categories.includes(category.id)).map((category) => category.name).join(" · ") || "Sem categoria"}</small></span>
          <span className="admin-row-price">{isPlaqueProduct(product) && price.min <= 0 ? "Sem preço" : money(price.min)}</span>
          <span className={`pill${product.active && price.available ? " pill-active" : ""}`}>{!product.active ? "Oculto" : price.available ? "Ativo" : "Esgotado"}</span>
          <ChevronRight size={18} className="admin-row-arrow" />
        </button>;
      })}
      {!filtered.length && <p className="admin-empty">Nenhum produto encontrado.</p>}
    </div>
    {pages > 1 && <nav className="pagination" aria-label="Páginas do painel">
      <button className="icon-button" aria-label="Página anterior" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /></button>
      <span>Página {page + 1} de {pages}</span>
      <button className="icon-button" aria-label="Próxima página" disabled={page + 1 === pages} onClick={() => setPage(page + 1)}><ChevronRight size={18} /></button>
    </nav>}
  </div>;
}

const tags: Array<{ id: Rail; name: string }> = [{ id: "new", name: "Lançamentos" }, { id: "featured", name: "Destaques" }, { id: "sale", name: "Ofertas" }];

export function ProductEditor({ product, categories, storeColors, onSave, onRemove, onClose }: {
  product: AdminProduct; categories: Category[]; storeColors: StoreColors; onSave: (item: AdminProduct) => void; onRemove: (id: string) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState(product);
  const [photos, setPhotos] = useState(() => product.images.map((url, index) => ({ id: String(index), url })));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expandedVariant, setExpandedVariant] = useState("");
  const [uploading, setUploading] = useState<string[]>([]);
  const fresh = !product.slug && product.revision === 0;
  const showPlaquePreview = hasPlaquePreview(draft);
  const sizePricing = draft.variantNames.length === 1 && isSizeOption(draft.variantNames[0]);
  const canAddSizes = draft.variantNames.length === 0;
  const plaque = draft.plaque ?? defaultPlaqueDesign;
  const images = photos.map((photo) => photo.url.trim()).filter(Boolean);
  const previewDesign = plaqueDesign({ ...draft, images });
  const colors = productPageColors(storeColors, draft.theme);
  const backgroundPattern = draft.backgroundPattern ?? defaultProductBackgroundPattern;
  const patternColors = { "--page": colors.background, "--ink": colors.text } as CSSProperties;

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  function updatePlaque(change: Partial<PlaqueDesign>) {
    setDraft((previous) => ({ ...previous, plaque: { ...(previous.plaque ?? defaultPlaqueDesign), ...change } }));
  }

  function changeColor(key: ProductColor, value?: string) {
    setDraft((previous) => {
      const theme = { ...previous.theme };
      if (value === undefined) delete theme[key];
      else theme[key] = value;
      return { ...previous, theme: Object.keys(theme).length ? theme : undefined };
    });
  }

  function trackUpload(key: string, active: boolean) {
    setUploading((previous) => active ? [...previous, key] : previous.filter((item) => item !== key));
  }

  function setCategory(id: string, checked: boolean) {
    setDraft((previous) => changeProductCategory(previous, id, checked));
  }

  function editVariant(id: string, change: Partial<Variant>) {
    setDraft((previous) => ({ ...previous, variants: previous.variants.map((item) => item.id === id ? { ...item, ...change } : item) }));
  }

  function addSize() {
    const variant: Variant = { id: crypto.randomUUID(), values: [""], price: null, stock: null, active: true };
    setDraft((previous) => ({
      ...previous, variantNames: previous.variantNames.length ? previous.variantNames : ["Tamanho"],
      variants: [...previous.variants, variant],
    }));
  }

  function removeSize(id: string) {
    setDraft((previous) => {
      const variants = previous.variants.filter((variant) => variant.id !== id);
      return { ...previous, variants, variantNames: variants.length ? previous.variantNames : [] };
    });
  }

  function addDimension() {
    setDraft((previous) => ({ ...previous, variantNames: [...previous.variantNames, ""], variants: previous.variants.map((item) => ({ ...item, values: [...item.values, ""] })) }));
  }

  function addVariant() {
    const id = crypto.randomUUID();
    update("variants", [{ id, values: draft.variantNames.map(() => ""), price: null, stock: null, active: true }, ...draft.variants]);
    setExpandedVariant(id);
  }

  function removeDimension(index: number) {
    setDraft((previous) => {
      const variantNames = previous.variantNames.filter((_, position) => position !== index);
      const variants = previous.variants.map((item) => ({ ...item, values: item.values.filter((_, position) => position !== index) }));
      return { ...previous, variantNames, variants: variantNames.length ? variants : [] };
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (uploading.length) return;
    const { revision, ...item } = draft;
    const availableCategories = item.categories.filter((id) => categories.some((category) => category.id === id));
    if (!availableCategories.length) {
      setStatus("Selecione pelo menos uma categoria.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const response = await sendJson<{ product: AdminProduct }>("/api/manage/product", {
        revision, product: {
          ...item, categories: availableCategories, slug: slugify(item.slug || item.name), images,
        },
      });
      onSave(response.product);
    } catch (failure) { setStatus((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    setStatus("");
    try {
      await sendJson("/api/manage/remove-product", { id: product.id, revision: product.revision });
      onRemove(product.id);
    } catch (failure) { setStatus((failure as Error).message); }
    finally { setBusy(false); }
  }

  return <form className="admin-stack product-editor" onSubmit={save}>
    <div className="edit-actions">
      <button className="text-link" type="button" onClick={onClose}><ArrowLeft size={18} /> Voltar aos produtos</button>
      {!fresh && draft.active && <a className="text-link open-product" href={productHref(product)} target="_blank" rel="noopener noreferrer">Ver na loja <ExternalLink size={15} /></a>}
      <button className="button" type="submit" disabled={busy || uploading.length > 0}><Save size={17} /> {busy ? "Salvando…" : "Salvar produto"}</button>
    </div>
    {status && <p className="admin-feedback form-error" role="alert">{status}</p>}
    <fieldset className="admin-stack bare-fieldset" disabled={busy}>
      <SettingsBox title="Categoria do produto" help={categories.length ? "Selecione uma ou mais categorias." : "Cadastre uma categoria na seção Categorias do painel."}>
        <div className="product-category-options" role="group" aria-label="Categorias do produto">
          {categories.map(({ id, name }) => <Toggle key={id} label={name} checked={draft.categories.includes(id)} onChange={(checked) => setCategory(id, checked)} />)}
        </div>
      </SettingsBox>
      <SettingsBox title="Informações do produto">
        <Text label="Nome do produto" value={draft.name} onChange={(value) => update("name", value)} required />
        <div className="admin-grid">
          <Numeric label="Preço (R$)" value={draft.price} currency onChange={(value) => update("price", value ?? 0)} />
          <Numeric label="Preço anterior (R$)" value={draft.comparePrice} currency nullable onChange={(value) => update("comparePrice", value)} />
          <Numeric label="Estoque" placeholder="Em branco para encomenda" value={draft.stock} nullable onChange={(value) => update("stock", value)} />
          <Text label="Endereço do produto" value={draft.slug} onChange={(value) => update("slug", value)} placeholder={slugify(draft.name) || "Gerado pelo nome"} />
        </div>
        <Toggle label="Mostrar produto na loja" checked={draft.active} onChange={(value) => update("active", value)} />
      </SettingsBox>
      <SettingsBox title="Seções da vitrine">
        <div className="admin-checks">
          {tags.map(({ id, name }) => <Toggle key={id} label={name} checked={draft.tags.includes(id)} onChange={(checked) => update("tags", checked ? [...draft.tags, id] : draft.tags.filter((tag) => tag !== id))} />)}
        </div>
      </SettingsBox>
      <SettingsBox title="Personalização 3D da placa">
        <div className="admin-stack">
          <div>
            <Toggle label="Placa personalizável" checked={draft.customizablePlaque === true} onChange={(checked) => update("customizablePlaque", checked)} />
            <p className="muted">Permite que o cliente envie uma imagem de referência para a confecção.</p>
          </div>
          <Toggle label="Exibir placa 3D na loja" checked={showPlaquePreview} onChange={(checked) => update("showPlaquePreview", checked)} disabled={uploading.includes("artwork")} />
          {showPlaquePreview && <div className="plaque-admin-layout">
            <WoodenPlaque scale={1} design={previewDesign} background={colors.background} />
            <div className="admin-stack">
              {!draft.variants.length && <Numeric label="Diâmetro (cm)" value={plaque.diameter ?? null} decimal nullable
                placeholder="Opcional" onChange={(diameter) => updatePlaque({ diameter: diameter ?? undefined })} />}
              <MediaField label="Arte da frente" value={plaque.frontImage} onChange={(frontImage) => updatePlaque({ frontImage })} onUploadChange={(active) => trackUpload("artwork", active)} />
              {(draft.categories.includes(PLAQUE_CATEGORY) || draft.showPlaquePreview) && !plaque.frontImage &&
                <p className="muted">O modelo usa a primeira foto do produto quando a arte da frente fica em branco.</p>}
              <div className="admin-grid">
                <Field label="Cor do verso"><input type="color" value={plaque.backColor} onChange={(event) => updatePlaque({ backColor: event.target.value })} /></Field>
                <Field label="Cor das bordas"><input type="color" value={plaque.edgeColor} onChange={(event) => updatePlaque({ edgeColor: event.target.value })} /></Field>
              </div>
              <Field label="Ajuste da arte frontal"><select value={plaque.fit} onChange={(event) => updatePlaque({ fit: event.target.value === "contain" ? "contain" : "cover" })}>
                <option value="cover">Preencher o círculo</option><option value="contain">Caber inteira</option>
              </select></Field>
            </div>
          </div>}
        </div>
      </SettingsBox>
      <SettingsBox title="Fotos do produto"
        help="Use fotos quadradas (1:1), de preferência 1.200 × 1.200 px. A prévia usa o mesmo enquadramento do zoom. A primeira foto aparece na vitrine.">
        <div className="admin-stack">
          {photos.map((photo, index) => <div className="photo-edit" key={photo.id}>
            <MediaField label={`Foto ${index + 1}`} value={photo.url} onUploadChange={(active) => trackUpload(photo.id, active)}
              onChange={(url) => setPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, url } : item))} />
            <OrderButtons label={`foto ${index + 1}`} up={index > 0 ? () => setPhotos((current) => reorder(current, index, -1)) : undefined}
              down={index < photos.length - 1 ? () => setPhotos((current) => reorder(current, index, 1)) : undefined} />
            <button type="button" className="icon-button danger" aria-label={`Remover foto ${index + 1}`} disabled={uploading.includes(photo.id)}
              onClick={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))}><Trash2 size={18} /></button>
          </div>)}
          <button type="button" className="button button-outline" disabled={photos.length >= 12} onClick={() => setPhotos((current) => [...current, { id: crypto.randomUUID(), url: "" }])}><Plus size={17} /> Adicionar foto</button>
        </div>
      </SettingsBox>
      <SettingsBox title="Descrição do produto">
        <Area label="Descrição" value={draft.description} onChange={(value) => update("description", value)} rows={5} />
      </SettingsBox>
      {(sizePricing || canAddSizes) && <SettingsBox title="Tamanhos e preços" help="Preço e estoque em branco usam os valores do produto.">
        {sizePricing && draft.variants.map((variant, index) => <div className="admin-subbox" key={variant.id}>
          <div className="admin-grid">
            <Text label={`Tamanho ${index + 1}`} value={variant.values[0] ?? ""} placeholder="Ex. 30 cm"
              onChange={(value) => editVariant(variant.id, { values: [value] })} required />
            <Numeric label={`Preço do tamanho ${index + 1} (R$)`} value={variant.price} currency nullable
              onChange={(price) => editVariant(variant.id, { price })} />
            <Numeric label={`Estoque do tamanho ${index + 1}`} value={variant.stock} nullable
              onChange={(stock) => editVariant(variant.id, { stock })} />
            <Toggle label={`Mostrar tamanho ${index + 1} na loja`} checked={variant.active} onChange={(active) => editVariant(variant.id, { active })} />
          </div>
          <button type="button" className="text-link danger" onClick={() => removeSize(variant.id)}><Trash2 size={16} /> Remover tamanho {index + 1}</button>
        </div>)}
        <div className="admin-inline left">
          <button type="button" className="button button-outline small" onClick={addSize} disabled={draft.variants.length >= 250}><Plus size={16} /> Adicionar tamanho</button>
          {sizePricing && <button type="button" className="button button-outline small" onClick={addDimension}><Plus size={16} /> Adicionar outro tipo de opção</button>}
        </div>
      </SettingsBox>}
      {!sizePricing && <SettingsBox title="Variações" help="Use esta seção para combinar opções como tamanho e cor. Preço e estoque em branco usam os valores do produto.">
        <div className="admin-stack">
          <div className="admin-grid">
            {draft.variantNames.map((name, index) => <div className="admin-inline" key={index}>
              <Text label={`Nome da opção ${index + 1}`} value={name} onChange={(value) => update("variantNames", draft.variantNames.map((item, position) => position === index ? value : item))} placeholder="Ex. Cor" />
              <button type="button" className="icon-button danger" aria-label={`Remover opção ${index + 1}`} onClick={() => removeDimension(index)}><Trash2 size={17} /></button>
            </div>)}
          </div>
          <div className="admin-inline left">
            <button type="button" className="button button-outline small" onClick={addDimension} disabled={draft.variantNames.length >= 3}><Plus size={16} /> Tipo de opção</button>
            {!!draft.variantNames.length && <button type="button" className="button button-outline small" disabled={draft.variants.length >= 250} onClick={addVariant}><Plus size={16} /> Nova combinação</button>}
          </div>
          {draft.variants.map((variant) => <div className="variant-edit" key={variant.id}>
            <button type="button" className="variant-summary" aria-expanded={expandedVariant === variant.id} onClick={() => setExpandedVariant(expandedVariant === variant.id ? "" : variant.id)}><ChevronRight size={15} /><span>{variant.values.filter(Boolean).join(" · ") || "Nova combinação"}</span><small>{variant.active ? "Visível" : "Oculta"}</small></button>
            {expandedVariant === variant.id && <div className="admin-grid">
              {draft.variantNames.map((name, index) => <Text key={index} label={name || `Opção ${index + 1}`} value={variant.values[index] || ""} onChange={(value) => editVariant(variant.id, { values: variant.values.map((item, position) => position === index ? value : item) })} />)}
              <Numeric label="Preço desta combinação (R$)" value={variant.price} currency nullable onChange={(value) => editVariant(variant.id, { price: value })} />
              <Numeric label="Estoque desta combinação" value={variant.stock} nullable onChange={(value) => editVariant(variant.id, { stock: value })} />
              <Toggle label="Mostrar combinação" checked={variant.active} onChange={(active) => editVariant(variant.id, { active })} />
              <button type="button" className="text-link danger" onClick={() => update("variants", draft.variants.filter((item) => item.id !== variant.id))}><Trash2 size={16} /> Remover combinação</button>
            </div>}
          </div>)}
        </div>
      </SettingsBox>}
      <SettingsBox title="Cores da página do produto" help="Cada ajuste vale apenas para a página desta peça.">
        <fieldset className="product-pattern-options">
          <legend>Padrão de fundo</legend>
          <div className="product-pattern-grid">
            {productBackgroundPatterns.map(({ value, label }) => <label className="product-pattern-option" key={value}>
              <input className="visually-hidden" type="radio" name="product-background-pattern" value={value}
                checked={backgroundPattern === value} onChange={() => update("backgroundPattern", value)} />
              <span className="product-pattern-sample" data-product-pattern={value} style={patternColors} aria-hidden="true" />
              {label}
            </label>)}
          </div>
        </fieldset>
        <div className="admin-grid product-color-fields">
          {productColorFields.map(({ key, label }) => <div className="product-color-field" key={key}>
            <Field label={label}><input type="color" value={colors[key]} onChange={(event) => changeColor(key, event.target.value)} /></Field>
            {!draft.theme?.[key] && <button type="button" className="text-link" aria-label={`Fixar ${label.toLowerCase()}`} onClick={() => changeColor(key, colors[key])}>Fixar cor</button>}
            {draft.theme?.[key] && <button type="button" className="text-link" aria-label={`Restaurar ${label.toLowerCase()}`} onClick={() => changeColor(key)}>Restaurar</button>}
          </div>)}
        </div>
        {draft.theme && <div className="admin-inline left"><button type="button" className="button button-outline small" onClick={() => update("theme", undefined)}>Restaurar cores da loja</button></div>}
      </SettingsBox>
      {!fresh && <SettingsBox title="Remover da loja">
        {confirmDelete ? <div className="admin-stack"><p>Remover <strong>{product.name}</strong> do catálogo?</p><div className="admin-inline left"><button type="button" className="button button-outline" onClick={() => setConfirmDelete(false)}>Cancelar</button><button type="button" className="button button-danger" onClick={remove}>Confirmar remoção</button></div></div>
          : <button type="button" className="text-link danger" onClick={() => setConfirmDelete(true)}><Trash2 size={17} /> Remover produto</button>}
      </SettingsBox>}
    </fieldset>
  </form>;
}
