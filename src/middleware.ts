import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sanitizeRedirectPath } from "@/lib/auth-shared";
import { appConfig } from "@/lib/config";
import { shouldBlockTunneledRequest } from "@/lib/tunnel-guard";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/panel") ||
    pathname.startsWith("/driver") ||
    pathname.startsWith("/reparto") ||
    pathname.startsWith("/api/panel") ||
    pathname.startsWith("/api/driver")
  );
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function buildLoginUrl(request: NextRequest, reason?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", sanitizeRedirectPath(`${request.nextUrl.pathname}${request.nextUrl.search}`));

  if (reason) {
    url.searchParams.set("reason", reason);
  }

  return url;
}

export async function middleware(request: NextRequest) {
  // Primero de todo: por el tunel de desarrollo solo entra el webhook del bot.
  // Un 404 seco, sin cuerpo, para no confirmar que la ruta existe.
  if (shouldBlockTunneledRequest(request.headers, request.nextUrl.pathname, process.env.NODE_ENV)) {
    return new NextResponse(null, { status: 404 });
  }

  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
    if (isApiPath(request.nextUrl.pathname)) {
      return NextResponse.json(
        { success: false, message: "Supabase Auth no esta configurado." },
        { status: 503 }
      );
    }

    return NextResponse.redirect(buildLoginUrl(request, "missing_config"));
  }

  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    if (isApiPath(request.nextUrl.pathname)) {
      return NextResponse.json(
        { success: false, message: "Debes iniciar sesion para acceder." },
        { status: 401 }
      );
    }

    return NextResponse.redirect(buildLoginUrl(request));
  }

  return response;
}

// El matcher pasa a ser todo el sitio porque el candado del tunel tiene que ver
// tambien las rutas publicas: son las que quedaban expuestas. La primera linea
// de middleware() devuelve enseguida para las que no requieren sesion, asi que
// el costo de las rutas nuevas es un if.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
