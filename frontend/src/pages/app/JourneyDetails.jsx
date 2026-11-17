
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { useNavigate, useParams } from "react-router-dom";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap
} from "react-leaflet";

import L from "leaflet";

import {
  ArrowLeft,
  MapPin,
  Users,
  Play,
  CheckCircle2,
  LogOut,
  Flag,
  XCircle,
  Loader2,
  LocateFixed,
  Radio,
  AlertCircle,
  Gauge,
  Clock,
  Route
} from "lucide-react";

import "leaflet/dist/leaflet.css";

import { useAuth } from "../../context/AuthContext.jsx";
import { useJourneys } from "../../context/JourneyContext.jsx";
import useJourneyTracking from "../../hooks/useJourneyTracking.js";

import {
  calculateDistanceKm,
  convertSpeedToKmh,
  formatDistance,
  formatSpeed,
  formatEta
} from "../../utils/journeyMetrics.js";

import { getRoadRoute } from "../../services/routing.service.js";

// ========================================
// HELPERS
// ========================================

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);

const createMemberIcon = (name, isCurrentUser = false) => {
  const initial = escapeHtml(
    name?.charAt(0)?.toUpperCase() || "U"
  );

  return L.divIcon({
    className: "journey-member-marker",
    html: `
      <div style="
        width:42px;
        height:42px;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        background:${isCurrentUser ? "#6366f1" : "#0f172a"};
        color:white;
        border:3px solid white;
        box-shadow:0 3px 12px rgba(0,0,0,.4);
        font-weight:700;
        font-size:15px;
      ">${initial}</div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -20]
  });
};

// ========================================
// MAP COMPONENTS
// ========================================

const FitJourneyBounds = ({ points, destination }) => {
  const map = useMap();

  useEffect(() => {
    const coordinates = [
      ...points.map((point) => [
        point.latitude,
        point.longitude
      ]),
      ...(destination
        ? [[destination.latitude, destination.longitude]]
        : [])
    ];

    if (coordinates.length > 1) {
      map.fitBounds(coordinates, {
        padding: [45, 45],
        maxZoom: 15
      });
    } else if (coordinates.length === 1) {
      map.setView(coordinates[0], 15);
    }
  }, [map, points, destination]);

  return null;
};

// ========================================
// UI COMPONENTS
// ========================================

const StatusBadge = ({ status }) => {
  const styles = {
    PLANNED: "bg-amber-500/10 text-amber-400",
    ACTIVE: "bg-emerald-500/10 text-emerald-400",
    COMPLETED: "bg-indigo-500/10 text-indigo-400",
    CANCELLED: "bg-rose-500/10 text-rose-400",
    ACCEPTED: "bg-emerald-500/10 text-emerald-400",
    INVITED: "bg-amber-500/10 text-amber-400",
    DECLINED: "bg-rose-500/10 text-rose-400",
    ARRIVED: "bg-indigo-500/10 text-indigo-400",
    LEFT: "bg-slate-500/10 text-slate-400"
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || "bg-slate-500/10 text-slate-400"
      }`}
    >
      {status || "UNKNOWN"}
    </span>
  );
};

const ActionButton = ({
  children,
  onClick,
  disabled,
  variant = "primary"
}) => {
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white",
    danger:
      "bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20",
    secondary: "bg-white/5 hover:bg-white/10 text-slate-200"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]}`}
    >
      {children}
    </button>
  );
};

const MetricCard = ({ icon: Icon, label, value, color }) => (
  <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
    <div className={`mb-3 flex items-center gap-2 ${color}`}>
      <Icon className="h-4 w-4" />
      <span className="text-xs font-medium">{label}</span>
    </div>

    <p className="text-xl font-bold text-white">
      {value}
    </p>
  </div>
);

// ========================================
// MEMBER HELPERS
// ========================================

const getMemberLocationLabel = (member) => {
  if (member.status === "ARRIVED") {
    return "Arrived at destination";
  }

  if (member.status === "LEFT") {
    return "Left this journey";
  }

  if (member.status === "DECLINED") {
    return "Declined invitation";
  }

  if (member.status === "INVITED") {
    return "Waiting for response";
  }

  if (member.status === "ACCEPTED") {
    return Number.isFinite(member.currentLat) &&
      Number.isFinite(member.currentLng)
      ? "Sharing live location"
      : "Location not shared";
  }

  return "Not participating";
};

// ========================================
// JOURNEY DETAILS PAGE
// ========================================

const JourneyDetails = () => {
  const { journeyId } = useParams();
  const navigate = useNavigate();

  const { user } = useAuth();

  const {
    selectedJourney,
    detailsLoading,
    error,
    getJourneyDetails,
    startJourney,
    markArrived,
    leaveJourney,
    respondToInvitation,
    completeJourney,
    cancelJourney
  } = useJourneys();

  const {
    isTracking,
    currentLocation,
    socketConnected,
    error: trackingError,
    startTracking,
    stopTracking
  } = useJourneyTracking(journeyId);

  // ========================================
  // STATE
  // ========================================

  const [actionLoading, setActionLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  const [roadRoutes, setRoadRoutes] = useState({});

  // Prevent overlapping routing queues.
  const routingInProgressRef = useRef(false);

  // Enforce minimum time between OSRM requests.
  const lastRoutingRequestRef = useRef(0);

  // Store the last successful routing position per member.
  const routeRequestInfoRef = useRef(new Map());

  // ========================================
  // JOURNEY DATA
  // ========================================

  const journey = selectedJourney?.id === journeyId
    ? selectedJourney
    : null;

  const currentMember = useMemo(() => {
    return journey?.members?.find(
      (member) => member.userId === user?.id
    );
  }, [journey, user?.id]);

  const isCreator = journey?.createdById === user?.id;

  const isActive = journey?.status === "ACTIVE";
  const isPlanned = journey?.status === "PLANNED";

  const isFinished =
    journey?.status === "COMPLETED" ||
    journey?.status === "CANCELLED";

  const canParticipate = currentMember?.status === "ACCEPTED";

  const canViewLiveLocations =
    currentMember?.status === "ACCEPTED" ||
    currentMember?.status === "ARRIVED";

  const participatingMembers = useMemo(() => {
    return journey?.members?.filter(
      (member) =>
        member.status === "ACCEPTED" ||
        member.status === "ARRIVED"
    ) || [];
  }, [journey]);

  // ========================================
  // DESTINATION
  // ========================================

  const destination = useMemo(() => {
    if (
      !Number.isFinite(journey?.destinationLat) ||
      !Number.isFinite(journey?.destinationLng)
    ) {
      return null;
    }

    return {
      latitude: journey.destinationLat,
      longitude: journey.destinationLng
    };
  }, [journey]);

  // ========================================
  // ROAD ROUTING
  // ========================================

  useEffect(() => {
    if (
      !destination ||
      !isActive ||
      !canViewLiveLocations
    ) {
      return;
    }

    let cancelled = false;

    const delay = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds));

    const fetchRoutes = async () => {
      // Wait for any previous routing queue.
      while (
        routingInProgressRef.current &&
        !cancelled
      ) {
        await delay(250);
      }

      if (cancelled) return;

      routingInProgressRef.current = true;

      try {
        const members = (journey?.members || []).filter(
          (member) =>
            member.status === "ACCEPTED" &&
            Number.isFinite(member.currentLat) &&
            Number.isFinite(member.currentLng)
        );

        for (const member of members) {
          if (cancelled) break;

          const origin = {
            latitude: member.currentLat,
            longitude: member.currentLng
          };

          const previousRequest =
            routeRequestInfoRef.current.get(member.userId);

          // Skip routing if the member has barely moved
          // and the previous successful route is recent.
          if (previousRequest) {
            const movedDistance = calculateDistanceKm(
              previousRequest.latitude,
              previousRequest.longitude,
              origin.latitude,
              origin.longitude
            );

            const elapsed =
              Date.now() - previousRequest.timestamp;

            if (
              movedDistance !== null &&
              movedDistance < 0.05 &&
              elapsed < 30000
            ) {
              continue;
            }
          }

          // Keep at least 1.2 seconds between requests.
          const elapsedSinceLastRequest =
            Date.now() - lastRoutingRequestRef.current;

          if (elapsedSinceLastRequest < 1200) {
            await delay(1200 - elapsedSinceLastRequest);
          }

          if (cancelled) break;

          lastRoutingRequestRef.current = Date.now();

          try {
            const route = await getRoadRoute(
              origin,
              destination,
              "driving"
            );

            if (cancelled) break;

            routeRequestInfoRef.current.set(member.userId, {
              ...origin,
              timestamp: Date.now()
            });

            setRoadRoutes((previous) => ({
              ...previous,
              [member.userId]: {
                ...route,
                updatedAt: Date.now()
              }
            }));
          } catch (routeError) {
            console.error(
              `Unable to calculate route for ${member.userId}:`,
              routeError
            );
          }
        }
      } finally {
        routingInProgressRef.current = false;
      }
    };

    const timer = setTimeout(fetchRoutes, 700);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    journey?.members,
    destination,
    isActive,
    canViewLiveLocations
  ]);

  // ========================================
  // MEMBER METRICS
  // ========================================

  const memberMetrics = useMemo(() => {
    if (!journey?.members) return {};

    return journey.members.reduce((metrics, member) => {
      if (
        member.status !== "ACCEPTED" ||
        !Number.isFinite(member.currentLat) ||
        !Number.isFinite(member.currentLng)
      ) {
        return metrics;
      }

      const route = roadRoutes[member.userId];

      metrics[member.userId] = {
        distance: route?.distanceKm ?? null,
        speed: convertSpeedToKmh(member.speed),
        eta: route?.durationMinutes ?? null,
        routeCoordinates: route?.coordinates || [],
        routeLoading: !route
      };

      return metrics;
    }, {});
  }, [journey?.members, roadRoutes]);

  // ========================================
  // JOURNEY STATISTICS
  // ========================================

  const journeyStats = useMemo(() => {
    const liveMembers = participatingMembers.filter(
      (member) =>
        member.status === "ACCEPTED" &&
        Number.isFinite(member.currentLat) &&
        Number.isFinite(member.currentLng)
    );

    const speeds = liveMembers
      .map((member) => convertSpeedToKmh(member.speed))
      .filter((speed) => speed !== null);

    const averageSpeed = speeds.length > 0
      ? speeds.reduce((total, speed) => total + speed, 0) /
        speeds.length
      : null;

    const distances = liveMembers
      .map((member) => memberMetrics[member.userId]?.distance)
      .filter(Number.isFinite);

    const averageDistance = distances.length > 0
      ? distances.reduce((total, distance) => total + distance, 0) /
        distances.length
      : null;

    return {
      liveCount: liveMembers.length,
      participantCount: participatingMembers.length,
      averageSpeed,
      averageDistance
    };
  }, [participatingMembers, memberMetrics]);

  // ========================================
  // MAP POINTS
  // ========================================

  const mapPoints = useMemo(() => {
    if (!canViewLiveLocations) return [];

    return participatingMembers
      .filter(
        (member) =>
          member.status === "ACCEPTED" &&
          member.userId !== user?.id &&
          Number.isFinite(member.currentLat) &&
          Number.isFinite(member.currentLng)
      )
      .map((member) => ({
        id: member.userId,
        name: member.user?.name ||
          member.user?.username ||
          "Member",
        latitude: member.currentLat,
        longitude: member.currentLng,
        isCurrentUser: false
      }));
  }, [
    participatingMembers,
    user?.id,
    canViewLiveLocations
  ]);

  const visibleMapPoints = useMemo(() => {
    const points = [...mapPoints];

    if (
      canViewLiveLocations &&
      isTracking &&
      currentLocation &&
      Number.isFinite(currentLocation.latitude) &&
      Number.isFinite(currentLocation.longitude)
    ) {
      points.push({
        id: "current-user",
        name: user?.name || "You",
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        isCurrentUser: true
      });
    }

    return points;
  }, [
    mapPoints,
    canViewLiveLocations,
    isTracking,
    currentLocation,
    user?.name
  ]);

  const mapCenter = useMemo(() => {
    if (visibleMapPoints.length > 0) {
      return [
        visibleMapPoints[0].latitude,
        visibleMapPoints[0].longitude
      ];
    }

    if (destination) {
      return [
        destination.latitude,
        destination.longitude
      ];
    }

    const origin = journey?.members?.find(
      (member) =>
        Number.isFinite(member.originLat) &&
        Number.isFinite(member.originLng)
    );

    if (origin) {
      return [origin.originLat, origin.originLng];
    }

    return [18.5204, 73.8567];
  }, [visibleMapPoints, destination, journey]);

  // ========================================
  // LOAD JOURNEY
  // ========================================

  const loadJourney = useCallback(async () => {
    try {
      await getJourneyDetails(journeyId);
    } catch (err) {
      console.error("Unable to load journey:", err);
    }
  }, [getJourneyDetails, journeyId]);

  useEffect(() => {
    loadJourney();
  }, [loadJourney]);

  // ========================================
  // ACTION HANDLER
  // ========================================

  const runAction = async (action) => {
    setActionLoading(true);
    setPageError("");

    try {
      await action();
    } catch (err) {
      setPageError(
        err.response?.data?.message ||
        err.message ||
        "Unable to perform this action"
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ========================================
  // INVITATION
  // ========================================

  const handleInvitationResponse = async (status) => {
    await runAction(() =>
      respondToInvitation(journeyId, status)
    );
  };

  // ========================================
  // START JOURNEY
  // ========================================

  const handleStart = async () => {
    await runAction(async () => {
      await startJourney(journeyId);

      const started = await startTracking();

      if (!started) {
        setPageError(
          "Journey started, but GPS sharing could not start. Check location permission and try again."
        );
      }
    });
  };

  // ========================================
  // START GPS TRACKING
  // ========================================

  const handleStartTracking = async () => {
    setPageError("");

    const started = await startTracking();

    if (!started) {
      setPageError(
        trackingError || "Unable to start location sharing"
      );
    }
  };

  // ========================================
  // ARRIVED
  // ========================================

  const handleArrived = async () => {
    await runAction(async () => {
      await markArrived(journeyId);
      stopTracking();
    });
  };

  // ========================================
  // LEAVE
  // ========================================

  const handleLeave = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to leave this journey?"
    );

    if (!confirmed) return;

    await runAction(async () => {
      stopTracking();
      await leaveJourney(journeyId);
    });
  };

  // ========================================
  // COMPLETE
  // ========================================

  const handleComplete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to complete this journey?"
    );

    if (!confirmed) return;

    await runAction(async () => {
      stopTracking();
      await completeJourney(journeyId);
    });
  };

  // ========================================
  // CANCEL
  // ========================================

  const handleCancel = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this journey?"
    );

    if (!confirmed) return;

    await runAction(async () => {
      stopTracking();
      await cancelJourney(journeyId);
    });
  };

  // ========================================
  // LOADING
  // ========================================

  if (detailsLoading && !journey) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-slate-400">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading journey...
      </div>
    );
  }

  // ========================================
  // NOT FOUND
  // ========================================

  if (!journey) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="mb-4 h-10 w-10 text-rose-400" />

        <h2 className="text-xl font-semibold text-white">
          Journey not found
        </h2>

        <p className="mt-2 text-sm text-slate-400">
          {pageError ||
            error ||
            "You may not have access to this journey."}
        </p>

        <button
          onClick={() => navigate("/journeys")}
          className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Back to Journeys
        </button>
      </div>
    );
  }

  // ========================================
  // UI
  // ========================================

  return (
    <div className="min-h-screen space-y-6 p-4 pb-28 text-white sm:p-6 lg:p-8">

      {/* Header */}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/journeys")}
            className="rounded-xl bg-white/5 p-3 text-slate-300 hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div>
            <p className="text-sm text-slate-500">
              Journey Details
            </p>

            <h1 className="text-xl font-bold sm:text-2xl">
              {journey.name || journey.destinationName}
            </h1>
          </div>
        </div>

        <StatusBadge status={journey.status} />
      </div>

      {/* Errors */}

      {(pageError || trackingError || error) && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{pageError || trackingError || error}</p>
        </div>
      )}

      {/* Journey overview */}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/5 bg-[#0D1524] p-5 lg:col-span-2">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400">
              <MapPin className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <p className="text-xs text-slate-500">
                Destination
              </p>

              <h2 className="font-semibold">
                {journey.destinationName}
              </h2>

              {journey.destinationAddress && (
                <p className="mt-1 text-sm text-slate-400">
                  {journey.destinationAddress}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/5 pt-5">
            <div>
              <p className="text-xs text-slate-500">
                Created by
              </p>

              <p className="mt-1 text-sm font-medium">
                {journey.creator?.name || "Journey creator"}
                {isCreator ? " (You)" : ""}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Participants
              </p>

              <p className="mt-1 text-sm font-medium">
                {participatingMembers.length} members
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#0D1524] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
              <Radio className="h-6 w-6" />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Location connection
              </p>

              <p className="font-semibold">
                {socketConnected ? "Connected" : "Disconnected"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              Your GPS sharing
            </span>

            <span
              className={`text-xs font-semibold ${
                isTracking
                  ? "text-emerald-400"
                  : "text-slate-500"
              }`}
            >
              {isTracking ? "ON" : "OFF"}
            </span>
          </div>
        </div>
      </section>

      {/* Journey statistics */}

      {isActive && canViewLiveLocations && (
        <section className="rounded-2xl border border-white/5 bg-[#0D1524] p-5">
          <div className="mb-5">
            <h2 className="font-semibold">
              Journey Statistics
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Live statistics calculated from shared GPS positions and road routes
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              icon={Users}
              label="Participants"
              value={journeyStats.participantCount}
              color="text-indigo-400"
            />

            <MetricCard
              icon={Radio}
              label="Sharing location"
              value={`${journeyStats.liveCount} / ${journeyStats.participantCount}`}
              color="text-emerald-400"
            />

            <MetricCard
              icon={Gauge}
              label="Average speed"
              value={formatSpeed(journeyStats.averageSpeed)}
              color="text-amber-400"
            />

            <MetricCard
              icon={Route}
              label="Average road distance"
              value={formatDistance(journeyStats.averageDistance)}
              color="text-sky-400"
            />
          </div>
        </section>
      )}

      {/* Invitation response */}

      {currentMember?.status === "INVITED" && !isFinished && (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-500/10 p-3 text-amber-400">
              <Users className="h-5 w-5" />
            </div>

            <div className="flex-1">
              <h2 className="font-semibold text-white">
                You're invited!
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                {journey.creator?.name || "Someone"} invited you to join
                this journey to {journey.destinationName}.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <ActionButton
                  variant="success"
                  onClick={() =>
                    handleInvitationResponse("ACCEPTED")
                  }
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Accept Invitation
                </ActionButton>

                <ActionButton
                  variant="danger"
                  onClick={() =>
                    handleInvitationResponse("DECLINED")
                  }
                  disabled={actionLoading}
                >
                  <XCircle className="h-4 w-4" />
                  Decline
                </ActionButton>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Live journey map */}

      <section className="overflow-hidden rounded-2xl border border-white/5 bg-[#0D1524]">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-semibold">
              Live Journey Map
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {canViewLiveLocations
                ? "Road routes and latest shared participant positions"
                : "Accept the invitation to view live participant locations"}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {visibleMapPoints.length} live locations
          </div>
        </div>

        <div className="h-[380px] w-full sm:h-[480px]">
          <MapContainer
            center={mapCenter}
            zoom={13}
            scrollWheelZoom
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FitJourneyBounds
              points={visibleMapPoints}
              destination={destination}
            />

            {/* Road routes */}

            {canViewLiveLocations &&
              participatingMembers.map((member) => {
                const route = roadRoutes[member.userId];

                if (
                  member.status !== "ACCEPTED" ||
                  !Number.isFinite(member.currentLat) ||
                  !Number.isFinite(member.currentLng) ||
                  !route?.coordinates?.length
                ) {
                  return null;
                }

                return (
                  <Polyline
                    key={`route-${member.userId}`}
                    positions={route.coordinates}
                    pathOptions={{
                      color:
                        member.userId === user?.id
                          ? "#818cf8"
                          : "#38bdf8",
                      weight: 5,
                      opacity: 0.8
                    }}
                  />
                );
              })}

            {/* Destination */}

            {destination && (
              <Marker
                position={[
                  destination.latitude,
                  destination.longitude
                ]}
              >
                <Popup>
                  <strong>{journey.destinationName}</strong>
                  <br />
                  Destination
                </Popup>
              </Marker>
            )}

            {/* Participant markers */}

            {visibleMapPoints.map((point) => (
              <Marker
                key={point.id}
                position={[
                  point.latitude,
                  point.longitude
                ]}
                icon={createMemberIcon(
                  point.name,
                  point.isCurrentUser
                )}
              >
                <Popup>
                  <strong>
                    {point.name}
                    {point.isCurrentUser ? " (You)" : ""}
                  </strong>
                  <br />
                  {point.isCurrentUser
                    ? "Your current GPS position"
                    : "Journey member"}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {visibleMapPoints.length === 0 && (
          <p className="border-t border-white/5 px-5 py-3 text-xs text-slate-500">
            {canViewLiveLocations
              ? "No member is currently sharing a location. Start GPS sharing to appear on the map."
              : "Live participant locations are available to accepted journey members."}
          </p>
        )}

        {canViewLiveLocations && (
          <div className="flex flex-wrap gap-4 border-t border-white/5 px-5 py-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-2 w-5 rounded bg-indigo-400" />
              Your road route
            </div>

            <div className="flex items-center gap-2">
              <span className="h-2 w-5 rounded bg-sky-400" />
              Other members' routes
            </div>
          </div>
        )}
      </section>

      {/* GPS controls */}

      {isActive && canParticipate && (
        <section className="rounded-2xl border border-white/5 bg-[#0D1524] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">
                Share your live location
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Allow browser location access to share your position with the group.
              </p>
            </div>

            {isTracking ? (
              <ActionButton
                variant="danger"
                onClick={stopTracking}
              >
                <Radio className="h-4 w-4" />
                Stop sharing
              </ActionButton>
            ) : (
              <ActionButton
                onClick={handleStartTracking}
                disabled={actionLoading}
              >
                <LocateFixed className="h-4 w-4" />
                Start sharing
              </ActionButton>
            )}
          </div>

          {currentLocation && (
            <p className="mt-3 text-xs text-slate-500">
              Accuracy: {Math.round(currentLocation.accuracy || 0)} metres
            </p>
          )}
        </section>
      )}

      {/* Journey members */}

      <section className="rounded-2xl border border-white/5 bg-[#0D1524] p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">
              Journey Members
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Live participant and invitation statuses
            </p>
          </div>

          <Users className="h-5 w-5 text-indigo-400" />
        </div>

        <div className="space-y-3">
          {journey.members?.map((member) => {
            const name =
              member.user?.name ||
              member.user?.username ||
              "LocAt User";

            const metrics = memberMetrics[member.userId];

            return (
              <div
                key={member.id}
                className="rounded-xl bg-white/[0.03] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/15 font-semibold text-indigo-300">
                      {member.user?.avatarUrl ? (
                        <img
                          src={member.user.avatarUrl}
                          alt={name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        name.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {name}
                        {member.userId === user?.id ? " (You)" : ""}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {getMemberLocationLabel(member)}
                      </p>
                    </div>
                  </div>

                  <StatusBadge status={member.status} />
                </div>

                {metrics && (
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/5 pt-3">

                    {/* Distance */}

                    <div>
                      <div className="mb-1 flex items-center gap-1 text-slate-500">
                        <Route className="h-3 w-3" />
                        <span className="text-[10px]">
                          Road distance
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-indigo-300">
                        {metrics.routeLoading
                          ? "Calculating..."
                          : formatDistance(metrics.distance)}
                      </p>
                    </div>

                    {/* Speed */}

                    <div>
                      <div className="mb-1 flex items-center gap-1 text-slate-500">
                        <Gauge className="h-3 w-3" />
                        <span className="text-[10px]">
                          Speed
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-emerald-300">
                        {formatSpeed(metrics.speed)}
                      </p>
                    </div>

                    {/* ETA */}

                    <div>
                      <div className="mb-1 flex items-center gap-1 text-slate-500">
                        <Clock className="h-3 w-3" />
                        <span className="text-[10px]">
                          Road ETA
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-amber-300">
                        {metrics.routeLoading
                          ? "Calculating..."
                          : formatEta(metrics.eta)}
                      </p>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Journey actions */}

      {!isFinished && (
        <section className="rounded-2xl border border-white/5 bg-[#0D1524] p-5">
          <h2 className="mb-4 font-semibold">
            Journey Actions
          </h2>

          <div className="flex flex-wrap gap-3">
            {isCreator && isPlanned && canParticipate && (
              <ActionButton
                onClick={handleStart}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Play className="h-4 w-4" />}
                Start Journey
              </ActionButton>
            )}

            {isActive &&
              canParticipate &&
              currentMember?.status !== "ARRIVED" && (
                <ActionButton
                  variant="success"
                  onClick={handleArrived}
                  disabled={actionLoading}
                >
                  <Flag className="h-4 w-4" />
                  I've Arrived
                </ActionButton>
              )}

            {isCreator && isActive && (
              <ActionButton
                variant="success"
                onClick={handleComplete}
                disabled={actionLoading}
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete Journey
              </ActionButton>
            )}

            {!isCreator &&
              canParticipate &&
              (isPlanned || isActive) && (
                <ActionButton
                  variant="danger"
                  onClick={handleLeave}
                  disabled={actionLoading}
                >
                  <LogOut className="h-4 w-4" />
                  Leave Journey
                </ActionButton>
              )}

            {isCreator && (isPlanned || isActive) && (
              <ActionButton
                variant="danger"
                onClick={handleCancel}
                disabled={actionLoading}
              >
                <XCircle className="h-4 w-4" />
                Cancel Journey
              </ActionButton>
            )}
          </div>

          {currentMember?.status === "ARRIVED" && (
            <p className="mt-3 text-sm text-indigo-300">
              You've arrived at the destination.
            </p>
          )}

          {currentMember?.status === "LEFT" && (
            <p className="mt-3 text-sm text-slate-400">
              You've left this journey.
            </p>
          )}

          {currentMember?.status === "DECLINED" && (
            <p className="mt-3 text-sm text-rose-300">
              You've declined this invitation.
            </p>
          )}
        </section>
      )}

      {/* Finished journey */}

      {isFinished && (
        <div className="rounded-2xl border border-white/5 bg-[#0D1524] p-5 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-indigo-400" />

          <h2 className="font-semibold">
            Journey {journey.status.toLowerCase()}
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            This journey is no longer active.
          </p>
        </div>
      )}

      {/* Back button */}

      <div className="text-center">
        <button
          onClick={() => navigate("/journeys")}
          className="text-sm text-slate-400 transition hover:text-white"
        >
          Back to all journeys
        </button>
      </div>
    </div>
  );
};

export default JourneyDetails;
