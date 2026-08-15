import "./globals.css";
import type { Metadata, Viewport } from "next";
import { APP_NAME } from "@/lib/constants";

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
  themeColor: "#14532d",
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
