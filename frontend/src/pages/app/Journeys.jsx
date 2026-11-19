
import { useEffect, useState } from "react";

import {
  MapPin,
  Navigation,
  Users,
  Plus,
  X,
  Loader2,
  CalendarDays,
  CheckCircle2,
  Route
} from "lucide-react";

import { useConnections } from "../../context/ConnectionContext.jsx";
import { useJourneys } from "../../context/JourneyContext.jsx";
import { useNavigate } from "react-router-dom";

const getUser = (item) =>
  item?.user || item?.recipient || item?.sender || item;

const formatStatus = (status) => {
  const styles = {
    PLANNED: "bg-amber-500/10 text-amber-800",
    ACTIVE: "bg-emerald-500/10 text-green-700",
    COMPLETED: "bg-indigo-500/10 text-indigo-700",
    CANCELLED: "bg-rose-500/10 text-red-700",
    INVITED: "bg-amber-500/10 text-amber-800",
    ACCEPTED: "bg-emerald-500/10 text-green-700",
    DECLINED: "bg-rose-500/10 text-red-700",
    ARRIVED: "bg-indigo-500/10 text-indigo-700",
    LEFT: "bg-slate-500/10 text-[#111B21]"
  };

  return styles[status] || "bg-[#F7F9F8] text-[#111B21]";
};

const Avatar = ({ user }) => (
  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20 text-indigo-700">
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


const Journeys = () => {
  const navigate = useNavigate();

  const { connections } = useConnections();
  const {
    journeys,
    loading,
    createJourney
  } = useJourneys();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [journeyName, setJourneyName] = useState("");

  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationResults, setDestinationResults] = useState([]);
  const [destination, setDestination] = useState(null);
  const [searchingDestination, setSearchingDestination] = useState(false);

  const [origin, setOrigin] = useState(null);
  const [gettingOrigin, setGettingOrigin] = useState(false);

  const [selectedUsers, setSelectedUsers] = useState([]);

  const [creating, setCreating] = useState(false);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const acceptedConnections = (connections || [])
    .map(getUser)
    .filter((user) => user?.id);

  // Automatically search for destinations as the user types.
  useEffect(() => {
    const query = destinationQuery.trim();

    if (query.length < 2 || destination) {
      setDestinationResults([]);
      setSearchingDestination(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      setSearchingDestination(true);

      try {
        const params = new URLSearchParams({
          q: query,
          limit: "6",
          lang: "en"
        });

        const response = await fetch(
          `https://photon.komoot.io/api/?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Unable to search for places.");
        }

        const result = await response.json();

        if (!cancelled) {
          setDestinationResults(result.features || []);
          setPageError("");
        }
      } catch (err) {
        if (!cancelled && err.name !== "AbortError") {
          setDestinationResults([]);
          setPageError("Unable to search for destinations.");
        }
      } finally {
        if (!cancelled) {
          setSearchingDestination(false);
        }
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [destinationQuery, destination]);

  const selectDestination = (place) => {
    const properties = place.properties || {};
    const coordinates = place.geometry?.coordinates || [];

    const [longitude, latitude] = coordinates;

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      setPageError("Invalid destination coordinates. Select another place.");
      return;
    }

    const name =
      properties.name ||
      properties.street ||
      properties.city ||
      "Selected destination";

    const address = [
      properties.housenumber,
      properties.street,
      properties.city,
      properties.state,
      properties.country
    ]
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .join(", ");

    setDestination({
      name,
      address: address || name,
      latitude,
      longitude
    });

    setDestinationQuery(address || name);
    setDestinationResults([]);
    setPageError("");
  };

  const getCurrentOrigin = () => {
    if (!navigator.geolocation) {
      setPageError("Geolocation is not supported by this browser.");
      return;
    }

    setGettingOrigin(true);
    setPageError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        let name = "Current location";
        let address = "Current location";

        try {
          const params = new URLSearchParams({
            format: "jsonv2",
            lat: String(latitude),
            lon: String(longitude)
          });

          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?${params.toString()}`
          );

          if (response.ok) {
            const result = await response.json();

            address = result.display_name || address;

            name =
              result.name ||
              result.address?.suburb ||
              result.address?.city ||
              result.address?.town ||
              name;
          }
        } catch {
          // Coordinates remain usable if reverse geocoding fails.
        }

        setOrigin({
          name,
          address,
          latitude,
          longitude
        });

        setGettingOrigin(false);
      },
      (error) => {
        setPageError(
          error.message || "Unable to access your current location."
        );
        setGettingOrigin(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  const toggleUser = (userId) => {
    setSelectedUsers((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
  };

  const resetForm = () => {
    setJourneyName("");
    setDestinationQuery("");
    setDestinationResults([]);
    setDestination(null);
    setOrigin(null);
    setSelectedUsers([]);
    setPageError("");
  };

  const handleCreateJourney = async (event) => {
    event.preventDefault();

    setPageError("");
    setSuccessMessage("");

    if (!destination) {
      setPageError("Please select a destination from the suggestions.");
      return;
    }

    if (!origin) {
      setPageError("Please set your starting location.");
      return;
    }

    setCreating(true);

    try {
      await createJourney({
        name: journeyName.trim() || null,

        destinationName: destination.name,
        destinationAddress: destination.address,
        destinationLat: destination.latitude,
        destinationLng: destination.longitude,

        originName: origin.name,
        originAddress: origin.address,
        originLat: origin.latitude,
        originLng: origin.longitude,

        invitedUserIds: selectedUsers
      });

      resetForm();
      setShowCreateForm(false);
      setSuccessMessage("Your journey has been created.");
    } catch (err) {
      setPageError(
        err.response?.data?.message ||
        err.message ||
        "Unable to create journey."
      );
    } finally {
      setCreating(false);
    }
  };

  const renderJourneyCard = (journey) => (
  <div
    key={journey.id}
    role="button"
    tabIndex={0}
    onClick={() => navigate(`/journeys/${journey.id}`)}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        navigate(`/journeys/${journey.id}`);
      }
    }}
    className="cursor-pointer rounded-2xl border border-[#E9EDEF] bg-white p-5 transition duration-200 hover:border-indigo-500/40 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
  >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-[#111B21]">
            {journey.name || journey.destinationName}
          </h3>

          <p className="mt-1 text-sm text-[#667781]">
            Created by {journey.creator?.name || "You"}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${formatStatus(
            journey.status
          )}`}
        >
          {journey.status}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex items-start gap-3">
          <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />

          <div className="min-w-0">
            <p className="text-xs text-[#8696A0]">Destination</p>

            <p className="text-sm text-[#111B21]">
              {journey.destinationName}
            </p>

            {journey.destinationAddress && (
              <p className="mt-1 text-xs text-[#8696A0]">
                {journey.destinationAddress}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />

          <div>
            <p className="text-xs text-[#8696A0]">
              Participants
            </p>

            <p className="text-sm text-[#111B21]">
              {journey.members?.length || 0} member(s)
            </p>
          </div>
        </div>
      </div>

      {journey.members?.length > 0 && (
        <div className="mt-5 border-t border-[#E9EDEF] pt-4">
          <p className="mb-3 text-xs font-medium text-[#8696A0]">
            JOURNEY MEMBERS
          </p>

          <div className="space-y-3">
            {journey.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar user={member.user} />

                  <div className="min-w-0">
                    <p className="truncate text-sm text-[#111B21]">
                      {member.user?.name || "Unknown user"}
                    </p>

                    <p className="truncate text-xs text-[#8696A0]">
                      @{member.user?.username || "unknown"}
                    </p>
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${formatStatus(
                    member.status
                  )}`}
                >
                  {member.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-[#8696A0]">
        <CalendarDays className="h-4 w-4" />
        Created {new Date(journey.createdAt).toLocaleDateString()}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-700">
            TRAVEL TOGETHER
          </p>

          <h1 className="mt-1 text-3xl font-bold text-[#111B21]">
            Journeys
          </h1>

          <p className="mt-2 text-sm text-[#667781]">
            Create journeys, invite connections, and share your live location.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setPageError("");
            setSuccessMessage("");
            setShowCreateForm((current) => !current);
          }}
          className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-[#111B21] transition hover:bg-indigo-600"
        >
          {showCreateForm ? (
            <X className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}

          {showCreateForm ? "Close" : "Create journey"}
        </button>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-5 w-5" />
          {successMessage}
        </div>
      )}

      {showCreateForm && (
        <form
          onSubmit={handleCreateJourney}
          className="space-y-6 rounded-2xl border border-[#D9E1E5] bg-white p-5 sm:p-6"
        >
          <div>
            <h2 className="text-xl font-semibold text-[#111B21]">
              Plan a new journey
            </h2>

            <p className="mt-1 text-sm text-[#667781]">
              Choose your destination, starting point, and invite people.
            </p>
          </div>

          {/* Journey name */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[#111B21]">
              Journey name
              <span className="ml-1 text-[#8696A0]">(optional)</span>
            </label>

            <input
              value={journeyName}
              onChange={(event) => setJourneyName(event.target.value)}
              maxLength={80}
              placeholder="e.g. Weekend trip"
              className="w-full rounded-xl border border-[#D9E1E5] bg-white px-4 py-3 text-[#111B21] outline-none transition placeholder:text-[#8696A0] focus:border-indigo-500"
            />
          </div>

          {/* Destination search */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[#111B21]">
              Destination
            </label>

            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8696A0]" />

              <input
                value={destinationQuery}
                onChange={(event) => {
                  setDestinationQuery(event.target.value);
                  setDestination(null);
                  setDestinationResults([]);
                  setPageError("");
                }}
                placeholder="Search places, cities, addresses..."
                autoComplete="off"
                className="w-full rounded-xl border border-[#D9E1E5] bg-white py-3 pl-10 pr-11 text-[#111B21] outline-none placeholder:text-[#8696A0] focus:border-indigo-500"
              />

              {searchingDestination && (
                <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-indigo-700" />
              )}
            </div>

            {destinationQuery.trim().length > 0 &&
              destinationQuery.trim().length < 2 && (
                <p className="mt-2 text-xs text-[#8696A0]">
                  Type at least 2 characters to search.
                </p>
              )}

            {destinationResults.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-xl border border-[#D9E1E5] bg-white">
                {destinationResults.map((place) => {
                  const properties = place.properties || {};

                  const title =
                    properties.name ||
                    properties.street ||
                    properties.city ||
                    "Unknown place";

                  const subtitle = [
                    properties.city,
                    properties.state,
                    properties.country
                  ]
                    .filter(Boolean)
                    .filter(
                      (value, index, array) =>
                        array.indexOf(value) === index
                    )
                    .join(", ");

                  return (
                    <button
                      type="button"
                      key={`${properties.osm_type}-${properties.osm_id}`}
                      onClick={() => selectDestination(place)}
                      className="flex w-full items-start gap-3 border-b border-[#E9EDEF] p-3 text-left last:border-0 hover:bg-[#F7F9F8]"
                    >
                      <MapPin className="mt-1 h-4 w-4 shrink-0 text-indigo-700" />

                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#111B21]">
                          {title}
                        </p>

                        {subtitle && (
                          <p className="mt-1 text-xs text-[#8696A0]">
                            {subtitle}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {destination && (
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />

                <div className="min-w-0">
                  <p className="text-sm font-medium text-green-700">
                    {destination.name}
                  </p>

                  <p className="mt-1 text-xs text-[#667781]">
                    {destination.address}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Starting location */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[#111B21]">
              Starting location
            </label>

            <button
              type="button"
              onClick={getCurrentOrigin}
              disabled={gettingOrigin}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm font-medium text-indigo-700 transition hover:bg-indigo-500/20 disabled:opacity-50"
            >
              {gettingOrigin ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Navigation className="h-5 w-5" />
              )}

              {gettingOrigin
                ? "Getting your location..."
                : "Use my current location"}
            </button>

            {origin && (
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />

                <div className="min-w-0">
                  <p className="text-sm font-medium text-green-700">
                    {origin.name}
                  </p>

                  <p className="mt-1 text-xs text-[#667781]">
                    {origin.address}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Invite connections */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <label className="text-sm font-medium text-[#111B21]">
                  Invite connections
                </label>

                <p className="mt-1 text-xs text-[#8696A0]">
                  Select the people you want to travel with.
                </p>
              </div>

              <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs text-indigo-700">
                {selectedUsers.length} selected
              </span>
            </div>

            {acceptedConnections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#D9E1E5] p-5 text-center">
                <Users className="mx-auto mb-2 h-6 w-6 text-[#8696A0]" />

                <p className="text-sm text-[#667781]">
                  You don't have any connections yet.
                </p>
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {acceptedConnections.map((user) => {
                  const selected = selectedUsers.includes(user.id);

                  return (
                    <button
                      type="button"
                      key={user.id}
                      onClick={() => toggleUser(user.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-indigo-500/50 bg-indigo-500/10"
                          : "border-[#E9EDEF] bg-white hover:border-[#D9E1E5]"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar user={user} />

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#111B21]">
                            {user.name || "Unknown user"}
                          </p>

                          <p className="truncate text-xs text-[#8696A0]">
                            @{user.username || "unknown"}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          selected
                            ? "border-indigo-500 bg-indigo-500 text-[#111B21]"
                            : "border-slate-600"
                        }`}
                      >
                        {selected && (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {pageError && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-red-700">
              {pageError}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowCreateForm(false);
              }}
              className="rounded-xl border border-[#D9E1E5] px-5 py-3 text-sm font-medium text-[#111B21] transition hover:bg-[#F7F9F8]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={creating || gettingOrigin || searchingDestination}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-[#111B21] transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Route className="h-4 w-4" />
              )}

              {creating ? "Creating..." : "Create journey"}
            </button>
          </div>
        </form>
      )}

      {pageError && !showCreateForm && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {/* Existing journeys */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#111B21]">
            Your journeys
          </h2>

          <span className="text-sm text-[#8696A0]">
            {journeys.length} total
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-700" />
          </div>
        ) : journeys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D9E1E5] px-5 py-16 text-center">
            <Route className="mx-auto mb-4 h-10 w-10 text-[#8696A0]" />

            <h3 className="font-medium text-[#111B21]">
              No journeys yet
            </h3>

            <p className="mt-2 text-sm text-[#8696A0]">
              Create a journey and invite your connections to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {journeys.map(renderJourneyCard)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Journeys;
