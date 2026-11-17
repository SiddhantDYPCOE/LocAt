
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import { connectSocket } from "../socket/socket.js";

const useJourneyTracking = (journeyId) => {
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);

  const isTrackingRef = useRef(false);
  const journeyIdRef = useRef(journeyId);
  const latestLocationRef = useRef(null);
  const trackingSessionRef = useRef(0);

  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [error, setError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    journeyIdRef.current = journeyId;
  }, [journeyId]);

  // Wait until the shared socket is connected.
  const waitForConnection = useCallback(async (socket) => {
    if (socket.connected) return;

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Unable to connect to journey server"));
      }, 10000);

      const handleConnect = () => {
        cleanup();
        resolve();
      };

      const handleError = (err) => {
        cleanup();
        reject(err || new Error("Socket connection failed"));
      };

      const cleanup = () => {
        clearTimeout(timeout);
        socket.off("connect", handleConnect);
        socket.off("connect_error", handleError);
      };

      socket.once("connect", handleConnect);
      socket.once("connect_error", handleError);
    });
  }, []);

  // Join the journey room and verify authorization.
  const joinJourneyRoom = useCallback(async (socket, id) => {
    const response = await new Promise((resolve, reject) => {
      socket.timeout(10000).emit(
        "journey:join",
        { journeyId: id },
        (timeoutError, result) => {
          if (timeoutError) {
            reject(new Error("Journey room join timed out"));
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

    return response;
  }, []);

  // Send a GPS position to the backend.
  const sendLocation = useCallback(async (
    socket,
    id,
    location
  ) => {
    if (!socket?.connected) return false;

    const response = await new Promise((resolve, reject) => {
      socket.timeout(10000).emit(
        "journey:location-update",
        {
          journeyId: id,
          ...location
        },
        (timeoutError, result) => {
          if (timeoutError) {
            reject(new Error("Journey location update timed out"));
            return;
          }

          resolve(result);
        }
      );
    });

    if (!response?.success) {
      throw new Error(
        response?.message || "Journey location update failed"
      );
    }

    return true;
  }, []);

  // Stop the browser GPS watcher without disconnecting
  // the shared socket or leaving the journey room.
  const stopTracking = useCallback(() => {
    trackingSessionRef.current += 1;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const socket = socketRef.current;
    const activeJourneyId = journeyIdRef.current;

    // This event will be handled by the backend in the
    // next implementation step.
    if (socket?.connected && activeJourneyId) {
      socket.emit("journey:location-stop", {
        journeyId: activeJourneyId
      });
    }

    isTrackingRef.current = false;
    latestLocationRef.current = null;

    setIsTracking(false);
    setCurrentLocation(null);
    setError("");
  }, []);

  // Connect to the existing shared socket.
  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    const handleConnect = async () => {
      setSocketConnected(true);

      if (
        !isTrackingRef.current ||
        !journeyIdRef.current
      ) {
        return;
      }

      const session = trackingSessionRef.current;

      try {
        await joinJourneyRoom(
          socket,
          journeyIdRef.current
        );

        if (
          !isTrackingRef.current ||
          session !== trackingSessionRef.current
        ) {
          return;
        }

        if (latestLocationRef.current) {
          await sendLocation(
            socket,
            journeyIdRef.current,
            latestLocationRef.current
          );
        }
      } catch (err) {
        console.error("Journey reconnect error:", err);

        if (session === trackingSessionRef.current) {
          setError(err.message);
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
  }, [joinJourneyRoom, sendLocation]);

  // Start journey GPS tracking.
  const startTracking = useCallback(async () => {
    if (!journeyId) {
      setError("Journey ID is required");
      return false;
    }

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return false;
    }

    if (isTrackingRef.current || watchIdRef.current !== null) {
      return false;
    }

    setError("");

    const session = ++trackingSessionRef.current;

    try {
      const socket = socketRef.current || connectSocket();
      socketRef.current = socket;

      await waitForConnection(socket);

      if (session !== trackingSessionRef.current) {
        return false;
      }

      // Get the initial GPS position.
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

      if (session !== trackingSessionRef.current) {
        return false;
      }

      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed: position.coords.speed,
        heading: position.coords.heading,
        accuracy: position.coords.accuracy
      };

      // Join the room before sending GPS updates.
      await joinJourneyRoom(socket, journeyId);

      if (session !== trackingSessionRef.current) {
        return false;
      }

      await sendLocation(socket, journeyId, location);

      if (session !== trackingSessionRef.current) {
        return false;
      }

      latestLocationRef.current = location;
      setCurrentLocation(location);

      isTrackingRef.current = true;
      setIsTracking(true);

      // Continue watching the user's GPS position.
      const watchId = navigator.geolocation.watchPosition(
        async (newPosition) => {
          if (
            !isTrackingRef.current ||
            session !== trackingSessionRef.current
          ) {
            return;
          }

          const updatedLocation = {
            latitude: newPosition.coords.latitude,
            longitude: newPosition.coords.longitude,
            speed: newPosition.coords.speed,
            heading: newPosition.coords.heading,
            accuracy: newPosition.coords.accuracy
          };

          latestLocationRef.current = updatedLocation;
          setCurrentLocation(updatedLocation);

          const activeSocket = socketRef.current;

          if (activeSocket?.connected) {
            try {
              await sendLocation(
                activeSocket,
                journeyId,
                updatedLocation
              );
            } catch (err) {
              console.error("Journey GPS update error:", err);

              if (session === trackingSessionRef.current) {
                setError(err.message);
              }
            }
          }
        },
        (gpsError) => {
          if (session !== trackingSessionRef.current) return;

          console.error("Journey GPS error:", gpsError);

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

      // The session may have stopped while watchPosition was starting.
      if (session !== trackingSessionRef.current) {
        navigator.geolocation.clearWatch(watchId);
        return false;
      }

      watchIdRef.current = watchId;

      return true;
    } catch (err) {
      console.error("Start journey tracking error:", err);

      if (session === trackingSessionRef.current) {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }

        isTrackingRef.current = false;
        latestLocationRef.current = null;

        setIsTracking(false);
        setCurrentLocation(null);
        setError(err.message || "Unable to start journey tracking");
      }

      return false;
    }
  }, [
    journeyId,
    waitForConnection,
    joinJourneyRoom,
    sendLocation
  ]);

  // Clean up GPS sharing when this hook unmounts.
  useEffect(() => {
    return () => {
      trackingSessionRef.current += 1;

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      if (
        socketRef.current?.connected &&
        journeyIdRef.current
      ) {
        socketRef.current.emit("journey:location-stop", {
          journeyId: journeyIdRef.current
        });
      }

      isTrackingRef.current = false;
      latestLocationRef.current = null;
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

export default useJourneyTracking;
