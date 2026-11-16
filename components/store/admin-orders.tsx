"use client";

import { useEffect, useState } from "react";
import { sendJson, storeRequest } from "../../lib/store-client";
import { orderStatus, type Order, type OrderStatus } from "../../lib/order-model";
import { OrderDetails } from "./account";
import { SettingsBox } from "./admin-fields";

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setMessage("");
    storeRequest<{ orders: Order[]; hasMore: boolean }>(`/api/manage/orders?page=${page}`, { signal: controller.signal })
      .then((data) => { setOrders(data.orders); setHasMore(data.hasMore); })
      .catch((error) => { if (!controller.signal.aborted) setMessage(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page]);

  async function update(id: string, status: OrderStatus) {
    setSaving(id);
    setMessage("");
    try {
      const { order } = await sendJson<{ order: Order }>("/api/manage/order-status", { id, status });
      setOrders((previous) => previous.map((item) => item.id === id ? order : item));
    } catch (error) { setMessage((error as Error).message); }
    finally { setSaving(""); }
  }

  return <SettingsBox title="Pedidos recebidos">
    {message && <p className="form-error" role="alert">{message}</p>}
    {loading ? <p className="muted">Carregando pedidos…</p>
      : orders.length ? orders.map((order) => <div className="admin-order" key={order.id}>
        <OrderDetails order={order} admin />
        <label className="field">Status do pedido nº {order.number}
          <select value={order.status} disabled={Boolean(saving)} onChange={(event) => update(order.id, event.target.value as OrderStatus)}>
            {Object.entries(orderStatus).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>) : <p className="muted">Nenhum pedido registrado.</p>}
    <div className="account-pagination">
      {page > 0 && <button className="text-link" disabled={loading} onClick={() => setPage(page - 1)}>Anterior</button>}
      {hasMore && <button className="text-link" disabled={loading} onClick={() => setPage(page + 1)}>Mais pedidos</button>}
    </div>
  </SettingsBox>;
}
