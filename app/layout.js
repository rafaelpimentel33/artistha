import { Bricolage_Grotesque, Newsreader } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const texto = Newsreader({ subsets: ["latin"], variable: "--font-texto" });

export const metadata = {
  title: "ArtisTha",
  description: "Peças de artesanato feitas à mão.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${texto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
