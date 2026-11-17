
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";

import { useAuth } from "./AuthContext.jsx";
import locationService from "../services/location.service.js";
import { connectSocket } from "../socket/socket.js";
import useLocationTracking from "../hooks/useLocationTracking.js";

const LocationContext = createContext(null);

export const LocationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const {
    isTracking,
    currentLocation,
    error: trackingError,
    socketConnected,
    startTracking,
    stopTracking
  } = useLocationTracking();

  const [activeShares, setActiveShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const socketRef = useRef(null);
  const trackingShareIdRef = useRef(null);
  const joinedSharesRef = useRef(new Set());

  // ==========================================
  // UPDATE SHARE LOCALLY
  // ==========================================

  const updateShareLocally = useCallback((shareId, updates) => {
    setActiveShares((prev) =>
      prev.map((share) =>
        share.id === shareId
          ? { ...share, ...updates }
          : share
      )
    );
  }, []);

  // ==========================================
  // FETCH ACTIVE SHARES
  // ==========================================

  const refreshActiveShares = useCallback(async () => {
    if (!isAuthenticated) return [];

    try {
      setLoading(true);
      setError("");

      const response = await locationService.getActiveShares();
      const shares = response.data || [];

      setActiveShares(shares);

      return shares;
    } catch (err) {
      console.error("Fetch location shares error:", err);

      setError(
        err.response?.data?.message ||
        "Unable to fetch active location shares"
      );

      return [];
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // ==========================================
  // JOIN LOCATION ROOM
  // ==========================================

  const joinLocationShare = useCallback(async (shareId) => {
    const socket = socketRef.current;

    if (!socket?.connected) {
      throw new Error("Socket is not connected");
    }

    return new Promise((resolve, reject) => {
      socket.emit("location:join", { shareId }, (response) => {
        if (!response?.success) {
          reject(
            new Error(response?.message || "Unable to join location")
          );
          return;
        }

        joinedSharesRef.current.add(shareId);

        if (response.data) {
          updateShareLocally(shareId, response.data);
        }

        resolve(response.data);
      });
    });
  }, [updateShareLocally]);

  // ==========================================
  // JOIN ALL VISIBLE SHARES
  // ==========================================

  const joinVisibleShares = useCallback(async () => {
    const socket = socketRef.current;

    if (!socket?.connected) return;

    const shares = await refreshActiveShares();

    if (!socket.connected) return;

    for (const share of shares) {
      if (joinedSharesRef.current.has(share.id)) continue;

      try {
        await joinLocationShare(share.id);
      } catch (err) {
        console.error(
          `Unable to join location share ${share.id}:`,
          err
        );
      }
    }

    // Remove IDs which are no longer active
    const activeIds = new Set(shares.map((share) => share.id));

    joinedSharesRef.current.forEach((shareId) => {
      if (!activeIds.has(shareId)) {
        joinedSharesRef.current.delete(shareId);
      }
    });
  }, [refreshActiveShares, joinLocationShare]);

  // ==========================================
  // START SHARING
  // ==========================================

  const startSharing = useCallback(
    async (recipientIds, expiresInMinutes = 60) => {
      try {
        setError("");

        const response = await locationService.startShare(
          recipientIds,
          expiresInMinutes
        );

        const share = response.data;

        if (!share?.id) {
          throw new Error("Location share ID was not returned");
        }

        const started = await startTracking(share.id);

        if (!started) {
          try {
            await locationService.stopShare(share.id);
          } catch (stopError) {
            console.error("Unable to clean up failed share:", stopError);
          }

          throw new Error(
            trackingError || "Unable to start location tracking"
          );
        }

        trackingShareIdRef.current = share.id;
        joinedSharesRef.current.add(share.id);

        setActiveShares((prev) => [
          share,
          ...prev.filter((item) => item.id !== share.id)
        ]);

        return share;
      } catch (err) {
        console.error("Start location sharing error:", err);

        setError(
          err.response?.data?.message ||
          err.message ||
          "Unable to start location sharing"
        );

        throw err;
      }
    },
    [startTracking, trackingError]
  );

  // ==========================================
  // STOP SHARING
  // ==========================================

  const stopSharing = useCallback(
    async (shareId) => {
      try {
        setError("");

        const socket = socketRef.current;

        if (
          trackingShareIdRef.current === shareId &&
          socket?.connected
        ) {
          await new Promise((resolve, reject) => {
            socket.emit("location:stop", { shareId }, (response) => {
              if (!response?.success) {
                reject(
                  new Error(response?.message || "Unable to stop sharing")
                );
                return;
              }

              resolve(response);
            });
          });

          stopTracking(false);
          trackingShareIdRef.current = null;
        } else {
          await locationService.stopShare(shareId);
        }

        joinedSharesRef.current.delete(shareId);

        setActiveShares((prev) =>
          prev.filter((share) => share.id !== shareId)
        );
      } catch (err) {
        console.error("Stop location sharing error:", err);

        setError(
          err.response?.data?.message ||
          err.message ||
          "Unable to stop location sharing"
        );

        throw err;
      }
    },
    [stopTracking]
  );

  // ==========================================
  // SOCKET EVENTS
  // ==========================================

  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = connectSocket();
    socketRef.current = socket;

    const handleLocationUpdated = (location) => {
      updateShareLocally(location.shareId, {
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed,
        heading: location.heading,
        accuracy: location.accuracy,
        lastUpdatedAt: location.lastUpdatedAt
      });
    };

    const handleLocationStarted = async ({ shareId }) => {
      console.log("NEW LOCATION SHARE:", shareId);

      // Fetch the newly created share and join its room
      try {
        const response = await locationService.getActiveShares();
        const shares = response.data || [];

        setActiveShares(shares);

        const newShare = shares.find(
          (share) => share.id === shareId
        );

        if (newShare && socket.connected) {
          await joinLocationShare(shareId);
        }
      } catch (err) {
        console.error("Unable to join newly started share:", err);
      }
    };

    const handleLocationEnded = ({ shareId }) => {
      console.log("LOCATION ENDED EVENT RECEIVED:", shareId);

      joinedSharesRef.current.delete(shareId);

      setActiveShares((prev) =>
        prev.filter((share) => share.id !== shareId)
      );

      if (trackingShareIdRef.current === shareId) {
        stopTracking(false);
        trackingShareIdRef.current = null;
      }
    };

    const handleConnect = () => {
      joinedSharesRef.current.clear();
      joinVisibleShares();
    };

    socket.on("location:updated", handleLocationUpdated);
    socket.on("location:share-started", handleLocationStarted);
    socket.on("location:ended", handleLocationEnded);
    socket.on("connect", handleConnect);

    if (socket.connected) {
      joinVisibleShares();
    }

    return () => {
      socket.off("location:updated", handleLocationUpdated);
      socket.off("location:share-started", handleLocationStarted);
      socket.off("location:ended", handleLocationEnded);
      socket.off("connect", handleConnect);
    };
  }, [
    isAuthenticated,
    updateShareLocally,
    joinLocationShare,
    joinVisibleShares,
    stopTracking
  ]);

  // ==========================================
  // RESET ON LOGOUT
  // ==========================================

  useEffect(() => {
    if (isAuthenticated) return;

    if (trackingShareIdRef.current) {
      stopTracking(false);
      trackingShareIdRef.current = null;
    }

    joinedSharesRef.current.clear();
    socketRef.current = null;

    setActiveShares([]);
    setError("");
  }, [isAuthenticated, stopTracking]);

  const value = {
    activeShares,
    loading,
    error: error || trackingError,
    isTracking,
    currentLocation,
    socketConnected,

    startSharing,
    stopSharing,
    joinLocationShare,
    refreshActiveShares
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);

  if (!context) {
    throw new Error(
      "useLocation must be used inside LocationProvider"
    );
  }

  return context;
};
