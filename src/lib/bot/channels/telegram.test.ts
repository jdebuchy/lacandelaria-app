import { describe, expect, it } from "vitest";
import { parseTelegramUpdate } from "./telegram";

const UPDATE = {
  update_id: 900,
  message: {
    message_id: 42,
    chat: { id: 123456, type: "private" },
    from: { id: 123456, is_bot: false, first_name: "Jose" },
    date: 1786000000,
    text: "cuanto sale el cajon?"
  }
};

describe("parseTelegramUpdate", () => {
  it("extrae el mensaje en el formato del motor", () => {
    expect(parseTelegramUpdate(UPDATE)).toEqual({
      channel: "telegram",
      threadId: "123456",
      text: "cuanto sale el cajon?",
      externalMessageId: "42",
      senderName: "Jose",
      raw: UPDATE
    });
  });

  it("arma el nombre con apellido cuando viene", () => {
    const conApellido = {
      ...UPDATE,
      message: { ...UPDATE.message, from: { ...UPDATE.message.from, last_name: "Debuchy" } }
    };
    expect(parseTelegramUpdate(conApellido)?.senderName).toBe("Jose Debuchy");
  });

  it("deja el nombre en null si el mensaje no trae remitente", () => {
    const sinFrom = { ...UPDATE, message: { ...UPDATE.message, from: undefined } };
    expect(parseTelegramUpdate(sinFrom)?.senderName).toBeNull();
  });

  // El chat id es numerico y en grupos es negativo: siempre a string.
  it("normaliza el chat id a string", () => {
    const grupo = { ...UPDATE, message: { ...UPDATE.message, chat: { id: -1001, type: "group" } } };
    expect(parseTelegramUpdate(grupo)?.threadId).toBe("-1001");
  });

  it("descarta los updates que no traen texto", () => {
    expect(parseTelegramUpdate({ update_id: 1 })).toBeNull();
    expect(parseTelegramUpdate({ update_id: 1, message: { message_id: 2, chat: { id: 1 } } })).toBeNull();
  });

  // Los editados no son parte del flujo de pedido: procesarlos duplicaria turnos.
  it("descarta los mensajes editados", () => {
    expect(parseTelegramUpdate({ update_id: 1, edited_message: { text: "x" } })).toBeNull();
  });

  it("descarta un texto en blanco", () => {
    const enBlanco = { ...UPDATE, message: { ...UPDATE.message, text: "   " } };
    expect(parseTelegramUpdate(enBlanco)).toBeNull();
  });

  it("descarta lo que no es un objeto", () => {
    expect(parseTelegramUpdate(null)).toBeNull();
    expect(parseTelegramUpdate("hola")).toBeNull();
  });
});
