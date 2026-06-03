import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "La Candelaria",
    description: "Operacion comercial, reparto y cobranza para Paltas La Candelaria.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0a09",
    theme_color: "#14532d",
    lang: "es-AR"
  };
}
