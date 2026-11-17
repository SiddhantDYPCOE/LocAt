
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import { connectSocket } from "../socket/socket.js";

const useLocationTracking = () => {
  const watchIdRef = useRef(null);
  const shareIdRef = useRef(null);
  const socketRef = useRef(null);
  const latestLocationRef = useRef(null);

  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [error, setError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  // ==========================================
  // EMIT LOCATION TO BACKEND
  // ==========================================

  const emitLocation = useCallback((socket, shareId, location) => {
    if (!socket?.connected || !shareId || !location) {
      return;
    }

    socket.emit(
      "location:update",
      {
        shareId,
        ...location
      },
      (response) => {
        if (!response?.success) {
          console.error(
            "Location update rejected:",
            response?.message
          );

          setError(
            response?.message || "Location update failed"
          );
        }
      }
    );
  }, []);

  // ==========================================
  // JOIN LOCATION ROOM
  // ==========================================

  const joinLocationRoom = useCallback((socket, shareId) => {
    return new Promise((resolve, reject) => {
      socket.emit("location:join", { shareId }, (response) => {
        if (!response?.success) {
          reject(
            new Error(
              response?.message || "Unable to join location room"
            )
          );
          return;
        }

        resolve(response.data);
      });
    });
  }, []);

  // ==========================================
  // START GPS TRACKING
  // ==========================================

  const startTracking = useCallback(async (shareId) => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return false;
    }

    if (!shareId) {
      setError("Location share ID is required");
      return false;
    }

    if (watchIdRef.current !== null || shareIdRef.current) {
      setError("Location tracking is already active");
      return false;
    }

    setError("");

    const socket = connectSocket();
    socketRef.current = socket;

    try {
      // Step 1: Wait for Socket.IO connection

      if (!socket.connected) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            socket.off("connect", handleConnect);
            socket.off("connect_error", handleError);

            reject(
              new Error("Unable to connect to location server")
            );
          }, 10000);

          const handleConnect = () => {
            clearTimeout(timeout);
            socket.off("connect_error", handleError);
            resolve();
          };

          const handleError = (err) => {
            clearTimeout(timeout);
            socket.off("connect", handleConnect);
            reject(err);
          };

          socket.once("connect", handleConnect);
          socket.once("connect_error", handleError);
        });
      }

      // Step 2: Request initial GPS position

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      });

      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed: position.coords.speed,
        heading: position.coords.heading,
        accuracy: position.coords.accuracy
      };

      // Step 3: Join authorized Socket.IO room

      await joinLocationRoom(socket, shareId);

      shareIdRef.current = shareId;
      latestLocationRef.current = location;

      // Step 4: Save and emit initial location

      setCurrentLocation(location);

      emitLocation(socket, shareId, location);

      // Step 5: Start continuous GPS tracking

      watchIdRef.current = navigator.geolocation.watchPosition(
        (newPosition) => {
          const updatedLocation = {
            latitude: newPosition.coords.latitude,
            longitude: newPosition.coords.longitude,
            speed: newPosition.coords.speed,
            heading: newPosition.coords.heading,
            accuracy: newPosition.coords.accuracy
          };

          latestLocationRef.current = updatedLocation;

          setCurrentLocation(updatedLocation);

          emitLocation(
            socketRef.current,
            shareIdRef.current,
            updatedLocation
          );
        },
        (gpsError) => {
          console.error("GPS tracking error:", gpsError);

          setError(
            gpsError.message || "Unable to track your location"
          );
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 15000
        }
      );

      setIsTracking(true);

      return true;

    } catch (err) {
      console.error("Start location tracking error:", err);

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      if (socket.connected) {
        socket.emit("location:leave", { shareId });
      }

      shareIdRef.current = null;
      latestLocationRef.current = null;

      setCurrentLocation(null);
      setIsTracking(false);
      setError(err.message || "Unable to start location tracking");

      return false;
    }
  }, [emitLocation, joinLocationRoom]);

  // ==========================================
  // STOP GPS TRACKING
  // ==========================================

  const stopTracking = useCallback((notifyServer = true) => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const socket = socketRef.current;
    const shareId = shareIdRef.current;

    if (socket?.connected && shareId) {
      if (notifyServer) {
        socket.emit("location:stop", { shareId }, (response) => {
          if (!response?.success) {
            console.error(
              "Stop location error:",
              response?.message
            );
          }
        });
      } else {
        socket.emit("location:leave", { shareId });
      }
    }

    shareIdRef.current = null;
    latestLocationRef.current = null;

    setIsTracking(false);
    setCurrentLocation(null);
    setError("");
  }, []);

  // ==========================================
  // SOCKET CONNECTION MONITOR
  // ==========================================

  useEffect(() => {
    const socket = connectSocket();

    socketRef.current = socket;

    const handleConnect = async () => {
      setSocketConnected(true);

      const shareId = shareIdRef.current;
      const latestLocation = latestLocationRef.current;

      // Rejoin room after reconnection
      if (shareId) {
        try {
          await joinLocationRoom(socket, shareId);

          // Send latest coordinates immediately
          if (latestLocation) {
            emitLocation(socket, shareId, latestLocation);
          }
        } catch (err) {
          console.error("Location room reconnection failed:", err);
          setError("Unable to reconnect location sharing");
        }
      }
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    setSocketConnected(socket.connected);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [emitLocation, joinLocationRoom]);

  // ==========================================
  // CLEANUP GPS WATCHER
  // ==========================================

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  return {
    isTracking,
    currentLocation,
    error,
    socketConnected,
    startTracking,
    stopTracking
  };
};

export default useLocationTracking;
