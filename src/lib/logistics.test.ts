import { describe, expect, it } from "vitest";
import {
  getLogisticsFlowGuidance,
  getLogisticsFlowLabel,
  getLogisticsFlowTone,
  inferLogisticsFlow,
  isActiveLogisticsStatus
} from "@/lib/logistics";

describe("logistics", () => {
  it("infers reseller logistics flow before address-based flows", () => {
    expect(inferLogisticsFlow({ salesChannel: "reseller", locality: "CABA" })).toBe("reseller");
    expect(inferLogisticsFlow({ resellerId: "reseller-1", deliveryArea: "capital_federal" })).toBe("reseller");
  });

  it("infers Capital Federal logistics flow from delivery area or address", () => {
    expect(inferLogisticsFlow({ deliveryArea: "capital_federal" })).toBe("capital_federal");
    expect(inferLogisticsFlow({ locality: "Ciudad Autónoma de Buenos Aires" })).toBe("capital_federal");
    expect(inferLogisticsFlow({ administrativeAreaLevel1: "CABA" })).toBe("capital_federal");
  });

  it("falls back to standard logistics flow", () => {
    expect(inferLogisticsFlow({ locality: "La Plata", administrativeAreaLevel1: "Buenos Aires" })).toBe("standard");
  });

  it("returns labels, guidance and tones for each flow", () => {
    expect(getLogisticsFlowLabel("capital_federal")).toBe("Capital Federal");
    expect(getLogisticsFlowLabel("reseller")).toBe("Revendedora");
    expect(getLogisticsFlowLabel("standard")).toBe("Ruta estandar");

    expect(getLogisticsFlowGuidance("capital_federal")).toContain("ventana corta");
    expect(getLogisticsFlowGuidance("reseller")).toContain("Consolidar cajas");
    expect(getLogisticsFlowGuidance("standard")).toContain("Despacho directo");

    expect(getLogisticsFlowTone("capital_federal")).toBe("amber");
    expect(getLogisticsFlowTone("reseller")).toBe("sky");
    expect(getLogisticsFlowTone("standard")).toBe("emerald");
  });

  it("marks delivered and cancelled orders as inactive for logistics", () => {
    expect(isActiveLogisticsStatus("pending_confirmation")).toBe(true);
    expect(isActiveLogisticsStatus("confirmed")).toBe(true);
    expect(isActiveLogisticsStatus("assigned")).toBe(true);
    expect(isActiveLogisticsStatus("in_route")).toBe(true);
    expect(isActiveLogisticsStatus("delivered")).toBe(false);
    expect(isActiveLogisticsStatus("cancelled")).toBe(false);
  });
});
