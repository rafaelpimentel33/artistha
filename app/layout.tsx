import type { Metadata } from "next";
import { storeDescription, storeUrl } from "../lib/store-seo";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ArtisTha", template: "%s | ArtisTha" },
  metadataBase: storeUrl,
  description: storeDescription,
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
