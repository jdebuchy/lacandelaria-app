import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "La Candelaria",
    description: "Operacion comercial, reparto y cobranza para Paltas La Candelaria.",
    id: "/",
    scope: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f3",
    theme_color: "#2e5d3c",
    lang: "es-AR",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      {
        name: "Mi reparto",
        short_name: "Reparto",
        url: "/reparto"
      }
    ]
  };
}
