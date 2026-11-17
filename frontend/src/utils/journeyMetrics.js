
// frontend/src/utils/journeyMetrics.js

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate straight-line distance between two GPS coordinates.
 * Uses the Haversine formula.
 *
 * @returns {number|null} Distance in kilometres.
 */
export const calculateDistanceKm = (
  latitude1,
  longitude1,
  latitude2,
  longitude2
) => {
  const coordinates = [
    latitude1,
    longitude1,
    latitude2,
    longitude2
  ];

  if (!coordinates.every(Number.isFinite)) {
    return null;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const lat1 = toRadians(latitude1);
  const lat2 = toRadians(latitude2);

  const deltaLat = toRadians(latitude2 - latitude1);
  const deltaLng = toRadians(longitude2 - longitude1);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

  const centralAngle =
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * centralAngle;
};

/**
 * Convert GPS speed from metres/second to kilometres/hour.
 *
 * @returns {number|null} Speed in km/h.
 */
export const convertSpeedToKmh = (speedMetersPerSecond) => {
  if (
    !Number.isFinite(speedMetersPerSecond) ||
    speedMetersPerSecond < 0
  ) {
    return null;
  }

  return speedMetersPerSecond * 3.6;
};

/**
 * Calculate ETA using current speed.
 *
 * @param {number} distanceKm
 * @param {number} speedKmh
 * @returns {number|null} Estimated minutes.
 */
export const calculateEtaMinutes = (distanceKm, speedKmh) => {
  if (
    !Number.isFinite(distanceKm) ||
    !Number.isFinite(speedKmh) ||
    distanceKm < 0 ||
    speedKmh <= 0
  ) {
    return null;
  }

  return (distanceKm / speedKmh) * 60;
};

/**
 * Format distance for display.
 */
export const formatDistance = (distanceKm) => {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return "--";
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(1)} km`;
};

/**
 * Format speed for display.
 */
export const formatSpeed = (speedKmh) => {
  if (!Number.isFinite(speedKmh) || speedKmh < 0) {
    return "--";
  }

  return `${speedKmh.toFixed(1)} km/h`;
};

/**
 * Format ETA in minutes.
 */
export const formatEta = (etaMinutes) => {
  if (!Number.isFinite(etaMinutes) || etaMinutes < 0) {
    return "--";
  }

  const totalMinutes = Math.round(etaMinutes);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0
    ? `${hours} hr`
    : `${hours} hr ${minutes} min`;
};
