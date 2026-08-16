import {
  faArrowRight,
  faBoxOpen,
  faInbox,
  faMagnifyingGlass,
  faPencil,
  faPlus,
  faTrash,
  faTruck
} from "@fortawesome/pro-regular-svg-icons";
import type { ReactNode } from "react";
import { Badge, ZoneStamp } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardHeader, CardRow, PageHeader, PageShell } from "@/components/ui/card";
import { DateText } from "@/components/ui/date-text";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { EmptyState, Notice, Skeleton, Spinner } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { requirePageRole } from "@/lib/auth";
import { formatCurrency, formatDate, formatDateFriendly, formatDateTime, formatTime } from "@/lib/format";
import type { Tone } from "@/lib/status-tone";

const ADMIN_ONLY = ["admin"] as const;

/**
 * Lab del sistema de diseño.
 *
 * Muestra cada token y cada primitivo con todos sus estados. Sirve para dos
 * cosas: aprobar la direccion antes de tocar el resto de las pantallas, y
 * despues detectar regresiones de un vistazo cuando alguien cambia un token.
 *
 * Es la unica pantalla de la app cuyo contenido es la app misma, asi que se
 * permite ser mas verbosa de lo normal.
 */
export default async function DesignPage() {
  await requirePageRole(ADMIN_ONLY, "/panel/design");

  return (
    <PageShell>
      <PageHeader
        action={<Button icon={faPlus} variant="primary">Accion primaria</Button>}
        description="Todos los tokens y primitivos del sistema Campo. Cambia el tema con el boton del panel para verlos en claro y en oscuro."
        title="Sistema de diseño"
      />

      <Section title="Color" description="Los valores viven en globals.css. Cada par de texto y fondo pasa contraste AA, verificado en design-tokens.test.ts.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader title="Superficies" />
            <div className="mt-3 grid gap-2">
              <Swatch className="bg-paper" label="paper" note="cards y filas" />
              <Swatch className="bg-paper-muted" label="paper-muted" note="fondo de pagina" />
              <Swatch className="bg-paper-raised" label="paper-raised" note="hover y bloques" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Texto" />
            <div className="mt-3 grid gap-2">
              <p className="text-body text-ink">ink, texto principal</p>
              <p className="text-body text-ink-soft">ink-soft, texto secundario</p>
              <p className="text-body text-ink-faint">ink-faint, meta y placeholder</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Acento" description="La cascara de la palta." />
            <div className="mt-3 grid gap-2">
              <Swatch className="bg-accent" label="accent" note="boton primario y foco" />
              <Swatch className="bg-accent-strong" label="accent-strong" note="hover del primario" />
              <Swatch className="bg-accent-soft" label="accent-soft" note="fila seleccionada" />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Pulpa"
              description="Se usa en un solo lugar de toda la app: el sello de zona. Si aparece en un segundo lugar, algo se fue de las manos."
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <ZoneStamp>CABA</ZoneStamp>
              <ZoneStamp>Gral. Pacheco</ZoneStamp>
              <ZoneStamp>San Fernando</ZoneStamp>
              <ZoneStamp>Dique Lujan</ZoneStamp>
            </div>
          </Card>
        </div>
      </Section>

      <Section
        title="Tonos de estado"
        description="No hay un color por estado, hay un tono por significado. warn pide una persona, info esta en movimiento, success cerro bien, danger cerro mal."
      >
        <Card>
          <div className="grid gap-3">
            {(
              [
                ["warn", "Necesita que alguien haga algo", "A confirmar, pago pendiente o parcial"],
                ["info", "Esta en movimiento", "Confirmado, asignado, en ruta"],
                ["success", "Cerro bien", "Entregado, pagado"],
                ["danger", "Cerro mal", "Cancelado, entrega fallida"],
                ["neutral", "Sin novedad", "Borrador, parada pendiente"]
              ] as Array<[Tone, string, string]>
            ).map(([tone, meaning, states]) => (
              <div className="flex flex-wrap items-center gap-3" key={tone}>
                <Badge tone={tone}>{tone}</Badge>
                <span className="text-body text-ink">{meaning}</span>
                <span className="text-meta text-ink-faint">{states}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Tipografia" description="Archivo, una sola familia. Numeros tabulares donde hay plata.">
        <Card>
          <div className="grid gap-4">
            <TypeRow name="display" note="28px / 600 / -0.02em, titulo de pagina">
              <p className="text-display text-ink">Pedidos</p>
            </TypeRow>
            <TypeRow name="title" note="18px / 600, encabezado de seccion">
              <p className="text-title text-ink">Todos los pedidos</p>
            </TypeRow>
            <TypeRow name="body" note="14px, el caballo de batalla">
              <p className="text-body text-ink">Valeria Morgan, 40 x Paltas Caja de 4kg</p>
            </TypeRow>
            <TypeRow name="label" note="12px / 500, sentence case, sin tracking">
              <p className="text-label text-ink-soft">Esperando viaje</p>
            </TypeRow>
            <TypeRow name="meta" note="12px, dato de apoyo">
              <p className="text-meta text-ink-faint">Alta 15 ago 2026</p>
            </TypeRow>
            <TypeRow name="tabular" note="las columnas de plata tienen que aliñar">
              <div className="grid w-40 gap-0.5 text-right text-body text-ink" data-numeric>
                <span>{formatCurrency(1026000)}</span>
                <span>{formatCurrency(152600)}</span>
                <span>{formatCurrency(25000)}</span>
              </div>
            </TypeRow>
          </div>
        </Card>
      </Section>

      <Section title="Botones" description="Cinco variantes y cuatro tamaños reemplazan 75 strings de clase distintos.">
        <Card>
          <div className="grid gap-5">
            <Row label="Variantes">
              <Button variant="primary">Primario</Button>
              <Button variant="secondary">Secundario</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Peligro</Button>
              <Button variant="inverted">Invertido</Button>
            </Row>
            <Row label="Tamaños">
              <Button size="sm" variant="secondary">Chico</Button>
              <Button size="md" variant="secondary">Medio</Button>
              <Button size="lg" variant="secondary">Grande</Button>
            </Row>
            <Row label="Con icono">
              <Button icon={faPlus} variant="primary">Nuevo pedido</Button>
              <Button iconAfter={faArrowRight} variant="secondary">Ver detalle</Button>
              <IconButton icon={faPencil} label="Editar" variant="secondary" />
              <IconButton icon={faTrash} label="Eliminar" variant="danger" />
            </Row>
            <Row label="Estados">
              <Button loading variant="primary">Guardando</Button>
              <Button disabled variant="primary">Deshabilitado</Button>
              <Button disabled variant="secondary">Deshabilitado</Button>
            </Row>
            <Row label="Tactil, para /reparto">
              <div className="w-full max-w-sm">
                <Button icon={faTruck} size="touch" variant="primary">
                  Marcar entregado
                </Button>
              </div>
            </Row>
          </div>
        </Card>
      </Section>

      <Section title="Formularios" description="Un solo input y un solo anillo de foco. Antes habia cinco variantes que diferian en si el foco era verde o azul.">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del cliente">
              {(props) => <Input placeholder="Valeria Morgan" {...props} />}
            </Field>
            <Field hint="Se usa para avisar por WhatsApp." label="Telefono">
              {(props) => <Input placeholder="+54 9 11 5800-5263" {...props} />}
            </Field>
            <Field label="Zona">
              {(props) => (
                <Select defaultValue="" {...props}>
                  <option disabled value="">Elegi una zona</option>
                  <option>Cap. Federal</option>
                  <option>GBA</option>
                  <option>Barrios privados</option>
                </Select>
              )}
            </Field>
            <Field error="Ingresa un monto mayor a cero." label="Monto cobrado">
              {(props) => <Input defaultValue="0" {...props} />}
            </Field>
            <Field className="sm:col-span-2" label="Notas del viaje">
              {(props) => <Textarea placeholder="Indicaciones para el armado o el reparto" {...props} />}
            </Field>
            <Field className="sm:col-span-2" label="Deshabilitado">
              {(props) => <Input disabled value="No se puede editar un pedido ya asignado" {...props} />}
            </Field>
          </div>
        </Card>
      </Section>

      <Section title="Metricas" description="Antes eran seis copias del mismo bloque, con tonos elegidos sin criterio.">
        <MetricGrid>
          <MetricCard detail="Sin viaje asignado" label="Esperando viaje" tone="warn" value="8" />
          <MetricCard label="En ruta" tone="info" value="3" />
          <MetricCard label="Entregados hoy" tone="success" value="12" />
          <MetricCard detail="Ver todos" href="/panel/orders" label="Pedidos" value="252" />
        </MetricGrid>
      </Section>

      <Section title="Tabla" description="Las columnas se declaran una vez. En escritorio es grilla, en telefono es card. Achica la ventana para verlo.">
        <DemoTable />
        <Pagination buildHref={(page) => `/panel/design?page=${page}`} page={2} totalPages={6} />
      </Section>

      <Section title="Avisos y estados vacios">
        <div className="grid gap-3">
          <Notice tone="danger">No se pudo guardar el pedido. Revisa el telefono del cliente y proba de nuevo.</Notice>
          <Notice tone="warn">Este pedido ya esta en un viaje, asi que no se puede editar.</Notice>
          <Notice tone="success">Pago registrado por {formatCurrency(25000)}.</Notice>
          <EmptyState
            action={<Button icon={faPlus} variant="primary">Nuevo pedido</Button>}
            description="Cuando entre el primer pedido del dia va a aparecer aca."
            icon={faInbox}
            title="Todavia no hay pedidos"
          />
        </div>
      </Section>

      <Section title="Carga">
        <Card>
          <div className="grid gap-4">
            <Row label="Spinner">
              <Spinner />
              <Button loading variant="secondary">Cargando</Button>
            </Row>
            <Row label="Skeleton">
              <div className="grid w-full max-w-sm gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Row>
          </div>
        </Card>
      </Section>

      <Section title="Iconos" description="FontAwesome Pro, estilo Classic Regular. Se dimensionan en em, asi que heredan el tamaño del contexto.">
        <Card>
          <div className="flex flex-wrap items-end gap-6">
            {[faTruck, faBoxOpen, faInbox, faMagnifyingGlass, faPencil, faPlus].map((icon, index) => (
              <Icon className="text-title text-ink-soft" icon={icon} key={index} />
            ))}
            <span className="text-body text-ink">
              <Icon className="text-ink-soft" icon={faTruck} /> dentro de texto body
            </span>
            <span className="text-display text-ink">
              <Icon className="text-ink-soft" icon={faTruck} /> en display
            </span>
          </div>
        </Card>
      </Section>

      <Section title="Formato" description="Una sola fuente para fecha y plata. Antes habia 21 formateadores de fecha y siete formas de escribir un precio.">
        <Card padded={false}>
          <CardRow>
            <FormatRow name="formatCurrency" value={formatCurrency(1026000)} />
          </CardRow>
          <CardRow>
            <FormatRow name="formatDate" value={formatDate("2026-08-15T12:00:00Z")} />
          </CardRow>
          <CardRow>
            <FormatRow name="formatDateTime" value={formatDateTime("2026-08-15T12:00:00Z")} />
          </CardRow>
          <CardRow>
            <FormatRow name="formatTime, reloj de 24 horas" value={formatTime("2026-08-15T20:30:00Z")} />
          </CardRow>
          <CardRow>
            <FormatRow name="formatDateFriendly, hoy" value={formatDateFriendly(new Date())} />
          </CardRow>
          <CardRow>
            <FormatRow
              name="formatDateFriendly, esta semana"
              value={formatDateFriendly(new Date(Date.now() - 3 * 86_400_000))}
            />
          </CardRow>
          <CardRow>
            <FormatRow
              name="formatDateFriendly, sin año si es el corriente"
              value={formatDateFriendly(new Date(Date.now() - 60 * 86_400_000))}
            />
          </CardRow>
          <CardRow>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-meta text-ink-faint">
                DateText, la fecha exacta esta en el title
              </span>
              <DateText className="text-body text-ink" value={new Date(Date.now() - 60 * 86_400_000)} />
            </div>
          </CardRow>
        </Card>
      </Section>
    </PageShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Andamiaje del lab. Nada de esto es parte del sistema.                      */
/* -------------------------------------------------------------------------- */

function Section({
  children,
  description,
  title
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <div>
        <h2 className="text-title text-ink">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-body text-ink-soft">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-40 shrink-0 text-label text-ink-faint">{label}</span>
      {children}
    </div>
  );
}

function Swatch({ className, label, note }: { className: string; label: string; note: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-9 w-9 shrink-0 rounded-control border border-line ${className}`} />
      <span className="text-body text-ink">{label}</span>
      <span className="text-meta text-ink-faint">{note}</span>
    </div>
  );
}

function TypeRow({ children, name, note }: { children: ReactNode; name: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span className="w-20 shrink-0 text-label text-ink-faint">{name}</span>
      <div className="min-w-0 flex-1">{children}</div>
      <span className="text-meta text-ink-faint">{note}</span>
    </div>
  );
}

function FormatRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-meta text-ink-faint">{name}</span>
      <span className="text-body text-ink" data-numeric>
        {value}
      </span>
    </div>
  );
}

type DemoRow = {
  cliente: string;
  id: string;
  items: string;
  numero: string;
  tone: Tone;
  total: number;
  zona: string;
  estado: string;
};

const DEMO_ROWS: DemoRow[] = [
  { cliente: "Valeria Morgan", estado: "Entregado", id: "1", items: "40 x Paltas Caja de 4kg", numero: "#252", tone: "success", total: 1026000, zona: "Gral. Pacheco" },
  { cliente: "Tomas Murphy", estado: "En ruta", id: "2", items: "1 x Paltas Caja de 4kg", numero: "#251", tone: "info", total: 25000, zona: "CABA" },
  { cliente: "Teresa Cartasso", estado: "A confirmar", id: "3", items: "12 x Paltas Caja de 4kg", numero: "#250", tone: "warn", total: 300000, zona: "San Fernando" },
  { cliente: "Silvina Diaz Usandivaras", estado: "Cancelado", id: "4", items: "5 x Paltas Caja de 4kg, 1 x Mix Premium 800g", numero: "#249", tone: "danger", total: 152600, zona: "Dique Lujan" }
];

const DEMO_COLUMNS: Array<Column<DemoRow>> = [
  {
    cell: (row) => (
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-meta text-ink-faint" data-numeric>{row.numero}</span>
        <span className="truncate font-medium text-ink">{row.cliente}</span>
      </div>
    ),
    header: "Cliente",
    key: "cliente",
    primary: true,
    width: "1.8fr"
  },
  { cell: (row) => <ZoneStamp>{row.zona}</ZoneStamp>, header: "Zona", key: "zona", width: "1fr" },
  { cell: (row) => <Badge tone={row.tone}>{row.estado}</Badge>, header: "Estado", key: "estado", width: "1fr" },
  { cell: (row) => <span className="truncate text-ink-soft">{row.items}</span>, header: "Items", hideOnMobile: true, key: "items", width: "1.6fr" },
  { align: "right", cell: (row) => <span data-numeric>{formatCurrency(row.total)}</span>, header: "Total", key: "total", width: "0.9fr" }
];

function DemoTable() {
  return (
    <DataTable
      columns={DEMO_COLUMNS}
      getKey={(row) => row.id}
      href={() => "/panel/design"}
      rows={DEMO_ROWS}
    />
  );
}
