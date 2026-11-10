
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
  const { isAuthenticated, user } = useAuth();

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

  // ==========================================
  // UPDATE A SHARE IN LOCAL STATE
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
  // FETCH ACTIVE LOCATION SHARES
  // ==========================================

  const refreshActiveShares = useCallback(async () => {
    if (!isAuthenticated) return;

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
  // START INDIVIDUAL LOCATION SHARING
  // ==========================================

  const startSharing = useCallback(
    async (recipientIds, expiresInMinutes = 60) => {
      try {
        setError("");

        // Step 1: Create sharing session using REST API
        const response = await locationService.startShare(
          recipientIds,
          expiresInMinutes
        );

        const share = response.data;

        if (!share?.id) {
          throw new Error("Location share ID was not returned");
        }

        // Step 2: Start browser GPS and join Socket.IO room
        const started = await startTracking(share.id);

        if (!started) {
          // GPS/socket setup failed; end the server session
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

        // Step 3: Update local state
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
  // STOP INDIVIDUAL LOCATION SHARING
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
          // Owner stops through Socket.IO.
          // Backend updates database and broadcasts location:ended.
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
          // REST fallback for a disconnected socket.
          await locationService.stopShare(shareId);
        }

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
  // JOIN ANOTHER USER'S LOCATION ROOM
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

        // Synchronize the latest location immediately
        if (response.data) {
          updateShareLocally(shareId, response.data);
        }

        resolve(response.data);
      });
    });
  }, [updateShareLocally]);

  // ==========================================
  // SOCKET CONNECTION AND LOCATION EVENTS
  // ==========================================

  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = connectSocket();
    socketRef.current = socket;

    // Receive live GPS updates
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

    // Receive notification when owner stops sharing
    const handleLocationEnded = ({ shareId }) => {
      setActiveShares((prev) =>
        prev.filter((share) => share.id !== shareId)
      );

      if (trackingShareIdRef.current === shareId) {
        stopTracking(false);
        trackingShareIdRef.current = null;
      }
    };

    socket.on("location:updated", handleLocationUpdated);
    socket.on("location:ended", handleLocationEnded);

    // Fetch shares and join their rooms after connection
    const joinVisibleShares = async () => {
      const shares = await refreshActiveShares();

      if (!socket.connected || !shares?.length) return;

      for (const share of shares) {
        try {
          await joinLocationShare(share.id);
        } catch (err) {
          console.error(
            `Unable to join location share ${share.id}:`,
            err
          );
        }
      }
    };

    const handleConnect = () => {
      joinVisibleShares();
    };

    socket.on("connect", handleConnect);

    if (socket.connected) {
      joinVisibleShares();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("location:updated", handleLocationUpdated);
      socket.off("location:ended", handleLocationEnded);
    };
  }, [
    isAuthenticated,
    refreshActiveShares,
    joinLocationShare,
    updateShareLocally,
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
