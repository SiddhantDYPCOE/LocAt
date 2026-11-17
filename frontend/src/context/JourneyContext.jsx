
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";

import { useAuth } from "./AuthContext.jsx";

import journeyService from "../services/journey.service.js";
import { connectSocket } from "../socket/socket.js";

const JourneyContext = createContext(null);

const extractData = (response) => {
  const payload = response?.data ?? response;
  return payload?.data ?? payload;
};

const extractJourney = (response) => {
  const data = extractData(response);
  return data?.journey ?? data;
};

const extractJourneys = (response) => {
  const data = extractData(response);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.journeys)) return data.journeys;

  return [];
};

export const JourneyProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [journeys, setJourneys] = useState([]);
  const [selectedJourney, setSelectedJourney] = useState(null);

  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const joinedJourneyIdsRef = useRef(new Set());

  // Keep a journey updated in both the list and selected journey.
  const updateJourney = useCallback((updatedJourney) => {
    if (!updatedJourney?.id) return;

    setJourneys((previous) => {
      const exists = previous.some(
        (journey) => journey.id === updatedJourney.id
      );

      if (!exists) {
        return [updatedJourney, ...previous];
      }

      return previous.map((journey) =>
        journey.id === updatedJourney.id
          ? { ...journey, ...updatedJourney }
          : journey
      );
    });

    setSelectedJourney((previous) =>
      previous?.id === updatedJourney.id
        ? { ...previous, ...updatedJourney }
        : previous
    );
  }, []);

  // Update a member's location in both journey states.
  const updateMemberLocation = useCallback((location) => {
    if (!location?.journeyId || !location?.userId) return;

    const updateMember = (journey) => {
      if (
        journey.id !== location.journeyId ||
        !Array.isArray(journey.members)
      ) {
        return journey;
      }

      return {
        ...journey,
        members: journey.members.map((member) =>
          member.userId === location.userId
            ? {
                ...member,
                ...location,
                user: location.user || member.user
              }
            : member
        )
      };
    };

    setJourneys((previous) => previous.map(updateMember));

    setSelectedJourney((previous) =>
      previous ? updateMember(previous) : previous
    );
  }, []);

  // Clear a member's location after they stop sharing.
  const clearMemberLocation = useCallback((payload) => {
    if (!payload?.journeyId || !payload?.userId) return;

    const updateMember = (journey) => {
      if (
        journey.id !== payload.journeyId ||
        !Array.isArray(journey.members)
      ) {
        return journey;
      }

      return {
        ...journey,
        members: journey.members.map((member) =>
          member.userId === payload.userId
            ? {
                ...member,
                currentLat: null,
                currentLng: null,
                speed: null,
                heading: null,
                accuracy: null,
                lastLocationAt: null
              }
            : member
        )
      };
    };

    setJourneys((previous) => previous.map(updateMember));

    setSelectedJourney((previous) =>
      previous ? updateMember(previous) : previous
    );
  }, []);

  // Synchronize a member's status across all local journey states.
  const updateMemberStatus = useCallback((payload) => {
    if (
      !payload?.journeyId ||
      !payload?.userId ||
      !payload?.status
    ) {
      return;
    }

    const updateMember = (journey) => {
      if (
        journey.id !== payload.journeyId ||
        !Array.isArray(journey.members)
      ) {
        return journey;
      }

      return {
        ...journey,
        members: journey.members.map((member) =>
          member.userId === payload.userId
            ? {
                ...member,
                status: payload.status,
                joinedAt: payload.joinedAt,
                departedAt: payload.departedAt,
                arrivedAt: payload.arrivedAt,
                leftAt: payload.leftAt
              }
            : member
        )
      };
    };

    setJourneys((previous) => previous.map(updateMember));

    setSelectedJourney((previous) => {
      if (!previous) return previous;

      const updated = updateMember(previous);

      if (payload.journeyStatus) {
        return {
          ...updated,
          status: payload.journeyStatus
        };
      }

      return updated;
    });

    if (
      payload.status === "ARRIVED" ||
      payload.status === "LEFT"
    ) {
      clearMemberLocation(payload);
    }
  }, [clearMemberLocation]);

  // Fetch all journeys belonging to the current user.
  const refreshJourneys = useCallback(async () => {
    if (!isAuthenticated) return [];

    setLoading(true);
    setError(null);

    try {
      const response = await journeyService.getMyJourneys();
      const fetchedJourneys = extractJourneys(response);

      setJourneys(fetchedJourneys);

      return fetchedJourneys;
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Unable to load journeys";

      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Join a journey's Socket.IO room.
  const joinJourneyRoom = useCallback(async (journeyId) => {
    const socket = socketRef.current;

    if (!socket?.connected) return false;

    if (joinedJourneyIdsRef.current.has(journeyId)) {
      return true;
    }

    try {
      const response = await new Promise((resolve, reject) => {
        socket.timeout(10000).emit(
          "journey:join",
          { journeyId },
          (timeoutError, result) => {
            if (timeoutError) {
              reject(new Error("Joining journey timed out"));
              return;
            }

            resolve(result);
          }
        );
      });

      if (!response?.success) {
        throw new Error(
          response?.message || "Unable to join journey"
        );
      }

      joinedJourneyIdsRef.current.add(journeyId);

      if (response.data) {
        updateJourney(response.data);
      }

      return true;
    } catch (err) {
      console.error("Journey room join failed:", err);
      return false;
    }
  }, [updateJourney]);

  // Leave a journey's Socket.IO room.
  const leaveJourneyRoom = useCallback((journeyId) => {
    const socket = socketRef.current;

    if (socket?.connected) {
      socket.emit("journey:leave", { journeyId });
    }

    joinedJourneyIdsRef.current.delete(journeyId);
  }, []);

  // Ask the backend to broadcast the current database membership status.
  const syncMemberStatus = useCallback(async (journeyId) => {
    const socket = socketRef.current;

    if (!socket?.connected) {
      console.warn(
        "Cannot synchronize journey status: socket disconnected"
      );
      return false;
    }

    if (!joinedJourneyIdsRef.current.has(journeyId)) {
      const joined = await joinJourneyRoom(journeyId);

      if (!joined) return false;
    }

    try {
      const response = await new Promise((resolve, reject) => {
        socket.timeout(10000).emit(
          "journey:member-status-sync",
          { journeyId },
          (timeoutError, result) => {
            if (timeoutError) {
              reject(new Error("Member status sync timed out"));
              return;
            }

            resolve(result);
          }
        );
      });

      if (!response?.success) {
        throw new Error(
          response?.message || "Unable to synchronize member status"
        );
      }

      return true;
    } catch (err) {
      console.error("Journey status synchronization failed:", err);
      return false;
    }
  }, [joinJourneyRoom]);

  // Connect to the shared Socket.IO connection after authentication.
  useEffect(() => {
    if (!isAuthenticated) {
      socketRef.current = null;
      joinedJourneyIdsRef.current.clear();

      setSocketConnected(false);
      setJourneys([]);
      setSelectedJourney(null);
      setError(null);

      return;
    }

    const socket = connectSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      setSocketConnected(true);
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      joinedJourneyIdsRef.current.clear();
    };

    const handleMemberLocation = (location) => {
      updateMemberLocation(location);
    };

    const handleMemberLocationStopped = (payload) => {
      clearMemberLocation(payload);
    };

    const handleMemberStatusUpdated = (payload) => {
      updateMemberStatus(payload);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    socket.on(
      "journey:member-location",
      handleMemberLocation
    );

    socket.on(
      "journey:member-location-stopped",
      handleMemberLocationStopped
    );

    socket.on(
      "journey:member-status-updated",
      handleMemberStatusUpdated
    );

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);

      socket.off(
        "journey:member-location",
        handleMemberLocation
      );

      socket.off(
        "journey:member-location-stopped",
        handleMemberLocationStopped
      );

      socket.off(
        "journey:member-status-updated",
        handleMemberStatusUpdated
      );
    };
  }, [
    isAuthenticated,
    updateMemberLocation,
    clearMemberLocation,
    updateMemberStatus
  ]);

  // Load journeys when the user becomes authenticated.
  useEffect(() => {
    if (!isAuthenticated) return;

    refreshJourneys().catch(() => {});
  }, [isAuthenticated, refreshJourneys]);

  // Rejoin accepted journeys after connecting or reconnecting.
  useEffect(() => {
    if (!socketConnected) return;

    journeys.forEach((journey) => {
      const isMember = journey.members?.some(
        (member) =>
          member.status === "ACCEPTED" ||
          member.status === "ARRIVED"
      );

      if (isMember) {
        joinJourneyRoom(journey.id);
      }
    });
  }, [journeys, socketConnected, joinJourneyRoom]);

  // Create a new journey.
  const createJourney = useCallback(async (journeyData) => {
    setError(null);

    try {
      const response = await journeyService.createJourney(
        journeyData
      );

      const journey = extractJourney(response);

      if (!journey?.id) {
        throw new Error("Invalid journey response from server");
      }

      updateJourney(journey);

      if (socketRef.current?.connected) {
        await joinJourneyRoom(journey.id);
      }

      return journey;
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to create journey"
      );
      throw err;
    }
  }, [updateJourney, joinJourneyRoom]);

  // Fetch details of a particular journey.
  const getJourneyDetails = useCallback(async (journeyId) => {
    setDetailsLoading(true);
    setError(null);

    try {
      const response = await journeyService.getJourneyDetails(
        journeyId
      );

      const journey = extractJourney(response);

      if (!journey?.id) {
        throw new Error("Invalid journey details response");
      }

      setSelectedJourney(journey);
      updateJourney(journey);

      const isMember = journey.members?.some(
        (member) =>
          member.status === "ACCEPTED" ||
          member.status === "ARRIVED"
      );

      if (isMember) {
        await joinJourneyRoom(journeyId);
      }

      return journey;
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to load journey details"
      );
      throw err;
    } finally {
      setDetailsLoading(false);
    }
  }, [updateJourney, joinJourneyRoom]);

  // Accept or decline a journey invitation.
  const respondToInvitation = useCallback(async (
    journeyId,
    status
  ) => {
    setError(null);

    try {
      const response = await journeyService.respondToInvitation(
        journeyId,
        status
      );

      const journey = extractJourney(response);
      updateJourney(journey);

      if (status === "ACCEPTED") {
        await joinJourneyRoom(journeyId);
      } else {
        leaveJourneyRoom(journeyId);
      }

      return journey;
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to respond to invitation"
      );
      throw err;
    }
  }, [updateJourney, joinJourneyRoom, leaveJourneyRoom]);

  // Shared helper for journey actions that return updated journey data.
  const performJourneyAction = useCallback(async (
    action,
    journeyId,
    options = {}
  ) => {
    const {
      shouldLeaveRoom = false,
      shouldSyncStatus = false
    } = options;

    setError(null);

    try {
      const response = await action(journeyId);
      const journey = extractJourney(response);

      updateJourney(journey);

      if (shouldSyncStatus) {
        await syncMemberStatus(journeyId);
      }

      if (shouldLeaveRoom) {
        leaveJourneyRoom(journeyId);
      }

      return journey;
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Journey action failed"
      );
      throw err;
    }
  }, [updateJourney, leaveJourneyRoom, syncMemberStatus]);

  const updateOrigin = useCallback((journeyId, originData) => {
    return performJourneyAction(
      (id) => journeyService.updateOrigin(id, originData),
      journeyId
    );
  }, [performJourneyAction]);

  const startJourney = useCallback((journeyId) => {
    return performJourneyAction(
      journeyService.startJourney,
      journeyId
    );
  }, [performJourneyAction]);

  const markArrived = useCallback((journeyId) => {
    return performJourneyAction(
      journeyService.markArrived,
      journeyId,
      { shouldSyncStatus: true }
    );
  }, [performJourneyAction]);

  const leaveJourney = useCallback((journeyId) => {
    return performJourneyAction(
      journeyService.leaveJourney,
      journeyId,
      {
        shouldSyncStatus: true,
        shouldLeaveRoom: true
      }
    );
  }, [performJourneyAction]);

  const completeJourney = useCallback((journeyId) => {
    return performJourneyAction(
      journeyService.completeJourney,
      journeyId,
      { shouldLeaveRoom: true }
    );
  }, [performJourneyAction]);

  const cancelJourney = useCallback((journeyId) => {
    return performJourneyAction(
      journeyService.cancelJourney,
      journeyId,
      { shouldLeaveRoom: true }
    );
  }, [performJourneyAction]);

  const value = {
    journeys,
    selectedJourney,

    loading,
    detailsLoading,
    socketConnected,
    error,

    setSelectedJourney,

    refreshJourneys,
    createJourney,
    getJourneyDetails,
    respondToInvitation,

    updateOrigin,
    startJourney,
    markArrived,
    leaveJourney,
    completeJourney,
    cancelJourney,

    joinJourneyRoom,
    leaveJourneyRoom
  };

  return (
    <JourneyContext.Provider value={value}>
      {children}
    </JourneyContext.Provider>
  );
};

export const useJourneys = () => {
  const context = useContext(JourneyContext);

  if (!context) {
    throw new Error("useJourneys must be used inside JourneyProvider");
  }

  return context;
};
