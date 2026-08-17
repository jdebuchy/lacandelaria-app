import { describe, expect, it } from "vitest";
import { esComandoDeReinicio, isGreetingOnly, pidioArrancarDeNuevo } from "./text";

describe("pidioArrancarDeNuevo", () => {
  it("entiende el pedido de reinicio en medio de la charla", () => {
    expect(pidioArrancarDeNuevo("arranquemos de nuevo")).toBe(true);
    expect(pidioArrancarDeNuevo("mejor empecemos de cero")).toBe(true);
    expect(pidioArrancarDeNuevo("olvidate del pedido")).toBe(true);
    expect(pidioArrancarDeNuevo("cancela el pedido por favor")).toBe(true);
  });

  // El riesgo de esto es borrar un pedido por error, asi que la lista es corta y
  // literal: un "no" contestando "es casa o departamento?" no puede vaciar nada.
  it("no confunde una respuesta cualquiera con un reinicio", () => {
    expect(pidioArrancarDeNuevo("no")).toBe(false);
    expect(pidioArrancarDeNuevo("departamento")).toBe(false);
    expect(pidioArrancarDeNuevo("2 cajas nuevas")).toBe(false);
    expect(pidioArrancarDeNuevo("dale")).toBe(false);
    expect(pidioArrancarDeNuevo("")).toBe(false);
  });
});

describe("esComandoDeReinicio", () => {
  it("reconoce el comando de prueba", () => {
    expect(esComandoDeReinicio("/reset")).toBe(true);
    expect(esComandoDeReinicio("  /nuevo  ")).toBe(true);
  });

  it("no lo confunde con un mensaje normal", () => {
    expect(esComandoDeReinicio("reset")).toBe(false);
    expect(esComandoDeReinicio("/reset el pedido")).toBe(false);
    expect(esComandoDeReinicio("quiero 2 cajas")).toBe(false);
  });
});

describe("isGreetingOnly", () => {
  it("reconoce un saludo pelado", () => {
    expect(isGreetingOnly("hola")).toBe(true);
    expect(isGreetingOnly("buenas tardes")).toBe(true);
  });

  it("un saludo con algo mas no es un saludo pelado", () => {
    expect(isGreetingOnly("hola, quiero 2 cajas")).toBe(false);
    expect(isGreetingOnly("")).toBe(false);
  });
});
