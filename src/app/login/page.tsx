import { GoogleLoginButton } from "@/components/google-login-button";
import { sanitizeRedirectPath } from "@/lib/auth-shared";
import { appConfig } from "@/lib/config";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    reason?: string;
  }>;
};

type LoginNotice = {
  body: string;
  title: string;
  tone: "warning" | "error";
};

/**
 * Solo se avisa algo cuando hay algo que avisar. En el camino feliz la pantalla
 * es el nombre y el boton, sin explicaciones.
 */
function getNotice(reason?: string): LoginNotice | null {
  switch (reason) {
    case "not_registered":
      return {
        body: "Pedile a alguien del equipo que te dé de alta con este mismo correo.",
        title: "Esta cuenta todavía no tiene acceso",
        tone: "warning"
      };
    case "forbidden":
      return {
        body: "Entrá con otra cuenta o pedí que te cambien el permiso.",
        title: "Tu cuenta no llega a esta sección",
        tone: "warning"
      };
    case "missing_config":
      return {
        body: "Falta conectar el acceso con Google. Avisale a quien administra el sistema.",
        title: "El acceso no está configurado",
        tone: "error"
      };
    default:
      return null;
  }
}

const NOTICE_TONE_CLASS = {
  error: "border-rose-400/25 bg-rose-500/10 text-rose-100",
  warning: "border-amber-400/25 bg-amber-500/10 text-amber-100"
} as const;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, reason } = await searchParams;
  const nextPath = sanitizeRedirectPath(next);
  const authConfigured = Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey);
  const notice = authConfigured ? getNotice(reason) : getNotice("missing_config");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-sm">
        <div className="rounded-[1.75rem] border border-stone-800/80 bg-stone-900/60 p-7 shadow-2xl shadow-black/40 backdrop-blur-xs sm:p-9">
          <div className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_2px_rgba(52,211,153,0.55)]"
            />
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-300/80">Paltas</p>
          </div>

          <h1 className="mt-3 text-4xl font-semibold leading-none tracking-tight text-stone-50">
            La Candelaria
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-400">
            Panel interno de pedidos y reparto.
          </p>

          {notice ? (
            <div
              role="status"
              className={`mt-6 rounded-2xl border p-4 text-sm ${NOTICE_TONE_CLASS[notice.tone]}`}
            >
              <p className="font-medium">{notice.title}</p>
              <p className="mt-1 opacity-80">{notice.body}</p>
            </div>
          ) : null}

          <div className="mt-7">
            {authConfigured ? <GoogleLoginButton nextPath={nextPath} /> : null}
          </div>
        </div>

        <p className="mt-6 text-center text-xs uppercase tracking-[0.22em] text-stone-600">
          Pedidos · Reparto · Cobranzas
        </p>
      </section>
    </main>
  );
}
