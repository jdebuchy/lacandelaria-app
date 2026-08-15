import { DashboardMetric } from "@/lib/types";

const metrics: DashboardMetric[] = [
  { label: "Catálogo", value: "Multi-producto", detail: "Pedidos con varios productos por orden" },
  { label: "Precios", value: "Por producto", detail: "Efectivo y transferencia por separado" },
  { label: "Comision", value: "15%", detail: "Para revendedores de barrio" },
  { label: "Objetivo", value: "Esta semana", detail: "Salir con un MVP operativo" }
];

const modules = [
  "Pedidos y reservas de stock",
  "Formulario publico sin login",
  "Clientes y CRM basico",
  "Entregas por zona",
  "Cobranza y deuda pendiente",
  "Comisiones de revendedores",
  "Reportes operativos"
];

const roles = [
  {
    name: "Admin",
    detail: "Administra usuarios, pedidos, entregas y permisos segun el rol."
  },
  {
    name: "Reseller",
    detail: "Genera pedidos, consulta sus ordenes, sigue comisiones y confirma entregas."
  },
  {
    name: "Repartidor",
    detail: "Ve solo las entregas asignadas del dia y marca cuando fueron entregadas."
  },
  {
    name: "Cobranza",
    detail: "Registra pagos y hace seguimiento de deuda pendiente cuando esa vista exista."
  }
];

const routes = [
  { href: "/order", label: "Formulario publico", detail: "Cliente carga pedido sin login." },
  {
    href: "/panel",
    label: "Centro de operacion",
    detail: "Administracion de pedidos, usuarios y seguimiento interno."
  },
  {
    href: "/panel/logistics/delivery",
    label: "Pantalla de reparto",
    detail: "Repartidor sigue sus entregas asignadas y marca estados."
  }
];

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <span className="inline-flex rounded-control border border-accent bg-accent-soft px-3 py-1 text-body text-accent">
              Paltas La Candelaria
            </span>
            <h1 className="max-w-4xl text-display font-semibold tracking-tight text-ink md:text-7xl">
              Venta, reparto y cobranza en una sola aplicación.
            </h1>
            <p className="max-w-2xl text-body leading-7 text-ink-soft sm:leading-8">
              La primera versión resuelve el flujo central: tomar pedidos, vender distintos
              productos, despachar por zona, registrar pagos y controlar comisiones sin depender de
              planillas sueltas.
            </p>
          </div>
          <div className="rounded-card border border-line bg-paper p-6 shadow-2xl shadow-black/20">
            <p className="text-body text-ink-soft">Decision</p>
            <p className="mt-4 text-display font-semibold text-ink">Arrancar con PWA</p>
            <ul className="mt-6 space-y-3 text-body leading-6 text-ink-soft">
              <li>Instalable en iPhone desde Safari.</li>
              <li>Una sola base de codigo.</li>
              <li>Salida rapida sin App Store.</li>
              <li>Escalable a app nativa mas adelante si hace falta.</li>
            </ul>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className="rounded-card border border-line bg-paper p-5"
            >
              <p className="text-body text-ink-soft">{metric.label}</p>
              <p className="mt-2 text-title font-semibold text-accent">{metric.value}</p>
              <p className="mt-2 text-body text-ink-soft">{metric.detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-card border border-line bg-linear-to-br from-paper to-paper-muted p-8">
            <h2 className="text-title font-semibold text-ink">Modulos del MVP</h2>
            <ul className="mt-6 grid gap-3 text-ink-soft">
              {modules.map((module) => (
                <li key={module} className="rounded-card border border-line bg-paper p-4">
                  {module}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-card border border-line bg-linear-to-br from-accent-soft to-paper-muted p-8">
            <h2 className="text-title font-semibold text-ink">Roles y permisos</h2>
            <div className="mt-6 grid gap-3">
              {roles.map((role) => (
                <div key={role.name} className="rounded-card border border-accent bg-black/10 p-4">
                  <p className="text-title font-medium text-accent">{role.name}</p>
                  <p className="mt-1 text-body text-ink-soft">{role.detail}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {routes.map((route) => (
            <a
              key={route.href}
              href={route.href}
              className="rounded-card border border-line bg-paper p-6 transition hover:border-accent hover:bg-paper"
            >
              <p className="text-title font-semibold text-ink">{route.label}</p>
              <p className="mt-2 text-body text-ink-soft">{route.detail}</p>
              <p className="mt-4 text-body text-accent">{route.href}</p>
            </a>
          ))}
        </section>

        <section className="rounded-card border border-line bg-paper p-8">
          <h2 className="text-title font-semibold text-ink">Proximo paso tecnico</h2>
          <p className="mt-4 max-w-3xl text-ink-soft">
            Implementar autenticacion interna con permisos por rol. Admin ve todo; reseller ve sus
            pedidos, comisiones y entregas relacionadas; repartidor ve solo sus entregas asignadas
            del dia. En Capital Federal conviene priorizar estados de ausencia y contacto rapido
            por WhatsApp antes que un sistema complejo de rutas.
          </p>
        </section>
      </section>
    </main>
  );
}
