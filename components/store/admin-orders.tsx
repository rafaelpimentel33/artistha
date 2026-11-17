"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { sendJson, storeRequest } from "../../lib/store-client";
import { orderStatus, type Order, type OrderStatus } from "../../lib/order-model";
import { OrderDetails } from "./account";
import { SettingsBox } from "./admin-fields";

type Results = { orders: Order[]; hasMore: boolean };

export function AdminOrders() {
  const [criteria, setCriteria] = useState({ page: 0 });
  const [results, setResults] = useState<Results | null>(null);
  const [saving, setSaving] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    storeRequest<Results>(`/api/manage/orders?page=${criteria.page}`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setResults(data); })
      .catch((error: Error) => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [criteria]);

  function loadPage(page: number) {
    setResults(null);
    setConfirm("");
    setMessage("");
    setCriteria({ page });
  }

  async function update(id: string, status: OrderStatus) {
    if (saving) return;
    setSaving(id);
    setConfirm("");
    setMessage("");
    setNotice("");
    try {
      const { order } = await sendJson<{ order: Order }>("/api/manage/order-status", { id, status });
      setResults((previous) => previous && { ...previous, orders: previous.orders.map((item) => item.id === id ? order : item) });
    } catch (error) { setMessage((error as Error).message); }
    finally { setSaving(""); }
  }

  async function remove(order: Order) {
    if (saving) return;
    setSaving(order.id);
    setMessage("");
    setNotice("");
    try {
      const { deleted } = await sendJson<{ deleted: boolean }>("/api/manage/remove-order", { id: order.id });
      setNotice(deleted ? `Pedido nº ${order.number} apagado.` : `Pedido nº ${order.number} indisponível.`);
      const { page } = criteria;
      loadPage(results?.orders.length === 1 ? Math.max(0, page - 1) : page);
    } catch (error) { setMessage((error as Error).message); }
    finally { setSaving(""); }
  }

  return <SettingsBox title="Pedidos recebidos">
    {message && <p className="form-error" role="alert">{message}</p>}
    {notice && <p role="status">{notice}</p>}
    {!results ? !message && <p className="muted">Carregando pedidos…</p>
      : results.orders.length ? results.orders.map((order) => <div className="admin-order" key={order.id}>
        <OrderDetails order={order} admin />
        <label className="field">Status do pedido nº {order.number}
          <select value={order.status} disabled={Boolean(saving)} onChange={(event) => update(order.id, event.target.value as OrderStatus)}>
            {Object.entries(orderStatus).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div className="admin-inline left">
          <button type="button" className="button button-outline small danger" disabled={Boolean(saving)}
            aria-label={`Apagar pedido nº ${order.number}`} aria-expanded={confirm === order.id}
            onClick={() => { setMessage(""); setNotice(""); setConfirm(confirm === order.id ? "" : order.id); }}>
            <Trash2 size={16} aria-hidden="true" /> Apagar pedido
          </button>
        </div>
        {confirm === order.id && <div className="admin-stack" role="group" aria-label={`Exclusão do pedido nº ${order.number}`}>
          <p><strong>Apagar o pedido nº {order.number}?</strong> A exclusão é permanente e remove o pedido da conta do cliente.</p>
          <div className="admin-inline left">
            <button type="button" className="button button-outline small" disabled={Boolean(saving)} onClick={() => setConfirm("")}>Cancelar</button>
            <button type="button" className="button button-danger small" disabled={Boolean(saving)} onClick={() => remove(order)}>
              {saving === order.id ? "Apagando…" : "Confirmar exclusão"}
            </button>
          </div>
        </div>}
      </div>) : <p className="muted">Nenhum pedido registrado.</p>}
    {results && (criteria.page > 0 || results.hasMore) && <nav className="account-pagination" aria-label="Páginas de pedidos">
      {criteria.page > 0 && <button type="button" className="text-link" disabled={Boolean(saving)} onClick={() => { setNotice(""); loadPage(criteria.page - 1); }}>Anterior</button>}
      {results.hasMore && <button type="button" className="text-link" disabled={Boolean(saving)} onClick={() => { setNotice(""); loadPage(criteria.page + 1); }}>Mais pedidos</button>}
    </nav>}
  </SettingsBox>;
}
