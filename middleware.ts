import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sanitizeRedirectPath } from "@/lib/auth-shared";
import { appConfig } from "@/lib/config";

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/panel") ||
    pathname.startsWith("/driver") ||
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
      setAll(cookiesToSet) {
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

export const config = {
  matcher: ["/panel/:path*", "/driver/:path*", "/api/panel/:path*", "/api/driver/:path*"]
};
