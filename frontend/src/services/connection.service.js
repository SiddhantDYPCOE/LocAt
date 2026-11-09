
import api from "./api.js";

const connectionService = {
  // Search users
  searchUsers: async (query) => {
    const response = await api.get("/connections/search", {
      params: { q: query }
    });

    return response.data;
  },

  // Get accepted connections
  getConnections: async () => {
    const response = await api.get("/connections");
    return response.data;
  },

  // Get incoming requests
  getIncomingRequests: async () => {
    const response = await api.get("/connections/incoming");
    return response.data;
  },

  // Get outgoing requests
  getOutgoingRequests: async () => {
    const response = await api.get("/connections/outgoing");
    return response.data;
  },

  // Send connection request
  sendRequest: async (username) => {
    const response = await api.post("/connections/request", {
      username
    });

    return response.data;
  },

  // Accept request
  acceptRequest: async (connectionId) => {
    const response = await api.patch(
      `/connections/${connectionId}/accept`
    );

    return response.data;
  },

  // Reject request
  rejectRequest: async (connectionId) => {
    const response = await api.patch(
      `/connections/${connectionId}/reject`
    );

    return response.data;
  },

  // Remove connection
  removeConnection: async (connectionId) => {
    const response = await api.delete(
      `/connections/${connectionId}`
    );

    return response.data;
  }
};

export default connectionService;
