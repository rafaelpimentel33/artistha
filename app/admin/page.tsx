import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Admin, AdminAccessDenied, AdminSetup } from "../../components/store/admin";
import { readAdminData } from "../../lib/store-db";
import { getAdminAccess } from "../../lib/store-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel da loja", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const access = await getAdminAccess();
  if (access === "signin") redirect("/conta?destino=admin");
  if (access === "setup") return <AdminSetup />;
  if (access === "denied") return <AdminAccessDenied />;
  return <Admin initial={await readAdminData()} />;
}
