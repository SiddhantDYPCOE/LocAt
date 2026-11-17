
const OSRM_BASE_URL =
  import.meta.env.VITE_OSRM_BASE_URL ||
  "https://router.project-osrm.org";

const routeCache = new Map();

const isValidCoordinate = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

export const getRoadRoute = async (
  origin,
  destination,
  profile = "driving"
) => {
  const allowedProfiles = ["driving", "cycling", "walking"];

  if (!allowedProfiles.includes(profile)) {
    throw new Error("Unsupported travel profile");
  }

  if (
    !origin ||
    !destination ||
    !isValidCoordinate(origin.latitude, origin.longitude) ||
    !isValidCoordinate(destination.latitude, destination.longitude)
  ) {
    throw new Error("Invalid origin or destination coordinates");
  }

  // Round coordinates slightly to improve cache reuse.
  const cacheKey = [
    profile,
    origin.latitude.toFixed(4),
    origin.longitude.toFixed(4),
    destination.latitude.toFixed(4),
    destination.longitude.toFixed(4),
  ].join(":");

  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  const coordinates = [
    `${origin.longitude},${origin.latitude}`,
    `${destination.longitude},${destination.latitude}`,
  ].join(";");

  const url =
    `${OSRM_BASE_URL}/route/v1/${profile}/${coordinates}` +
    "?overview=full&geometries=geojson&steps=false";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to fetch road route");
  }

  const data = await response.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(data.message || "No road route found");
  }

  const route = data.routes[0];

  const result = {
    distanceKm: route.distance / 1000,
    durationMinutes: route.duration / 60,

    // OSRM GeoJSON coordinates are [longitude, latitude].
    // Leaflet expects [latitude, longitude].
    coordinates: route.geometry.coordinates.map(
      ([longitude, latitude]) => [latitude, longitude]
    ),
  };

  routeCache.set(cacheKey, result);

  return result;
};

export const clearRouteCache = () => {
  routeCache.clear();
};
