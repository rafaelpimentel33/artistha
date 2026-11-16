import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Admin, AdminSetup } from "../../components/store/admin";
import { readAdminData } from "../../lib/store-db";
import { getAdminAccess } from "../../lib/store-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel da loja", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const access = await getAdminAccess();
  if (access === "signin") redirect("/conta?destino=admin");
  if (access === "setup") return <AdminSetup />;
  if (access !== "admin") notFound();
  return <Admin initial={await readAdminData()} />;
}
