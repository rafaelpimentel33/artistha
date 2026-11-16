"use client";

import { useRef, useState } from "react";
import { storeRequest } from "../../lib/store-client";
import { PLAQUE_REFERENCE_LIMIT, PLAQUE_REFERENCE_MIME_TYPES, privacyPath, productHref, type Product, type Variant } from "../../lib/store-model";
import { PurchaseAction } from "./store-ui";

export function PlaquePurchase({ product, selected, signedIn, limit, quantity, setQuantity, onBuy, onUploadChange }: {
  product: Product; selected?: Variant; signedIn: boolean; limit: number; quantity: number;
  setQuantity: (quantity: number) => void; onBuy: (reference?: string) => void; onUploadChange: (uploading: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const attempt = useRef<{ size?: string; key: string } | null>(null);
  const returnPath = productHref(product) + (selected ? `?tamanho=${encodeURIComponent(selected.id)}` : "");

  function selectFile(next: File | null) {
    setFailure("");
    attempt.current = null;
    if (next && (!next.size || next.size > PLAQUE_REFERENCE_LIMIT || !PLAQUE_REFERENCE_MIME_TYPES.includes(next.type))) {
      setFile(null);
      setFailure("Escolha uma imagem PNG, JPG ou WebP de até 4 MB.");
      return false;
    }
    setFile(next);
    return true;
  }

  async function buy() {
    if (busy || limit < 1) return;
    if (!file) { onBuy(); return; }
    setBusy(true);
    onUploadChange(true);
    setFailure("");
    if (!attempt.current || attempt.current.size !== selected?.id) attempt.current = { size: selected?.id, key: crypto.randomUUID() };
    const data = new FormData();
    data.set("productId", product.id);
    data.set("variantId", selected?.id ?? "");
    data.set("key", attempt.current.key);
    data.set("image", file);
    try {
      const result = await storeRequest<{ reference: string }>("/api/plaque-reference", { method: "POST", body: data });
      onBuy(result.reference);
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setBusy(false);
      onUploadChange(false);
    }
  }

  return <>
    <PurchaseAction limit={limit} quantity={quantity} setQuantity={setQuantity} onBuy={buy} label={busy ? "Anexando imagem…" : "Comprar"} busy={busy} />
    {limit > 0 && <section className="plaque-reference" aria-label="Referência para confecção">
      <h2>Referência para confecção</h2>
      {signedIn ? <>
        <label className="field"><span>Imagem de referência <span className="muted">(opcional)</span></span><input type="file" accept={PLAQUE_REFERENCE_MIME_TYPES.join(",")} disabled={busy}
          onChange={(event) => {
            const next = event.currentTarget.files?.[0] ?? null;
            if (!selectFile(next)) event.currentTarget.value = "";
          }} /></label>
        <p className="muted privacy-note">Envie uma imagem de até 4 MB que você possa compartilhar para a confecção. <a href={privacyPath + "#privacy-rights"} target="_blank" rel="noopener">Privacidade da referência</a>.</p>
        {failure && <p className="form-error" role="alert">{failure}</p>}
      </> : <a className="text-link plaque-signin" href={`/conta?destino=produto&retorno=${encodeURIComponent(returnPath)}`}>Entrar para anexar uma imagem</a>}
    </section>}
  </>;
}
