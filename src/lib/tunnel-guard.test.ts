import { describe, expect, it } from "vitest";
import { isAllowedThroughTunnel, isTunneled, shouldBlockTunneledRequest } from "./tunnel-guard";

function headers(valores: Record<string, string>) {
  return new Headers(valores);
}

describe("isTunneled", () => {
  it("reconoce una request que paso por Cloudflare", () => {
    expect(isTunneled(headers({ "cf-ray": "8a1b2c3d4e5f" }))).toBe(true);
    expect(isTunneled(headers({ "cf-connecting-ip": "190.1.2.3" }))).toBe(true);
  });

  // El caso que motiva mirar el host: segun como se levante el tunel, cloudflared
  // puede reescribir el Host y no queda mas rastro que el dominio.
  it("reconoce el dominio del tunel", () => {
    expect(isTunneled(headers({ host: "containers-del-peter.trycloudflare.com" }))).toBe(true);
    expect(isTunneled(headers({ host: "algo.ngrok-free.dev" }))).toBe(true);
    expect(isTunneled(headers({ "x-forwarded-host": "algo.trycloudflare.com" }))).toBe(true);
  });

  it("no confunde una request local", () => {
    expect(isTunneled(headers({ host: "localhost:3000" }))).toBe(false);
    expect(isTunneled(headers({ host: "127.0.0.1:3000" }))).toBe(false);
    // Un proxy local pone x-forwarded-host sin que haya ningun tunel.
    expect(isTunneled(headers({ "x-forwarded-host": "localhost:3000" }))).toBe(false);
  });

  it("no se deja enganar por un dominio parecido", () => {
    expect(isTunneled(headers({ host: "trycloudflare.com.atacante.io" }))).toBe(false);
  });
});

describe("isAllowedThroughTunnel", () => {
  it("deja pasar solo lo que el bot necesita", () => {
    expect(isAllowedThroughTunnel("/api/bot/telegram")).toBe(true);
    expect(isAllowedThroughTunnel("/api/health")).toBe(true);
  });

  it("bloquea el panel y el resto de las apis", () => {
    expect(isAllowedThroughTunnel("/panel")).toBe(false);
    expect(isAllowedThroughTunnel("/panel/crm/whatsapp")).toBe(false);
    expect(isAllowedThroughTunnel("/login")).toBe(false);
    expect(isAllowedThroughTunnel("/api/panel/orders")).toBe(false);
    expect(isAllowedThroughTunnel("/api/internal/whatsapp/orders")).toBe(false);
    expect(isAllowedThroughTunnel("/")).toBe(false);
  });

  // Sin esto, /api/bot/telegram/../panel o /API/HEALTH podrian colarse.
  it("no acepta variantes del path permitido", () => {
    expect(isAllowedThroughTunnel("/api/bot/telegram/")).toBe(false);
    expect(isAllowedThroughTunnel("/API/health")).toBe(false);
  });
});

describe("shouldBlockTunneledRequest", () => {
  it("bloquea el panel cuando entra por el tunel", () => {
    expect(shouldBlockTunneledRequest(headers({ "cf-ray": "x" }), "/panel", "development")).toBe(true);
  });

  it("deja pasar el webhook", () => {
    expect(shouldBlockTunneledRequest(headers({ "cf-ray": "x" }), "/api/bot/telegram", "development")).toBe(
      false
    );
  });

  it("no toca las requests locales", () => {
    expect(shouldBlockTunneledRequest(headers({ host: "localhost:3000" }), "/panel", "development")).toBe(
      false
    );
  });

  // El candado protege el servidor de desarrollo. Un deploy detras de Cloudflare
  // no se puede apagar solo por tener cf-ray.
  it("queda inerte en produccion", () => {
    expect(shouldBlockTunneledRequest(headers({ "cf-ray": "x" }), "/panel", "production")).toBe(false);
  });
});
