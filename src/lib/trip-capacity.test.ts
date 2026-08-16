import { describe, expect, it } from "vitest";
import {
  describeRouteImprovement,
  formatDistanceMeters,
  formatDurationSeconds
} from "@/lib/trip-capacity";

describe("formatDistanceMeters", () => {
  it("uses metres below a kilometre", () => {
    expect(formatDistanceMeters(999)).toBe("999 m");
  });

  it("uses kilometres with one decimal above a kilometre", () => {
    expect(formatDistanceMeters(1500)).toBe("1,5 km");
    expect(formatDistanceMeters(42000)).toBe("42 km");
  });

  it("falls back when there is no route yet", () => {
    expect(formatDistanceMeters(0)).toBe("-");
  });
});

describe("formatDurationSeconds", () => {
  it("uses minutes below an hour", () => {
    expect(formatDurationSeconds(300)).toBe("5 min");
  });

  it("uses hours and minutes above an hour", () => {
    expect(formatDurationSeconds(3600)).toBe("1 h");
    expect(formatDurationSeconds(4800)).toBe("1 h 20 min");
  });

  it("falls back when there is no route yet", () => {
    expect(formatDurationSeconds(0)).toBe("-");
  });
});

describe("describeRouteImprovement", () => {
  it("reports the saving when the proposal is shorter", () => {
    const result = describeRouteImprovement(
      { distanceMeters: 42000, durationSeconds: 4800 },
      { distanceMeters: 38000, durationSeconds: 3900 }
    );

    expect(result.improves).toBe(true);
    expect(result.headline).toBe("Ahorrás 4 km y 15 min");
  });

  it("reports a saving in distance only", () => {
    const result = describeRouteImprovement(
      { distanceMeters: 42000, durationSeconds: 3600 },
      { distanceMeters: 38000, durationSeconds: 3600 }
    );

    expect(result.improves).toBe(true);
    expect(result.headline).toBe("Ahorrás 4 km");
  });

  it("reports a saving in time only", () => {
    const result = describeRouteImprovement(
      { distanceMeters: 42000, durationSeconds: 4800 },
      { distanceMeters: 42000, durationSeconds: 3900 }
    );

    expect(result.improves).toBe(true);
    expect(result.headline).toBe("Ahorrás 15 min");
  });

  it("says so when the current order is already the best", () => {
    const result = describeRouteImprovement(
      { distanceMeters: 42000, durationSeconds: 4800 },
      { distanceMeters: 42000, durationSeconds: 4800 }
    );

    expect(result.improves).toBe(false);
    expect(result.headline).toBe("El orden actual ya es el mejor");
  });

  it("does not call a worse proposal an improvement", () => {
    const result = describeRouteImprovement(
      { distanceMeters: 38000, durationSeconds: 3900 },
      { distanceMeters: 42000, durationSeconds: 4800 }
    );

    expect(result.improves).toBe(false);
    expect(result.headline).toBe("El orden actual ya es el mejor");
  });

  it("ignores differences too small to matter", () => {
    const result = describeRouteImprovement(
      { distanceMeters: 42000, durationSeconds: 4800 },
      { distanceMeters: 41950, durationSeconds: 4790 }
    );

    expect(result.improves).toBe(false);
  });

  it("survives not having a current route yet", () => {
    const result = describeRouteImprovement(null, {
      distanceMeters: 38000,
      durationSeconds: 3900
    });

    expect(result.improves).toBe(true);
    expect(result.headline).toBe("Ruta propuesta");
  });
});
