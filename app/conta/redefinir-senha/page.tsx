import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPassword } from "../../../components/store/account-login";
import { canResetPassword } from "../../../lib/account-recovery";
import { getStoreAccount } from "../../../lib/store-auth";
import { readStoreConfig } from "../../../lib/store-db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Redefinir senha", robots: { index: false, follow: false } };

export default async function ResetPasswordPage() {
  const account = await getStoreAccount();
  if (!account || !await canResetPassword(account.id)) redirect("/conta?modo=recuperar&aviso=link");
  const { name, logo } = await readStoreConfig();
  return <ResetPassword brand={{ name, logo }} />;
}
