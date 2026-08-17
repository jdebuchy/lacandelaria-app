// Formas del mensaje, sin nada de dominio. Vive aparte porque lo necesitan el
// gate y la recoleccion del pedido, y que cada uno tuviera su copia de esto ya
// habia dejado dos versiones de la misma normalizacion.

export function normalizar(texto: string) {
  // Los combining marks van escapados: escritos literales, un editor o un
  // copy-paste los reordena y el regex deja de matchear sin que nadie lo note.
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Un saludo pelado no le da al modelo con que trabajar: devuelve baja confianza
// y eso derivaba la conversacion a humano en el primer mensaje. Como casi toda
// conversacion real arranca con "hola", lo contestamos nosotros y esperamos.
const GREETINGS = new Set([
  "hola", "holaa", "holaaa", "buenas", "buen", "buenos", "dia", "dias", "tarde",
  "tardes", "noche", "noches", "hey", "ey", "que", "tal", "como", "estas", "andas",
  "saludos", "hi", "hello", "ola", "holis", "buenass"
]);

export function palabrasDe(texto: string) {
  return normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean);
}

export function isGreetingOnly(text: string) {
  const words = palabrasDe(text);

  return words.length > 0 && words.length <= 4 && words.every((word) => GREETINGS.has(word));
}

// Pedidos de reinicio explicitos. Se chequean en cualquier mensaje, no solo como
// respuesta a una pregunta, porque un cliente que dice "arranquemos de nuevo" en
// medio de un pedido esta pidiendo justo eso.
//
// La lista es corta y literal a proposito: un "no" suelto contestando "es casa o
// departamento?" no puede borrar el pedido.
const REINICIO =
  /\b(de cero|desde cero|de nuevo|nuevamente|otra vez|empecemos de|empezar de|arranquemos de|arrancar de|arrancamos de|volvamos a empezar|borra todo|borralo todo|olvidate de todo|olvidate del pedido|cancela el pedido|cancelar el pedido|reset|reiniciar)\b/;

export function pidioArrancarDeNuevo(texto: string) {
  return REINICIO.test(normalizar(texto.trim()));
}

// Comando para dejar la conversacion como recien nacida. Es para probar desde el
// telefono sin tener que ir a la terminal ni esperar las horas que necesita el
// envejecimiento del draft. Solo corre en los chats de prueba.
const COMANDOS_DE_REINICIO = new Set(["/reset", "/reiniciar", "/nuevo", "/empezar"]);

export function esComandoDeReinicio(texto: string) {
  return COMANDOS_DE_REINICIO.has(normalizar(texto.trim()));
}
