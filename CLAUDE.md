# La Candelaria

Panel interno de Paltas La Candelaria: pedidos, logística, reparto y cobranza. Argentina, ARS, `es-AR`, timezone `America/Argentina/Buenos_Aires`.

Next 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · Supabase · Zod · Vitest.

## Comandos

```bash
npm run dev            # :3000
npm run build          # obligatorio antes de dar algo por terminado
npm run test           # vitest, 173 tests
npx tsc --noEmit       # más rápido que build para iterar
```

## Cómo trabajar acá

**Mirá la pantalla antes de escribir mucho.** Esta app se juzga por cómo se ve. Escribir 500 líneas y después mirar cuesta un ciclo entero de correcciones. Con `chrome-devtools`: navegá, capturá, corregí. Si el navegador está bloqueado por una instancia huérfana, pedile al usuario que cierre la ventana en vez de avanzar a ciegas.

**Los codemods se prueban en un archivo antes de los 69.** Un `\b` mal puesto convierte `rounded-control` en `rounded-control-control` en todo el repo. Corré sobre un archivo, leé el diff, después escalá.

**Si hay otro agente trabajando, usá un worktree.** No hagas checkout en el directorio compartido: le arrancás los archivos de abajo.

```bash
git worktree add .claude/worktrees/<nombre> <rama>
cd .claude/worktrees/<nombre> && npm install   # node_modules propio, no se comparte
cp ../../../.env.local .
npm run dev -- --port 3001
```

**No leas `.env.local`.** Para consultar Supabase: `node --env-file=.env.local script.mjs`.

Scripts sueltos van como `.tmp-*.mjs`, que está gitignoreado. El repo es público y estos scripts suelen quedar con datos reales de clientes. Van adentro del repo: afuera no resuelven `node_modules`.

**No hay sistema de migraciones.** Los `.sql` de `supabase/` se aplican a mano y nada registra cuáles corrieron. Dejá la fecha de aplicación como comentario en la primera línea del archivo, o el próximo no sabe si ya está aplicado.

**`zod` y `@supabase/ssr` están pinneados sin `^`.** Si una dependencia nueva pide otra versión, preguntá antes de bumpear: puede haber un motivo que no está escrito.

## Sistema de diseño "Campo"

Todo vive en `src/app/globals.css` (tokens) y `src/components/ui/` (primitivos). Comparte vocabulario con `40q-bi-scripts/crm/frontend`: si dudás de una convención, mirá ahí.

**Nunca escribas un color de Tailwind crudo.** Ni `bg-stone-900`, ni `text-emerald-400`, ni `#hex`. Solo tokens:

| Rol | Tokens |
|---|---|
| Superficie | `paper`, `paper-muted`, `paper-raised` |
| Texto | `ink`, `ink-soft`, `ink-faint` |
| Bordes | `line` (hairline), `line-strong` (bordes de control, cumple 3:1) |
| Acento | `accent`, `accent-strong`, `accent-soft`, `accent-fg` |
| Estado | `warn`, `info`, `success`, `danger`, `neutral`, cada uno con `-fg` `-bg` `-line` |

Claro por defecto, oscuro por clase `.dark`. `/reparto` va siempre claro: se usa al sol.

**Tipografía:** `text-display`, `text-title`, `text-body`, `text-meta`. Nada de `text-3xl` ni `text-[15px]`. Sin `uppercase tracking-[...]`: eso era el eyebrow viejo y gritaba.

**Radios:** `rounded-control` (2px) y `rounded-card` (3px). `rounded-full` solo para círculos de verdad (avatares, puntos).

**Estados:** el tono y la prominencia salen de `src/lib/status-tone.ts`, nunca se deciden en la pantalla. La prominencia evita el muro de color: en una tabla donde el 90% dice "Entregado", la caja no informa, solo ocupa.

**Formato:** todo desde `src/lib/format.ts` (`formatCurrency`, `formatDateShort`, `formatDateTime`). Nunca `toLocaleDateString` suelto. Teléfonos y nombres en `src/lib/contact.ts`.

**La pulpa** (`--pulp`) se usa en dos lugares y en ninguno más: la marca y el sello de zona en Armado de viajes. En Pedidos la zona va como texto: probado, y repetido en 50 filas grita más que el nombre del cliente.

**La identidad va en el chrome, no en los datos:** sidebar, login, `/reparto`, estados vacíos. En una tabla la marca compite con la información.

**Primitivos disponibles** en `src/components/ui/`: `Button` / `ButtonLink` / `IconButton`, `DataTable` + `Pagination`, `Badge`, `ZoneStamp`, `Field` / `Input` / `Select` / `Textarea`, `Card` / `PageShell` / `PageHeader`, `MetricCard`, `Modal`, `EmptyState`, `Notice`, `Spinner`, `Icon`, `BrandMark`. Si vas a escribir un `<button>` con clases a mano, ya existe.

`/panel/design` muestra todo el sistema con sus estados, en ambos temas. Mirala antes de inventar un componente.

**Íconos:** FontAwesome Pro, estilo Classic Regular (`@fortawesome/pro-regular-svg-icons`), importados por nombre. Siempre a través de `<Icon>`, que dimensiona en `em` y hereda el tamaño del contexto. En Vercel hace falta `FONTAWESOME_NPM_AUTH_TOKEN`.

## Reglas que sostienen esto

`src/lib/design-tokens.test.ts` parsea `globals.css` y verifica contraste AA de los 24 pares de token en ambos temas. Si cambiás un color y CI se pone rojo, el color está mal, no el test.

Modales: usá `Modal`, que ya trae foco atrapado, Escape y ARIA. Los overlays a mano que había antes no tenían nada de eso.

## Reglas del dominio

**Los pedidos se crean a precio de lista (`transfer_price`).** El descuento por efectivo se aplica recién al cobrar, en `prepareOrderForFirstPaymentMethod()` (`src/lib/payments.ts`), que reprecia los ítems y el total. No repliques ese cálculo en otro lado ni asumas que el precio del pedido es el final.

**Precios, stock, zonas y fechas salen siempre de Supabase.** Nunca de un modelo, nunca hardcodeados. Es la regla más dura del proyecto y vale para el bot, el formulario público y el panel.

Caja de 4 kg. Comisión de revendedora 15%. Un pedido se crea solo tras confirmación explícita del cliente. Respetá `whatsapp_opt_in` y `whatsapp_opt_out_at` siempre.

## Bot conversacional

Motor agnóstico de canal en `src/lib/bot/`. La lógica de decisión son funciones puras con tests (`gate`, `analyze`, `engine`); `conversations.ts` es lo único que toca Supabase. Los adaptadores de canal (`channels/`) y de LLM (`llm/`) son finos e intercambiables por variable de entorno.

**El IO se mantiene afuera para que el motor sea testeable sin mocks.** Si vas a agregar una regla de conversación, va en `engine.ts` como función pura y recibe el estado ya cargado. No metas una consulta ahí adentro.

**Nada de `Date.now()` en funciones puras.** El instante se inyecta como parámetro `now`, o el test depende del reloj y de la timezone de la máquina.

`evaluateGate()` corre antes de cualquier llamada al modelo y es lo que evita quemar créditos con mensajes que no son pedidos. Es deliberadamente conservador: ante la duda deja pasar, porque ignorar a un cliente real cuesta más que una llamada. Cada llamada efectiva queda en `bot_llm_usage`.

**Antes de cambiar una regla del bot, leé `docs/bot-decisiones.md`.** Varias de las que parecen arbitrarias (la ventana de duplicados de 15s, que no haya filtro por vocabulario, que un saludo no llame al modelo) salieron de medir sobre mensajes reales, y el documento tiene el número que las justifica.

Detalle de proveedores, variables y puesta en marcha: `README.md`. Plan de las fases que faltan: `docs/superpowers/plans/`.

## Convenciones de código

Español en UI y comentarios. Props de tipos en orden alfabético. Páginas son Server Components async con `requirePageRole(ROLES, path)` como primera línea; las APIs usan `requireApiRole`. Tests al lado del código (`src/lib/*.test.ts`).

**Los comentarios van sin acentos; lo que lee una persona, no.** Identificadores y comentarios en `.ts` se escriben sin tildes, para no depender de la codificación del archivo. Eso es una convención de código y no aplica a los textos que ve el usuario: en la UI y en los mensajes del bot, "dirección" lleva tilde y las oraciones arrancan en mayúscula. Un mensaje sin acentos no se lee informal, se lee descuidado. La única licencia deliberada son los signos de apertura, que el bot no usa: ver `docs/bot-decisiones.md`.

Los comentarios explican **por qué**, no qué. Si algo se ve raro pero es deliberado, dejá dicho qué se probó y por qué se descartó, o el próximo lo "arregla".
