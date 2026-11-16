"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Download, Search, Trash2 } from "lucide-react";
import type { PlaqueReferenceItem } from "../../lib/plaque-reference-model";
import { sendJson, storeRequest } from "../../lib/store-client";
import { SettingsBox } from "./admin-fields";

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
type Results = { items: PlaqueReferenceItem[]; hasMore: boolean };

export function AdminPlaqueReferences() {
  const [search, setSearch] = useState("");
  const [criteria, setCriteria] = useState({ page: 0, filter: "" });
  const [results, setResults] = useState<Results | null>(null);
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const request = new AbortController();
    const query = new URLSearchParams({ page: String(criteria.page), busca: criteria.filter });
    storeRequest<Results>(`/api/manage/plaque-references?${query}`, { signal: request.signal })
      .then((data) => { if (!request.signal.aborted) setResults(data); })
      .catch((failure: Error) => { if (!request.signal.aborted) setStatus(failure.message); });
    return () => request.abort();
  }, [criteria]);

  function searchByCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResults(null);
    setStatus("");
    setConfirm("");
    setNotice("");
    setCriteria({ page: 0, filter: search.trim().toLowerCase() });
  }

  function showPage(next: number) {
    setResults(null);
    setStatus("");
    setConfirm("");
    setNotice("");
    setCriteria({ ...criteria, page: next });
  }

  async function remove(item: PlaqueReferenceItem) {
    if (deleting) return;
    setDeleting(true);
    setStatus("");
    setNotice("");
    try {
      await sendJson("/api/manage/remove-plaque-reference", { path: item.path });
      setConfirm("");
      setNotice("Referência apagada.");
      setResults(null);
      setCriteria({ ...criteria, page: results?.items.length === 1 ? Math.max(0, criteria.page - 1) : criteria.page });
    } catch (cause) {
      setStatus((cause as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return <SettingsBox title="Referências de placas" help="Busque pelo código da referência que acompanha o pedido.">
    <form className="plaque-reference-search" onSubmit={searchByCode}>
      <label className="field">Código da referência<input value={search} onChange={(event) => setSearch(event.target.value)} maxLength={36} pattern="[a-fA-F0-9\\-]*" autoCapitalize="none" disabled={deleting} /></label>
      <button className="button button-outline" type="submit" disabled={deleting}><Search size={16} /> Buscar</button>
    </form>
    {status && <p className="form-error" role="alert">{status}</p>}
    {notice && <p role="status">{notice}</p>}
    {!results ? !status && <p role="status" className="muted">Carregando referências…</p> : !results.items.length
      ? <p className="muted">Nenhuma imagem encontrada.</p>
      : <ul className="plaque-reference-list">{results.items.map((item) => <li key={item.path}>
        <div><strong>{item.product}</strong>{item.option && <span>{item.option}</span>}<small>{date.format(new Date(item.createdAt))} · {item.reference}</small></div>
        {confirm === item.path ? <div className="plaque-reference-actions">
          <span>Apagar esta imagem?</span>
          <button className="button button-outline small" type="button" disabled={deleting} onClick={() => setConfirm("")}>Cancelar</button>
          <button className="button button-danger small" type="button" disabled={deleting} onClick={() => remove(item)}>{deleting ? "Apagando…" : "Confirmar exclusão"}</button>
        </div> : <div className="plaque-reference-actions">
          <a className="button button-outline small" href={`/api/manage/plaque-reference-download?path=${encodeURIComponent(item.path)}`}><Download size={16} /> Baixar imagem</a>
          <button className="button button-outline small danger" type="button" disabled={deleting} onClick={() => { setStatus(""); setNotice(""); setConfirm(item.path); }}><Trash2 size={16} /> Apagar</button>
        </div>}
      </li>)}</ul>}
    {results && (criteria.page > 0 || results.hasMore) && <nav className="account-pagination" aria-label="Páginas de referências">
      {criteria.page > 0 && <button className="text-link" type="button" disabled={deleting} onClick={() => showPage(criteria.page - 1)}>Anterior</button>}
      {results.hasMore && <button className="text-link" type="button" disabled={deleting} onClick={() => showPage(criteria.page + 1)}>Mais referências</button>}
    </nav>}
  </SettingsBox>;
}
