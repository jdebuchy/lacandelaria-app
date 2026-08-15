import "./globals.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { APP_NAME } from "@/lib/constants";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

// FontAwesome inyecta su CSS por JS por defecto, y en el App Router eso llega
// tarde: los iconos aparecen gigantes y se acomodan despues. Importamos la hoja
// nosotros y le apagamos la inyeccion.
config.autoAddCss = false;

// Una sola familia para toda la app. Archivo trae figuras tabulares, que es lo
// que hace que las columnas de plata aliñen.
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo"
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Operacion comercial, pedido online, reparto y cobranza para Paltas La Candelaria.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "La Candelaria"
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f3" },
    { media: "(prefers-color-scheme: dark)", color: "#141613" }
  ],
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={archivo.variable} suppressHydrationWarning>
      <head>
        {/* Corre antes del primer paint: sin esto la app parpadea en claro
            durante un frame antes de pasarse a oscuro. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
