import { BrandMark } from "@/components/ui/brand";
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
  error: "border-danger-line bg-danger-bg text-danger-fg",
  warning: "border-warn-line bg-warn-bg text-warn-fg"
} as const;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, reason } = await searchParams;
  const nextPath = sanitizeRedirectPath(next);
  const authConfigured = Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey);
  const notice = authConfigured ? getNotice(reason) : getNotice("missing_config");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-sm">
        <div className="rounded-card border border-line bg-paper p-7 shadow-2xl shadow-black/40 backdrop-blur-xs sm:p-9">
          {/* La marca a tamaño real. Es la primera pantalla y no tiene nada
              con que competir: el mejor lugar de la app para la identidad. */}
          <BrandMark className="h-14 w-14" />

          <h1 className="mt-4 text-display text-ink">Paltas La Candelaria</h1>
          <p className="mt-1 text-body text-ink-soft">Panel interno de pedidos y reparto.</p>

          {notice ? (
            <div
              role="status"
              className={`mt-6 rounded-card border p-4 text-body ${NOTICE_TONE_CLASS[notice.tone]}`}
            >
              <p className="font-medium">{notice.title}</p>
              <p className="mt-1 opacity-80">{notice.body}</p>
            </div>
          ) : null}

          <div className="mt-7">
            {authConfigured ? <GoogleLoginButton nextPath={nextPath} /> : null}
          </div>
        </div>

        <p className="mt-6 text-center text-meta text-ink-faint">
          Pedidos · Reparto · Cobranzas
        </p>
      </section>
    </main>
  );
}
