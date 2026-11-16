import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountLogin } from "../../components/store/account-login";
import { CustomerAccount } from "../../components/store/account";
import { getStoreAccount } from "../../lib/store-auth";
import { listOrders, readProfile, readStoreConfig } from "../../lib/store-db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha conta", robots: { index: false, follow: false } };

export default async function CustomerPage({ searchParams }: { searchParams: Promise<{ destino?: string; pagina?: string; retorno?: string; aviso?: string; modo?: string }> }) {
  const [account, query] = await Promise.all([getStoreAccount(), searchParams]);
  const destination = query.destino === "admin" || query.destino === "checkout" ? query.destino : "account";
  const match = query.destino === "produto" && typeof query.retorno === "string" && query.retorno.length <= 240
    ? /^\/produtos\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\?tamanho=([a-zA-Z0-9_-]{1,120}))?$/.exec(query.retorno)
    : null;
  const productReturn = match ? `/produtos/${match[1]}${match[2] ? `?tamanho=${match[2]}` : ""}` : undefined;
  if (!account) {
    const { name, logo } = await readStoreConfig();
    return <AccountLogin brand={{ name, logo }} destination={destination} productReturn={productReturn}
      notice={query.aviso} startRecovery={query.modo === "recuperar"} />;
  }
  if (productReturn) redirect(productReturn);
  if (destination === "admin") redirect("/admin");
  const page = /^\d{1,5}$/.test(query.pagina ?? "") ? Number(query.pagina) : 0;
  const [profile, result] = await Promise.all([readProfile(account.db), listOrders(account.db, account.id, page)]);
  return <CustomerAccount label={account.label} verifiedEmail={account.email} initial={profile} orders={result.orders}
    hasMore={result.hasMore} page={page} destination={destination} justConfirmed={query.aviso === "confirmado"} />;
}
