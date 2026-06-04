# Modelo de catálogo

## Resumen

El catálogo se modela con dos niveles:

- `producto base`: identidad comercial, por ejemplo `Avellanas`, `Mix Premium`, `Palta Hass`
- `variante`: unidad concreta que el sistema vende o usa internamente, por ejemplo `250 g`, `500 g`, `800 g`, `Caja de 4 kg`

Cada variante tiene dos ejes de clasificación:

- `visibilidad`: `vendible | solo_interna`
- `composición`: `simple | compuesta`

Además, cada producto base puede definir una `variante vendible por defecto` para acelerar la carga de pedidos.

## Producto base

Representa el producto como lo entiende el negocio.

Ejemplos:

- `Avellanas`
- `Almendras`
- `Nuez mariposa`
- `Mix Premium`
- `Palta Hass`

Responsabilidades:

- nombre comercial
- descripción general
- orden de catálogo
- estado activo
- agrupación para reportes
- variante vendible por defecto

## Variante

Representa la unidad concreta con la que opera el sistema.

Ejemplos:

- `Avellanas 250 g`
- `Avellanas 500 g`
- `Palta Hass Caja 4 kg`
- `Mix Premium 800 g`

Responsabilidades:

- presentación
- precio
- slug
- estado
- stock operativo
- referencia de pedido

Regla principal:

- todo pedido compra una `variante`
- el pedido y sus snapshots siguen apuntando a la variante elegida

## Clasificación de variantes

### Visibilidad

- `vendible`: aparece en panel y/o formulario público
- `solo_interna`: no aparece para comprar, pero puede existir para stock, composición o reportes

### Composición

- `simple`: no se descompone en otros componentes
- `compuesta`: está formada por otras variantes

Esto permite combinaciones como:

- `vendible + simple`: `Almendras 500 g`
- `solo_interna + simple`: `Almendra 200 g` usada dentro de mixes
- `vendible + compuesta`: `Mix Premium 800 g`

Default para esta etapa:

- no usar `solo_interna + compuesta` salvo que aparezca una necesidad concreta

## Variante por defecto

Cada producto base puede definir una `variante vendible por defecto`.

Reglas:

- si el producto tiene una sola variante vendible activa, esa se usa automáticamente
- si tiene varias, se puede definir una como default
- si no hay default explícito, se usa la primera por orden

Objetivo:

- acelerar la carga de pedidos
- evitar pasos extra en productos de alta recurrencia
- mantener el modelo producto + variantes sin volver a una lista plana

## Regla para mixes y combos

Caso oficial de referencia:

- producto base: `Mix Premium`
- variante vendible: `Mix Premium 800 g`
- precio: único y propio del mix
- composición interna:
  - `Almendra 200 g`
  - `Nuez mariposa 200 g`
  - `Avellana 200 g`
  - `Cajú 200 g`

Decisión importante:

- esas variantes de `200 g` pueden existir como `solo_interna + simple`
- no hace falta que estén publicadas para la venta individual
- existen para soportar stock, composición y reportes

## Stock y reportes

### Stock en esta etapa

El stock vive a nivel de variante.

Reglas:

- una variante `simple` descuenta su propio stock
- una variante `compuesta` descuenta stock de sus componentes
- los bundles no tienen stock independiente en esta primera versión

Esto evita duplicar stock y mantiene trazabilidad real.

### Reportes esperados

El modelo debe permitir:

- ventas por producto base
- ventas por variante vendible
- consumo por componente interno
- lectura comercial del mix como producto final
- lectura operativa de qué insumos/productos rotan más

## Impacto funcional esperado

### Cliente

- ve un producto final con su presentación
- puede leer qué trae un mix
- no ve la composición interna como líneas separadas

### Admin

- crea productos base
- crea variantes
- define si una variante es `vendible` o `solo interna`
- define si una variante es `simple` o `compuesta`
- si es compuesta, carga sus componentes y cantidades
- define la variante vendible por defecto del producto base

### Pedidos

- guardan la variante comprada
- pueden precargar la variante por defecto al elegir producto
- no muestran componentes como líneas separadas
- expanden a componentes solo para stock y analítica interna

## Fuera de alcance por ahora

- stock por producto base
- stock por gramos/kilos como unidad madre
- mixes prearmados con stock propio
- sustituciones automáticas de componentes
- pricing automático por costo de componentes
- recetas variables según lote
