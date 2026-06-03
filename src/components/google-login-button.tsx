"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type GoogleLoginButtonProps = {
  nextPath: string;
};

export function GoogleLoginButton({ nextPath }: GoogleLoginButtonProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin() {
    setPending(true);
    setMessage("");

    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", nextPath);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString()
      }
    });

    if (error) {
      setMessage("No se pudo iniciar el acceso con Google.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleLogin}
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-500 px-5 text-sm font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Redirigiendo..." : "Entrar con Google"}
      </button>
      {message ? <p className="text-sm text-rose-300">{message}</p> : null}
    </div>
  );
}
