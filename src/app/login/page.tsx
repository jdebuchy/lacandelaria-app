import { GoogleLoginButton } from "@/components/google-login-button";
import { sanitizeRedirectPath } from "@/lib/auth-shared";
import { appConfig } from "@/lib/config";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    reason?: string;
  }>;
};

function getReasonCopy(reason?: string) {
  switch (reason) {
    case "forbidden":
      return "Tu usuario existe, pero no tiene el rol necesario para entrar a esta seccion.";
    case "missing_config":
      return "Falta configurar Supabase Auth. Revisa variables de entorno y el proveedor de Google.";
    case "not_registered":
      return "Solo pueden entrar usuarios registrados en la base con un rol activo.";
    default:
      return "Accede con Google y un perfil interno habilitado.";
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, reason } = await searchParams;
  const nextPath = sanitizeRedirectPath(next);
  const authConfigured = Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey);

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-10 text-stone-100 sm:px-6">
      <section className="mx-auto flex max-w-md flex-col gap-6 rounded-[2rem] border border-stone-800 bg-stone-900/70 p-6 sm:p-8">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
            Acceso interno
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50">
            Panel con Google SSO
          </h1>
          <p className="text-sm leading-6 text-stone-300">{getReasonCopy(reason)}</p>
        </div>

        <div className="rounded-2xl border border-stone-800 bg-stone-950/80 p-4 text-sm text-stone-300">
          <p>Ruta solicitada: {nextPath}</p>
          <p className="mt-2">
            Para entrar, tu email de Google tiene que existir en `profiles.email`, estar activo y
            tener un `role` permitido.
          </p>
        </div>

        {authConfigured ? (
          <GoogleLoginButton nextPath={nextPath} />
        ) : (
          <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            Falta configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </p>
        )}
      </section>
    </main>
  );
}
