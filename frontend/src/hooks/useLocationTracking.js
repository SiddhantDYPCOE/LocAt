
import { useCallback, useEffect, useRef, useState } from "react";

import { connectSocket } from "../socket/socket.js";

const useLocationTracking = () => {
  const watchIdRef = useRef(null);
  const shareIdRef = useRef(null);
  const socketRef = useRef(null);

  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [error, setError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  // Start GPS tracking
  const startTracking = useCallback(async (shareId) => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return false;
    }

    if (!shareId) {
      setError("Location share ID is required");
      return false;
    }

    // Prevent duplicate GPS watchers
    if (watchIdRef.current !== null) {
      return false;
    }

    setError("");
    shareIdRef.current = shareId;

    try {
      const socket = connectSocket();
      socketRef.current = socket;

      if (!socket.connected) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            socket.off("connect", handleConnect);
            socket.off("connect_error", handleError);
            reject(new Error("Unable to connect to location server"));
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

      setSocketConnected(true);

      // Request permission and get initial location
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

      const initialLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed: position.coords.speed,
        heading: position.coords.heading,
        accuracy: position.coords.accuracy
      };

      // Join authorized location room
      const joinResponse = await new Promise((resolve, reject) => {
        socket.emit("location:join", { shareId }, (response) => {
          if (!response?.success) {
            reject(new Error(response?.message || "Unable to join location room"));
            return;
          }

          resolve(response);
        });
      });

      // GPS updates are sent only after successful room join
      const emitLocation = (location) => {
        socket.emit(
          "location:update",
          {
            shareId,
            ...location
          },
          (response) => {
            if (!response?.success) {
              console.error("Location update rejected:", response?.message);
              setError(response?.message || "Location update failed");
            }
          }
        );
      };

      setCurrentLocation(initialLocation);
      emitLocation(initialLocation);

      // Start watching GPS changes
      watchIdRef.current = navigator.geolocation.watchPosition(
        (newPosition) => {
          const location = {
            latitude: newPosition.coords.latitude,
            longitude: newPosition.coords.longitude,
            speed: newPosition.coords.speed,
            heading: newPosition.coords.heading,
            accuracy: newPosition.coords.accuracy
          };

          setCurrentLocation(location);
          emitLocation(location);
        },
        (gpsError) => {
          console.error("GPS tracking error:", gpsError);
          setError(gpsError.message || "Unable to track your location");
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

      setError(err.message || "Unable to start location tracking");

      shareIdRef.current = null;
      return false;
    }
  }, []);

  // Stop GPS tracking
  const stopTracking = useCallback((notifyServer = true) => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const socket = socketRef.current;
    const shareId = shareIdRef.current;

    if (socket && shareId) {
      if (notifyServer) {
        socket.emit("location:stop", { shareId }, (response) => {
          if (!response?.success) {
            console.error("Stop location error:", response?.message);
          }
        });
      } else {
        socket.emit("location:leave", { shareId });
      }
    }

    shareIdRef.current = null;

    setIsTracking(false);
    setCurrentLocation(null);
    setError("");
  }, []);

  // Monitor socket connection
  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    setSocketConnected(socket.connected);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  // Cleanup GPS watcher when component unmounts
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
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
