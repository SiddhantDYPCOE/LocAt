
import { useEffect, useMemo, useState } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  useLocation as useLocationContext
} from "../../context/LocationContext.jsx";

import {
  useLocation as useRouterLocation
} from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { useConnections } from "../../context/ConnectionContext.jsx";

import {
  Radio,
  Users,
  LocateFixed,
  Clock,
  Share2,
  Square,
  Loader2,
  Check
} from "lucide-react";

// ==========================================
// LEAFLET DEFAULT MARKER FIX
// ==========================================

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

// ==========================================
// AVATAR MARKER
// ==========================================

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);

const createAvatarIcon = (avatarUrl, name) => {
  const initial = escapeHtml(
    (name || "U").charAt(0).toUpperCase()
  );

  let safeAvatarUrl = "";

  try {
    const parsedUrl = new URL(avatarUrl);

    if (
      parsedUrl.protocol === "https:" ||
      parsedUrl.protocol === "http:"
    ) {
      safeAvatarUrl = escapeHtml(parsedUrl.href);
    }
  } catch {
    safeAvatarUrl = "";
  }

  const html = safeAvatarUrl
    ? `
      <div class="locat-marker">
        <img src="${safeAvatarUrl}" alt="User avatar" />
      </div>
    `
    : `
      <div class="locat-marker locat-marker-fallback">
        ${initial}
      </div>
    `;

  return L.divIcon({
    className: "locat-marker-wrapper",
    html,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -25]
  });
};

// ==========================================
// MAP CONTROLLER
// ==========================================

const MapController = ({
  currentLocation,
  focusLocation
}) => {
  const map = useMap();

  useEffect(() => {
    // Shared chat location takes priority over GPS.
    if (
      focusLocation &&
      Number.isFinite(focusLocation.latitude) &&
      Number.isFinite(focusLocation.longitude)
    ) {
      map.setView(
        [
          focusLocation.latitude,
          focusLocation.longitude
        ],
        16
      );

      return;
    }

    if (!currentLocation) return;

    map.setView(
      [
        currentLocation.latitude,
        currentLocation.longitude
      ],
      15
    );
  }, [
    currentLocation?.latitude,
    currentLocation?.longitude,
    focusLocation?.latitude,
    focusLocation?.longitude,
    map
  ]);

  return null;
};

// ==========================================
// CONNECTION AVATAR
// ==========================================

const Avatar = ({ user }) => (
  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20 text-indigo-700">
    {user?.avatarUrl ? (
      <img
        src={user.avatarUrl}
        alt={user.name || "User"}
        className="h-full w-full object-cover"
      />
    ) : (
      <span className="font-semibold">
        {user?.name?.charAt(0)?.toUpperCase() || "U"}
      </span>
    )}
  </div>
);

// ==========================================
// MAP PAGE
// ==========================================

const Map = () => {
  const { user } = useAuth();

  const routerLocation = useRouterLocation();

  const focusLocation = routerLocation.state?.focusLocation;

  const validFocusLocation =
    Number.isFinite(focusLocation?.latitude) &&
    Number.isFinite(focusLocation?.longitude)
      ? focusLocation
      : null;

  const {
    connections,
    loading: connectionsLoading
  } = useConnections();

  const {
    activeShares,
    currentLocation: trackingLocation,
    isTracking,
    socketConnected,
    loading,
    error: sharingError,
    startSharing,
    stopSharing
  } = useLocationContext();

  // ==========================================
  // LOCAL GPS STATE
  // ==========================================

  const [myLocation, setMyLocation] = useState(null);
  const [gpsError, setGpsError] = useState("");
  const [gpsLoading, setGpsLoading] = useState(true);

  // ==========================================
  // SHARING FORM STATE
  // ==========================================

  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [duration, setDuration] = useState("60");

  const [sharingLoading, setSharingLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  // ==========================================
  // GET OWN LOCATION WITHOUT SHARING
  // ==========================================

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by this browser");
      setGpsLoading(false);
      return;
    }

    let active = true;

    const handleSuccess = (position) => {
      if (!active) return;

      setMyLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      });

      setGpsError("");
      setGpsLoading(false);
    };

    const handleError = (err) => {
      if (!active) return;

      setGpsError(
        err.code === 1
          ? "Allow location permission in your browser."
          : err.message || "Unable to get your location"
      );

      setGpsLoading(false);
    };

    const watchId = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000
      }
    );

    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const ownLocation = trackingLocation || myLocation;

  // ==========================================
  // CONNECTION USER DATA
  // ==========================================

  const getConnectionUser = (item) =>
    item?.user || item?.recipient || item?.sender || item;

  const acceptedConnections = useMemo(
    () =>
      connections
        .map((item) => ({
          connection: item,
          user: getConnectionUser(item)
        }))
        .filter(({ user: connectionUser }) => connectionUser?.id),
    [connections]
  );

  // ==========================================
  // FIND MY ACTIVE SHARE
  // ==========================================

  const myActiveShare = activeShares.find(
    (share) =>
      share.ownerId === user?.id &&
      share.status === "ACTIVE"
  );

  // ==========================================
  // SELECT / DESELECT RECIPIENTS
  // ==========================================

  const toggleRecipient = (recipientId) => {
    setSelectedRecipients((previous) =>
      previous.includes(recipientId)
        ? previous.filter((id) => id !== recipientId)
        : [...previous, recipientId]
    );
  };

  // ==========================================
  // START SHARING
  // ==========================================

  const handleStartSharing = async () => {
    if (selectedRecipients.length === 0) {
      setActionError("Select at least one connection.");
      return;
    }

    setSharingLoading(true);
    setActionError("");
    setActionMessage("");

    try {
      const expiresInMinutes =
        duration === "never" ? null : Number(duration);

      await startSharing(
        selectedRecipients,
        expiresInMinutes
      );

      setSelectedRecipients([]);

      setActionMessage(
        "Your live location is now being shared."
      );
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
        err.message ||
        "Unable to start location sharing."
      );
    } finally {
      setSharingLoading(false);
    }
  };

  // ==========================================
  // STOP SHARING
  // ==========================================

  const handleStopSharing = async () => {
    if (!myActiveShare) return;

    setSharingLoading(true);
    setActionError("");
    setActionMessage("");

    try {
      await stopSharing(myActiveShare.id);

      setActionMessage("Location sharing has been stopped.");
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
        err.message ||
        "Unable to stop location sharing."
      );
    } finally {
      setSharingLoading(false);
    }
  };

  // ==========================================
  // OTHER USERS' LOCATIONS
  // ==========================================

  const otherUsers = activeShares.filter(
    (share) => share.ownerId !== user?.id
  );

  // ==========================================
  // MAP MARKERS
  // ==========================================

  const locations = useMemo(() => {
    const result = [];

    if (ownLocation) {
      result.push({
        id: "current-user",
        latitude: ownLocation.latitude,
        longitude: ownLocation.longitude,
        name: user?.name || "You",
        avatarUrl: user?.avatarUrl,
        isCurrentUser: true
      });
    }

    otherUsers.forEach((share) => {
      if (
        typeof share.latitude !== "number" ||
        typeof share.longitude !== "number"
      ) {
        return;
      }

      result.push({
        id: share.id,
        latitude: share.latitude,
        longitude: share.longitude,
        name: share.owner?.name || "User",
        avatarUrl: share.owner?.avatarUrl,
        isCurrentUser: false
      });
    });

    return result;
  }, [ownLocation, otherUsers, user]);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <main className="space-y-5 p-4 pb-24 text-[#111B21] md:p-6">

      {/* HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Live Map
          </h1>

          <p className="mt-1 text-sm text-[#667781]">
            View your location and share it with connections.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-[#D9E1E5] bg-[#F7F9F8] px-4 py-2 text-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              socketConnected
                ? "bg-emerald-400"
                : "bg-red-400"
            }`}
          />

          <span className="text-[#111B21]">
            {socketConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* STATS */}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

        <div className="rounded-xl border border-[#D9E1E5] bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-[#667781]">
            <LocateFixed size={17} />
            Your location
          </div>

          <p className="mt-2 text-xl font-semibold">
            {gpsLoading
              ? "Locating..."
              : ownLocation
                ? "Available"
                : "Unavailable"}
          </p>
        </div>

        <div className="rounded-xl border border-[#D9E1E5] bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-[#667781]">
            <Users size={17} />
            Sharing with you
          </div>

          <p className="mt-2 text-xl font-semibold">
            {otherUsers.length}
          </p>
        </div>

        <div className="rounded-xl border border-[#D9E1E5] bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-[#667781]">
            <Radio size={17} />
            Your sharing status
          </div>

          <p className="mt-2 text-xl font-semibold">
            {isTracking ? "Sharing" : "Private"}
          </p>
        </div>

      </div>

      {/* LOCATION SHARING PANEL */}

      <section className="rounded-2xl border border-[#D9E1E5] bg-white p-5">

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-500/15 p-3 text-indigo-700">
            <Share2 size={22} />
          </div>

          <div>
            <h2 className="text-lg font-semibold">
              Share your live location
            </h2>

            <p className="text-sm text-[#667781]">
              Choose who can see your location.
            </p>
          </div>
        </div>

        {myActiveShare ? (
          <div className="mt-5 space-y-4">

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-green-700">
                <Radio size={17} />
                <span className="font-medium">
                  Location sharing is active
                </span>
              </div>

              <p className="mt-2 text-sm text-[#111B21]">
                Your location is being shared with{" "}
                {myActiveShare.recipientIds?.length || 0} selected connection(s).
              </p>

              {myActiveShare.expiresAt && (
                <p className="mt-2 text-xs text-[#667781]">
                  Expires:{" "}
                  {new Date(
                    myActiveShare.expiresAt
                  ).toLocaleString()}
                </p>
              )}

              {!myActiveShare.expiresAt && (
                <p className="mt-2 text-xs text-[#667781]">
                  No automatic expiry is configured.
                </p>
              )}
            </div>

            <button
              onClick={handleStopSharing}
              disabled={sharingLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-3 font-medium text-[#111B21] transition hover:bg-rose-600 disabled:opacity-50"
            >
              {sharingLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Square size={17} />
              )}

              Stop sharing
            </button>

          </div>
        ) : (
          <div className="mt-5 space-y-5">

            {/* RECIPIENT SELECTION */}

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-[#111B21]">
                  Select connections
                </h3>

                <span className="text-xs text-[#667781]">
                  {selectedRecipients.length} selected
                </span>
              </div>

              {connectionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-700" />
                </div>
              ) : acceptedConnections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D9E1E5] p-6 text-center">
                  <Users className="mx-auto mb-2 text-[#8696A0]" />

                  <p className="text-sm text-[#111B21]">
                    No accepted connections yet.
                  </p>

                  <p className="mt-1 text-xs text-[#8696A0]">
                    Connect with people before sharing your location.
                  </p>
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {acceptedConnections.map(({ user: connectionUser }) => {
                    const selected = selectedRecipients.includes(
                      connectionUser.id
                    );

                    return (
                      <button
                        key={connectionUser.id}
                        type="button"
                        onClick={() =>
                          toggleRecipient(connectionUser.id)
                        }
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                          selected
                            ? "border-indigo-500/60 bg-indigo-500/10"
                            : "border-[#E9EDEF] bg-white hover:bg-[#F7F9F8]"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar user={connectionUser} />

                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#111B21]">
                              {connectionUser.name || "Unknown user"}
                            </p>

                            <p className="truncate text-xs text-[#667781]">
                              @{connectionUser.username || "unknown"}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? "border-indigo-500 bg-indigo-500 text-[#111B21]"
                              : "border-slate-600 text-transparent"
                          }`}
                        >
                          <Check size={14} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* DURATION */}

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-[#111B21]">
                <Clock size={16} />
                Sharing duration
              </h3>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "15 minutes", value: "15" },
                  { label: "1 hour", value: "60" },
                  { label: "3 hours", value: "180" },
                  { label: "Until stopped", value: "never" }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDuration(option.value)}
                    className={`rounded-xl border px-3 py-3 text-sm transition ${
                      duration === option.value
                        ? "border-indigo-500 bg-indigo-500/15 text-indigo-700"
                        : "border-[#D9E1E5] bg-white text-[#667781] hover:bg-[#F7F9F8]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* START BUTTON */}

            <button
              onClick={handleStartSharing}
              disabled={
                sharingLoading ||
                selectedRecipients.length === 0 ||
                acceptedConnections.length === 0
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 font-medium text-[#111B21] transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sharingLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Share2 size={18} />
              )}

              Start sharing location
            </button>

          </div>
        )}

        {/* FEEDBACK */}

        {actionMessage && (
          <p className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-sm text-green-700">
            {actionMessage}
          </p>
        )}

        {(actionError || sharingError) && (
          <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm text-red-700">
            {actionError || sharingError}
          </p>
        )}

      </section>

      {/* GPS ERROR */}

      {gpsError && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
          {gpsError}
        </div>
      )}

      {/* MAP */}

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          {validFocusLocation ? "Shared location" : "Location map"}
        </h2>

        <div className="relative h-[550px] overflow-hidden rounded-2xl border border-[#D9E1E5] bg-white">

          {gpsLoading && (
            <div className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-xs text-[#111B21] shadow-lg">
              Getting your location...
            </div>
          )}

          {loading && (
            <div className="absolute right-4 top-4 z-[1000] rounded-full bg-white px-3 py-2 text-xs text-[#111B21] shadow-lg">
              Updating shared locations...
            </div>
          )}

          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            scrollWheelZoom
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapController
              currentLocation={myLocation}
              focusLocation={validFocusLocation}
            />

            {/* ONE-TIME SHARED CHAT LOCATION */}

            {validFocusLocation && (
              <Marker
                position={[
                  validFocusLocation.latitude,
                  validFocusLocation.longitude
                ]}
              >
                <Popup>
                  <div className="font-semibold text-gray-900">
                    Shared location
                  </div>

                  <p className="mt-1 text-xs text-gray-500">
                    Location shared in chat
                  </p>
                </Popup>
              </Marker>
            )}

            {/* EXISTING LIVE LOCATION MARKERS */}

            {locations.map((location) => (
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
                  <div className="min-w-[130px]">
                    <p className="font-semibold text-gray-900">
                      {location.name}
                      {location.isCurrentUser ? " (You)" : ""}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {location.isCurrentUser
                        ? isTracking
                          ? "Your shared location"
                          : "Only visible to you"
                        : "Live shared location"}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </section>

      {/* PRIVACY NOTE */}

      <p className="text-center text-xs text-[#8696A0]">
        Your location remains private until you explicitly start sharing it.
      </p>

    </main>
  );
};

export default Map;
