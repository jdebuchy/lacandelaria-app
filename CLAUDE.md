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

Scripts sueltos van como `.tmp-*.mjs`, que está gitignoreado. El repo es público y estos scripts suelen quedar con datos reales de clientes.

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

## Convenciones de código

Español en UI y comentarios. Props de tipos en orden alfabético. Páginas son Server Components async con `requirePageRole(ROLES, path)` como primera línea; las APIs usan `requireApiRole`. Tests al lado del código (`src/lib/*.test.ts`).

Los comentarios explican **por qué**, no qué. Si algo se ve raro pero es deliberado, dejá dicho qué se probó y por qué se descartó, o el próximo lo "arregla".
