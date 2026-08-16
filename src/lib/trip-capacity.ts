const EMPTY_VALUE = "-";

/** Diferencias por debajo de esto son ruido del ruteo, no una mejora real. */
const MIN_DISTANCE_GAIN_METERS = 100;
const MIN_DURATION_GAIN_SECONDS = 60;

export type RouteTotals = {
  distanceMeters: number;
  durationSeconds: number;
};

export type RouteImprovement = {
  headline: string;
  improves: boolean;
};

export function formatDistanceMeters(meters: number) {
  if (!meters) {
    return EMPTY_VALUE;
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  const kilometres = meters / 1000;
  const rounded = kilometres >= 10 ? Math.round(kilometres) : Math.round(kilometres * 10) / 10;

  return `${rounded.toLocaleString("es-AR")} km`;
}

export function formatDurationSeconds(seconds: number) {
  if (!seconds) {
    return EMPTY_VALUE;
  }

  const totalMinutes = Math.round(seconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

/**
 * Traduce la comparacion entre la ruta actual y la propuesta a una sola frase.
 * Optimizar y que no cambie nada es un resultado valido: hay que decirlo, no
 * mostrar dos columnas de numeros iguales y dejar a la persona decidiendo.
 */
export function describeRouteImprovement(
  current: RouteTotals | null,
  proposal: RouteTotals
): RouteImprovement {
  if (!current || (!current.distanceMeters && !current.durationSeconds)) {
    return { headline: "Ruta propuesta", improves: true };
  }

  const distanceGain = current.distanceMeters - proposal.distanceMeters;
  const durationGain = current.durationSeconds - proposal.durationSeconds;
  const savesDistance = distanceGain >= MIN_DISTANCE_GAIN_METERS;
  const savesDuration = durationGain >= MIN_DURATION_GAIN_SECONDS;

  if (!savesDistance && !savesDuration) {
    return { headline: "El orden actual ya es el mejor", improves: false };
  }

  const parts = [
    savesDistance ? formatDistanceMeters(distanceGain) : null,
    savesDuration ? formatDurationSeconds(durationGain) : null
  ].filter(Boolean);

  return { headline: `Ahorrás ${parts.join(" y ")}`, improves: true };
}
