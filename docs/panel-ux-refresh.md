# Panel UX Refresh

## Objetivo

Ordenar la experiencia del panel interno para que la navegación, los encabezados de sección y los flujos de alta/edición sean consistentes.

La intención original fue sacar patrones improvisados y acercar el panel a un shell más claro:

- navegación lateral en vez de menú superior
- jerarquía visual más limpia
- CTA primario siempre en el mismo lugar
- separación entre vistas de índice y vistas de formulario

## Plan original

### 1. Shell autenticado general

Mover todo `(panel)` a un layout compartido con:

- sidebar fijo en desktop
- drawer lateral en mobile
- bloque de usuario abajo
- navegación por rol
- separación entre operación y sistema

### 2. Navegación más minimalista

Tomar un patrón más sobrio para el sidebar:

- menos pills y badges innecesarios
- menos cajas dentro de cajas
- estados activos más discretos
- menú de usuario desplegable en el footer

### 3. Encabezados consistentes

Unificar la estructura de cabecera en secciones como:

- Clientes
- Pedidos
- Productos

Regla buscada:

- título y contexto a la izquierda
- CTA principal arriba a la derecha
- filtros y acciones secundarias en una segunda fila si hace falta

### 4. Productos: separar índice de formulario

La pantalla de productos mezclaba dos tareas de alto peso:

- explorar el catálogo
- crear o editar productos

La decisión fue partirla en:

- `/panel/products` como índice/listado
- `/panel/products/new` para alta
- `/panel/products/[productId]/edit` para edición

## Implementación actual

### Navegación del panel

Implementado:

- `src/app/(panel)/layout.tsx`
- `src/components/panel-nav.tsx`

Resultado:

- shell lateral para toda la experiencia autenticada
- orden de navegación: Resumen, Clientes, Pedidos, Logística, Reparto, Productos
- sección `Sistema` separada para `Usuarios`
- menú de usuario desplegable con acceso al sitio principal y logout

### Limpieza de cabeceras

Implementado:

- `src/app/(panel)/panel/customers/page.tsx`
- `src/app/(panel)/panel/products/page.tsx`

Resultado:

- se eliminaron pills y navegación pública incrustada dentro del panel
- el CTA primario quedó alineado con el patrón de `Pedidos`

### Refactor de productos

Implementado:

- `src/components/product-catalog-list.tsx`
- `src/components/product-catalog-manager.tsx`
- `src/app/(panel)/panel/products/page.tsx`
- `src/app/(panel)/panel/products/new/page.tsx`
- `src/app/(panel)/panel/products/[productId]/edit/page.tsx`

Resultado:

- el índice ya no muestra el formulario mezclado con el listado
- crear y editar producto ocurren en pantallas dedicadas
- el editor reutiliza la misma lógica de catálogo en modo `form-only`

## Decisiones UX tomadas

- evitar etiquetas como `Actual`, `Ir` o badges redundantes en navegación
- reducir peso visual del sidebar
- usar el nombre del usuario como trigger del menú de cuenta
- dejar la vista de productos orientada a exploración y acceso a edición

## Pendientes recomendados

### Productos

- agregar búsqueda y filtros al índice del catálogo
- mejorar densidad visual de las cards de producto
- mostrar señales más útiles para operación: cantidad de variantes vendibles, bundles, inactivos

### Panel general

- revisar otras secciones para eliminar restos de patrones anteriores
- homogeneizar spacing vertical entre páginas del panel
- correr validación técnica (`lint`, revisión responsive) en un entorno con `node`/`npm`

## Nota

Esta documentación resume el plan que motivó los cambios de UX ya implementados en el branch `feat/panel-ux-refresh`.
