"use client";

import { FormEvent, useState } from "react";
import { getRoleLabel } from "@/lib/auth-shared";
import type { UserRole } from "@/lib/types";

type InternalUserRecord = {
  active: boolean;
  auth_user_id: string | null;
  created_at: string;
  email: string | null;
  full_name: string;
  id: string;
  role: UserRole;
};

type InternalUsersManagerProps = {
  users: InternalUserRecord[];
};

type FormState = {
  success: boolean;
  message: string;
};

const initialState: FormState = {
  success: false,
  message: ""
};

const ROLE_OPTIONS: UserRole[] = ["driver", "seller", "collector", "admin"];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

export function InternalUsersManager({ users }: InternalUsersManagerProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("driver");
  const [active, setActive] = useState(true);
  const [state, setState] = useState<FormState>(initialState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState(initialState);
    setIsPending(true);

    const response = await fetch("/api/panel/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        fullName,
        role,
        active
      })
    });

    const result = (await response.json()) as FormState;
    setState(result);
    setIsPending(false);

    if (!response.ok) {
      return;
    }

    setEmail("");
    setFullName("");
    setRole("driver");
    setActive(true);
    window.location.reload();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={handleSubmit} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-stone-50">Nuevo usuario interno</h2>
          <p className="text-sm leading-6 text-stone-400">
            Puedes cargar repartidores con mails ficticios como <span className="text-stone-200">reparto1@fake.local</span>.
            Servirán para asignación interna, aunque no podrán iniciar sesión con Google.
          </p>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm text-stone-300">
            Nombre completo
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none transition focus:border-sky-400"
              placeholder="Carlos Gómez"
              required
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none transition focus:border-sky-400"
              placeholder="reparto1@fake.local"
              required
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300">
            Rol
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none transition focus:border-sky-400"
            >
              {ROLE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {getRoleLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-950/70 px-4 py-3 text-sm text-stone-300">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="h-4 w-4 rounded border-stone-600 bg-stone-950 text-sky-400 focus:ring-sky-400"
            />
            Usuario activo
          </label>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="min-h-5 text-sm">
            {state.message ? (
              <p className={state.success ? "text-emerald-300" : "text-rose-300"}>{state.message}</p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Creando..." : "Crear usuario"}
          </button>
        </div>
      </form>

      <section className="rounded-3xl border border-stone-800 bg-stone-900/70">
        <div className="flex items-center justify-between gap-4 border-b border-stone-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-50">Usuarios internos</h2>
            <p className="text-sm text-stone-500">{users.length} perfiles registrados</p>
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="grid grid-cols-[1.1fr_1.2fr_0.8fr_0.8fr_0.8fr] border-b border-stone-800 px-5 py-3 text-xs uppercase tracking-[0.18em] text-stone-400">
            <div>Nombre</div>
            <div>Email</div>
            <div>Rol</div>
            <div>Estado</div>
            <div>Alta</div>
          </div>
          {users.length ? (
            users.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[1.1fr_1.2fr_0.8fr_0.8fr_0.8fr] border-b border-stone-800 px-5 py-4 text-sm text-stone-300 last:border-b-0"
              >
                <div>
                  <p className="font-medium text-stone-100">{user.full_name}</p>
                  {user.auth_user_id ? (
                    <p className="mt-1 text-xs text-emerald-300">Linked con Google</p>
                  ) : (
                    <p className="mt-1 text-xs text-stone-500">Sin login vinculado</p>
                  )}
                </div>
                <div className="break-all">{user.email ?? "-"}</div>
                <div>{getRoleLabel(user.role)}</div>
                <div>{user.active ? "Activo" : "Inactivo"}</div>
                <div>{formatDate(user.created_at)}</div>
              </div>
            ))
          ) : (
            <div className="px-5 py-8 text-center text-sm text-stone-500">Todavía no hay usuarios internos.</div>
          )}
        </div>

        <div className="grid gap-3 p-4 lg:hidden">
          {users.length ? (
            users.map((user) => (
              <article key={user.id} className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-stone-50">{user.full_name}</p>
                    <p className="mt-1 text-sm text-stone-400 break-all">{user.email ?? "-"}</p>
                  </div>
                  <span className="rounded-full border border-stone-700 bg-stone-900 px-3 py-1 text-xs text-stone-300">
                    {getRoleLabel(user.role)}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-stone-400">
                  <p>Estado: {user.active ? "Activo" : "Inactivo"}</p>
                  <p>Alta: {formatDate(user.created_at)}</p>
                  <p>{user.auth_user_id ? "Linked con Google" : "Sin login vinculado"}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-800 bg-stone-950/60 px-4 py-6 text-sm text-stone-500">
              Todavía no hay usuarios internos.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
