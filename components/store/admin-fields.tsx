"use client";

import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ImagePlus } from "lucide-react";
import { storeRequest } from "../../lib/store-client";
import { MAX_PHOTO_BYTES } from "../../lib/store-model";
import { Photo } from "./store-ui";

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export function Text({ label, value, onChange, placeholder = "", required = false }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean;
}) {
  return <Field label={label}><input value={value} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></Field>;
}

export function Area({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <Field label={label}><textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} /></Field>;
}

export function Toggle({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <label className="check-inline"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

export function Numeric({ label, value, onChange, currency = false, decimal = false, nullable = false, placeholder = "" }: {
  label: string; value: number | null; onChange: (value: number | null) => void; currency?: boolean; decimal?: boolean; nullable?: boolean; placeholder?: string;
}) {
  const fractional = currency || decimal;
  const pattern = fractional ? /^\d+(?:[,.]\d{0,2})?$/ : /^\d+$/;
  const [text, setText] = useState(() => value === null ? "" : (currency ? (value / 100).toFixed(2) : String(value)).replace(".", ","));
  return <Field label={label}><input inputMode={fractional ? "decimal" : "numeric"} value={text} placeholder={placeholder} aria-invalid={text !== "" && !pattern.test(text)}
    onChange={(event) => {
      const next = event.target.value;
      setText(next);
      if (!next.trim()) onChange(nullable ? null : 0);
      else if (!pattern.test(next)) onChange(-1);
      else {
        const numeric = Number(next.replace(",", "."));
        onChange(currency ? Math.round(numeric * 100) : numeric);
      }
    }} /></Field>;
}

export function OrderButtons({ up, down, label }: { up?: () => void; down?: () => void; label: string }) {
  return <div className="reorder-buttons">
    <button type="button" className="icon-button" onClick={up} disabled={!up} aria-label={`Mover ${label} para cima`}><ArrowUp size={17} /></button>
    <button type="button" className="icon-button" onClick={down} disabled={!down} aria-label={`Mover ${label} para baixo`}><ArrowDown size={17} /></button>
  </div>;
}

export function reorder<T>(items: T[], index: number, movement: number) {
  const next = [...items];
  const target = index + movement;
  if (target < 0 || target >= items.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function MediaField({ label, value, onChange, onUploadChange }: { label: string; value: string; onChange: (value: string) => void; onUploadChange?: (uploading: boolean) => void }) {
  const id = useId();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setStatus("");
    if (file.size > MAX_PHOTO_BYTES) { setStatus("Escolha uma imagem de até 4 MB."); input.value = ""; return; }
    setBusy(true);
    onUploadChange?.(true);
    const body = new FormData();
    body.set("image", file);
    try {
      const data = await storeRequest<{ url: string }>("/api/manage/photo", { method: "POST", body });
      onChange(data.url);
    } catch (failure) { setStatus((failure as Error).message); }
    finally { setBusy(false); onUploadChange?.(false); input.value = ""; }
  }
  return <div className="media-field">
    <div className="media-preview"><Photo src={value.startsWith("/") || value.startsWith("https://") ? value : ""} /></div>
    <div className="media-controls">
      <Text label={label} value={value} placeholder="https://… ou envie um arquivo" onChange={onChange} />
      <input className="visually-hidden media-file" id={id} aria-label={`Enviar arquivo para ${label}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={upload} />
      <label htmlFor={id} className="button button-outline small"><ImagePlus size={16} />{busy ? "Enviando…" : "Enviar foto"}</label>
      {status && <p className="form-error" role="alert">{status}</p>}
    </div>
  </div>;
}

export function SettingsBox({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return <section className="admin-box"><header><h2>{title}</h2>{help && <p>{help}</p>}</header>{children}</section>;
}
