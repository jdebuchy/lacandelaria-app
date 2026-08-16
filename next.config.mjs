/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Origenes permitidos al desarrollar. Hacen falta para probar desde el
  // telefono: por IP en la red local, o por tunel HTTPS (necesario para el
  // login con Google y para instalar la PWA).
  allowedDevOrigins: [
    "127.0.0.1",
    "192.168.86.28",
    "uncapsized-laughably-stephenie.ngrok-free.dev",
    "*.ngrok-free.dev",
    "*.trycloudflare.com"
  ]
};

export default nextConfig;
