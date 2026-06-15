"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DeliveryPlanningStop } from "@/lib/delivery-planning";
import type { DeliveryRoutePreview } from "@/lib/delivery-routing";
import type { LogisticsDepot } from "@/lib/logistics-depots";
import { DEFAULT_LOGISTICS_DEPOT_FALLBACK, formatLogisticsDepotAddress } from "@/lib/logistics-depots";
import { decodeGooglePolyline, getPolylineBounds, type PolylinePoint } from "@/lib/polyline";

type GoogleMapsWindow = Window & {
  google?: {
    maps?: {
      LatLngBounds: new () => {
        extend: (point: { lat: number; lng: number }) => void;
      };
      Map: new (
        element: HTMLElement,
        options: {
          center: { lat: number; lng: number };
          disableDefaultUI?: boolean;
          gestureHandling?: string;
          mapTypeControl?: boolean;
          streetViewControl?: boolean;
          styles?: Array<Record<string, unknown>>;
          zoom: number;
          zoomControl?: boolean;
        }
      ) => {
        fitBounds: (bounds: { extend: (point: { lat: number; lng: number }) => void }, padding?: number) => void;
      };
      Marker: new (options: {
        label?: { color: string; fontSize: string; fontWeight: string; text: string };
        map: unknown;
        position: { lat: number; lng: number };
        title?: string;
      }) => unknown;
      Polyline: new (options: {
        geodesic?: boolean;
        map: unknown;
        path: Array<{ lat: number; lng: number }>;
        strokeColor: string;
        strokeOpacity: number;
        strokeWeight: number;
      }) => unknown;
    };
  };
};

type TripRouteMapProps = {
  depot?: LogisticsDepot | null;
  route: DeliveryRoutePreview | null;
  stops: DeliveryPlanningStop[];
};

const MAP_STYLE: Array<Record<string, unknown>> = [
  { elementType: "geometry", stylers: [{ color: "#111315" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#cfc8c1" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#111315" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#34302d" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#25211f" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1720" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] }
];

function formatDistance(distanceMeters: number) {
  if (!distanceMeters) {
    return "Sin distancia";
  }

  return distanceMeters >= 1000
    ? `${(distanceMeters / 1000).toFixed(1).replace(".", ",")} km`
    : `${Math.round(distanceMeters)} m`;
}

function formatDuration(seconds: number) {
  if (!seconds) {
    return "Sin ETA";
  }

  const roundedMinutes = Math.round(seconds / 60);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (!hours) {
    return `${minutes} min`;
  }

  return `${hours} h ${minutes.toString().padStart(2, "0")} min`;
}

function projectPoint(
  point: PolylinePoint,
  bounds: ReturnType<typeof getPolylineBounds>,
  width: number,
  height: number,
  padding: number
) {
  if (!bounds) {
    return { x: width / 2, y: height / 2 };
  }

  const lngSpan = Math.max(bounds.east - bounds.west, 0.001);
  const latSpan = Math.max(bounds.north - bounds.south, 0.001);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const x = padding + ((point.lng - bounds.west) / lngSpan) * usableWidth;
  const y = padding + ((bounds.north - point.lat) / latSpan) * usableHeight;

  return { x, y };
}

function getGoogleMapsBrowserKey() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ??
    process.env.NEXT_PUBLIC_GOOGLE_BROWSER_MAPS_API_KEY?.trim() ??
    ""
  );
}

function ensureGoogleMapsScript(apiKey: string) {
  return new Promise<void>((resolve, reject) => {
    const mapsWindow = window as GoogleMapsWindow;

    if (mapsWindow.google?.maps) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-maps="trip-route-map"]');

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("No se pudo cargar Google Maps.")), {
        once: true
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&language=es&region=AR`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "trip-route-map";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("No se pudo cargar Google Maps.")), {
      once: true
    });
    document.head.appendChild(script);
  });
}

export function TripRouteMap({ depot, route, stops }: TripRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const browserMapsKey = getGoogleMapsBrowserKey();
  const tripDepot = depot ?? DEFAULT_LOGISTICS_DEPOT_FALLBACK;
  const orderedStops = useMemo(() => {
    const stopById = new Map(stops.map((stop) => [stop.orderId, stop]));
    return (route?.orderedStopIds ?? stops.map((stop) => stop.orderId))
      .map((stopId) => stopById.get(stopId))
      .filter((stop): stop is DeliveryPlanningStop => Boolean(stop));
  }, [route?.orderedStopIds, stops]);
  const points = useMemo(() => {
    return route?.encodedPolyline ? decodeGooglePolyline(route.encodedPolyline) : [];
  }, [route?.encodedPolyline]);
  const bounds = useMemo(() => {
    const stopPoints = Object.values(route?.stopLocations ?? {}).map((point) => ({
      lat: point.lat,
      lng: point.lng
    }));

    return getPolylineBounds([...points, ...stopPoints]);
  }, [points, route?.stopLocations]);
  const fallbackPath = useMemo(() => {
    if (!points.length) {
      return "";
    }

    return points
      .map((point, index) => {
        const projected = projectPoint(point, bounds, 920, 440, 32);
        return `${index === 0 ? "M" : "L"}${projected.x} ${projected.y}`;
      })
      .join(" ");
  }, [bounds, points]);

  useEffect(() => {
    if (!route || !mapContainerRef.current || !route.encodedPolyline || !points.length) {
      return;
    }

    if (!browserMapsKey) {
      setMapsError("Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para mostrar el mapa real de Google Maps.");
      return;
    }

    let isCancelled = false;

    void ensureGoogleMapsScript(browserMapsKey)
      .then(() => {
        if (isCancelled || !mapContainerRef.current) {
          return;
        }

        const mapsWindow = window as GoogleMapsWindow;
        const maps = mapsWindow.google?.maps;

        if (!maps) {
          setMapsError("Google Maps no quedó disponible en el navegador.");
          return;
        }

        setMapsError(null);
        mapContainerRef.current.innerHTML = "";

        const firstPoint = points[0];
        const map = new maps.Map(mapContainerRef.current, {
          center: firstPoint ? { lat: firstPoint.lat, lng: firstPoint.lng } : { lat: -34.6037, lng: -58.3816 },
          disableDefaultUI: true,
          gestureHandling: "greedy",
          mapTypeControl: false,
          streetViewControl: false,
          styles: MAP_STYLE,
          zoom: 13,
          zoomControl: true
        });

        new maps.Polyline({
          geodesic: true,
          map,
          path: points.map((point) => ({ lat: point.lat, lng: point.lng })),
          strokeColor: "#38bdf8",
          strokeOpacity: 0.95,
          strokeWeight: 5
        });

        orderedStops.forEach((stop, index) => {
          const location = route.stopLocations[stop.orderId];
          if (!location) {
            return;
          }

          new maps.Marker({
            label: {
              color: "#f5f5f4",
              fontSize: "12px",
              fontWeight: "700",
              text: String(index + 1)
            },
            map,
            position: location,
            title: stop.customerName
          });
        });

        const mapBounds = new maps.LatLngBounds();
        points.forEach((point) => mapBounds.extend({ lat: point.lat, lng: point.lng }));
        orderedStops.forEach((stop) => {
          const location = route.stopLocations[stop.orderId];
          if (location) {
            mapBounds.extend(location);
          }
        });

        map.fitBounds(mapBounds, 48);
      })
      .catch((error) => {
        if (!isCancelled) {
          setMapsError(error instanceof Error ? error.message : "No se pudo inicializar Google Maps.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [browserMapsKey, orderedStops, points, route]);

  if (!route) {
    return (
      <div className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5 text-sm text-stone-400">
        No hay vista de recorrido disponible.
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-lg font-semibold text-stone-50">Mapa del recorrido</p>
          <p className="mt-1 text-sm text-stone-400">
            {formatDistance(route.totalDistanceMeters)} · {formatDuration(route.totalDurationSeconds)}
          </p>
        </div>
        <span className="rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs text-stone-300">
          {route.optimizer === "route_optimization"
            ? "Optimization API"
            : route.optimizer === "routes" || route.optimizer === "routes_fallback"
              ? "Routes API"
              : route.optimizer === "manual"
                ? "Orden manual"
                : "Sin integración"}
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl border border-stone-800 bg-[#111315]">
        {route.encodedPolyline && points.length && !mapsError ? (
          <div ref={mapContainerRef} className="h-[320px] w-full" />
        ) : null}
        {!route.encodedPolyline || !points.length ? (
          <div className="flex h-[320px] items-center justify-center px-6 text-center text-sm text-stone-400">
            No se pudo calcular una ruta de Google Maps para renderizar el mapa.
          </div>
        ) : null}
        {mapsError && route.encodedPolyline && points.length ? (
          <div className="relative">
            <svg viewBox="0 0 920 440" className="h-[320px] w-full border-t border-stone-800">
              <defs>
                <pattern id="route-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="920" height="440" fill="url(#route-grid)" />
              {fallbackPath ? (
                <path
                  d={fallbackPath}
                  fill="none"
                  stroke="#38bdf8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="6"
                />
              ) : null}
              {orderedStops.map((stop, index) => {
                const location = route.stopLocations[stop.orderId];

                if (!location) {
                  return null;
                }

                const projected = projectPoint(location, bounds, 920, 440, 32);

                return (
                  <g key={stop.orderId}>
                    <circle
                      cx={projected.x}
                      cy={projected.y}
                      r="16"
                      fill="#0f172a"
                      stroke="#f5f5f4"
                      strokeWidth="2"
                    />
                    <text
                      x={projected.x}
                      y={projected.y + 5}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="700"
                      fill="#f5f5f4"
                    >
                      {index + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="border-t border-stone-800 bg-stone-950/80 px-4 py-3 text-sm text-amber-200">
              {mapsError}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-stone-800 bg-stone-950/60 px-4 py-3 text-sm text-stone-300">
        Origen y destino fijos: {tripDepot.label} · {formatLogisticsDepotAddress(tripDepot)}
      </div>
      {!browserMapsKey ? (
        <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Para ver Google Maps real en el planner, configura `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` y reinicia la app.
        </div>
      ) : null}

      {route.warnings.length ? (
        <div className="mt-4 grid gap-2">
          {route.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
            >
              {warning}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
