// El tunel de desarrollo (cloudflared, ngrok) publica el servidor de dev entero
// en una URL de internet: el panel, el login y todas las APIs, sin autenticacion.
// La URL es aleatoria, pero eso es oscuridad, no seguridad.
//
// La regla es simple: por el tunel solo entra lo que el bot necesita. Todo lo
// demas contesta 404, que ademas no revela que la ruta existe.

const TUNNEL_HOST_SUFFIXES = [".trycloudflare.com", ".ngrok-free.dev", ".ngrok.io", ".ngrok.app"];

// Lo unico que se expone. El webhook ya valida su propio secreto, asi que quedan
// dos candados en serie; /api/health existe para que el script de setup del
// webhook pueda verificar el tunel antes de registrarlo.
const TUNNEL_ALLOWED_PATHS = ["/api/bot/telegram", "/api/health"];

// Cloudflare agrega estos headers en cada request que pasa por su red. Los miro
// ademas del host porque no dependen de que cloudflared preserve el Host
// original, cosa que cambia segun como se levante el tunel.
const TUNNEL_HEADERS = ["cf-ray", "cf-connecting-ip", "x-forwarded-host"];

function hostLooksTunneled(host: string) {
  const limpio = host.trim().toLowerCase().split(":")[0];

  return TUNNEL_HOST_SUFFIXES.some((suffix) => limpio.endsWith(suffix));
}

export function isTunneled(headers: Headers): boolean {
  for (const nombre of TUNNEL_HEADERS) {
    const valor = headers.get(nombre);

    if (!valor) {
      continue;
    }

    // x-forwarded-host lo pone cualquier proxy, incluido uno local: solo cuenta
    // si apunta a un dominio de tunel.
    if (nombre === "x-forwarded-host") {
      if (hostLooksTunneled(valor)) {
        return true;
      }

      continue;
    }

    return true;
  }

  return hostLooksTunneled(headers.get("host") ?? "");
}

export function isAllowedThroughTunnel(pathname: string): boolean {
  return TUNNEL_ALLOWED_PATHS.includes(pathname);
}

// El candado vale solo fuera de produccion: lo que protege es el servidor de
// desarrollo. En produccion el host es el dominio real y esto queda inerte, pero
// lo dejo explicito para que un deploy detras de Cloudflare no se apague solo.
export function shouldBlockTunneledRequest(headers: Headers, pathname: string, nodeEnv?: string) {
  if (nodeEnv === "production") {
    return false;
  }

  return isTunneled(headers) && !isAllowedThroughTunnel(pathname);
}
