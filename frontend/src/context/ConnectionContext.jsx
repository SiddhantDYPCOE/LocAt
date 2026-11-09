
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react";

import { useAuth } from "./AuthContext.jsx";
import connectionService from "../services/connection.service.js";

const ConnectionContext = createContext(null);

// Handles different possible API response structures.
const extractList = (response, keys) => {
  const payload = response?.data ?? response;

  if (Array.isArray(payload)) {
    return payload;
  }

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }

    if (Array.isArray(payload?.data?.[key])) {
      return payload.data[key];
    }
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
};

export const ConnectionProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [connections, setConnections] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all connection-related data.
  const refreshConnections = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const [
        connectionsResponse,
        incomingResponse,
        outgoingResponse
      ] = await Promise.all([
        connectionService.getConnections(),
        connectionService.getIncomingRequests(),
        connectionService.getOutgoingRequests()
      ]);

      setConnections(
        extractList(connectionsResponse, ["connections"])
      );

      setIncomingRequests(
        extractList(incomingResponse, [
          "requests",
          "incomingRequests"
        ])
      );

      setOutgoingRequests(
        extractList(outgoingResponse, [
          "requests",
          "outgoingRequests"
        ])
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to load connections"
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Search users by username or name.
  const searchUsers = async (query) => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      return [];
    }

    try {
      const response = await connectionService.searchUsers(
        trimmedQuery
      );

      const results = extractList(response, ["users", "results"]);

      setSearchResults(results);
      return results;
    } catch (err) {
      setSearchResults([]);
      throw err;
    }
  };

  // Send a connection request.
  const sendRequest = async (username) => {
    const response = await connectionService.sendRequest(username);

    await refreshConnections();

    return response;
  };

  // Accept an incoming request.
  const acceptRequest = async (connectionId) => {
    const response = await connectionService.acceptRequest(
      connectionId
    );

    await refreshConnections();

    return response;
  };

  // Reject an incoming request.
  const rejectRequest = async (connectionId) => {
    const response = await connectionService.rejectRequest(
      connectionId
    );

    await refreshConnections();

    return response;
  };

  // Remove an accepted connection.
  const removeConnection = async (connectionId) => {
    const response = await connectionService.removeConnection(
      connectionId
    );

    await refreshConnections();

    return response;
  };

  // Load connection data after authentication.
  useEffect(() => {
    if (isAuthenticated) {
      refreshConnections();
    } else {
      setConnections([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setSearchResults([]);
      setError(null);
    }
  }, [isAuthenticated, refreshConnections]);

  const value = {
    connections,
    incomingRequests,
    outgoingRequests,
    searchResults,
    loading,
    error,

    refreshConnections,
    searchUsers,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeConnection
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnections = () => {
  const context = useContext(ConnectionContext);

  if (!context) {
    throw new Error(
      "useConnections must be used inside ConnectionProvider"
    );
  }

  return context;
};
