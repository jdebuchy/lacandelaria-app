export type PolylinePoint = {
  lat: number;
  lng: number;
};

export type PolylineBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export function decodeGooglePolyline(encoded: string) {
  const points: PolylinePoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5
    });
  }

  return points;
}

export function getPolylineBounds(points: PolylinePoint[]) {
  if (!points.length) {
    return null;
  }

  return points.reduce<PolylineBounds>(
    (bounds, point) => ({
      north: Math.max(bounds.north, point.lat),
      south: Math.min(bounds.south, point.lat),
      east: Math.max(bounds.east, point.lng),
      west: Math.min(bounds.west, point.lng)
    }),
    {
      north: points[0].lat,
      south: points[0].lat,
      east: points[0].lng,
      west: points[0].lng
    }
  );
}
