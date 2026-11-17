
import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap
} from "react-leaflet";
import L from "leaflet";

import "leaflet/dist/leaflet.css";

import { useLocation } from "../../context/LocationContext.jsx";

// Fix default Leaflet marker asset paths in Vite
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

// Create an avatar-based map marker
const createAvatarIcon = (avatarUrl, name) => {
  if (avatarUrl) {
    return L.divIcon({
      className: "avatar-map-marker",
      html: `
        <div style="
          width:48px;
          height:48px;
          border:3px solid white;
          border-radius:50%;
          overflow:hidden;
          box-shadow:0 2px 10px rgba(0,0,0,0.3);
          background:#e0e7ff;
        ">
          <img
            src="${avatarUrl}"
            alt="${name || "User"}"
            style="width:100%;height:100%;object-fit:cover;"
          />
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });
  }

  return L.divIcon({
    className: "avatar-map-marker",
    html: `
      <div style="
        width:48px;
        height:48px;
        border:3px solid white;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#6366f1;
        color:white;
        font-weight:700;
        font-size:18px;
        box-shadow:0 2px 10px rgba(0,0,0,0.3);
      ">
        ${(name || "U").charAt(0).toUpperCase()}
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });
};

// Automatically fit map to visible markers
const MapBounds = ({ locations }) => {
  const map = useMap();

  useEffect(() => {
    if (!locations.length) return;

    const bounds = L.latLngBounds(
      locations.map((location) => [
        location.latitude,
        location.longitude
      ])
    );

    map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 16
    });
  }, [locations, map]);

  return null;
};

const LiveMap = () => {
  const { activeShares, currentLocation } = useLocation();

  const visibleLocations = activeShares.filter(
    (share) =>
      typeof share.latitude === "number" &&
      typeof share.longitude === "number"
  );

  const mapLocations = [
    ...visibleLocations.map((share) => ({
      id: share.id,
      latitude: share.latitude,
      longitude: share.longitude,
      name: share.owner?.name || "User",
      avatarUrl: share.owner?.avatarUrl,
      isCurrentUser: false
    }))
  ];

  if (currentLocation) {
    mapLocations.push({
      id: "current-user",
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      name: "You",
      avatarUrl: null,
      isCurrentUser: true
    });
  }

  const defaultCenter = currentLocation
    ? [currentLocation.latitude, currentLocation.longitude]
    : mapLocations.length
      ? [mapLocations[0].latitude, mapLocations[0].longitude]
      : [18.5204, 73.8567]; // Pune fallback

  return (
    <div className="relative h-full min-h-[450px] w-full overflow-hidden rounded-2xl">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mapLocations.map((location) => (
          <Marker
            key={location.id}
            position={[
              location.latitude,
              location.longitude
            ]}
            icon={createAvatarIcon(
              location.avatarUrl,
              location.name
            )}
          >
            <Popup>
              <div className="min-w-[120px]">
                <p className="font-semibold">
                  {location.name}
                </p>
                <p className="text-xs text-gray-500">
                  {location.isCurrentUser
                    ? "Your current location"
                    : "Live location"}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapBounds locations={mapLocations} />
      </MapContainer>
    </div>
  );
};

export default LiveMap;
