# Bot conversacional: decisiones y por qué

Bitácora de las decisiones de diseño de Cande, con la evidencia que las motivó.

Las **reglas ejecutables** viven en el código (`src/lib/bot/`) y en sus tests; los **datos operativos** (zonas, precios, tono) en `commercial_settings` de Supabase. Acá va lo que no está en ninguno de los dos: por qué cada cosa es como es.

Cuando cambies una regla, actualizá la entrada. Si una decisión resulta equivocada, no la borres: agregá abajo qué pasó. El error documentado vale más que la regla sola.

---

## Qué contesta el bot y qué deriva

**Decisión.** Un reclamo va a una persona siempre. Precios, zonas y catálogo los contesta el bot **solo si el contexto comercial tiene los datos**; si está vacío, deriva.

**Por qué.** La regla dura del proyecto es que los precios salen del ERP, no del modelo. Eso no obliga a que el bot se calle: obliga a que la respuesta venga de un dato verificable. `scripts/bot-sync-context.mjs` genera el contexto desde la base, así que mientras se corra, la regla se cumple.

**Evidencia.** Sobre 343 mensajes reales de Instagram, el tema más consultado es **zona de entrega** (34 menciones), por encima de pedido (21) y precio (17). Derivar zonas a un humano significaba escalar el caso más frecuente del negocio. Un "hacen envíos a Bariloche?" (respuesta: no) terminaba con el cliente esperando a que alguien le contestara algo que el bot sabía.

**Implementación.** `src/lib/bot/capabilities.ts`. Doble candado: la bandera `can_answer` habilita, y aun así se verifica que haya datos cargados. Un contexto a medio poblar deriva en vez de improvisar.

---

## El saludo no deriva a humano

**Decisión.** Un saludo pelado ("hola", "buenas tardes") recibe una respuesta de bienvenida fija, sin llamar al modelo y sin penalizar.

**Por qué.** Un "Hola" solo no le da al modelo con qué trabajar: devuelve baja confianza, y baja confianza dispara handoff. Como en Argentina prácticamente toda conversación empieza saludando, el bot moría en el primer mensaje de casi todas.

**Evidencia.** Encontrado probando en vivo: el primer "Hola" derivó la conversación a `needs_human`, y a partir de ahí el bot ignoró seis mensajes seguidos, incluidos "Necesito comprar paltas" y "Estoy en Bariloche".

**Implementación.** `isGreetingOnly()` en `src/lib/bot/gate.ts`. Va **antes** del resto de los chequeos de contenido. Un saludo con pedido adentro ("hola, quiero paltas") sí llega al modelo.

---

## Sin filtro por vocabulario

**Decisión.** Se sacó el filtro que exigía palabras del negocio para dejar pasar un mensaje al modelo. El gasto lo contienen el límite de respuestas por hora y el presupuesto diario.

**Por qué.** Adivinar de qué está hablando alguien por palabras sueltas funciona mal, y falla justo en las conversaciones que ya están andando.

**Evidencia.** Medido sobre los 343 mensajes reales: el filtro marcaba como fuera de tema al **63%**. Entre los descartados: "De una" (una confirmación de compra), "Todo buenos aires?" (una pregunta de zona) y "Hasta las 19 hs, igual mis compañeros lo pueden recibir" (alguien coordinando la entrega).

**Contrapartida asumida.** Cualquiera que le escriba al bot consume LLM hasta agotar el presupuesto diario de esa conversación. Se aceptó porque los límites por hora y por día son medidas que no dependen de adivinar el tema.

---

## Ventana de duplicados de 15 segundos

**Decisión.** Bajó de 120 a 15 segundos.

**Por qué.** La idempotencia real la da el índice único sobre `external_message_id`, que es a prueba de reintentos de Telegram. Filtrar además por texto solo agrega daño.

**Evidencia.** Con 120 segundos, alguien que manda "Hola" tres veces porque no le contestan queda ignorado las tres. Repetir el mensaje garantizaba seguir siendo ignorado, que es lo peor que se le puede hacer a alguien que ya está esperando.

---

## Límite de 20 respuestas por hora, no 5

**Decisión.** Subió de 5 a 20. Pasarse sigue derivando a humano.

**Por qué.** El 5 venía del worker de WhatsApp, donde protegía del baneo de `whatsapp-web.js`, no del costo. Acá el riesgo es otro y el número no se revisó al portarlo.

**Evidencia.** Coordinar un pedido real lleva cantidad, dirección, horario y forma de pago: más de cinco intercambios sin esfuerzo. Con el límite viejo, un cliente comprando de verdad quedaba escalado a humano en la mitad de la compra, y el bot mudo desde ahí. Apareció probando: cinco mensajes de prueba agotaron la cuota y trabaron la conversación.

**Criterio.** El límite es una defensa contra bucles, no contra clientes activos. Tiene que dejar pasar una compra normal y frenar solo lo que claramente no lo es.

---

## El tono sale de conversaciones reales, no de intuición

**Decisión.** La guía de tono vive en `commercial_settings` (key `tone_guide`) y se genera con `scripts/bot-sync-tone.mjs`. El prompt la incorpora vía `buildSystemPrompt()`; sin ella, el bot cae en el prompt base.

**Evidencia.** Medido sobre 1104 respuestas del equipo en Instagram: mediana de **63 caracteres**, **0%** usa signos de apertura, **52%** arranca en minúscula, **25%** termina en pregunta, **0%** tutea, **1%** usa emojis. Los arranques más frecuentes son ofrecimientos ("te paso", "si queres", "te puedo"), no respuestas.

**Resultado.** Ante "cuanto esta la caja de 4kg?", el bot pasó de una respuesta de 155 caracteres con signos de apertura a "25 mil en efectivo o 30 mil por transferencia. te anoto una?" (60 caracteres).

**Qué no se copió.** El equipo abrevia "que" como "q" en el 8% de los mensajes; se dejó afuera a propósito, porque de una persona se lee natural y de un bot se lee descuidado.

---

## `claude -p` no va a producción

**Decisión.** El proveedor `claude-cli` es solo para desarrollo local. El módulo falla al construirse si detecta Vercel.

**Por qué.** Dos razones independientes. La de producto: **15,2 segundos por turno** medidos, contra 1-2 de la API, porque levanta un proceso nuevo en cada mensaje. La otra: usar una suscripción personal como backend que atiende clientes no es un uso contemplado.

---

## Operación: cosas que se apagan solas

**El token de Instagram dura 60 días.** Se generó el 8 de junio y venció el 6 de agosto, sin aviso: no hay error, simplemente dejan de entrar mensajes. Correr `scripts/instagram-refresh-token.mjs` cada 30 días. Candidato natural para el cron de la Fase 7.

**El worker de Instagram estaba caído antes de eso.** La ingesta se cortó el 13 de julio, casi un mes antes de que venciera el token. Son dos problemas distintos: renovar el token no devuelve la ingesta en vivo.

**El `id` de la cuenta no es el que usan los mensajes.** `/me` devuelve un id con scope de app; los mensajes identifican a la cuenta por `user_id` (el Instagram Business ID). Comparar contra el equivocado clasifica todas las respuestas del equipo como si fueran del cliente, y el síntoma es "no hay mensajes salientes" en vez de un error.

---

## Pendiente de decidir

**El tono de Cande todavía no es el de La Candelaria.** Hoy sale de una línea escrita a mano en `BOT_SYSTEM_PROMPT`. El plan es destilarlo de las respuestas reales del equipo en Instagram y guardarlo en `commercial_settings` con la key `tone_guide`, para editarlo sin deploy.

Los ejemplos que alimenten ese tono van **anonimizados** y **nunca a un archivo trackeado**: el repo es público y son conversaciones de clientes reales.

**Cuando el bot deriva, no le dice nada al cliente.** Avisa al equipo y se calla, pero del otro lado queda alguien hablando solo. Falta el mensaje de despedida.

**Baja confianza deriva a humano, y no debería.** Es el defecto que más veces se repitió durante las pruebas, con distintos disfraces: el bot trata "no entendí" como "esto necesita una persona". Un "Hola" suelto en medio de un pedido en curso llega al modelo sin contexto útil, vuelve con confianza baja y escala la conversación, dejando muda una compra que venía bien encaminada.

Lo correcto es que baja confianza pida una aclaración ("perdon, no te segui, me lo repetis?") y que solo derive si se repite. Requiere una acción nueva en el motor y un contador de aclaraciones seguidas.

**Solo se guarda la dirección; falta el resto del pedido.** Cantidad y forma de pago se pierden entre mensajes, así que el bot los vuelve a preguntar. La recolección estructurada existe solo para la dirección; extenderla al resto es parte de la Fase 5.

---

## Una corrección: el modelo no inventaba direcciones

Durante las pruebas quedó registrado acá que el modelo alucinaba domicilios: en una conversación apareció guardado `"Castex 3342"`, una calle que aparentemente nadie había mencionado. **Era falso.**

Esa calle la había escrito el usuario desde el teléfono. El poller de Telegram seguía corriendo e inyectaba mensajes reales en la **misma conversación** que estaba usando el simulador, así que había dos clientes escribiendo a la vez sobre un mismo hilo. Los resultados parecían aleatorios y no lo eran.

Queda anotado porque el error de diagnóstico costó más que el bug: se acusó al modelo de algo que no hizo y casi se rediseña la extracción por eso. **Antes de culpar al modelo, verificar que no haya dos fuentes escribiendo en la misma conversación.**

El simulador ahora usa su propio thread (`BOT_SIMULACION_THREAD`, por defecto `999000001`), separado del chat real. Los bugs que sí eran reales aparecieron recién cuando las corridas se volvieron reproducibles: la consulta a Google iba sin la localidad, y las respuestas a las preguntas del bot no se interpretaban.

---

## Fase 5: cerrar el pedido

Hasta acá el bot tomaba el pedido entero y, cuando el cliente confirmaba, derivaba a una persona. La conversación llegaba al final bien y se cortaba en el último paso. Esto es lo que se decidió para cerrarla.

**El pedido se crea en `src/lib/bot/create-order.ts` y no llamando al endpoint interno.** El endpoint de WhatsApp exige un teléfono de 11 a 14 dígitos y Telegram no da teléfono; además fija `sales_channel: whatsapp_ai`. El módulo nuevo reusa exactamente las mismas piezas (`loadCatalog`, `buildOrderItems`, `calculateItemsCount`, `calculateOrderTotal`, `toStructuredAddressColumns`, `recordOrderActivity`) y copia su idempotencia, así que no hay dos formas de crear un pedido, hay una escrita dos veces contra las mismas funciones.

**El pedido se crea a precio de lista, como todos los canales.** `payment_method_expected: "unknown"` y los ítems valuados con `buildOrderItems(..., "unknown")`. El descuento por efectivo lo aplica el primer cobro (`prepareOrderForFirstPaymentMethod`), igual que en el formulario público y en WhatsApp. Cotizar distinto acá haría que dos pedidos idénticos tengan totales distintos según por dónde entraron. Lo que el cliente dijo sobre el pago va a `notes` ("dijo que paga en efectivo") para que el repartidor lo sepa.

**En el chat, en cambio, se cotiza según la forma de pago que eligió el cliente.** Si dijo efectivo, el resumen dice el precio en efectivo: es lo que va a pagar. El total del pedido en el panel es el de lista y el panel se encarga de la diferencia.

**El producto nunca sale del texto libre del modelo.** Hay dos cajas de paltas activas, la de 4kg a 30 mil y la chica a 25 mil. `resolveVariant` matchea contra el catálogo real: primero el label más específico ("caja de 4kg chica" gana sobre "caja de 4kg", que está contenido en él), después la palabra que distingue una variante de las otras ("la chica"), y si el cliente nombró solo la familia, la variante que el catálogo marca por defecto. El precio sale siempre del catálogo.

**El upsell se ofrece antes de crear el pedido, no después.** Así el producto sugerido entra como un ítem más en el mismo insert: los totales quedan bien y no hay que mutar un pedido ya creado. Es además el momento natural de la venta, que era el pedido original: sugerir al cerrar.

Las reglas viven en `commercial_settings` con la key `upsell_rules`, la misma tabla donde ya están el tono y el catálogo. No hizo falta ninguna migración y se cambian sin deploy. Si la key no está, `UPSELL_DEFAULT` en `src/lib/bot/upsell.ts` sugiere frutos secos. Se ofrece una sola vez por conversación.

**El teléfono se pide pero no bloquea.** `customers.phone` es nullable y el reparto lo necesita, así que se pregunta como cualquier otro dato. Si el cliente no lo contesta, el corte de repeticiones lo saltea y el pedido se crea igual. Cantidad y dirección sí bloquean: un pedido sin ellas no se puede repartir, así que ahí deriva a una persona.

---

## Tres bugs que aparecieron al cablear todo esto

**La forma de pago no se guardaba nunca.** Se calculaba en cada mensaje pero solo se persistía en las ramas que además tocaban la dirección. Si el cliente decía "efectivo" cuando la dirección ya estaba cerrada, el dato se perdía. Ahora hay una sola escritura del draft y corre siempre.

**Borrar la última pregunta de dirección hacía volver la pregunta para siempre.** Cuando el bot pasaba a preguntar algo que no era la dirección, limpiaba `direccion.ultimaPregunta`. Parecía prolijo y era el bug: ese campo es lo que lleva la cuenta de repeticiones, y sin él el corte deja de aplicar. El síntoma era "es casa o departamento?" cinco veces seguidas, después de que el cliente ya había contestado.

Lo que decide cómo interpretar un mensaje es ahora `ultimaPregunta` a nivel del pedido, no la de la dirección. La de la dirección quedó solo como contador.

**Las opciones de Google se perdían solas.** El modelo devolvía el mismo domicilio con otra puntuación ("Av." por "Avenida"), el texto cambiaba, se volvía a consultar a Google y las tres opciones que el cliente estaba mirando desaparecían. Cada vuelta gastaba un intento hasta agotarlos. Ahora, con opciones en pantalla, un texto nuevo no reemplaza a la dirección: el cliente está eligiendo, no dictando.

---

## El CLI de Claude se cuelga y el turno se pierde entero

En una corrida de prueba, una llamada tardó 1008 segundos y el turno terminó sin respuesta. El cliente escribe y no le contesta nadie, que desde afuera se ve como que el bot lo dejó hablando solo. Peor: el mensaje siguiente se lee como respuesta a una pregunta que nunca se hizo, y la conversación entera se desfasa.

El timeout bajó a 45 segundos y ahora hay un reintento. Es una limitación del proveedor `claude-cli`, que existe para prototipar con la suscripción; en producción va `anthropic-api`.

---

## Que el bot sepa cuánto hace que no hablan

El draft del pedido no tenía noción de tiempo. Se guardaba en `conversations.draft_order` y se levantaba igual fuera de hace dos minutos o de hace una semana, así que una charla que quedaba a medias se retomaba en seco: el cliente escribía tres días después y Cande le contestaba "que piso y depto?".

Antes de definir umbrales, la pregunta fue qué hace una persona. Un vendedor que atiende por WhatsApp hace tres cosas distintas, y ninguna es "seguir como si nada" ni "hacerse el amnésico".

**Hace un rato:** sigue la frase donde la dejó. Si te preguntó el piso y volvés a los diez minutos con "4B", te dice "listo". Preguntarte si querés retomar sería raro.

**Hace unas horas:** retoma diciendo en voz alta dónde quedaron, y en la misma frase avanza. *"hola Pepe! te decia, quedamos en 2 cajas para Castex 3342. seguimos con eso?"*

**Ayer o antes:** se acuerda, pero no da nada por hecho. El pedido viejo deja de ser un pedido en curso y pasa a ser una sugerencia. *"hola Pepe! la ultima vez estabas por llevar 2 cajas. arrancamos con eso?"*

**Nunca olvida quién sos.** El nombre y el teléfono no se preguntan de nuevo.

De ahí salen las dos reglas del código:

1. **Nunca actuar como si no hubiera pasado tiempo.** Si hubo un hueco, se nombra.
2. **Un dato viejo se ofrece, no se asume.** Primero es estado, después es sugerencia, y nunca se convierte en un campo prellenado en silencio.

**No es un menú.** La primera versión preguntaba "seguimos con eso o arrancamos de nuevo?", que es un formulario. Un vendedor no te ofrece dos opciones: retoma y avanza. Si el cliente quería otra cosa, lo dice solo, y `parseRetomar` lo entiende.

**El pedido viejo no se borra en silencio.** Nadie se olvida de un pedido de ayer. Lo que no hace una persona es darlo por hecho. Por eso a las 24h el draft no se elimina: sale del pedido en curso y se ofrece, **solo si el cliente no dijo ya lo que quiere**. Si vuelve con "necesito 3 cajas", nadie le contesta hablando de anteayer: eso lo decide `trajoAlgoConcreto()`.

**Una oferta que no se acepta es una oferta rechazada.** Si le ofrecimos el pedido de ayer y contesta cualquier otra cosa, ese pedido no queda flotando esperando pegarse al siguiente. Con un pedido de hace horas es al revés: sobrevive a una respuesta ambigua, porque todavía es el pedido en curso. Esa diferencia es lo único que guarda `retomarDesde`.

### Los umbrales, que son consecuencia y no diseño

| Hueco | El draft es | Qué hace |
|---|---|---|
| menos de 3h | estado activo | Sigue donde estaba. |
| 3h a 24h | estado, pero se nombra | Retoma y avanza en una frase. |
| más de 24h | sugerencia | Se ofrece, no se asume. |

**Se miden horas transcurridas, no días de calendario.** Entre las 23:00 y la 01:00 pasaron dos horas, no "un día". Con el corte por fecha, dos horas de diferencia se tratarían como si hubiera pasado una semana.

**Al reiniciar nunca se pierde el contacto.** La dirección depende de por qué se reinició: si el cliente pide arrancar de nuevo en la misma charla se conserva (la dio hace minutos), y si pasaron más de 24h no, porque dar por sentado a dónde va un pedido de ayer es asumir de más.

**Un draft sin `actualizadoEn` cuenta como viejo.** Los que ya estaban guardados se curan solos en el primer mensaje, sin script de migración.

### Dos cosas más que salieron del mismo problema

**`hasOrderInProgress()` no miraba la fecha.** Bastaba con que `draft_order` no estuviera vacío, así que un "hola" sobre un pedido de la semana pasada salteaba el saludo y se iba derecho al modelo. Ahora un draft que ya es sugerencia no cuenta como pedido en curso.

**El saludo no usaba el nombre.** Es la regla que más separa al equipo de un bot, medida sobre 1104 respuestas reales, y el saludo es la única respuesta que sale sin pasar por el modelo: si no la aplicaba ahí, no la aplicaba en ningún lado. Un cliente que vuelve a los tres días recibía "Hola! Soy Cande, de Paltas La Candelaria", como un desconocido.

### Cómo se prueba

`scripts/bot-envejecer-draft.mjs <horas>` retrasa el `actualizadoEn` del draft. Sin eso habría que esperar tres horas de verdad, o mover el reloj de la máquina.

---

## El tono es informal, la ortografía no

Cande escribía todo en minúscula y sin acentos: "me pasas la direccion de entrega?", "cuantas cajas queres?". Las dos cosas venían de lugares distintos y solo una estaba bien.

**Las minúsculas eran una regla medida.** El 52% de las respuestas reales del equipo arrancan en minúscula, así que la guía de tono decía "podés arrancar en minúscula, no fuerces la mayúscula inicial". Se midió bien, pero replicarlo no era necesario: es una marca de quien tipea rápido en el celular, no algo que el cliente valore.

**La falta de acentos era un error mío, no una medición.** La convención del repo de escribir sin tildes es para **el código**: identificadores y comentarios en `.ts`. Se coló en los textos que lee el cliente, donde no aplica. "Direccion" en un mensaje no se lee informal, se lee descuidado.

Ahora se escribe con acentos y con mayúscula al empezar cada oración. Todo lo demás del tono medido queda igual: corto (mediana de 63 caracteres), voseo, saludo por el nombre, precios en palabras, sin emojis, una pregunta por vez.

**Los signos de apertura siguen sin usarse, y es la única licencia.** Cero de 1104 respuestas del equipo usan `¿` o `¡`. Se escribe "Cuántas querés?", nunca "¿Cuántas querés?". En un chat el signo de apertura lee formal, no correcto.

### Dónde vive esto

En dos lugares, y hay que tocar los dos:

- **Los textos fijos**, los que salen sin pasar por el modelo: `buildAddressQuestion` y `buildOrderQuestion`, `resumenPedido`, `mensajeParaRetomar`, `avisoDePedidoCreado`, `CANNED_REPLIES` y los mensajes de `engine.ts`.
- **La guía de tono**, en `commercial_settings` con la key `tone_guide`, que es lo que gobierna todo lo que redacta el modelo.

De los dos, la guía pesa más, y adentro de la guía pesan más **los ejemplos que las reglas**: el modelo copia su largo, su registro y su ortografía. Tener seis ejemplos escritos sin acentos y en minúscula empujaba a escribir mal aunque la regla dijera lo contrario. Los ejemplos se reescribieron con la ortografía que se quiere ver.
