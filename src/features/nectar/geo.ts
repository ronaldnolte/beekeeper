/**
 * Geospatial utilities for Nectar Flow Index calculations.
 */

/**
 * Generates a GeoJSON Polygon representing a circle around a center point
 * with a specified radius in miles. The circle is approximated as a 32-sided polygon.
 * 
 * Uses the Haversine destination point formula.
 * 
 * @param lat Center latitude in degrees
 * @param lng Center longitude in degrees
 * @param radiusMiles Radius of the circle in miles (default 1.0 miles)
 * @returns GeoJSON feature object representing the polygon
 */
export function generateCirclePolygon(
  lat: number,
  lng: number,
  radiusMiles: number = 1.0
) {
  const EARTH_RADIUS_MILES = 3959;
  const numPoints = 32;
  const coordinates: [number, number][] = [];

  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const angularDistance = radiusMiles / EARTH_RADIUS_MILES;

  for (let i = 0; i <= numPoints; i++) {
    // 0 to 360 degrees in radians
    const bearing = (i * 2 * Math.PI) / numPoints;

    const destLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
    );

    const destLngRad =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLatRad)
      );

    // Convert back to degrees
    const destLat = (destLatRad * 180) / Math.PI;
    // Normalize longitude to -180 to +180
    const destLng = (((destLngRad * 180) / Math.PI + 540) % 360) - 180;

    coordinates.push([destLng, destLat]);
  }

  return {
    type: 'Feature',
    properties: {
      center: [lng, lat],
      radiusMiles
    },
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates]
    }
  };
}
