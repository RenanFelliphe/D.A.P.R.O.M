import type { Metadata } from "next";
import localFont from "next/font/local";
import { IconSprite } from "@/components/ui/Icon";
import { Providers } from "@/state/Providers";
import "./globals.css";

// As fontes vêm do próprio repositório (`fontes/`, subconjunto latin, licença OFL), não do `next/font/google`: o build não
// depende de baixar nada do Google, o que quebrava a imagem Docker no servidor.
const plexSans = localFont({
  variable: "--font-plex-sans",
  src: [
    { path: "./fontes/ibm-plex-sans-latin-400-normal.woff2", weight: "400" },
    { path: "./fontes/ibm-plex-sans-latin-500-normal.woff2", weight: "500" },
    { path: "./fontes/ibm-plex-sans-latin-600-normal.woff2", weight: "600" },
    { path: "./fontes/ibm-plex-sans-latin-700-normal.woff2", weight: "700" },
  ],
});

const plexMono = localFont({
  variable: "--font-plex-mono",
  src: [
    { path: "./fontes/ibm-plex-mono-latin-400-normal.woff2", weight: "400" },
    { path: "./fontes/ibm-plex-mono-latin-500-normal.woff2", weight: "500" },
    { path: "./fontes/ibm-plex-mono-latin-600-normal.woff2", weight: "600" },
  ],
});

export const metadata: Metadata = {
  title: {
    default: "SYNQ OS",
    template: "%s · SYNQ OS",
  },
  description: "APR e Ordens de Manutenção 100% digitais.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <IconSprite />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
