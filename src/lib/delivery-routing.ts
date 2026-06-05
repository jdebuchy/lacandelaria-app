import "server-only";

import { createSign } from "node:crypto";
import type { DeliveryPlanningStop } from "@/lib/delivery-planning";
import { DEFAULT_LOGISTICS_DEPOT } from "@/lib/logistics-depots";

export type DeliveryRoutingStop = Pick<
  DeliveryPlanningStop,
  | "addressLine1"
  | "administrativeAreaLevel1"
  | "deliveryWindowEnd"
  | "deliveryWindowStart"
  | "googlePlaceId"
  | "locality"
  | "orderId"
  | "sequenceNumber"
>;

type Waypoint = {
  address?: string;
  placeId?: string;
};

type RouteLocation = {
  latLng?: {
    latitude: number;
    longitude: number;
  };
};

type ComputeRoutesLeg = {
  distanceMeters?: number;
  duration?: string;
  endLocation?: RouteLocation;
  startLocation?: RouteLocation;
};

type ComputeRoutesRoute = {
  distanceMeters?: number;
  duration?: string;
  legs?: ComputeRoutesLeg[];
  optimizedIntermediateWaypointIndex?: number[];
  polyline?: {
    encodedPolyline?: string;
  };
};

type ComputeRoutesResponse = {
  routes?: ComputeRoutesRoute[];
};

type OptimizeToursVisit = {
  shipmentIndex: number;
};

type OptimizeToursResponse = {
  metrics?: {
    aggregatedRouteMetrics?: {
      performedShipmentCount?: number;
      travelDistanceMeters?: string;
      visitDuration?: string;
    };
  };
  routes?: Array<{
    visits?: OptimizeToursVisit[];
  }>;
};

export type DeliveryRoutePreview = {
  encodedPolyline: string | null;
  optimizer: "manual" | "route_optimization" | "routes" | "routes_fallback" | "unavailable";
  orderedStopIds: string[];
  stopLocations: Record<string, { lat: number; lng: number }>;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  warnings: string[];
};

function getRoutesApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY ?? "";
}

function getDepotWaypoint() {
  const placeId = process.env.LOGISTICS_DEPOT_PLACE_ID?.trim();
  const address = process.env.LOGISTICS_DEPOT_ADDRESS?.trim();

  if (placeId) {
    return { placeId } satisfies Waypoint;
  }

  if (address) {
    return { address } satisfies Waypoint;
  }

  return { address: DEFAULT_LOGISTICS_DEPOT.address } satisfies Waypoint;
}

function getOptimizationCredentials() {
  const projectId = process.env.GOOGLE_ROUTE_OPTIMIZATION_PROJECT_ID?.trim();
  const clientEmail = process.env.GOOGLE_ROUTE_OPTIMIZATION_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_ROUTE_OPTIMIZATION_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    clientEmail,
    privateKey,
    projectId
  };
}

function base64UrlEncode(input: string) {
  return Buffer.from(input).toString("base64url");
}

async function getServiceAccountAccessToken() {
  const credentials = getOptimizationCredentials();

  if (!credentials) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
      iss: credentials.clientEmail,
      scope: "https://www.googleapis.com/auth/cloud-platform"
    })
  );
  const unsignedToken = `${header}.${claimSet}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(credentials.privateKey, "base64url");
  const assertion = `${unsignedToken}.${signature}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer"
    }),
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("No se pudo autenticar Route Optimization API.");
  }

  const payload = (await response.json()) as { access_token?: string };
  return payload.access_token ?? null;
}

function durationToSeconds(duration?: string) {
  if (!duration) {
    return 0;
  }

  const value = duration.endsWith("s") ? duration.slice(0, -1) : duration;
  return Number.parseFloat(value) || 0;
}

function stopToWaypoint(stop: DeliveryRoutingStop): Waypoint {
  if (stop.googlePlaceId) {
    return { placeId: stop.googlePlaceId };
  }

  const address = [stop.addressLine1, stop.locality, stop.administrativeAreaLevel1]
    .filter(Boolean)
    .join(", ");

  return { address };
}

function hasTimeWindows(stops: DeliveryRoutingStop[]) {
  return stops.some((stop) => stop.deliveryWindowStart || stop.deliveryWindowEnd);
}

function buildOrderedStops(stops: DeliveryRoutingStop[], orderedStopIds?: string[]) {
  const stopById = new Map(stops.map((stop) => [stop.orderId, stop]));
  const fallbackOrder = [...stops].sort((left, right) => left.sequenceNumber - right.sequenceNumber);

  if (!orderedStopIds?.length) {
    return fallbackOrder;
  }

  return orderedStopIds
    .map((stopId) => stopById.get(stopId))
    .filter((stop): stop is DeliveryRoutingStop => Boolean(stop));
}

async function callRoutesApi(
  orderedStops: DeliveryRoutingStop[],
  options: {
    optimizeWaypointOrder: boolean;
  }
) {
  const apiKey = getRoutesApiKey();

  if (!apiKey || orderedStops.length < 2) {
    return null;
  }

  const depot = getDepotWaypoint();
  const warnings: string[] = [];
  let origin: Waypoint;
  let destination: Waypoint;
  let routeStops = orderedStops;

  if (depot) {
    origin = depot;
    destination = depot;
  } else {
    origin = stopToWaypoint(orderedStops[0]);
    destination = stopToWaypoint(orderedStops.at(-1) ?? orderedStops[0]);
    routeStops = orderedStops.slice(1, -1);

    if (options.optimizeWaypointOrder && orderedStops.length > 2) {
      warnings.push(
        "La optimización mantiene fijo el primer y último punto porque no hay depósito configurado."
      );
    }
  }

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    body: JSON.stringify({
      destination,
      intermediates: routeStops.map((stop) => stopToWaypoint(stop)),
      languageCode: "es-AR",
      optimizeWaypointOrder: options.optimizeWaypointOrder,
      origin,
      polylineQuality: "OVERVIEW",
      routingPreference: options.optimizeWaypointOrder ? "TRAFFIC_AWARE" : "TRAFFIC_AWARE",
      travelMode: "DRIVE",
      units: "METRIC"
    }),
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "routes.distanceMeters",
        "routes.duration",
        "routes.polyline.encodedPolyline",
        "routes.legs.distanceMeters",
        "routes.legs.duration",
        "routes.legs.startLocation",
        "routes.legs.endLocation",
        "routes.optimizedIntermediateWaypointIndex"
      ].join(",")
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("No se pudo calcular la ruta.");
  }

  const payload = (await response.json()) as ComputeRoutesResponse;
  const route = payload.routes?.[0];

  if (!route) {
    return {
      preview: {
        encodedPolyline: null,
        optimizer: options.optimizeWaypointOrder ? "routes" : "manual",
        orderedStopIds: orderedStops.map((stop) => stop.orderId),
        stopLocations: {},
        totalDistanceMeters: 0,
        totalDurationSeconds: 0,
        warnings: ["Google no devolvió una ruta válida."]
      } satisfies DeliveryRoutePreview,
      warnings
    };
  }

  let orderedIds = orderedStops.map((stop) => stop.orderId);

  if (options.optimizeWaypointOrder) {
    const optimizedIntermediate = route.optimizedIntermediateWaypointIndex ?? [];

    if (depot) {
      orderedIds = optimizedIntermediate.map((index) => orderedStops[index]?.orderId).filter(Boolean);
    } else {
      const head = orderedStops[0]?.orderId;
      const tail = orderedStops.at(-1)?.orderId;
      const middle = routeStops;
      orderedIds = [
        head,
        ...optimizedIntermediate.map((index) => middle[index]?.orderId).filter(Boolean),
        tail
      ].filter((stopId): stopId is string => Boolean(stopId));
    }
  }

  const stopLocations: Record<string, { lat: number; lng: number }> = {};
  const routeLegs = route.legs ?? [];
  const legMappedStops = buildOrderedStops(orderedStops, orderedIds);

  if (depot) {
    for (const [index, stop] of legMappedStops.entries()) {
      const endLatLng = routeLegs[index]?.endLocation?.latLng;
      if (endLatLng) {
        stopLocations[stop.orderId] = {
          lat: endLatLng.latitude,
          lng: endLatLng.longitude
        };
      }
    }
  } else if (legMappedStops.length) {
    const firstStart = routeLegs[0]?.startLocation?.latLng;
    if (firstStart) {
      stopLocations[legMappedStops[0].orderId] = {
        lat: firstStart.latitude,
        lng: firstStart.longitude
      };
    }

    for (const [index, stop] of legMappedStops.slice(1).entries()) {
      const endLatLng = routeLegs[index]?.endLocation?.latLng;
      if (endLatLng) {
        stopLocations[stop.orderId] = {
          lat: endLatLng.latitude,
          lng: endLatLng.longitude
        };
      }
    }
  }

  return {
    preview: {
      encodedPolyline: route.polyline?.encodedPolyline ?? null,
      optimizer: options.optimizeWaypointOrder ? "routes" : "manual",
      orderedStopIds: orderedIds,
      stopLocations,
      totalDistanceMeters: Number(route.distanceMeters ?? 0),
      totalDurationSeconds: durationToSeconds(route.duration),
      warnings
    } satisfies DeliveryRoutePreview,
    warnings
  };
}

async function callOptimizationApi(stops: DeliveryRoutingStop[], scheduledDate?: string) {
  const token = await getServiceAccountAccessToken();
  const credentials = getOptimizationCredentials();

  if (!token || !credentials || !stops.length) {
    return null;
  }

  const depot = getDepotWaypoint();
  if (!depot) {
    return null;
  }

  const timeZoneOffset = process.env.LOGISTICS_TIMEZONE_OFFSET ?? "-03:00";
  const serviceDate = scheduledDate || new Date().toISOString().slice(0, 10);
  const model = {
    shipments: stops.map((stop) => ({
      deliveries: [
        {
          arrivalWaypoint: stopToWaypoint(stop),
          duration: "300s",
          label: stop.orderId,
          timeWindows:
            stop.deliveryWindowStart || stop.deliveryWindowEnd
              ? [
                  {
                    endTime: `${serviceDate}T${stop.deliveryWindowEnd || "23:59"}:00${timeZoneOffset}`,
                    startTime: `${serviceDate}T${stop.deliveryWindowStart || "00:00"}:00${timeZoneOffset}`
                  }
                ]
              : undefined
        }
      ],
      label: stop.orderId
    })),
    vehicles: [
      {
        costPerHour: 1,
        costPerKilometer: 1,
        endWaypoint: depot,
        label: "delivery-trip",
        startWaypoint: depot
      }
    ]
  };

  const response = await fetch(
    `https://routeoptimization.googleapis.com/v1/projects/${credentials.projectId}:optimizeTours`,
    {
      body: JSON.stringify({
        model,
        searchMode: "RETURN_FAST",
        timeout: "30s"
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  );

  if (!response.ok) {
    throw new Error("No se pudo optimizar la ruta con restricciones horarias.");
  }

  const payload = (await response.json()) as OptimizeToursResponse;
  const visits = payload.routes?.[0]?.visits ?? [];
  const orderedStopIds = visits
    .map((visit) => stops[visit.shipmentIndex]?.orderId)
    .filter((stopId): stopId is string => Boolean(stopId));

  if (!orderedStopIds.length) {
    return null;
  }

  const preview = await callRoutesApi(buildOrderedStops(stops, orderedStopIds), {
    optimizeWaypointOrder: false
  });

  if (!preview) {
    return null;
  }

  return {
    ...preview.preview,
    optimizer: "route_optimization" as const
  };
}

export async function computeDisplayedRoute(
  stops: DeliveryRoutingStop[],
  orderedStopIds?: string[]
): Promise<DeliveryRoutePreview> {
  const orderedStops = buildOrderedStops(stops, orderedStopIds);
  let route: Awaited<ReturnType<typeof callRoutesApi>> | null = null;

  try {
    route = await callRoutesApi(orderedStops, { optimizeWaypointOrder: false });
  } catch (error) {
    return {
      encodedPolyline: null,
      optimizer: "unavailable",
      orderedStopIds: orderedStops.map((stop) => stop.orderId),
      stopLocations: {},
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      warnings: [error instanceof Error ? error.message : "No se pudo calcular el recorrido."]
    };
  }

  if (!route) {
    return {
      encodedPolyline: null,
      optimizer: "unavailable",
      orderedStopIds: orderedStops.map((stop) => stop.orderId),
      stopLocations: {},
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      warnings: ["Configura GOOGLE_MAPS_API_KEY para visualizar el recorrido."]
    };
  }

  return route.preview;
}

export async function computeOptimizedRoute(
  stops: DeliveryRoutingStop[],
  orderedStopIds?: string[],
  scheduledDate?: string
): Promise<DeliveryRoutePreview> {
  const orderedStops = buildOrderedStops(stops, orderedStopIds);
  let optimizationWarning: string | null = null;

  if (hasTimeWindows(orderedStops)) {
    try {
      const optimized = await callOptimizationApi(orderedStops, scheduledDate);
      if (optimized) {
        return optimized;
      }
    } catch (error) {
      optimizationWarning =
        error instanceof Error ? error.message : "No se pudo usar Route Optimization API.";
    }
  }

  let route: Awaited<ReturnType<typeof callRoutesApi>> | null = null;

  try {
    route = await callRoutesApi(orderedStops, { optimizeWaypointOrder: true });
  } catch (error) {
    return {
      encodedPolyline: null,
      optimizer: "unavailable",
      orderedStopIds: orderedStops.map((stop) => stop.orderId),
      stopLocations: {},
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      warnings: [error instanceof Error ? error.message : "No se pudo optimizar el recorrido."]
    };
  }

  if (!route) {
    return {
      encodedPolyline: null,
      optimizer: "unavailable",
      orderedStopIds: orderedStops.map((stop) => stop.orderId),
      stopLocations: {},
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      warnings: ["Configura Google Routes para optimizar recorridos."]
    };
  }

  return {
    ...route.preview,
    optimizer: hasTimeWindows(orderedStops) ? "routes_fallback" : "routes",
    warnings: hasTimeWindows(orderedStops)
      ? [
          ...route.preview.warnings,
          ...(optimizationWarning ? [optimizationWarning] : []),
          "No había credenciales OAuth para Route Optimization API; la propuesta no respeta franjas horarias."
        ]
      : route.preview.warnings
  };
}
